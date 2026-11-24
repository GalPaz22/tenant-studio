import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {existingProject} from './existing-client.mjs';
import {installCustomerChat} from './core/customer-chat.mjs';

for(const finalAnswer of [false,true])test(`customer call budget ends with an honest answer and discards drafts (${finalAnswer?'judge':'agent'} reaches limit)`,async()=>{
 const prior=process.env.STUDIO_CUSTOMER_API_TOKEN;process.env.STUDIO_CUSTOMER_API_TOKEN='budget-fixture';
 const p=existingProject('Mano Vino',{dbName:'manoVino'},[{id:'1',name:'יין לבן',stockStatus:'instock'}]);
 const original=JSON.stringify(p),events=[],prompts=[];let calls=0;
 const store={async read(){return structuredClone(p);},async metas(){return [{id:p.id,dbName:'manoVino'}];}};
 const app=express();app.use(express.json());installCustomerChat(app,{store,drafts:{async save(){assert.fail('unfinished work must not create a draft');}},persist:async()=>assert.fail('must not save'),publish:async()=>assert.fail('must not publish'),locked:async(_id,fn)=>fn(),resolveTenant:async()=>({dbName:'manoVino'}),readStoreProfile:async()=>null,services:()=>({workspaceContext:async()=>null,createSearch:()=>async()=>({total:1,matches:[p.productCards[0]],metadata:{phase:'lexical',llmUsed:false}})}),model:()=>async prompt=>{
  prompts.push(prompt);calls++;
  if(calls===1)return {tools:[{name:'add_spelling',from:'וייין',to:'יין'},{name:'hide_products',term:'סבון',hidden:true}]};
  if(finalAnswer&&calls===24)return {message:'הוכנה טיוטה',verify:['יין']};
  return {tools:[{name:'find_products',contains:'יין '+calls}]};
 },judge:()=>async()=>assert.fail('budget must be checked before calling the judge')});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/customer-chat/turn`,{method:'POST',headers:{'content-type':'application/json','X-Studio-Customer-Token':'budget-fixture'},body:JSON.stringify({dbName:'manoVino',message:'שפר את החיפוש'})});
  events.push(...(await response.text()).trim().split('\n').map(JSON.parse));
  const done=events.at(-1);assert.equal(done.type,'done');assert.match(done.summary,/מגבלת.*בדיקה/);assert.match(done.summary,/לא.*שינוי/);
  assert.equal(calls,24);assert.equal(done.modelCalls,24);assert.equal(done.draft,null);assert.deepEqual(done.actions,[]);
  assert.equal(events.at(-2).type,'answer_reset');assert.ok(!events.some(e=>e.type==='note'&&/מנסה שוב/.test(e.text)));
  assert.match(prompts.at(-1),/CALL BUDGET/);assert.equal(JSON.stringify(p),original);
 }finally{await new Promise(r=>server.close(r));if(prior===undefined)delete process.env.STUDIO_CUSTOMER_API_TOKEN;else process.env.STUDIO_CUSTOMER_API_TOKEN=prior;}
});
