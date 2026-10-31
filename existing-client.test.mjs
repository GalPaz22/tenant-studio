import {test} from 'node:test';import assert from 'node:assert/strict';import {existingProject,loadExistingClient,resolveExistingUser,applyLiveRows} from './existing-client.mjs';
test('existing client preserves stored categories and tags without leaking user credentials',()=>{const p=existingProject('demo',{dbName:'demo',apiKey:'SECRET',credentials:{password:'SECRET'}},[{id:1,name:'כוס',categories:[{name:'כוסות'}],tags:[{name:'זכוכית'}],category:['שתייה'],stock_status:'instock',status:'publish',price:'12.5',permalink:'https://example.com/cup'},{id:2,name:'hidden',hidden:true,price:null}]);assert.deepEqual(p.existingClient.tags,['זכוכית','שתייה']);assert.deepEqual(p.productCards[0].tags,['זכוכית','שתייה']);assert.equal(p.productCards[0].price,12.5);assert.equal(p.productCards[1].hidden,true);assert.equal(p.productCards[1].price,null);assert.ok(!JSON.stringify(p).includes('SECRET'));assert.equal(p.revisions.length,1);assert.equal(p.catalog.products.length,2);assert.ok(!p.tagging);});
test('username inputs reject operator objects',async()=>{await assert.rejects(()=>loadExistingClient({$ne:null}));});

test('client resolution supports stored name and refuses ambiguous database mappings',async()=>{
 const rows=[{name:'steimatzky',dbName:'steimatzky'},{name:'Other',dbName:'steimatzky'}];
 const collection={find(query){return {limit(){return {async toArray(){return rows.filter(r=>Object.entries(query).every(([k,v])=>r[k]===v));}}}}}};
 assert.equal((await resolveExistingUser(collection,'steimatzky')).name,'steimatzky');
 rows[0].name='First';await assert.rejects(()=>resolveExistingUser(collection,'steimatzky'),/כמה לקוחות/);
 assert.equal(await resolveExistingUser(collection,'missing'),null);
});
test('ambiguous client names list the candidates and a pick resolves to that exact user',async()=>{
 const rows=[{_id:'aaaaaaaaaaaaaaaaaaaaaaa1',username:'manoVino',name:'Mano Vino',dbName:'manovino',platform:'woocommerce',apiKey:'SECRET'},{_id:'aaaaaaaaaaaaaaaaaaaaaaa2',username:'manoVino',name:'Mano staff',dbName:'manovino-old'}];
 const collection={find(query){return {limit(){return {async toArray(){return rows.filter(r=>Object.entries(query).every(([k,v])=>r[k]===v));}}}}}};
 const err=await resolveExistingUser(collection,'manoVino').catch(e=>e);
 assert.equal(err.code,'AMBIGUOUS');
 assert.deepEqual(err.candidates,[{userId:'aaaaaaaaaaaaaaaaaaaaaaa1',username:'manoVino',name:'Mano Vino',dbName:'manovino',platform:'woocommerce'},{userId:'aaaaaaaaaaaaaaaaaaaaaaa2',username:'manoVino',name:'Mano staff',dbName:'manovino-old',platform:null}]);
 assert.ok(!JSON.stringify(err.candidates).includes('SECRET'),'no keys in the candidate list');
 assert.equal((await resolveExistingUser(collection,'manoVino',{userId:'aaaaaaaaaaaaaaaaaaaaaaa2'})).dbName,'manovino-old');
 // A pick must belong to what was typed.
 assert.equal(await resolveExistingUser(collection,'other',{userId:'aaaaaaaaaaaaaaaaaaaaaaa1'}),null);
 await assert.rejects(()=>loadExistingClient('manoVino',{userId:'x'}),/בחירת לקוח/);
});
test('author and publisher survive import as searchable source specifications',()=>{const p=existingProject('books',{dbName:'books'},[{id:'1',name:'ספר',author:'מאיר שלו',publisher:'עם עובד',specifications:{pages:'200'},stockStatus:'instock'}]);assert.equal(p.productCards[0].specifications.author,'מאיר שלו');assert.equal(p.productCards[0].specifications.publisher,'עם עובד');assert.equal(p.productCards[0].specifications.pages,'200');assert.ok(p.searchIndex.terms['מאיר'].includes('1'));});
test('live rows refresh stock, price and visibility like production, add new products and hide removed ones',()=>{
 const p=existingProject('books',{dbName:'books'},[{id:'online:1',name:'ספר א',price:50,stockStatus:'outofstock'},{id:'online:2',name:'ספר ב',price:40,stockStatus:'instock'},{id:'online:3',name:'ספר ג',price:30,stockStatus:'instock'}]);
 p.productCards[0].tags=['enriched'];
 const r=applyLiveRows(p,[{id:'online:1',name:'ספר א',price:45,stockStatus:'instock'},{id:'online:2',name:'ספר ב',price:null,stockStatus:'outofstock'},{id:'online:4',name:'ספר חדש',price:20,stockStatus:'instock'}],new Date('2026-10-18T00:00:00Z'));
 const byId=id=>p.catalog.products.find(x=>x.id===id);
 assert.equal(byId('online:1').stockStatus,'instock');assert.equal(byId('online:1').price,45);assert.equal(p.productCards[0].stockStatus,'instock');assert.deepEqual(p.productCards[0].tags,['enriched']);
 assert.equal(byId('online:2').hidden,true,'out of stock without a price is retired, as in production');
 assert.equal(byId('online:3').hidden,true,'gone from the store');assert.equal(byId('online:4').name,'ספר חדש');
 assert.deepEqual({...r,at:undefined},{at:undefined,rows:3,changed:2,stockChanged:2,priceChanged:1,added:1,gone:1});
 assert.equal(p.existingClient.liveFields.at,'2026-10-18T00:00:00.000Z');assert.equal(p.catalog.coverage.count,4);
});
test('WooCommerce\'s isWooPopular flag is imported as a tag and kept current by the live refresh',()=>{
 const p=existingProject('shop',{dbName:'shop'},[{id:'1',name:'כיסוי א',price:50,stockStatus:'instock',isWooPopular:true},{id:'2',name:'כיסוי ב',price:40,stockStatus:'instock',isWooPopular:false}]);
 assert.deepEqual(p.productCards.map(c=>c.tags.includes('isWooPopular')),[true,false]);
 p.productCards[0].tags.push('enriched');
 const r=applyLiveRows(p,[{id:'1',name:'כיסוי א',price:50,stockStatus:'instock',isWooPopular:false},{id:'2',name:'כיסוי ב',price:40,stockStatus:'instock',isWooPopular:true}]);
 assert.deepEqual(p.productCards.map(c=>c.tags),[['enriched'],['isWooPopular']]);
 assert.deepEqual(p.catalog.products.map(x=>x.tags),[[],['isWooPopular']]);
 assert.equal(r.changed,2);
 applyLiveRows(p,[{id:'1',name:'כיסוי א',price:50,stockStatus:'instock',total_sales:12},{id:'2',name:'כיסוי ב',price:40,stockStatus:'instock',isWooPopular:true,total_sales:40}]);
 assert.deepEqual(p.productCards.map(c=>c.popularity),[12,40],'sales order the products');
});
