import {test} from 'node:test';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('plugin download is session protected and returns a ZIP, invalid options return a useful error',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-plugin-'));process.env.STUDIO_DATA_DIR=dir;
 const server=createServer().listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 process.env.STUDIO_PORT=String(server.address().port);process.env.PORT=process.env.STUDIO_PORT;
 const {app}=await import('./server.mjs');server.on('request',app);
 const url='http://127.0.0.1:'+server.address().port,headers={Host:'127.0.0.1:'+(process.env.PORT||process.env.STUDIO_PORT||4320),'Content-Type':'application/json'};
 const id='cc08140d-e09c-487c-8128-b645820c221b';
 try{
  await writeFile(join(dir,id+'.json'),JSON.stringify({id,url:'https://store.example',platform:'custom',revisions:[{number:1}]}));
  const path=url+'/api/projects/'+id+'/storefront-plugin',body=JSON.stringify({endpoint:'https://api.example/search',cdnUrl:'https://cdn.example'});
  assert.equal((await fetch(path,{method:'POST',headers,body})).status,403);
  const session=await (await fetch(url+'/api/session',{headers})).json();headers['X-Studio-Token']=session.token;
  const response=await fetch(path,{method:'POST',headers,body});assert.equal(response.status,200,response.ok?'':await response.clone().text());assert.match(response.headers.get('content-type'),/zip/);
  const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.readUInt32LE(0),0x04034b50);
  const bundled=await fetch(path,{method:'POST',headers,body:JSON.stringify({endpoint:'https://api.example/search',platform:'woocommerce'})});
  assert.equal(bundled.status,200);assert.match(bundled.headers.get('content-disposition'),/woocommerce/);
  const preview=await fetch(url+'/api/projects/'+id+'/storefront-code',{method:'POST',headers,body:JSON.stringify({endpoint:'https://api.example/search'})});
  assert.equal(preview.status,200);const embed=await preview.json();assert.equal(embed.manifest.delivery,'bundled');assert.match(embed.code,/<script>/);
  const invalid=await fetch(path,{method:'POST',headers,body:'{}'});assert.equal(invalid.status,400);assert.match((await invalid.json()).error,/HTTPS/);
 }finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});
