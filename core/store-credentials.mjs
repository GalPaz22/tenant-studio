import {randomBytes} from 'node:crypto';
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {join} from 'node:path';

// Store API credentials an operator enters for a tenant (WooCommerce consumer key/secret), read by the catalog
// connector (core/connectors.mjs) for an authorized build. Like the Shopify installs: a shared MongoDB collection when
// one is configured, otherwise a 0600 file in the data folder. The browser only ever sees view(): never the secret.
const KEY=/^ck_[A-Za-z0-9]{20,64}$/,SECRET=/^cs_[A-Za-z0-9]{20,64}$/;
const sameStore=(a,b)=>a.replace(/^www\./,'')===b.replace(/^www\./,'');
export function validateWooCredentials({url,key,secret}={},storeUrl){
 let u;try{u=new URL(String(url||storeUrl).trim());}catch{throw Error('כתובת החנות אינה תקינה');}
 if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443')throw Error('כתובת החנות חייבת להיות HTTPS');
 // The keys go only to the tenant's own store: another host would receive them.
 if(!sameStore(u.hostname,new URL(storeUrl).hostname))throw Error('הכתובת אינה תואמת לדומיין החנות של הלקוח');
 key=String(key||'').trim();secret=String(secret||'').trim();
 if(!KEY.test(key))throw Error('Consumer key צריך להתחיל ב־ck_');
 if(!SECRET.test(secret))throw Error('Consumer secret צריך להתחיל ב־cs_');
 return {platform:'woocommerce',url:u.origin,key,secret};
}
export function createCredentials(dataDir,{collection=null,ttlMs=60000,now=Date.now}={}){
 const file=join(dataDir,'store-credentials.json');let cache=null,loadedAt=0;
 const shape=d=>({platform:d.platform,url:d.url,key:d.key,secret:d.secret,savedAt:d.savedAt,check:d.check||null});
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
  async get(id){return (await load())[id]||null;},
  // Synchronous view for the catalog connector; null until the credentials were read once.
  peek:id=>cache?.[id]||null,
  async set(id,value){
   if(collection){await (await collection()).updateOne({_id:id},{$set:shape(value)},{upsert:true});await load(true);return;}
   (await load())[id]=shape(value);await save();
  },
  async remove(id){
   if(collection){await (await collection()).deleteOne({_id:id});await load(true);return;}
   delete (await load())[id];await save();
  },
  async view(id){const c=await this.get(id);return c?{platform:c.platform,url:c.url,key:c.key.slice(0,3)+'…'+c.key.slice(-4),savedAt:c.savedAt,check:c.check}:null;},
  load,
 };
}
// One page of one product and the store currency: proves the keys read the catalog before they are saved.
export async function checkWooCredentials(c,fetchSource){
 const headers={Authorization:'Basic '+Buffer.from(c.key+':'+c.secret).toString('base64')};
 let rows;try{rows=JSON.parse(await fetchSource(c.url+'/wp-json/wc/v3/products?status=publish&per_page=1',{headers}));}
 catch(e){if(/HTTP 40[13]/.test(e.message))throw Error('WooCommerce דחה את המפתחות — ודאו שהם פעילים עם הרשאת Read');if(/HTTP 404/.test(e.message))throw Error('לא נמצא WooCommerce REST API בכתובת הזו');throw e;}
 if(!Array.isArray(rows))throw Error('WooCommerce API לא החזיר מערך מוצרים');
 let currency=null;try{currency=JSON.parse(await fetchSource(c.url+'/wp-json/wc/v3/data/currencies/current',{headers})).code||null;}catch{}
 return {ok:true,at:new Date().toISOString(),sample:rows[0]?.name||null,currency};
}
