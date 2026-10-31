import {test} from 'node:test';
import assert from 'node:assert/strict';
import {typeFromTitle,processProduct} from './core/core.mjs';

const types={'מזוודה':{categories:[],queryAliases:['מזוודה','מזוודות']},'תג מזוודה':{categories:[],queryAliases:['תג מזוודה']},'מנעול':{categories:['מנעולים'],queryAliases:['מנעול']},
 'שק שינה':{categories:[],queryAliases:['שק שינה']},'תרמיל':{categories:[],queryAliases:['תרמיל',"מוצ'ילה","תיק מוצ'ילה"]}};

test('a product with no categories is typed by the noun that heads its title',()=>{
 assert.equal(typeFromTitle('סט מזוודות JULIA | קשיחות | 3 גדלים',types),'מזוודה','a leading "סט" is skipped');
 assert.equal(typeFromTitle('תג מזוודה | אלומניום 268',types),'תג מזוודה','the longest alias wins');
 assert.equal(typeFromTitle('מנעול קוד למזוודה | 3 ספרות',types),'מנעול','the head noun, not a later mention');
 assert.equal(typeFromTitle('משקל מזוודות דיגיטלי',types),null,'a scale is not a suitcase');
 assert.equal(typeFromTitle('Deuter Dreamlite 500 שק שינה',types),'שק שינה','Latin brand/model words are skipped');
 assert.equal(typeFromTitle('תיק מוצ׳ילה | 36 ליטר',types),'תרמיל','a Hebrew geresh in the title meets an apostrophe in the alias');
});

test('title typing is only a fallback for products without categories',()=>{
 const client={tenantId:'t',version:'v',productTypes:types,colors:{},finishes:{},badgeCandidates:{},publishedStatuses:['publish']};
 const p=(raw)=>processProduct({id:'1',status:'publish',url:'https://s.co.il/1',...raw},client);
 assert.deepEqual([p({name:'סט מזוודות JULIA'}).productType,p({name:'סט מזוודות JULIA'}).provenance.productType],['מזוודה','title']);
 assert.equal(p({name:'סט מזוודות JULIA',categories:['נסיעות']}).productType,null,'a categorized product keeps the category rule');
 assert.equal(p({name:'משהו',categories:['מנעולים']}).productType,'מנעול');
});

test('typeFrom "title": the title head decides over overlapping categories; titleAliases type but never filter',async()=>{
 const {planQuery}=await import('./core/core.mjs');
 const kinds={'כיסויים':{categories:['כיסויים וארנקים'],queryAliases:['כיסוי','מגן']},'מגני מסך':{categories:['מגני מסך'],queryAliases:['מגן מסך']},
  'מטענים':{categories:['מטענים'],queryAliases:['מטען'],titleAliases:['ראש מטען']}};
 const client={tenantId:'t',version:'v',productTypes:kinds,typeFrom:'title',colors:{},finishes:{},badgeCandidates:{},publishedStatuses:['publish']};
 const p=(name,categories)=>processProduct({id:'1',status:'publish',url:'https://s.co.il/1',name,categories},client);
 assert.equal(p('כיסוי לאייפון 17 שקוף',['כיסויים וארנקים','מגני מסך']).productType,'כיסויים');
 assert.equal(p('מגן מסך לאייפון 17',['כיסויים וארנקים','מגני מסך']).productType,'מגני מסך','the longest head alias wins');
 assert.equal(p('ראש מטען 25W',['כיסויים וארנקים']).productType,'מטענים','a title alias types the product');
 assert.equal(p('מחזיק מפתחות',['מגני מסך']).productType,'מגני מסך','no type in the title: the categories decide');
 assert.equal(planQuery('ראש מטען',client).productType,'מטענים','the query is filtered by "מטען"');
 assert.deepEqual(planQuery('ראש מטען',client).terms,['ראש'],'"ראש" stays a word to match');
 const devices={...kinds,'טלפונים':{categories:[],queryAliases:['טלפון']},'מעמדים':{categories:[],queryAliases:['מעמד']}};
 assert.equal(planQuery('מעמד טלפון',{...client,productTypes:devices}).productType,'מעמדים','the head noun names the kind');
 assert.equal(planQuery('מגן מסך לאייפון',{...client,productTypes:devices}).productType,'מגני מסך','longest alias at the head');
 assert.equal(planQuery('מעמד טלפון',{...client,productTypes:devices,typeFrom:undefined}).productType,'טלפונים','default: the longest alias');
 assert.equal(processProduct({id:'1',status:'publish',url:'https://s.co.il/1',name:'כיסוי',categories:['מגני מסך']},{...client,typeFrom:undefined}).productType,'מגני מסך','default: categories first');
});

test('saved cards without a type get the type their title gives, while the profile is unchanged',async()=>{
 const {createDraftRuntime}=await import('./runtime.mjs'),{hash}=await import('./core/catalog.mjs');
 const profile={name:'Store',domain:'travel',productTypes:types,colors:{},finishes:{},queryAliases:{},tagDefinitions:{},badgeCandidates:{categories:[],tags:[]},badgeRules:[],pipeline:{maxCandidates:20,lightweightRouter:false}};
 const p={id:'t',url:'https://s.co.il',platform:'magento',messages:[],revisions:[{number:1,profile}],catalog:{products:[
  {id:'1',name:'סט מזוודות JULIA',categories:[],tags:[],stockStatus:'instock',status:'ACTIVE'},
  {id:'2',name:'מנעול קוד',categories:['מנעולים'],tags:[],stockStatus:'instock',status:'ACTIVE'},
  {id:'3',name:'משקל מזוודות',categories:[],tags:[],stockStatus:'instock',status:'ACTIVE'}]}};
 // Cards as saved before title typing: no types at all.
 const stale=createDraftRuntime(p,p.revisions[0]).products.map(c=>({...c,productType:c.categories.length?c.productType:null}));
 const rt=createDraftRuntime({...p,productCards:stale,productCardsProfileHash:hash(profile)},p.revisions[0]);
 assert.deepEqual(rt.products.map(c=>c.productType),['מזוודה','מנעול',null]);
 assert.equal(rt.products[0].provenance.productType,'title');
 assert.equal(stale[0].productType,null,'the saved cards are not changed in place');
});
