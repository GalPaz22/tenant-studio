import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyticsOptions,summarizeCustomer,readCustomerAnalytics} from './core/customer-analytics.mjs';
const stamp=h=>`2026-09-20T${String(h).padStart(2,'0')}:00:00Z`;
const opts=analyticsOptions({from:stamp(0),to:'2026-09-21',minSearches:1},Date.parse('2026-09-22'));
const q=(query,s,h)=>({query,session_id:s,timestamp:stamp(h)});
const order=(id,s,h,extra={})=>({order_id:id,session_id:s,timestamp:stamp(h),event_type:'checkout_completed',...extra});
test('conversion uses searched sessions, last preceding search, completed orders and deduplicates retries',()=>{
 const r=summarizeCustomer({queries:[q('Watch','a',1),q('watch','a',2),q('band','a',3),q('Watch','b',1)],
  purchases:[order('1','a',4),order('1','a',4),order('2','b',2,{search_query:'watch'}),order('3','untracked',2),order('4','b',0,{search_query:'watch'}),order('5','b',2,{event_type:'checkout_initiated'})]},opts);
 assert.equal(r.totals.purchases,4);assert.equal(r.totals.duplicateOrders,1);assert.equal(r.totals.unattributedPurchases,1);
 const watch=r.queries.find(q=>q.query==='watch'),band=r.queries.find(q=>q.query==='band');
 assert.equal(watch.searches,3);assert.equal(watch.searchSessions,2);assert.equal(watch.purchaseRate,.5);assert.equal(band.inferredPurchases,1);assert.equal(band.purchaseRate,1);
 assert.ok(!JSON.stringify(r).includes('untracked'));
});
test('missing sessions and partial data cannot produce conversion rates; future events excluded',()=>{
 const data={queries:[{query:'watch',timestamp:stamp(1)}],purchases:[order('a','x',2),{...order('future','x',3),timestamp:'2027-01-01'}]};
 let r=summarizeCustomer(data,{...opts,sort:'searches'});assert.equal(r.queries[0].purchaseRate,null);assert.equal(r.totals.purchases,1);
 r=summarizeCustomer({queries:[q('watch','a',1)]},opts,{sources:{queries:{status:'ok'},checkout_events:{status:'unavailable'}}});assert.equal(r.complete,false);assert.equal(r.queries.length,0);assert.ok(r.warnings.length);
});
test('date windows, input validation, order webhook shape and query drilldown',()=>{
 assert.throws(()=>analyticsOptions({days:91}));assert.throws(()=>analyticsOptions({from:'invalid'}));assert.throws(()=>analyticsOptions({sort:'$where'}));
 const r=summarizeCustomer({queries:[q('watch','a',1)],purchases:[{order_id:1,created_at:stamp(2),session_id:'a',line_items:[{product_id:'p'}],shopify_data:{financial_status:'paid'}},{order_id:2,created_at:stamp(2),line_items:[],shopify_data:{financial_status:'pending'}}]}, {...opts,query:'watch'},{cards:[{id:'p',title:'Watch',stockStatus:'instock'}]});
 assert.equal(r.totals.purchases,1);assert.equal(r.products[0].available,true);assert.equal(r.products[0].title,'Watch');
});
test('database is pinned to project, projections omit customer data, failures are visible',async()=>{
 const visited=[];const client={db(name){assert.equal(name,'tenant-only');return {collection(name){return {aggregate(pipeline){visited.push({name,pipeline});return {async toArray(){if(name==='checkout_events')throw Error('private connection detail');return [];}};}};}};}};
 const r=await readCustomerAnalytics({existingClient:{dbName:'tenant-only'}},{days:7},{client});assert.equal(r.sources.checkout_events.status,'unavailable');assert.equal(r.complete,false);assert.equal(visited.length,6);
 for(const v of visited){assert.equal(v.pipeline.at(-1).$project.customer,undefined);assert.ok(v.pipeline[0].$match.$expr);}
 assert.ok(!JSON.stringify(r).includes('private connection'));
});
test('no purchase attribution evidence is unknown conversion, not a zero-conversion ranking',()=>{
 const r=summarizeCustomer({queries:[q('watch','a',1)],carts:[{search_query:'watch',session_id:'a',timestamp:stamp(2)}]},opts);
 assert.equal(r.queries.length,0);assert.equal(r.purchaseTrackingEvidence,false);assert.ok(r.warnings.length);
});
test('recorded revenue separates currencies and does not double count orders',()=>{
 const r=summarizeCustomer({purchases:[order('1','a',1,{total_price:100,currency:'ILS'}),order('1','a',1,{total_price:100,currency:'ILS'}),order('2','b',1,{total_price:20,currency:'USD'}),order('3','c',1)]},opts);
 assert.deepEqual(r.recordedOrderRevenue,[{currency:'ILS',amount:100,orders:1},{currency:'USD',amount:20,orders:1}]);
});
