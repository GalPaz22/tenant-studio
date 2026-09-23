import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractMerchantFacts,applyMerchantFacts} from './core/merchant-facts.mjs';
const product={id:'cup',name:'Cup',description:'Made of glass. Capacity 250 ml.',specifications:{material:'ceramic'},contentHash:'v1',sourceUrl:'https://shop.example/cup',fetchedAt:'2026-09-16T00:00:00Z',evidence:[]};
test('merchant extraction rejects invented evidence and preserves existing conflicting specifications',async()=>{
 const results=await extractMerchantFacts([product],async()=>({data:{products:[{id:'cup',facts:[{field:'material',value:'glass',quote:'Made of glass.'},{field:'capacity',value:'250 ml',quote:'Capacity 250 ml.'},{field:'dishwasher',value:'safe',quote:'Dishwasher safe.'},{field:'price',value:'250',quote:'Capacity 250 ml.'}]}]}}));
 assert.equal(results[0].facts.length,2);assert.equal(results[0].facts[0].status,'conflict');
 const enriched=applyMerchantFacts(product,results[0].facts);assert.equal(enriched.specifications.material,'ceramic');assert.equal(enriched.specifications.capacity,'250 ml');assert.equal(enriched.evidence.length,2);assert.deepEqual(product.specifications,{material:'ceramic'});
});
test('different literal values for the same extracted attribute remain conflicts',async()=>{
 const p={...product,description:'Capacity 250 ml or 500 ml.',specifications:{}};
 const [{facts}]=await extractMerchantFacts([p],async()=>({data:{products:[{id:p.id,facts:[{field:'capacity',value:'250 ml',quote:p.description},{field:'capacity',value:'500 ml',quote:p.description}]}]}}));
 assert.ok(facts.every(f=>f.status==='conflict'));assert.deepEqual(applyMerchantFacts(p,facts).specifications,{});
});
