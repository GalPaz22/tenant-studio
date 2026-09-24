import {MongoClient} from 'mongodb';
import {buildSearchIndex} from './search-index.mjs';
import {processProduct} from './core.mjs';
import {hash} from './catalog.mjs';
import {extractWithSpec,productKey,DEFAULT_SPEC,rx} from './scraper-builder.mjs';

// Honest, identifiable crawler for a client's own public product pages: robots.txt is obeyed, one request at a time,
// and the crawl stops by itself when the host starts refusing (redirect off-site, 403/429/503).
export const CRAWLER_UA='Mozilla/5.0 (compatible; SemantixCatalogBot/1.0; +https://semantix.co.il/bot)';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const productNumber=url=>{try{const m=new URL(url).pathname.match(/\/(?:digital\/)?(\d{6,14})\/?$/);return m?m[1]:null;}catch{return null;}};

export function robotsRules(text){
 const rules=[];let applies=false,delay=null,inGroup=false;
 for(const raw of String(text||'').split('\n')){const line=raw.replace(/#.*/,'').trim();const m=line.match(/^([\w-]+)\s*:\s*(.*)$/);if(!m)continue;const [,key,value]=m,k=key.toLowerCase();
  if(k==='user-agent'){if(!inGroup)applies=false;inGroup=true;if(value==='*'||/semantix/i.test(value))applies=true;continue;}
  inGroup=false;if(!applies)continue;
  if(k==='disallow'&&value)rules.push({allow:false,path:value});else if(k==='allow'&&value)rules.push({allow:true,path:value});else if(k==='crawl-delay'&&Number(value)>0)delay=Number(value);}
 return {rules,delay};
}
// Longest matching rule wins; * matches anything, $ anchors the end (Google semantics).
export function robotsAllows(robots,url){
 const u=new URL(url),target=u.pathname+u.search;let best=null;
 for(const r of robots.rules){if(/^https?:/.test(r.path))continue;const re=new RegExp('^'+r.path.split('*').map(s=>s.replace(/[.+?^${}()|[\]\\]/g,'\\$&')).join('.*').replace(/\\\$$/,'$'));if(re.test(target)&&(!best||r.path.length>best.path.length||r.path.length===best.path.length&&r.allow))best=r;}
 return !best||best.allow;
}
export function parseProductPage(html,url){
 const blocks=[...String(html).matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].flatMap(m=>{try{const d=JSON.parse(m[1]);return Array.isArray(d)?d:d['@graph']||[d];}catch{return [];}});
 const d=blocks.find(b=>b&&b.offers&&(b.sku||b.name));if(!d)return null;
 const offer=Array.isArray(d.offers)?d.offers[0]:d.offers,name=v=>typeof v==='string'?v:v?.name,list=v=>(Array.isArray(v)?v:[v]).map(name).filter(Boolean).join(', ');
 const availability=String(offer?.availability||'').split('/').pop();
 return {sku:String(d.sku||productNumber(url)||''),name:String(d.name||'').trim(),url:d.url||url,image:typeof d.image==='string'?d.image:d.image?.[0]||d.image?.url||null,description:String(d.description||'').slice(0,4000),
  price:Number.isFinite(Number(offer?.price))?Number(offer.price):null,currency:offer?.priceCurrency||null,stockStatus:/^instock$/i.test(availability)?'instock':availability?'outofstock':'unknown',
  author:list(d.author)||null,publisher:list(d.publisher)||null,type:String(d['@type']||''),isbn:d.isbn||null};
}

export async function get(url,{fetcher=fetch}={}){
 const r=await fetcher(url,{redirect:'manual',headers:{'User-Agent':CRAWLER_UA,Accept:'text/html,application/xml;q=0.9,*/*;q=0.8'},signal:AbortSignal.timeout(20000)});
 const location=r.headers.get('location');
 if(r.status>=300&&r.status<400){const next=location&&new URL(location,url);if(!next||next.host!==new URL(url).host){const e=Error('הופנה אל '+(next?.host||'?'));e.blocked=true;throw e;}return get(next.href,{fetcher});}
 if([403,429,503].includes(r.status)){const e=Error('HTTP '+r.status);e.blocked=true;throw e;}
 if(r.status!==200){const e=Error('HTTP '+r.status);e.status=r.status;throw e;}
 return r.text();
}
const locs=xml=>[...String(xml).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m=>m[1].replace(/&amp;/g,'&'));

// Discovery: clicked products (what shoppers want) first, then product sitemaps, then product URLs already in the catalog.
export async function seedCrawl(project,{fetcher=fetch,clicks=readClickedUrls,catalogUrls=p=>(p.productCards||[]).map(c=>c.url).filter(Boolean),sources:use={clicks:true,sitemap:true,catalog:true},spec=null}={}){
 const origin=new URL(project.url).origin,robots=robotsRules(await get(origin+'/robots.txt',{fetcher}).catch(()=>'')),seen=new Map(),sources={clicks:0,sitemap:0,catalog:0};
 // With a dedicated spec the product key and URL come from its productUrl rule; the default keeps numeric-id URLs.
 const add=(url,source)=>{const n=spec?productKey(url,spec):productNumber(url);if(!n||seen.has(n))return;let clean;try{const u=new URL(url,origin);if(u.origin!==origin)return;u.hash='';clean=spec?u.href:origin+'/'+n;}catch{return;}if(!robotsAllows(robots,clean))return;seen.set(n,clean);sources[source]++;};
 if(use.clicks)try{for(const u of await clicks(project))add(u,'clicks');}catch{}
 if(use.sitemap){const index=await get(origin+'/sitemap.xml',{fetcher}).catch(()=>'');
  for(const map of locs(index).filter(u=>rx(spec?.sitemapFilter||'product').test(u))){await sleep(1000);for(const u of locs(await get(map,{fetcher}).catch(()=>'')))add(u,'sitemap');}}
 if(use.catalog)try{for(const u of await catalogUrls(project))add(u,'catalog');}catch{}
 return {projectId:project.id,origin,status:'ready',robots,sources,queue:[...seen.values()],next:0,products:{},errors:{},failures:0,startedAt:new Date().toISOString(),dedicated:!!spec};
}
export async function readClickedUrls(project){
 const uri=process.env.STUDIO_DASHBOARD_MONGODB_URI||process.env.MONGODB_URI;if(!project.existingClient||!uri)return [];
 const c=new MongoClient(uri,{serverSelectionTimeoutMS:8000});
 try{await c.connect();const db=c.db(project.existingClient.dbName),counts=new Map();
  for(const name of ['product_clicks','cart'])for(const d of await db.collection(name).aggregate([{$match:{product_url:{$type:'string'}}},{$group:{_id:'$product_url',n:{$sum:1}}}],{maxTimeMS:60000}).toArray()){const n=productNumber(d._id);if(n)counts.set(d._id,(counts.get(d._id)||0)+d.n);}
  return [...counts].sort((a,b)=>b[1]-a[1]).map(([u])=>u);
 }finally{await c.close();}
}

// Runs (or resumes) the crawl, checkpointing every few pages. Returns the final state.
export async function runCrawl(state,{store,fetcher=fetch,rateMs=1000,limit=Infinity,onProgress=()=>{},shouldStop=()=>false,spec=null}={}){
 const delay=Math.max(rateMs,(state.robots?.delay||0)*1000);let fetched=0;state.status='running';await store.save(state);
 while(state.next<state.queue.length&&fetched<limit){
  if(shouldStop()){state.status='stopped';break;}
  const url=state.queue[state.next];
  try{const html=await get(url,{fetcher}),page=spec?extractWithSpec(html,url,spec):parseProductPage(html,url),key=page&&(page.key||page.sku);if(key)state.products[key]={...page,sku:key,crawledAt:new Date().toISOString()};else state.errors[url]='אין נתוני מוצר בדף';state.failures=0;state.next++;}
  catch(e){
   if(e.blocked){state.failures++;if(state.failures>=3){state.status='blocked';state.blockedReason=e.message;break;}await sleep(60000*state.failures);continue;}
   if(Object.keys(state.errors).length<2000)state.errors[url]=e.message;state.next++;
  }
  fetched++;if(fetched%20===0){await store.save(state);onProgress(state);}
  await sleep(delay);
 }
 if(state.status==='running')state.status=state.next>=state.queue.length?'done':'paused';
 await store.save(state);onProgress(state);return state;
}

// Merges crawled pages into the working catalog: fills missing author/publisher, refreshes price and stock,
// and adds products that the client database lacks. Returns counts; rebuilds the local index.
export function mergeCrawl(p,state,spec=null){
 const cards=p.productCards||[],byNumber=new Map(),keyOf=url=>spec?productKey(url,spec):productNumber(url);
 for(const c of cards){const n=keyOf(c.url)||String(c.id).split(':').pop();if(n)byNumber.set(n,c);}
 const sample=cards.find(c=>keyOf(c.url)&&String(c.id).endsWith(keyOf(c.url))),prefix=sample?String(sample.id).slice(0,-keyOf(sample.url).length):'crawl:';
 const profile=p.revisions.at(-1).profile,client={...profile,tenantId:p.id,version:`studio-${p.revisions.length}`,publishedStatuses:['ACTIVE','publish']};
 const counts={updated:0,added:0,stockChanged:0,authorsFilled:0};
 for(const page of Object.values(state.products||{})){
  const at=page.crawledAt,card=byNumber.get(page.sku);
  if(card){
   let touched=false;
   const specs={...card.specifications};
   if(page.author&&!specs.author){specs.author=page.author;counts.authorsFilled++;touched=true;}
   if(page.publisher&&!specs.publisher){specs.publisher=page.publisher;touched=true;}
   for(const [k,v] of Object.entries(page.extra||{}))if(v&&!specs[k]){specs[k]=v;touched=true;}
   if(page.stockStatus!=='unknown'&&page.stockStatus!==card.stockStatus){card.stockStatus=page.stockStatus;counts.stockChanged++;touched=true;}
   if(page.price!==null&&page.price!==card.price){card.price=page.price;touched=true;}
   if(!card.description&&page.description){card.description=page.description;touched=true;}
   card.specifications=specs;card.provenance={...card.provenance,siteCrawl:{at,url:page.url}};if(touched)counts.updated++;
  }else{
   const raw={id:prefix+page.sku,name:page.name,description:page.description,categories:[],tags:[],specifications:{...page.extra,...(page.author&&{author:page.author}),...(page.publisher&&{publisher:page.publisher}),...(page.isbn&&{isbn:String(page.isbn)})},url:page.url,image:page.image,price:page.price,currency:page.currency,stockStatus:page.stockStatus,status:'ACTIVE',source:'site-crawl'};
   const c=processProduct(raw,client);c.provenance={...c.provenance,siteCrawl:{at,url:page.url}};cards.push(c);p.catalog.products.push(raw);byNumber.set(page.sku,c);counts.added++;
  }
 }
 p.productCards=cards;p.searchIndex=buildSearchIndex(cards,'crawl-'+Date.now());delete p.vectorIndex;p.productCardsProfileHash=hash(profile);p.mongoPolicyDirty=true;
 p.siteCrawl={mergedAt:new Date().toISOString(),pages:Object.keys(state.products||{}).length,...counts};
 return counts;
}

export async function readCatalogUrls(project){
 const uri=process.env.STUDIO_DASHBOARD_MONGODB_URI||process.env.MONGODB_URI;if(!project.existingClient||!uri)return [];
 const c=new MongoClient(uri,{serverSelectionTimeoutMS:8000});
 try{await c.connect();return (await c.db(project.existingClient.dbName).collection('products').find({url:{$type:'string'}},{projection:{_id:0,url:1},maxTimeMS:60000}).toArray()).map(d=>d.url);}finally{await c.close();}
}
