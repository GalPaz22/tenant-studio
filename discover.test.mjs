import {test} from 'node:test';
import assert from 'node:assert/strict';
import {discover} from './discover.mjs';
const row=id=>({id,name:'Watch '+id,is_in_stock:true,prices:{price:'100',currency_minor_unit:2},categories:[],tags:[]});
test('large catalog pages shrink and restart without dropping products',async()=>{
 const requests=[];
 const result=await discover('https://example.com/','woocommerce',()=>{},async input=>{
  const u=new URL(input);if(u.pathname==='/')return '<title>Watches</title>';
  const size=Number(u.searchParams.get('per_page')),page=Number(u.searchParams.get('page'));
  requests.push({size,page});assert.ok(u.searchParams.get('_fields').includes('is_in_stock'));
  if(size===25&&page===2)throw Error('Source exceeds 3 MB');
  const start=(page-1)*size;return JSON.stringify(Array.from({length:Math.max(0,Math.min(size,37-start))},(_,i)=>row(start+i)));
 });
 assert.equal(result.products.length,37);
 assert.equal(new Set(result.products.map(p=>p.id)).size,37);
 assert.ok(requests.some(r=>r.size===10&&r.page===1));
 assert.equal(result.products.at(-1).id,'36');
});
test('oversized minimum page reports the cause and stops',async()=>{
 let requests=0;
 const result=await discover('https://example.com/','woocommerce',()=>{},async input=>{
  if(new URL(input).pathname==='/')return '<title>Watches</title>';
  requests++;throw Error('Source exceeds 3 MB');
 });
 assert.equal(requests,3);assert.equal(result.products.length,0);
 assert.ok(result.warnings.some(w=>w.includes('Source exceeds 3 MB')));
});
