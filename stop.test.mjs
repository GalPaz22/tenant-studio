import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {createStore} from './store.mjs';
import {buildSearchIndex} from './core/search-index.mjs';
import {hash} from './core/catalog.mjs';

test('stopping the agent aborts its in-flight model call, saves nothing and frees the client at once',async()=>{
 const root=await mkdtemp(tmpdir()+'/stop-');process.env.STUDIO_DATA_DIR=root;
 const probe=createServer().listen(0,'127.0.0.1');await new Promise(r=>probe.once('listening',r));const port=probe.address().port;await new Promise(r=>probe.close(r));process.env.STUDIO_PORT=String(port);
 const {app}=await import('./server.mjs');const server=app.listen(port,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{
  const id=randomUUID(),profile={name:'Store',domain:'x',productTypes:{},colors:{},finishes:{},queryAliases:{},tagDefinitions:{},badgeCandidates:{categories:[],tags:[]},badgeRules:[],pipeline:{maxCandidates:20,lightweightRouter:false}};
  const card={id:'1',tenantId:id,title:'ספל',url:'https://example.com/1',stockStatus:'instock',hidden:false,price:10,categories:[],tags:[],colors:[],finishes:[],badges:[],specifications:{}};
  await createStore(root).save({id,url:'https://example.com/',name:'Store',platform:'custom',status:'draft',events:[],messages:[],revisions:[{number:1,profile}],productCards:[card],catalog:{products:[{id:'1',name:'ספל'}]},searchIndex:buildSearchIndex([card],'v1'),productCardsProfileHash:hash(profile),updatedAt:new Date().toISOString()});
  let calls=0,started;const first=new Promise(r=>{started=r;});
  app.locals.studioAgent=async()=>{calls++;started();return new Promise(r=>setTimeout(()=>r({message:'late answer',tools:[]}),5000));};
  const base='http://127.0.0.1:'+port,headers={Host:'127.0.0.1:'+port,'Content-Type':'application/json'};
  headers['X-Studio-Token']=(await (await fetch(base+'/api/session',{headers})).json()).token;
  const ctrl=new AbortController();
  const pending=fetch(base+'/api/projects/'+id+'/studio',{method:'POST',headers,signal:ctrl.signal,body:JSON.stringify({message:'תקן'})}).then(r=>r.text()).catch(e=>e.name);
  await first;ctrl.abort();assert.equal(await pending,'AbortError');
  // The lock is released without waiting for the abandoned 5-second model call.
  let log;for(let i=0;i<40;i++){log=await (await fetch(base+'/api/projects/'+id+'/agent-logs',{headers})).json();if(log.runs[0]?.status!=='running')break;await new Promise(r=>setTimeout(r,25));}
  assert.equal(log.runs[0].status,'stopped');assert.equal(calls,1,'no model call after the stop');
  const p=await (await fetch(base+'/api/projects/'+id,{headers})).json();assert.equal(p.revisions.length,1);assert.equal(p.messages.length,0);
  app.locals.studioAgent=async()=>({message:'בסדר'});
  const again=await (await fetch(base+'/api/projects/'+id+'/studio',{method:'POST',headers,body:JSON.stringify({message:'שלום'})})).text();
  assert.doesNotMatch(again,/כבר מתבצעת פעולה/);
 }finally{server.close();await rm(root,{recursive:true,force:true});}
});
