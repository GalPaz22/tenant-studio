import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {randomUUID} from 'node:crypto';
import {customerProject,customerTools,installCustomerChat} from './core/customer-chat.mjs';
const memory=()=>{const rows=new Map();return {rows,async read(id){if(!rows.has(id))throw Object.assign(Error('not found'),{code:'ENOENT'});return structuredClone(rows.get(id));},async save(p){rows.set(p.id,structuredClone(p));return p;},async metas(){return [...rows.values()].map(p=>({id:p.id,dbName:p.existingClient?.dbName}));}};};
const project=()=>({id:randomUUID(),name:'Mano Vino',existingClient:{dbName:'manoVino'},productCards:[{id:'wine:1',stockStatus:'instock',hidden:false}],revisions:[{number:1,profile:{}}],messages:[{role:'user',text:'PRIVATE ADMIN CONVERSATION'}],events:[],dashboardExport:{slug:'manovino'}});
test('customer project mapping is exact and ambiguity/foreign mapping cannot choose another store',async()=>{
 const s=memory(),p=project();await s.save(p);assert.equal((await customerProject(s,'manoVino',{})).id,p.id);
 await assert.rejects(()=>customerProject(s,'foreign',{STUDIO_CUSTOMER_PROJECTS:JSON.stringify({foreign:p.id})}),{status:403});
 await s.save({...p,id:randomUUID()});await assert.rejects(()=>customerProject(s,'manoVino',{}),{status:409});
 assert.equal((await customerProject(s,'manoVino',{STUDIO_CUSTOMER_PROJECTS:JSON.stringify({manoVino:p.id})})).id,p.id);
});
test('merchandising tools prepare bounded requests and cannot access plugins, deployment or another catalog',()=>{
 const p=project(),actions=[],set=customerTools(p,actions,{days:30});
 assert.equal(set.plugin_patch,undefined);assert.equal(set.export_module,undefined);assert.equal(set.merge_crawl,undefined);
 set.promote_products.run(null,{term:'ריף',level:3});set.hide_products.run(null,{term:'ריף',hidden:true});set.pin_products.run(null,{query:'יין',productIds:['wine:1']});
 assert.equal(actions.length,3);assert.equal(p.productCards[0].hidden,false);
 assert.throws(()=>set.hide_products.run(null,{term:'ריף',hidden:'false'}));
 assert.throws(()=>set.pin_products.run(null,{query:'יין',productIds:['foreign']}));
});
test('authenticated studio bridge isolates history, defers writes, rejects stale drafts and approves once',async()=>{
 const prior=process.env.STUDIO_CUSTOMER_API_TOKEN;process.env.STUDIO_CUSTOMER_API_TOKEN='test-only-token';
 const s=memory(),drafts=memory(),p=project();await s.save(p);let saves=0,publishes=0;
 const app=express();app.use(express.json());
 installCustomerChat(app,{store:s,drafts,persist:async next=>{saves++;await s.save(next);},locked:async(_id,fn)=>fn(),publish:async()=>{publishes++;},model:()=>async()=>({}),judge:()=>async()=>({}),resolveTenant:async key=>{if(!['a','b'].includes(key))throw Object.assign(Error('Unauthorized'),{status:401});return {dbName:key==='a'?'manoVino':'foreign'};},agent:async (working,message,opts)=>{
  assert.ok(!JSON.stringify(working.messages).includes('PRIVATE ADMIN'));assert.match(opts.instructions,/NOTHING is live/);
  const next=structuredClone(working);if(message==='change')next.revisions.push({number:2,profile:{changed:true}});
  next.messages.push({role:'assistant',text:'תשובה',changes:message==='change'?['תיקון דירוג']:[]});return next;
 }});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}/api/customer-chat`;
 const send=(path,body,authenticated=true)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(authenticated?{'X-Studio-Customer-Token':'test-only-token'}:{})},body:JSON.stringify(body)});
 try{
  assert.equal((await send('/turn',{apiKey:'a',message:'question'},false)).status,401);
  const turn=async message=>(await (await send('/turn',{apiKey:'a',message,history:[]})).text()).trim().split('\n').map(JSON.parse).at(-1);
  assert.equal((await turn('question')).draft,null);assert.equal(saves,0);assert.equal(publishes,0);
  const first=await turn('change');assert.ok(first.draft.id);assert.equal(saves,0);
  assert.equal((await send('/approve',{apiKey:'b',draftId:first.draft.id})).status,404);
  const updated=await s.read(p.id);updated.updatedAt='new';await s.save(updated);
  assert.equal((await send('/approve',{apiKey:'a',draftId:first.draft.id})).status,409);assert.equal(saves,0);
  const second=await turn('change');const approved=await send('/approve',{apiKey:'a',draftId:second.draft.id});assert.deepEqual(await approved.json(),{saved:true,published:true,version:2});assert.equal(saves,1);
  assert.equal((await send('/approve',{apiKey:'a',draftId:second.draft.id})).status,200);assert.equal(saves,1);
 }finally{await new Promise(r=>server.close(r));if(prior===undefined)delete process.env.STUDIO_CUSTOMER_API_TOKEN;else process.env.STUDIO_CUSTOMER_API_TOKEN=prior;}
});
