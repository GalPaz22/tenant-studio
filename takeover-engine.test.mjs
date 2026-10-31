import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {engineDir,ENGINE_FILES} from './core/takeover-preview.mjs';
import {patchTakeoverEngine} from './core/takeover-engine.mjs';
import {buildWooTakeover} from './core/takeover-export.mjs';

test('runtime updates are idempotent and Woo exports suppress duplicate browser carts',t=>{
 const dir=engineDir();if(!dir)return t.skip('Local engine checkout is unavailable');
 const engine=patchTakeoverEngine(readFileSync(join(dir,ENGINE_FILES['engine.js']),'utf8'));
 assert.equal(patchTakeoverEngine(engine),engine);new vm.Script(engine);
 assert.equal((engine.match(/function hideNativeEmptyState\(/g)||[]).length,1);
 assert.match(engine,/natives\.forEach\(n => n\.remove\(\)\);\s+hideNativeEmptyState\(grid\)/);
 assert.match(engine,/SemantixWooTracking\?\.serverCartTracking/);
 assert.match(engine,/SemantixWooTracking\?\.nativeClickTracking/);
});
test('generic Woo package is configurable and waits for a real site key',()=>{
 const project={url:'https://store.example',takeover:{siteConfig:{platform:'woocommerce',features:{fullReplace:true}}}};
 const {files,manifest}=buildWooTakeover(project,{configurable:true,engine:'window.SemantixSettings;'});
 assert.equal(manifest.siteKey,'set-in-wordpress-settings');
 assert.equal(manifest.features.sessionIdleMinutes,30);
 assert.match(files['semantix-search/assets/semantix-config.js'],/if\(window.SemantixSettings.apiKey\)/);
 assert.match(files['semantix-search/commerce.php'],/add_options_page/);
 assert.match(files['semantix-search/semantix-search.php'],/JSON_HEX_TAG/);
 new vm.Script(files['semantix-search/assets/semantix-commerce.js']);
 new vm.Script(files['semantix-search/assets/semantix-config.js']);
});
// The engine's own functions, cut out of the file and run with stand-ins.
const block=(engine,from,to)=>{const a=engine.indexOf(from),b=engine.indexOf(to,a);assert.ok(a>=0&&b>a,from);return engine.slice(a,b);};
test('an order is reported once, from the store\'s confirmation page, with the visitor\'s group; no number, no event',async t=>{
 const dir=engineDir();if(!dir)return t.skip('Local engine checkout is unavailable');
 const code=block(readFileSync(join(dir,ENGINE_FILES['engine.js']),'utf8'),'function orderFromDataLayer()','/* ------------------------ session storage cache');
 const run=async({path,dataLayer,orderText})=>{const sent=[],store={semantix_ab_current:'{"semantix_takeover":"semantix"}'},timers=[];
  const ctx={window:{dataLayer},location:{pathname:path},cfg:{},ATC_ENABLED:true,detectPlatform:()=>'magento',q1:s=>orderText&&/order-number/.test(s)?{textContent:orderText}:null,lsGet:(k,d)=>store[k]??d,lsSet:(k,v)=>{store[k]=v;},sendSearchToCart:d=>sent.push(d),ensureVisitorId:()=>'vis-1',abTestPayloadFields:()=>({}),setTimeout:f=>{timers.push(f);},JSON,Number};
  vm.createContext(ctx);vm.runInContext(code,ctx);ctx.trackOrderPage();for(let i=0;i<4&&timers.length;i++)timers.shift()();return {sent,again:(ctx.trackOrderPage(),sent.length)};};
 let r=await run({path:'/checkout/onepage/success/',dataLayer:[{ecommerce:{transaction_id:'T7',value:120,currency:'ILS',items:[{item_id:'1',item_name:'ספר',quantity:1,price:120}]}}]});
 assert.equal(r.sent.length,1);assert.equal(r.again,1,'a reload does not repeat it');
 const d=r.sent[0];assert.equal(d.event_type,'checkout_completed');assert.equal(d.order_id,'T7');assert.equal(d.event_id,'order-T7');assert.equal(d.total_price,120);assert.equal(d.ab_tests.semantix_takeover,'semantix');
 r=await run({path:'/checkout/onepage/success/',dataLayer:[],orderText:'מספר הזמנה: 000123456'});assert.equal(r.sent[0].order_id,'000123456');
 r=await run({path:'/checkout/onepage/success/',dataLayer:[]});assert.equal(r.sent.length,0,'no order number, no event');
 r=await run({path:'/checkout/cart/',dataLayer:[{ecommerce:{transaction_id:'T7'}}]});assert.equal(r.sent.length,0,'any other page is not a purchase');
});
test('only a successful answer from the store confirms an add to cart',t=>{
 const dir=engineDir();if(!dir)return t.skip('Local engine checkout is unavailable');
 const ok=vm.runInNewContext(`${block(readFileSync(join(dir,ENGINE_FILES['engine.js']),'utf8'),'function cartAnswerOk(','function confirmCartAdd(')};cartAnswerOk`);
 assert.equal(ok(200,'[]'),true);assert.equal(ok(200,'{"backUrl":"https://s/checkout/cart/"}'),true);assert.equal(ok(200,'<html>'),true);
 assert.equal(ok(403,''),false);assert.equal(ok(200,'{"backUrl":"https://s/some-book"}'),false,'Magento sends a refused product back to its page');assert.equal(ok(200,'{"error":"x"}'),false);
});
test('the built-in split is marked, so a visitor whose configuration came late is left out of the groups',t=>{
 const dir=engineDir();if(!dir)return t.skip('Local engine checkout is unavailable');
 assert.match(readFileSync(join(dir,ENGINE_FILES['engine.js']),'utf8'),/tests\[testName\]\.fallback === true \? variant\.id \+ ":fallback"/);
 assert.match(readFileSync(new URL('./exports/steimatzky-cdn/build-bundle.mjs',import.meta.url),'utf8'),/semantix_takeover:\{enabled:true,sticky:false,fallback:true/);
});
