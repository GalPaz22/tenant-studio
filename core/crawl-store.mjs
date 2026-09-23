import {MongoClient} from 'mongodb';

// Crawl state shared by the studio (anywhere) and the crawl worker (locally or on Render).
// One control/progress document per tenant in `crawls`, one document per crawled page in `crawl_products`.
// Field ownership avoids lost updates: the studio writes control fields, the worker writes progress fields and the lease.
const PROGRESS=['projectId','origin','status','robots','sources','next','failures','blockedReason','startedAt','runStartedAt','runStartNext'];
const CONTROL=['desired','settings','target','reseedRequested'];
export const LEASE_MS=3*60*1000;

// Works with any collection pair that speaks the MongoDB driver API (real client or the in-memory test double).
export function crawlStoreOver({crawls,products},{now=()=>new Date()}={}){
 const saved=new Map();// projectId → Set of skus already written, so each save only sends new pages
 const known=id=>{if(!saved.has(id))saved.set(id,new Set());return saved.get(id);};
 return {
  async meta(id){const doc=await crawls.findOne({_id:id},{projection:{queue:0}});if(!doc)return null;return {...doc,productCount:await products.countDocuments({projectId:id})};},
  // Full state for the worker and for merging.
  async read(id){
   const doc=await crawls.findOne({_id:id});if(!doc)return null;const map={},keys=known(id);
   for(const p of await products.find({projectId:id},{projection:{_id:0,projectId:0}}).toArray()){map[p.sku]=p;keys.add(p.sku);}
   return {...doc,projectId:id,queue:doc.queue||[],next:doc.next||0,errors:Object.fromEntries((doc.errors||[]).map(e=>[e.url,e.error])),products:map};
  },
  async save(state,{queue=false}={}){
   const id=state.projectId,keys=known(id),fresh=Object.values(state.products||{}).filter(p=>!keys.has(p.sku));
   if(fresh.length)await products.bulkWrite(fresh.map(p=>({replaceOne:{filter:{_id:`${id}:${p.sku}`},replacement:{...p,description:String(p.description||'').slice(0,1500),projectId:id,_id:`${id}:${p.sku}`},upsert:true}})),{ordered:false});
   fresh.forEach(p=>keys.add(p.sku));
   const set={updatedAt:now().toISOString(),total:(state.queue||[]).length,errors:Object.entries(state.errors||{}).slice(-2000).map(([url,error])=>({url,error}))};for(const k of PROGRESS)if(state[k]!==undefined)set[k]=state[k];if(queue)set.queue=state.queue;
   await crawls.updateOne({_id:id},{$set:set,...(state.blockedReason===undefined&&{$unset:{blockedReason:''}})},{upsert:true});
   state.updatedAt=set.updatedAt;return state;
  },
  async control(id,fields){const set={};for(const k of CONTROL)if(fields[k]!==undefined)set[k]=fields[k];await crawls.updateOne({_id:id},{$set:{...set,controlUpdatedAt:now().toISOString()},$setOnInsert:{projectId:id,next:0,queue:[],status:'none'}},{upsert:true});},
  // Takes one tenant that should be running and has no live lease (or already belongs to this worker).
  async claim(owner){const t=now();return crawls.findOneAndUpdate({desired:'running',$or:[{lease:null},{'lease.until':{$lt:t.toISOString()}},{'lease.owner':owner}]},{$set:{lease:{owner,until:new Date(t.getTime()+LEASE_MS).toISOString(),host:owner.split('#')[0]}}},{returnDocument:'after'});},
  async renew(id,owner){const t=now();return crawls.findOneAndUpdate({_id:id,'lease.owner':owner},{$set:{'lease.until':new Date(t.getTime()+LEASE_MS).toISOString()}},{returnDocument:'after',projection:{queue:0}});},
  async release(id,owner,{desired}={}){await crawls.updateOne({_id:id,'lease.owner':owner},{$set:{lease:null,...(desired&&{desired})}});},
 };
}
export function createCrawlDb({uri=process.env.STUDIO_DASHBOARD_MONGODB_URI||process.env.MONGODB_URI,dbName=process.env.STUDIO_CRAWL_DB||'semantix_studio'}={}){
 if(!uri)throw Error('חסר חיבור ל־MongoDB עבור הסורק');
 const client=new MongoClient(uri,{serverSelectionTimeoutMS:10000});let ready;
 const connect=()=>ready??=client.connect().then(async()=>{const db=client.db(dbName);await db.collection('crawl_products').createIndex({projectId:1}).catch(()=>{});return {crawls:db.collection('crawls'),products:db.collection('crawl_products')};});
 // Lazily connected store: same interface as crawlStoreOver.
 let store;const get=async()=>store??=crawlStoreOver(await connect());
 return {client,store:new Proxy({},{get:(_,name)=>name==='then'?undefined:async(...args)=>(await get())[name](...args)}),close:()=>client.close()};
}
