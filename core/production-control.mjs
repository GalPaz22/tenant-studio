import {MongoClient} from 'mongodb';

// The production switch lives on the merchant's user document, which dashboard-server loads into req.store:
//   users.users → semantix: {module, enabled, percent, revision, updatedAt, updatedBy}
// Writing it changes production behaviour (after the server's store-config cache, up to 5 minutes), so only an explicit
// operator action in the studio calls setControl.
const uri=()=>process.env.STUDIO_DASHBOARD_MONGODB_URI||process.env.MONGODB_URI;
export async function withUsers(fn,{client}={}){
 if(client)return fn(client.db('users').collection('users'));
 if(!uri())throw Error('שליטה בפרודקשן דורשת MONGODB_URI של השרת הראשי');
 const c=new MongoClient(uri(),{serverSelectionTimeoutMS:8000});
 try{await c.connect();return await fn(c.db('users').collection('users'));}finally{await c.close();}
}
// The switch must sit on the users whose API keys the storefront sends — req.store is built from the key's user.
// A store can have several users on one dbName (the store itself, staff, a studio login without a key), so the switch
// goes on every user of the store's dbName that has an API key; users without a key never reach /search.
export function storeDbName(project){
 const dbName=project.existingClient?.dbName||project.dashboardExport?.dbName;
 if(!dbName)throw Error('ללקוח הזה אין מסד ב־dashboard (users.users) — קלוט אותו כלקוח קיים כדי לשלוט בו בפרודקשן');
 return dbName;
}
export const userFilter=project=>({dbName:storeDbName(project),apiKey:{$type:'string',$ne:''}});
const label=u=>u.username?`username:${u.username}`:u.name?`name:${u.name}`:'user';
export function validateControl(input){
 if(typeof input?.enabled!=='boolean')throw Error('enabled חייב להיות true או false');
 const percent=input.percent===undefined?100:Number(input.percent);if(!Number.isInteger(percent)||percent<0||percent>100)throw Error('percent בין 0 ל־100');
 return {enabled:input.enabled,percent};
}
export const readControl=(project,opts)=>withUsers(async users=>{
 const docs=await users.find(userFilter(project),{projection:{_id:0,username:1,name:1,dbName:1,semantix:1}}).limit(20).toArray();
 if(!docs.length)throw Error('לא נמצא משתמש עם מפתח API למסד של הלקוח הזה ב־users.users');
 // One answer for the store: the switch is "on" only when every key-holding user carries the same enabled switch.
 const same=docs.every(d=>JSON.stringify(d.semantix?.module)===JSON.stringify(docs[0].semantix?.module)&&d.semantix?.enabled===docs[0].semantix?.enabled&&(d.semantix?.percent??100)===(docs[0].semantix?.percent??100));
 return {user:{username:docs.map(label).join(', '),dbName:docs[0].dbName},users:docs.map(d=>({label:label(d),control:d.semantix||null})),consistent:same,control:same?docs[0].semantix||null:{...(docs.find(d=>d.semantix)?.semantix||{}),enabled:false,mixed:true}};
},opts);
export async function setControl(project,slug,input,{by='tenant-studio',revision=null,...opts}={}){
 const value=validateControl(input);
 return withUsers(async users=>{
  const filter=userFilter(project),count=await users.countDocuments(filter);if(!count)throw Error('לא נמצא משתמש עם מפתח API למסד של הלקוח הזה ב־users.users');
  const semantix={module:slug,...value,revision,updatedAt:new Date().toISOString(),updatedBy:by};
  const r=await users.updateMany(filter,{$set:{semantix}});return {filter,users:r.modifiedCount??count,control:semantix};
 },opts);
}
