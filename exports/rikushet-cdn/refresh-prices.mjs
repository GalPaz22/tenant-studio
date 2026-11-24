// Reads Rikushet's prices from its own category pages (24 products a page, the price the shopper sees, the price before a
// discount, the brand) and matches them to the studio project's cards by the product code at the end of the URL.
//   node exports/rikushet-cdn/refresh-prices.mjs            → report only (reports/rikushet-prices-<date>.json)
//   node exports/rikushet-cdn/refresh-prices.mjs --apply    → also writes price/regularPrice/brand into the studio project
//   --reuse                                                 → take the category pages from today's report instead of reading them again
// Cards on no category page are read from their own product page: a 404 hides the card, otherwise its price is taken there.
// /מותגים lists most of the catalog; the other top categories are read only while cards are still unmatched.
// Nothing is written to production: syncing the corrected cards there is a separate step (dashboard-sync).
// One page at a time with a pause, as a browser: the store sends plain clients to an abuse page.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const ROOT='/Users/galpaz/Desktop/tenant-studio',ID='5abfb35b-d727-4424-a8b1-ad3dc1940a59',SITE='https://www.rikushet.co.il';
(await import(ROOT+'/node_modules/dotenv/lib/main.js')).default.config({path:ROOT+'/.env'});
const https=(await import('node:https')).default,{scrapeAgent}=await import(ROOT+'/core/egress.mjs'),{createStore}=await import(ROOT+'/store.mjs');
const APPLY=process.argv.includes('--apply'),REUSE=process.argv.includes('--reuse'),PAUSE=1500;
const ROOTS=['מותגים','הלבשה-חדש','הלבשה-תחתונה-חדש','הנעלה-חדש','קמפינג-חדש','ציוד-צבאי','גאדג׳טים-חדש','תיקים','נסיעות-לחו״ל','ציוד-טקטי','outlet_new','sale'];
const UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function get(url){
 return new Promise((ok,fail)=>{
  const req=https.get(url,{agent:scrapeAgent(),headers:{'User-Agent':UA,Accept:'text/html','Accept-Language':'he-IL,he;q=0.9'}},res=>{const c=[];res.on('data',x=>c.push(x));res.on('end',()=>ok({status:res.statusCode,location:res.headers.location||null,text:Buffer.concat(c).toString('utf8')}));res.on('error',fail);});
  req.setTimeout(30000,()=>req.destroy(Error('timeout')));req.on('error',fail);
 });
}
// The store sometimes holds a page for over 30 s: up to three tries, with a longer pause after each failure.
const getRetry=async url=>{for(let i=1;;i++){try{const r=await get(url);if(r.status<500||i===3)return r;}catch(e){if(i===3)throw e;}await sleep(PAUSE*4*i);}};
const key=u=>{try{return decodeURIComponent(new URL(u,SITE).pathname).split('/').filter(Boolean).pop()?.toLowerCase()||null}catch{return null}};
const num=v=>v==null||v===''||!Number.isFinite(Number(v))?null:Number(v);
const decode=t=>t.replace(/&quot;/g,'"').replace(/&#0?39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
// What the store's own card shows that the engine's card has no field for (the brand, the sale bar, the black tag, the colour
// dots) travels in the product's `badges`, which /search and /autocomplete return as they are; the bundle's skin.js draws
// them with the store's markup. A page that did not list the product (read from its own page) keeps what it had.
export const NATIVE='rikushet-native';
export function withNative(old,x,brand){
 const keep=(old||[]).filter(b=>b.source!==NATIVE);if(x.from!=='category'&&(old||[]).some(b=>b.source===NATIVE))return old;
 const at=new Date().toISOString(),out=[];
 if(brand)out.push({kind:'rk-brand',text:brand});
 if(x.label)out.push({kind:'rk-sale',text:x.label});
 if(x.stamp)out.push({kind:'rk-stamp',text:x.stamp});
 for(const w of x.swatches||[])out.push({kind:'rk-swatch',text:w.l||'',...(w.c?{color:w.c}:{image:w.i})});
 return [...keep,...out.map((b,i)=>({...b,order:100+i,source:NATIVE,observedAt:at}))];
}
// The colour dots under a store card: the options of the colour attribute that have stock, in the store's order, each as
// a hex colour or an image (the card's own jsonConfig + jsonSwatchConfig).
function balanced(t,from){let d=0,q=false;for(let i=from;i<t.length;i++){const c=t[i];if(q){if(c==='\\')i++;else if(c==='"')q=false;continue;}if(c==='"')q=true;else if(c==='{')d++;else if(c==='}'&&--d===0)return t.slice(from,i+1);}return null;}
function jsonAfter(t,name){const i=t.indexOf('"'+name+'"');if(i<0)return null;const j=t.indexOf('{',i);const b=j<0?null:balanced(t,j);try{return b?JSON.parse(b):null}catch{return null}}
export function swatchesOf(part){
 const cfg=jsonAfter(part,'jsonConfig'),sw=jsonAfter(part,'jsonSwatchConfig');if(!cfg?.attributes||!sw)return [];
 const attr=Object.values(cfg.attributes).find(a=>a.code==='color');if(!attr||!sw[attr.id])return [];
 const out=[];for(const o of attr.options||[]){if(!(o.products?.stock||[]).length)continue;const v=sw[attr.id][o.id];if(!v||!v.value)continue;
  if(String(v.type)==='1'&&/^#[0-9a-f]{3,8}$/i.test(v.value))out.push({c:v.value,l:v.label||o.label||''});else if(String(v.type)==='2'&&/^https?:|^\//.test(v.value))out.push({i:v.value,l:v.label||o.label||''});}
 return out;
}
// One product card of a category page → {key, sku, entityId, final, old, brand, label, saleable}.
export function parseListing(html){
 const out=[];
 for(const part of html.split(/<li\b(?=[^>]*\bclass="product-item\b)/).slice(1)){
  const head=part.slice(0,part.indexOf('>'));if(/category_promotion/.test(head))continue;
  const url=/<a href="([^"]+)"[^>]*class="action product_link"/.exec(part)?.[1];if(!url)continue;
  const final=num(/data-price-amount="([\d.]+)"\s+data-price-type="finalPrice"/.exec(part)?.[1]),old=num(/data-price-amount="([\d.]+)"\s+data-price-type="oldPrice"/.exec(part)?.[1]);
  out.push({key:key(url),url:decodeURI(url),sku:/data-product-sku="([^"]+)"/.exec(part)?.[1]||null,entityId:/data-id="(\d+)"/.exec(head)?.[1]||null,final,old:old&&final&&old>final?old:null,
   brand:(m=>m?decode(m[1]):null)(/class="product-category-brand[^"]*"[^>]*>([^<]*)</.exec(part)),label:(m=>m?decode(m[1]):null)(/product-stampa_sale"[^>]*>\s*<span[^>]*>([^<]*)</.exec(part)),
   stamp:(m=>m?decode(m[1]):null)(/product-stampa"[^>]*>\s*<span[^>]*>([^<]*)</.exec(part)),swatches:swatchesOf(part),
   saleable:/is_saleable_item/.test(head)||!/product_outofstock="true"/.test(part)});
 }
 return out;
}
const store=createStore(ROOT+'/data'),p=await store.read(ID);
const cards=new Map(p.productCards.map(c=>[key(c.url),c]));for(const c of p.productCards)if(!cards.has(String(c.sku||c.id).toLowerCase()))cards.set(String(c.sku||c.id).toLowerCase(),c);
const seen=new Map(),pages=[];let requests=0;
const unmatched=()=>p.productCards.filter(c=>!seen.has(key(c.url))&&!seen.has(String(c.sku||c.id).toLowerCase())).length;
const today=ROOT+'/reports/rikushet-prices-'+new Date().toISOString().slice(0,10)+'.json';
if(REUSE){const r=JSON.parse(await readFile(today,'utf8'));for(const x of r.listing)seen.set(x.key,x);pages.push(...r.pages);}
else for(const root of ROOTS){
 if(root!=='מותגים'&&!unmatched())break;
 for(let page=1;page<=80;page++){
  const url=SITE+'/'+encodeURI(root)+(page>1?'?p='+page:'');const r=await getRetry(url);requests++;await sleep(PAUSE);
  if(r.status!==200){pages.push({root,page,status:r.status,location:r.location});if(r.location&&/abuse/.test(r.location))throw Error('store sent us to its abuse page; stopping');break;}
  const rows=parseListing(r.text),fresh=rows.filter(x=>!seen.has(x.key));for(const x of rows){if(!seen.has(x.key))seen.set(x.key,{...x,root});if(x.sku&&!seen.has(x.sku.toLowerCase()))seen.set(x.sku.toLowerCase(),{...x,root});}
  const total=num(/class="toolbar-number">(\d+)</.exec(r.text)?.[1]);pages.push({root,page,rows:rows.length,fresh:fresh.length,total});
  process.stdout.write(`\r${root} p${page} · ${rows.length} rows · ${seen.size} keys · ${unmatched()} cards unmatched   `);
  if(!/class="action primary no_loading next"/.test(r.text)||!rows.length)break;
 }
}
console.log();
const listing=[...new Map([...seen.values()].map(x=>[x.key,x])).values()];
// Not on any category page: removed (404), or listed nowhere; the product page decides.
const pdp=new Map();
for(const c of p.productCards){
 if(seen.has(key(c.url))||seen.has(String(c.sku||c.id).toLowerCase()))continue;
 const r=await getRetry(c.url);requests++;await sleep(PAUSE);
 if(r.status===404){pdp.set(c.id,{gone:true});continue;}
 if(r.status!==200){pdp.set(c.id,{status:r.status});continue;}
 const form=r.text.slice(r.text.indexOf('id="product_addtocart_form"'));
 const final=num(/data-price-amount="([\d.]+)"\s+data-price-type="finalPrice"/.exec(form)?.[1]),old=num(/data-price-amount="([\d.]+)"\s+data-price-type="oldPrice"/.exec(form)?.[1]);
 pdp.set(c.id,{final,old:old&&final&&old>final?old:null,outOfStock:/product_outofstock="true"/.test(form.slice(0,2000))});
}
const changes=[],missing=[],gone=[];
for(const c of p.productCards){
 let s=seen.get(key(c.url))||seen.get(String(c.sku||c.id).toLowerCase());
 if(!s){const d=pdp.get(c.id)||{};
  if(d.gone){gone.push({id:c.id,title:c.title,url:decodeURI(c.url)});continue;}
  if(d.final==null){missing.push({id:c.id,title:c.title,url:decodeURI(c.url),price:c.price,...d});continue;}
  s={final:d.final,old:d.old,brand:c.brand||'',saleable:!d.outOfStock,from:'product-page'};}
 if(s.final==null)continue;
 changes.push({id:c.id,title:c.title,before:{price:c.price,regularPrice:c.regularPrice??null,brand:c.brand||''},after:{price:s.final,regularPrice:s.old,brand:s.brand||''},entityId:s.entityId,label:s.label||null,stamp:s.stamp||null,swatches:s.swatches||null,saleable:s.saleable,from:s.from||'category'});
}
const ratio=changes.filter(x=>x.before.price>0).map(x=>x.after.price/x.before.price).sort((a,b)=>a-b);
const summary={at:new Date().toISOString(),requests,cards:p.productCards.length,matched:changes.length,fromProductPage:changes.filter(x=>x.from==='product-page').length,gone:gone.length,missing:missing.length,priceChanged:changes.filter(x=>x.before.price!==x.after.price).length,
 withOldPrice:changes.filter(x=>x.after.regularPrice).length,withBrand:changes.filter(x=>x.after.brand).length,ratioMedian:ratio[Math.floor(ratio.length/2)]??null,notSaleable:changes.filter(x=>!x.saleable).length};
await mkdir(ROOT+'/reports',{recursive:true});
const file=today;
await writeFile(file,JSON.stringify({summary,pages,changes,gone,missing,listing},null,1));
console.log(summary,'\n'+file);
if(APPLY){
 const fresh=await store.read(ID),by=new Map(changes.map(x=>[x.id,x])),dead=new Set(gone.map(x=>x.id));let n=0;
 // A removed product stays in the catalog, hidden (as the module hides hidden cards), so a later return shows it again.
 fresh.productCards=fresh.productCards.map(c=>{if(dead.has(c.id)){n++;return {...c,hidden:true};}const x=by.get(c.id);if(!x)return c;n++;return {...c,price:x.after.price,regularPrice:x.after.regularPrice,brand:x.after.brand||c.brand,badges:withNative(c.badges,x,x.after.brand||c.brand),sxSale:undefined,sxStamp:undefined,sxSwatches:undefined,hidden:false,stockStatus:x.saleable?c.stockStatus:'outofstock'};});
 // The raw catalog too: cards are rebuilt from it when the profile changes, which would bring the old prices back.
 fresh.catalog.products=fresh.catalog.products.map(r=>{const x=by.get(String(r.id));return x?{...r,price:x.after.price,regularPrice:x.after.regularPrice,brand:x.after.brand||r.brand,badges:withNative(r.badges,x,x.after.brand||r.brand),sxSale:undefined,sxStamp:undefined,sxSwatches:undefined}:r;});
 fresh.events.push({text:`מחירים רועננו מדפי הקטגוריות של האתר: ${summary.priceChanged} שינויי מחיר, ${summary.withOldPrice} עם מחיר לפני הנחה, ${summary.gone} מוצרים הוסתרו כי הוסרו מהאתר`,at:summary.at});
 fresh.events=fresh.events.slice(-100);fresh.updatedAt=summary.at;await store.save(fresh);console.log('studio project updated:',n,'cards');
}
