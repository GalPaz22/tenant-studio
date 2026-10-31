import {readFileSync} from 'node:fs';
import {localImports} from './artifacts.mjs';
import {hash} from './core/catalog.mjs';

// A per-tenant "mini server" for dashboard-server: tenants/<slug>/ holds this merchant's own search service — the studio
// engine, its profile (rules, ranking, pipeline policy), and a snapshot of its enriched product cards — behind the same
// route contract as tenants/garmin (search + load-more middleware, cursor tokens, 503 on failure). Live price, stock and
// visibility come from the merchant's Mongo collection; products added since the snapshot are searchable unenriched.
// tenants/semantix-registry.mjs mounts every such folder once; a module answers only when the merchant's user document
// switches it on: users.users → semantix:{module:<slug>, enabled:true, percent}.
export const slugOf=p=>String(p.existingClient?.username||p.name||new URL(p.url).hostname).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'tenant-'+p.id.slice(0,8);
const LIVE=['price','regularPrice','stockStatus','hidden','status','url','image'];

// Everything in the module that is code (engine + templates + registry). It changes only when the studio's own code
// changes — never from agent work, which is data published to Mongo — and then the module must be re-exported and deployed.
export function moduleCode(){
 const files={};for(const file of localImports(['runtime.mjs','core/hook-worker.mjs']))files['engine/'+file]=readFileSync(new URL(file,import.meta.url),'utf8');
 Object.assign(files,{'sessions.mjs':SESSIONS,'search.mjs':SEARCH(LIVE),'index.mjs':INDEX,'../semantix-registry.mjs':REGISTRY});return files;
}
export function buildMiniServer(project,{slug=slugOf(project)}={}){
 const revision=project.revisions.at(-1);if(!revision)throw Error('ללקוח אין עדיין גרסה');
 if(!project.productCards?.length)throw Error('ללקוח אין כרטיסי מוצר');
 const base=`tenants/${slug}/`,files={},dbName=project.existingClient?.dbName||null,collection=project.existingClient?.collection||'products';
 const manifest={kind:'semantix-tenant-module',version:1,slug,tenantId:project.id,name:project.name,url:project.url,platform:project.platform,dbName,collection,
  tokenPrefix:`${slug}-v3:`,revision:revision.number,profileHash:hash(revision.profile),products:project.productCards.length,builtAt:new Date().toISOString(),
  switch:{field:'users.users.semantix',value:{module:slug,enabled:true,percent:100}}};
 files[base+'semantix.module.json']=JSON.stringify(manifest,null,2);
 files[base+'profile.json']=JSON.stringify(revision.profile);
 files[base+'snapshot.json']=JSON.stringify({productCards:project.productCards,storeContext:project.storeContext||null,tagAssignments:project.tagAssignments||{},studioVectors:project.studioVectors||null});
 // The functions' worker is loaded by URL, not imported, so it is named explicitly (see moduleCode).
 for(const [name,content] of Object.entries(moduleCode()))files[name==='../semantix-registry.mjs'?'tenants/semantix-registry.mjs':base+name]=content;
 files[base+'INSTALL.md']=INSTALL(manifest);
 return {manifest,files};
}

const SESSIONS=`import {randomUUID} from 'node:crypto';
// Ranked result snapshots in Mongo (chunks of 50) so load-more works across server instances and restarts.
const TTL_MS=30*60*1000,expired=()=>Error('Search expired; start a new search'),ready=new WeakMap();
export function createSessions(collection,{now=Date.now}={}){
 async function index(){if(!ready.has(collection))ready.set(collection,collection.createIndex({expiresAt:1},{expireAfterSeconds:0}).catch(e=>{ready.delete(collection);throw e;}));await ready.get(collection);}
 return {
  async save(result,limit){
   if(result.total<=limit)return {...result,matches:result.matches.slice(0,limit),nextCursor:null};
   await index();const id=randomUUID(),expiresAt=new Date(now()+TTL_MS),{matches,...meta}=result;
   const docs=[];for(let i=0;i<matches.length;i+=50)docs.push({_id:id+':'+i/50,session:id,chunk:i/50,expiresAt,matches:matches.slice(i,i+50),...(i===0&&{meta:{...meta,total:matches.length}})});
   await collection.insertMany(docs);
   return {...result,matches:matches.slice(0,limit),total:matches.length,nextCursor:id+':'+limit};
  },
  async read(cursor,limit){
   const m=/^([0-9a-f-]{36}):(\\d{1,6})$/.exec(String(cursor));if(!m)throw Error('Invalid cursor');const [,id,offsetText]=m,offset=Number(offsetText);
   const first=await collection.findOne({_id:id+':0'});if(!first||first.expiresAt<new Date(now()))throw expired();
   const matches=[];for(let c=Math.floor(offset/50);c<=Math.floor((offset+limit-1)/50);c++){const doc=c===0?first:await collection.findOne({_id:id+':'+c});if(doc)matches.push(...doc.matches.map((p,i)=>({p,i:c*50+i})));}
   const page=matches.filter(x=>x.i>=offset&&x.i<offset+limit).map(x=>x.p),total=first.meta.total;
   return {...first.meta,matches:page,total,nextCursor:offset+limit<total?id+':'+(offset+limit):null};
  }
 };
}
`;

const SEARCH=live=>`import {readFileSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createDraftRuntime} from './engine/runtime.mjs';
import {processProduct,retiredRows,feedCategories} from './engine/core/core.mjs';
import {hash} from './engine/core/hash.mjs';
import {createSessions} from './sessions.mjs';
const read=name=>JSON.parse(readFileSync(new URL(name,import.meta.url),'utf8'));
export const manifest=read('./semantix.module.json');
const LIVE=${JSON.stringify(live)};
const strings=v=>Array.isArray(v)?v.map(x=>typeof x==='string'?x:x?.name).filter(x=>typeof x==='string'):typeof v==='string'&&v?[v]:[];
const number=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
// Merchant-row fields the engine card lacks but a storefront needs: the platform's own item id (add to cart, tracking),
// its catalog number, the subtitle, the sale flag and sale price, the feed's offer id and the per-format price labels
// a card template prints (specialLabel: printed / digital / club). Only these ride along; the engine's own fields win on a clash.
const SOURCE_FIELDS=['ItemID','Makat','Subtitle','onSale','offerId','salePrice','specialLabel'];
const sources=new WeakMap();
export function withSource(rows){
 let byId=sources.get(rows);
 if(!byId){byId=new Map();for(const r of rows){const s={};for(const k of SOURCE_FIELDS)if(r[k]!==undefined&&r[k]!==null)s[k]=r[k];if(Object.keys(s).length)byId.set(String(r.id??r._id),s);}sources.set(rows,byId);}
 return p=>{const s=byId.get(String(p.id))||byId.get(String(p.id).split(':').pop());return s?{...s,...p}:p;};
}
// A merchant Mongo row in the engine's raw shape (as the studio imports existing clients).
export function adaptRow(row,retired=()=>false){
 return {id:String(row.id??row._id),name:row.name||row.title||'',sku:String(row.sku||''),url:row.url||row.permalink,image:row.image||row.images?.[0]?.src||row.images?.[0]||null,
  price:number(row.price),regularPrice:number(row.regularPrice??row.regular_price),currency:row.currency||null,
  stockStatus:row.stockStatus||row.stock_status||'unknown',status:row.status||'ACTIVE',
  // Hidden as the studio imports it: the store's own flag, "not in store", a catalog visibility of "hidden", or an
  // row the store has retired (dead product page, never seen by a sync, or out of stock with no price / missed by the latest sync — retiredRows).
  hidden:row.hidden===true||row.notInStore===true||row.catalog_visibility==='hidden'||retired(row),
  categories:(c=>c.length?c:feedCategories(row))(strings(row.categories?.length?row.categories:row.category)),tags:[...new Set([...strings(row.tags),...strings(row.siteTags),...(row.isWooPopular===true?['isWooPopular']:[])])],
  // WooCommerce's popular flag and sales count, read live: the engine lifts popular products by default, best sellers first.
  ...(typeof row.isWooPopular==='boolean'&&{popular:row.isWooPopular}),...(Number(row.total_sales)>0&&{popularity:Number(row.total_sales)}),
  description:String(row.description||row.short_description||'').replace(/<[^>]+>/g,' ').replace(/\\s+/g,' ').trim().slice(0,18000),specifications:row.specifications&&typeof row.specifications==='object'&&!Array.isArray(row.specifications)?row.specifications:{}};
}
// Enriched snapshot cards with live commercial fields; new products are processed with the same profile. seen collects
// the ids of the live rows the cards cover.
export function mergeLive(cards,rows,profile,tenantId,seen=new Set()){
 const retired=retiredRows(rows),live=new Map(rows.map(r=>{const a=adaptRow(r,retired);return [a.id,a];})),out=[];
 for(const c of cards){const key=String(c.id).split(':').pop(),row=live.get(String(c.id))||live.get(key);if(!row)continue;seen.add(row.id);
  const next={...c};for(const k of LIVE)if(row[k]!==undefined&&row[k]!==null)next[k]=row[k];
  // The store's popular flag and sales follow the live rows, so a newly popular product is lifted without a new edition.
  if(row.popular!==undefined){const tags=(next.tags||[]).filter(t=>t!=='isWooPopular');next.tags=row.popular?[...tags,'isWooPopular']:tags;}
  if(row.popularity)next.popularity=row.popularity;if(!next.categories?.length&&row.categories.length)next.categories=row.categories;out.push(next);}
 const client={...profile,tenantId,version:'semantix-mini',publishedStatuses:['ACTIVE','publish']};
 for(const [id,row] of live)if(!seen.has(id))out.push({...processProduct(row,client),...(row.popularity&&{popularity:row.popularity})});
 return out;
}
// The module's data (approved revision: profile + enriched cards) is published by the studio to the store's own
// database: semantix_module → "<slug>:head" points at a gzip edition stored in parts. The head is one _id lookup,
// checked at most every checkMs; an edition is downloaded only when its digest changes. Local profile.json/snapshot.json
// (a downloaded ZIP) are used only while nothing is published. A failed check keeps serving the edition in memory.
// An edition keeps its parsed cards only until the build that uses them: the runtime then holds its own copy, and a
// later live rebuild downloads the edition again by digest (or rereads the local snapshot.json).
export async function loadEdition(store,head){
 const parts=await store.find({kind:'part',slug:manifest.slug,digest:head.digest}).toArray();
 if(parts.length!==head.parts)throw Error('Published module is incomplete');
 const bytes=v=>v?._bsontype==='Binary'?Buffer.from(v.buffer):Buffer.from(v);
 const gz=Buffer.concat(parts.sort((a,b)=>a.part-b.part).map(p=>bytes(p.data)));
 if(createHash('sha256').update(gz).digest('hex').slice(0,24)!==head.digest)throw Error('Published module is corrupt');
 return {...JSON.parse(gunzipSync(gz).toString('utf8')),digest:head.digest,parts:head.parts};
}
const snapshotOf=async(e,store)=>e.snapshot??(e.digest==='local'?read('./snapshot.json'):(await loadEdition(store,e)).snapshot);
const local=()=>{const has=n=>existsSync(new URL(n,import.meta.url));return has('./profile.json')&&has('./snapshot.json')?{revision:manifest.revision,profile:read('./profile.json'),digest:'local'}:null;};
// The live-rows part of the fingerprint, once per rows array (the loader returns the same array until it refreshes,
// and a refresh is a new array): hashing the whole catalog on every search and suggestion cost CPU and garbage.
const prints=new WeakMap();
const rowsPrint=rows=>{let p=prints.get(rows);if(p===undefined)prints.set(rows,p=hash(rows.map(r=>[r.id??r._id,...LIVE.map(k=>r[k]??r[k==='stockStatus'?'stock_status':k]??null),r.catalog_visibility??null,r.notInStore??null,r.lastSeenAt??null,r.pageCheck?.status??null,r.isWooPopular??null,r.total_sales??null])));return p;};
// Live rows the built edition already covers with enriched cards are cut down to what the fingerprint, the live fields,
// the hidden rule and withSource read; their text (description, specifications, images...) stays only in the runtime.
// Rows the edition lacks keep everything: a build processes them as new products. Only the module's own row loader
// (it can reload) has its rows slimmed, in place, so a caller's own array is never changed.
const SLIM_FIELDS=['_id','id','price','regularPrice','regular_price','currency','stockStatus','stock_status','status','hidden','notInStore','catalog_visibility','lastSeenAt','pageCheck','isWooPopular','total_sales','url','permalink','image',...SOURCE_FIELDS];
const slim=new WeakSet();
function slimRow(r){const s={};for(const k of SLIM_FIELDS)if(r[k]!==undefined)s[k]=r[k];if(!r.categories?.length&&!r.category?.length){const feed=feedCategories(r);if(feed.length)s.productTypes=feed;}if(!r.image&&r.images?.length)s.images=[r.images[0]];slim.add(s);return s;}
function compact(rows,covered){for(let i=0;i<rows.length;i++){const r=rows[i];if(!slim.has(r)&&covered.has(String(r.id??r._id)))rows[i]=slimRow(r);}}
// A slimmed row this edition has no card for would be processed from its live fields alone.
function uncovered(cards,rows){if(!rows.some(r=>slim.has(r)))return false;const ids=new Set();for(const c of cards){ids.add(String(c.id));ids.add(String(c.id).split(':').pop());}
 return rows.some(r=>slim.has(r)&&!ids.has(String(r.id??r._id)));}
// liveRebuildMs: a rebuild of the whole runtime costs seconds of CPU on a large catalog and blocks every search on the
// server meanwhile, so live price/stock changes are folded in twice a day (a new edition is built at once).
export function createTenantSearch({loadRows,checkMs=30000,liveRebuildMs=43200000,now=Date.now}={}){
 let fingerprint=null,runtime=null,edition=null,checkedAt=-Infinity,checking=null,building=null,builtDigest=null,builtAt=-Infinity,covered=null;
 async function published(store){
  if(store&&now()-checkedAt>=checkMs)checking??=(async()=>{
   try{const head=await store.findOne({_id:manifest.slug+':head'},{projection:{digest:1,parts:1,revision:1}});
    if(head&&head.digest!==edition?.digest)edition=await loadEdition(store,head);else if(!head&&edition?.digest!=='local')edition=null;checkedAt=now();}
   catch(e){if(!edition)throw e;console.error('[SEMANTIX '+manifest.slug+'] keeping revision',edition.revision,'-',e.message);checkedAt=now();}
   finally{checking=null;}})();
  if(checking)await checking;
  return edition??=local()??(()=>{throw Error('No published module data');})();
 }
 async function current(collection,store){
  const e=await published(store),rows=await loadRows(collection),print=e.digest+':'+rowsPrint(rows);
  // The first build answers this request. Later changes (a new edition, live price or stock) are built in the background
  // while the previous runtime keeps answering, so no shopper waits for a rebuild of the whole catalog.
  if(!runtime)await (building??=build(e,rows,collection,store).finally(()=>{building=null;}));
  else if(print!==fingerprint&&!building&&(e.digest!==builtDigest||now()-builtAt>=liveRebuildMs))building=new Promise(r=>setTimeout(r,0)).then(()=>build(e,rows,collection,store))
   .catch(err=>console.error('[SEMANTIX '+manifest.slug+'] rebuild failed, keeping revision',runtime.revision,'-',err.message)).finally(()=>{building=null;});
  // Rows refreshed since the last build are slimmed against the edition that build used.
  if(loadRows.reload&&covered&&builtDigest===e.digest)compact(rows,covered);
  runtime.attach=withSource(rows);
  return runtime;
 }
 async function build(e,rows,collection,store){
  const s=await snapshotOf(e,store);
  // Rows slimmed against an earlier edition that this one does not carry are read again in full.
  if(loadRows.reload&&uncovered(s.productCards,rows))rows=await loadRows.reload(collection);
  const seen=new Set(),cards=mergeLive(s.productCards,rows,e.profile,manifest.tenantId,seen);
  const next=createDraftRuntime({id:manifest.tenantId,url:manifest.url,platform:manifest.platform,productCards:cards,productCardsProfileHash:hash(e.profile),storeContext:s.storeContext,tagAssignments:s.tagAssignments,studioVectors:s.studioVectors,catalog:{products:[]}},{number:e.revision,profile:e.profile});
  next.revision=e.revision;next.attach=withSource(rows);runtime=next;fingerprint=e.digest+':'+rowsPrint(rows);builtDigest=e.digest;builtAt=now();covered=seen;delete e.snapshot;
  if(loadRows.reload)compact(rows,seen);
 }
 // Page size when the storefront sends no limit: the tenant's pipeline.pageSize (published with the profile), else 12.
 const search=async function({collection,sessions,moduleStore,request}){
  const limit=request.limit??(await published(moduleStore)).profile?.pipeline?.pageSize??12;if(!Number.isInteger(limit)||limit<1||limit>50)throw Error('Invalid limit');
  if(request.cursor){if(request.query!==undefined)throw Error('Invalid request');if(!sessions)throw Error('Search expired; start a new search');return createSessions(sessions).read(request.cursor,limit);}
  const rt=await current(collection,moduleStore);let r=await rt.search({query:request.query,limit:50});const matches=[...r.matches];
  while(r.nextCursor&&matches.length<500){r=await rt.search({cursor:r.nextCursor,limit:50});matches.push(...r.matches);}
  const attached=matches.map(rt.attach),result={...r,matches:attached,total:matches.length,nextCursor:null,metadata:{...r.metadata,searchEngine:'semantix-'+manifest.slug,revision:rt.revision}};
  return sessions?createSessions(sessions).save(result,limit):{...result,matches:attached.slice(0,limit)};
 };
 // Suggestions while the shopper types: the same edition and live rows as search, answered from the index only.
 search.suggest=async({collection,moduleStore,query,limit})=>{
  const rt=await current(collection,moduleStore);if(typeof rt.suggest!=='function')throw Error('Engine has no suggestions; export the module again');
  const r=await rt.suggest(query,{limit});return {...r,matches:r.matches.map(rt.attach),revision:rt.revision};
 };
 return search;
}
// Default Mongo loader: the merchant's products collection. Only the first load makes a search wait: rows older than ttlMs
// are refreshed in the background while the cached ones keep answering (a failed refresh keeps them). Every refresh
// decodes the whole collection; it runs twice a day, like the live rebuild that uses it.
export function createRowLoader({ttlMs=43200000,now=Date.now,max=60000}={}){
 let cached=null,expires=0,pending=null;
 const get=async collection=>{
  if(cached){if(now()>=expires&&!pending)load(collection).catch(e=>console.error('[SEMANTIX '+manifest.slug+'] catalog refresh failed -',e.message));return cached;}
  return load(collection);
 };
 // A fresh full read, for a build that finds rows slimmed against another edition.
 get.reload=collection=>load(collection);
 return get;
 function load(collection){
  if(pending)return pending;
  pending=(async()=>{const cursor=collection.find({},{projection:{_id:1,id:1,name:1,title:1,sku:1,url:1,permalink:1,image:1,images:1,price:1,regularPrice:1,regular_price:1,currency:1,stockStatus:1,stock_status:1,status:1,hidden:1,notInStore:1,catalog_visibility:1,lastSeenAt:1,pageCheck:1,productTypes:1,customAttributes:1,isWooPopular:1,total_sales:1,categories:1,category:1,tags:1,siteTags:1,description:1,short_description:1,specifications:1,...Object.fromEntries(SOURCE_FIELDS.map(k=>[k,1]))},maxTimeMS:20000}).limit(max+1).batchSize(500);
   try{const rows=await cursor.toArray();if(rows.length>max)throw Error('Catalog exceeds safety limit');cached=rows;expires=now()+ttlMs;return rows;}finally{await cursor.close?.();}})()
   .finally(()=>{pending=null;});
  return pending;
 }
}
`;

const INDEX=`import {createTenantSearch,createRowLoader,manifest} from './search.mjs';
export {manifest};
// Same contract as tenants/garmin/routes.mjs: middleware for POST /search and GET /search/load-more.
// The registry decides whether this tenant answers (control document, rollout, circuit breaker); with onError set, a
// failed new search falls through to the existing pipeline instead of returning an error to the shopper.
export function storefrontResponse(result,modern=true){
 const products=(result.matches||[]).map(p=>({...p,name:p.title??p.name,badges:p.badges||[]}));
 if(!modern)return products;
 const token=result.nextCursor?manifest.tokenPrefix+result.nextCursor:null;
 return {...result,matches:products,products,metadata:{...result.metadata,searchEngine:'semantix-'+manifest.slug},pagination:{totalAvailable:result.total,returned:products.length,hasMore:!!token,nextToken:token,nextCursor:result.nextCursor,secondBatchToken:null,categoryFilterToken:null,hasCategoryFiltering:false}};
}
export function createTenantRoutes({getDb,search=createTenantSearch({loadRows:createRowLoader()}),enabled=req=>{const s=req.store?.semantix;return !!s&&s.module===manifest.slug&&s.enabled===true;},onError=null,onServed=()=>{}}={}){
 const mine=req=>!!manifest.dbName&&req.store?.dbName===manifest.dbName;
 async function send(req,res,next,request,modern,fresh){
  const limit=request.limit===undefined||request.limit===null||request.limit===''?undefined:Number(request.limit);
  if(limit!==undefined&&(!Number.isInteger(limit)||limit<1||limit>50))return res.status(400).json({error:'Invalid limit'});
  if(request.cursor?typeof request.cursor!=='string'||!request.cursor:typeof request.query!=='string'||!request.query.trim()||request.query.length>300)return res.status(400).json({error:'Invalid request'});
  try{const db=await getDb(manifest.dbName);const result=await search({collection:db.collection(req.store.products||manifest.collection||'products'),sessions:db.collection('semantix_'+manifest.slug.replace(/-/g,'_')+'_sessions'),moduleStore:db.collection('semantix_module'),request:{...request,limit}});
   res.setHeader('X-Semantix-Tenant',manifest.slug+'@'+(result.metadata?.revision??manifest.revision));if(result.nextCursor)res.setHeader('X-Next-Token',manifest.tokenPrefix+result.nextCursor);onServed();return res.json(storefrontResponse(result,modern));}
  catch(error){if(error.message==='Search expired; start a new search'||error.message==='Invalid cursor')return res.status(410).json({error:'Search expired; start a new search'});
   console.error('[SEMANTIX '+manifest.slug+']',error.message);
   if(onError){onError(error);if(fresh&&!res.headersSent)return next();}
   return res.status(503).json({error:'Search temporarily unavailable',retryable:true,metadata:{searchEngine:'semantix-'+manifest.slug}});}
 }
 return {
  manifest,
  search(req,res,next){if(!mine(req)||!enabled(req))return next();if(req.body.cursor!==undefined&&req.body.query!==undefined)return res.status(400).json({error:'Cursor cannot be combined with query'});
   const fresh=req.body.cursor===undefined,request=fresh?{query:req.body.query,limit:req.body.limit}:{cursor:req.body.cursor,limit:req.body.limit};return send(req,res,next,request,req.body.modern===true||req.body.modern==='true',fresh);},
  // GET /autocomplete — suggestions decided by this module's rules (spelling, linked terms, tags, hidden products,
  // stock policy, the tenant's functions), without a model call. Rows keep the shape the storefront already reads.
  // A query the module has nothing for, or any failure, falls through to the existing autocomplete.
  async autocomplete(req,res,next){if(!mine(req)||!enabled(req)||typeof search.suggest!=='function')return next();
   const query=typeof req.query.query==='string'?req.query.query.trim():'';if(query.length<2||query.length>300)return next();
   try{const db=await getDb(manifest.dbName),r=await search.suggest({collection:db.collection(req.store.products||manifest.collection||'products'),moduleStore:db.collection('semantix_module'),query,limit:Math.min(Math.max(parseInt(req.query.limit,10)||8,1),24)});
    if(!r.matches.length)return next();
    res.setHeader('X-Semantix-Tenant',manifest.slug+'@'+(r.revision??manifest.revision));onServed();
    return res.json(r.matches.map(p=>{const {description,specifications,provenance,issues,badgeCandidates,...rest}=p,name=p.title??p.name;return {...rest,suggestion:name,name,source:'products',author:specifications?.author||rest.author||''};}));}
   catch(error){console.error('[SEMANTIX '+manifest.slug+'] autocomplete',error.message);if(onError)onError(error);return next();}
  },
  // Our own paging tokens are always served while the module is loaded, even if it was just switched off.
  loadMore(req,res,next){const token=req.query.token;if(typeof token!=='string'||!token.startsWith(manifest.tokenPrefix))return next();if(!mine(req))return res.status(400).json({error:'Invalid pagination token'});return send(req,res,next,{cursor:token.slice(manifest.tokenPrefix.length),limit:req.query.limit},true,false);}
 };
}
`;

const REGISTRY=`import {readdir,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
export const REGISTRY_VERSION=5;
// Mounts every tenants/<slug>/ folder that has a semantix.module.json. Modules load lazily on the first request.
// Whether a module answers is a field on the merchant's user document (users.users), which dashboard-server copies into
// req.store.semantix:  {module:"<slug>", enabled:true, percent:100}
//   - module must be this module's slug and the store's dbName must be the module's dbName;
//   - enabled:false (or no field) → the existing search answers; percent < 100 → that share of shoppers (stable per session);
// Store config is cached by dashboard-server (5 minutes), so a change reaches the server within that time.
// Circuit breaker: 5 failures within a minute pause the module for 5 minutes; failed searches fall through to the
// existing pipeline, so shoppers get the old search rather than an error.
export const userSwitch=store=>{const s=store?.semantix;if(!s||typeof s!=='object')return null;const percent=Number(s.percent);
 return {module:String(s.module||''),enabled:s.enabled===true,percent:Number.isFinite(percent)?Math.max(0,Math.min(100,percent)):100};};
export function createSemantixTenants({getDb,dir=new URL('./',import.meta.url),now=Date.now,breaker={failures:5,windowMs:60000,coolMs:300000}}={}){
 let loading=null;const state=new Map();
 const tenant=slug=>{if(!state.has(slug))state.set(slug,{failures:[],openUntil:0,served:0,fellBack:0,lastError:null});return state.get(slug);};
 function decide(manifest,store){
  const sw=userSwitch(store);
  if(!sw||sw.module!==manifest.slug)return {on:false,source:sw?'user-other-module':'user-no-field'};
  if(store?.dbName!==manifest.dbName)return {on:false,source:'db-mismatch'};
  return {on:sw.enabled,percent:sw.percent,source:'user'};
 }
 const bucket=req=>{const key=String(req.body?.session_id||req.body?.sessionId||req.query?.session_id||req.get?.('X-Session-Id')||req.ip||'');return parseInt(createHash('sha1').update(key).digest('hex').slice(0,8),16)%100;};
 // Every decision for the module's own store is visible: X-Semantix-Decision on the response, and a log line per
 // module per minute (so "why is the old search answering?" is answered from DevTools or the server log).
 const logged=new Map();
 function explain(manifest,req,verdict){
  if(req.store?.dbName!==manifest.dbName)return;if(!req.res?.headersSent)req.res?.setHeader('X-Semantix-Decision',manifest.slug+' '+verdict);
  const key=manifest.slug+verdict,at=now();if(at-(logged.get(key)||0)<60000)return;logged.set(key,at);
  console.log('[SEMANTIX '+manifest.slug+'] decision',verdict,'| user field',JSON.stringify(req.store?.semantix??null));
 }
 function allowed(manifest,req){const d=decide(manifest,req.store),t=tenant(manifest.slug);
  const verdict=!d.on?'off:'+(d.source==='user'?'enabled-false':d.source):t.openUntil>now()?'off:circuit-open':d.percent>=100||bucket(req)<d.percent?'on':'off:rollout-'+d.percent+'%';
  explain(manifest,req,verdict);return verdict==='on';}
 function failed(slug,error){const t=tenant(slug),at=now();t.lastError={message:error.message,at:new Date(at).toISOString()};t.fellBack++;t.failures=[...t.failures.filter(x=>at-x<breaker.windowMs),at];
  if(t.failures.length>=breaker.failures){t.openUntil=at+breaker.coolMs;t.failures=[];console.error('[SEMANTIX] circuit open for',slug,'until',new Date(t.openUntil).toISOString());}}
 const load=()=>loading??=(async()=>{const routes=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){if(!entry.isDirectory())continue;const folder=new URL(entry.name+'/',dir);
   try{JSON.parse(await readFile(new URL('semantix.module.json',folder),'utf8'));}catch{continue;}
   try{const mod=await import(pathToFileURL(new URL('index.mjs',folder).pathname).href),manifest=mod.manifest;
    routes.push(mod.createTenantRoutes({getDb,enabled:req=>allowed(manifest,req),onError:e=>failed(manifest.slug,e),onServed:()=>{tenant(manifest.slug).served++;}}));}
   catch(e){console.error('[SEMANTIX] failed to load tenant',entry.name,e.message);}}
  return routes;})();
 const chain=kind=>async(req,res,next)=>{let routes;try{routes=await load();}catch(e){console.error('[SEMANTIX]',e.message);return next();}
  // A module exported before a route kind existed simply has no say in it.
  let i=0;const step=()=>{while(i<routes.length&&typeof routes[i][kind]!=='function')i++;return i<routes.length?routes[i++][kind](req,res,step):next();};return step();};
 return {
  search:chain('search'),loadMore:chain('loadMore'),autocomplete:chain('autocomplete'),
  // Per module: what is loaded, which users switch it on (users.users.semantix), circuit state and counters since start.
  async status(){const routes=await load();let users=[],usersError=null;
   try{users=await (await getDb('users')).collection('users').find({'semantix.module':{$in:routes.map(r=>r.manifest.slug)}},{projection:{_id:0,username:1,dbName:1,semantix:1}}).toArray();}catch(e){usersError=e.message;}
   return {usersError,
    tenants:routes.map(r=>{const m=r.manifest,t=tenant(m.slug),u=users.filter(x=>x.semantix?.module===m.slug);return {slug:m.slug,dbName:m.dbName,revision:m.revision,builtAt:m.builtAt,
     users:u.map(x=>({username:x.username,dbName:x.dbName,...userSwitch({semantix:x.semantix}),matchesDb:x.dbName===m.dbName,updatedAt:x.semantix?.updatedAt||null})),
     circuitOpenUntil:t.openUntil>now()?new Date(t.openUntil).toISOString():null,served:t.served,fellBack:t.fellBack,lastError:t.lastError};})};},
  // GET handler for operators: requires SEMANTIX_ADMIN_TOKEN in X-Semantix-Admin.
  async statusRoute(req,res){const token=process.env.SEMANTIX_ADMIN_TOKEN;if(!token||req.get('X-Semantix-Admin')!==token)return res.status(404).end();res.set('Cache-Control','no-store').json(await this.status());}
 };
}
`;

const INSTALL=m=>`# Semantix tenant module — ${m.name} (${m.slug})

Revision ${m.revision}, ${m.products} product cards, built ${m.builtAt}.

## Install into dashboard-server (once for all Semantix tenants)

Copy \`tenants/${m.slug}/\` and \`tenants/semantix-registry.mjs\` into dashboard-server. In server.js, next to the Garmin routes:

\`\`\`js
import {createSemantixTenants} from './tenants/semantix-registry.mjs';
const semantixTenants=createSemantixTenants({getDb:async name=>(await getMongoClient()).db(name)});
app.get('/semantix/status',(req,res)=>semantixTenants.statusRoute(req,res));
\`\`\`

put \`semantixTenants.search\` first on \`app.post("/search", …)\`, \`semantixTenants.loadMore\` first on \`app.get("/search/load-more", …)\` and \`semantixTenants.autocomplete\` first on \`app.get("/autocomplete", …)\` (suggestions then follow the module's rules; without it the existing autocomplete keeps answering), and in the store config built from the user document add:

\`\`\`js
semantix: userDoc.semantix && typeof userDoc.semantix === "object" ? userDoc.semantix : null,
\`\`\`

## Switching on and off

On the merchant's user document (\`users.users\`, the one with dbName \`${m.dbName||'?'}\`):

\`\`\`js
semantix: {module: "${m.slug}", enabled: true, percent: 100}
\`\`\`

\`enabled:false\` or no field → the existing search answers; \`percent:10\` → 10% of sessions. Tenant Studio's “שליטה בפרודקשן” panel writes this field. The store config is cached for up to 5 minutes. Failures fall back to the existing search; 5 failures in a minute pause the module for 5 minutes. \`GET /semantix/status\` with header \`X-Semantix-Admin: $SEMANTIX_ADMIN_TOKEN\` shows each module, the users that switch it on, the circuit and counters.

Pagination tokens start with \`${m.tokenPrefix}\`; sessions live in \`semantix_${m.slug.replace(/-/g,'_')}_sessions\`. Live price/stock/visibility come from the \`${m.collection}\` collection every minute; the approved revision (profile + enriched cards) is published by the studio to \`semantix_module\` in the store database and picked up within 30 seconds — re-export only when the engine code changes.
`;
