import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {createStore} from './store.mjs';

test('an existing client opened with a placeholder address gets its real site URL',async()=>{
 const root=await mkdtemp(tmpdir()+'/site-url-');process.env.STUDIO_DATA_DIR=root;
 const probe=createServer().listen(0,'127.0.0.1');await new Promise(r=>probe.once('listening',r));const port=probe.address().port;await new Promise(r=>probe.close(r));process.env.STUDIO_PORT=String(port);
 const {app}=await import('./server.mjs');const server=app.listen(port,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{
  const store=createStore(root),id=randomUUID();
  await store.save({id,url:'https://existing-client.invalid/',name:'beautix',platform:'custom',status:'draft',events:[],messages:[],revisions:[],existingClient:{username:'beautix',dbName:'beautix',categories:[],tags:[]},updatedAt:new Date().toISOString()});
  const base='http://127.0.0.1:'+port,headers={Host:'127.0.0.1:'+port,'Content-Type':'application/json'};
  headers['X-Studio-Token']=(await (await fetch(base+'/api/session',{headers})).json()).token;
  const set=async url=>{const r=await fetch(base+'/api/projects/'+id+'/url',{method:'POST',headers,body:JSON.stringify({url})});return {status:r.status,data:await r.json()};};
  assert.equal((await set('ftp://x')).status>=400,true);
  assert.equal((await set('localhost')).status>=400,true);
  const ok=await set('www.beautix.co.il/shop?x=1');assert.equal(ok.status,200,JSON.stringify(ok.data));assert.equal(ok.data.url,'https://www.beautix.co.il/');
  assert.equal((await store.read(id)).url,'https://www.beautix.co.il/');
  assert.equal((await (await fetch(base+'/api/projects',{headers})).json())[0].url,'https://www.beautix.co.il/');
 }finally{await new Promise(r=>server.close(r))}
});
