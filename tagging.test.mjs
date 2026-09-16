import {test} from 'node:test';import assert from 'node:assert/strict';
import {classifyTag} from './core/tagging.mjs';

test('classifyTag only keeps ids the model returned that were actually in that batch',async()=>{
 const products=[{id:'1',name:'Square Watch A'},{id:'2',name:'Round Watch B'},{id:'3',name:'Square Watch C'}];
 const generate=async()=>({data:{matches:[{id:'1'},{id:'3'},{id:'ghost'}]}});
 const result=await classifyTag(products,'מסך מרובע','Square screen watches.',generate,{batchSize:40});
 assert.deepEqual(result.matchedIds.sort(),['1','3']);
 assert.equal(result.productsScanned,3);
 assert.equal(result.failedBatches,0);
});

test('classifyTag batches the catalog and merges matches across batches',async()=>{
 const products=Array.from({length:5},(_,i)=>({id:String(i),name:'Product '+i}));
 let batches=0;
 const generate=async({prompt})=>{
  batches++;
  const ids=[...prompt.matchAll(/"id":"(\d+)"/g)].map(m=>m[1]);
  return {data:{matches:ids.map(id=>({id}))}};
 };
 const result=await classifyTag(products,'tag','def',generate,{batchSize:2});
 assert.equal(batches,3);
 assert.deepEqual(result.matchedIds.sort((a,b)=>a-b),['0','1','2','3','4']);
 assert.equal(result.productsScanned,5);
});

test('a failed batch is skipped, not fatal to the whole tag',async()=>{
 const products=[{id:'1',name:'A'},{id:'2',name:'B'}];
 let call=0;
 const generate=async()=>{call++;if(call===1)throw Error('provider error');return {data:{matches:[{id:'2'}]}}};
 const result=await classifyTag(products,'tag','def',generate,{batchSize:1});
 assert.deepEqual(result.matchedIds,['2']);
 assert.equal(result.failedBatches,1);
});

test('report is awaited with running progress after each batch',async()=>{
 const products=[{id:'1',name:'A'},{id:'2',name:'B'}];
 const seen=[];
 const generate=async()=>({data:{matches:[]}});
 await classifyTag(products,'tag','def',generate,{batchSize:1,report:async text=>{seen.push(text)}});
 assert.equal(seen.length,2);
 assert.match(seen[0],/1.*2/);
 assert.match(seen[1],/2.*2/);
});
