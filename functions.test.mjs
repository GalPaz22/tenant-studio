import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHookRunner,validateHook} from './core/tenant-hooks.mjs';
import {createDraftRuntime} from './runtime.mjs';
import {existingProject} from './existing-client.mjs';
import {hash} from './core/hash.mjs';
import {tools} from './core/studio-agent.mjs';
import {buildMiniServer} from './mini-server.mjs';
import {createIndexRetriever} from './core/search-index.mjs';

// Carmella's real case: Mancini pastas are titled by shape and brand, never with the word "פסטה".
const rows=[{id:'m1',name:'ספגטי 500 גרם MANCINI',categories:['בסטה איטליה'],stockStatus:'instock'},{id:'m2',name:'ריגטוני 500 גרם MANCINI',categories:['בסטה איטליה'],stockStatus:'instock'},
 {id:'p1',name:'פסטה פנה 500 גרם',categories:['פסטה'],stockStatus:'instock'},{id:'s1',name:'רוטב לפסטה',categories:['רטבים'],stockStatus:'instock'}];
const shapes=`function transformProduct(p, ctx){
 const title=ctx.words(p.title);
 if(!ctx.data.shapes.some(s=>title.includes(ctx.normalize(s))))return p;
 return {...p,tags:[...p.tags,'פסטה'],price:0};
}`;
const carmella=(hooks,hookData)=>{const p=existingProject('carmella',{dbName:'carmella'},rows);p.revisions[0].profile={...p.revisions[0].profile,hooks,hookData,pipeline:{...p.revisions[0].profile.pipeline,expansion:'off'}};return p;};
const rt=p=>createDraftRuntime({...p,productCardsProfileHash:hash(p.revisions[0].profile)},p.revisions[0]);

test('a transformProduct function adds knowledge the catalog lacks: pasta shapes become searchable as pasta',async()=>{
 const plain=await rt(carmella()).search({query:'פסטה',limit:20});assert.ok(!plain.matches.some(m=>/MANCINI/.test(m.title)),'without the function Mancini is missed');
 const r=await rt(carmella({transformProduct:{code:shapes}},{shapes:['ספגטי','ריגטוני','פוזילי']})).search({query:'פסטה',limit:20});
 const ids=r.matches.map(m=>m.id.split(':').pop());assert.ok(ids.includes('m1')&&ids.includes('m2'),JSON.stringify(ids));
 assert.ok(r.matches.every(m=>m.price!==0),'protected fields (price) stay as in the source');
});
test('rewriteQuery and rerank shape a search; results report the function',async()=>{
 const hooks={rewriteQuery:{code:`function rewriteQuery(q, ctx){ return ctx.data.map[ctx.normalize(q)] || q; }`},
  rerank:{code:`function rerank(matches, query, ctx){ return matches.filter(m=>!m.categories.includes('רטבים')).map(m=>m.id); }`}};
 const r=await rt(carmella(hooks,{map:{'מנציני':'mancini'}})).search({query:'מנציני',limit:20});
 assert.deepEqual(r.matches.map(m=>m.id.split(':').pop()).sort(),['m1','m2']);assert.deepEqual(r.metadata.functions,['rerank']);
 const f=await rt(carmella({rerank:hooks.rerank})).search({query:'פסטה',limit:20});assert.ok(!f.matches.some(m=>m.id.endsWith('s1')),'rerank can drop');
});
test('isolation: escape routes are rejected, and a runaway or crashing function never breaks the search',async()=>{
 for(const [code,why] of [
  ['function rerank(m){ return m.constructor.constructor("return process")(); }',/constructor/],
  ['function rerank(m){ return this; }',/this/],
  ['async function rerank(m){ return []; }',/async/],
  ['function rerank(m){ return import("node:fs"); }',/import/],
  ['function rerank(m){ return eval("1"); }',/eval/],
  ['function other(){ return 1; }',/function rerank/]])assert.throws(()=>validateHook('rerank',code),why);
 // Built from strings, the constructor chain still reaches only the sandbox's own Function, which cannot compile strings.
 const sneaky=createHookRunner({rerank:{code:'function rerank(m){ const k="constr"+"uctor"; return [][k][k]("return 1")(); }'}},{},{tenant:'t1'});
 await assert.rejects(sneaky.rerank([{id:'a'}],'q'),/Code generation from strings disallowed|disallowed/);sneaky.close();
 const loop=createHookRunner({rerank:{code:'function rerank(m){ while(true){} }'}},{},{tenant:'t2',timeoutMs:50});
 await assert.rejects(loop.rerank([{id:'a'}],'q'),/timed out|חרגה|Script execution/);loop.close();
 const bomb=createHookRunner({rerank:{code:'function rerank(m){ const a=[]; for(let i=0;i<1e9;i++)a.push("x".repeat(1000)+i); return []; }'}},{},{tenant:'t3',timeoutMs:20000,memoryMb:32});
 await assert.rejects(bomb.rerank([{id:'a'}],'q'));bomb.close();
 const p=carmella({rerank:{code:'function rerank(m){ while(true){} }'}});
 const r=await rt(p).search({query:'פסטה',limit:20});assert.ok(r.matches.length>0,'the search still answers');assert.match(r.metadata.functionErrors[0],/rerank/);
});
test('the agent writes a function after it runs on real samples; a failing function is rejected and nothing is saved',async()=>{
 const p=carmella();const ctx={p,profile:structuredClone(p.revisions[0].profile),services:{createSearch:(q,profile)=>query=>{const r=createIndexRetriever(q.productCards,{...profile,tenantId:q.id},q.searchIndex)(query);return {...r,metadata:{}};}}};
 ctx.search=async q=>ctx.services.createSearch(ctx.p,ctx.profile)(q);
 const saved=await tools.write_function.run(ctx,{function:'transformProduct',code:shapes,data:{shapes:['ספגטי','ריגטוני']},note:'צורות פסטה מקבלות תגית פסטה'});
 assert.equal(saved.trial.changed,2);assert.equal(ctx.profile.hooks.transformProduct.note,'צורות פסטה מקבלות תגית פסטה');assert.deepEqual(ctx.profile.hookData.shapes,['ספגטי','ריגטוני']);
 await assert.rejects(tools.write_function.run(ctx,{function:'rewriteQuery',code:'function rewriteQuery(q){ return q.nope.x; }',note:'שבור'}),/nope|undefined/);
 assert.equal(ctx.profile.hooks.rewriteQuery,undefined,'a failing function is not saved');
 assert.equal((await tools.remove_function.run(ctx,{function:'transformProduct'})).removed,'transformProduct');
});
test('the exported mini server carries the functions and their isolated worker',()=>{
 const {files}=buildMiniServer(carmella({transformProduct:{code:shapes}},{shapes:['ספגטי']}));
 assert.ok(files['tenants/carmella/engine/core/hook-worker.mjs']&&files['tenants/carmella/engine/core/tenant-hooks.mjs']);
 assert.equal(JSON.parse(files['tenants/carmella/profile.json']).hooks.transformProduct.code,shapes);
});
