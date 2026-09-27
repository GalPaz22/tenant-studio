import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('authenticated import, inspect, edit, stale rejection and ZIP release persist per project',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-connected-plugin-'));process.env.STUDIO_DATA_DIR=dir;
 const server=createServer().listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 process.env.STUDIO_PORT=String(server.address().port);process.env.PORT=process.env.STUDIO_PORT;
 const {app}=await import('./server.mjs');server.on('request',app);
 const origin='http://127.0.0.1:'+server.address().port,headers={'Content-Type':'application/json'},id='cc08140d-e09c-487c-8128-b645820c221b',path='/api/projects/'+id+'/plugin';
 const post=(suffix,body)=>fetch(origin+path+suffix,{method:'POST',headers,body:JSON.stringify(body)});
 try{
  await writeFile(join(dir,id+'.json'),JSON.stringify({id,url:'https://shop.example',platform:'custom',events:[],revisions:[{number:1}]}));
  const payload={name:'Original',platform:'custom',files:[{path:'plugin/widget.js',encoding:'utf8',content:'// large source\n'+' '.repeat(40000)+'\nconst original=true;'}]};
  assert.equal((await post('/import',payload)).status,403);
  headers['X-Studio-Token']=(await (await fetch(origin+'/api/session')).json()).token;
  const imported=await post('/import',payload);assert.equal(imported.status,200,await imported.clone().text());
  const file=await (await fetch(origin+path+'/file?path=plugin/widget.js',{headers})).json();
  assert.equal(file.content,payload.files[0].content);
  const edit={expectedRevision:1,edits:[{path:file.path,expectedHash:file.hash,content:'const updated=true;'}]};
  assert.equal((await post('/edit',edit)).status,200);assert.equal((await post('/edit',edit)).status,400);
  const release=await post('/release',{expectedRevision:2});assert.equal(release.status,200);assert.equal(Buffer.from(await release.arrayBuffer()).readUInt32LE(0),0x04034b50);
  const state=await (await fetch(origin+path,{headers})).json();assert.equal(state.revision,2);assert.equal(state.releases[0].status,'packaged-not-deployed');
  assert.equal((await post('/rollback',{expectedRevision:2,revision:1})).status,200);
 }finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});
