import {test} from 'node:test';import assert from 'node:assert/strict';
import {existingProject} from './existing-client.mjs';import {createIndexRetriever,boundedDistance,resolveTerm} from './core/search-index.mjs';
const books=[{id:'1',name:'הארי פוטר ואבן החכמים',description:'ספר פנטזיה',isbn:'9789650712345',stockStatus:'instock'},{id:'2',name:'ספרים לילדים',description:'אוסף',stockStatus:'instock'},{id:'3',name:'Harry Potter and the Chamber of Secrets',description:'fantasy novel',stockStatus:'instock'},{id:'4',name:'ספרה',description:'תקליט',stockStatus:'instock'}];
const setup=()=>{const p=existingProject('books',{dbName:'books'},books);return {index:p.searchIndex,find:createIndexRetriever(p.productCards,{...p.revisions[0].profile,tenantId:p.id},p.searchIndex)};};
const ids=r=>r.matches.map(m=>m.id);
test('bounded distance stops early and matches full distance within the bound',()=>{assert.equal(boundedDistance('פוטר','פטור',2),2);assert.equal(boundedDistance('abcdef','uvwxyz',1),2);assert.equal(boundedDistance('potter','poter',1),1);});
test('exact terms are never broadened by fuzzy; the plural of the same word counts, after the exact form',()=>{const {find}=setup();const r=find('ספר');assert.deepEqual(ids(r),['1','2']);assert.equal(r.corrections,undefined);assert.deepEqual(ids(find('ספרים')),['2','1']);});
test('a typo in one word of several is corrected per term',()=>{const {find}=setup();const r=find('הארי פוטטר');assert.deepEqual(ids(r),['1']);assert.equal(r.corrections[0].kind,'fuzzy');assert.deepEqual(r.corrections[0].to,['פוטר']);assert.deepEqual(ids(find('harry poter')),['3']);});
test('long words allow two edits, short words none',()=>{const {find}=setup();assert.deepEqual(ids(find('fantasyy novell')),['3']);assert.equal(find('פטר').total,0);});
test('Hebrew prefixes are stripped before fuzzy is attempted',()=>{const {find,index}=setup();const r=find('והספרים');assert.deepEqual(ids(r),['2']);assert.deepEqual(r.corrections[0],{term:'והספרים',kind:'prefix',to:['ספרים']});assert.equal(resolveTerm(index,'ספר').kind,'exact');});
test('diagnosis explains a missing combination and a scoped-only capture',()=>{
 const p=existingProject('books',{dbName:'books'},[{id:'1',name:'תפוח',stockStatus:'instock'},{id:'2',name:'בננה',stockStatus:'instock'},{id:'3',name:'מארז',stockStatus:'outofstock'}]);
 const bare=createIndexRetriever(p.productCards,{...p.revisions[0].profile,tenantId:p.id},p.searchIndex);
 const empty=bare('תפוח בננה');assert.equal(empty.total,0);assert.equal(empty.plan.why.kind,'no-intersection');assert.deepEqual(empty.plan.termHits.map(t=>t.term+':'+t.exact),['תפוח:1','בננה:1']);
 const captured=createIndexRetriever(p.productCards,{...p.revisions[0].profile,tenantId:p.id,scopedAliases:[{id:'a',term:'מארז מיוחד',productIds:['3']}]},p.searchIndex)('מארז מיוחד');
 assert.equal(captured.total,0);assert.equal(captured.plan.why.kind,'scoped-only');
});
test('a rare real word does not block correcting the combination (מאיר שליו)',()=>{
 const p=existingProject('books',{dbName:'books'},[{id:'1',name:'אבא עושה בושות',author:'מאיר שלו',stockStatus:'instock'},{id:'2',name:'גיבורים',description:'אב לנועם, שליו ולירי',stockStatus:'instock'},{id:'3',name:'יומן',author:'מאיר אריאל',stockStatus:'instock'}]);
 const find=q=>createIndexRetriever(p.productCards,{...p.revisions[0].profile,tenantId:p.id},p.searchIndex)(q);
 const r=find('מאיר שליו');assert.deepEqual(ids(r),['1']);assert.ok(r.corrections[0].to.includes('שלו'));assert.deepEqual(ids(find('שליו')),['2']);
});
test('multi-word spelling aliases apply as a phrase before scoped aliases',async()=>{
 const {planQuery}=await import('./core/core.mjs');
 const plan=planQuery('ספרי מאיר שליו',{productTypes:{},colors:{},finishes:{},queryAliases:{'מאיר שליו':'מאיר שלו'},scopedAliases:[{term:'מאיר שליו',productIds:['x']}]});
 assert.deepEqual(plan.terms,['ספרי','מאיר','שלו']);assert.equal(plan.scopedProductIds,undefined);assert.equal(plan.spelling.to,'ספרי מאיר שלו');
});
test('identifiers and digit tokens stay exact',()=>{const {find}=setup();assert.deepEqual(ids(find('9789650712345')),['1']);assert.equal(find('9789650712346').total,0);});
test('quotation marks collapse to the same word and title matches rank first',()=>{
 const p=existingProject('books',{dbName:'books'},[{id:'0',name:'סיפור אחר',description:'אזכור תנ״ך',stockStatus:'instock'},{id:'1',name:'תנ"ך מהדורת המעלות',stockStatus:'instock'},{id:'2',name:'תנ”ך קורן',stockStatus:'instock'}]);
 const find=q=>createIndexRetriever(p.productCards,{...p.revisions[0].profile,tenantId:p.id},p.searchIndex)(q);
 assert.deepEqual(ids(find('תנך')),['1','2','0']);
 assert.deepEqual(ids(find('תנ״ך')),['1','2','0']);
 assert.deepEqual(ids(find('תנ׳׳ך')),['1','2','0']);
 assert.equal(find('תנך').plan.terms.join(' '),'תנך');
});
