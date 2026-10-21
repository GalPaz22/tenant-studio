import {liveSearch} from '../analytics/live-search.js';
import {ObjectId} from 'mongodb';
import {tenantDb,controlDb,getRedis,getMongo} from '../core/db.js';
import {publishActiveRules,ACTIVE_RULES_KEY} from '../rules/publisher.js';
import {clearSearchCache} from '../optimization/boosts.js';
const fail=(message,status=400)=>Object.assign(Error(message),{status});
export const queryTerm=q=>typeof q==='string'?q.trim().replace(/\s+/g,' ').toLowerCase():'';
export function checkedLayout(body){
 const query=queryTerm(body?.query);if(!query||query.length>200)throw fail('יש להזין שאילתה באורך של עד 200 תווים');
 const clean=(value,max)=>{if(!Array.isArray(value)||value.length>max||value.some(x=>typeof x!=='string'||!/^[a-f\d]{24}$/i.test(x))||new Set(value.map(x=>x.toLowerCase())).size!==value.length)throw fail('יש לבחור מוצרים מהקטלוג ללא כפילויות');return value.map(x=>x.toLowerCase());};
 const productIds=clean(body.productIds,50),excludedProductIds=clean(body.excludedProductIds,100);
 if(productIds.some(id=>excludedProductIds.includes(id)))throw fail('מוצר אינו יכול להופיע ולהיות מוסתר באותה שאילתה');
 if(!Object.hasOwn(body,'revision')||body.revision!==null&&(typeof body.revision!=='string'||!Number.isFinite(Date.parse(body.revision))))throw fail('יש להריץ חיפוש מחדש לפני שמירה',409);
 return {query,productIds,excludedProductIds,revision:body.revision};
}
const fields={_id:1,id:1,name:1,title:1,price:1,image:1,images:1,url:1,permalink:1,hidden:1,notInStore:1,catalog_visibility:1,stockStatus:1,stock_status:1};
const imageOf=p=>{const i=p.image||p.images?.[0];return typeof i==='string'?i:i?.src||i?.url||'';};
export const publicProduct=p=>({_id:String(p._id),id:p.id==null?null:String(p.id),name:p.name||p.title||'מוצר ללא שם',image:imageOf(p),price:p.price??null,url:p.url||p.permalink||'',stockStatus:p.stockStatus||p.stock_status||'unknown',editable:p.hidden!==true&&p.notInStore!==true&&p.catalog_visibility!=='hidden'});
export async function readSearchLayout(store,query,liveProducts){
 const db=await tenantDb(store.dbName),rule=await(await controlDb()).collection('rules').findOne({dbName:store.dbName,merchantQuery:queryTerm(query)});
 const pins=rule?.patch?.pinnedResults?.[0]?.productIds||[],excluded=rule?.patch?.excludedProductIds||[];
 const rawIds=[...pins,...excluded,...liveProducts.flatMap(p=>[p._id,p.id].filter(x=>x!=null).flatMap(x=>[String(x),String(x).split(':').pop()]))];
 const ids=[...new Set(rawIds.map(String))];
 const rows=ids.length?await db.collection('products').find({$or:[{_id:{$in:ids.filter(x=>/^[a-f\d]{24}$/i.test(x)).map(x=>new ObjectId(x))}},{id:{$in:ids.flatMap(x=>Number.isFinite(Number(x))?[x,Number(x)]:[x])}}]},{projection:fields}).toArray():[];
 const byId=new Map();for(const p of rows)for(const key of [p._id,p.id].filter(x=>x!=null))byId.set(String(key),p);
 const resolve=p=>[p._id,p.id].filter(x=>x!=null).flatMap(x=>[String(x),String(x).split(':').pop()]).map(x=>byId.get(x)).find(Boolean);
 const seen=new Set(),products=[];for(const live of liveProducts){const row=resolve(live);if(row){if(!seen.has(String(row._id))){seen.add(String(row._id));products.push(publicProduct(row));}}else products.push({...live,_id:null,name:live.name||live.title||'מוצר ללא שם',image:imageOf(live),editable:false});}
 return {query:query.trim(),products,pins:rule?.status==='active'?pins.map(String):[],excludedProductIds:rule?.status==='active'?excluded.map(String):[],excludedProducts:rule?.status==='active'?excluded.map(id=>byId.get(String(id))).filter(Boolean).map(publicProduct):[],revision:rule?.updatedAt?.toISOString?.()||null};
}
export async function saveSearchLayout(store,body){
 const layout=checkedLayout(body),db=await controlDb(),col=db.collection('rules'),identity={dbName:store.dbName,merchantQuery:layout.query};
 await col.createIndex({dbName:1,merchantQuery:1},{unique:true,partialFilterExpression:{merchantQuery:{$type:'string'}}});
 let updatedAt,patch,active;const session=(await getMongo()).startSession();
 try{await session.withTransaction(async()=>{
 const previous=await col.findOne(identity,{session});if((previous?.updatedAt?.toISOString?.()||null)!==layout.revision)throw fail('הסידור עודכן בינתיים. יש להריץ חיפוש מחדש לפני שמירה.',409);
 const all=[...layout.productIds,...layout.excludedProductIds],rows=all.length?await(await tenantDb(store.dbName)).collection('products').find({_id:{$in:all.map(x=>new ObjectId(x))}},{projection:fields,session}).toArray():[];
 if(rows.length!==all.length)throw fail('אחד המוצרים אינו שייך לחנות או אינו זמין עוד');
 if(rows.some(p=>layout.productIds.includes(String(p._id))&&!publicProduct(p).editable))throw fail('אין להוסיף לתוצאות מוצר מוסתר או שאינו מוצג בחנות');
 const unavailable=rows.filter(p=>layout.productIds.includes(String(p._id))&&(p.stockStatus||p.stock_status)==='outofstock');
 if(unavailable.length){const live=await liveSearch(store,layout.query);const liveIds=new Set(live.flatMap(p=>[p._id,p.id].filter(x=>x!=null).flatMap(x=>[String(x),String(x).split(':').pop()])));if(unavailable.some(p=>![p._id,p.id].filter(x=>x!=null).some(x=>liveIds.has(String(x)))))throw fail('מוצר שאזל מהמלאי ניתן לסידור רק אם הוא כבר מופיע בתוצאות המנוע');}
 patch={...(layout.productIds.length?{pinnedResults:[{query:layout.query,productIds:layout.productIds,enabled:true,matchType:'exact'}]}:{}),...(layout.excludedProductIds.length?{excludedProductIds:layout.excludedProductIds}:{})};
 updatedAt=new Date(Math.max(Date.now(),+(previous?.updatedAt||0)+1));active=all.length>0;
 const next={...identity,tenantApiKey:store.apiKey,name:`דמו חיפוש: ${layout.query}`,condition:{mode:'queryMatch',patterns:[layout.query],matchType:'exact'},patch,status:active?'active':'disabled',updatedAt};
 if(previous){const result=await col.updateOne({...identity,_id:previous._id,updatedAt:previous.updatedAt},{$set:next},{session});if(!result.matchedCount)throw fail('הסידור השתנה במקביל. יש להריץ חיפוש מחדש.',409);}
 else{try{await col.insertOne({...next,createdAt:updatedAt},{session});}catch(e){if(e.code===11000)throw fail('נשמר סידור במקביל. יש להריץ חיפוש מחדש.',409);throw e;}}
 await db.collection('catalog_change_audits').insertOne({dbName:store.dbName,kind:'querySearchLayout',appliedBy:body.by,appliedAt:updatedAt,query:layout.query,before:previous?.patch||{},after:patch},{session});
 });}finally{await session.endSession();}
 let published=false;try{await publishActiveRules(store.apiKey);const redis=await getRedis();if(redis){const wire=JSON.parse(await redis.get(ACTIVE_RULES_KEY(store.apiKey))||'[]');published=active?wire.some(r=>r.condition?.patterns?.[0]===layout.query&&JSON.stringify(r.patch)===JSON.stringify(patch)):!wire.some(r=>r.condition?.patterns?.[0]===layout.query);}}catch{}
 if(published&&layout.excludedProductIds.length){try{const response=await fetch(new URL('/health',process.env.SEARCH_SERVICE_URL||'https://api.semantix-ai.com'),{signal:AbortSignal.timeout(3000)});const health=await response.json();published=health.features?.querySearchLayouts===true;}catch{published=false;}}
 await clearSearchCache(store.dbName).catch(()=>{});
 return {saved:true,published,revision:updatedAt.toISOString()};
}
