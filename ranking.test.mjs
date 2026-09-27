import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {applyRanking,validateRankingRule,wordMatches} from './core/ranking.mjs';
import {createSearchService} from './core/semantic.mjs';
import {createIndexRetriever} from './core/search-index.mjs';
import {studioAgent} from './core/studio-agent.mjs';
import {existingProject} from './existing-client.mjs';
import {buildArtifacts} from './artifacts.mjs';

// A grocery like Carmella: fresh produce shares words with sauces, pasta and preserves.
const rows=[
 {id:'s1',name:'רוטב עגבניות שרי 350 גר',categories:['רטבים']},
 {id:'n1',name:'אטריות עם עגבניה 454 גרם',categories:['פסטה']},
 {id:'v1',name:'עגבניה שרי',categories:['ירקות']},
 {id:'v2',name:'עגבניות תמר',categories:['ירקות']},
 {id:'j1',name:'רסק תפוחים',categories:['שימורים']},
 {id:'f1',name:'תפוח גרני סמית',categories:['פירות']},
 {id:'c1',name:'גבינת פרמזן',categories:['גבינות']},
];
const produce=validateRankingRule({name:'ירקות ופירות קודם',field:'categories',values:['ירקות','פירות']});
const grocery=()=>existingProject('carmella',{dbName:'carmella'},rows.map(r=>({...r,stockStatus:'instock'})));

test('Hebrew singular and plural share a stem',()=>{
 assert.ok(wordMatches('עגבניות',['עגבניה','שרי']));assert.ok(wordMatches('עגבנייה',['עגבניות']));assert.ok(wordMatches('תפוחים',['תפוח']));assert.ok(!wordMatches('תפוחים',['תות']));
});
test('a produce rule lifts fresh produce that the query names, and leaves "רוטב עגבניות" alone',()=>{
 const order=(q,list)=>applyRanking(list,[produce],q).matches.map(p=>p.id);
 const cards=rows.map(r=>({...r,title:r.name}));
 assert.deepEqual(order('עגבניות',cards.filter(c=>['s1','n1','v1','v2'].includes(c.id))),['v1','v2','s1','n1']);
 assert.deepEqual(order('רוטב עגבניות',cards.filter(c=>['s1','v1'].includes(c.id))),['s1','v1'],'fresh tomatoes do not name "רוטב"');
 assert.deepEqual(order('תפוחים',cards.filter(c=>['j1','f1'].includes(c.id))),['f1','j1']);
 const bowl=[{id:'b1',title:'קערת אסאי עם בננה',categories:['פירות']},{id:'b2',title:'בננה',categories:['פירות']}];
 assert.deepEqual(order('בננות',bowl),['b2','b1'],'the item itself before a product that mentions it');
 const cheese=cards.filter(c=>c.id==='c1');assert.equal(applyRanking(cheese,[produce],'גבינה').applied.length,0);
 const bury=validateRankingRule({name:'אביזרים בסוף',action:'bury',field:'categories',values:['רטבים'],match:'any',terms:['עגבניה']});
 assert.deepEqual(applyRanking(cards.filter(c=>['s1','n1'].includes(c.id)),[bury],'עגבניות').matches.map(p=>p.id),['n1','s1']);
 // Burying the sauce category cannot put tomato sauces below a sauce that does not name the query.
 const sauces=[{id:'bbq',title:'רוטב ברביקיו',categories:['שונות']},{id:'s1',title:'רוטב עגבניות שרי',categories:['רטבים']}];
 assert.deepEqual(applyRanking(sauces,[validateRankingRule({name:'b',action:'bury',field:'categories',values:['רטבים'],match:'any'})],'רוטב עגבניות').matches.map(p=>p.id),['s1','bbq']);
 assert.throws(()=>validateRankingRule({name:'x',field:'__proto__',values:['a']}));assert.throws(()=>validateRankingRule({name:'x',values:[]}));
});
test('the real search service applies ranking rules on its final results and reports them',async()=>{
 const p=grocery(),profile={...p.revisions[0].profile,tenantId:p.id,rankingRules:[produce]};
 const retrieve=createIndexRetriever(p.productCards,profile,p.searchIndex);
 const search=createSearchService(p.productCards,profile,async()=>{throw Error('no model in tests');},{retrieve,lightweightRouter:false});
 const r=await search({query:'עגבניות',limit:10});
 // The singular ״עגבניה שרי״ is found for the plural query; ranking puts fresh tomatoes before the sauce and the pasta.
 assert.deepEqual(r.matches.slice(0,2).map(m=>m.id).sort(),['v1','v2']);assert.deepEqual(r.matches.slice(2).map(m=>m.id).sort(),['n1','s1']);assert.deepEqual(r.metadata.ranking,['ירקות ופירות קודם']);
});

const ranked=(p,profile)=>query=>{const r=createIndexRetriever(p.productCards,{...profile,tenantId:p.id},p.searchIndex)(query);return {...r,matches:applyRanking(r.matches,profile.rankingRules,query).matches,metadata:{phase:'lexical',llmUsed:false}};};
const scripted=(...replies)=>{let i=0;return async()=>replies[Math.min(i++,replies.length-1)];};

test('the agent orders a product class with one structural rule, tags a group, and does not loop on a failed call',async()=>{
 const events=[],model=scripted(
  {tools:[{name:'link_term',term:'עגבניות',mode:'only',titleContains:'אין כזה'},{name:'link_term',term:'עגבניות',mode:'only',titleContains:'אין כזה'}]},
  {tools:[{name:'rank_rule',label:'ירקות ופירות קודם',field:'categories',values:['ירקות','פירות']}]},
  {tools:[{name:'tag_products',tag:'טרי',categories:['ירקות','פירות']}]},
  {message:'ירקות ופירות מוצגים ראשונים',verify:['עגבניות','רוטב עגבניות']});
 const judge=async prompt=>{const order=JSON.parse(prompt.slice(prompt.lastIndexOf('DATA ')+5)).results.map(r=>r.returned.map(x=>x.id));assert.deepEqual(order[0].slice(0,2).sort(),['v1','v2']);assert.equal(order[1][0],'s1');
  return {queries:[{query:'עגבניות',returned:order[0].map(id=>({id,verdict:'wanted'})),missing:[]},{query:'רוטב עגבניות',returned:order[1].map(id=>({id,verdict:'wanted'})),missing:[]}],summary:'תקין'};};
 const next=await studioAgent(grocery(),'תקדם ירקות ופירות, למשל ״עגבניות״',{model,judge,onEvent:async e=>events.push(e),services:{createSearch:ranked}});
 const done=events.filter(e=>e.type==='tool_done');
 assert.match(done[1].text,/הקריאה הזהה כבר נכשלה/,'a repeated failing call is refused without running');
 assert.match(done.find(e=>e.name==='rank_rule').text,/מקדם 3 מוצרים/);
 assert.deepEqual(next.revisions.at(-1).profile.rankingRules.map(r=>r.name),['ירקות ופירות קודם']);
 assert.deepEqual(next.productCards.filter(c=>c.tags?.includes('טרי')).map(c=>c.id).sort(),['f1','v1','v2']);
 assert.ok(!next.revisions.at(-1).profile.scopedAliases?.length,'no per-query pins for an ordering request');
});

test('the exported module loads with all of its local imports and searches with ranking rules',async()=>{
 const root=fileURLToPath(new URL('.',import.meta.url)),dir=await mkdtemp(join(tmpdir(),'export-'));
 try{
  const p=grocery();p.revisions[0].profile={...p.revisions[0].profile,rankingRules:[produce]};
  for(const [name,content] of Object.entries(buildArtifacts(p).files)){await mkdir(dirname(join(dir,name)),{recursive:true});await writeFile(join(dir,name),content);}
  await symlink(join(root,'node_modules'),join(dir,'node_modules'));
  const {createTenant}=await import(pathToFileURL(join(dir,'search.mjs')).href);
  const tenant=createTenant();assert.ok(tenant.search);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('the Carmella loop: a model repeating the same batch is warned once, then the turn closes and is verified',async()=>{
 const batch={note:'מסיר נעיצות ומגדיר דירוג',tools:[{name:'remove_rule',kind:'linked',key:'עגבניה'},{name:'rank_rule',label:'fresh',field:'categories',values:['ירקות','פירות']}]};
 let calls=0;const model=async()=>{calls++;return batch;};
 const events=[],judge=async prompt=>{const order=JSON.parse(prompt.slice(prompt.lastIndexOf('DATA ')+5)).results.map(r=>r.returned.map(x=>x.id));return {queries:[{query:'עגבניות',returned:order[0].map(id=>({id,verdict:'wanted'})),missing:[]}],summary:'תקין'};};
 const next=await studioAgent(grocery(),'ירקות קודם ב״עגבניות״',{model,judge,onEvent:async e=>events.push(e),services:{createSearch:ranked}});
 assert.equal(calls,3,'first batch runs, the repeat is warned, the second repeat closes the turn');
 assert.match(events.find(e=>e.type==='tool_done'&&e.name==='remove_rule').text,/כבר לא קיים/,'removing an absent rule is not a failure');
 const reply=next.messages.at(-1);assert.match(reply.text,/סיכום אוטומטי/);assert.equal(reply.verification.satisfied,true);
 assert.deepEqual(next.revisions.at(-1).profile.rankingRules.map(r=>r.name),['fresh']);
});
test('a list of replies from the model is merged into one',async()=>{
 const {mergeReplies}=await import('./model.mjs');
 assert.deepEqual(mergeReplies([{note:'a',tools:[{name:'x'}]},{tools:[{name:'y'}]}]),{note:'a',tools:[{name:'x'},{name:'y'}]});
 assert.deepEqual(mergeReplies([{message:'done'}]),{message:'done'});assert.deepEqual(mergeReplies({message:'m'}),{message:'m'});
});

test('a removed rule that protects a confirmed example is restored, and the rest of the change is saved',async()=>{
 const p=grocery(),profile=p.revisions[0].profile;
 profile.scopedAliases=[{id:'a1',term:'עגבניות',productIds:['v1','v2'],mode:'only'}];
 const {learningState}=await import('./core/learning.mjs');learningState(p).examples.push({id:'e1',query:'עגבניות',includeIds:['v1','v2'],excludeIds:['s1'],status:'confirmed'});
 let n=0;const model=async()=>n++===0?{tools:[{name:'remove_rule',kind:'linked',key:'עגבניות'},{name:'rank_rule',label:'fresh',field:'categories',values:['ירקות']}]}:{message:'בוצע',verify:['תפוחים']};
 const judge=async prompt=>{const order=JSON.parse(prompt.slice(prompt.lastIndexOf('DATA ')+5)).results.map(r=>r.returned.map(x=>x.id));return {queries:[{query:'תפוחים',returned:order[0].map(id=>({id,verdict:'wanted'})),missing:[]}],summary:''};};
 const next=await studioAgent(p,'ירקות קודם ב״תפוחים״',{model,judge,services:{createSearch:ranked}});
 const saved=next.revisions.at(-1).profile;
 assert.deepEqual(saved.scopedAliases.map(r=>r.term),['עגבניות']);assert.deepEqual(saved.rankingRules.map(r=>r.name),['fresh']);
 assert.match(next.messages.at(-1).text,/שוחזרו אוטומטית/);
});

test('the expansion policy decides whether a short query with literal matches waits for the LLM',async()=>{
 const p=grocery();let calls=0;const generate=async()=>{calls++;throw Error('no model');};
 const make=pipeline=>{const profile={...p.revisions[0].profile,tenantId:p.id,pipeline:{...p.revisions[0].profile.pipeline,...pipeline}};return createSearchService(p.productCards,profile,generate,{retrieve:createIndexRetriever(p.productCards,profile,p.searchIndex),...profile.pipeline});};
 const off=await make({expansion:'off'})({query:'עגבניות',limit:10});assert.equal(calls,0);assert.equal(off.metadata.phase,'lexical');assert.equal(off.metadata.llmUsed,false);assert.ok(off.total>=3);
 await make({expansion:'sparse',expandBelow:2})({query:'עגבניות',limit:10});assert.equal(calls,0,'enough literal matches: no LLM');
 await make({expansion:'sparse',expandBelow:50})({query:'עגבניות',limit:10});assert.equal(calls,1,'too few literal matches: expanded');
 await make({})({query:'תפוחים',limit:10});assert.equal(calls,2,'default keeps the previous behaviour');
});
test('the agent can measure searches, read the engine code and switch the expansion policy',async()=>{
 const {tools}=await import('./core/studio-agent.mjs');
 const ctx={p:grocery(),profile:{...grocery().revisions[0].profile},services:{createSearch:ranked}};ctx.profile.pipeline={maxCandidates:40,lightweightRouter:false};
 const code=await tools.read_engine.run(ctx,{file:'semantic',grep:'expandLiteral'});assert.ok(code.matches.length&&code.matches[0].text.includes('expandLiteral'));
 assert.equal((await tools.read_engine.run(ctx,{file:'semantic',from:1,to:5})).to,5);await assert.rejects(tools.read_engine.run(ctx,{file:'../.env'}),/לא מוכר/);
 const m=await tools.measure_search.run(ctx,{queries:['עגבניות']});assert.equal(m.results[0].query,'עגבניות');assert.ok(Number.isFinite(m.results[0].elapsedMs));
 assert.equal(tools.configure_search.run(ctx,{expansion:'sparse',expandBelow:10}).expansion,'sparse');assert.equal(ctx.profile.pipeline.maxCandidates,40,'unchanged settings are kept');
 assert.throws(()=>tools.configure_search.run(ctx,{expansion:'sparse',expandBelow:10}),/לא צוין שינוי/);
});

test('out-of-stock policy: hidden by default, after all in-stock results with "last", in place with "show"',async()=>{
 const p=existingProject('garmin',{dbName:'garmin'},[{id:'a',name:'שעון fenix 8',stockStatus:'outofstock'},{id:'b',name:'שעון fenix 7',stockStatus:'instock'},{id:'c',name:'שעון fenix 6',stockStatus:'instock',hidden:true}]);
 const run=async outOfStock=>{const profile={...p.revisions[0].profile,tenantId:p.id,pipeline:{...p.revisions[0].profile.pipeline,expansion:'off',outOfStock}};
  const r=await createSearchService(p.productCards,profile,async()=>{throw Error('no model')},{retrieve:createIndexRetriever(p.productCards,profile,p.searchIndex),...profile.pipeline})({query:'fenix',limit:10});return r.matches.map(m=>m.id.split(':').pop());};
 assert.deepEqual(await run(undefined),['b']);assert.deepEqual(await run('last'),['b','a']);assert.deepEqual((await run('show')).sort(),['a','b'],'hidden products never show');
 const {tools}=await import('./core/studio-agent.mjs');const ctx={profile:{pipeline:{maxCandidates:40,lightweightRouter:false}}};
 assert.equal(tools.configure_search.run(ctx,{outOfStock:'last'}).outOfStock,'last');assert.throws(()=>tools.configure_search.run(ctx,{outOfStock:'all'}),/outOfStock/);
});
