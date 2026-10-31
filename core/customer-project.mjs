import {gzipSync,gunzipSync} from 'node:zlib';
import {getMongo} from './dashboard/core/db.js';
import {existingProject,sourceFieldNames} from '../existing-client.mjs';

const COLLECTION='studio_customer_project',MAX_BYTES=64*1024*1024;
const fail=message=>Object.assign(Error(message),{status:503});
// Customer chat needs the saved engine/catalog, never private operator chats, plugins or crawl workspaces.
const FIELDS=['id','name','url','platform','status','revisions','existingClient','catalog','storeContext','updatedAt','productCards','searchIndex','productCardsProfileHash','learning','mongoPolicyDirty','dashboardExport','clientProfile','concierge','lastCustomerChatApproval'];
export function encodeCustomerProject(project){
 if(!project.existingClient?.dbName||!project.productCards?.length||!project.revisions?.length)throw fail('פרויקט החנות אינו מוכן לשיחה');
 const snapshot={...Object.fromEntries(FIELDS.filter(k=>Object.hasOwn(project,k)).map(k=>[k,project[k]])),messages:[],events:[]};
 const raw=Buffer.from(JSON.stringify(snapshot));if(raw.length>MAX_BYTES)throw fail('פרויקט החנות גדול מדי לשחזור אוטומטי');
 const data=gzipSync(raw);if(data.length>12*1024*1024)throw fail('פרויקט החנות גדול מדי לשחזור אוטומטי');
 return {dbName:project.existingClient.dbName,projectId:project.id,encoding:'gzip-json-v1',data,updatedAt:new Date().toISOString()};
}
export function decodeCustomerProject(snapshot,dbName){
 if(snapshot.dbName!==dbName||snapshot.encoding!=='gzip-json-v1')throw fail('גיבוי הפרויקט אינו שייך לחנות');
 const data=Buffer.isBuffer(snapshot.data)?snapshot.data: snapshot.data.value();
 const project=JSON.parse(gunzipSync(data,{maxOutputLength:MAX_BYTES}).toString());
 if(project.existingClient?.dbName!==dbName||project.id!==snapshot.projectId||!project.productCards?.length||!project.revisions?.length)throw fail('גיבוי הפרויקט אינו תקין');
 return project;
}
export async function saveCustomerProject(project,{mongo=getMongo,onlyIfMissing=false}={}){
 const snapshot=encodeCustomerProject(project),col=(await mongo()).db(snapshot.dbName).collection(COLLECTION);
 if(onlyIfMissing)await col.updateOne({_id:'dashboard'},{$setOnInsert:snapshot},{upsert:true});
 else await col.replaceOne({_id:'dashboard'},{_id:'dashboard',...snapshot},{upsert:true});
}
export async function loadCustomerCatalog(dbName,{mongo=getMongo}={}){
 const client=await mongo();
 const user=await client.db('users').collection('users').findOne({dbName},{projection:{dbName:1,name:1,username:1,platform:1,collections:1}});
 if(!user)throw fail('החנות אינה מחוברת למסד הנתונים');
 const fields=[...sourceFieldNames,'id','name','title','description','description1','enrichedDescription','categories','tags','softCategories','category','specifications','sku','url','permalink','image','images','price','regular_price','stockStatus','stock_status','available','status','hidden','notInStore','catalog_visibility'];
 const cursor=client.db(dbName).collection(user.collections?.products||'products').find({},{projection:Object.fromEntries(fields.map(k=>[k,1])),maxTimeMS:30000}).batchSize(100).limit(50001);
 const docs=[];let bytes=0;
 try{for await(const doc of cursor){bytes+=Buffer.byteLength(JSON.stringify(doc));if(docs.length>=50000||bytes>24*1024*1024)throw fail('הקטלוג גדול מדי לפתיחה אוטומטית; נדרש פרויקט שמור בסטודיו');docs.push(doc);}}
 finally{await cursor.close();}
 if(!docs.length)throw fail('לא נמצאו מוצרים בקטלוג החנות');
 const project=existingProject(user.name||user.username||dbName,user,docs);project.platform=user.platform||project.platform;
 return project;
}
export function createCustomerProjectRecovery(store,{mongo=getMongo,load=loadCustomerCatalog}={}){
 const pending=new Map();
 return async dbName=>{
  if(!pending.has(dbName))pending.set(dbName,(async()=>{
   // Recheck after a concurrent import. Never replace a project that an operator already opened.
   const local=(await store.metas()).filter(p=>p.dbName===dbName);
   if(local.length>1)throw fail('יש להשלים מיפוי חד־משמעי לחנות בסטודיו');
   if(local.length===1)return local[0].id;
   const snapshot=await (await mongo()).db(dbName).collection(COLLECTION).findOne({_id:'dashboard'});
   const project=snapshot?decodeCustomerProject(snapshot,dbName):await load(dbName,{mongo});
   if(project.existingClient?.dbName!==dbName)throw fail('פרויקט הסטודיו אינו שייך לחנות');
   if(!snapshot)await saveCustomerProject(project,{mongo,onlyIfMissing:true});
   // Save directly: connecting chat must never publish or change the live search engine.
   await store.save(project);return project.id;
  })().finally(()=>pending.delete(dbName)));
  return pending.get(dbName);
 };
}
