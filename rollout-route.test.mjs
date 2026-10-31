import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {createStore} from './store.mjs';

// The rollout route passes the pinned visitors through to the production write (they once got lost in the route).
test('the rollout route writes the pinned visitors it is sent and logs them',async()=>{
 const root=await mkdtemp(tmpdir()+'/rollout-route-');process.env.STUDIO_DATA_DIR=root;
 const probe=createServer().listen(0,'127.0.0.1');await new Promise(r=>probe.once('listening',r));const port=probe.address().port;await new Promise(r=>probe.close(r));process.env.STUDIO_PORT=String(port);
 const {app}=await import('./server.mjs');const server=app.listen(port,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{
  const calls=[];app.locals.publishRollout=async(_p,percent,{pins})=>{calls.push([percent,pins]);return {users:1,backup:'/x/b.json',percent,pins:pins||{},at:new Date().toISOString()};};
  const store=createStore(root),id=randomUUID();
  await store.save({id,url:'https://shop.example/',name:'shop',platform:'magento',status:'draft',events:[],messages:[],revisions:[],updatedAt:new Date().toISOString()});
  const base='http://127.0.0.1:'+port,headers={Host:'127.0.0.1:'+port,'Content-Type':'application/json'};
  headers['X-Studio-Token']=(await (await fetch(base+'/api/session',{headers})).json()).token;
  const post=async body=>{const r=await fetch(base+'/api/projects/'+id+'/takeover/rollout',{method:'POST',headers,body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
  const r=await post({percent:0,pins:{'vis-test-abc123':'semantix'}});
  assert.equal(r.status,200,JSON.stringify(r.data));assert.deepEqual(r.data.pins,{'vis-test-abc123':'semantix'});
  assert.deepEqual(calls[0],[0,{'vis-test-abc123':'semantix'}]);
  await post({percent:30});assert.deepEqual(calls[1],[30,undefined],'no pins sent → the route asks to keep production\'s');
  const p=await store.read(id);assert.match(p.events.find(e=>e.type==='takeover-rollout').text,/1 גולשים קבועים/);
 }finally{delete app.locals.publishRollout;server.close();}
});
