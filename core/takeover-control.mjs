import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {hash} from './hash.mjs';
import {withUsers,userFilter} from './production-control.mjs';
import {mergeSiteConfig} from './search-takeover.mjs';

// The storefront engine reads its per-store configuration from users.users → credentials.siteConfig (served by
// dashboard-server POST /site-config, cached by the loader for 5 minutes). Every key-holding user of the store's dbName
// gets the same merged config. Writing happens only from an explicit operator action, only when production still holds
// the version the operator reviewed (expectedHash), and always after the previous per-user config is saved to disk.

const configOf=d=>d.credentials?.siteConfig??null;
// The storefront talks to dashboard-server; its public site key is the store user's apiKey (it is printed in the
// storefront snippet anyway, so it is not a secret — admin and AI keys never leave the server).
export const apiBase=()=>(process.env.SEMANTIX_API_BASE||'https://api.semantix-ai.com').replace(/\/$/,'');
export const cdnBase=()=>(process.env.SEMANTIX_CDN_BASE||'https://cdn.semantix-ai.com').replace(/\/$/,'');
const label=d=>d.username?`username:${d.username}`:d.name?`name:${d.name}`:'user';
export const configHash=cfg=>hash(cfg??null);

export const readSiteConfig=(project,opts)=>withUsers(async users=>{
 const docs=await users.find(userFilter(project),{projection:{_id:0,username:1,name:1,apiKey:1,'credentials.siteConfig':1}}).limit(20).toArray();
 if(!docs.length)throw Error('לא נמצא משתמש עם מפתח API למסד של הלקוח הזה ב־users.users');
 const hashes=docs.map(d=>configHash(configOf(d))),consistent=hashes.every(h=>h===hashes[0]);
 return {users:docs.map(label),consistent,siteConfig:configOf(docs[0]),hash:hashes[0],apiKey:docs[0].apiKey,apiBase:apiBase(),cdnBase:cdnBase()};
},opts);

// Search service defaults for storefront code: dashboard-server and the store's site key (null when the project has no
// dashboard user yet).
export async function storefrontDefaults(project,opts){
 const endpoint=apiBase()+'/search';
 let dbName;try{dbName=userFilter(project).dbName;}catch{return {endpoint,apiKey:null,user:null};}
 return withUsers(async users=>{const d=(await users.find({dbName,apiKey:{$type:'string',$ne:''}},{projection:{_id:0,username:1,name:1,apiKey:1}}).limit(1).toArray())[0];return {endpoint,apiKey:d?.apiKey||null,user:d?label(d):null};},opts);
}

// proposal: the takeover's siteConfig slice. Returns what was written, and the backup file for rollback.
export async function publishSiteConfig(project,proposal,{expectedHash,backups,by='tenant-studio',...opts}={}){
 if(!expectedHash)throw Error('נדרש hash של התצורה הנוכחית כפי שהוצגה לפני הפרסום');
 return withUsers(async users=>{
  const docs=await users.find(userFilter(project),{projection:{_id:1,username:1,name:1,'credentials.siteConfig':1}}).limit(20).toArray();
  if(!docs.length)throw Error('לא נמצא משתמש עם מפתח API למסד של הלקוח הזה ב־users.users');
  if(configHash(configOf(docs[0]))!==expectedHash)throw Error('התצורה בפרודקשן השתנתה מאז שנטענה — טענו אותה מחדש ובדקו שוב לפני הפרסום');
  const at=new Date().toISOString();
  await mkdir(backups,{recursive:true});
  const file=join(backups,`siteconfig-${project.id}-${at.replace(/[:.]/g,'-')}.json`);
  await writeFile(file,JSON.stringify({projectId:project.id,at,by,users:docs.map(d=>({_id:String(d._id),label:label(d),siteConfig:configOf(d)}))},null,1));
  const writes=docs.map(d=>{const merged=mergeSiteConfig(configOf(d),proposal);return {updateOne:{filter:{_id:d._id},update:{$set:{'credentials.siteConfig':merged,'credentials.siteConfigUpdatedAt':at,'credentials.siteConfigUpdatedBy':by}}}};});
  const r=await users.bulkWrite(writes,{ordered:true});
  const written=writes[0].updateOne.update.$set['credentials.siteConfig'];
  return {users:r.modifiedCount??docs.length,backup:file,hash:configHash(written),siteConfig:written,at};
 },opts);
}

export async function listBackups(project,backups){
 try{return (await readdir(backups)).filter(f=>f.startsWith(`siteconfig-${project.id}-`)).sort().reverse().slice(0,20);}catch(e){if(e.code==='ENOENT')return [];throw e;}
}

// Restores every user's own previous config from a backup written by publishSiteConfig.
export async function rollbackSiteConfig(project,name,{backups,...opts}={}){
 if(!/^siteconfig-[a-f0-9-]{36}-[\dT-]+Z\.json$/.test(name)||!name.includes(project.id))throw Error('גיבוי לא תקין');
 const saved=JSON.parse(await readFile(join(backups,name),'utf8'));
 return withUsers(async users=>{
  const {ObjectId}=await import('mongodb'),filter=userFilter(project);
  const writes=saved.users.map(u=>({updateOne:{filter:{...filter,_id:new ObjectId(u._id)},update:u.siteConfig===null?{$unset:{'credentials.siteConfig':''}}:{$set:{'credentials.siteConfig':u.siteConfig}}}}));
  const r=await users.bulkWrite(writes,{ordered:true});
  return {users:r.modifiedCount??writes.length,restored:name};
 },opts);
}

// ---------- rollout: who gets Semantix and who gets the store's own search ----------
// One A/B test in the store's siteConfig, read by the engine on every storefront (the CDN loader fetches siteConfig;
// the Shopify / WooCommerce exports lay it over their written configuration). The split is by a hash of the visitor
// id, not remembered in the browser ("sticky": false), so moving the percentage moves visitors: raising it only adds
// visitors to Semantix, 0 returns everyone to the store's search, 100 gives Semantix to all. Visitors on the store's
// search stay in shadow mode — their searches, clicks and cart events are still recorded (with the variant), which is
// what makes the two groups comparable.
export const ROLLOUT_TEST='semantix_takeover';
export function rolloutTest(percent,{at=new Date().toISOString(),by='tenant-studio'}={}){
 if(!Number.isInteger(percent)||percent<0||percent>100)throw Error('אחוז הגולשים שמקבלים את Semantix: מספר שלם בין 0 ל־100');
 return {enabled:true,sticky:false,updatedAt:at,updatedBy:by,variants:[{id:'semantix',weight:percent},{id:'native',weight:100-percent,features:{shadowMode:true}}]};
}
// The percentage a siteConfig gives Semantix; null when it has no rollout test (everyone gets what the configuration says).
export function rolloutOf(siteConfig){
 const t=siteConfig?.abTests?.[ROLLOUT_TEST];if(!t||t.enabled===false||!Array.isArray(t.variants))return null;
 const total=t.variants.reduce((n,v)=>n+(Number(v.weight)||0),0);if(total<=0)return null;
 return Math.round(100*(Number(t.variants.find(v=>v.id==='semantix')?.weight)||0)/total);
}
export const readRollout=(project,opts)=>withUsers(async users=>{
 const docs=await users.find(userFilter(project),{projection:{_id:0,username:1,name:1,'credentials.siteConfig.abTests':1}}).limit(20).toArray();
 if(!docs.length)throw Error('לא נמצא משתמש עם מפתח API למסד של הלקוח הזה ב־users.users');
 const percents=docs.map(d=>rolloutOf(configOf(d)));
 return {users:docs.map(label),percent:percents[0],consistent:percents.every(p=>p===percents[0]),updatedAt:configOf(docs[0])?.abTests?.[ROLLOUT_TEST]?.updatedAt||null};
},opts);
// percent: 0–100, or null to remove the test. Only this one key of siteConfig is written; each user's previous
// siteConfig is saved first, in the same backups the takeover publish uses (so the same rollback restores it).
export async function publishRollout(project,percent,{backups,by='tenant-studio',...opts}={}){
 const test=percent===null?null:rolloutTest(percent,{by});
 return withUsers(async users=>{
  const docs=await users.find(userFilter(project),{projection:{_id:1,username:1,name:1,'credentials.siteConfig':1}}).limit(20).toArray();
  if(!docs.length)throw Error('לא נמצא משתמש עם מפתח API למסד של הלקוח הזה ב־users.users');
  const at=new Date().toISOString();
  await mkdir(backups,{recursive:true});
  const file=join(backups,`siteconfig-${project.id}-${at.replace(/[:.]/g,'-')}.json`);
  await writeFile(file,JSON.stringify({projectId:project.id,at,by,reason:'rollout',users:docs.map(d=>({_id:String(d._id),label:label(d),siteConfig:configOf(d)}))},null,1));
  const stamp={'credentials.siteConfigUpdatedAt':at,'credentials.siteConfigUpdatedBy':by},path='credentials.siteConfig.abTests.'+ROLLOUT_TEST;
  const writes=docs.map(d=>{const cur=configOf(d);
   // A user without a siteConfig object gets one holding only the test; a dotted $set cannot pass through null.
   const update=test===null?(cur?.abTests?{$unset:{[path]:''},$set:stamp}:{$set:stamp})
    :cur&&typeof cur==='object'&&(cur.abTests===undefined||(cur.abTests&&typeof cur.abTests==='object'))?{$set:{[path]:test,...stamp}}
    :{$set:{'credentials.siteConfig':{...(cur&&typeof cur==='object'?cur:{}),abTests:{[ROLLOUT_TEST]:test}},...stamp}};
   return {updateOne:{filter:{_id:d._id},update}};});
  const r=await users.bulkWrite(writes,{ordered:true});
  return {users:r.modifiedCount??docs.length,backup:file,percent,at};
 },opts);
}
