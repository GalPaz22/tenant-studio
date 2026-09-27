import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {createStore} from './store.mjs';
import {createRunStore} from './core/run-store.mjs';

test('deleting a client needs its name, refuses while a build runs, and moves everything to the trash',async()=>{
 const root=await mkdtemp(tmpdir()+'/delete-');process.env.STUDIO_DATA_DIR=root;
 const probe=createServer().listen(0,'127.0.0.1');await new Promise(r=>probe.once('listening',r));const port=probe.address().port;await new Promise(r=>probe.close(r));process.env.STUDIO_PORT=String(port);
 const {app}=await import('./server.mjs');const server=app.listen(port,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{
  const stopped=[];app.locals.crawlStore={meta:async()=>({desired:'running'}),control:async(pid,v)=>{stopped.push([pid,v.desired]);}};
  const store=createStore(root),runs=createRunStore(root+'/runs'),id=randomUUID(),other=randomUUID(),runId=randomUUID();
  for(const [pid,name] of [[id,'כרמלה'],[other,'אחר']])await store.save({id:pid,url:'https://x.co/',name,platform:'custom',status:'draft',events:[],messages:[],revisions:[],updatedAt:new Date().toISOString()});
  await runs.save({id:runId,projectId:id,status:'running',stages:[]});
  const base='http://127.0.0.1:'+port,headers={Host:'127.0.0.1:'+port,'Content-Type':'application/json'};
  headers['X-Studio-Token']=(await (await fetch(base+'/api/session',{headers})).json()).token;
  const del=async name=>{const r=await fetch(base+'/api/projects/'+id+'/delete',{method:'POST',headers,body:JSON.stringify({name})});return {status:r.status,data:await r.json()};};
  assert.match((await del('carmella')).data.error,/אינו תואם/);
  assert.match((await del('כרמלה')).data.error,/בנייה רצה/);
  await runs.save({id:runId,projectId:id,status:'paused',stages:[]});
  const ok=await del('כרמלה');assert.equal(ok.status,200,JSON.stringify(ok.data));
  const list=await (await fetch(base+'/api/projects',{headers})).json();assert.deepEqual(list.map(p=>p.id),[other]);
  const [trash]=await readdir(root+'/trash');await access(`${root}/trash/${trash}/${id}.json`);await access(`${root}/trash/${trash}/runs/${runId}/run.json`);
  assert.deepEqual((await runs.list()).map(r=>r.id),[]);
  assert.equal((await fetch(base+'/api/projects/'+id,{headers})).status,400);
  // Production switch: needs an export before switching on; writes the control document for the tenant's slug.
  const writes=[];app.locals.readControl=async proj=>({user:{username:'shop'},control:writes.at(-1)?.doc||null});
  app.locals.setControl=async(proj,slug,input,opts)=>{const doc={module:slug,...input,revision:opts.revision,updatedAt:'now',updatedBy:'tenant-studio'};writes.push({slug,doc});return {filter:{username:'shop'},control:doc};};
  const prod=(body)=>fetch(base+'/api/projects/'+other+'/production',{method:body?'POST':'GET',headers,body:body&&JSON.stringify(body)}).then(async r=>({status:r.status,data:await r.json()}));
  assert.match((await prod({enabled:true})).data.error,/לייצא/);
  const publishes=[];app.locals.publishDelayMs=0;app.locals.publishModule=async(proj,slug)=>{publishes.push([slug,proj.revisions.length]);return {revision:proj.revisions.length};};
  app.locals.readPublished=async()=>publishes.length?{revision:publishes.at(-1)[1],publishedAt:'now'}:null;
  const saved=await store.read(other);saved.dashboardExport={slug:'other-shop',revision:3};saved.productCards=[{id:'1',title:'x'}];saved.revisions=[{number:1,profile:{}}];await store.save(saved);
  const on=await prod({enabled:true,percent:20});assert.equal(on.status,200,JSON.stringify(on.data));assert.deepEqual(writes[0],{slug:'other-shop',doc:{module:'other-shop',enabled:true,percent:20,revision:3,updatedAt:'now',updatedBy:'tenant-studio'}});
  await new Promise(r=>setTimeout(r,50));assert.deepEqual(publishes,[['other-shop',1]],'an exported module publishes its approved revision on save');
  await prod({enabled:true,percent:20});await new Promise(r=>setTimeout(r,50));assert.equal(publishes.length,1,'an unchanged edition is not published again');
  const now=(await prod()).data;assert.equal(now.published.revision,1);assert.equal(now.control.percent,20);assert.equal(now.user.username,'shop');assert.equal(now.otherModule,false);
  assert.deepEqual(stopped,[[id,'stopped']],'a running site crawl is stopped');
 }finally{server.closeAllConnections();server.close();await rm(root,{recursive:true,force:true});}
});
