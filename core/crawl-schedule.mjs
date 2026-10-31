import {productKey,DEFAULT_SPEC} from './scraper-builder.mjs';

// Automatic site scans: the crawl jobs in Mongo are rescanned on a schedule, one at a time. This needs no project files,
// so it runs on Render, where the studio has no disk. A job an operator stopped stays stopped.
export const scansEnabled=(env=process.env)=>env.STUDIO_AUTO_SCAN?env.STUDIO_AUTO_SCAN==='1':!!env.RENDER;
const skipped=(job,skip)=>{const host=(()=>{try{return new URL(job.target.url).hostname.toLowerCase();}catch{return '';}})(),db=String(job.target.dbName||'').toLowerCase();return skip.some(s=>s===db||host.includes(s));};
export function scanDue(job,{now=Date.now(),hours=6,skip=['steimatzky']}={}){
 if(!job.target?.url||skipped(job,skip)||job.desired==='running'||job.desired==='stopped')return false;
 const last=Date.parse(job.updatedAt||'');return !Number.isFinite(last)||now-last>=hours*3600000;
}
export async function scanTick(store,{env=process.env,now=Date.now(),launch=()=>{},log=()=>{}}={}){
 const hours=Number(env.STUDIO_AUTO_SCAN_HOURS)>0?Number(env.STUDIO_AUTO_SCAN_HOURS):6,skip=(env.STUDIO_AUTO_SCAN_SKIP??'steimatzky').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 const jobs=await store.list();if(jobs.some(j=>j.desired==='running'))return null;
 const job=jobs.filter(j=>scanDue(j,{now,hours,skip})).sort((a,b)=>String(a.updatedAt).localeCompare(String(b.updatedAt)))[0];if(!job)return null;
 await store.control(job._id,{desired:'running',reseedRequested:true,rescanRequested:true,fullRescanRequested:false});log(job._id,'auto scan');launch(job._id);return job._id;
}

// A store with syncMode "studio" has no other feed: its live rows change only through here. Other stores sync themselves
// and are left alone. Only what a scan observed is written, and lastSeenAt stays untouched (retiredRows would hide every
// row that lacks it). A scan that would take a large share of the catalog off sale is held back as a likely site fault.
const MAX_LOST_SHARE=0.2,onSale=s=>s==='instock'||s==='onbackorder';
export async function applyScanToStore(client,state,job,{dryRun=false,now=new Date(),log=()=>{}}={}){
 const dbName=job.target?.dbName;if(!dbName)return {skipped:'no database'};
 if(!await client.db('users').collection('users').findOne({dbName,syncMode:'studio'},{projection:{_id:1}}))return {skipped:'store syncs itself'};
 const spec=job.target.spec||DEFAULT_SPEC,col=client.db(dbName).collection('products');
 const rows=await col.find({},{projection:{id:1,url:1,permalink:1,price:1,regular_price:1,stockStatus:1,stock_status:1}}).toArray(),byKey=new Map();
 for(const r of rows){const key=productKey(r.url||r.permalink||'',spec);if(key)byKey.set(key,r);}
 const ops=[],counts={rows:rows.length,stock:0,price:0,added:0,lost:0};
 for(const page of Object.values(state.products||{})){const row=byKey.get(page.key||page.sku);
  if(!row){
   // Only the store's own listing vouches for a new product; a page read has no store id and may be a retired page.
   if(!page.productId||!onSale(page.stockStatus))continue;
   ops.push({updateOne:{filter:{id:page.productId},update:{$setOnInsert:{id:page.productId,name:page.name,description:page.description||'',url:page.url,image:page.image,images:page.image?[{src:page.image}]:[],price:page.price,regular_price:page.regularPrice??page.price,currency:page.currency,categories:page.categories||[],tags:[],stockStatus:page.stockStatus,stock_status:page.stockStatus,status:'publish',hidden:false,source:'site-scan',fetchedAt:now}},upsert:true}});counts.added++;continue;}
  const set={},stock=row.stockStatus||row.stock_status;
  if(page.stockStatus&&page.stockStatus!=='unknown'&&page.stockStatus!==stock){set.stockStatus=page.stockStatus;set.stock_status=page.stockStatus;counts.stock++;if(onSale(stock)&&!onSale(page.stockStatus))counts.lost++;}
  if(page.price!=null&&page.price!==row.price){set.price=page.price;counts.price++;}
  if(page.regularPrice!=null&&page.regularPrice!==row.regular_price)set.regular_price=page.regularPrice;
  if(Object.keys(set).length)ops.push({updateOne:{filter:{_id:row._id},update:{$set:{...set,scannedAt:now}}}});
 }
 if(counts.lost>rows.length*MAX_LOST_SHARE){log(job._id,'held back: too many products would leave sale',counts.lost);return {...counts,heldBack:true};}
 if(!dryRun&&ops.length)await col.bulkWrite(ops,{ordered:false});
 return {...counts,writes:ops.length,dryRun};
}
