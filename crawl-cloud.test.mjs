import {test} from 'node:test';import assert from 'node:assert/strict';
import {crawlStoreOver} from './core/crawl-store.mjs';import {workOnce} from './core/crawl-worker.mjs';
import {crawlStatus,crawlSettings,validateSettings,startCrawl,stopCrawl} from './core/crawl-control.mjs';

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
 assert.throws(()=>validateSettings({rateMs:100}),/קצב/);assert.throws(()=>validateSettings({sources:{evil:true}}),/מקורות/);assert.deepEqual(validateSettings({autoMerge:true,x:1}),{autoMerge:true});
 assert.deepEqual(crawlSettings({crawler:{sources:{catalog:false}}}).sources,{clicks:true,sitemap:true,catalog:false});
 assert.equal(crawlStatus(null,crawlSettings({})).status,'none');
});
test('a missing pid file never counts as a live worker',async()=>{const {alive}=await import('./core/crawl-control.mjs');assert.equal(alive(0),false);assert.equal(alive(Number('')),false);assert.equal(alive(process.pid),true);});

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
