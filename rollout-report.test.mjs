import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarizeRollout,compare,reportOptions,readRolloutReport} from './core/rollout-report.mjs';
import {PIXEL_SOURCE,buildShopifyTakeover,buildWooTakeover} from './core/takeover-export.mjs';

const T='2026-10-04T12:00:00Z',opts={from:'2026-10-01T00:00:00Z',to:'2026-10-08T00:00:00Z',days:7};
const ex=(s,g,at=T)=>({event_type:'ab_exposure',session_id:s,ab_tests:{semantix_takeover:g},timestamp:at});

test('every event is counted in its visitor group, and conversion is measured among searchers',()=>{
 const exposures=[...['a1','a2','a3','a4'].map(s=>ex(s,'semantix')),...['b1','b2','b3','b4'].map(s=>ex(s,'native')),ex('old','semantix','2026-09-01T00:00:00Z'),
  ex('moved','native','2026-10-02T00:00:00Z'),ex('moved','semantix','2026-10-03T00:00:00Z')];
 const q=(s,at=T)=>({query:'כוס',session_id:s,timestamp:at});
 const data={exposures,
  queries:[q('a1'),q('a1'),q('a2'),q('a3'),q('b1'),q('b2'),q('stranger'),{query:'x',timestamp:T},q('a1','2026-09-01T00:00:00Z')],
  clicks:[{session_id:'a1',timestamp:T},{session_id:'a2',timestamp:T},{session_id:'b1',timestamp:T},{sessionId:'a4',timestamp:T}],
  carts:[{event_type:'add_to_cart',session_id:'a1',timestamp:T},{event_type:'add_to_cart',session_id:'b1',timestamp:T},{event_type:'add_to_cart',session_id:'late',ab_tests:{semantix_takeover:'native'},timestamp:T}],
  checkouts:[
   {event_type:'checkout_initiated',session_id:'a1',timestamp:T},
   {event_type:'checkout_completed',session_id:'a1',order_id:'100',total_price:200,currency:'ILS',timestamp:T},
   {event_type:'checkout_completed',session_id:'a1',order_id:'100',total_price:200,timestamp:T},          // the same order reported twice
   {event_type:'checkout_completed',session_id:'a4',order_id:'101',total_price:50,timestamp:T},           // bought without searching
   {event_type:'checkout_completed',session_id:'b3',order_id:'102',total_price:80,timestamp:T},
   {event_type:'checkout_completed',session_id:'b2',order_id:'103',total_price:10,financial_status:'refunded',timestamp:T},
   {event_type:'checkout_completed',session_id:null,order_id:'104',total_price:999,timestamp:T}]};
 const r=summarizeRollout(data,opts);
 assert.deepEqual([r.semantix.visitors,r.native.visitors],[5,5],'the latest exposure decides; a cart event fills in a visitor with none');
 assert.deepEqual([r.semantix.searchers,r.semantix.searches,r.native.searchers,r.native.searches],[3,4,2,2]);
 assert.deepEqual([r.semantix.searchersWhoClicked,r.semantix.searchersWhoCarted,r.semantix.searchersWhoBought],[2,1,1]);
 assert.deepEqual([r.semantix.orders,r.semantix.revenue,r.semantix.buyers],[2,250,2]);
 assert.equal(r.semantix.searchConversion,1/3);assert.equal(r.semantix.conversion,2/5);assert.equal(r.semantix.checkoutStarters,1);
 assert.deepEqual([r.native.orders,r.native.revenue,r.native.searchersWhoBought,r.native.searchConversion],[1,80,0,0]);
 assert.deepEqual(r.unknown,{searches:2,clicks:0,carts:0,orders:1,revenue:999,noSession:1});
 assert.equal(r.currency,'ILS');
 assert.equal(r.lift.searchConversion.significant,false,'three searchers prove nothing');
});

test('a gap counts as real only when it is beyond chance',()=>{
 assert.equal(compare({x:30,n:1000},{x:30,n:1000}).significant,false);
 const small=compare({x:33,n:1000},{x:30,n:1000});assert.equal(small.significant,false);assert.ok(Math.abs(small.lift-0.1)<1e-9);
 const big=compare({x:60,n:1000},{x:30,n:1000});assert.equal(big.significant,true);assert.equal(big.lift,1);assert.ok(big.z>3);
 assert.equal(compare({x:0,n:0},{x:1,n:10}),null);assert.equal(compare({x:5,n:100},{x:0,n:100}).lift,null);
 assert.throws(()=>reportOptions({days:0}),/90/);assert.equal(reportOptions({},Date.parse('2026-10-15T00:00:00Z')).from,'2026-10-01T00:00:00.000Z');
});

test('the report reads the store database, and a collection that is missing does not fail it',async()=>{
 const rows={tracking_events:[ex('a1','semantix'),ex('b1','native')],queries:[{query:'x',session_id:'a1',timestamp:T}],checkout_events:[{event_type:'checkout_completed',session_id:'a1',order_id:'1',total_price:40,timestamp:T}]};
 const seen=[],client={db:name=>{seen.push(name);return {collection:c=>({aggregate:stages=>({toArray:async()=>{if(!rows[c])throw Error('ns not found');assert.ok(stages[0].$match.$expr);return rows[c];}})})};}};
 const r=await readRolloutReport({existingClient:{dbName:'shop'}},{days:7},{client,now:()=>Date.parse('2026-10-05T00:00:00Z')});
 assert.equal(seen[0],'shop');assert.equal(r.semantix.searchConversion,1);assert.equal(r.native.visitors,1);
 assert.equal(r.sources.queries.status,'ok');assert.equal(r.sources.cart.status,'unavailable');
 await assert.rejects(readRolloutReport({},{},{client}),/מחובר/);
});

test('purchases are reported from checkout: the Shopify pixel and the WooCommerce order page',async()=>{
 const engine='(function(){const S=window.SemantixSettings||{};})();',project={id:'p',url:'https://www.shop.example/',takeover:{siteConfig:{platform:'shopify',features:{fullReplace:true}}}};
 const {files}=buildShopifyTakeover(project,{apiBase:'https://api.example.com',engine});
 assert.match(files['extensions/semantix-pixel/shopify.extension.toml'],/type = "web_pixel_extension"[\s\S]*runtime_context = "strict"[\s\S]*\[settings\.fields\.apiKey\]/);
 assert.equal(files['extensions/semantix-pixel/src/index.js'],PIXEL_SOURCE);
 assert.ok(JSON.parse(files['extensions/semantix-pixel/package.json']).dependencies['@shopify/web-pixels-extension']);
 // The pixel, run with a stand-in for Shopify's sandbox.
 const subs={},sent=[];let registered;
 new Function('register','fetch',PIXEL_SOURCE.replace(/^import .*$/m,''))(fn=>{registered=fn;},async(u,o)=>{sent.push([u,o.headers['X-API-Key'],JSON.parse(o.body).document]);return {};});
 const storage={localStorage:{semantix_visitor_id:'vis-1',semantix_ab_current:'{"semantix_takeover":"semantix"}'},sessionStorage:{semantix_last_query:'כוס קפה'}};
 registered({analytics:{subscribe:(n,f)=>{subs[n]=f;}},settings:{apiBase:'https://api.example/',apiKey:'key1'},
  browser:{localStorage:{getItem:async k=>storage.localStorage[k]??null},sessionStorage:{getItem:async k=>storage.sessionStorage[k]??null}}});
 const checkout={token:'tok',order:{id:'gid://shopify/Order/55'},totalPrice:{amount:120.5},subtotalPrice:{amount:100},currencyCode:'ILS',lineItems:[{title:'כוס',quantity:2,variant:{id:'gid://shopify/ProductVariant/9',sku:'s9',price:{amount:60.25},product:{id:'gid://shopify/Product/7'}}}]};
 await subs.checkout_started({timestamp:T,data:{checkout:{...checkout,order:null}}});await subs.checkout_completed({timestamp:T,data:{checkout}});
 assert.deepEqual(sent.map(x=>[x[0],x[1],x[2].event_type,x[2].order_id]),[['https://api.example/search-to-cart','key1','checkout_initiated',null],['https://api.example/search-to-cart','key1','checkout_completed','55']]);
 assert.deepEqual(sent[1][2],{event_type:'checkout_completed',timestamp:T,platform:'shopify',source:'web-pixel',checkout_token:'tok',order_id:'55',total_price:120.5,subtotal_price:100,currency:'ILS',
  line_items:[{product_id:'7',variant_id:'9',name:'כוס',sku:'s9',quantity:2,price:60.25}],session_id:'vis-1',search_query:'כוס קפה',ab_tests:{semantix_takeover:'semantix'}});
 // A visitor the engine never saw still produces the order, without a group.
 storage.localStorage={};storage.sessionStorage={};await subs.checkout_completed({timestamp:T,data:{checkout}});
 assert.equal(sent[2][2].session_id,null);assert.equal('ab_tests' in sent[2][2],false);
 // The order is countable by the report as it is sent.
 const r=summarizeRollout({exposures:[ex('vis-1','semantix')],queries:[{query:'כוס קפה',session_id:'vis-1',timestamp:T}],checkouts:[sent[1][2]]},opts);
 assert.equal(r.semantix.searchConversion,1);assert.equal(r.semantix.revenue,120.5);
 const php=buildWooTakeover({...project,takeover:{siteConfig:{platform:'woocommerce',features:{fullReplace:true}}}},{apiBase:'https://api.example.com',apiKey:'site_key_12345678',engine}).files['semantix-search/semantix-search.php'];
 assert.match(php,/add_action\('woocommerce_thankyou'/);assert.match(php,/_semantix_reported/);assert.match(php,/'event_type' => 'checkout_completed'/);assert.match(php,/semantix_ab_current/);
});
