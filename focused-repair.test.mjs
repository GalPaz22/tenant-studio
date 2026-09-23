import {createSearchService} from './core/semantic.mjs';
import {test} from 'node:test';import assert from 'node:assert/strict';
import {focusedRepair} from './core/focused-repair.mjs';import {createDraftRuntime} from './runtime.mjs';import {hash} from './core/catalog.mjs';
const profile={name:'Store',domain:'home',productTypes:{},colors:{},finishes:{},queryAliases:{},tagDefinitions:{},badgeCandidates:{categories:[],tags:[]},badgeRules:[],pipeline:{maxCandidates:20,lightweightRouter:false}};
function fixture(){const p={id:'store',url:'https://example.com',platform:'custom',messages:[],revisions:[{number:1,profile}],catalog:{products:[{id:'1',name:'כוסות קפה',categories:['כוס'],tags:[],description:'קרמיקה',stockStatus:'instock',status:'ACTIVE'},{id:'2',name:'כוס יין',categories:['כוס'],tags:[],stockStatus:'instock',status:'ACTIVE'},{id:'3',name:'כוסות קפה',categories:['אביזר'],tags:[],stockStatus:'instock',status:'ACTIVE'}]}};const runtime=createDraftRuntime(p,p.revisions[0]);return {...p,productCards:runtime.products,searchIndex:runtime.index,productCardsProfileHash:hash(profile)};}
test('targeted tools select category AND title, then fix retrieval without changing catalog',async()=>{
 const p=fixture(),original=JSON.stringify(p);let step=0;
 const result=await focusedRepair(p,'מצא כוסות קפה בקטגוריה כוס וקשר למאג',null,async prompt=>{
  if(step++===0)return {tools:[{name:'categories',contains:'כוס'},{name:'products',categories:['כוס'],nameContains:'קפה'},{name:'inspect_query',query:'מאג'}]};
  assert.match(prompt,/selection-1/);return {message:'קושר מוצר אחד',operations:[{type:'scoped_alias',selectionId:'selection-1',term:'מאג'}],testQueries:['מאג']};
 });
 assert.deepEqual(result.profile.scopedAliases[0].productIds,['1']);assert.equal(result.checks[0].before.total,0);assert.equal(result.checks[0].after.total,1);assert.equal(JSON.stringify(p),original);
 const rt=createDraftRuntime({...p,productCardsProfileHash:hash(result.profile)},{number:2,profile:result.profile});assert.equal((await rt.search({query:'מאג'})).matches[0].id,'1');
 const checked=createSearchService(rt.products,rt.profile,async()=>{throw Error('offline')},{lightweightRouter:false});const empty=await checked({query:'מאג זכוכית'});assert.ok(empty.total>0);assert.ok(empty.matches.every(p=>p.matchQuality==='alternative'));assert.equal(empty.metadata.llmCalls,2);
});
test('unknown selections and forbidden full-catalog operations cannot mutate a profile',async()=>{
 const p=fixture();await assert.rejects(()=>focusedRepair(p,'test',null,async()=>({message:'x',operations:[{type:'scoped_alias',selectionId:'invented',term:'מאג'}]})));
 await assert.rejects(()=>focusedRepair(p,'test',null,async()=>({message:'x',operations:[{type:'classify_all'}]})));
 assert.equal(p.revisions.length,1);assert.equal(p.revisions[0].profile.scopedAliases,undefined);
});
test('large selections require narrowing rather than silently acting on a sample',async()=>{
 const p=fixture();p.catalog.products=Array.from({length:201},(_,i)=>({id:String(i),name:'כוס קפה',categories:['כוס']}));let step=0;
 const r=await focusedRepair(p,'test',null,async prompt=>{if(step++===0)return {tools:[{name:'products',categories:['כוס'],nameContains:''}]};assert.match(prompt,/"requiresNarrowing":true/);assert.match(prompt,/"selectionId":null/);return {message:'איזו קבוצת כוסות לתקן?',operations:[]};});assert.equal(r.profile.scopedAliases,undefined);
});
test('scoped vocabulary adds selected products without removing native literal matches',async()=>{
 const p=fixture();p.catalog.products.push({id:'4',name:'מאג',categories:['אחר'],tags:[],stockStatus:'instock',status:'ACTIVE'});p.productCards=null;p.searchIndex=null;const initial=createDraftRuntime(p,p.revisions[0]);p.productCards=initial.products;p.searchIndex=initial.index;
 let step=0;const result=await focusedRepair(p,'test',null,async()=>step++===0?{tools:[{name:'products',categories:['כוס'],nameContains:'קפה'}]}:{message:'נוסף כינוי',operations:[{type:'scoped_alias',selectionId:'selection-1',term:'מאג'}],testQueries:['מאג']});
 assert.equal(result.checks[0].before.total,1);assert.equal(result.checks[0].after.total,2);
 const originalCards=p.productCards,originalIndex=p.searchIndex;p.catalog.products={map(){throw Error('must not reprocess raw catalog')}};
 const rt=createDraftRuntime({...p,productCardsProfileHash:hash(result.profile)},{number:2,profile:result.profile});assert.equal(rt.products,originalCards);assert.equal(rt.index,originalIndex);assert.equal((await rt.search({query:'מאג'})).total,2);
});
