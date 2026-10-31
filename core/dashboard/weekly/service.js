import { reportGate } from '../analytics/work-limit.js';
import { ObjectId } from 'mongodb';
import { controlDb, getMongo, tenantDb, ensureTenantExperimentIndexes } from '../core/db.js';
import { loadStoreEvents, DAY_MS } from '../analytics/events.js';
import { askChatAgent } from '../../../model.mjs';
import { analyzeWeek, modelInput, Plans, WEEKLY_PROMPT, proposalFromPlan, fingerprint, productFacts } from './analysis.js';
import { publishActiveExperiments, experimentPublicationStatus } from '../engine/publisher.js';
import { clearSearchCache } from '../optimization/boosts.js';
import { loadExperimentMetrics } from './metrics.js';
const fail=(message,status=409)=>Object.assign(Error(message),{status});
let generationBusy=false,metricsBusy=false;
const catalogFields={_id:1,id:1,name:1,title:1,price:1,stockStatus:1,stock_status:1,hidden:1,notInStore:1,catalog_visibility:1,status:1,category:1,categories:1,softCategory:1,url:1,permalink:1};
async function initialize(db){await db.collection('weekly_store_reviews').createIndex({dbName:1,period:1},{unique:true});await db.collection('proposals').createIndex({dbName:1,kind:1,createdAt:-1});await db.collection('weekly_review_queries').createIndex({dbName:1,reportId:1,searches:-1});await db.collection('weekly_store_locks').createIndex({dbName:1},{unique:true});}
export async function weeklyState(store){
 const db=await controlDb(),report=await db.collection('weekly_store_reviews').findOne({dbName:store.dbName},{sort:{generatedAt:-1}});
 if(report?.status==='generating'&&Date.now()-+report.generatedAt>5*60000){await db.collection('weekly_store_reviews').updateOne({_id:report._id,status:'generating',generatedAt:report.generatedAt},{$set:{status:'failed',error:'יצירת הדוח הופסקה. אפשר לנסות שוב.'}});report.status='failed';report.error='יצירת הדוח הופסקה. אפשר לנסות שוב.';}
 const proposals=await db.collection('proposals').find({dbName:store.dbName,kind:'weeklyOptimization'}).sort({createdAt:-1}).limit(30).toArray();
 if(proposals.some(p=>['running','applied'].includes(p.status))){let active=[];try{active=(await experimentPublicationStatus(store.apiKey)).experimentIds.map(id=>({id}));}catch{}for(const p of proposals)if(['running','applied'].includes(p.status))p.published=active.some(e=>e.id===p.experimentId);}
 const now=new Date(),period=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-((now.getUTCDay()+6)%7))).toISOString().slice(0,10);
 return {report,proposals:proposals.map(({tenantApiKey,...p})=>p),canGenerate:!report||report.period!==period||report.status==='failed'};
}
export async function weeklyQueries(store,{page=0,query=''}={}){
 const db=await controlDb(),report=await db.collection('weekly_store_reviews').findOne({dbName:store.dbName,status:'completed'},{sort:{generatedAt:-1},projection:{_id:1}});
 if(!report)return {rows:[],total:0,page:0};
 const term=String(query).trim().slice(0,200).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),index=Math.min(6000,Math.max(0,Number.parseInt(page,10)||0));
 const filter={dbName:store.dbName,reportId:String(report._id),...(term?{query:{$regex:term,$options:'i'}}:{})};
 const col=db.collection('weekly_review_queries'),total=await col.countDocuments(filter,{maxTimeMS:10000}),rows=await col.find(filter,{projection:{_id:0,dbName:0,reportId:0},maxTimeMS:10000}).sort({searches:-1,query:1}).skip(index*20).limit(20).toArray();return {rows,total,page:index};
}
export async function requestWeeklyReview(store,by){
 const db=await controlDb();await initialize(db);
 // One completed report per UTC week: refreshing cannot create another set of
 // suggestions. The report always covers the preceding full seven days.
 const to=new Date(),from=new Date(+to-7*DAY_MS),period=new Date(Date.UTC(to.getUTCFullYear(),to.getUTCMonth(),to.getUTCDate()-((to.getUTCDay()+6)%7))).toISOString().slice(0,10),existing=await db.collection('weekly_store_reviews').findOne({dbName:store.dbName,period});
 if(existing&&['completed','generating'].includes(existing.status)&&!(existing.status==='generating'&&+to-+existing.generatedAt>5*60000))return {report:existing};
 if(generationBusy)throw fail('דוח אחר נוצר כעת בסטודיו. נסו שוב בעוד רגע.',429);
 generationBusy=true;
 const id=existing?._id||new ObjectId(),report={dbName:store.dbName,period,generatedAt:to,from,to,status:'generating',requestedBy:by};
 try{if(existing){const locked=await db.collection('weekly_store_reviews').updateOne({_id:id,status:existing.status,generatedAt:existing.generatedAt},{$set:report,$unset:{error:''}});if(!locked.matchedCount){generationBusy=false;return {report:await db.collection('weekly_store_reviews').findOne({_id:id})};}}else await db.collection('weekly_store_reviews').insertOne({...report,_id:id});}
 catch(e){generationBusy=false;if(e.code===11000)return {report:await db.collection('weekly_store_reviews').findOne({dbName:store.dbName,period})};throw e;}
 // Report generation is asynchronous; no long-running Vercel request.
 void generateWeeklyReport(store,id,report).catch(()=>{console.error('[weekly review] could not persist final job state');}).finally(()=>{generationBusy=false;});
 return {report:{...report,_id:id}};
}
export async function generateWeeklyReport(store,id,report,{ask=askChatAgent,loadEvents=loadStoreEvents}={}){
 const db=await controlDb();
 try{
  const {analysis,input,catalogCount}=await reportGate.run(async()=>{
   const events=await loadEvents(store.dbName,report.from,report.to),docs=[];let bytes=0,catalogTruncated=false;
   const cursor=(await tenantDb(store.dbName)).collection('products').find({},{projection:catalogFields,maxTimeMS:30000}).batchSize(200).limit(50001);
   try{for await(const product of cursor){bytes+=Buffer.byteLength(JSON.stringify(product));if(docs.length>=50000||bytes>16*1024*1024){catalogTruncated=true;break;}docs.push(product);}}finally{await cursor.close();}
   const analysis=analyzeWeek(events,docs);return {analysis,input:JSON.stringify(modelInput(analysis)),catalogCount:catalogTruncated?50001:docs.length};
  });
  let summary='לא נמצאו מספיק נתונים מהימנים להצעה ישימה השבוע.',plans=[],reason=null;
  if(!analysis.coverage.complete)reason='נתוני השאילתות חלקיים; לא נוצרו הצעות מדוח שאינו מכסה את השבוע.';
  else if(catalogCount>50000||Buffer.byteLength(input)>900000)reason='היקף הנתונים חרג ממגבלת הסקירה הבטוחה. לא נדגמו שאילתות ולא נוצרו הצעות חלקיות.';
  else if(analysis.eligible){const result=Plans.parse(await ask(WEEKLY_PROMPT+'\nDATA:\n'+input));summary=result.summary;plans=result.proposals;}
  const used=new Set(),proposals=[],validationNotes=[];
  for(const plan of plans){try{proposals.push(proposalFromPlan(plan,analysis,used));}catch(e){validationNotes.push(e.message);}}
  const recent=await db.collection('proposals').find({dbName:store.dbName,kind:'weeklyOptimization',$or:[{status:{$in:['pending','running','applied','applying']}},{createdAt:{$gte:new Date(+report.to-28*DAY_MS)}}]},{projection:{dedupeKey:1,queries:1,status:1}}).limit(100).toArray();
  const selected=proposals.filter(p=>!recent.some(r=>r.dedupeKey===p.dedupeKey||['pending','running','applied','applying'].includes(r.status)&&r.queries?.some(q=>p.queries.includes(q)))).slice(0,3);
  const session=(await getMongo()).startSession();try{await session.withTransaction(async()=>{
   const current=await db.collection('weekly_store_reviews').findOne({_id:id,status:'generating',generatedAt:report.generatedAt},{session});if(!current)throw Error('הדוח הוחלף בריצה חדשה');
   const ids=[];for(const p of selected){const proposalId=new ObjectId();ids.push(String(proposalId));await db.collection('proposals').insertOne({...p,_id:proposalId,dbName:store.dbName,tenantApiKey:store.apiKey,kind:'weeklyOptimization',reportId:String(id),status:'pending',createdAt:new Date(),expiresAt:new Date(+report.to+7*DAY_MS),baseline:{from:report.from,to:report.to}},{session});}
   // Compact full-query evidence, no raw session identifiers or customer PII.
   const queries=analysis.rows.map(({query,searches,sessions,clicks,carts,purchases,zeroSearches,synthetic})=>({query,searches,sessions,clicks,carts,purchases,zeroSearches,synthetic}));
   for(let offset=0;offset<queries.length;offset+=500)await db.collection('weekly_review_queries').insertMany(queries.slice(offset,offset+500).map(r=>({...r,dbName:store.dbName,reportId:String(id)})),{session});
   await db.collection('weekly_store_reviews').updateOne({_id:id,status:'generating',generatedAt:report.generatedAt},{$set:{status:'completed',completedAt:new Date(),summary:reason||(selected.length?'סקירת השבוע הסתיימה. '+selected.length+' הצעות עברו את בדיקות הנתונים והקטלוג: '+selected.map(p=>p.title).join(' · '):plans.length?'לא נמצאה הצעה חדשה שעברה את בדיקות הנתונים והקטלוג. הצעות חוזרות או חופפות לא נוצרו שוב.':summary),coverage:analysis.coverage,metric:analysis.metric,proposalIds:ids,validationNotes,deduplicated:proposals.length-selected.length}},{session});
  });}finally{await session.endSession();}
 }catch(e){console.error('[weekly review] generation failed:',e.name);await db.collection('weekly_store_reviews').updateOne({_id:id,status:'generating',generatedAt:report.generatedAt},{$set:{status:'failed',error:'לא ניתן להשלים כעת את הדוח. לא הופעלו שינויים. אפשר לנסות שוב.'}});}
}
export async function verifyEngine(store){
 try{const response=await fetch(new URL('/health',process.env.SEARCH_SERVICE_URL||'https://api.semantix-ai.com'),{signal:AbortSignal.timeout(5000)});const health=await response.json();if(health.features?.weeklyReviewV1!==true)throw Error('unsupported');}catch{throw fail('מנוע החיפוש עדיין לא עודכן לתמיכה בהצעות ובמדידת ניסויים. יש לפרוס את dashboard-server מהענף main לפני הפעלה.');}
 try{await experimentPublicationStatus(store.apiKey);}catch{throw fail('שירות פרסום הניסויים אינו זמין. יש לוודא שגרסת dashboard-server העדכנית נפרסה ושהחיבור שלו ל-Redis תקין. לא הופעל שינוי.');}
}
function experiment(p,delivery,by){const now=new Date();return {_id:new ObjectId(),dbName:p.dbName,tenantApiKey:p.tenantApiKey,proposalId:String(p._id),name:p.title,hypothesis:p.hypothesis,source:'manual',type:'pin',layer:'weekly',targeting:{mode:'queryMatch',patterns:p.queries,matchType:'exact'},arms:[{key:'control',weight:1,patch:{}},{key:'v1',weight:1,patch:p.patch}],trafficPct:100,primaryMetric:p.metric,businessObjective:p.objective||'revenue_per_search_session',delivery,status:'running',createdAt:now,startedAt:now,...(delivery==='randomized'?{expiresAt:new Date(+now+21*DAY_MS)}:{}),statusHistory:[{status:'running',at:now,by}]};}
export async function reviewProposal(store,id,action,by,{verify=verifyEngine,publish=publishActiveExperiments}={}){
 const db=await controlDb(),_id=new ObjectId(id),col=db.collection('proposals');
 if(action==='reject'){const r=await col.updateOne({_id,dbName:store.dbName,kind:'weeklyOptimization',status:'pending'},{$set:{status:'rejected',reviewedAt:new Date(),reviewedBy:by}});if(!r.matchedCount)throw fail('ההצעה כבר נבדקה');return {saved:true};}
 if(!['approve','test','stop','promote'].includes(action))throw fail('פעולה לא מוכרת',400);
 if(action!=='stop')await verify(store);
 await ensureTenantExperimentIndexes(store.dbName);
 const session=(await getMongo()).startSession();let result;
 try{await session.withTransaction(async()=>{
   // A shared per-store document serializes approvals across instances and
   // keys, preventing simultaneous overlapping experiments/rules.
   await db.collection('weekly_store_locks').updateOne({dbName:store.dbName},{$inc:{version:1}},{upsert:true,session});
   const p=await col.findOne({_id,dbName:store.dbName,kind:'weeklyOptimization'},{session});if(!p)throw fail('ההצעה לא נמצאה',404);
   if(['approve','test'].includes(action)&&p.status!=='pending'||action==='promote'&&p.status!=='running'||action==='stop'&&!['running','applied'].includes(p.status))throw fail('מצב ההצעה השתנה. יש לרענן.');
   if(['approve','test'].includes(action)&&+p.expiresAt<Date.now())throw fail('ההצעה התיישנה. יש ליצור דוח שבועי חדש.');
   const active=p.experimentId?await db.collection('experiments').findOne({_id:new ObjectId(p.experimentId),dbName:store.dbName},{session}):null;
   if(action==='stop'||action==='promote'){
     if(!active||active.status!=='running')throw fail('הניסוי אינו פעיל');
     await db.collection('experiments').updateOne({_id:active._id,status:'running'},{$set:{status:action==='stop'?'killed':'promoted',endedAt:new Date()},$push:{statusHistory:{status:action==='stop'?'killed':'promoted',at:new Date(),by}}},{session});
   }
   if(action==='stop'){await col.updateOne({_id,status:p.status},{$set:{status:'stopped',reviewedBy:by,stoppedAt:new Date()}},{session});result={saved:true};return;}
   const ids=Object.keys(p.fingerprints),products=await(await tenantDb(store.dbName)).collection('products').find({_id:{$in:ids.map(x=>new ObjectId(x))}},{projection:catalogFields,session}).toArray();
   if(products.length!==ids.length||products.some(product=>fingerprint(productFacts(product))!==p.fingerprints[String(product._id)]))throw fail('הקטלוג השתנה מאז הדוח. יש ליצור הצעה חדשה.');
   const running=await db.collection('experiments').find({dbName:store.dbName,status:{$in:['running','approved','paused']},...(active?{_id:{$ne:active._id}}:{})},{session,projection:{targeting:1}}).toArray();
   const conflict=running.some(e=>e.targeting?.mode==='all'||e.targeting?.patterns?.some(pattern=>p.queries.some(q=>e.targeting.matchType==='exact'?q===pattern.toLowerCase():q.includes(pattern.toLowerCase()))));
   if(conflict)throw fail('כבר פועל ניסוי או שינוי לאותן שאילתות. יש לעצור אותו תחילה.');
   // Existing merchant rules stay authoritative; don't silently overwrite a
   // manual layout or test against a different baseline than the report.
   const rules=await db.collection('rules').find({dbName:store.dbName,status:'active'},{session,projection:{condition:1}}).toArray();
   if(rules.some(r=>r.condition?.mode==='all'||r.condition?.patterns?.some(pattern=>p.queries.some(q=>r.condition.matchType==='exact'?q===pattern.toLowerCase():q.includes(pattern.toLowerCase())))))throw fail('יש כלל ידני פעיל לשאילתות האלו. יש לעדכן אותו לפני הפעלת ההצעה.');
   const exp=experiment(p,action==='test'?'randomized':'all',by);await db.collection('experiments').insertOne(exp,{session});
   const update={$set:{status:action==='test'?'running':'applied',experimentId:String(exp._id),reviewedAt:new Date(),reviewedBy:by,published:false},...(active?{$push:{previousExperimentIds:String(active._id)}}:{})};
   const changed=await col.updateOne({_id,status:p.status},update,{session});if(!changed.matchedCount)throw fail('ההצעה עודכנה במקביל');
   await db.collection('catalog_change_audits').insertOne({kind:'weeklyOptimization',proposalId:id,experimentId:String(exp._id),dbName:store.dbName,action,by,at:new Date(),patch:p.patch},{session});
   result={saved:true,experimentId:String(exp._id)};
 });}finally{await session.endSession();}
 let published=false;try{const publication=await publish(store.apiKey),proposal=await col.findOne({_id});published=action==='stop'?!publication.experimentIds.includes(proposal.experimentId):publication.experimentIds.includes(result.experimentId);}catch{}
 await col.updateOne({_id,dbName:store.dbName},{$set:{published}});await clearSearchCache(store.dbName).catch(()=>{});
 return {...result,published,message:published?'נשמר וסונכרן למנוע. חשיפות וביצועים יופיעו לאחר הגעת תנועה.':'נשמר, אך הסנכרון למנוע טרם אומת. יש לרענן ולבדוק לפני הסקת מסקנות.'};
}
export async function proposalMonitoring(store,id){
 const db=await controlDb(),p=await db.collection('proposals').findOne({_id:new ObjectId(id),dbName:store.dbName,kind:'weeklyOptimization'});if(!p)throw fail('ההצעה לא נמצאה',404);
 if(!p.experimentId)return {current:null,history:[]};
 if(metricsBusy)throw fail('מדידה אחרת נטענת כעת. נסו שוב בעוד רגע.',429);metricsBusy=true;
 try{const ids=[p.experimentId,...(p.previousExperimentIds||[]).slice(-3)],list=[];for(const value of ids){const exp=await db.collection('experiments').findOne({_id:new ObjectId(value),dbName:store.dbName});if(exp)list.push({id:value,status:exp.status,startedAt:exp.startedAt,endedAt:exp.endedAt,expiresAt:exp.expiresAt,...await loadExperimentMetrics(exp)});}return {current:list[0]||null,history:list.slice(1)};}finally{metricsBusy=false;}
}
export async function expireWeeklyExperiments(){const db=await controlDb();await db.collection('proposals').updateMany({kind:'weeklyOptimization',status:'pending',expiresAt:{$lte:new Date()}},{$set:{status:'expired'}});const active=await db.collection('experiments').find({layer:'weekly',status:'running',expiresAt:{$lte:new Date()}}).limit(100).toArray();for(const exp of active){const r=await db.collection('experiments').updateOne({_id:exp._id,status:'running'},{$set:{status:'completed',endedAt:exp.expiresAt}});if(r.modifiedCount){await db.collection('proposals').updateOne({experimentId:String(exp._id)},{$set:{status:'completed'}});await publishActiveExperiments(exp.tenantApiKey);}}}
