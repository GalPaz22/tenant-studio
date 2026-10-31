import {test} from 'node:test';import assert from 'node:assert/strict';import {app} from './server.mjs';import http from 'node:http';
test('local studio denies foreign host, cross-origin and missing operator token',async()=>{
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url='http://127.0.0.1:'+server.address().port;
 try {
  assert.equal((await fetch(url+'/api/session')).status,403);
  const host='127.0.0.1:'+(process.env.STUDIO_PORT||4320);
  assert.equal((await fetch(url+'/api/session',{headers:{Host:host,Origin:'https://foreign.example'}})).status,403);
  assert.equal((await fetch(url+'/api/projects',{headers:{Host:host}})).status,403);
  assert.equal((await fetch(url+'/api/projects',{headers:{Host:host}})).status,403);
 }finally{await new Promise(r=>server.close(r))}
});
test('the mirror root keeps the query: a store search form submitted to /demo/<id> reaches the results page',async()=>{
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const id='a6e8f510-d27c-4776-95e6-3f7c5d3db2dc';
 // fetch() drops a Host header; http.get sends the studio's own address as a browser on it would.
 const get=path=>new Promise((resolve,reject)=>http.get({host:'127.0.0.1',port:server.address().port,path,headers:{Host:'localhost:'+(process.env.STUDIO_PORT||4320)}},r=>{r.resume();resolve(r);}).on('error',reject));
 try {
  const r=await get('/demo/'+id+'?s=%D7%9B%D7%99%D7%A1%D7%95%D7%99&post_type=product');
  assert.equal(r.statusCode,302);assert.equal(r.headers.location,'/demo/'+id+'/?s=%D7%9B%D7%99%D7%A1%D7%95%D7%99&post_type=product');
  assert.equal((await get('/demo/'+id)).headers.location,'/demo/'+id+'/');
 }finally{await new Promise(r=>server.close(r))}
});
