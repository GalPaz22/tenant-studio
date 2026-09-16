import {load} from 'cheerio';
import {fetchPublic} from './discover.mjs';
const cards='li.product, article.product, .product-small, .product-item, div.product, .css-article-product';
const labels='.onsale, .matat_sale_badge, .sold-out-label, .product-label, [class*="badge"]';
export function productKey(value,base){try{const u=new URL(value,base);if(u.protocol!=='https:'&&u.protocol!=='http:')return null;return u.hostname.replace(/^www\./,'')+decodeURIComponent(u.pathname).replace(/\/$/,'')}catch{return null}}
export function extractObservations(html,pageUrl,products,observedAt=new Date().toISOString()) {
 const $=load(html),known=new Map(products.map(p=>[productKey(p.url),p])),found=new Map();
 const hidden=el=>$(el).parents().addBack().toArray().some(n=>$(n).attr('hidden')!==undefined||$(n).attr('aria-hidden')==='true'||/display\s*:\s*none|visibility\s*:\s*hidden/i.test($(n).attr('style')||''));
 $(cards).each((_,card)=>{
  // Attribute each label only to its nearest card, never its surrounding grid.
  const links=$(card).find('a[href]').toArray().filter(a=>$(a).closest(cards)[0]===card);
  const ids=new Set(links.map(a=>productKey($(a).attr('href'),pageUrl)).filter(k=>known.has(k)));
  const current=productKey(pageUrl);
  if($(card).is('div.product')&&known.has(current))ids.add(current);
  if(ids.size!==1)return;
  const key=[...ids][0],p=known.get(key);
  if(!found.has(key))found.set(key,{id:p.id,url:p.url,sourceUrl:pageUrl,observedAt,badges:[],tags:[]});
  const observation=found.get(key);
  $(card).find(labels).each((_,el)=>{
   if($(el).closest(cards)[0]!==card||hidden(el))return;
   const text=$(el).text().replace(/\s+/g,' ').trim();if(!text||text.length>100)return;
   const classes=($(el).attr('class')||'').split(/\s+/).filter(Boolean);
   const kind=classes.includes('onsale')||classes.includes('matat_sale_badge')?'sale':classes.includes('sold-out-label')?'stock':'merchant';
   if(!observation.badges.some(b=>b.text===text))observation.badges.push({text,kind,order:10+observation.badges.length,selector:classes.map(c=>'.'+c).join(''),source:'site-scraper',sourceUrl:pageUrl,observedAt});
  });
  $(card).find('.tagged_as a, a[rel="tag"]').each((_,el)=>{if($(el).closest(cards)[0]!==card||hidden(el))return;const text=$(el).text().trim();if(text&&text.length<=100&&!observation.tags.includes(text))observation.tags.push(text)});
 });
 return [...found.values()];
}
export async function scrapeCatalog(project,fetchSource=fetchPublic){
 const origin=new URL(project.url).origin;
 const pages=[...new Set([project.url,...project.catalog.products.map(p=>p.url).filter(url=>{try{return new URL(url).origin===origin}catch{return false}})])];
 const observations=[],errors=[];
 let cursor=0;
 const worker=async()=>{while(cursor<pages.length){const page=pages[cursor++];try{observations.push(...extractObservations(await fetchSource(page),page,project.catalog.products))}catch(error){errors.push({url:page,error:error.message});if(error.message==='Source HTTP 429')break;}if(fetchSource===fetchPublic)await new Promise(resolve=>setTimeout(resolve,500));}};
 await worker();
 const merged=new Map();
 for(const o of observations){const prev=merged.get(o.id);if(!prev)merged.set(o.id,o);else {for(const b of o.badges)if(!prev.badges.some(x=>x.text===b.text))prev.badges.push(b);prev.tags=[...new Set([...prev.tags,...o.tags])]}}
 return {observations:[...merged.values()],errors,pages:cursor,plannedPages:pages.length,scannedAt:new Date().toISOString(),partial:errors.length>0||cursor<pages.length};
}
export function applyObservations(products,scan){
 const byId=new Map(scan.observations.map(o=>[o.id,o]));
 return products.map(p=>{const o=byId.get(p.id);if(!o)return p;return {...p,badges:[...(p.badges||[]).filter(b=>b.source!=='site-scraper'),...o.badges],siteTags:o.tags,badgeObservation:{sourceUrl:o.sourceUrl,observedAt:o.observedAt}}});
}
