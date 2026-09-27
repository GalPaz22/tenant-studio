import {load} from 'cheerio';
import {jsonProducts} from './catalog.mjs';
import {PAGE_BYTES} from '../discover.mjs';
import {robotsRules,robotsAllows} from './site-crawler.mjs';

// Onboarding a new store from nothing but its address: find the cheapest honest way to read its whole catalog.
// Public platform API (Shopify /products.json, WooCommerce Store API) → product sitemap → following the store's own links.
// Product pages are then sampled to decide whether structured data (JSON-LD) is enough or a dedicated scraper spec is needed.

export function storeHome(input){
 let s=String(input||'').trim();if(!s||s.length>500)throw Error('יש להזין כתובת אתר');
 if(!/^[a-z][a-z0-9+.-]*:\/\//i.test(s))s='https://'+s;
 const u=new URL(s);if(u.protocol==='http:')u.protocol='https:';
 if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||!u.hostname.includes('.'))throw Error('נדרשת כתובת אתר ציבורית');
 return u.origin+'/';
}

const SIGNALS={
 shopify:[/cdn\.shopify\.com/i,/Shopify\.theme/,/myshopify\.com/i,/shopify-section/i],
 woocommerce:[/wp-content\/plugins\/woocommerce/i,/\bwoocommerce\b/i,/wc-block/i],
 magento:[/Magento_[A-Z]/,/mage\/cookies/i,/\/static\/version\d+\/frontend\//i,/data-mage-init/i],
 wordpress:[/wp-content\//i,/wp-json/i],
 wix:[/static\.wixstatic\.com|wix\.com\/|X-Wix/i],
 bigcommerce:[/cdn\d*\.bigcommerce\.com/i],
 prestashop:[/prestashop/i],
};
export function platformSignals(html){return Object.entries(SIGNALS).filter(([,res])=>res.some(re=>re.test(html))).map(([name])=>name);}

const SKIP_PATH=/\/(cart|checkout|account|my-account|login|register|wp-admin|wp-login|wishlist|compare|search|feed|tag|author|blog|news|cdn-cgi)(\/|$)|add-to-cart|\.(jpe?g|png|gif|webp|avif|svg|ico|pdf|zip|css|js|json|xml|mp4|webm|woff2?|ttf)$/i;
const PAGE_PARAM=/^(page|p|pg|paged)$/i;
// Same-origin page links worth following; queries are dropped except plain pagination.
export function pageLinks(html,base,origin){
 const $=load(html),out=new Set();origin=new URL(origin).origin;
 for(const a of $('a[href]').toArray()){
  let u;try{u=new URL($(a).attr('href'),base);}catch{continue;}
  if(u.origin!==origin||SKIP_PATH.test(u.pathname))continue;
  u.hash='';const keep=[...u.searchParams].filter(([k,v])=>PAGE_PARAM.test(k)&&/^\d{1,5}$/.test(v));u.search=keep.length?'?'+keep.map(([k,v])=>k+'='+v).join('&'):'';
  out.add(u.href);
 }
 return [...out];
}
const PRODUCTISH=/\/(products?|p|item|items|shop|dp|catalog\/product|product-page)\/[^/]+|[-_/]p[-_]?\d{3,}|\/\d{5,}(\/|$|\.html)|\.html$/i;
const LISTISH=/\/(collections?|categor(y|ies)|product-category|shop|catalog|c|department|brands?)(\/|$)/i;

// 'jsonld' when the page carries a Product JSON-LD object, 'markup' when only visible markup says it is a product page.
export function productEvidence(html){
 const found=jsonProducts(html);if(found.length===1||found.length>1&&found.length<=3)return 'jsonld';
 const $=load(html);
 if(/^product/i.test($('meta[property="og:type"]').attr('content')||'')||$('meta[property="product:price:amount"]').length||$('[itemtype*="schema.org/Product"]').length===1)return 'markup';
 const text=$('body').text();
 if($('h1').length===1&&/(add.to.cart|הוסף?ה? ל(סל|עגלה)|הוספה לסל|לרכישה|buy now|קנה עכשיו)/i.test(text)&&/(₪|\$|€|£|ש"ח|ILS|USD|EUR)\s?\d|\d[\d,.]*\s?(₪|ש"ח)/.test(text))return 'markup';
 return null;
}

// The same store with or without www. (a typed bare domain often redirects to www).
const bare=h=>h.toLowerCase().replace(/^www\./,'');
export const sameSite=(u,origin)=>{try{const a=new URL(u),b=new URL(origin);return a.protocol==='https:'&&bare(a.hostname)===bare(b.hostname);}catch{return false;}};
const locs=xml=>[...String(xml).matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\s\]]+)\s*(?:\]\]>)?\s*<\/loc>/g)].map(m=>m[1].replace(/&amp;/g,'&'));
const spread=(list,n)=>{if(list.length<=n)return list;const step=list.length/n;return Array.from({length:n},(_,i)=>list[Math.floor(i*step)]);};

async function probeJson(fetchSource,url,pick){try{const rows=pick(JSON.parse(await fetchSource(url)));return Array.isArray(rows)&&rows.length?rows:null;}catch{return null;}}
const PROBES={
 shopify:(f,o)=>probeJson(f,o+'products.json?limit=1',d=>d?.products),
 woocommerce:(f,o)=>probeJson(f,o+'wp-json/wc/store/v1/products?per_page=1',d=>d),
};

// Sitemap: robots.txt entries first, then the usual locations. Returns {url, filter, children, urls} or null.
async function findSitemap(origin,robotsText,fetchSource){
 const listed=[...String(robotsText).matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)].map(m=>m[1]).filter(u=>sameSite(u,origin));
 const tried=new Set();
 for(const url of [...listed,origin+'sitemap_index.xml',origin+'sitemap.xml',origin+'product-sitemap.xml']){
  if(tried.has(url))continue;tried.add(url);
  let xml;try{xml=await fetchSource(url,{maxBytes:64*1024*1024});}catch{continue;}
  if(!/<(sitemapindex|urlset)[\s>]/i.test(xml))continue;
  if(/<sitemapindex[\s>]/i.test(xml)){
   const children=locs(xml).filter(u=>sameSite(u,origin));if(!children.length)continue;
   const products=children.filter(u=>/product/i.test(u)),follow=(products.length?products:children).slice(0,2),urls=[];
   for(const child of follow){try{urls.push(...locs(await fetchSource(child,{maxBytes:64*1024*1024})).filter(u=>!/\.xml(\?|$)/i.test(u)));}catch{}}
   return {url,filter:products.length?'product':null,children:children.length,productSitemaps:products.length,urls};
  }
  return {url,filter:null,children:0,productSitemaps:0,urls:locs(xml).filter(u=>!/\.xml(\?|$)/i.test(u))};
 }
 return null;
}

// Samples up to `count` product pages among candidate URLs (product-looking ones first), fetching at most `budget` pages.
async function sampleProducts(candidates,fetchSource,{count=6,budget=12,robots}={}){
 const path=u=>{try{return new URL(u).pathname;}catch{return null;}},valid=candidates.filter(u=>path(u)!==null&&(!robots||robotsAllows(robots,u)));
 const ranked=[...valid.filter(u=>PRODUCTISH.test(path(u))),...valid.filter(u=>!PRODUCTISH.test(path(u)))];
 const pages=[];let fetched=0;
 for(const url of spread(ranked,Math.min(ranked.length,budget))){
  if(pages.length>=count||fetched>=budget)break;fetched++;
  try{const html=await fetchSource(url,{maxBytes:PAGE_BYTES}),kind=productEvidence(html);if(kind)pages.push({url,kind});}catch{}
 }
 return pages;
}

export async function detectStore(input,{fetchSource,onEvent=async()=>{}}={}){
 let origin=storeHome(input);const notes=[];
 await onEvent({type:'note',text:'קורא את דף הבית'});
 let html;
 try{html=await fetchSource(origin,{maxBytes:PAGE_BYTES});}catch(e){throw Error(/HTTP (403|429|503)/.test(e.message)?`האתר חוסם קריאה מהשרת (${e.message}). בקשו מהלקוח להתיר את ה־IP או לספק פיד מוצרים.`:'לא הצלחתי לקרוא את האתר: '+e.message);}
 const $h=load(html),canonical=$h('link[rel="canonical"]').attr('href')||$h('meta[property="og:url"]').attr('content');
 if(canonical&&sameSite(canonical,origin)&&new URL(canonical).origin+'/'!==origin){origin=new URL(canonical).origin+'/';notes.push('כתובת האתר הקנונית: '+origin);}
 const $=$h,title=($('meta[property="og:site_name"]').attr('content')||$('title').first().text()||new URL(origin).hostname).replace(/\s+/g,' ').trim().slice(0,120);
 const signals=platformSignals(html);
 const search=(()=>{const form=$('form[role="search"],form[action*="search"],form:has(input[type="search"])').first(),input=form.find('input[type="search"],input[name="q"],input[name="s"],input[name="query"]').first();return form.length&&input.attr('name')?{action:form.attr('action')||'/',param:input.attr('name')}:null;})();
 if(signals.length)notes.push('סימנים בקוד האתר: '+signals.join(', '));
 const ordered=[...new Set([...signals.filter(s=>PROBES[s]),'shopify','woocommerce'])];
 for(const platform of ordered){
  await onEvent({type:'note',text:`בודק API ציבורי של ${platform==='shopify'?'Shopify':'WooCommerce'}`});
  if(await PROBES[platform](fetchSource,origin)){
   notes.push(`נמצא קטלוג ציבורי (${platform==='shopify'?'/products.json':'WooCommerce Store API'}) — נקרא עד הסוף, בלי סריקת דפים`);
   return {origin,title,platform,signals,search,source:{sourceType:'platform',scraper:false},samples:[],notes};
  }
 }
 const platform=signals.includes('magento')?'magento':'custom';
 if(signals.includes('shopify')||signals.includes('woocommerce'))notes.push('ה־API הציבורי של הפלטפורמה סגור; עוברים לדפי המוצר');
 const robotsText=await fetchSource(origin+'robots.txt').catch(()=>''),robots=robotsRules(robotsText);
 await onEvent({type:'note',text:'מחפש מפת אתר (sitemap)'});
 const sitemap=await findSitemap(origin,robotsText,fetchSource);
 let samples=[],via=null;
 const moved=sitemap?.urls.find(u=>sameSite(u,origin));if(moved&&new URL(moved).origin+'/'!==origin){origin=new URL(moved).origin+'/';notes.push('כתובת האתר הקנונית: '+origin);}
 if(sitemap)sitemap.urls=sitemap.urls.filter(u=>{try{return new URL(u).origin+'/'===origin;}catch{return false;}});
 if(sitemap?.urls.length){
  notes.push(`מפת אתר: ${sitemap.url}${sitemap.productSitemaps?` (${sitemap.productSitemaps} מפות מוצרים)`:''}`);
  await onEvent({type:'note',text:'דוגם דפי מוצר ממפת האתר'});
  samples=await sampleProducts(sitemap.urls,fetchSource,{robots});if(samples.length>=2)via='sitemap';
 }
 if(!via){
  await onEvent({type:'note',text:'עוקב אחרי קישורי האתר כדי למצוא דפי מוצר'});
  const home=pageLinks(html,origin,origin),lists=home.filter(u=>LISTISH.test(new URL(u).pathname)).slice(0,3),candidates=new Set(home);
  for(const list of lists){try{for(const u of pageLinks(await fetchSource(list,{maxBytes:PAGE_BYTES}),list,new URL(origin).origin))candidates.add(u);}catch{}}
  samples=await sampleProducts([...candidates],fetchSource,{robots,budget:16});if(samples.length>=2)via='crawl';
 }
 if(!via)throw Error('לא מצאתי דפי מוצר שאפשר לקרוא בלי דפדפן. ייתכן שהאתר נבנה בצד הלקוח (JavaScript) או חוסם סורקים — בקשו מהלקוח פיד מוצרים (CSV/JSON) או גישת API.');
 const structured=samples.filter(s=>s.kind==='jsonld').length>=Math.ceil(samples.length*0.75);
 notes.push(structured?'בדפי המוצר יש נתונים מובנים (JSON-LD) — אין צורך בסורק ייעודי':'לדפי המוצר אין נתונים מובנים מלאים — המודל יכתוב סורק ייעודי לאתר');
 if(via==='crawl')notes.push('אין מפת אתר שימושית — הקטלוג ייאסף במעקב אחרי קישורי האתר');
 if(robots.delay)notes.push(`robots.txt מבקש השהיה של ${robots.delay} שניות בין בקשות`);
 const source=via==='sitemap'?{sourceType:'sitemap',sitemapUrl:new URL(new URL(sitemap.url).pathname+new URL(sitemap.url).search,origin).href,sitemapFilter:sitemap.filter,scraper:!structured}:{sourceType:'crawl',scraper:!structured};
 return {origin,title,platform,signals,search,robots:{delay:robots.delay},source,samples:samples.map(s=>s.url),notes};
}

// Build options for a demo: a complete source read, store research on, costly per-product research off,
// polite pacing for page-based sources, and a budget sized for page crawling.
export function demoBuildOptions(detection){
 const s=detection.source,pages=s.sourceType!=='platform';
 return {sourceType:s.sourceType,...(s.sitemapUrl&&{sitemapUrl:s.sitemapUrl}),...(s.sitemapFilter&&{sitemapFilter:s.sitemapFilter}),scraper:!!s.scraper,
  research:true,productResearch:false,scanPages:!pages,merchantFacts:true,vectors:false,
  politeMs:pages?Math.max(400,(detection.robots?.delay||0)*1000):0,verifySource:!pages,
  maxFetches:pages?40000:10000,maxModelCalls:1500,maxMinutes:pages?600:180,indexTarget:'local'};
}
