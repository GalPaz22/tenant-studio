import {test} from 'node:test';import assert from 'node:assert/strict';
import {crawlStoreOver} from './core/crawl-store.mjs';import {workOnce} from './core/crawl-worker.mjs';
import {crawlStatus,crawlSettings,validateSettings,startCrawl,stopCrawl} from './core/crawl-control.mjs';
import {runCrawl,mergeCrawl} from './core/site-crawler.mjs';
import {DEFAULT_SPEC} from './core/scraper-builder.mjs';
import {existingProject} from './existing-client.mjs';

// Minimal in-memory stand-in for the MongoDB collection API the crawl store uses.
const get=(doc,path)=>path.split('.').reduce((v,k)=>v==null?undefined:v[k],doc);
const matches=(doc,f)=>Object.entries(f).every(([k,v])=>k==='$or'?v.some(x=>matches(doc,x)):v&&typeof v==='object'&&'$lt' in v?get(doc,k)!==undefined&&get(doc,k)<v.$lt:v===null?get(doc,k)==null:get(doc,k)===v);
const setPath=(doc,path,v)=>{const ks=path.split('.');let o=doc;for(const k of ks.slice(0,-1))o=o[k]??={};o[ks.at(-1)]=v;};
function collection(){const docs=new Map();const apply=(d,u,insert)=>{for(const [k,v] of Object.entries(u.$set||{}))setPath(d,k,structuredClone(v));for(const k of Object.keys(u.$unset||{}))delete d[k];if(insert)for(const [k,v] of Object.entries(u.$setOnInsert||{}))if(d[k]===undefined)d[k]=v;};
 return {docs,
  async findOne(f,o={}){const d=[...docs.values()].find(d=>matches(d,f));if(!d)return null;const c=structuredClone(d);for(const [k,v] of Object.entries(o.projection||{}))if(!v)delete c[k];return c;},
  async countDocuments(f){return [...docs.values()].filter(d=>matches(d,f)).length;},
  find(f,o={}){return {toArray:async()=>[...docs.values()].filter(d=>matches(d,f)).map(d=>{const c=structuredClone(d);for(const [k,v] of Object.entries(o.projection||{}))if(!v)delete c[k];return c;})};},
  async bulkWrite(ops){for(const {replaceOne:{filter,replacement}} of ops)docs.set(filter._id,structuredClone(replacement));},
  async updateOne(f,u,o={}){let d=[...docs.values()].find(d=>matches(d,f));const insert=!d;if(insert){if(!o.upsert)return;d={_id:f._id};docs.set(f._id,d);}apply(d,u,insert);},
  async findOneAndUpdate(f,u,o={}){const d=[...docs.values()].find(d=>matches(d,f));if(!d)return null;apply(d,u,false);const c=structuredClone(d);for(const [k,v] of Object.entries(o.projection||{}))if(!v)delete c[k];return c;},
 };}
const fakeStore=(now)=>{const crawls=collection(),products=collection();return {crawls,products,store:crawlStoreOver({crawls,products},{now})};};
const project={id:'11111111-1111-1111-1111-111111111111',url:'https://shop.example',existingClient:{dbName:'shop'},crawler:{rateMs:500}};

test('studio start → worker seeds, crawls and saves only new pages → status shows progress; worker exit keeps the job for the next worker',async()=>{
 let t=Date.parse('2026-09-24T10:00:00Z');const {store,products,crawls}=fakeStore(()=>new Date(t));
 await startCrawl(project,store);
 const pending=crawlStatus(await store.meta(project.id),crawlSettings(project),null,{now:t});assert.equal(pending.status,'waiting');
 const seed=async p=>({projectId:p.id,origin:p.url,status:'ready',robots:{rules:[]},sources:{clicks:2,sitemap:0,catalog:0},queue:[p.url+'/1',p.url+'/2',p.url+'/3'],next:0,products:{},errors:{},failures:0,startedAt:'s'});
 let exit=false;
 // The fake run crawls two pages, saving after each, then the worker is asked to shut down (a Render deploy).
 const run=async(state,{store:s,shouldStop})=>{for(const sku of ['1','2']){state.products[sku]={sku,name:'p'+sku};state.next++;t+=30000;await s.save(state);if(sku==='2')exit=true;if(shouldStop())break;}state.status='stopped';};
 await workOnce(store,{owner:'laptop#a',seed,run,log:()=>{},shouldExit:()=>exit});
 assert.equal(products.docs.size,2);const doc=crawls.docs.get(project.id);assert.equal(doc.desired,'running','a shutting-down worker leaves the job running');assert.equal(doc.lease,null);assert.equal(doc.queue.length,3);assert.equal(doc.reseedRequested,false);
 const s=crawlStatus(await store.meta(project.id),crawlSettings(project),{pages:1},{now:t});assert.deepEqual([s.status,s.done,s.total,s.products,s.unmerged],['waiting',2,3,2,1]);
 // A second worker (Render) resumes from the checkpoint without reseeding or redoing pages.
 let seeded=false;const resumed=[];
 await workOnce(store,{owner:'render#b',seed:async()=>{seeded=true;},run:async(state,{store:s})=>{resumed.push(state.next,Object.keys(state.products).length);state.products['3']={sku:'3'};state.next=3;state.status='done';await s.save(state);},log:()=>{}});
 assert.equal(seeded,false);assert.deepEqual(resumed,[2,2]);assert.equal(products.docs.size,3);assert.equal(crawls.docs.get(project.id).desired,'done');
});
test('a live lease keeps a second worker out; stop from the studio ends the run and releases',async()=>{
 let t=Date.parse('2026-09-24T10:00:00Z');const {store,crawls}=fakeStore(()=>new Date(t));
 await store.save({projectId:project.id,queue:['a','b','c'],next:0,products:{},errors:{}},{queue:true});await startCrawl(project,store);
 assert.ok(await store.claim('one#1'));assert.equal(await store.claim('two#2'),null);
 const live=crawlStatus(await store.meta(project.id),crawlSettings(project),null,{now:t});assert.equal(live.status,'running');assert.equal(live.worker,'one');
 t+=4*60*1000;assert.equal(crawlStatus(await store.meta(project.id),crawlSettings(project),null,{now:t}).status,'waiting','an expired lease no longer counts as running');
 const run=async(state,{store:s,shouldStop})=>{state.next=1;await stopCrawl(project,store);await s.save(state);assert.equal(shouldStop(),true);state.status='stopped';};
 await workOnce(store,{owner:'two#2',run,log:()=>{}});
 const doc=crawls.docs.get(project.id);assert.equal(doc.desired,'stopped');assert.equal(doc.lease,null);assert.equal(doc.status,'stopped');
 await assert.rejects(()=>stopCrawl(project,store),/לא רץ/);
});
test('errors survive the round trip as a list (URLs are not safe field names) and settings are validated',async()=>{
 const {store,crawls}=fakeStore(()=>new Date());
 await store.save({projectId:project.id,queue:[],next:0,products:{},errors:{'https://s.co/1':'HTTP 404'}});
 assert.deepEqual(crawls.docs.get(project.id).errors,[{url:'https://s.co/1',error:'HTTP 404'}]);assert.deepEqual((await store.read(project.id)).errors,{'https://s.co/1':'HTTP 404'});
 assert.throws(()=>validateSettings({rateMs:100}),/קצב/);assert.throws(()=>validateSettings({concurrency:9}),/במקביל/);assert.deepEqual(validateSettings({concurrency:4}),{concurrency:4});assert.throws(()=>validateSettings({sources:{evil:true}}),/מקורות/);assert.deepEqual(validateSettings({autoMerge:true,x:1}),{autoMerge:true});
 assert.deepEqual(crawlSettings({crawler:{sources:{catalog:false}}}).sources,{clicks:true,sitemap:true,catalog:false});
 assert.equal(crawlStatus(null,crawlSettings({})).status,'none');
});
test('a missing pid file never counts as a live worker',async()=>{const {alive}=await import('./core/crawl-control.mjs');assert.equal(alive(0),false);assert.equal(alive(Number('')),false);assert.equal(alive(process.pid),true);});

test('restarting a completed legacy crawl refreshes existing pages, persists changes and enables merging without new products',async()=>{
 const {store,crawls,products}=fakeStore(()=>new Date());
 const spec={...DEFAULT_SPEC,productUrl:'^https://shop\\.example/product/([^/?#]+)'},p={...project,scraper:{status:'active',spec}};
 const urls=['https://shop.example/product/case/','https://shop.example/product/cable/'];
 await store.save({projectId:p.id,status:'done',queue:urls,next:2,products:{case:{sku:'case',price:100,stockStatus:'instock'},cable:{sku:'cable',price:100,stockStatus:'instock'}},errors:{[urls[0]]:'old error'}},{queue:true});
 // This is the state left by the old worker in Shipi: the checkpoint is at the end,
 // with an earlier merge and no revision counter on either side.
 delete crawls.docs.get(p.id).productRevision;
 const merged=existingProject('shop',{dbName:'shop'},urls.map((url,i)=>({id:String(i+1),name:'Product',url,price:100,stockStatus:'instock'})));
 merged.siteCrawl={pages:2};
 assert.equal(crawlStatus(await store.meta(p.id),crawlSettings(p),merged.siteCrawl).unmerged,0);
 await startCrawl(p,store);assert.equal(crawls.docs.get(p.id).rescanRequested,true);
 // A double click while queued must preserve the pending reset.
 await startCrawl(p,store);assert.equal(crawls.docs.get(p.id).rescanRequested,true);
 const fetched=[];
 await workOnce(store,{owner:'studio#rescan',projectId:p.id,log:()=>{},
  seed:async()=>({projectId:p.id,queue:urls,next:0,products:{},errors:{},robots:{rules:[]},status:'ready',startedAt:new Date().toISOString()}),
  run:async(state,options)=>{assert.equal(state.next,0);assert.deepEqual(state.errors,{});await runCrawl(state,{...options,pause:async()=>{},fetcher:async url=>{fetched.push(url);return {status:200,headers:{get:()=>null},text:async()=>'<script type="application/ld+json">{"name":"Product","offers":{"price":49,"availability":"OutOfStock"}}</script>'};}});},
 });
 assert.deepEqual(fetched,urls);assert.equal(products.docs.size,2);
 const state=await store.read(p.id);assert.equal(state.products.case.price,49);assert.equal(state.products.case.stockStatus,'outofstock');assert.equal(state.next,2);
 const meta=await store.meta(p.id);assert.equal(meta.desired,'done');assert.equal(meta.rescanRequested,false);assert.equal(meta.productRevision,4);
 assert.equal(crawlStatus(meta,crawlSettings(p),merged.siteCrawl).unmerged,2,'updates to previously merged products also await merging');
 const counts=mergeCrawl(merged,state,spec);assert.equal(counts.added,0);assert.equal(counts.updated,2);assert.equal(merged.productCards[0].price,49);
 assert.equal(crawlStatus(meta,crawlSettings(p),merged.siteCrawl).unmerged,0);
 await store.save(state);assert.equal((await store.meta(p.id)).productRevision,4,'unchanged checkpoint saves do not create pending changes');
 // The cache also notices updates made in place, and a fresh worker loads that value.
 state.products.case.price=39;await store.save(state);
 const freshStore=crawlStoreOver({crawls,products});assert.equal((await freshStore.read(p.id)).products.case.price,39);
 assert.equal(crawlStatus(await freshStore.meta(p.id),crawlSettings(p),merged.siteCrawl).unmerged,1);
 state.products.case.description='x'.repeat(4000);await store.save(state);const revision=state.productRevision;
 await store.read(p.id);await store.save(state);
 assert.equal(state.productRevision,revision,'a concurrent merge read of truncated descriptions does not make unchanged pages dirty');
});

test('discovery skips known keys with trailing slashes; an interrupted crawl resumes unless a full rescan is requested',async()=>{
 const {store,crawls}=fakeStore(()=>new Date()),spec={...DEFAULT_SPEC,productUrl:'/product/([^/?#]+)'},p={...project,scraper:{status:'active',spec}};
 const urls=['https://shop.example/product/known/','https://shop.example/product/new/'];
 await store.save({projectId:p.id,status:'stopped',queue:urls,next:1,products:{known:{sku:'known'}},errors:{}},{queue:true});
 await startCrawl(p,store);assert.equal(crawls.docs.get(p.id).rescanRequested,false);
 await workOnce(store,{owner:'studio#resume',log:()=>{},seed:async()=>assert.fail('resume must retain its queue'),run:async state=>{assert.equal(state.next,1);state.status='stopped';}});
 await startCrawl(p,store,{reseed:true});assert.equal(crawls.docs.get(p.id).rescanRequested,false);
 const seed=async()=>({projectId:p.id,queue:urls,next:0,products:{},errors:{},status:'ready'});
 await workOnce(store,{owner:'studio#discovery',log:()=>{},seed,run:async state=>{assert.deepEqual(state.queue,[urls[1]]);state.status='stopped';}});
 await startCrawl(p,store,{rescan:true});
 await workOnce(store,{owner:'studio#full',log:()=>{},seed,run:async state=>{assert.deepEqual(state.queue,urls);assert.equal(state.next,0);state.status='done';}});
});

test('a worker that stops making progress exits so a fresh one resumes; beats keep it alive',async()=>{
 const {watchdog}=await import('./core/crawl-worker.mjs');
 let clock=0,stalled=null;const dog=watchdog({stallMs:30*60000,everyMs:5,now:()=>clock,onStall:m=>{stalled=m;}});
 clock=20*60000;dog.beat();clock=45*60000;await new Promise(r=>setTimeout(r,20));assert.equal(stalled,null,'a checkpoint 25 minutes ago is still progress');
 clock=51*60000;await new Promise(r=>setTimeout(r,20));assert.equal(stalled,31,'31 minutes without a beat: exit');dog.stop();
});

test('the studio runs a tenant’s crawl itself, only that tenant, once at a time; a validated draft scraper is used',async()=>{
 const {runInProcess,runningInProcess}=await import('./core/crawl-worker.mjs');const {crawlTarget,scraperReady}=await import('./core/crawl-control.mjs');
 let t=Date.parse('2026-09-26T10:00:00Z');const {store,crawls}=fakeStore(()=>new Date(t));
 const other={...project,id:'22222222-2222-2222-2222-222222222222'};await startCrawl(other,store);await startCrawl(project,store);
 const seed=async p=>({projectId:p.id,origin:p.url,status:'ready',robots:{rules:[]},sources:{},queue:[p.url+'/1'],next:0,products:{},errors:{},failures:0,startedAt:'s'});
 const crawled=[];let release;const gate=new Promise(r=>{release=r;});
 const run=async(state,{store:s})=>{crawled.push(state.projectId);await gate;state.products['1']={sku:'1'};state.next=1;await s.save(state);state.status='done';};
 const first=runInProcess(store,project.id,{seed,run,log:()=>{}});assert.equal(runInProcess(store,project.id,{seed,run,log:()=>{}}),first,'a second start joins the running crawl');
 await new Promise(r=>setTimeout(r,10));assert.equal(runningInProcess(project.id),true);assert.deepEqual(crawled,[project.id],'only the requested tenant, not the other queued one');
 release();await first;assert.equal(runningInProcess(project.id),false);assert.equal(crawls.docs.get(project.id).status,'done');assert.equal(crawls.docs.get(other.id).lease,undefined);

 const spec={productUrl:'^https://shop\\.example/product/([^/]+)'};
 assert.equal(crawlTarget({...project,scraper:{status:'draft',spec,validation:{fill:{name:1,key:1}}}}).spec,spec,'validated draft scraper');
 assert.equal(crawlTarget({...project,scraper:{status:'draft',spec,validation:{fill:{name:0.5,key:1}}}}).spec,null,'an unvalidated draft is not');
 assert.equal(scraperReady({status:'active',spec}),true);
});

test('a WooCommerce rescan lists the store first and reads only the rest; a full rescan reads every page',async()=>{
 const {store,crawls}=fakeStore(()=>new Date()),spec={...DEFAULT_SPEC,productUrl:'/product/([^/?#]+)'},p={...project,platform:'woocommerce',scraper:{status:'active',spec}};
 const urls=['visible','hidden','edited','brandnew'].map(k=>`https://shop.example/product/${k}/`);
 await store.save({projectId:p.id,status:'done',queue:urls,next:4,products:{hidden:{sku:'hidden',crawledAt:'2026-10-20',stockStatus:'outofstock'},edited:{sku:'edited',crawledAt:'2026-10-20',stockStatus:'outofstock'}},errors:{}},{queue:true});
 const seed=async()=>({projectId:p.id,origin:p.url,queue:urls,lastmod:{[urls[1]]:'2026-10-01',[urls[2]]:'2026-10-25'},next:0,products:{},errors:{},status:'ready',robots:{rules:[]},sources:{}});
 let swept=0;const sweep=async state=>{swept++;state.products.visible={sku:'visible',price:10,stockStatus:'instock'};return {swept:new Set(['visible']),complete:true,changed:1};};
 await startCrawl(p,store);
 await workOnce(store,{owner:'a#1',log:()=>{},seed,sweep,run:async state=>{assert.deepEqual(state.queue,[urls[2],urls[3]]);assert.equal(state.lastmod,undefined);state.next=2;state.status='done';}});
 assert.equal(swept,1);assert.equal((await store.read(p.id)).products.visible.price,10,'the listing reaches the store');
 await startCrawl(p,store,{full:true});assert.equal(crawls.docs.get(p.id).fullRescanRequested,true);
 await workOnce(store,{owner:'a#2',log:()=>{},seed,sweep,run:async state=>{assert.deepEqual(state.queue,urls);state.status='done';}});
 assert.equal(swept,1,'a full rescan does not list');assert.equal(crawls.docs.get(p.id).fullRescanRequested,false);
});

test('crawl status and start never parse the full project file',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{createStore}=await import('./store.mjs');
 const root=await mkdtemp(tmpdir()+'/crawl-meta-');let parsed=0;const files=createStore(root,{onParse:(_,phase)=>{if(phase==='start')parsed++;}});
 try{await files.save({...project,name:'Shop',platform:'woocommerce',revisions:[],siteCrawl:{pages:3},scraper:{status:'active',spec:{productUrl:'x'}},updatedAt:'t'});
  const m=await files.meta(project.id);assert.equal(parsed,0);assert.deepEqual([m.siteCrawl.pages,m.scraper.status,m.crawler.rateMs],[3,'active',500]);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('spawnCrawl runs one process per tenant in the worker script and forgets it when it exits',async()=>{
 const {spawnCrawl,runningInProcess}=await import('./core/crawl-worker.mjs'),{mkdtemp,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{EventEmitter}=await import('node:events');
 const root=await mkdtemp(tmpdir()+'/crawl-spawn-'),calls=[],child=Object.assign(new EventEmitter(),{unref(){}});
 const launch=(cmd,args,opts)=>{calls.push({args,opts});return child;};
 try{assert.equal(spawnCrawl(project.id,root,{launch,log:()=>{}}),child);spawnCrawl(project.id,root,{launch,log:()=>{}});
  assert.equal(calls.length,1);assert.deepEqual(calls[0].args.slice(1),['--project',project.id]);assert.ok(calls[0].args[0].endsWith('crawl-worker.mjs'));assert.equal(calls[0].opts.detached,true);
  assert.equal(runningInProcess(project.id),true);child.emit('exit',0);assert.equal(runningInProcess(project.id),false);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('crawl API requests a full pass after completion and forwards an explicit restart for a partial crawl',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{createStore}=await import('./store.mjs');
 const {createServer}=await import('node:net'),probe=createServer().listen(0,'127.0.0.1');await new Promise(r=>probe.once('listening',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const root=await mkdtemp(tmpdir()+'/crawl-api-'),previous={data:process.env.STUDIO_DATA_DIR,mode:process.env.STUDIO_CRAWL_WORKER,port:process.env.PORT};
 process.env.STUDIO_DATA_DIR=root;process.env.STUDIO_CRAWL_WORKER='remote';process.env.PORT=String(port);
 const {app}=await import('./server.mjs'),{store,crawls}=fakeStore(()=>new Date());app.locals.crawlStore=store;
 const server=app.listen(port,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{
  await createStore(root).save({...project,name:'Shop',revisions:[],updatedAt:new Date().toISOString()});
  await store.save({projectId:project.id,status:'done',queue:['https://shop.example/123456'],next:1,products:{123456:{sku:'123456'}},errors:{}},{queue:true});
  const base='http://127.0.0.1:'+server.address().port,headers={Host:'127.0.0.1:'+(process.env.PORT||process.env.STUDIO_PORT||4320),'Content-Type':'application/json'};
  headers['X-Studio-Token']=(await (await fetch(base+'/api/session',{headers})).json()).token;
  const post=async(action,body={})=>{const r=await fetch(base+'/api/projects/'+project.id+'/crawl/'+action,{method:'POST',headers,body:JSON.stringify(body)});assert.equal(r.status,200);return r.json();};
  assert.equal((await post('start')).status,'waiting');assert.equal(crawls.docs.get(project.id).rescanRequested,true);
  await post('stop');crawls.docs.get(project.id).status='stopped';crawls.docs.get(project.id).next=0;
  await post('start',{rescan:true});assert.equal(crawls.docs.get(project.id).rescanRequested,true);
  await post('stop');crawls.docs.get(project.id).status='stopped';await post('start',{full:true});assert.equal(crawls.docs.get(project.id).fullRescanRequested,true);
  await post('stop');await post('start',{reseed:true});assert.equal(crawls.docs.get(project.id).rescanRequested,false);assert.equal(crawls.docs.get(project.id).reseedRequested,true);
 }finally{
  delete app.locals.crawlStore;await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});
  for(const [key,value] of [['STUDIO_DATA_DIR',previous.data],['STUDIO_CRAWL_WORKER',previous.mode],['PORT',previous.port]])if(value===undefined)delete process.env[key];else process.env[key]=value;
 }
});

test('automatic scans: every job on schedule except the skipped store, one at a time, and never a stopped one',async()=>{
 const {scanTick,scanDue,scansEnabled}=await import('./core/crawl-schedule.mjs');
 let t=Date.parse('2026-11-01T12:00:00Z');const {store,crawls}=fakeStore(()=>new Date(t)),env={STUDIO_AUTO_SCAN_HOURS:'6'};
 const job=(id,url,dbName,extra={})=>crawls.docs.set(id,{_id:id,target:{url,dbName},desired:'done',updatedAt:new Date(t-7*3600000).toISOString(),...extra});
 job('st','https://www.steimatzky.co.il','steimatzky');job('off','https://off.co','off',{desired:'stopped'});job('fresh','https://fresh.co','fresh',{updatedAt:new Date(t-3600000).toISOString()});job('a','https://shipi.co.il/','shipi');job('b','https://www.carmella.co.il','carmella',{updatedAt:new Date(t-9*3600000).toISOString()});
 const launched=[];assert.equal(await scanTick(store,{env,now:t,launch:id=>launched.push(id)}),'b','the longest waiting first');
 assert.deepEqual([crawls.docs.get('b').desired,crawls.docs.get('b').rescanRequested,crawls.docs.get('b').reseedRequested],['running',true,true]);
 assert.equal(await scanTick(store,{env,now:t,launch:id=>launched.push(id)}),null,'one scan at a time');assert.deepEqual(launched,['b']);
 crawls.docs.get('b').desired='done';crawls.docs.get('b').updatedAt=new Date(t).toISOString();
 assert.equal(await scanTick(store,{env,now:t,launch:id=>launched.push(id)}),'a');crawls.docs.get('a').desired='done';crawls.docs.get('a').updatedAt=new Date(t).toISOString();
 assert.equal(await scanTick(store,{env,now:t,launch:id=>launched.push(id)}),null,'steimatzky, a stopped job and a fresh scan stay out');
 assert.equal(scanDue({target:{url:'https://x.co'},updatedAt:new Date(t).toISOString()},{now:t+6*3600000}),true);
 assert.equal(scansEnabled({RENDER:'true'}),true);assert.equal(scansEnabled({}),false);assert.equal(scansEnabled({RENDER:'true',STUDIO_AUTO_SCAN:'0'}),false);
});
test('a scan reaches the live rows of a studio-synced store only, keeps lastSeenAt out and holds back a mass sell-out',async()=>{
 const {applyScanToStore}=await import('./core/crawl-schedule.mjs');
 const rows=[{_id:'r1',id:1,url:'https://s.co/product/a',price:10,stockStatus:'instock'},{_id:'r2',id:2,url:'https://s.co/product/b',price:20,regular_price:20,stockStatus:'instock',stock_status:'instock'},...Array.from({length:20},(_,i)=>({_id:'x'+i,id:100+i,url:'https://s.co/product/x'+i,price:5,stockStatus:'instock'}))];
 const written=[];let syncMode='studio';
 const client={db:name=>({collection:c=>c==='users'?{findOne:async f=>f.syncMode===syncMode?{_id:1}:null}:{find:()=>({toArray:async()=>rows}),bulkWrite:async ops=>{written.push(...ops);}}})};
 const job={_id:'j',target:{dbName:'shop',spec:{productUrl:'/product/([^/?#]+)'}}},state={products:{a:{sku:'a',key:'a',price:12,stockStatus:'onbackorder'},b:{sku:'b',key:'b',price:20,stockStatus:'unknown'},n:{sku:'n',key:'n',productId:9,name:'חדש',url:'https://s.co/product/n',price:30,stockStatus:'instock'},hiddenPage:{sku:'hiddenPage',key:'hiddenPage',name:'טלפון',stockStatus:'outofstock'},gone:{sku:'gone',key:'gone',productId:8,name:'אזל',stockStatus:'outofstock'}}};
 const r=await applyScanToStore(client,state,job);assert.deepEqual([r.stock,r.price,r.added,r.writes],[1,1,1,2]);
 assert.deepEqual(written[0].updateOne.update.$set.stock_status,'onbackorder');assert.equal(written[0].updateOne.update.$set.lastSeenAt,undefined);assert.equal(written[1].updateOne.update.$setOnInsert.id,9);
 written.length=0;await applyScanToStore(client,state,job,{dryRun:true});assert.equal(written.length,0);
 const soldOut={products:Object.fromEntries(rows.map((row,i)=>[row.url.split('/').pop(),{sku:String(i),key:row.url.split('/').pop(),stockStatus:'outofstock'}]))};
 assert.equal((await applyScanToStore(client,soldOut,job)).heldBack,true);assert.equal(written.length,0);
 syncMode='other';assert.equal((await applyScanToStore(client,state,job)).skipped,'store syncs itself');assert.equal(written.length,0);
});
test('a finished scan calls afterScan; a stopped one does not',async()=>{
 const {store}=fakeStore(()=>new Date()),seen=[];await startCrawl(project,store);
 const seed=async p=>({projectId:p.id,origin:p.url,status:'ready',robots:{rules:[]},sources:{},queue:['u'],next:0,products:{},errors:{},failures:0,startedAt:'s'});
 await workOnce(store,{owner:'a#1',log:()=>{},seed,afterScan:async s=>{seen.push(s.status);throw Error('rows down');},run:async s=>{s.next=1;s.status='done';}});assert.deepEqual(seen,['done'],'a failed write does not fail the scan');
 await store.control(project.id,{desired:'running'});await workOnce(store,{owner:'a#2',log:()=>{},afterScan:async s=>seen.push(s.status),run:async s=>{s.status='stopped';}});assert.equal(seen.length,1);
});
