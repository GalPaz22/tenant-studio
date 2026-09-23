import {test} from 'node:test';import assert from 'node:assert/strict';import {existingProject,loadExistingClient,resolveExistingUser} from './existing-client.mjs';
test('existing client preserves stored categories and tags without leaking user credentials',()=>{const p=existingProject('demo',{dbName:'demo',apiKey:'SECRET',credentials:{password:'SECRET'}},[{id:1,name:'כוס',categories:[{name:'כוסות'}],tags:[{name:'זכוכית'}],category:['שתייה'],stock_status:'instock',status:'publish',price:'12.5',permalink:'https://example.com/cup'},{id:2,name:'hidden',hidden:true,price:null}]);assert.deepEqual(p.existingClient.tags,['זכוכית','שתייה']);assert.deepEqual(p.productCards[0].tags,['זכוכית','שתייה']);assert.equal(p.productCards[0].price,12.5);assert.equal(p.productCards[1].hidden,true);assert.equal(p.productCards[1].price,null);assert.ok(!JSON.stringify(p).includes('SECRET'));assert.equal(p.revisions.length,1);assert.equal(p.catalog.products.length,2);assert.ok(!p.tagging);});
test('username inputs reject operator objects',async()=>{await assert.rejects(()=>loadExistingClient({$ne:null}));});

test('client resolution supports stored name and refuses ambiguous database mappings',async()=>{
 const rows=[{name:'steimatzky',dbName:'steimatzky'},{name:'Other',dbName:'steimatzky'}];
 const collection={find(query){return {limit(){return {async toArray(){return rows.filter(r=>Object.entries(query).every(([k,v])=>r[k]===v));}}}}}};
 assert.equal((await resolveExistingUser(collection,'steimatzky')).name,'steimatzky');
 rows[0].name='First';await assert.rejects(()=>resolveExistingUser(collection,'steimatzky'),/כמה לקוחות/);
 assert.equal(await resolveExistingUser(collection,'missing'),null);
});
test('author and publisher survive import as searchable source specifications',()=>{const p=existingProject('books',{dbName:'books'},[{id:'1',name:'ספר',author:'מאיר שלו',publisher:'עם עובד',specifications:{pages:'200'},stockStatus:'instock'}]);assert.equal(p.productCards[0].specifications.author,'מאיר שלו');assert.equal(p.productCards[0].specifications.publisher,'עם עובד');assert.equal(p.productCards[0].specifications.pages,'200');assert.ok(p.searchIndex.terms['מאיר'].includes('1'));});
