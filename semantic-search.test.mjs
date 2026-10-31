import {test} from 'node:test';import assert from 'node:assert/strict';
import {createSearchService} from './core/semantic.mjs';import {searchModel} from './core/gemini.mjs';import {chatModel,validateProfile} from './model.mjs';import {tools} from './core/studio-agent.mjs';
const validProfile=()=>({name:'t',domain:'home',productTypes:{},colors:{},finishes:{},queryAliases:{},tagDefinitions:{},badgeCandidates:{},badgeRules:[]});
const client={tenantId:'t',domain:'home',productTypes:{},colors:{},finishes:{},tagDefinitions:{},queryAliases:{},version:'1'};
const products=[{id:'1',tenantId:'t',title:'צלחת עגולה מקרמיקה עם שוליים דקים',description:'',categories:['צלחות'],tags:[],colors:[],finishes:[],stockStatus:'instock',hidden:false,price:20,specifications:{חומר:'קרמיקה',צורה:'עגולה',שוליים:'דקים'}},{id:'2',tenantId:'t',title:'מגבת',categories:['מגבות'],tags:[],colors:[],finishes:[],stockStatus:'instock',hidden:false,price:10}];
const plan={intent:'צלחת',categories:['צלחות'],terms:['צלחת','קרמיקה'],requirements:['צלחת','עגולה','קרמיקה','שוליים דקים'],minPrice:null,maxPrice:null,colors:[],finishes:[],tags:[],clarification:''};
test('complex queries reach deep interpretation and selection even when literal retrieval matches',async()=>{
 const stages=[];const search=createSearchService(products,client,async({stage})=>{stages.push(stage);return {model:'strong-model',data:stage==='interpret'?plan:{matches:[{id:'1',evidence:plan.requirements.map((_,requirement)=>({requirement,field:'title',quote:products[0].title}))}]}};});
 const r=await search({query:products[0].title});assert.deepEqual(stages,['interpret','select']);assert.deepEqual(r.matches.map(p=>p.id),['1']);assert.deepEqual(r.metadata.models,['strong-model']);
});
test('a long query whose every word is in a title keeps that product when the model rejects it; a negation does not',async()=>{
 const phones=[{id:'1',tenantId:'t',title:'כיסוי שקוף לאייפון 18 פרו מקס',description:'',categories:['כיסויים'],tags:[],colors:[],finishes:[],stockStatus:'instock',hidden:false,price:50,specifications:{}},{id:'2',tenantId:'t',title:'כיסוי שקוף לאייפון 14 פרו',description:'',categories:['כיסויים'],tags:[],colors:[],finishes:[],stockStatus:'instock',hidden:false,price:40,specifications:{}}];
 const search=createSearchService(phones,client,async({stage})=>({data:stage==='interpret'?{...plan,categories:[],terms:['כיסוי'],requirements:['כיסוי לאייפון 18 פרו מקס']}:{matches:[]}}));
 const r=await search({query:'כיסוי שקוף לאייפון 18 פרו מקס'});assert.deepEqual(r.matches.map(p=>p.id),['1']);assert.equal(r.metadata.titledCount,1);assert.notEqual(r.metadata.closestFallback,true);
 const negated=await search({query:'כיסוי שקוף לאייפון 18 בלי מקס'});assert.equal(negated.metadata.titledCount,undefined);
});
test('a tenant deep model reaches both deep stages, and the agent can set and reset it',async()=>{
 const seen=[];const search=createSearchService(products,client,async({stage,model})=>{seen.push([stage,model]);return {data:stage==='interpret'?plan:{matches:[{id:'1',evidence:plan.requirements.map((_,requirement)=>({requirement,field:'title',quote:products[0].title}))}]}};},{deepModel:'gemini-3.1-pro-preview'});
 await search({query:products[0].title});assert.deepEqual(seen,[['interpret','gemini-3.1-pro-preview'],['select','gemini-3.1-pro-preview']]);
 const ctx={profile:{pipeline:{maxCandidates:100,lightweightRouter:true}}},tool=tools.configure_search;
 assert.equal(tool.run(ctx,{deepModel:'gemini-3.8-flash'}).deepModel,'gemini-3.8-flash');
 assert.throws(()=>tool.run(ctx,{deepModel:'gpt-5'}),/deepModel/);
 assert.equal('deepModel' in tool.run(ctx,{deepModel:'default'}),false);
 assert.throws(()=>validateProfile({...validProfile(),pipeline:{maxCandidates:100,lightweightRouter:true,deepModel:'gpt-5'}}),/Invalid pipeline/);
 validateProfile({...validProfile(),pipeline:{maxCandidates:100,lightweightRouter:true,deepModel:'gemini-3.8-flash'}});
});
test('selectThinking applies to the selector only; deepThinking stays on interpretation',async()=>{
 const seen=[];const search=createSearchService(products,client,async({stage,thinking})=>{seen.push([stage,thinking]);return {data:stage==='interpret'?plan:{matches:[{id:'1',evidence:plan.requirements.map((_,requirement)=>({requirement,field:'title',quote:products[0].title}))}]}};},{deepThinking:'medium',selectThinking:'low'});
 await search({query:products[0].title});assert.deepEqual(seen,[['interpret','medium'],['select','low']]);
 const ctx={profile:{pipeline:{maxCandidates:100,lightweightRouter:true}}},tool=tools.configure_search;
 assert.equal(tool.run(ctx,{selectThinking:'low'}).selectThinking,'low');
 assert.throws(()=>tool.run(ctx,{selectThinking:'max'}),/selectThinking/);
 assert.throws(()=>validateProfile({...validProfile(),pipeline:{maxCandidates:100,lightweightRouter:true,selectThinking:'max'}}),/Invalid pipeline/);
 validateProfile({...validProfile(),pipeline:{maxCandidates:100,lightweightRouter:true,selectThinking:'low'}});
});
test('missing evidence and provider failures return explicitly unverified alternatives',async()=>{
 for(const fail of [false,true]){const search=createSearchService(products,client,async({stage})=>{if(fail)throw Error('provider failed');return {data:stage==='interpret'?plan:{matches:[]}}});const r=await search({query:'צלחת עגולה מקרימקה עם שוליים דקים'});assert.ok(r.matches.length>0);assert.ok(r.matches.every(p=>p.matchQuality==='alternative'));assert.equal(r.metadata.fullMatch,false);assert.equal(r.metadata.rankedByModel,false);}
});
test('specifications support requirement evidence and partial evidence is rejected',async()=>{
 const search=createSearchService(products,client,async({stage})=>({data:stage==='interpret'?plan:{matches:[{id:'1',evidence:[{requirement:0,field:'title',quote:'צלחת'},{requirement:1,field:'specifications',quote:'צורה: עגולה'},{requirement:2,field:'specifications',quote:'חומר: קרמיקה'},{requirement:3,field:'specifications',quote:'שוליים: דקים'}]},{id:'2',evidence:[{requirement:0,field:'title',quote:'מגבת'}]}]}}));const r=await search({query:'צלחת עגולה מקרימקה עם שוליים דקים'});assert.deepEqual(r.matches.map(p=>p.id),['1']);
});
test('search model and repair model have independent defaults',()=>{assert.equal(searchModel(),'gemini-3.5-flash-lite');assert.equal(chatModel(),'gemini-3.5-flash-lite');});
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
test('the selector reads a bounded list: best-scored distinct products with short descriptions, and markdown-free quotes count',async()=>{
 const many=Array.from({length:60},(_,i)=>({id:'p'+String(i).padStart(2,'0'),tenantId:'t',title:i<3?'צלחת קרמיקה':'צלחת קרמיקה '+i,description:'**Material:** Ceramic '+'x'.repeat(3000),categories:['צלחות'],tags:[],colors:[],finishes:[],stockStatus:'instock',hidden:false,price:20,specifications:{}}));
 const p2={...plan,requirements:['קרמיקה']};let seen;
 const search=createSearchService(many,client,async({stage,prompt})=>{if(stage==='interpret')return {data:p2};seen=JSON.parse(prompt.slice(prompt.lastIndexOf('\nDATA ')+6)).candidates;return {data:{matches:[{id:seen[0].id,evidence:[{requirement:0,field:'description',quote:'Material: Ceramic'}]}]}};},{lightweightRouter:false});
 const r=await search({query:'צלחת מקרמיקה עגולה עם שוליים'});
 assert.equal(seen.length,40);assert.equal(seen.filter(c=>c.title==='צלחת קרמיקה').length,1,'variants with one title and price take one slot');
 assert.ok(seen.every(c=>c.description.length<=1200));assert.equal(r.matches.length,1);assert.equal(r.metadata.candidatesTruncated,true);
 const narrow=createSearchService(many,client,async({stage,prompt})=>{if(stage==='interpret')return {data:p2};seen=JSON.parse(prompt.slice(prompt.lastIndexOf('\nDATA ')+6)).candidates;return {data:{matches:[]}};},{lightweightRouter:false,selectCandidates:15});
 await narrow({query:'צלחת מקרמיקה עגולה עם שוליים'});assert.equal(seen.length,15);
 assert.throws(()=>validateProfile({...validProfile(),pipeline:{maxCandidates:100,lightweightRouter:true,selectCandidates:500}}),/Invalid pipeline/);
});

test('a model search over the concurrency limit waits for a slot (queueMs), and an over-limit fallback is not cached',async()=>{
 const products=[{id:'1',tenantId:'t',title:'כיסוי שקוף לאייפון 17',description:'',categories:[],colors:[],finishes:[],tags:[],price:50,stockStatus:'instock',hidden:false,specifications:{}}];
 const client={tenantId:'t',version:'v',productTypes:{},colors:{},finishes:{},queryAliases:{},publishedStatuses:['publish'],rankingRules:[]};
 let calls=0,release;const gate=new Promise(r=>release=r);
 const generate=async()=>{calls++;await gate;return {data:{matches:[],terms:[]},usage:{}};};
 const {createSearchService}=await import('./core/semantic.mjs');
 const slow=createSearchService(products,client,generate,{lightweightRouter:false,llmConcurrency:1,queueMs:0});
 const first=slow({query:'משהו שאין בכלל בקטלוג אחד'});
 await new Promise(r=>setTimeout(r,20));
 const over=await slow({query:'עוד בקשה שאין בקטלוג שתיים'});
 assert.equal(over.metadata.failureReason,'llm-concurrency');
 assert.equal(over.metadata.cached,false);
 release();await first;
 const again=await slow({query:'עוד בקשה שאין בקטלוג שתיים'});
 assert.notEqual(again.metadata.failureReason,'llm-concurrency','the fallback was not cached');
 let release2;const gate2=new Promise(r=>release2=r);
 const queued=createSearchService(products,client,async()=>{await gate2;return {data:{matches:[],terms:[]},usage:{}};},{lightweightRouter:false,llmConcurrency:1,queueMs:2000});
 const a=queued({query:'משהו שאין בכלל בקטלוג אחד'});await new Promise(r=>setTimeout(r,20));
 const b=queued({query:'עוד בקשה שאין בקטלוג שתיים'});setTimeout(release2,200);
 assert.notEqual((await b).metadata.failureReason,'llm-concurrency','the second search waited for the first');await a;
});

test('lexicalFirst: index matches answer even long requests without the model; empty results and negations still reach it',async()=>{
 const products=[{id:'1',tenantId:'t',title:'כיסוי ארנק שחור לגלקסי S26 עם מקום לכרטיסים',description:'',categories:[],colors:[],finishes:[],tags:[],price:80,stockStatus:'instock',hidden:false,specifications:{}}];
 const client={tenantId:'t',version:'v',productTypes:{},colors:{},finishes:{},queryAliases:{},publishedStatuses:['publish'],rankingRules:[]};
 let calls=0;const generate=async()=>{calls++;return {data:{matches:[],terms:[]},usage:{}};};
 const {createSearchService}=await import('./core/semantic.mjs');
 const s=createSearchService(products,client,generate,{lightweightRouter:false,lexicalFirst:true});
 const r=await s({query:'כיסוי ארנק שחור לגלקסי S26'});
 assert.equal(r.metadata.phase,'lexical-first');assert.equal(r.total,1);assert.equal(calls,0);
 await s({query:'כיסוי ארנק לגלקסי S26 בלי שחור'});assert.ok(calls>0,'a negation goes to the model');
 const before=calls;await s({query:'מטען אלחוטי לרכב מהיר'});assert.ok(calls>before,'no index match: the model is the fallback');
});
