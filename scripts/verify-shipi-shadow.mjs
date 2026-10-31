import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {load} from 'cheerio';
import assert from 'node:assert/strict';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=new URL('../',import.meta.url),fixture=new URL('../exports/shipi-qa/',import.meta.url);
const source=await readFile(new URL('results.html',fixture),'utf8'),zeroSource=await readFile(new URL('zero.html',fixture),'utf8');
const project=JSON.parse(await readFile(new URL('../data/a6e8f510-d27c-4776-95e6-3f7c5d3db2dc.json',import.meta.url),'utf8'));
const config=project.takeover.siteConfig;
const $=load(source),$zero=load(zeroSource);
const firstId=$('.products-row .btn-add-cart[data-id]').first().attr('data-id');
$('main .product-col').slice(8).remove();$('script,noscript').remove();$zero('script,noscript').remove();
for(const doc of [$,$zero])doc('main a[href]').each((_,el)=>{const value=doc(el).attr('href');if(value.startsWith('https://shipi.co.il/'))doc(el).attr('href',new URL(value).pathname);});
const themeLinks=$('link[rel="stylesheet"]').map((_,n)=>$(n).attr('href')).get().filter(s=>s.includes('/themes/'));
let styles='';for(let i=0;i<themeLinks.length;i++)styles+='<style>'+(await readFile(new URL('theme-'+i+'.css',fixture),'utf8')).replace(/url\((['"]?)([^)'"]+)\1\)/g,(_,quote,value)=>'url("'+new URL(value,themeLinks[i]).href+'")')+'</style>';
const settings={apiBase:'/api',apiKey:'local-qa-key',shadowMode:true,serverCartTracking:true,nativeClickTracking:true,productIdPrefix:'',
 queryParams:config.queryParams,productCardSelectors:config.selectors.productCard,searchSelectors:{...config.selectors,root:config.replace.root}};
const events=[],requests=[],errors=[];
const server=createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost');requests.push(u.pathname);
 if(u.pathname.startsWith('/assets/')){
  const file=u.pathname.split('/').at(-1);if(!['semantix-commerce.js','semantix-shadow.js'].includes(file)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type','text/javascript');return res.end(await readFile(new URL('exports/shipi-shadow/semantix-search/assets/'+file,root)));
 }
 if(u.pathname.startsWith('/api/')){
  let body='';for await(const c of req)body+=c;events.push({path:u.pathname,data:JSON.parse(body||'{}')});server.emit(u.pathname);res.setHeader('Content-Type','application/json');
  // Any accidental remote-config fetch would try to enable every feature.
  return res.end(JSON.stringify({features:{fullReplace:true,autocomplete:true,shadowMode:false}}));
 }
 const main=u.pathname==='/zero'?$zero('main').prop('outerHTML'):$('main').prop('outerHTML');
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(`<!doctype html><html dir="rtl" lang="he"><head><meta name="viewport" content="width=device-width,initial-scale=1">${styles}</head><body class="${$('body').attr('class')}">
 <header><form id="native-search" action="/" method="get"><input id="header_search_input" name="s"><input name="post_type" type="hidden" value="product"><button type="submit">חפש</button></form></header>${main}
 <script>window.__beforeMarkup=document.querySelector('main').outerHTML;window.__mainMutations=0;new MutationObserver(r=>window.__mainMutations+=r.length).observe(document.querySelector('main'),{subtree:true,childList:true,attributes:true,characterData:true});window.SemantixWooTracking=${JSON.stringify(settings)};window.__nativeSubmit=false;document.querySelector('form').addEventListener('submit',e=>window.__nativeSubmit=e.defaultPrevented);</script>
 <script src="/assets/semantix-commerce.js"></script><script src="/assets/semantix-shadow.js"></script></body></html>`);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{
  const url=route.request().url(),type=route.request().resourceType();
  if(url.startsWith(base)||url.startsWith('data:'))return route.continue();
  if(['image','font'].includes(type)&&url.startsWith('https://shipi.co.il/'))return route.continue();
  return route.abort();
 });
 const initialQuery=page.waitForResponse(r=>r.url().endsWith('/api/log-query'));
 await page.goto(base+'/?s='+encodeURIComponent('כיסוי')+'&post_type=product');
 await initialQuery;
 await page.waitForFunction(()=>window.__semantixWooShadow===true);
 assert.equal(events.filter(e=>e.path==='/api/log-query').length,1);
 assert.equal(events[0].data.zero_results,false);
 const session=events[0].data.session_id;assert.ok(session.startsWith('vis-'));
 assert.equal(await page.evaluate(()=>document.querySelector('main').outerHTML===window.__beforeMarkup),true,'shadow preserves native markup byte-for-byte');
 assert.equal(await page.evaluate(()=>window.__mainMutations),0,'shadow makes no storefront mutations');
 assert.equal(await page.evaluate(()=>!!window.__semantix_engine_v5),false);
 assert.equal(await page.locator('[data-semantix-ai],[data-semantix-head],[data-semantix-bar-loader],#semantix-antiflicker,#semantix-ac-style').count(),0);
 const nativeStyle=await page.locator('.product-item').first().evaluate(n=>getComputedStyle(n).boxShadow);assert.notEqual(nativeStyle,'none');
 // Native Matat add-to-cart click is not counted as a successful cart.
 await page.locator('.products-row .product-item').first().hover();await page.locator('.products-row .btn-add-cart').first().click();
 assert.equal(events.filter(e=>e.path==='/api/search-to-cart').length,0);
 // Native search submission remains a real GET navigation; one query per page.
 await page.locator('#header_search_input').fill('אייפון');
 await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/log-query')),page.waitForURL(u=>u.searchParams.get('s')==='אייפון'),page.locator('#native-search button').click()]);
 await page.waitForFunction(()=>window.__semantixWooShadow===true);
 const log=events.filter(e=>e.path==='/api/log-query');assert.equal(log.length,2);assert.equal(log[1].data.query,'אייפון');assert.equal(log[1].data.session_id,session);
 const clickDetails=await page.locator('.products-row .product-name a').first().evaluate(n=>({href:n.href,origin:location.origin,id:n.closest('.product-col')?.querySelector('.btn-add-cart')?.getAttribute('data-id'),ai:!!n.closest('[data-semantix-ai],[data-semantix-replaced],[data-semantix-ac]'),tracking:!!window.__semantixWooTracking}));
 assert.equal(new URL(clickDetails.href).origin,clickDetails.origin);assert.ok(clickDetails.id);assert.equal(clickDetails.ai,false);assert.equal(clickDetails.tracking,true);
 const clickRecorded=once(server,'/api/product-click',{signal:AbortSignal.timeout(5000)});
 await page.locator('.products-row .product-name a').first().click({noWaitAfter:true});await clickRecorded;
 await page.waitForURL('**/product/**');
 const click=events.filter(e=>e.path==='/api/product-click');assert.equal(click.length,1);assert.equal(click[0].data.product_id,firstId);assert.equal(click[0].data.session_id,session);assert.equal(click[0].data.search_query,'אייפון');assert.equal(click[0].data.source,'woocommerce-shadow');
 const beforePage2=events.filter(e=>e.path==='/api/log-query').length;
 await page.goto(base+'/?s=כיסוי&paged=2');await page.waitForFunction(()=>window.__semantixWooShadow===true);
 assert.equal(events.filter(e=>e.path==='/api/log-query').length,beforePage2,'pagination is not another search');
 const zeroResponse=page.waitForResponse(r=>r.url().endsWith('/api/zero-search'));
 await page.goto(base+'/zero?s=אין-תוצאות');await zeroResponse;await page.waitForFunction(()=>window.__semantixWooShadow===true);
 assert.equal(await page.locator('.woocommerce-info').isVisible(),true,'native no-results message stays visible');
 assert.equal(await page.evaluate(()=>document.querySelector('main').outerHTML===window.__beforeMarkup),true);
 const zero=events.find(e=>e.path==='/api/zero-search');assert.ok(zero);assert.equal(zero.data.recovered_count,null);assert.equal(zero.data.source,'shadow');
 assert.equal(events.filter(e=>e.path==='/api/log-query').at(-1).data.zero_results,true);
 // Even hostile siteConfig replies cannot activate a package with no config fetch.
 assert.ok(!requests.some(p=>/\/api\/(?:search|fast-search|autocomplete|site-config)$/.test(p)));
 assert.equal(errors.length,0,errors.join('\n'));
 const output=new URL('../reports/shipi-shadow-qa/',import.meta.url);await mkdir(output,{recursive:true});
 const report={passed:true,searches:events.filter(e=>e.path==='/api/log-query').length,clicks:click.length,zeroSearches:1,engineRequests:0,productionEventWrites:0,checks:['native markup and CSS preserved','zero DOM mutations','native form GET preserved','search/click share session','no false cart on intent','pagination excluded','native empty state preserved','no search/config/engine requests']};
 await writeFile(new URL('results.json',output),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){console.log(JSON.stringify({errors,events:events.map(e=>({path:e.path,query:e.data.query,product_id:e.data.product_id})),requests:requests.filter(p=>p.startsWith('/api/'))}));throw error;}
finally{await browser.close();await new Promise(r=>server.close(r));}
