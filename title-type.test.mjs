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
