import {load} from 'cheerio';
import {createHash} from 'node:crypto';
import {fetchPublic} from '../discover.mjs';
import {productKey} from '../scraper.mjs';
import {buildSearchIndex} from './search-index.mjs';

// Store labels ("2 ב100 ש"ח", "779 ש״ח לחברי vip", "10 ב299 ש"ח") as the storefront's own product grid shows them.
// They live in the theme (per-product settings), not in the catalog feed, so the studio reads them from the listing
// pages — /shop, /shop/page/2, … — where every card carries them in the same element and only the text differs. The
// labels go onto the product cards as merchant badges (source "label-scan"), the module publishes them with the
// edition, /search returns them in each product's `badges`, and the plugin renders each text in the theme's markup.
// Sale and sold-out pills are not taken from here: they follow the live price and stock.
export const LABEL_SCAN_DEFAULTS={listingPath:'/shop',pagePattern:'{listing}/page/{n}',cardSelector:'.product-item',labelSelector:'.product-img > .custom-label',maxPages:400,concurrency:3,delayMs:250};
const SOURCE='label-scan';
export function labelScanConfig(project){
 const c={...LABEL_SCAN_DEFAULTS,...(project.labelScanConfig||{})};
 for(const k of ['listingPath','pagePattern','cardSelector','labelSelector'])if(typeof c[k]!=='string'||!c[k].trim()||c[k].length>200)throw Error('הגדרת סריקת תוויות לא תקינה: '+k);
 if(!/^\//.test(c.listingPath)||!c.pagePattern.includes('{n}'))throw Error('הגדרת סריקת תוויות לא תקינה: נתיב העמודים');
 for(const k of ['maxPages','concurrency','delayMs'])c[k]=Math.max(k==='delayMs'?0:1,Math.min(k==='maxPages'?1000:k==='concurrency'?6:5000,Math.round(Number(c[k])||LABEL_SCAN_DEFAULTS[k])));
 return c;
}
export function pageUrls(project,config=labelScanConfig(project)){
 const listing=new URL(project.url).origin+config.listingPath.replace(/\/$/,'');
 return n=>n===1?listing:config.pagePattern.replace('{listing}',listing).replace('{n}',n);
}
// One listing page: {cards, labels:Map(productId → [text…])}. A card is matched to a product by its WooCommerce post id
// (class "post-123") or, failing that, by its product link.
export function extractListingLabels(html,pageUrl,lookup,config=LABEL_SCAN_DEFAULTS){
 const $=load(html),labels=new Map();let cards=0;
 $(config.cardSelector).each((_,card)=>{
  if($(card).parents(config.cardSelector).length)return;cards++;
  const post=/(?:^|\s)post-(\d+)(?:\s|$)/.exec($(card).attr('class')||'')?.[1];
  const href=$(card).find('a[href]').toArray().map(a=>$(a).attr('href')).find(h=>lookup.byUrl.has(productKey(h,pageUrl)));
  const id=(post&&lookup.byPost.get(post))||(href&&lookup.byUrl.get(productKey(href,pageUrl)));if(!id)return;
  const texts=$(card).find(config.labelSelector).toArray().map(el=>$(el).text().replace(/\s+/g,' ').trim()).filter(t=>t&&t.length<=80);
  labels.set(id,[...new Set([...(labels.get(id)||[]),...texts])]);
 });
 return {cards,labels};
}
export function catalogLookup(products){
 const byPost=new Map(),byUrl=new Map();
 for(const p of products){const id=String(p.id),n=/(\d+)$/.exec(id)?.[1];if(n&&!byPost.has(n))byPost.set(n,id);const k=productKey(p.url);if(k)byUrl.set(k,id);}
 return {byPost,byUrl};
}
// Walks the listing pages until one is empty, missing, or shows only products already seen (a theme that repeats the
// last page). complete=false when it stopped on an error or the page cap: products not seen then keep their labels.
export async function scanStoreLabels(project,{fetchSource=fetchPublic,onPage=()=>{},now=()=>new Date()}={}){
 const config=labelScanConfig(project),url=pageUrls(project,config),lookup=catalogLookup(project.catalog?.products||project.productCards||[]);
 if(!lookup.byPost.size&&!lookup.byUrl.size)throw Error('נדרש קטלוג לפני סריקת תוויות');
 const seen=new Map(),errors=[];let next=1,end=Infinity,pages=0,cards=0,matched=0;
 const worker=async()=>{
  while(next<=config.maxPages&&next<end){
   const n=next++,page=url(n);let html;
   try{html=await fetchSource(page);}catch(e){if(/HTTP 404/.test(e.message)){end=Math.min(end,n);break;}errors.push({url:page,error:e.message});if(/HTTP 429/.test(e.message)){end=Math.min(end,n);break;}continue;}
   const r=extractListingLabels(html,page,lookup,config);pages++;cards+=r.cards;
   const fresh=[...r.labels.keys()].filter(id=>!seen.has(id));
   if(!r.cards||(r.labels.size&&!fresh.length)){end=Math.min(end,n);break;}
   for(const [id,texts] of r.labels){matched+=seen.has(id)?0:1;seen.set(id,[...new Set([...(seen.get(id)||[]),...texts])]);}
   await onPage({page:n,pages,products:seen.size});
   if(config.delayMs&&fetchSource===fetchPublic)await new Promise(r=>setTimeout(r,config.delayMs));
  }
 };
 await Promise.all(Array.from({length:config.concurrency},worker));
 const complete=!errors.length&&end!==Infinity;
 const counts={};for(const texts of seen.values())for(const t of texts)counts[t]=(counts[t]||0)+1;
 const labels=Object.fromEntries([...seen].filter(([,t])=>t.length).sort((a,b)=>a[0].localeCompare(b[0])));
 return {scannedAt:now().toISOString(),pages,cards,products:seen.size,labelled:Object.keys(labels).length,complete,errors:errors.slice(0,20),labels,seen:[...seen.keys()],counts:Object.fromEntries(Object.entries(counts).sort((a,b)=>b[1]-a[1])),config:{listingPath:config.listingPath,labelSelector:config.labelSelector}};
}
const merchant=(texts,at)=>texts.map((text,i)=>({text,kind:'merchant',order:i+1,source:SOURCE,observedAt:at}));
// Writes the scan onto the catalog and the cards (so a later rebuild keeps them) without rebuilding the search index:
// labels are presentation only. Returns what changed and the digest the module edition key uses.
export function applyLabelScan(project,scan){
 const seen=new Set(scan.seen),changes={added:0,removed:0,changed:0},touch=list=>{
  for(const p of list||[]){const id=String(p.id);if(!scan.complete&&!seen.has(id))continue;
   const before=(p.badges||[]).filter(b=>b.source===SOURCE).map(b=>b.text),after=scan.labels[id]||[];
   if(JSON.stringify(before)===JSON.stringify(after))continue;
   if(list===project.productCards){if(!before.length)changes.added++;else if(!after.length)changes.removed++;else changes.changed++;}
   p.badges=[...merchant(after,scan.scannedAt),...(p.badges||[]).filter(b=>b.source!==SOURCE)];}
 };
 touch(project.catalog?.products);touch(project.productCards);
 // The search index is tied to the exact cards (contentHash): any change to them needs a fresh index, or the studio
 // refuses to search ("האינדקס אינו תואם לגרסת המוצרים").
 if(project.searchIndex&&changes.added+changes.removed+changes.changed)project.searchIndex=buildSearchIndex(project.productCards,project.searchIndex.version);
 const digest=createHash('sha256').update(JSON.stringify((project.productCards||[]).map(c=>[c.id,(c.badges||[]).filter(b=>b.source===SOURCE).map(b=>b.text)]).filter(x=>x[1].length))).digest('hex').slice(0,16);
 const {seen:_,labels,...summary}=scan;
 project.labelScan={...summary,digest,changes};
 return project.labelScan;
}
// Label scan of every product id → texts, for the studio panel ("what does the store show now").
export const labelsOf=card=>(card.badges||[]).filter(b=>b.source===SOURCE).map(b=>b.text);
