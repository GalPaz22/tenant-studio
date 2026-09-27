import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,symlink,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import express from 'express';
import {buildMiniServer,slugOf} from './mini-server.mjs';
import {existingProject} from './existing-client.mjs';
import {validateRankingRule} from './core/ranking.mjs';

// A tiny in-memory stand-in for the Mongo driver calls the module makes.
function fakeDb(rows,{fail=()=>false}={}){
 const sessions=new Map();
 const products={find:()=>({limit:()=>({batchSize:()=>({toArray:async()=>{if(fail())throw Error('mongo down');return rows.map(r=>({...r}));},close:async()=>{}})})})};
 const store={createIndex:async()=>{},insertMany:async docs=>{for(const d of docs)sessions.set(d._id,structuredClone(d));},findOne:async({_id})=>structuredClone(sessions.get(_id)??null)};
 return {collection:name=>name==='products'?products:store};
}

test('a tenant mini server plugs into a dashboard-server-shaped app behind its flag, with live stock and paging',async()=>{
 const root=fileURLToPath(new URL('.',import.meta.url)),dir=await mkdtemp(join(tmpdir(),'dashboard-'));
 const rows=[{id:'s1',name:'רוטב עגבניות שרי',categories:['רטבים'],stockStatus:'instock',price:12},
  ...Array.from({length:14},(_,i)=>({id:'v'+i,name:`עגבניה ${i}`,categories:['ירקות'],stockStatus:'instock',price:5+i}))];
 const p=existingProject('carmella',{dbName:'carmella-db',collection:'products'},rows);
 p.revisions[0].profile={...p.revisions[0].profile,rankingRules:[validateRankingRule({label:'fresh',field:'categories',values:['ירקות']})],pipeline:{...p.revisions[0].profile.pipeline,expansion:'off',pageSize:4}};
 p.productCards=p.productCards.map(c=>c.id.endsWith('v3')?{...c,specifications:{...c.specifications,taste:'מתוק'}}:c);
 try{
  const {manifest,files}=buildMiniServer(p);assert.equal(manifest.slug,slugOf(p));assert.equal(manifest.dbName,'carmella-db');
  for(const [name,content] of Object.entries(files)){await mkdir(dirname(join(dir,name)),{recursive:true});await writeFile(join(dir,name),content);}
  // DASHBOARD_NODE_MODULES=<dashboard-server>/node_modules checks the module against the real server's dependencies.
  await symlink(process.env.DASHBOARD_NODE_MODULES||join(root,'node_modules'),join(dir,'node_modules'));
  // Live Mongo differs from the snapshot: s1 is cheaper, v1 went out of stock, n1 is new.
  const live=[...rows.map(r=>r.id==='s1'?{...r,price:9}:r.id==='v1'?{...r,stockStatus:'outofstock'}:r),{id:'n1',name:'עגבניה חדשה',categories:['ירקות'],stockStatus:'instock',price:7}];
  const {createSemantixTenants}=await import(pathToFileURL(join(dir,'tenants/semantix-registry.mjs')).href);
  let userSwitch=null;const db=fakeDb(live),tenants=createSemantixTenants({getDb:async name=>(assert.equal(name,'carmella-db'),db)});
  const app=express();app.use(express.json());app.use((req,_res,next)=>{req.store={dbName:req.get('X-Store'),semantix:userSwitch};next();});
  app.post('/search',tenants.search,(_req,res)=>res.json({legacy:true}));app.get('/search/load-more',tenants.loadMore,(_req,res)=>res.json({legacy:true}));
  const server=app.listen(0);await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
  const post=(body,store='carmella-db')=>fetch(base+'/search',{method:'POST',headers:{'Content-Type':'application/json','X-Store':store},body:JSON.stringify(body)}).then(r=>r.json());
  try{
   assert.deepEqual(await post({query:'עגבניות',modern:true}),{legacy:true},'off by default: the existing pipeline answers');
   process.env.SEMANTIX_TENANTS=manifest.slug;assert.deepEqual(await post({query:'עגבניות',modern:true}),{legacy:true},'env does not switch a module on');delete process.env.SEMANTIX_TENANTS;
   userSwitch={module:manifest.slug,enabled:true};
   assert.deepEqual(await post({query:'עגבניות',modern:true},'someone-else'),{legacy:true},'other stores are untouched');
   const r=await post({query:'עגבניות',limit:10,modern:true});
   assert.equal(r.metadata.searchEngine,'semantix-'+manifest.slug);assert.deepEqual(r.metadata.ranking,['fresh']);
   assert.ok(!r.products.some(x=>x.id.endsWith('v1')),'live stock hides a product that went out of stock');
   assert.ok(r.products.some(x=>x.title==='עגבניה חדשה')||r.pagination.hasMore,'a new product is searchable');
   assert.equal(r.products.at(-1)?.categories?.[0]==='רטבים'||r.pagination.hasMore,true);
   assert.equal(r.products.find(x=>x.id.endsWith('v3'))?.specifications?.taste,'מתוק','enriched snapshot fields are kept');
   assert.ok(r.pagination.nextToken.startsWith(manifest.tokenPrefix));
   const more=await fetch(base+'/search/load-more?token='+encodeURIComponent(r.pagination.nextToken)+'&limit=10',{headers:{'X-Store':'carmella-db'}}).then(x=>x.json());
   const all=[...r.products,...more.products];assert.equal(all.length,r.total);assert.equal(new Set(all.map(x=>x.id)).size,all.length);
   assert.equal(all.find(x=>x.id.endsWith('s1')).price,9,'live price');assert.equal(all.at(-1).id.endsWith('s1'),true,'the sauce ranks after fresh tomatoes');
   const paged=await post({query:'עגבניות',modern:true});assert.equal(paged.products.length,4,'no limit from the storefront: the tenant page size');
   const next=await fetch(base+'/search/load-more?token='+encodeURIComponent(paged.pagination.nextToken),{headers:{'X-Store':'carmella-db'}}).then(x=>x.json());assert.equal(next.products.length,4,'load-more pages use it too');
   const bad=await fetch(base+'/search/load-more?token='+manifest.tokenPrefix+'nope',{headers:{'X-Store':'carmella-db'}});assert.equal(bad.status,410);
  }finally{server.close();}
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('export writes the module into a local dashboard-server, verifies it loads, backs up the previous version and never overwrites foreign folders',async()=>{
 const {exportToDashboard,dashboardStatus}=await import('./core/dashboard-export.mjs');
 const published=[],publish=async(proj,slug)=>{published.push(slug);return {revision:proj.revisions.at(-1).number};};
 const root=fileURLToPath(new URL('.',import.meta.url)),dir=await mkdtemp(join(tmpdir(),'dash-local-')),backups=join(dir,'..',`${dir.split('/').pop()}-backups`);
 try{
  await mkdir(join(dir,'tenants/garmin'),{recursive:true});await writeFile(join(dir,'server.js'),'// server');await symlink(process.env.DASHBOARD_NODE_MODULES||join(root,'node_modules'),join(dir,'node_modules'));
  assert.deepEqual(await dashboardStatus(dir),{dir,found:true,wired:false,userField:false});
  const p=existingProject('carmella',{dbName:'carmella-db'},[{id:'1',name:'עגבניה',categories:['ירקות'],stockStatus:'instock'}]);
  const first=await exportToDashboard(p,{dir,backups,publish});assert.equal(first.verified.ok,true,first.verified.error);assert.equal(first.backup,null);assert.match(first.enable,/semantix:\{module:"carmella",enabled:true\}/);
  assert.deepEqual(published,['carmella'],'the data is published to the store database');assert.equal(existsSync(join(dir,'tenants/carmella/snapshot.json')),false,'no catalog data on disk or in git');
  const {codeStatus}=await import('./core/dashboard-export.mjs'),exported={...p,dashboardExport:{slug:'carmella'}};
  assert.equal((await codeStatus(exported,{dir})).engineChanged,false,'freshly exported code matches the studio');
  await writeFile(join(dir,'tenants/carmella/engine/runtime.mjs'),'// older engine');
  const stale=await codeStatus(exported,{dir});assert.equal(stale.action,'export');assert.deepEqual(stale.changedFiles,['engine/runtime.mjs']);
  const second=await exportToDashboard(p,{dir,backups,publish});assert.ok(second.backup,'previous version moved to backups');
  const garmin=existingProject('garmin',{dbName:'garmin'},[{id:'1',name:'שעון',stockStatus:'instock'}]);
  await writeFile(join(dir,'tenants/garmin/routes.mjs'),'// hand-written');
  const g=await exportToDashboard(garmin,{dir,backups,publish});assert.equal(g.slug,'garmin-semantix','a hand-written tenant keeps its folder; the module takes its own name');assert.equal(g.verified.ok,true,g.verified.error);
  assert.equal(await readFile(join(dir,'tenants/garmin/routes.mjs'),'utf8'),'// hand-written');
  assert.equal((await exportToDashboard({...garmin,dashboardExport:{slug:g.slug}},{dir,backups,publish})).slug,'garmin-semantix','stable across exports');
  await writeFile(join(dir,'server.js'),"import {createSemantixTenants} from './tenants/semantix-registry.mjs';app.post('/search',semantixTenants.search);app.get('/x',semantixTenants.loadMore)");assert.equal((await dashboardStatus(dir)).wired,true);
 }finally{await rm(dir,{recursive:true,force:true});await rm(backups,{recursive:true,force:true});}
});

test('production control: a Mongo switch overrides env, rolls out by share, has a kill switch, and failures fall back to the existing search',async()=>{
 const root=fileURLToPath(new URL('.',import.meta.url)),dir=await mkdtemp(join(tmpdir(),'dashboard-ctl-'));
 const p=existingProject('shop',{dbName:'shop-db'},[{id:'1',name:'עגבניה',categories:['ירקות'],stockStatus:'instock'}]);
 p.revisions[0].profile={...p.revisions[0].profile,pipeline:{...p.revisions[0].profile.pipeline,expansion:'off'}};
 try{
  const {manifest,files}=buildMiniServer(p);for(const [name,content] of Object.entries(files)){await mkdir(dirname(join(dir,name)),{recursive:true});await writeFile(join(dir,name),content);}
  await symlink(process.env.DASHBOARD_NODE_MODULES||join(root,'node_modules'),join(dir,'node_modules'));
  let user=null,down=false,clock=1e12;const db=fakeDb([{id:'1',name:'עגבניה',categories:['ירקות'],stockStatus:'instock'}]);
  const users={collection:()=>({find:()=>({toArray:async()=>user?[{username:'shop',dbName:'shop-db',semantix:user}]:[]})})};
  const {createSemantixTenants}=await import(pathToFileURL(join(dir,'tenants/semantix-registry.mjs')).href+'?ctl');
  const tenants=createSemantixTenants({getDb:async name=>{if(name==='users')return users;if(down)throw Error('mongo down');return db;},now:()=>clock,breaker:{failures:2,windowMs:60000,coolMs:300000}});
  const app=express();app.use(express.json());app.use((req,_res,next)=>{req.store={dbName:req.get('X-Store')||'shop-db',semantix:user};next();});
  app.post('/search',tenants.search,(_req,res)=>res.json({legacy:true}));app.get('/semantix/status',(req,res)=>tenants.statusRoute(req,res));
  const server=app.listen(0);await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
  const search=(session='a')=>fetch(base+'/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'עגבניה',modern:true,session_id:session})}).then(r=>r.json());
  const engine=r=>r.legacy?'legacy':r.metadata?.searchEngine;
  try{
   assert.equal(engine(await search()),'legacy','no field on the user: off');
   user={module:manifest.slug,enabled:true};assert.equal(engine(await search()),'semantix-'+manifest.slug,'the user field switches the module on');
   const why=async()=>(await fetch(base+'/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'עגבניה',modern:true,session_id:'a'})})).headers.get('X-Semantix-Decision');
   assert.equal(await why(),manifest.slug+' on','the decision is visible on the response');
   user={module:'someone-else',enabled:true};assert.equal(engine(await search()),'legacy','a field naming another module does not');
   assert.equal(await why(),manifest.slug+' off:user-other-module');user={module:manifest.slug,enabled:false};assert.equal(await why(),manifest.slug+' off:enabled-false');user={module:'someone-else',enabled:true};
   user={module:manifest.slug,enabled:false};assert.equal(engine(await search()),'legacy','enabled:false switches it off');
   user={module:manifest.slug,enabled:true,percent:50};const served=new Set();for(let i=0;i<40;i++)served.add(engine(await search('s'+i)));assert.deepEqual([...served].sort(),['legacy','semantix-'+manifest.slug],'50% rollout splits sessions');
   assert.equal(engine(await search('same')),engine(await search('same')),'a session stays on one side');
   user={module:manifest.slug,enabled:true,percent:100};process.env.SEMANTIX_OFF='1';assert.notEqual(engine(await search()),'legacy','environment does not override the user switch');delete process.env.SEMANTIX_OFF;
   down=true;assert.equal(engine(await search()),'legacy','a failure falls back to the existing search');await search();
   down=false;assert.equal(engine(await search()),'legacy','the circuit stays open after repeated failures');
   clock+=301000;assert.equal(engine(await search()),'semantix-'+manifest.slug,'and closes after the cool-down');
   assert.equal((await fetch(base+'/semantix/status')).status,404,'status is hidden without the admin token');
   process.env.SEMANTIX_ADMIN_TOKEN='t';const st=await (await fetch(base+'/semantix/status',{headers:{'X-Semantix-Admin':'t'}})).json();
   const t=st.tenants[0];assert.equal(t.slug,manifest.slug);assert.deepEqual(t.users.map(u=>[u.username,u.enabled,u.matchesDb]),[['shop',true,true]]);assert.equal(t.fellBack,2);assert.ok(t.served>0);assert.equal(t.lastError.message,'mongo down');
  }finally{server.close();delete process.env.SEMANTIX_ADMIN_TOKEN;}
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('the studio writes the switch onto every key-holding user of the store (the ones search requests come from)',async()=>{
 const {setControl,readControl,userFilter}=await import('./core/production-control.mjs');
 // Garmin's real shape: the store user and a staff user have API keys; a studio login without a key never reaches /search.
 const docs=[{name:'garmin',dbName:'garmin',apiKey:'k1',platform:'woocommerce'},{username:'garmin',dbName:'garmin'},{name:'Ophir',dbName:'garmin',apiKey:'k2'},{name:'other',dbName:'other',apiKey:'k3'}];
 const matches=f=>d=>Object.entries(f).every(([k,v])=>v&&typeof v==='object'?typeof d[k]==='string'&&d[k]!=='':d[k]===v);
 const users={countDocuments:async f=>docs.filter(matches(f)).length,updateMany:async(f,{$set})=>{const hit=docs.filter(matches(f));hit.forEach(d=>Object.assign(d,$set));return {modifiedCount:hit.length};},
  find:f=>({limit:()=>({toArray:async()=>docs.filter(matches(f))})})};
 const client={db:()=>({collection:()=>users})},garmin={existingClient:{username:'garmin',dbName:'garmin'}};
 const w=await setControl(garmin,'garmin-semantix',{enabled:true,percent:25},{client,revision:9});
 assert.equal(w.users,2);assert.deepEqual(docs.map(d=>d.semantix?.module||null),['garmin-semantix',null,'garmin-semantix',null]);
 const r=await readControl(garmin,{client});assert.equal(r.consistent,true);assert.equal(r.control.enabled,true);assert.equal(r.users.length,2);
 docs[2].semantix={...docs[2].semantix,enabled:false};const mixed=await readControl(garmin,{client});assert.equal(mixed.consistent,false);assert.equal(mixed.control.enabled,false);
 assert.deepEqual(userFilter({dashboardExport:{dbName:'garmin'}}),{dbName:'garmin',apiKey:{$type:'string',$ne:''}});assert.throws(()=>userFilter({}),/users\.users/);
 await assert.rejects(setControl({existingClient:{dbName:'missing'}},'x',{enabled:true},{client}),/לא נמצא משתמש/);
 await assert.rejects(setControl(garmin,'x',{enabled:'yes'},{client}),/enabled/);
});

// An in-memory stand-in for the semantix_module collection (the calls publishModule and the module make).
function fakeModuleCollection(){
 const docs=new Map(),match=(d,f)=>Object.entries(f).every(([k,v])=>v&&typeof v==='object'&&'$nin' in v?!v.$nin.includes(d[k]):d[k]===v);
 return {docs,reads:0,fail:false,
  async findOne(f){this.reads++;if(this.fail)throw Error('mongo down');return structuredClone(docs.get(f._id)??null);},
  async replaceOne(f,doc){docs.set(f._id,{_id:f._id,...doc});},
  async deleteMany(f){for(const [id,d] of docs)if(match(d,f))docs.delete(id);},
  find(f){return {toArray:async()=>{if(this.fail)throw Error('mongo down');return [...docs.values()].filter(d=>match(d,f)).map(d=>({...d,data:Buffer.from(d.data)}));}};}};
}

test('approved revisions are published to the store database and the running module switches to them without a deploy',async()=>{
 const {publishModule,readPublished,editionKey}=await import('./core/module-publish.mjs');
 const root=fileURLToPath(new URL('.',import.meta.url)),dir=await mkdtemp(join(tmpdir(),'dash-pub-'));
 const rows=[{id:'1',name:'עגבניה',categories:['ירקות'],stockStatus:'instock',price:5,ItemID:1,Makat:'M-1',CustomFields:[{Name:'נפח',ItemValue:'1 ק"ג'}],embedding:[0.1,0.2],mendelsonUrl:'https://other.example/p'},{id:'2',name:'רוטב עגבניות',categories:['רטבים'],stockStatus:'instock',price:9}];
 const p=existingProject('shop',{dbName:'shop-db'},rows);
 p.revisions[0].profile={...p.revisions[0].profile,pipeline:{...p.revisions[0].profile.pipeline,expansion:'off'}};
 const col=fakeModuleCollection(),client={db:name=>(assert.equal(name,'shop-db'),{collection:c=>(assert.equal(c,'semantix_module'),col)})};
 try{
  // As the export writes it: code only, no profile.json / snapshot.json.
  const {manifest,files}=buildMiniServer(p);for(const [name,content] of Object.entries(files)){if(/\/(snapshot|profile)\.json$/.test(name))continue;await mkdir(dirname(join(dir,name)),{recursive:true});await writeFile(join(dir,name),content);}
  await symlink(process.env.DASHBOARD_NODE_MODULES||join(root,'node_modules'),join(dir,'node_modules'));
  const {createTenantSearch}=await import(pathToFileURL(join(dir,'tenants',manifest.slug,'search.mjs')).href);
  let clock=0;const search=createTenantSearch({loadRows:async()=>rows,now:()=>clock}),products={};
  const ask=q=>search({collection:products,moduleStore:col,request:{query:q,limit:10}});
  await assert.rejects(ask('עגבניה'),/No published module data/,'nothing published: the registry falls back to the existing search');
  const first=await publishModule(p,manifest.slug,{client});assert.equal(first.revision,1);assert.equal(first.unchanged,false);
  assert.equal((await publishModule(p,manifest.slug,{client})).unchanged,true,'publishing the same edition writes nothing');
  clock+=30000;const r1=await ask('עגבניה');assert.equal(r1.metadata.revision,1);assert.equal(r1.matches[0].id.endsWith(':1')||r1.matches[0].id==='1',true);
  const hit=r1.matches[0];assert.equal(hit.ItemID,1);assert.equal(hit.Makat,'M-1');assert.equal(hit.price,5,'the engine card wins on a clash');
  assert.equal(['CustomFields','embedding','mendelsonUrl'].some(k=>k in hit),false,'only the listed source fields are sent');
  // An approved change in the studio: sauces first.
  const before=editionKey(p);p.revisions.push({number:2,profile:{...p.revisions[0].profile,rankingRules:[validateRankingRule({label:'sauces',field:'categories',values:['רטבים']})]}});assert.notEqual(editionKey(p),before);
  const second=await publishModule(p,manifest.slug,{client});assert.equal(second.previous,first.digest);
  assert.equal((await ask('עגבניה')).metadata.revision,1,'the head is checked at most every 30 s');
  clock+=30000;const r2=await ask('עגבניה');assert.equal(r2.metadata.revision,2,'picked up without a deploy');assert.deepEqual(r2.metadata.ranking,['sauces']);assert.match(String(r2.matches[0].id),/2$/);
  const reads=col.reads;await ask('עגבניה');await ask('רוטב');assert.equal(col.reads,reads,'searches between checks do not touch the module collection');
  assert.deepEqual([...col.docs.values()].filter(d=>d.kind==='part').map(d=>d.digest).sort(),[first.digest,second.digest].sort(),'the previous edition is kept for readers mid-switch');
  p.revisions.push({number:3,profile:p.revisions[0].profile});await publishModule(p,manifest.slug,{client});
  assert.equal([...col.docs.values()].some(d=>d.digest===first.digest),false,'older editions are cleaned up');
  col.fail=true;clock+=30000;assert.equal((await ask('עגבניה')).metadata.revision,2,'a failed check keeps serving the edition in memory');
  col.fail=false;assert.equal((await readPublished(p,manifest.slug,{client})).revision,3);
 }finally{await rm(dir,{recursive:true,force:true});}
});
