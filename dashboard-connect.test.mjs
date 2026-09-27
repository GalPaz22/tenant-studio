import {test} from 'node:test';
import assert from 'node:assert/strict';
import {connectToDashboard,syncProductsToDashboard,productDocs,suggestNames} from './core/dashboard-connect.mjs';

// The driver calls the connector makes, over plain arrays per database/collection.
function fakeClient(seed={}){
 const dbs=new Map(Object.entries(seed).map(([db,cols])=>[db,new Map(Object.entries(cols).map(([c,docs])=>[c,docs.map(d=>({...d}))]))]));
 const match=(d,f)=>Object.entries(f).every(([k,v])=>k==='$or'?v.some(x=>match(d,x)):v&&typeof v==='object'&&'$nin' in v?!v.$nin.includes(d[k]):k.split('.').reduce((o,x)=>o?.[x],d)===v);
 const col=(db,name)=>{if(!dbs.has(db))dbs.set(db,new Map());const m=dbs.get(db);if(!m.has(name))m.set(name,[]);const docs=m.get(name);return {
  findOne:async f=>docs.find(d=>match(d,f))??null,insertOne:async d=>{docs.push(d);},estimatedDocumentCount:async()=>docs.length,countDocuments:async(f={})=>docs.filter(d=>match(d,f)).length,createIndex:async()=>{},
  bulkWrite:async ops=>{for(const {updateOne:{filter,update}} of ops){const hit=docs.find(d=>match(d,filter));if(hit)Object.assign(hit,update.$set);else docs.push({...update.$set});}}};};
 return {dbs,db:name=>({collection:c=>col(name,c)})};
}
const project=()=>({id:'11111111-2222',name:'Fox Home',url:'https://www.foxhome.co.il/',platform:'shopify',storeContext:{summary:'כלי בית'},
 catalog:{products:[{id:'8353640054934',name:'קופסה',description:'<p>קופסה</p>',images:['https://cdn/a.jpg','https://cdn/b.jpg']}]},
 productCards:[{id:'8353640054934',title:'קופסת אחסון',description:'קופסה מועשרת',price:74.9,regularPrice:99.9,stockStatus:'instock',categories:['ארגונית'],tags:['חדש','__label:x'],productType:'ארגונית',colors:['שקוף'],image:'https://cdn/a.jpg',url:'https://www.foxhome.co.il/products/1',specifications:{חומר:'פלסטיק'}},
  {id:'abc-slug',title:'מגש',price:20,stockStatus:'outofstock',categories:[],hidden:true}]});

test('a URL-onboarded store becomes a dashboard client in the existing schema, without overwriting anyone',async()=>{
 assert.deepEqual(suggestNames(project()),{username:'foxhome',dbName:'foxhome'});
 const [box,tray]=productDocs(project());
 assert.equal(box.id,8353640054934,'numeric source ids stay numbers, as the sync writes them');
 assert.deepEqual([box.price,box.regular_price,box.sale_price,box.onSale,box.stockStatus,box.stock_status],[74.9,99.9,74.9,true,'instock','instock']);
 assert.deepEqual(box.categories,[{name:'ארגונית'}]);assert.deepEqual(box.tags,[{name:'חדש'}],'internal labels stay in the studio');
 assert.deepEqual(box.images,[{src:'https://cdn/a.jpg'},{src:'https://cdn/b.jpg'}]);assert.deepEqual([box.category,box.type,box.colors],[['ארגונית'],['ארגונית'],['שקוף']]);
 assert.deepEqual([tray.id,tray.status,tray.sale_price],['abc-slug','private',null]);

 const client=fakeClient({users:{users:[{username:'garmin',dbName:'garmin',apiKey:'k'}]},taken:{products:[{id:1}]}});
 await assert.rejects(connectToDashboard(project(),{username:'garmin',dbName:'foxhome',client}),/כבר קיים/);
 await assert.rejects(connectToDashboard(project(),{username:'fox',dbName:'garmin',client}),/שייך ללקוח אחר/);
 await assert.rejects(connectToDashboard(project(),{username:'fox',dbName:'taken',client}),/כבר יש מוצרים/);
 await assert.rejects(connectToDashboard(project(),{username:'fox',dbName:'Bad Name',client}),/שם מסד/);
 await assert.rejects(connectToDashboard({...project(),existingClient:{dbName:'x'}},{username:'fox',dbName:'fox',client}),/כבר מחובר/);

 const r=await connectToDashboard(project(),{username:'foxhome',dbName:'foxhome',email:'owner@fox.co.il',client});
 assert.equal(r.products,2);assert.match(r.apiKey,/^[0-9a-f]{64}$/);
 const user=client.dbs.get('users').get('users').at(-1);
 assert.deepEqual([user.username,user.dbName,user.apiKey,user.platform,user.shopifyDomain,user.onboardingComplete,user.credentials.dbName,user.collections.products,user.email],
  ['foxhome','foxhome',r.apiKey,'shopify','www.foxhome.co.il',true,'foxhome','products','owner@fox.co.il']);
 assert.equal(user.semantix,undefined,'the production switch stays off until the operator turns it on');

 const p={...project(),existingClient:{dbName:'foxhome',createdByStudio:true}};p.productCards[0].price=60;p.productCards=p.productCards.slice(0,1);
 const s=await syncProductsToDashboard(p,{client});assert.deepEqual(s,{products:1,notInStudio:1});
 assert.equal(client.dbs.get('foxhome').get('products').find(d=>d.id===8353640054934).price,60,'sync updates in place');
 await assert.rejects(syncProductsToDashboard({...p,existingClient:{dbName:'garmin'}},{client}),/רק ללקוח שהסטודיו חיבר/,'a real client’s catalog is never written by the studio');
});
