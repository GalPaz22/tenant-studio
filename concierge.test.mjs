import {test} from 'node:test';import assert from 'node:assert/strict';
import {existingProject} from './existing-client.mjs';
import {decideTrigger,outOfStockHits,applyConciergeSettings,settingsOf,conciergeTurn,inspectTrigger} from './core/concierge.mjs';
import {studioAgent,tools} from './core/studio-agent.mjs';
import {createIndexRetriever} from './core/search-index.mjs';

const shop=()=>existingProject('books',{dbName:'books'},[{id:'1',name:'אבא עושה בושות',author:'מאיר שלו',stockStatus:'instock',price:80},{id:'2',name:'יונה ונער',author:'מאיר שלו',stockStatus:'outofstock',price:70}]);
const lexical=(p,profile)=>query=>{const r=createIndexRetriever(p.productCards,{...profile,tenantId:p.id},p.searchIndex)(query);return {...r,metadata:{phase:r.total?'lexical':'lexical',llmUsed:false,exactCount:r.total}};};

test('trigger matches dashboard moments: empty, out of stock, non-literal, and stays closed on a literal hit',()=>{
 const p=shop();applyConciergeSettings(p,{enabled:true});
 assert.equal(decideTrigger({matches:[],metadata:{phase:'lexical'}},'xyz',settingsOf(p)).reason,'no_results');
 const oos=outOfStockHits(p.productCards,'יונה ונער');assert.equal(oos[0].id,'2');
 assert.equal(decideTrigger({matches:[],metadata:{phase:'lexical'}},'יונה ונער',settingsOf(p),oos).reason,'out_of_stock');
 assert.equal(decideTrigger({matches:[{id:'1',stockStatus:'instock'}],metadata:{phase:'closest-alternatives'}},'משהו',settingsOf(p)).reason,'non_literal');
 assert.equal(decideTrigger({matches:[{id:'1',stockStatus:'instock'}],metadata:{phase:'lexical',exactCount:1}},'מאיר שלו',settingsOf(p)),null);
 assert.equal(decideTrigger({matches:[],metadata:{phase:'lexical'}},'xyz',{enabled:false}),null);
});

test('shopper turn uses only this catalog and present_products',async()=>{
 const p=shop();applyConciergeSettings(p,{enabled:true,context:'חנות ספרים'});
 let n=0;const model=async()=>++n===1?{tools:[{name:'search_catalog',query:'מאיר שלו'}]}:{message:'יש את אבא עושה בושות במלאי.',present:['1']};
 const r=await conciergeTurn(p,{message:'יש משהו של שלו?',trigger:{reason:'no_results',query:'שליו'}},model,{search:lexical(p,p.revisions[0].profile)});
 assert.equal(r.products[0].id,'1');assert.ok(!r.products.some(x=>x.id==='2'));assert.deepEqual(r.steps,['search_catalog']);
});

test('studio agent can enable concierge without a search-rule revision',async()=>{
 const p=shop();let n=0;
 const next=await studioAgent(p,'הפעל קונסיירז׳',{model:async()=>++n===1?{tools:[{name:'configure_concierge',enabled:true,autoOpen:true,context:'ספרים'}]}:{message:'הופעל'},services:{createSearch:lexical}});
 assert.equal(next.concierge.enabled,true);assert.equal(next.concierge.context,'ספרים');assert.equal(next.revisions.length,1);
 const preview=await tools.preview_concierge.run({p:next,profile:next.revisions[0].profile,search:async()=>({matches:[],total:0,metadata:{phase:'lexical'}})},{query:'אין כזה'});
 assert.equal(preview.trigger.reason,'no_results');
});
