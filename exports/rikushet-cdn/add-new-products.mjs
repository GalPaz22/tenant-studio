// Adds the products the store lists on its category pages but our catalog lacks (new since the October crawl).
// Reads each one's product page (JSON-LD, as the original crawl did) and merges it with the studio's crawl merge, which
// builds the card the same way the build did. Prices, old prices and brands then come from the category pages:
//   node exports/rikushet-cdn/add-new-products.mjs && node exports/rikushet-cdn/refresh-prices.mjs --reuse --apply
// Studio project only; production needs a separate sync and module publish.
import {readFile} from 'node:fs/promises';
const ROOT='/Users/galpaz/Desktop/tenant-studio',ID='5abfb35b-d727-4424-a8b1-ad3dc1940a59';
(await import(ROOT+'/node_modules/dotenv/lib/main.js')).default.config({path:ROOT+'/.env'});
const https=(await import('node:https')).default,{scrapeAgent}=await import(ROOT+'/core/egress.mjs'),{createStore}=await import(ROOT+'/store.mjs');
const {parseProductPage,mergeCrawl}=await import(ROOT+'/core/site-crawler.mjs');
const UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',sleep=ms=>new Promise(r=>setTimeout(r,ms));
function get(url){return new Promise((ok,fail)=>{const req=https.get(url,{agent:scrapeAgent(),headers:{'User-Agent':UA,Accept:'text/html','Accept-Language':'he-IL,he;q=0.9'}},res=>{const c=[];res.on('data',x=>c.push(x));res.on('end',()=>ok({status:res.statusCode,text:Buffer.concat(c).toString('utf8')}));res.on('error',fail);});req.setTimeout(30000,()=>req.destroy(Error('timeout')));req.on('error',fail);});}
const getRetry=async url=>{for(let i=1;;i++){try{const r=await get(url);if(r.status<500||i===3)return r;}catch(e){if(i===3)throw e;}await sleep(6000*i);}};
const key=u=>{try{return decodeURIComponent(new URL(u,'https://www.rikushet.co.il').pathname).split('/').filter(Boolean).pop()?.toLowerCase()||null}catch{return null}};
const store=createStore(ROOT+'/data'),p=await store.read(ID);
const report=JSON.parse(await readFile(ROOT+'/reports/rikushet-prices-'+new Date().toISOString().slice(0,10)+'.json','utf8'));
const have=new Set();for(const c of p.productCards){have.add(key(c.url));have.add(String(c.sku||c.id).toLowerCase());}
const fresh=[...new Map(report.listing.filter(x=>!have.has(x.key)&&!(x.sku&&have.has(x.sku.toLowerCase()))).map(x=>[x.key,x])).values()];
console.log('new on category pages:',fresh.length);
const products={},failed=[];let n=0;
for(const x of fresh){
 const url='https://www.rikushet.co.il/'+encodeURIComponent(x.key);const r=await getRetry(url).catch(e=>({status:0,error:e.message}));await sleep(1500);
 const page=r.status===200?parseProductPage(r.text,url):null;
 if(!page){failed.push({key:x.key,status:r.status});continue;}
 // The listing's SKU and canonical address, so the card matches the category pages and later price refreshes.
 products[url]={...page,sku:x.key,url,crawledAt:new Date().toISOString(),stockStatus:page.stockStatus==='unknown'?'instock':page.stockStatus};
 process.stdout.write(`\r${++n}/${fresh.length}`);
}
console.log('\nread',Object.keys(products).length,'failed',failed.length,failed.slice(0,5));
const fresher=await store.read(ID),counts=mergeCrawl(fresher,{products});
fresher.events.push({text:`נוספו ${counts.added} מוצרים חדשים מדפי הקטגוריות של האתר`,at:new Date().toISOString()});fresher.events=fresher.events.slice(-100);fresher.updatedAt=new Date().toISOString();
await store.save(fresher);console.log('merge',counts,'cards now',fresher.productCards.length);
