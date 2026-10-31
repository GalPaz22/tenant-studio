// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/verify-storefront-plugins.mjs
import {readFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {patchTakeoverEngine} from '../core/takeover-engine.mjs';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=patchTakeoverEngine(await readFile(new URL('../../semantix-cdn/semantix-engine.min.js',import.meta.url),'utf8'));
const tracking=await readFile(new URL('../core/woo-tracking-browser.js',import.meta.url),'utf8');
const settings={apiBase:'/api',apiKey:'test-site-key',endpoints:{search:'/search',fastSearch:'/fast-search',productClick:'/product-click',searchToCart:'/search-to-cart',zeroSearch:'/zero-search'},siteConfig:{
 platform:'shopify',queryParams:['q'],selectors:{resultsGrid:['.product-grid'],productCard:['article.product'],noResults:['.native-empty']},
 features:{fullReplace:true,zeroReplace:true},replace:{scope:'main',root:'main',searchPath:'^/search',shell:[{tag:'div',cls:['product-grid']}],loader:{type:'none'}},
 behavior:{waitForDomMs:300,loaderMinMs:1},nativeCard:{useCustomTemplate:true,cardTemplate:'<article class="product"><a href="{{url}}"><img src="{{image}}"><h2>{{name}}</h2></a></article>'}}};
const errors=[],events=[];
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/engine.js'){res.setHeader('Content-Type','text/javascript');return res.end(engine);}
 if(url.pathname==='/tracking.js'){res.setHeader('Content-Type','text/javascript');return res.end(tracking);}
 if(url.pathname.startsWith('/api/')){
  let body='';for await(const c of req)body+=c;
  const data=body?JSON.parse(body):{};events.push({path:url.pathname,data});
  res.setHeader('Content-Type','application/json');
  if(url.pathname==='/api/search'){
   if(data.query==='error'){res.statusCode=503;return res.end('{}');}
   return res.end(JSON.stringify({products:data.query==='zero'?[]:[{id:'woo_product_7',name:'כוס זכוכית',price:10,url:'/product/cup',image:'/cup.png'}]}));
  }
  return res.end('{}');
 }
 if(url.pathname==='/cup.png'){res.statusCode=204;return res.end();}
 res.setHeader('Content-Type','text/html; charset=utf-8');
 const commerce=url.pathname.startsWith('/commerce'),matat=url.pathname==='/commerce-matat';
 const nativeCard=matat?'<div class="product-col"><div class="product-item"><a class="btn-add-cart" data-id="447" href="#">הוספה</a><a class="archive-prod-thumb" href="/product/matat"><img src="/cup.png"></a><h2 class="product-name"><a href="/product/matat">כיסוי</a></h2></div></div>':'<li class="product post-7"><a class="woocommerce-LoopProduct-link" href="/product/cup"><h2 class="woocommerce-loop-product__title">כוס</h2></a><a class="add_to_cart_button" data-product_id="7" href="/?add-to-cart=7">הוספה</a></li>';
 res.end(`<!doctype html><html dir="rtl"><head><style>.product-grid{display:grid;grid-template-columns:repeat(3,1fr)}[data-semantix-native-hidden]{display:none!important}</style></head><body>
 <header>החנות שלי</header><main><div class="product-grid"><p class="native-empty">לא נמצאו מוצרים</p>${commerce?nativeCard:''}</div></main><footer>Footer</footer>
 <script>window.${commerce?'SemantixWooTracking':'SemantixSettings'}=${JSON.stringify(commerce?{apiBase:'/api',apiKey:'test-site-key',serverCartTracking:true,nativeClickTracking:true,...(matat?{productIdPrefix:''}:{})}:settings)}</script><script src="${commerce?'/tracking.js':'/engine.js'}"></script>${commerce?`<script>window.SemantixSettings=${JSON.stringify({...settings,siteConfig:{...settings.siteConfig,platform:'woocommerce',features:{fullReplace:false},clickTracking:{enabled:true,trackNativeClicks:true}}})}</script><script src="/engine.js"></script>`:''}</body></html>`);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/search?q=cup');
 await page.locator('[data-semantix-replaced]').waitFor();
 assert.equal(await page.locator('.native-empty').isVisible(),false,'native empty message disappears after cards render');
 await page.evaluate(()=>{const n=document.createElement('p');n.className='native-empty';n.textContent='לא נמצאו מוצרים';document.querySelector('.product-grid').append(n);});
 await page.waitForFunction(()=>[...document.querySelectorAll('.native-empty')].every(n=>getComputedStyle(n).display==='none'));
 assert.equal(await page.locator('header').isVisible(),true);assert.equal(await page.locator('footer').isVisible(),true);
 await mkdir(new URL('../reports/plugin-qa/',import.meta.url),{recursive:true});
 await page.screenshot({path:new URL('../reports/plugin-qa/shopify-grid-fixed.png',import.meta.url).pathname});
 const searched=events.find(e=>e.path==='/api/search').data.session_id;
 await page.locator('[data-semantix-replaced] a').click({noWaitAfter:true});
 await page.waitForURL('**/product/cup');
 const ai=events.find(e=>e.path==='/api/product-click');
 assert.ok(ai,'AI product click is recorded');assert.equal(ai.data.session_id,searched,'search and AI click share identity');
 await page.goto(base+'/search?q=cup');await page.locator('[data-semantix-replaced]').waitFor();
 // Same document navigation must release the previous query's hidden messages.
 await page.evaluate(()=>history.pushState({},'', '/search?q=error'));
 await page.waitForFunction(()=>!document.getElementById('semantix-replace-style'));
 assert.equal(await page.locator('.native-empty').first().isVisible(),true,'failed next query restores native message');
 await page.goto(base+'/search?q=zero');
 await page.waitForFunction(()=>!document.getElementById('semantix-replace-style'));
 assert.equal(await page.locator('.native-empty').isVisible(),true,'true empty search restores native message');
 await page.goto(base+'/commerce?s=cup');
 const identity=await page.evaluate(()=>JSON.parse(localStorage.getItem('semantix_woo_session')).id);
 await page.locator('.woocommerce-LoopProduct-link').click({noWaitAfter:true});
 await page.waitForURL('**/product/cup');
 assert.equal(events.filter(e=>e.path==='/api/product-click'&&e.data.source==='woocommerce-native').length,1,'native product click is recorded once');
 assert.equal(events.filter(e=>e.path==='/api/product-click').length,2,'engine does not duplicate the native Woo click');
 const click=events.find(e=>e.path==='/api/product-click'&&e.data.source==='woocommerce-native').data;
 assert.equal(click.session_id,identity);assert.equal(click.product_id,'woo_product_7');assert.equal(click.search_query,'cup');
 await page.goto(base+'/commerce');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('semantix_woo_session')).id),identity,'session crosses pages');
 await page.evaluate(async()=>{const state=JSON.parse(localStorage.getItem('semantix_woo_session'));state.at=Date.now()-100000;localStorage.setItem('semantix_woo_session',JSON.stringify(state));window.__activityBefore=state.at;await fetch('/api/background');});
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('semantix_woo_session')).at===window.__activityBefore),true,'background polling does not prolong the session');
 await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('semantix_woo_session'));state.at=Date.now()-1800001;localStorage.setItem('semantix_woo_session',JSON.stringify(state));});
 await page.reload();
 assert.notEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('semantix_woo_session')).id),identity,'idle session rotates');
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('semantix_last_query')),'','expired search is cleared');
 await page.goto(base+'/commerce-matat?s=case');
 await page.locator('.product-name a').click({noWaitAfter:true});await page.waitForURL('**/product/matat');
 const matatClicks=events.filter(e=>e.path==='/api/product-click'&&e.data.product_id==='447');
 assert.equal(matatClicks.length,1,'Matat native title click is recorded once');
 assert.equal(matatClicks[0].data.product_name,'כיסוי');
 assert.equal(matatClicks[0].data.search_query,'case');
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('Browser QA passed: empty message, rerender, failure/zero fallback, native click, shared session and idle expiry.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
