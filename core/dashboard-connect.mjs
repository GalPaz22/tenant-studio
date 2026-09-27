import {MongoClient} from 'mongodb';
import {randomBytes} from 'node:crypto';

// Connects a store onboarded from its URL to the dashboard database, in the schema the onboarding service
// (onboarding-render) writes, so the store becomes an ordinary client: a users.users document with an API key and
// dbName, and <dbName>.products in the Woo/Shopify product shape (plus the studio's enrichment in the legacy
// category/type/softCategory/colors fields). From then on the project works as an existing client: export, the
// production switch, shopper analytics and the site crawler all use it. Products carry no embeddings, so the legacy
// vector search does not cover them — the store's search is its studio module (switched on from the production panel).
// Nothing existing is overwritten: the username, the dbName and a non-empty products collection must all be new.
const uri=()=>process.env.STUDIO_DASHBOARD_MONGODB_URI||process.env.MONGODB_URI;
export const DB_NAME=/^[a-z0-9][a-z0-9_-]{2,38}$/;
export function suggestNames(p){
 const host=new URL(p.url).hostname.replace(/^www\./,'').split('.')[0].toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,'').slice(0,38);
 return {username:host||'store',dbName:host.length>=3?host:'store-'+p.id.slice(0,8)};
}
const PLATFORMS=new Set(['woocommerce','shopify','magento']);
const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const strings=v=>Array.isArray(v)?v.filter(x=>typeof x==='string'&&x.trim()):[];
// One product document per card, keyed by the source id (numeric ids stay numbers, as the sync writes them).
export function productDocs(p,{now=new Date()}={}){
 const raws=new Map((p.catalog?.products||[]).map(r=>[String(r.id),r]));
 return (p.productCards||[]).map(c=>{
  const sourceId=String(c.id).split(':').pop(),raw=raws.get(sourceId)||raws.get(String(c.id))||{},id=/^\d{1,15}$/.test(sourceId)?Number(sourceId):sourceId;
  const price=num(c.price),regular=num(c.regularPrice)??price,images=strings(raw.images?.map?.(x=>typeof x==='string'?x:x?.src))||[];
  const stock=c.stockStatus||'unknown';
  return {id,name:c.title||raw.name||'',sku:c.sku||raw.sku||null,description:raw.description||c.description||'',short_description:'',
   price,regular_price:regular,sale_price:price!==null&&regular!==null&&price<regular?price:null,onSale:price!==null&&regular!==null&&price<regular,
   stock_status:stock,stockStatus:stock,status:c.hidden?'private':'publish',hidden:c.hidden===true,
   categories:strings(c.categories).map(name=>({name})),tags:strings(c.tags).filter(t=>!t.startsWith('__')).map(name=>({name})),
   images:(images.length?images:c.image?[c.image]:[]).map(src=>({src})),image:c.image||images[0]||null,url:c.url||raw.url||null,
   brand:c.brand||null,specifications:c.specifications&&typeof c.specifications==='object'?c.specifications:{},
   description1:c.description||'',category:strings(c.categories),type:c.productType?[c.productType]:[],softCategory:[],colors:strings(c.colors),
   fetchedAt:now,processedAt:now,source:'tenant-studio'};
 });
}
export function userDoc(p,{username,dbName,email=null,apiKey=randomBytes(32).toString('hex'),now=new Date()}){
 const platform=PLATFORMS.has(p.platform)?p.platform:'custom',categories=[...new Set((p.productCards||[]).flatMap(c=>strings(c.categories)))].slice(0,200);
 return {username,name:p.name||username,...(email&&{email}),apiKey,dbName,platform,...(platform==='woocommerce'&&{wooSiteUrl:new URL(p.url).origin}),
  ...(platform==='shopify'&&{shopifyDomain:new URL(p.url).hostname}),
  credentials:{dbName,categories,type:[],softCategories:[]},collections:{products:'products'},onboardingComplete:true,syncMode:'studio',
  context:typeof p.storeContext?.summary==='string'?p.storeContext.summary.slice(0,2000):'',explain:false,
  createdAt:now,updatedAt:now,createdBy:'tenant-studio',studioProjectId:p.id};
}
async function withClient(fn,{client}={}){
 if(client)return fn(client);if(!uri())throw Error('חיבור לדאשבורד דורש MONGODB_URI של השרת הראשי');
 const c=new MongoClient(uri(),{serverSelectionTimeoutMS:8000,socketTimeoutMS:120000});try{await c.connect();return await fn(c);}finally{await c.close();}
}
async function writeProducts(db,docs){
 const col=db.collection('products');
 for(let i=0;i<docs.length;i+=500)await col.bulkWrite(docs.slice(i,i+500).map(d=>({updateOne:{filter:{id:d.id},update:{$set:d},upsert:true}})),{ordered:false});
 return col;
}
export async function connectToDashboard(p,{username,dbName,email=null,...opts}={}){
 if(p.existingClient)throw Error(`הלקוח כבר מחובר למסד ${p.existingClient.dbName}`);
 if(!p.productCards?.length)throw Error('אין כרטיסי מוצר — יש לבנות את הלקוח לפני חיבור');
 username=String(username||'').trim();dbName=String(dbName||'').trim();
 if(!/^[\p{L}\p{N}._-]{3,40}$/u.test(username))throw Error('שם משתמש: 3–40 תווים, אותיות, ספרות, נקודה, מקף או קו תחתון');
 if(!DB_NAME.test(dbName))throw Error('שם מסד: 3–39 תווים, אותיות אנגליות קטנות, ספרות, מקף או קו תחתון');
 if(email!==null&&email!==''&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('כתובת מייל לא תקינה');
 return withClient(async client=>{
  const users=client.db('users').collection('users');
  if(await users.findOne({$or:[{username},{name:username}]},{projection:{_id:1}}))throw Error(`שם המשתמש ${username} כבר קיים`);
  if(await users.findOne({$or:[{dbName},{'credentials.dbName':dbName}]},{projection:{_id:1}}))throw Error(`המסד ${dbName} כבר שייך ללקוח אחר`);
  const db=client.db(dbName);if(await db.collection('products').estimatedDocumentCount()>0)throw Error(`במסד ${dbName} כבר יש מוצרים — לא דורס`);
  // Products first: a user document only appears once its store has a catalog.
  const col=await writeProducts(db,productDocs(p));
  await Promise.all([col.createIndex({id:1}),col.createIndex({category:1,fetchedAt:-1}),col.createIndex({type:1,fetchedAt:-1})]).catch(()=>{});
  const user=userDoc(p,{username,dbName,email:email||null});await users.insertOne(user);
  return {username,dbName,apiKey:user.apiKey,platform:user.platform,products:await col.countDocuments()};
 },opts);
}
// Re-sends the studio's current catalog (prices, stock, new products) to a store the studio connected.
export async function syncProductsToDashboard(p,opts={}){
 if(!p.existingClient?.createdByStudio)throw Error('סנכרון מוצרים זמין רק ללקוח שהסטודיו חיבר למסד');
 return withClient(async client=>{const docs=productDocs(p),col=await writeProducts(client.db(p.existingClient.dbName),docs);
  const ids=docs.map(d=>d.id),missing=await col.countDocuments({id:{$nin:ids},source:'tenant-studio'});return {products:docs.length,notInStudio:missing};},opts);
}
