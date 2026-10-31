// Uses saved public Shipi HTML/CSS, local search replies and the packaged assets.
// No search or measurement is sent to production.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {load} from 'cheerio';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=new URL('../',import.meta.url),fixture=new URL('../exports/shipi-qa/',import.meta.url);
const source=await readFile(new URL('results.html',fixture),'utf8'),zero=await readFile(new URL('zero.html',fixture),'utf8');
const $=load(source),zero$=load(zero);
const products=$('main .products-row > .product-col').slice(0,8).map((_,el)=>({
 id:$(el).find('.btn-add-cart').attr('data-id'),name:$(el).find('.archive-prod-thumb img').attr('alt'),
 price:Number($(el).find('.product-price').text().replace(/[^\d.]/g,'')),url:$(el).find('.archive-prod-thumb').attr('href'),image:$(el).find('img').attr('src'),
})).get();
assert.equal(products.length,8);
$('main .product-col').slice(8).remove();$('script,noscript').remove();zero$('script,noscript').remove();
const themeLinks=$('link[rel="stylesheet"]').map((_,n)=>$(n).attr('href')).get().filter(s=>s.includes('/themes/'));
let styles='';for(let i=0;i<themeLinks.length;i++){
 const css=await readFile(new URL('theme-'+i+'.css',fixture),'utf8');
 styles+='<style>'+css.replace(/url\((['"]?)([^)'"]+)\1\)/g,(full,quote,url)=>'url("'+new URL(url,themeLinks[i]).href+'")')+'</style>';
}
const events=[],errors=[];
const server=createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost');
 if(u.pathname.startsWith('/assets/')||u.pathname.startsWith('/generic-assets/')){
  const file=u.pathname.split('/').at(-1);if(!['semantix-commerce.js','semantix-config.js','semantix-engine.js'].includes(file)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type','text/javascript');return res.end(await readFile(new URL('exports/'+(u.pathname.startsWith('/generic-assets/')?'semantix-woocommerce':'shipi-fixed')+'/semantix-search/assets/'+file,root)));
 }
 if(u.pathname.startsWith('/api/')){
  let body='';for await(const c of req)body+=c;const data=body?JSON.parse(body):{};events.push({path:u.pathname,data});
  res.setHeader('Content-Type','application/json');
  if(u.pathname==='/api/search'){
   if(data.query==='error'){res.statusCode=503;return res.end('{}');}
   return res.end(JSON.stringify({products:data.query==='empty'?[]:products}));
  }
  return res.end('{}');
 }
 const native=u.pathname==='/native',generic=u.pathname==='/generic',zeroPage=/zero|error|empty/.test(u.pathname);
 const main=zeroPage?zero$('main').prop('outerHTML'):$('main').prop('outerHTML');
 const assets=generic?'/generic-assets/':'/assets/';
 const scripts=native?'':`<script>window.SemantixWooTracking={apiBase:'/api',apiKey:'local-qa-site-key',serverCartTracking:true,nativeClickTracking:true,productIdPrefix:''};</script><script src="${assets}semantix-commerce.js"></script><script src="${assets}semantix-config.js"></script>`;
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(`<!doctype html><html dir="rtl" lang="he"><head><meta name="viewport" content="width=device-width,initial-scale=1">${styles}</head><body class="${$('body').attr('class')||''}">${main}${scripts}</body></html>`);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const output=new URL('../reports/shipi-qa/',import.meta.url);await mkdir(output,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{
  const url=route.request().url(),type=route.request().resourceType();
  if(url.startsWith(base)||url.startsWith('data:'))return route.continue();
  // Read only product images and theme fonts; block all other external traffic.
  if(['image','font'].includes(type)&&url.startsWith('https://shipi.co.il/'))return route.continue();
  return route.abort();
 });
 const cardStyle=()=>page.locator('.products-row .product-item').first().evaluate(n=>{const s=getComputedStyle(n),title=getComputedStyle(n.querySelector('.product-name')),price=getComputedStyle(n.querySelector('.product-price'));return {shadow:s.boxShadow,radius:s.borderRadius,titleSize:title.fontSize,priceSize:price.fontSize};});
 const query=encodeURIComponent('כיסוי');
 await page.goto(base+'/native?s='+query);const native=await cardStyle();assert.notEqual(native.shadow,'none');
 await page.setViewportSize({width:390,height:844});const nativeMobile=await cardStyle();
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(base+'/generic?s='+query);await page.locator('li[data-semantix-replaced]').first().waitFor();
 await page.waitForFunction(()=>!document.querySelector('[data-semantix-bar-loader]'));
 assert.equal(await page.locator('[data-semantix-replaced] .product-item').count(),0,'old package does not match Matat markup');
 await page.locator('main').screenshot({path:new URL('generic-before.png',output).pathname});
 await page.goto(base+'/fixed?s='+query);await page.locator('.product-col[data-semantix-replaced]').first().waitFor();
 await page.waitForFunction(()=>!document.querySelector('[data-semantix-bar-loader]'));
 assert.equal(await page.locator('.product-col[data-semantix-replaced]').count(),8);
 assert.deepEqual(await cardStyle(),native,'replacement cards inherit the actual Matat card styles');
 const desktop=await page.locator('.products-row').evaluate(grid=>({display:getComputedStyle(grid).display,gridWidth:grid.getBoundingClientRect().width,cardWidth:grid.querySelector('.product-col').getBoundingClientRect().width}));
 assert.equal(desktop.display,'flex');assert.ok(desktop.cardWidth<desktop.gridWidth/2&&desktop.cardWidth>100);
 await page.locator('main').screenshot({path:new URL('shipi-desktop.png',output).pathname});
 await page.setViewportSize({width:390,height:844});
 const mobile=await page.locator('.products-row').evaluate(grid=>({gridWidth:grid.getBoundingClientRect().width,cardWidth:grid.querySelector('.product-col').getBoundingClientRect().width}));
 assert.ok(Math.abs(mobile.cardWidth/mobile.gridWidth-.5)<.02,'mobile has two columns');
 await page.locator('main').screenshot({path:new URL('shipi-mobile.png',output).pathname});
 const mobileOverflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,nodes:[...document.querySelectorAll('main *')].filter(n=>getComputedStyle(n).display!=='none'&&n.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(n=>({tag:n.tagName,cls:n.className,right:n.getBoundingClientRect().right,width:n.getBoundingClientRect().width}))}));
 assert.equal(mobileOverflow.nodes.length,0,'product grid and cards stay inside the mobile viewport');
 await page.goto(base+'/zero?s=recover');await page.locator('.product-col[data-semantix-replaced]').first().waitFor();
 assert.equal(await page.locator('.woocommerce-no-products-found').isVisible(),false);
 assert.equal(await page.locator('.woocommerce-info').isVisible(),false);
 assert.deepEqual(await cardStyle(),nativeMobile,'recovered results retain the Matat card style');
 await page.goto(base+'/empty?s=empty');await page.waitForFunction(()=>!document.getElementById('semantix-replace-style'));
 assert.equal(await page.locator('.woocommerce-info').isVisible(),true,'actual empty results restore native message');
 await page.goto(base+'/error?s=error');await page.waitForFunction(()=>!document.getElementById('semantix-replace-style'));
 assert.equal(await page.locator('.woocommerce-info').isVisible(),true,'server failure restores native message');
 assert.equal(errors.length,0,errors.join('\n'));
 const report={passed:true,styles:native,desktop,mobile,checks:['old generic mismatch reproduced','Matat CSS parity','desktop layout','two mobile columns','product cards stay inside viewport','empty-message recovery','empty/error fallback'],productionCalls:0};
 await writeFile(new URL('results.json',output),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();await new Promise(r=>server.close(r));}
