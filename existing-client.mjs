import {MongoClient} from 'mongodb';
import {randomUUID} from 'node:crypto';
import {createDraftRuntime} from './runtime.mjs';
import {buildSearchIndex} from './core/search-index.mjs';
import {hash} from './core/catalog.mjs';
const list=v=>(Array.isArray(v)?v:typeof v==='string'?v.split(','):[]).map(x=>typeof x==='string'?x:x?.name||x?.label).filter(Boolean);
export const sourceFieldNames=['author','publisher','isbn','language','originalTitle','originalLanguage','translator','publicationYear','series','brand'];
export function sourceSpecifications(d){const specs={...(d.specifications||{})};for(const key of sourceFieldNames){const v=d[key];if(typeof v==='string'||typeof v==='number')specs[key]=String(v);else if(Array.isArray(v)&&v.every(x=>typeof x==='string'))specs[key]=v.join(' · ');}return specs;}
export async function refreshSourceFields(p){
 if(!p.existingClient)throw Error('נדרש לקוח קיים');
 const c=new MongoClient(process.env.STUDIO_DASHBOARD_MONGODB_URI||process.env.MONGODB_URI,{serverSelectionTimeoutMS:8000});
 try{await c.connect();const projection=Object.fromEntries(['id',...sourceFieldNames].map(k=>[k,1]));const cursor=c.db(p.existingClient.dbName).collection(p.existingClient.collection||'products').find({},{projection,maxTimeMS:30000});
 const cards=new Map(p.productCards.map(x=>[x.id,x])),raws=new Map(p.catalog.products.map(x=>[String(x.id),x]));const counts={};let updated=0;
 for await(const d of cursor){const id=String(d.id??d._id),card=cards.get(id);if(!card)continue;const specs=sourceSpecifications(d);if(!Object.keys(specs).length)continue;updated++;card.specifications={...card.specifications,...specs};const raw=raws.get(id);if(raw)raw.specifications={...raw.specifications,...specs};for(const k of Object.keys(specs))counts[k]=(counts[k]||0)+1;}
 p.searchIndex=buildSearchIndex(p.productCards,'source-fields-'+Date.now());delete p.vectorIndex;p.mongoPolicyDirty=true;p.existingClient.sourceFields={at:new Date().toISOString(),updated,counts};return p.existingClient.sourceFields;
 }finally{await c.close()}
}
const fieldPath=f=>{if(typeof f!=='string'||!/^[A-Za-z_]\w{0,60}(\.[A-Za-z_]\w{0,60}){0,3}$/.test(f)||f.split('.').some(k=>['__proto__','constructor','prototype'].includes(k)))throw Error('שם שדה לא תקין');return f;};
const at=(d,path)=>path.split('.').reduce((v,k)=>v==null?v:Array.isArray(v)?v.map(x=>x?.[k]):v[k],d);
const text=v=>typeof v==='string'||typeof v==='number'?String(v):Array.isArray(v)?v.map(x=>typeof x==='string'||typeof x==='number'?String(x):x?.name||x?.label).filter(Boolean).join(' · '):typeof v==='object'&&v?v.name||v.label||'':'';
async function withDatabase(p,fn){
 if(!p.existingClient)throw Error('נדרש לקוח קיים');const uri=process.env.STUDIO_DASHBOARD_MONGODB_URI||process.env.MONGODB_URI;if(!uri)throw Error('חסר חיבור למסד הנתונים');
 const c=new MongoClient(uri,{serverSelectionTimeoutMS:8000});try{await c.connect();return await fn(c.db(p.existingClient.dbName));}finally{await c.close()}
}
async function withProducts(p,fn){
 if(!p.existingClient)throw Error('נדרש לקוח קיים');const uri=process.env.STUDIO_DASHBOARD_MONGODB_URI||process.env.MONGODB_URI;if(!uri)throw Error('חסר חיבור למסד הנתונים');
 const c=new MongoClient(uri,{serverSelectionTimeoutMS:8000});try{await c.connect();return await fn(c.db(p.existingClient.dbName).collection(p.existingClient.collection||'products'));}finally{await c.close()}
}
export function describeFields(docs){
 const fields=new Map();const walk=(v,path,depth)=>{if(v&&typeof v==='object'&&!Array.isArray(v)&&depth<3&&!(v instanceof Date)&&!v._bsontype){for(const [k,x] of Object.entries(v))walk(x,path?path+'.'+k:k,depth+1);return;}const f=fields.get(path)||{field:path,count:0,types:new Set(),examples:[]};f.count++;f.types.add(Array.isArray(v)?'array':v===null?'null':typeof v);const t=text(v).slice(0,120);if(t&&f.examples.length<3&&!f.examples.includes(t))f.examples.push(t);fields.set(path,f);};
 for(const d of docs)walk(d,'',0);return [...fields.values()].filter(f=>f.field!=='_id').sort((a,b)=>b.count-a.count).map(f=>({...f,types:[...f.types]}));
}
export const dbFields=p=>withProducts(p,async col=>{const docs=await col.aggregate([{$sample:{size:300}}],{maxTimeMS:20000}).toArray();return {total:await col.estimatedDocumentCount(),sampled:docs.length,fields:describeFields(docs),note:'שדות מתוך דגימה אקראית של המסד; שדה נדיר עשוי לא להופיע'};});
export async function dbSearch(p,{field,contains='',offset=0},open=withProducts){
 fieldPath(field);if(typeof contains!=='string'||contains.length>200||!Number.isInteger(offset)||offset<0)throw Error('חיפוש לא תקין');
 return open(p,async col=>{const filter=contains?{[field]:{$regex:contains.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),$options:'i'}}:{[field]:{$exists:true,$nin:[null,'',[]]}};
 const [total,docs]=await Promise.all([col.countDocuments(filter,{maxTimeMS:20000}),col.find(filter,{projection:{id:1,name:1,title:1,[field]:1},maxTimeMS:20000}).skip(offset).limit(20).toArray()]);
 return {field,total,products:docs.map(d=>({id:String(d.id??d._id),title:d.name||d.title||'',value:text(at(d,field)).slice(0,500)}))};});
}
export async function importDbField(p,{field,target},open=withProducts){
 fieldPath(field);if(typeof target!=='string'||!/^[\p{L}\w]{1,60}$/u.test(target)||['__proto__','constructor','prototype'].includes(target))throw Error('שם יעד לא תקין');
 if(p.productCards.some(c=>Object.hasOwn(c.specifications||{},target)))throw Error('שדה היעד כבר קיים. בחר שם חדש');
 return open(p,async col=>{const cards=new Map(p.productCards.map(x=>[x.id,x])),raws=new Map(p.catalog.products.map(x=>[String(x.id),x])),ids=[];
 for await(const d of col.find({[field]:{$exists:true}},{projection:{id:1,[field]:1},maxTimeMS:60000})){const id=String(d.id??d._id),card=cards.get(id),v=text(at(d,field)).slice(0,2000);if(!card||!v)continue;card.specifications={...card.specifications,[target]:v};const raw=raws.get(id);if(raw)raw.specifications={...raw.specifications,[target]:v};ids.push(id);}
 if(!ids.length)throw Error('לא נמצאו ערכים בשדה הזה עבור מוצרי הקטלוג');
 p.processingHistory??=[];p.processingHistory.push({target,source:'db:'+field,ids,at:new Date().toISOString(),kind:'database-source'});p.processingHistory=p.processingHistory.slice(-10);
 return {imported:ids.length,field:target,from:field,notice:'ערכי מקור מהמסד; ניתנים לחיפוש לאחר הבנייה מחדש'};});
}
export function existingProject(username,user,docs){
 const products=docs.map(d=>({id:String(d.id??d._id),name:d.name||d.title||'',description:d.enrichedDescription||d.description1||d.description||'',categories:list(d.categories),tags:[...new Set([...list(d.tags),...list(d.softCategories),...list(d.category)])],specifications:sourceSpecifications(d),sku:d.sku||'',url:d.url||d.permalink,image:typeof d.image==='string'?d.image:d.image?.src||d.images?.[0]?.src,price:d.price!=null&&d.price!==''&&Number.isFinite(Number(d.price))?Number(d.price):null,regularPrice:d.regular_price!==''&&d.regular_price!=null?Number(d.regular_price):null,stockStatus:d.stockStatus||d.stock_status||(d.available===true?'instock':'unknown'),status:d.status||'ACTIVE',hidden:d.hidden===true||d.notInStore===true||d.catalog_visibility==='hidden'}));
 let url='https://existing-client.invalid/';for(const p of products){try{const u=new URL(p.url);if(['http:','https:'].includes(u.protocol)){url=u.origin;break}}catch{}}
 const tags=[...new Set(products.flatMap(p=>p.tags))],categories=[...new Set(products.flatMap(p=>p.categories))];
 const profile={name:username,domain:'retail',productTypes:{},colors:{},finishes:{},queryAliases:{},tagDefinitions:{},badgeCandidates:{categories:[],tags:[]},badgeRules:[],pipeline:{maxCandidates:100,lightweightRouter:true}};
 const p={id:randomUUID(),name:username,url,platform:'custom',status:'draft',events:[],messages:[],revisions:[{number:1,profile,note:'פתיחת לקוח קיים מהנתונים השמורים',createdAt:new Date().toISOString()}],existingClient:{username,dbName:user.dbName,collection:user.collections?.products||'products',loadedAt:new Date().toISOString(),tags,categories},catalog:{products,coverage:{scope:'saved-database-snapshot',complete:true,count:products.length}},storeContext:{name:username,summary:'נתונים שמורים של לקוח קיים',categories, tags},updatedAt:new Date().toISOString()};
 const rt=createDraftRuntime(p,p.revisions[0]);p.productCards=rt.products;p.searchIndex=rt.index;p.productCardsProfileHash=hash(profile);return p;
}
export async function resolveExistingUser(collection,input){
 const value=input.trim(),projection={dbName:1,collections:1};
 for(const field of ['username','name','dbName']){
  const matches=await collection.find({[field]:value},{projection}).limit(2).toArray();
  if(matches.length>1)throw Error('נמצאו כמה לקוחות תואמים. יש להזין שם משתמש או שם לקוח ייחודי');
  if(matches.length===1)return matches[0];
 }
 return null;
}
export async function loadExistingClient(username){
 if(typeof username!=='string'||!username.trim()||username.length>120)throw Error('יש להזין שם משתמש קיים');
 const uri=process.env.STUDIO_DASHBOARD_MONGODB_URI||process.env.MONGODB_URI;if(!uri)throw Error('לא הוגדר חיבור למסד הנתונים של הלקוחות');
 const client=new MongoClient(uri,{serverSelectionTimeoutMS:8000});
 try{await client.connect();const user=await resolveExistingUser(client.db('users').collection('users'),username);
 if(!user?.dbName)throw Error('לא נמצא לקוח עם שם המשתמש הזה');
 const collection=client.db(user.dbName).collection(user.collections?.products||'products');
 const docs=await collection.find({},{projection:{...Object.fromEntries(sourceFieldNames.map(k=>[k,1])),id:1,name:1,title:1,description:1,description1:1,enrichedDescription:1,categories:1,tags:1,softCategories:1,category:1,specifications:1,sku:1,url:1,permalink:1,image:1,images:1,price:1,regular_price:1,stockStatus:1,stock_status:1,available:1,status:1,hidden:1,notInStore:1,catalog_visibility:1},maxTimeMS:30000}).limit(50001).toArray();
 if(docs.length>50000)throw Error('הקטלוג גדול מ־50,000 מוצרים; נדרש חיבור מדורג לפני פתיחה');
 return existingProject(username.trim(),user,docs);
 }finally{await client.close()}
}

// What shoppers actually clicked for a query in production, matched to the local catalog by product URL id or title.
// Separates "wanted product is missing from the catalog feed" from "out of stock" from "a search rule problem".
export async function dbShopperClicks(p,{query},open=withDatabase){
 if(typeof query!=='string'||!query.trim()||query.length>200)throw Error('שאילתה לא תקינה');
 const words=query.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&').split(/\s+/);
 return open(p,async db=>{
  const filter={search_query:{$regex:words.join('\\s+'),$options:'i'}},read=name=>db.collection(name).find(filter,{projection:{product_name:1,product_url:1,search_query:1},maxTimeMS:20000}).sort({_id:-1}).limit(2000).toArray();
  const clicks=[...await read('product_clicks'),...await read('product_click_events')];
  const cards=p.productCards||[],byTail=new Map(),byTitle=new Map(),norm=v=>String(v||'').toLowerCase().replace(/[׳״'"’”]/g,'').replace(/\s+/g,' ').trim();
  for(const c of cards){const tail=String(c.url||c.id).split(/[/:]/).pop();if(tail)byTail.set(tail,c);byTitle.set(norm(c.title),c);}
  const groups=new Map();
  for(const k of clicks){const tail=String(k.product_url||'').split('?')[0].replace(/\/$/,'').split('/').pop(),card=byTail.get(tail)||byTitle.get(norm(k.product_name)),key=card?.id||norm(k.product_name)||tail;
   const g=groups.get(key)||{title:k.product_name||card?.title||'',url:k.product_url||null,clicks:0,inCatalog:!!card,id:card?.id||null,visible:!!card&&!card.hidden&&card.stockStatus==='instock'};g.clicks++;groups.set(key,g);}
  const products=[...groups.values()].sort((a,b)=>b.clicks-a.clicks).slice(0,30);
  return {query,clicks:clicks.length,products,missingFromCatalog:products.filter(x=>!x.inCatalog).length,notVisible:products.filter(x=>x.inCatalog&&!x.visible).length,note:'קליקים אמיתיים מהאתר; מוצר שאינו בקטלוג המקומי חסר בפיד המוצרים ולא ניתן לתקן אותו בכללי חיפוש'};
 });
}
