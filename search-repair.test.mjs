import {test} from 'node:test';import assert from 'node:assert/strict';
import {createSearchService} from './core/semantic.mjs';import {stockLast} from './core/core.mjs';import {buildSearchIndex,createIndexRetriever} from './core/search-index.mjs';
// Regressions from the Steimatzky search repair report (2026-10-15).
const client={tenantId:'t',domain:'books',productTypes:{},colors:{},finishes:{},tagDefinitions:{},queryAliases:{},version:'1'};
const book=(id,title,description='',author='')=>({id,tenantId:'t',title,description,categories:[],tags:[],colors:[],finishes:[],stockStatus:'instock',hidden:false,price:80,specifications:author?{author}:{}});
const service=(products,generate,opts={})=>createSearchService(products,client,generate,{lightweightRouter:false,expansion:'sparse',expandBelow:8,retrieve:createIndexRetriever(products,client,buildSearchIndex(products,'1')),...opts});
const plan=(requirements,terms=[])=>({intent:'ספר',categories:[],terms,requirements,minPrice:null,maxPrice:null,colors:[],finishes:[],tags:[],clarification:''});

test('words that exist but never together are not answered as a spelling fix',async()=>{
 const products=[book('1','EAST OF THE SUN'),book('2','EAST EVEN STEVEN'),book('3','של עכברים ואנשים','','ג’ון סטיינבק'),book('4','GARDEN EDEN')];
 const literal=createIndexRetriever(products,client,buildSearchIndex(products,'1'))('east eden');
 assert.ok(literal.corrections.some(c=>c.relaxed),'the retriever marks the relaxed real word');
 const stages=[];const search=service(products,async({stage,prompt})=>{stages.push(stage);if(stage==='interpret')return {data:plan(['הספר East of Eden'],['ג\'ון סטיינבק'])};if(prompt.startsWith('Choose the closest'))return {data:{matches:[{id:'3',reason:'אותו סופר',missing:['הספר עצמו']}]}};return {data:{matches:[]}};});
 const r=await search({query:'east eden'});
 assert.notEqual(r.metadata.phase,'spelling');assert.deepEqual(stages,['interpret','select','select']);
 assert.equal(r.metadata.phase,'closest-alternatives');assert.deepEqual(r.matches.map(m=>m.id),['3']);
});
test('the author hint ranks that author into the alternatives the model reads',async()=>{
 const products=[...Array.from({length:60},(_,i)=>book('x'+i,'EAST WIND '+i)),book('s','של עכברים ואנשים','','ג’ון סטיינבק')];
 let read=null;const search=service(products,async({stage,prompt})=>{if(stage==='interpret')return {data:plan(['הספר East of Eden'],['ג\'ון סטיינבק'])};if(prompt.startsWith('Choose the closest')){read=prompt;return {data:{matches:[]}};}return {data:{matches:[]}};},{selectCandidates:10});
 await search({query:'east of eden'});assert.ok(read.includes('של עכברים ואנשים'));
});
test('a description-only literal match the model rejected is dropped; a title match stays first',async()=>{
 const products=[book('blurb','IRRESISTIBLE URGE','perfect for fans of The Love Hypothesis'),book('he','ההיפותזה של האהבה','','אלי הייזלווד')];
 const search=service(products,async({stage,prompt})=>{if(stage==='interpret')return {data:plan(['הספר The Love Hypothesis'],['ההיפותזה של האהבה'])};
  const data=JSON.parse(prompt.slice(prompt.lastIndexOf('DATA ')+5));assert.ok(data.candidates.some(c=>c.id==='blurb'),'the literal match is judged');
  return {data:{matches:[{id:'he',evidence:[{requirement:0,field:'title',quote:'ההיפותזה של האהבה'}]}]}};});
 const r=await search({query:'the love hypothesis'});assert.deepEqual(r.matches.map(m=>m.id),['he']);
 const titled=[book('a','ילדה טובה דם רע'),book('b','קיפאון עמוק','דם רע בעיר')];
 const s2=service(titled,async({stage})=>stage==='interpret'?{data:plan(['הספר דם רע'])}:{data:{matches:[]}});
 assert.deepEqual((await s2({query:'דם רע'})).matches.map(m=>m.id),['a']);
});
test('a bare name with no requirement from the model is searched for, not failed; an empty provider answer is retried once',async()=>{
 const products=[book('1','נפץ אותי','','טהרה מאפי'),book('2','ספר אחר')];let calls=0;
 const search=service(products,async({stage})=>{calls++;if(stage==='interpret')return {data:{...plan([]),terms:['נפץ אותי']}};if(calls===2)throw Error('Search/model returned no output (STOP)');return {data:{matches:[{id:'1',evidence:[{requirement:0,field:'title',quote:'נפץ אותי'}]}]}};},{expansion:'always'});
 const r=await search({query:'נפץ אותי'});assert.equal(r.metadata.failureReason,undefined);assert.equal(r.matches[0].id,'1');assert.deepEqual(r.metadata.requirements,['נפץ אותי']);assert.equal(calls,3);
});
test('a query naming an author puts that author\'s books first; one word must be the whole name',()=>{
 const products=[{...book('blurb','הצחוק','חיים של ילד נבון ושנון'),popularity:900},book('a1','חוה לא אכלה תפוח','','חיים נבון'),book('a2','תתיישנו','','ערך נבון חיים'),{...book('e1','עמנואל 3'),popularity:50},book('e2','יוגה','','עמנואל קארר')];
 const r=createIndexRetriever(products,client,buildSearchIndex(products,'1'));
 assert.deepEqual(r('חיים נבון').matches.map(p=>p.id).slice(0,2).sort(),['a1','a2']);assert.equal(r('חיים נבון').matches.at(-1).id,'blurb');
 assert.deepEqual(r('נבון חיים').matches.map(p=>p.id).slice(0,2).sort(),['a1','a2']);
 assert.equal(r('עמנואל').matches[0].id,'e1','a first name alone does not lift every author who has it');
});
test('with out-of-stock last, the named author\'s sold-out books still come before unrelated in-stock ones',()=>{
 const rows=[{...book('x','הצחוק'),stockStatus:'instock'},{...book('a','הגדר הטובה','','חיים נבון'),stockStatus:'outofstock'},{...book('b','תתיישנו','','חיים נבון')}];
 assert.deepEqual(stockLast(rows,'חיים נבון').map(p=>p.id),['b','a','x']);
});
