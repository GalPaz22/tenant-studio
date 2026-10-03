import {createHmac,timingSafeEqual,randomBytes} from 'node:crypto';
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {normalizeRecord} from './catalog.mjs';
import {processProduct} from './core.mjs';
import {buildSearchIndex} from './search-index.mjs';
import {hash} from './hash.mjs';

// Daily product feed from Shopify for a store whose own Semantix app (core/shopify-apps.mjs) is installed.
//   install — the merchant opens the app once; the studio (which must be reachable at STUDIO_PUBLIC_URL) runs Shopify's
//             authorization-code grant with the app's credentials and keeps the store's offline token (read_products).
//   feed    — the catalog is read from the Admin API and laid over the project: price, price before discount, stock,
//             images and variants of known products are updated in place, products that left the store are hidden,
//             new ones are added as plain cards. Nothing is re-enriched and no new search revision is created.
// App credentials come from the environment (STUDIO_SHOPIFY_APPS = {"<projectId>":{"clientId","secret"}}), like every
// other secret of the studio; store tokens are kept in the data folder, never in the project (which the browser sees).

// read_products — the daily feed. write_pixels + read_customer_events — the checkout pixel that reports purchases.
export const SCOPES='read_products,write_pixels,read_customer_events';
const SHOP=/^[a-z0-9][a-z0-9-]{0,60}\.myshopify\.com$/;
export const publicUrl=()=>{const v=process.env.STUDIO_PUBLIC_URL;if(!v)return null;const u=new URL(v);if(u.protocol!=='https:')throw Error('STUDIO_PUBLIC_URL חייב להיות HTTPS');return u.origin+u.pathname.replace(/\/+$/,'');};
export const appUrls=projectId=>{const base=publicUrl();return base?{applicationUrl:`${base}/shopify/${projectId}/app`,redirectUrl:`${base}/shopify/${projectId}/callback`}:null;};
export function appCredentials(projectId){
 let all;try{all=JSON.parse(process.env.STUDIO_SHOPIFY_APPS||'{}');}catch{throw Error('STUDIO_SHOPIFY_APPS אינו JSON תקין');}
 const c=all[projectId];return c?.clientId&&c?.secret?{clientId:String(c.clientId),secret:String(c.secret)}:null;
}

// ---------- installs (store tokens) ----------
// Where the tokens live decides who can run the feed. With a shared MongoDB collection (one document per project) the
// public studio that receives the install and the studio that holds the project can be two different machines: the
// first writes the token, the second reads it. Without one, a file in the data folder serves a single studio.
export function createInstalls(dataDir,{collection=null,ttlMs=60000,now=Date.now}={}){
 const file=join(dataDir,'shopify-installs.json');let cache=null,loadedAt=0;
 const shape=d=>({shop:d.shop,token:d.token,scope:d.scope,installedAt:d.installedAt});
 const load=async(force=false)=>{
  if(collection){
   if(force||!cache||now()-loadedAt>ttlMs){const docs=await (await collection()).find({}).toArray();cache=Object.fromEntries(docs.map(d=>[String(d._id),shape(d)]));loadedAt=now();}
   return cache;
  }
  if(!cache)try{cache=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;cache={};}
  return cache;
 };
 const save=async()=>{await mkdir(dataDir,{recursive:true});const temp=file+'.'+randomBytes(6).toString('hex')+'.tmp';await writeFile(temp,JSON.stringify(cache),{mode:0o600});await rename(temp,file);};
 return {
  shared:!!collection,
  async get(id){return (await load())[id]||null;},
  // Synchronous view for code that cannot wait (the catalog connector); null until the tokens were read once.
  peek:id=>cache?.[id]||null,
  async set(id,install){
   if(collection){await (await collection()).updateOne({_id:id},{$set:shape(install)},{upsert:true});await load(true);return;}
   (await load())[id]=shape(install);await save();
  },
  async remove(id){
   if(collection){await (await collection()).deleteOne({_id:id});await load(true);return;}
   delete (await load())[id];await save();
  },
  // What the browser may see: never the token.
  async view(id){const i=await this.get(id);return i?{shop:i.shop,scope:i.scope,installedAt:i.installedAt}:null;},
  async ids(){return Object.keys(await load());},
  load,
 };
}

// ---------- OAuth (authorization code grant) ----------
// Shopify signs every request to the app with the app's secret: all query parameters except hmac, sorted, as k=v&….
export function validHmac(query,secret){
 const {hmac,signature,...rest}=query;if(typeof hmac!=='string'||!/^[a-f0-9]{64}$/.test(hmac))return false;
 const message=Object.keys(rest).sort().map(k=>`${k}=${Array.isArray(rest[k])?rest[k].join(','):rest[k]}`).join('&');
 const expected=createHmac('sha256',secret).update(message).digest('hex');
 return timingSafeEqual(Buffer.from(hmac),Buffer.from(expected));
}
export const validShop=shop=>typeof shop==='string'&&SHOP.test(shop);
export function authorizeUrl({shop,clientId,redirectUrl,state}){
 const u=new URL(`https://${shop}/admin/oauth/authorize`);
 u.searchParams.set('client_id',clientId);u.searchParams.set('scope',SCOPES);u.searchParams.set('redirect_uri',redirectUrl);u.searchParams.set('state',state);
 return u.href;
}
export async function exchangeCode({shop,code,clientId,secret,fetch=globalThis.fetch}){
 const r=await fetch(`https://${shop}/admin/oauth/access_token`,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({client_id:clientId,client_secret:secret,code})});
 if(!r.ok)throw Error(`Shopify לא אישר את ההתקנה (HTTP ${r.status})`);
 const data=await r.json();if(typeof data.access_token!=='string'||!data.access_token)throw Error('Shopify לא החזיר טוקן');
 const scope=String(data.scope||'');if(!scope.split(',').some(s=>s==='read_products'||s==='write_products'))throw Error('ההתקנה לא כוללת הרשאת read_products');
 return {token:data.access_token,scope};
}

// ---------- checkout pixel ----------
// The app's web pixel exists in a store only once it is created there with its settings (search server + site key).
// Created when missing, updated when the settings changed; returns the pixel id.
export async function ensurePixel({shop,token,settings,apiVersion='2026-07',fetch=globalThis.fetch}){
 if(!validShop(shop))throw Error('דומיין Shopify לא תקין');
 if(!settings?.apiBase||!settings?.apiKey)throw Error('לפיקסל נדרשים שרת החיפוש ומפתח האתר');
 const call=async(query,variables)=>{
  const r=await fetch(`https://${shop}/admin/api/${apiVersion}/graphql.json`,{method:'POST',headers:{'X-Shopify-Access-Token':token,'Content-Type':'application/json'},body:JSON.stringify({query,variables})});
  if(r.status===401||r.status===403)throw Object.assign(Error('הטוקן של החנות אינו תקף או שחסרה הרשאת write_pixels'),{code:'UNAUTHORIZED'});
  if(!r.ok)throw Error(`Shopify API: HTTP ${r.status}`);
  return r.json();
 };
 const input={settings:JSON.stringify({apiBase:settings.apiBase,apiKey:settings.apiKey})};
 // The query fails with an error (not null) when the store has no pixel of this app yet.
 const existing=(await call('query{webPixel{id settings}}')).data?.webPixel||null;
 const done=(payload,what)=>{const errors=payload?.userErrors||[];if(errors.length||!payload?.webPixel?.id)throw Error(`${what} הפיקסל נכשל: ${errors.map(e=>e.message).join(' · ')||'אין תשובה מ־Shopify'}`);return payload.webPixel.id;};
 if(existing?.id){
  let same=false;try{const cur=typeof existing.settings==='string'?JSON.parse(existing.settings):existing.settings;same=cur?.apiBase===settings.apiBase&&cur?.apiKey===settings.apiKey;}catch{}
  if(same)return {id:existing.id,created:false,updated:false};
  const r=await call('mutation($id:ID!,$webPixel:WebPixelInput!){webPixelUpdate(id:$id,webPixel:$webPixel){userErrors{message} webPixel{id}}}',{id:existing.id,webPixel:input});
  return {id:done(r.data?.webPixelUpdate,'עדכון'),created:false,updated:true};
 }
 const r=await call('mutation($webPixel:WebPixelInput!){webPixelCreate(webPixel:$webPixel){userErrors{message} webPixel{id}}}',{webPixel:input});
 return {id:done(r.data?.webPixelCreate,'יצירת'),created:true,updated:false};
}

// ---------- reading the catalog ----------
const QUERY=`query($cursor:String,$n:Int!){shop{currencyCode} products(first:$n,after:$cursor,sortKey:ID){nodes{id title handle descriptionHtml vendor productType tags status onlineStoreUrl
 images(first:8){nodes{url}} variants(first:30){nodes{id title sku price compareAtPrice barcode availableForSale} pageInfo{hasNextPage endCursor}}} pageInfo{hasNextPage endCursor}}}`;
const MORE=`query($id:ID!,$cursor:String){product(id:$id){variants(first:100,after:$cursor){nodes{id title sku price compareAtPrice barcode availableForSale} pageInfo{hasNextPage endCursor}}}}`;
const tail=gid=>String(gid).split('/').pop();
// Rows in the shape of the storefront's products.json, which is what the catalog normaliser reads.
const rowOf=(p,variants,currency)=>({id:tail(p.id),title:p.title,handle:p.handle,body_html:p.descriptionHtml,vendor:p.vendor,product_type:p.productType,tags:p.tags,currency,
 published:p.status==='ACTIVE'&&!!p.onlineStoreUrl,images:p.images.nodes.map(i=>({src:i.url})),
 variants:variants.map(v=>({id:tail(v.id),title:v.title,sku:v.sku,price:v.price,compare_at_price:v.compareAtPrice,barcode:v.barcode,available:v.availableForSale}))});
export async function fetchFeed({shop,token,apiVersion='2026-07',pageSize=20,fetch=globalThis.fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms)),onPage=()=>{}}){
 if(!validShop(shop))throw Error('דומיין Shopify לא תקין');
 const url=`https://${shop}/admin/api/${apiVersion}/graphql.json`;
 const request=async(query,variables)=>{
  for(let attempt=0;;attempt++){
   const r=await fetch(url,{method:'POST',headers:{'X-Shopify-Access-Token':token,'Content-Type':'application/json'},body:JSON.stringify({query,variables})});
   if(r.status===401||r.status===403)throw Object.assign(Error('הטוקן של החנות אינו תקף — האפליקציה הוסרה או שההרשאות השתנו'),{code:'UNAUTHORIZED'});
   if(r.status===429&&attempt<5){await sleep(2000*(attempt+1));continue;}
   if(!r.ok)throw Error(`Shopify API: HTTP ${r.status}`);
   const data=await r.json(),throttled=data.errors?.some(e=>e.extensions?.code==='THROTTLED');
   if(throttled&&attempt<5){await sleep(2000*(attempt+1));continue;}
   if(data.errors?.length)throw Error('Shopify API: '+data.errors.map(e=>e.message).join(' · ').slice(0,300));
   // Leave room for the next query: wait until the bucket has refilled what this one cost.
   const cost=data.extensions?.cost,t=cost?.throttleStatus;
   if(t&&cost.actualQueryCost>t.currentlyAvailable)await sleep(Math.min(20000,Math.ceil((cost.actualQueryCost-t.currentlyAvailable)/(t.restoreRate||50)*1000)));
   return data.data;
  }
 };
 const rows=[];let cursor=null;
 for(;;){
  const data=await request(QUERY,{cursor,n:pageSize});if(!data?.products?.nodes)throw Error('Shopify API לא החזיר קטלוג תקין');
  for(const p of data.products.nodes){
   const variants=[...p.variants.nodes];let page=p.variants.pageInfo;
   while(page.hasNextPage){const more=(await request(MORE,{id:p.id,cursor:page.endCursor}))?.product?.variants;if(!more)throw Error('לא הושלמו וריאציות של מוצר');variants.push(...more.nodes);page=more.pageInfo;}
   rows.push(rowOf(p,variants,data.shop?.currencyCode||null));
  }
  await onPage(rows.length);
  if(!data.products.pageInfo.hasNextPage)break;cursor=data.products.pageInfo.endCursor;
 }
 return rows;
}

// ---------- laying the feed over the project ----------
const FIELDS=['price','regularPrice','stockStatus','image','priceRange','variants','images'];
const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
// rows: fetchFeed's. Changes project.catalog.products, project.productCards and the indexes built on them, in place.
export function applyFeed(project,rows,{now=new Date()}={}){
 if(!project.revisions?.length||!project.productCards?.length)throw Error('נדרשת גרסת חיפוש שמורה לפני עדכון הפיד');
 const at=now.toISOString(),origin=new URL(project.url).origin,feedUrl='shopify-admin-api';
 const cards=new Map(project.productCards.map(c=>[String(c.id),c])),raws=new Map((project.catalog?.products||[]).map(r=>[String(r.id),r]));
 const live=project.productCards.filter(c=>!c.hidden).length,published=rows.filter(r=>r.published).length;
 // A feed that lost most of the catalog is a failed read, not a store that emptied overnight.
 if(live>=20&&published<live*0.5)throw Error(`הפיד החזיר ${published} מוצרים פעילים מתוך ${live} — העדכון בוטל כדי לא להסתיר את הקטלוג`);
 const vectorsValid=!!project.vectorIndex&&project.vectorIndex.contentHash===hash(project.productCards);
 const profile={...project.revisions.at(-1).profile,tenantId:project.id,platform:project.platform,sourceUrl:project.url,version:`studio-${project.revisions.at(-1).number??project.revisions.length}`,publishedStatuses:['ACTIVE','publish']};
 const result={fetched:rows.length,updated:0,added:0,removed:0,restored:0,unchanged:0,skipped:0,at},seen=new Set();
 for(const row of rows){
  let fresh;try{fresh=normalizeRecord(row,'shopify',origin,feedUrl,at);}catch{result.skipped++;continue;}
  const id=String(fresh.id);seen.add(id);
  const card=cards.get(id);
  if(!card){
   if(!row.published)continue;
   const raw={...fresh,status:'ACTIVE',enrichmentStatus:'pending',source:'shopify-feed'};
   const made=processProduct(raw,profile);
   Object.assign(made,{sku:raw.sku||made.sku,variants:raw.variants||[],priceRange:raw.priceRange,images:raw.images,brand:raw.brand,enrichmentStatus:'pending',badges:made.badges||[],addedByFeedAt:at});
   (project.catalog.products??=[]).push(raw);project.productCards.push(made);cards.set(id,made);result.added++;continue;
  }
  let fields=false,visibility=false;
  // Hidden by the feed and back in the store → visible again; a product the operator hid stays hidden.
  if(!row.published){if(!card.hidden){card.hidden=true;card.feedHidden=true;visibility=true;result.removed++;}}
  else if(card.feedHidden){card.hidden=false;delete card.feedHidden;visibility=true;result.restored++;}
  const raw=raws.get(id);
  for(const k of FIELDS){
   if(fresh[k]===undefined||(k==='image'&&!fresh[k]))continue;
   if(!same(card[k],fresh[k])){card[k]=fresh[k];fields=true;}
   if(raw&&!same(raw[k],fresh[k]))raw[k]=fresh[k];
  }
  if(fields||visibility)card.feedUpdatedAt=at;
  if(fields&&!visibility)result.updated++;else if(!fields&&!visibility)result.unchanged++;
 }
 for(const [id,card] of cards)if(!seen.has(id)&&!card.hidden){card.hidden=true;card.feedHidden=true;card.feedUpdatedAt=at;result.removed++;}
 if(result.updated||result.added||result.removed||result.restored){
  // The lexical index covers every card field; vectors are keyed by product id and do not depend on price or stock.
  project.searchIndex=buildSearchIndex(project.productCards,project.searchIndex?.version||`studio-${project.revisions.length}`);
  if(vectorsValid)project.vectorIndex.contentHash=hash(project.productCards);
 }
 return result;
}

// ---------- schedule ----------
export function validateFeed(value={},now=Date.now()){
 const intervalMinutes=value.intervalMinutes??1440;
 if(!Number.isInteger(intervalMinutes)||intervalMinutes<60||intervalMinutes>10080)throw Error('תדירות עדכון הפיד: בין 60 ל־10080 דקות');
 return {enabled:value.enabled===true,intervalMinutes,nextAt:new Date(now+intervalMinutes*60000).toISOString()};
}
export const feedDue=(meta,now=Date.now())=>!!meta?.feed?.enabled&&(!meta.feed.nextAt||Date.parse(meta.feed.nextAt)<=now);
export const newState=()=>randomBytes(16).toString('hex');
