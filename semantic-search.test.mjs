import {test} from 'node:test';import assert from 'node:assert/strict';
import {createSearchService} from './core/semantic.mjs';import {searchModel} from './core/gemini.mjs';import {chatModel} from './model.mjs';
const client={tenantId:'t',domain:'home',productTypes:{},colors:{},finishes:{},tagDefinitions:{},queryAliases:{},version:'1'};
const products=[{id:'1',tenantId:'t',title:'צלחת עגולה מקרמיקה עם שוליים דקים',description:'',categories:['צלחות'],tags:[],colors:[],finishes:[],stockStatus:'instock',hidden:false,price:20,specifications:{חומר:'קרמיקה',צורה:'עגולה',שוליים:'דקים'}},{id:'2',tenantId:'t',title:'מגבת',categories:['מגבות'],tags:[],colors:[],finishes:[],stockStatus:'instock',hidden:false,price:10}];
const plan={intent:'צלחת',categories:['צלחות'],terms:['צלחת','קרמיקה'],requirements:['צלחת','עגולה','קרמיקה','שוליים דקים'],minPrice:null,maxPrice:null,colors:[],finishes:[],tags:[],clarification:''};
test('complex queries reach deep interpretation and selection even when literal retrieval matches',async()=>{
 const stages=[];const search=createSearchService(products,client,async({stage})=>{stages.push(stage);return {model:'strong-model',data:stage==='interpret'?plan:{matches:[{id:'1',evidence:plan.requirements.map((_,requirement)=>({requirement,field:'title',quote:products[0].title}))}]}};});
 const r=await search({query:products[0].title});assert.deepEqual(stages,['interpret','select']);assert.deepEqual(r.matches.map(p=>p.id),['1']);assert.deepEqual(r.metadata.models,['strong-model']);
});
test('missing evidence and provider failures return explicitly unverified alternatives',async()=>{
 for(const fail of [false,true]){const search=createSearchService(products,client,async({stage})=>{if(fail)throw Error('provider failed');return {data:stage==='interpret'?plan:{matches:[]}}});const r=await search({query:'צלחת עגולה מקרימקה עם שוליים דקים'});assert.ok(r.matches.length>0);assert.ok(r.matches.every(p=>p.matchQuality==='alternative'));assert.equal(r.metadata.fullMatch,false);assert.equal(r.metadata.rankedByModel,false);}
});
test('specifications support requirement evidence and partial evidence is rejected',async()=>{
 const search=createSearchService(products,client,async({stage})=>({data:stage==='interpret'?plan:{matches:[{id:'1',evidence:[{requirement:0,field:'title',quote:'צלחת'},{requirement:1,field:'specifications',quote:'צורה: עגולה'},{requirement:2,field:'specifications',quote:'חומר: קרמיקה'},{requirement:3,field:'specifications',quote:'שוליים: דקים'}]},{id:'2',evidence:[{requirement:0,field:'title',quote:'מגבת'}]}]}}));const r=await search({query:'צלחת עגולה מקרימקה עם שוליים דקים'});assert.deepEqual(r.matches.map(p=>p.id),['1']);
});
test('search model and repair model have independent defaults',()=>{assert.equal(searchModel(),'gemini-3.1-flash-lite');assert.equal(chatModel(),'gemini-3.1-flash-lite');});
test('unknown retrieval hints do not discard the request or bypass evidence checks',async()=>{
 const stages=[];const search=createSearchService(products,client,async({stage})=>{stages.push(stage);return {data:stage==='interpret'?{...plan,categories:['invented'],tags:['unclassified material']}:{matches:[]}}});const r=await search({query:'צלחת עגולה מקרימקה עם שוליים דקים'});assert.deepEqual(stages,['interpret','select','select']);assert.equal(r.metadata.closestFallback,true);assert.deepEqual(r.metadata.requirements,plan.requirements);
});
test('short literal matches expand to evidenced functional relatives, exact first and deduplicated',async()=>{
 const items=[{...products[0],title:'קופסאות אחסון',categories:['אחסון']},{...products[1],title:'צנצנת',description:'צנצנת לאחסון מזון',categories:['אחסון']}];const stages=[];
 const run=createSearchService(items,client,async({stage})=>{stages.push(stage);return {data:stage==='interpret'?{...plan,categories:['אחסון'],terms:['אחסון'],requirements:['אחסון']}:{matches:[{id:'2',evidence:[{requirement:0,field:'description',quote:'לאחסון מזון'}]},{id:'1',evidence:[{requirement:0,field:'title',quote:'אחסון'}]}]}}});
 const result=await run({query:'קופסאות אחסון',limit:1});assert.deepEqual(stages,['interpret','select']);assert.equal(result.total,2);assert.equal(result.matches[0].id,'1');assert.equal(result.metadata.expandedCount,1);assert.equal((await run({cursor:result.nextCursor})).matches[0].id,'2');
 const fail=createSearchService(items,client,async()=>{throw Error('offline')});const fallback=await fail({query:'קופסאות אחסון'});assert.deepEqual(fallback.matches.map(p=>p.id),['1']);assert.equal(fallback.metadata.expansionUnavailable,true);
});
test('incomplete material tags do not exclude products with source evidence',async()=>{
 const c={...client,tagDefinitions:{'עשוי מזכוכית':{definition:'מוצר זכוכית',queryAliases:['זכוכית']}}};
 const items=[{...products[0],title:'קערת מרק מזכוכית חלבית',specifications:{חומר:'זכוכית'},categories:['קערות'],tags:[]}];let selected=false;
 const run=createSearchService(items,c,async({stage,prompt})=>{if(stage==='select'){selected=true;assert.ok(prompt.includes(items[0].title));}return {data:stage==='interpret'?{...plan,categories:['קערות'],terms:['קערת','מרק','זכוכית'],requirements:['קערת מרק','זכוכית חלבית']}:{matches:[{id:'1',evidence:[{requirement:0,field:'title',quote:'קערת מרק'},{requirement:1,field:'title',quote:'זכוכית חלבית'}]}]}}});
 const r=await run({query:'קערית מרק זכוכית חלבית'});assert.equal(selected,true);assert.deepEqual(r.matches.map(p=>p.id),['1']);
});
test('scoped aliases with extra material constraints reach evidence selection instead of returning an empty lexical result',async()=>{
 const c={...client,scopedAliases:[{id:'coffee',term:'כוס קפה',productIds:['1','2']}],tagDefinitions:{'עשוי מזכוכית':{definition:'זכוכית',queryAliases:['זכוכית']}}};
 const items=[{...products[0],title:'ספל קפה זכוכית',specifications:{חומר:'זכוכית'},categories:['כוסות'],tags:[]},{...products[1],title:'ספל קפה קרמיקה',categories:['כוסות'],tags:[]}];const stages=[];
 const run=createSearchService(items,c,async({stage})=>{stages.push(stage);return {data:stage==='interpret'?{...plan,categories:['כוסות'],terms:['קפה','זכוכית'],requirements:['קפה','זכוכית']}:{matches:[{id:'1',evidence:[{requirement:0,field:'title',quote:'קפה'},{requirement:1,field:'title',quote:'זכוכית'}]}]}}});
 const r=await run({query:'כוס קפה זכוכית'});assert.deepEqual(stages,['interpret','select']);assert.deepEqual(r.matches.map(p=>p.id),['1']);
});
test('empty exact scoped rule falls through to model and searches outside stale product selection',async()=>{
 const c={...client,scopedAliases:[{id:'old',term:'קערית חלבית',productIds:['deleted']} ]};const items=[{...products[0],title:'קערת מרק זכוכית חלבית',specifications:{חומר:'זכוכית'},categories:['קערות']}];const stages=[];
 const run=createSearchService(items,c,async({stage})=>{stages.push(stage);return {data:stage==='interpret'?{...plan,categories:['קערות'],terms:['חלבית'],requirements:['קערית חלבית']}:{matches:[{id:'1',evidence:[{requirement:0,field:'title',quote:'קערת מרק זכוכית חלבית'}]}]}}},{lightweightRouter:false});
 const r=await run({query:'קערית חלבית'});assert.deepEqual(stages,['interpret','select']);assert.deepEqual(r.matches.map(p=>p.id),['1']);
});
test('closest alternatives preserve model ranking, explain gaps, reject foreign IDs and paginate',async()=>{
 let calls=0;const items=[...products,{...products[0],id:'hidden',hidden:true}];
 const run=createSearchService(items,client,async({stage})=>({data:stage==='interpret'?plan:++calls===1?{matches:[]}:{matches:[{id:'hidden',reason:'bad',missing:[]},{id:'2',reason:'חלופה זמינה',missing:['קרמיקה']},{id:'1',reason:'דומה בצורה',missing:['גודל לא אומת']}]}}));
 const r=await run({query:'צלחת עגולה מקרמיקה מיוחדת',limit:1});assert.equal(r.matches[0].id,'2');assert.equal(r.matches[0].matchQuality,'alternative');assert.deepEqual(r.matches[0].missingRequirements,['קרמיקה']);assert.equal(r.total,2);assert.equal(r.metadata.rankedByModel,true);assert.equal((await run({cursor:r.nextCursor})).matches[0].id,'1');
});
test('empty catalogs cannot manufacture alternatives',async()=>{const run=createSearchService([],client,async()=>{throw Error('offline')},{lightweightRouter:false});assert.equal((await run({query:'מוצר שלא קיים בכלל'})).total,0);});
