import {test} from 'node:test';import assert from 'node:assert/strict';
import {createApi} from './public/api.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status});
test('refreshes session after restart and executes rejected write once',async()=>{
 let generation=1,refreshes=0,writes=0;
 const api=createApi(async(path,options)=>{
  if(path==='/api/session'){refreshes++;return json({token:String(generation)})}
  if(options.headers['X-Studio-Token']!==String(generation))return json({code:'SESSION_EXPIRED'},403);
  if(options.method==='POST')writes++;
  return json({ok:true});
 });
 await api.request('/projects');generation=2;
 assert.deepEqual(await api.request('/projects',{}),{ok:true});assert.equal(refreshes,2);assert.equal(writes,1);
});
test('plain Forbidden produces readable error instead of JSON exception',async()=>{
 const api=createApi(async()=>new Response('Forbidden',{status:403}));
 await assert.rejects(api.request('/projects'),e=>!e.message.includes('Unexpected token')&&e.message.includes('403'));
});
test('does not retry authorization denial or failed mutation',async()=>{
 let writes=0;const api=createApi(async(path)=>{
  if(path==='/api/session')return json({token:'ok'});
  writes++;return json({code:'ORIGIN_DENIED',error:'denied'},403);
 });await assert.rejects(api.request('/projects',{}),/denied/);assert.equal(writes,1);
});
