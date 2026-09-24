import {workspaceAgent} from './core/workspace-agent.mjs';
import {studioAgent,tools as studioTools} from './core/studio-agent.mjs';
import {auditSearches} from './core/search-audit.mjs';
import {readProductionSignals,buildBaseline,evaluateBaseline} from './core/baseline.mjs';
import {researchProcessing,trialPlan,runPlan} from './core/processing-lab.mjs';
import {buildScraper,sampleProductUrls} from './core/scraper-builder.mjs';
import {mergeCrawl,get as getPage} from './core/site-crawler.mjs';
import {createCrawlDb} from './core/crawl-store.mjs';
import {crawlStatus,crawlSettings,crawlTarget,startCrawl,stopCrawl,validateSettings,ensureLocalWorker} from './core/crawl-control.mjs';
import {conciergeTurn,decideTrigger,outOfStockHits,settingsOf} from './core/concierge.mjs';
import {analyzeExisting,reindexExisting} from './core/fast-track.mjs';
import {loadExistingClient,refreshSourceFields,dbFields,dbSearch,importDbField} from './existing-client.mjs';
import {learningSummary,learningState,importExamples,captureExamples,reviewExample,proposeLearning,evaluateExamples,guardLearning,acceptProposal,refreshProposal} from './core/learning.mjs';
import {focusedRepair} from './core/focused-repair.mjs';
import {prepareRepair,finishRepair} from './core/repair.mjs';
import {buildIssues} from './public/build-issues.js';
import 'dotenv/config';
import express from 'express';
import {randomUUID,timingSafeEqual,createHmac} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createStore} from './store.mjs';
import {discover} from './discover.mjs';
import {askAgent,askChatAgent,askStudioAgent,askJudgeAgent,askPlanner,askProcessing,studioModel,chatModel,contract,validateProfile} from './model.mjs';
import {createDraftRuntime,indexDefinition} from './runtime.mjs';
import {provision} from './provision.mjs';
import {buildArtifacts} from './artifacts.mjs';
import {zipFiles} from './zip.mjs';
import {scrapeCatalog,applyObservations} from './scraper.mjs';
import {generate} from './core/gemini.mjs';
import {classifyTag} from './core/tagging.mjs';
import {researchGarmin} from './garmin-research.mjs';
import {createRunStore} from './core/run-store.mjs';
import {newBuild,validateBuildOptions,executeBuild} from './core/build.mjs';
import {hash} from './core/catalog.mjs';
import {buildSearchIndex} from './core/search-index.mjs';
import {createMongoRetriever} from './core/mongo-retriever.mjs';
import {connectorFor} from './core/connectors.mjs';
import {validateSync,syncDue} from './core/sync.mjs';
const dir=fileURLToPath(new URL('.',import.meta.url));
const dataDir=resolve(process.env.STUDIO_DATA_DIR||dir+'data');
const agentLogs=createStore(resolve(dataDir,'agent-logs'));
const store=createStore(dataDir),runs=createRunStore(resolve(dataDir,'runs'));
const queue=new Set();let draining=false;
const locks=new Set(),runtimes=new Map();let active=0;
const port=Number(process.env.PORT||process.env.STUDIO_PORT||4320),token=randomUUID();
const allowRemote=process.env.ALLOW_REMOTE==='true'||!!process.env.RENDER||process.env.NODE_ENV==='production';
const app=express();app.use(express.json({limit:'32kb',verify:(req,_res,buffer)=>{req.rawBody=buffer;}}));
app.use((req,res,next)=>{
 if(!allowRemote){
  if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host))return res.status(403).json({code:'HOST_DENIED',error:'יש לפתוח את ה־Studio בכתובת המקומית שלו'});
  if(req.headers.origin&&!['http://127.0.0.1:'+port,'http://localhost:'+port].includes(req.headers.origin))return res.status(403).json({code:'ORIGIN_DENIED',error:'מקור הבקשה אינו מורשה'});
 }
 res.set('Cache-Control','no-store');next();
});
app.get('/api/session',(_req,res)=>res.json({token}));
app.use('/api', (req,res,next)=>{
 if(req.method==='POST'&&/^\/projects\/[a-f0-9-]{36}\/sync\/event$/.test(req.path)&&!req.get('X-Studio-Token')){
  const secret=process.env.STUDIO_WEBHOOK_SECRET,timestamp=req.get('X-Studio-Timestamp'),signature=req.get('X-Studio-Signature')||'';
  if(!secret||!timestamp||!Number.isFinite(Number(timestamp))||Math.abs(Date.now()/1000-Number(timestamp))>300||!req.rawBody)return res.status(403).json({error:'נדרשת חתימת אירוע תקינה'});
  const expected=createHmac('sha256',secret).update(timestamp+'.').update(req.rawBody).digest('hex');
  if(signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return res.status(403).json({error:'חתימת אירוע לא תקינה'});
  return next();
 }
 const value=req.get('X-Studio-Token')||'';
 if(Buffer.byteLength(value)!==Buffer.byteLength(token)||!timingSafeEqual(Buffer.from(value),Buffer.from(token)))return res.status(403).json({code:'SESSION_EXPIRED',error:'השרת הופעל מחדש. יש לחדש את החיבור.'});
 next();
});
const route=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
async function locked(id,fn){if(locks.has(id)||active>=2)throw Error('כבר מתבצעת פעולה. נסו שוב בעוד רגע.');locks.add(id);active++;try{return await fn()}finally{locks.delete(id);active--}}
function summary(p,run=null){return {...p,productCards:undefined,searchIndex:undefined,vectorIndex:undefined,tagAssignments:Object.fromEntries(Object.entries(p.tagAssignments||{}).map(([tag,a])=>[tag,{counts:a.counts,productsScanned:a.productsScanned,failedBatches:a.failedBatches}])),buildRun:run?{...run,checkpoints:undefined,pinnedProfile:undefined}:null,catalog:p.catalog?{...p.catalog,products:undefined,count:p.catalog.products.length}:null}}
async function projectSummary(p){const run=p.buildRunId?await runs.read(p.buildRunId):null;return {...summary(p,run),learning:learningSummary(p),chatModel:chatModel(),studioModel:studioModel(),previewSearchAvailable:!p.revisions.length&&run?.status==='partial'&&run.stages.some(s=>s.key==='index'&&s.status==='completed'),connectorAvailable:!!connectorFor(p)}}
async function persist(p){p.events=p.events.slice(-100);p.updatedAt=new Date().toISOString();return store.save(p)}
function refreshDerived(p){
 if(!p.productCards?.length||!p.revisions.length)return;
 const profile=p.revisions.at(-1).profile;
 const draft=createDraftRuntime({...p,productCards:null,searchIndex:null},p.revisions.at(-1));
 const old=new Map(p.productCards.map(c=>[c.id,c]));
 p.productCards=draft.products.map(product=>({...old.get(product.id),...product,tagDecisions:Object.values(p.tagAssignments||{}).flatMap(a=>(a.definitionHash&&Object.values(profile.tagDefinitions||{}).some(r=>hash(r)===a.definitionHash)?a.decisions||[]:[]).filter(d=>d.productId===product.id))}));
 p.productCardsProfileHash=hash(profile);p.searchIndex=draft.index;
 // Index metadata is recalculated after presentation fields are retained.
 p.searchIndex=buildSearchIndex(p.productCards,'studio-'+p.revisions.at(-1).number);
 if(p.storeContext)p.storeContext={...p.storeContext,productTypes:profile.productTypes,tagDefinitions:profile.tagDefinitions||{},queryAliases:profile.queryAliases,semanticAliases:profile.semanticAliases||{},policyRevision:p.revisions.at(-1).number};
 p.mongoPolicyDirty=true;
}
async function runtime(id,activeVersion=false,previewRunId=null){
 const p=await store.read(id);if(previewRunId){const run=await runs.read(previewRunId);if(run.projectId!==id||run.status!=='partial')throw Error('תצוגת הבנייה אינה זמינה');const bundle=await runs.asset(previewRunId,'bundle');Object.assign(p,{catalog:bundle.catalog,tagAssignments:bundle.tagAssignments,productCards:bundle.productCards,storeContext:bundle.storeContext,searchIndex:bundle.searchIndex,vectorIndex:bundle.vectorIndex});p.productCardsProfileHash=hash(bundle.profile);p.revisions=[{number:0,profile:bundle.profile}];}
 if(activeVersion){if(!p.activeBuildId)throw Error('אין גרסה פעילה');const bundle=await runs.asset(p.activeBuildId,'bundle');Object.assign(p,{catalog:bundle.catalog,tagAssignments:bundle.tagAssignments,productCards:bundle.productCards,storeContext:bundle.storeContext,searchIndex:bundle.searchIndex,vectorIndex:bundle.vectorIndex});p.productCardsProfileHash=hash(bundle.profile);p.revisions=[{number:p.activeRevisionNumber||1,profile:bundle.profile}];}
 if(!p.revisions.length)throw Error('עדיין לא נוצר מודול');const revision=p.revisions.at(-1),key=id+':'+revision.number+':'+p.updatedAt+':'+activeVersion+':'+(previewRunId||'');
 if(!runtimes.has(key)){runtimes.clear();let retrieve;
  const runId=previewRunId?null:activeVersion?p.activeBuildId:p.latestBuildId;
  if(runId){const r=await runs.read(runId);if(r.index?.mongo?.atlas==='ready'&&(activeVersion||!p.mongoPolicyDirty)&&p.productCardsProfileHash===hash(revision.profile))retrieve=await createMongoRetriever(p.productCards,{...revision.profile,tenantId:id},r.index.mongo);}
  runtimes.set(key,createDraftRuntime(p,revision,{retrieve}));}
 return runtimes.get(key);
}
async function drainBuilds(){
 if(draining)return;draining=true;
 try{for(const id of [...queue]){
  if(active>=2)break;
  const p=await store.read(id);if(!p.buildRunId){queue.delete(id);continue;}const run=await runs.read(p.buildRunId);
  if(run.status!=='queued'){queue.delete(id);continue;}if(locks.has(id))continue;
  queue.delete(id);
  const work=locked(id,async()=>{
   const result=await executeBuild(p,run,runs,{provisionIndex:provision});
   finishRepair(run);await runs.save(run);
   if(result.bundle&&result.run.status==='ready'){
    Object.assign(p,{catalog:result.bundle.catalog,tagAssignments:result.bundle.tagAssignments,productCards:result.bundle.productCards,productCardsProfileHash:hash(result.bundle.profile),storeContext:result.bundle.storeContext,searchIndex:result.bundle.searchIndex,vectorIndex:result.bundle.vectorIndex});
    p.revisions.push({number:p.revisions.length+1,profile:result.bundle.profile,createdAt:new Date().toISOString(),note:'בנייה מלאה '+run.id.slice(0,8)});
    run.revisionNumber=p.revisions.at(-1).number;await runs.save(run);
    p.buildReport={coverage:run.coverage,metrics:run.metrics,validation:run.validation,index:run.index,errors:run.errors,warnings:run.warnings};p.mongoPolicyDirty=false;p.name=result.bundle.profile.name;p.latestBuildId=run.id;p.status='draft';p.buildHistory=[...(p.buildHistory||[]),{id:run.id,at:new Date().toISOString(),products:result.bundle.productCards.length}].slice(-20);
    p.messages.push({role:'assistant',text:'הבנייה הסתיימה: קטלוג, תגיות, כרטיסי מוצר, קונטקסט ואינדקס מוכנים לבדיקה.'});
    if(p.sync?.autoActivate&&run.trigger==='sync'){p.previousActiveBuildId=p.activeBuildId||null;p.activeBuildId=run.id;p.activeRevisionNumber=p.revisions.length;run.status='activated';await runs.save(run);}
   }else p.status=p.revisions.length?'draft':result.run.status;
   if(run.trigger==='sync'){p.sync={...p.sync,lastRunAt:new Date().toISOString(),lastStatus:run.status,nextAt:new Date(Date.now()+(p.sync?.intervalMinutes||1440)*60000).toISOString()};p.pendingSyncEvents=[];}
   p.events.push(...(run.events||[]).slice(-8));await persist(p);runtimes.clear();
  });work.catch(async e=>{run.status='failed';run.message=e.message;await runs.save(run);}).finally(()=>{drainBuilds().catch(console.error)});
 }}finally{draining=false;}
}
async function enqueueBuild(id,options,{trigger=null}={}){
 const run=await locked(id,async()=>{
  const p=await store.read(id);if(p.revisions.length>=100)throw Error('מגבלת 100 גרסאות');
  if(p.buildRunId&&['queued','running'].includes((await runs.read(p.buildRunId)).status))throw Error('כבר קיימת ריצת בנייה');
  const run=newBuild(p,validateBuildOptions(options,p.platform));run.trigger=trigger;
  if(run.options.indexTarget==='mongo'&&!process.env.MONGODB_URI)throw Error('יש להגדיר חיבור Mongo לפני בחירת אינדקס Atlas');
  if(run.options.sourceType==='authorized'&&!connectorFor(p))throw Error('יש להגדיר חיבור קריאה מורשה לפני תחילת הבנייה');
  if(trigger==='sync')run.eventIds=(p.pendingSyncEvents||[]).map(e=>e.eventId);
  await runs.save(run);await runs.control(run.id,{action:'run'});p.buildRunId=run.id;p.status='building';await persist(p);return run;
 });queue.add(id);drainBuilds().catch(console.error);return run;
}
async function recoverBuilds(){for(const item of await store.list()){const project=await store.read(item.id);if(project.tagging){project.tagging=false;project.events.push({text:'סיווג התגיות הקודם נקטע בהפעלת השרת מחדש. ניתן להמשיך לערוך; הסיווג שנקטע דורש ניסיון נוסף.',at:new Date().toISOString()});await persist(project);}}
 for(const run of await runs.list()){
 if(run.repair?.status==='analyzing'){run.repair.status='failed';run.repair.result='האבחון נקטע בהפעלה מחדש. אפשר לנסות שוב.';await runs.save(run);}
 if(run.status==='running'){if(run.repair?.status==='executing'){run.repair.status='needs_input';run.repair.result='הטיפול נעצר בהפעלה מחדש. ניתן להמשיך מההתקדמות שנשמרה.';}run.status='paused';run.message='השרת הופעל מחדש; נקודות ההמשך נשמרו';for(const s of run.stages)if(s.status==='running')s.status='pending';await runs.save(run);}
 if(run.status==='queued')queue.add(run.projectId);
 }await drainBuilds();}
const queueTimer=setInterval(()=>drainBuilds().catch(console.error),2000);queueTimer.unref();
let syncing=false;
async function syncTick(){if(syncing)return;syncing=true;try{for(const item of await store.list()){
 if(locks.has(item.id)||active>=2)continue;const p=await store.read(item.id);if(!syncDue(p)&&!p.pendingSyncEvents?.length)continue;
 if(p.buildRunId&&['queued','running','paused'].includes((await runs.read(p.buildRunId)).status))continue;
 if(p.revisions.length>=100){p.sync.enabled=false;p.events.push({text:'עדכון אוטומטי נעצר במגבלת 100 גרסאות',at:new Date().toISOString()});await persist(p);continue;}
 const prior=await runs.read(p.latestBuildId);await enqueueBuild(p.id,prior.options,{trigger:'sync'});
 }await drainBuilds();}finally{syncing=false;}}
const syncTimer=setInterval(()=>syncTick().catch(console.error),30000);syncTimer.unref();
app.get('/api/projects',route(async(_req,res)=>res.json(await store.list())));
app.get('/api/projects/:id',route(async(req,res)=>res.json(await projectSummary(await store.read(req.params.id)))));
app.post('/api/existing-client',route(async(req,res)=>locked('existing-client',async()=>{
 const username=req.body.username;if(typeof username!=='string'||!username.trim()||username.length>120)throw Error('יש להזין שם משתמש קיים');
 for(const item of await store.list()){const p=await store.read(item.id);if(p.existingClient?.username===username.trim())return res.json(await projectSummary(p));}
 if((await store.list()).length>=30)throw Error('מגבלת 30 פרויקטים מקומיים');
 const p=await (app.locals.loadExistingClient||loadExistingClient)(username);await persist(p);res.json(await projectSummary(p));
})));
app.post('/api/projects',route(async(req,res)=>{
 const {url,platform}=req.body;const parsed=new URL(url);if(parsed.protocol!=='https:'||!['shopify','woocommerce','magento','custom'].includes(platform))throw Error('בחרו כתובת HTTPS ופלטפורמה');
 if((await store.list()).length>=30)throw Error('מגבלת 30 פרויקטים מקומיים');
 const p={id:randomUUID(),url:parsed.href,platform,name:parsed.hostname,status:'created',events:[],messages:[],revisions:[],updatedAt:new Date().toISOString()};await persist(p);res.json(summary(p));
}));
app.post('/api/projects/:id/fast-track',route(async(req,res)=>locked(req.params.id,async()=>{
 const p=await store.read(req.params.id);
 if(req.body.action==='analyze')await analyzeExisting(p,app.locals.fastTrackAgent||askChatAgent,app.locals.readSearchSignals);
 else if(req.body.action==='reindex'){reindexExisting(p);runtimes.clear();}
 else throw Error('פעולה לא תקינה');await persist(p);res.json(await projectSummary(p));
})));
app.post('/api/projects/:id/build',route(async(req,res)=>{
 if(locks.has(req.params.id))return res.status(409).json({error:'כבר מתבצעת פעולה'});
 const run=await enqueueBuild(req.params.id,req.body.options||{});res.status(202).json({started:true,runId:run.id});
}));
app.post('/api/projects/:id/build/control',route(async(req,res)=>{
 const p=await store.read(req.params.id);if(!p.buildRunId)throw Error('אין ריצת בנייה');const run=await runs.read(p.buildRunId),action=req.body.action;
 if(!['pause','cancel','resume'].includes(action))throw Error('פעולה לא תקינה');
 if(action==='resume'){
  if(locks.has(p.id)||!['paused','failed','partial','cancelled'].includes(run.status))throw Error('הריצה אינה זמינה להמשך');
  if(p.revisions.length>=100)throw Error('מגבלת 100 גרסאות');
  if(req.body.limits){const options=validateBuildOptions({...run.options,...req.body.limits},p.platform);run.options={...run.options,maxFetches:options.maxFetches,maxModelCalls:options.maxModelCalls,maxMinutes:options.maxMinutes};}
  const failedStage=req.body.stage||run.stages.find(s=>s.status==='failed')?.key||(run.status==='partial'?(run.errors.find(e=>!e.optional)?.stage||'index'):null);if(failedStage)await prepareRepair(run,failedStage,p,runs);if(run.repair?.status==='needs_input')run.repair.status='executing';run.status='queued';await runs.save(run);await runs.control(run.id,{action:'run'});queue.add(p.id);drainBuilds().catch(console.error);
 }else{
  if(!['queued','running','paused'].includes(run.status))throw Error('הריצה כבר הסתיימה');
  await runs.control(run.id,{action:action==='cancel'?'cancel':'pause'});
  if(run.status!=='running'){run.status=action==='cancel'?'cancelled':'paused';await runs.save(run);queue.delete(p.id);}
 }
 res.json({runId:run.id,status:run.status});
}));
app.post('/api/projects/:id/repair',route(async(_req,res)=>{
 res.status(409).json({error:'טיפול אוטומטי שמריץ מחדש את הקטלוג בוטל. השתמש בתיקון החיפוש הממוקד: איתור מוצרים, כינויים ובדיקת תוצאות.'});
}));
app.get('/api/projects/:id/builds',route(async(req,res)=>{await store.read(req.params.id);const list=(await runs.list()).filter(r=>r.projectId===req.params.id);res.json(list.map(r=>({...r,checkpoints:undefined,pinnedProfile:undefined})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));}));
app.post('/api/projects/:id/activate',route(async(req,res)=>locked(req.params.id,async()=>{
 const p=await store.read(req.params.id),id=req.body.runId||p.latestBuildId;if(!id)throw Error('אין גרסה מוכנה');const r=await runs.read(id);
 if(r.projectId!==p.id||!['ready','activated'].includes(r.status)||!r.validation?.passed)throw Error('הגרסה לא עברה את בדיקות המוכנות');
 await runs.asset(id,'bundle');p.previousActiveBuildId=p.activeBuildId||null;p.activeBuildId=id;p.activeRevisionNumber=r.revisionNumber||p.revisions.length;await persist(p);r.status='activated';await runs.save(r);runtimes.clear();res.json(await projectSummary(p));
})));
async function catalogCards(p,runId=null){
 if(!runId)return p.productCards||[];const r=await runs.read(runId);if(r.projectId!==p.id)throw Error('גרסת קטלוג לא שייכת לחנות');
 try{return await runs.asset(runId,'cards')}catch(e){if(e.code!=='ENOENT')throw e;}
 try{const products=await runs.asset(runId,'products');return products.map(raw=>({...raw,title:raw.name,tenantId:p.id,summary:(raw.description||'').slice(0,400),tagDecisions:[],enrichmentStatus:'pending',buildId:runId}));}catch(e){if(e.code==='ENOENT')return [];throw e;}
}
app.get('/api/projects/:id/products',route(async(req,res)=>{
 const p=await store.read(req.params.id);let cards=await catalogCards(p,req.query.runId||null);const query=String(req.query.q||'').toLowerCase();if(query)cards=cards.filter(p=>(p.title+' '+p.id+' '+(p.sku||'')).toLowerCase().includes(query));
 const offset=Number(req.query.offset||0),limit=Number(req.query.limit||24);if(!Number.isSafeInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>100)throw Error('עמוד לא תקין');
 res.json({total:cards.length,products:cards.slice(offset,offset+limit),nextOffset:offset+limit<cards.length?offset+limit:null});
}));
app.get('/api/projects/:id/products/:productId',route(async(req,res)=>{const p=await store.read(req.params.id);let card=(await catalogCards(p,req.query.runId||null)).find(p=>p.id===req.params.productId);if(!card)throw Error('המוצר לא נמצא');
 if(req.query.runId&&card.enrichmentStatus==='pending'){try{const enriched=await runs.asset(req.query.runId,'enriched-'+hash(card.id).slice(0,24));card={...card,...enriched.product,title:enriched.product.name};}catch(e){if(e.code!=='ENOENT')throw e;}}
 res.json(card);}));
app.get('/api/projects/:id/context',route(async(req,res)=>res.json((await store.read(req.params.id)).storeContext||null)));
app.post('/api/projects/:id/sync',route(async(req,res)=>locked(req.params.id,async()=>{const p=await store.read(req.params.id);p.sync=validateSync(req.body);await persist(p);res.json(p.sync);}))); 
app.post('/api/projects/:id/sync/event',route(async(req,res)=>locked(req.params.id,async()=>{
 const p=await store.read(req.params.id),{eventId,productId,action}=req.body;if(typeof eventId!=='string'||!eventId||eventId.length>128||typeof productId!=='string'||productId.length>128||!['create','update','delete'].includes(action))throw Error('אירוע מוצר לא תקין');
 if(!p.latestBuildId)throw Error('נדרשת בנייה ראשונית לפני קבלת אירועים');p.sync??=validateSync({});p.pendingSyncEvents??=[];p.seenSyncEvents??=[];
 if(!p.seenSyncEvents.includes(eventId)){p.pendingSyncEvents.push({eventId,productId,action});p.seenSyncEvents=[...p.seenSyncEvents,eventId].slice(-1000);await persist(p);}
 res.status(202).json({accepted:true,eventId});
})));
app.post('/api/projects/:id/active/search',route(async(req,res)=>res.json(await (await runtime(req.params.id,true)).search(req.body))));
app.get('/api/projects/:id/agent-logs',route(async(req,res)=>{await store.read(req.params.id);try{res.json(await agentLogs.read(req.params.id))}catch(e){if(e.code!=='ENOENT')throw e;res.json({runs:[]});}}));
app.post('/api/projects/:id/source-fields',route(async(req,res)=>locked(req.params.id,async()=>{const p=await store.read(req.params.id);const result=await refreshSourceFields(p);await persist(p);runtimes.clear();res.json(result);})));
app.post('/api/projects/:id/agent',route(async(req,res)=>locked(req.params.id,async()=>{
 const {message,context}=req.body;if(typeof message!=='string'||!message.trim()||message.length>3000||context&&JSON.stringify(context).length>6000)throw Error('הודעה לא תקינה');
 const p=await store.read(req.params.id);if(!p.revisions.length||!p.productCards?.length)throw Error('יש לפתוח קטלוג שמור לפני עבודה עם האייג׳נט');
 let archive;try{archive=await agentLogs.read(p.id)}catch(e){if(e.code!=='ENOENT')throw e;archive={id:p.id,runs:[]};}
 const log={id:randomUUID(),startedAt:new Date().toISOString(),status:'running',request:message,events:[]};archive.runs=[log,...archive.runs].slice(0,5);
 const event=async entry=>{log.events.push({...entry,at:new Date().toISOString()});log.events=log.events.slice(-100);await agentLogs.save(archive);};
 await agentLogs.save(archive);
 const model=async prompt=>{await event({type:'model_request',characters:prompt.length});try{const r=await (app.locals.workspaceAgent||askChatAgent)(prompt);const raw=r?.rawResponse||JSON.stringify(r);await event({type:'model_response',raw:String(raw).slice(0,50000),truncated:String(raw).length>50000,usage:r?.usage});return r;}catch(e){await event({type:'model_error',message:e.message,raw:String(e.modelResponse||'').slice(0,50000)});throw e;}};
 try{const next=await workspaceAgent(p,message,context,model,{onEvent:entry=>event({...entry,result:entry.result?JSON.stringify(entry.result).slice(0,20000):undefined})});await persist(next);runtimes.clear();log.status='completed';log.finishedAt=new Date().toISOString();await agentLogs.save(archive);res.json(await projectSummary(next));}
 catch(e){log.status='failed';log.error=e.message;log.finishedAt=new Date().toISOString();await agentLogs.save(archive);throw e;}

})));
// Unified studio chat. Streams NDJSON events: note, tool, tool_done, message, done | error.
app.post('/api/projects/:id/studio',route(async(req,res)=>locked(req.params.id,async()=>{
 const {message,context}=req.body;if(typeof message!=='string'||!message.trim()||message.length>3000||context&&JSON.stringify(context).length>6000)throw Error('הודעה לא תקינה');
 const p=await store.read(req.params.id);if(!p.revisions.length||!p.productCards?.length)throw Error('ללקוח הזה עדיין אין קטלוג שמור. פתח לקוח קיים או בנה אותו בממשק המתקדם');
 let archive;try{archive=await agentLogs.read(p.id)}catch(e){if(e.code!=='ENOENT')throw e;archive={id:p.id,runs:[]};}
 const log={id:randomUUID(),startedAt:new Date().toISOString(),status:'running',request:message,events:[]};archive.runs=[log,...archive.runs].slice(0,5);
 const record=async entry=>{log.events.push({...entry,at:new Date().toISOString()});log.events=log.events.slice(-150);await agentLogs.save(archive);};
 res.status(200).set({'Content-Type':'application/x-ndjson; charset=utf-8','X-Accel-Buffering':'no'});res.flushHeaders();
 let closed=false;res.on('close',()=>{closed=true;});
 const send=event=>{if(!closed)res.write(JSON.stringify(event)+'\n');};
 const model=async prompt=>{await record({type:'model_request',characters:prompt.length});try{const r=await (app.locals.studioAgent||askStudioAgent)(prompt);await record({type:'model_response',raw:String(r?.rawResponse||JSON.stringify(r)).slice(0,50000),usage:r?.usage});return r;}catch(e){await record({type:'model_error',message:e.message,raw:String(e.modelResponse||'').slice(0,50000)});throw e;}};
 try{
  const judge=async prompt=>{await record({type:'judge_request',characters:prompt.length});const r=await (app.locals.studioJudge||app.locals.studioAgent||askJudgeAgent)(prompt);await record({type:'judge_response',raw:String(r?.rawResponse||JSON.stringify(r)).slice(0,20000)});return r;};
  const next=await studioAgent(p,message,{model,judge,context,services:app.locals.studioServices,onEvent:async e=>{send(e);if(e.type!=='note')await record({...e,products:undefined});}});
  await persist(next);runtimes.clear();log.status='completed';send({type:'done',project:await projectSummary(next)});
 }catch(e){log.status='failed';log.error=e.message;send({type:'error',message:e.message});}
 log.finishedAt=new Date().toISOString();await agentLogs.save(archive);res.end();
})));
// Site crawl: the studio controls it through MongoDB (STUDIO_CRAWL_DB) and a crawl worker does the work — on Render,
// or on this computer when STUDIO_CRAWL_WORKER=local. Merging into the working catalog happens here, under the project lock.
const crawlDb=process.env.STUDIO_DASHBOARD_MONGODB_URI||process.env.MONGODB_URI?createCrawlDb():null,crawls=app.locals.crawlStore||crawlDb?.store;
const needCrawls=()=>{const s=app.locals.crawlStore||crawls;if(!s)throw Error('הסורק דורש חיבור MongoDB');return s;};
async function mergeCrawled(id){const s=await needCrawls().read(id);if(!s||!Object.keys(s.products).length)throw Error('אין עדיין דפים שנסרקו למיזוג');
 const p=await store.read(id);const counts=mergeCrawl(p,s,p.scraper?.status==='active'?p.scraper.spec:null);await persist(p);runtimes.clear();return {...counts,pages:Object.keys(s.products).length};}
const crawlView=async id=>{const p=await store.read(id);return {...crawlStatus(await needCrawls().meta(id),crawlSettings(p),p.siteCrawl||null),workerMode:process.env.STUDIO_CRAWL_WORKER==='local'?'local':'cloud'};};
app.get('/api/projects/:id/crawl',route(async(req,res)=>res.json(await crawlView(req.params.id))));
app.post('/api/projects/:id/crawl/start',route(async(req,res)=>locked(req.params.id,async()=>{const p=await store.read(req.params.id);await startCrawl(p,needCrawls(),{reseed:req.body?.reseed===true});if(process.env.STUDIO_CRAWL_WORKER==='local')await ensureLocalWorker(dataDir);res.json(await crawlView(p.id));})));
app.post('/api/projects/:id/crawl/stop',route(async(req,res)=>{const p=await store.read(req.params.id);await stopCrawl(p,needCrawls());res.json(await crawlView(p.id));}));
app.post('/api/projects/:id/crawl/settings',route(async(req,res)=>locked(req.params.id,async()=>{const p=await store.read(req.params.id);p.crawler={...p.crawler,...validateSettings(req.body||{})};await persist(p);const meta=await needCrawls().meta(p.id);if(meta)await needCrawls().control(p.id,{settings:crawlSettings(p)});res.json(await crawlView(p.id));})));
app.post('/api/projects/:id/crawl/merge',route(async(req,res)=>locked(req.params.id,async()=>{const counts=await mergeCrawled(req.params.id);res.json({...counts,crawl:await crawlView(req.params.id)});})));
// Auto-merge: every 10 minutes, tenants that enabled it get newly crawled pages merged (skipped while the project is busy).
if(crawls)setInterval(async()=>{try{for(const {id} of await store.list()){if(locks.has(id))continue;const p=await store.read(id);if(!crawlSettings(p).autoMerge)continue;const m=await crawls.meta(id);if(!m||(m.productCount||0)<=(p.siteCrawl?.pages||0))continue;await locked(id,()=>mergeCrawled(id)).catch(()=>{});}}catch(e){console.error('auto-merge',e.message);}},10*60*1000).unref();
// Production baseline: what the current search does for real shoppers (works → must be kept, fails → must improve),
// evaluated against the working rules. Every agent save is guarded against losing what is kept.
function baselineView(p){
 const b=p.baseline,e=p.baselineEval;if(!b)return {status:'none'};
 const byQuery=new Map(b.queries.map(q=>[q.query,q])),rows=s=>(e?.results||[]).filter(r=>r.status===s).map(r=>({...r,targets:byQuery.get(r.query)?.targets,unavailable:byQuery.get(r.query)?.unavailable,productionTop:byQuery.get(r.query)?.productionTop,productionZeroRate:byQuery.get(r.query)?.productionZeroRate}));
 return {status:'ready',builtAt:b.builtAt,days:b.days,totalQueries:b.totalQueries,totalSearches:b.totalSearches,tracked:b.queries.length,evaluatedAt:e?.at||null,stale:!!e&&(e.profileHash!==hash(p.revisions.at(-1).profile)||e.indexVersion!==p.searchIndex?.version),summary:e?.summary||null,
  lost:rows('lost').slice(0,60),partial:rows('partial').slice(0,40),gaps:rows('gap').slice(0,60),fails:(e?.results||[]).filter(r=>r.production==='fails').slice(0,40)};
}
const evaluateStored=p=>{const e=evaluateBaseline(p,p.revisions.at(-1).profile);p.baselineEval={...e,profileHash:hash(p.revisions.at(-1).profile),indexVersion:p.searchIndex?.version};};
app.get('/api/projects/:id/baseline',route(async(req,res)=>res.json(baselineView(await store.read(req.params.id)))));
app.post('/api/projects/:id/baseline/build',route(async(req,res)=>locked(req.params.id,async()=>{
 const days=req.body?.days??30;if(!Number.isInteger(days)||days<7||days>180)throw Error('טווח ימים לא תקין');
 const p=await store.read(req.params.id);p.baseline=buildBaseline(p,await (app.locals.productionSignals||readProductionSignals)(p,{days}));evaluateStored(p);await persist(p);res.json(baselineView(p));
})));
app.post('/api/projects/:id/baseline/evaluate',route(async(req,res)=>locked(req.params.id,async()=>{const p=await store.read(req.params.id);if(!p.baseline)throw Error('יש לבנות קודם את הבסיס');evaluateStored(p);await persist(p);res.json(baselineView(p));})));
// Processing lab: a strong model researches this tenant and proposes processing; each plan is tried on a sample,
// then run and measured against the production baseline (rolled back if it loses anything that works).
const streamed=(req,res,work)=>locked(req.params.id,async()=>{
 res.status(200).set({'Content-Type':'application/x-ndjson; charset=utf-8','X-Accel-Buffering':'no'});res.flushHeaders();
 let closed=false;res.on('close',()=>{closed=true;});const send=e=>{if(!closed)res.write(JSON.stringify(e)+'\n');};
 try{send({type:'done',...await work(send)});}catch(e){send({type:'error',message:e.message});}res.end();
});
app.get('/api/projects/:id/processing',route(async(req,res)=>{const p=await store.read(req.params.id);res.json(p.processingLab||{status:'none'});}));
app.post('/api/projects/:id/processing/research',route(async(req,res)=>streamed(req,res,async send=>{
 const p=await store.read(req.params.id);const lab=await researchProcessing(p,{planner:app.locals.planner||askPlanner,dbFields:p.existingClient?dbFields:async()=>null,onEvent:async e=>send(e)});await persist(p);return {lab};
})));
app.post('/api/projects/:id/processing/:plan/trial',route(async(req,res)=>locked(req.params.id,async()=>{const p=await store.read(req.params.id);const plan=await trialPlan(p,req.params.plan,{worker:app.locals.processingWorker||askProcessing,dbSearch});await persist(p);res.json(plan);})));
app.post('/api/projects/:id/processing/:plan/run',route(async(req,res)=>streamed(req,res,async send=>{
 const p=await store.read(req.params.id);const r=await runPlan(p,req.params.plan,{worker:app.locals.processingWorker||askProcessing,importField:importDbField,onEvent:async e=>send(e)});await persist(p);runtimes.clear();return {result:r,lab:p.processingLab};
})));
// Dedicated scraper: the planner model writes a product-page spec from sample pages; validated against the catalog,
// activated by the operator, then used by the tenant's crawl (a reseed builds the page list with its URL rule).
app.get('/api/projects/:id/scraper',route(async(req,res)=>{const p=await store.read(req.params.id);res.json(p.scraper||{status:'none'});}));
app.post('/api/projects/:id/scraper/build',route(async(req,res)=>streamed(req,res,async send=>{
 const p=await store.read(req.params.id);if(!p.url||!/^https:/.test(p.url))throw Error('ללקוח אין כתובת אתר HTTPS');
 const fetchPage=app.locals.fetchPage||(async url=>{await new Promise(r=>setTimeout(r,1000));return getPage(url);});
 const urls=await sampleProductUrls(p,{fetchPage,count:8});
 const scraper=await buildScraper(p,{planner:app.locals.planner||askPlanner,fetchPage,samples:urls.slice(0,4),validation:urls.slice(4),onEvent:async e=>send(e)});await persist(p);return {scraper};
})));
app.post('/api/projects/:id/scraper/:action(activate|deactivate)',route(async(req,res)=>locked(req.params.id,async()=>{
 const p=await store.read(req.params.id);if(!p.scraper?.spec)throw Error('אין סורק ייעודי');p.scraper.status=req.params.action==='activate'?'active':'draft';await persist(p);
 const s=app.locals.crawlStore||crawls;if(s&&await s.meta(p.id))await s.control(p.id,{target:crawlTarget(p)});res.json(p.scraper);
})));
// Automatic check of real shopper queries (zero results, no clicks, top), optionally fixing findings. Streams NDJSON like /studio.
app.post('/api/projects/:id/audit',route(async(req,res)=>locked(req.params.id,async()=>{
 const {fix=false,limit=12,fixLimit=5,source='signals'}=req.body||{};if(typeof fix!=='boolean'||!['signals','baseline'].includes(source))throw Error('בקשה לא תקינה');
 const p=await store.read(req.params.id);if(!p.revisions.length||!p.productCards?.length)throw Error('ללקוח הזה עדיין אין קטלוג שמור');
 res.status(200).set({'Content-Type':'application/x-ndjson; charset=utf-8','X-Accel-Buffering':'no'});res.flushHeaders();
 let closed=false;res.on('close',()=>{closed=true;});const send=event=>{if(!closed)res.write(JSON.stringify(event)+'\n');};
 try{
  const next=await auditSearches(p,{fix,limit,fixLimit,source,model:app.locals.studioAgent||askStudioAgent,judge:app.locals.studioJudge||app.locals.studioAgent||askJudgeAgent,services:app.locals.studioServices,signals:app.locals.searchSignals,onEvent:async e=>send(e)});
  await persist(next);runtimes.clear();send({type:'done',project:await projectSummary(next)});
 }catch(e){send({type:'error',message:e.message});}
 res.end();
})));
app.post('/api/projects/:id/chat',route(async(req,res)=>{
 const id=req.params.id;let before;
 const context=req.body.context;
 if(context!==undefined&&context!==null&&(typeof context!=='object'||Array.isArray(context)||JSON.stringify(context).length>6000))throw Error('הקשר הבקשה ארוך מדי או לא תקין');
 if(typeof req.body.message!=='string'||!req.body.message.trim()||req.body.message.length>3000)throw Error('הודעה לא תקינה');
 const waiting=await store.read(id);
 if(waiting.tagging&&locks.has(id)){const deadline=Date.now()+15*60000;while(locks.has(id)){if(res.destroyed) return;if(Date.now()>deadline)throw Error('הסיווג הקודם עדיין פועל. אפשר לשלוח שוב בעוד רגע.');await new Promise(resolve=>setTimeout(resolve,500));}}
 const p=await locked(id,async()=>{
  const proj=await store.read(id),message=req.body.message;if(typeof message!=='string'||!message.trim()||message.length>3000)throw Error('הודעה לא תקינה');
  if(!proj.revisions.length){if(!proj.buildRunId)throw Error('יש לבנות מודול לפני עריכה');const run=await runs.read(proj.buildRunId);if(run.projectId!==id||run.status!=='partial')throw Error('יש להמתין להשלמת הבנייה לפני עריכה');const bundle=await runs.asset(run.id,'bundle');Object.assign(proj,{catalog:bundle.catalog,tagAssignments:bundle.tagAssignments,productCards:bundle.productCards,storeContext:bundle.storeContext,searchIndex:bundle.searchIndex,vectorIndex:bundle.vectorIndex,productCardsProfileHash:hash(bundle.profile),draftBuildId:run.id});proj.revisions=[{number:1,profile:bundle.profile,note:'גרסת עבודה מתוך בנייה חלקית',createdAt:new Date().toISOString()}];}
  if(proj.revisions.length>=100)throw Error('מגבלת 100 גרסאות לפרויקט');
  before=proj.revisions.at(-1).profile;
  const answer=await focusedRepair(proj,message,context,app.locals.chatAgent||askChatAgent);
  const profile=validateProfile(answer.profile);const changes=Object.keys(profile).filter(k=>JSON.stringify(profile[k])!==JSON.stringify(before[k]));
  const learningCheck=guardLearning(proj,profile);
  if(changes.length)proj.revisions.push({number:proj.revisions.length+1,profile,createdAt:new Date().toISOString(),note:message,changes});proj.messages.push({role:'user',text:message},{role:'assistant',text:String(answer.message||'לא בוצע שינוי'),changes,trace:answer.trace,checks:answer.checks,affectedProducts:answer.affectedProducts});proj.messages=proj.messages.slice(-60);proj.status='draft';
  for(const [tag,assignment] of Object.entries(proj.tagAssignments||{})){if(before.tagDefinitions?.[tag]&&profile.tagDefinitions?.[tag]&&hash(before.tagDefinitions[tag])!==hash(profile.tagDefinitions[tag])&&before.tagDefinitions[tag].definition===profile.tagDefinitions[tag].definition&&assignment.definitionHash===hash(before.tagDefinitions[tag])){assignment.definitionHash=hash(profile.tagDefinitions[tag]);for(const d of assignment.decisions||[])d.definitionHash=assignment.definitionHash;}}
  proj.productCardsProfileHash=hash(profile);proj.mongoPolicyDirty=true;learningState(proj).lastCheck=learningCheck;if(changes.length)captureExamples(proj,answer.checks,'chat');await persist(proj);runtimes.clear();
  return proj;
 });
 res.json(await projectSummary(p));
}));
app.post('/api/projects/:id/learning',route(async(req,res)=>locked(req.params.id,async()=>{
 const p=await store.read(req.params.id),{action,id,status}=req.body;
 if(!p.revisions.length||!p.productCards?.length||!p.searchIndex)throw Error('נדרש קטלוג עם אינדקס קיים כדי להתחיל ללמוד');
 if(p.revisions.length>=100&&action==='apply')throw Error('מגבלת 100 גרסאות');
 if(action==='import')importExamples(p);
 else if(action==='review')reviewExample(p,id,status,req.body);
 else if(action==='propose'){importExamples(p);await proposeLearning(p,app.locals.learningAgent||askChatAgent);}
 else if(action==='check')learningState(p).lastCheck={results:evaluateExamples(p,p.revisions.at(-1).profile),at:new Date().toISOString()};
 else if(action==='refresh')refreshProposal(p,id);
 else if(action==='apply'){acceptProposal(p,id);runtimes.clear();}
 else if(action==='dismiss'){const proposal=learningState(p).proposals.find(s=>s.id===id);if(!proposal)throw Error('ההצעה לא נמצאה');if(proposal.status==='applied')throw Error('ניתן לשחזר גרסה כדי לבטל שינוי שכבר הוחל');proposal.status='dismissed';}
 else throw Error('פעולת למידה לא תקינה');
 await persist(p);res.json(await projectSummary(p));
})));
app.post('/api/projects/:id/rollback',route(async(req,res)=>locked(req.params.id,async()=>{
 const p=await store.read(req.params.id);const r=p.revisions.find(r=>r.number===req.body.revision);if(!r||p.revisions.length>=100)throw Error('גרסה לא תקינה');p.revisions.push({...r,number:p.revisions.length+1,createdAt:new Date().toISOString(),note:'חזרה לגרסה '+r.number});refreshDerived(p);await persist(p);runtimes.clear();res.json(summary(p));
})));
app.post('/api/projects/:id/search',route(async(req,res)=>{if(active>=2)return res.status(429).json({error:'המערכת עסוקה'});active++;try{const {runId,...searchRequest}=req.body;const result=await (await runtime(req.params.id,false,runId||null)).search(searchRequest);if(req.body.runId){result.metadata={...result.metadata,preview:true};result.message=['תצוגת בנייה חלקית — סיווגים ואימות קטלוג עדיין דורשים טיפול.',result.message].filter(Boolean).join(' ');}
 const p=await store.read(req.params.id);if(settingsOf(p).enabled&&typeof searchRequest.query==='string'){const oos=result.matches?.length?[]:outOfStockHits(p.productCards,searchRequest.query);result.concierge=decideTrigger(result,searchRequest.query,settingsOf(p),oos);if(oos.length)result.oos=oos;}
 res.json(result)}finally{active--}}));
app.post('/api/projects/:id/concierge',route(async(req,res)=>{
 const p=await store.read(req.params.id);if(!settingsOf(p).enabled)throw Error('הקונסיירז׳ כבוי ללקוח הזה');
 if(!p.revisions.length||!p.productCards?.length)throw Error('נדרש קטלוג שמור');
 const {message,trigger,history}=req.body;if(history&&(!Array.isArray(history)||JSON.stringify(history).length>12000))throw Error('היסטוריה לא תקינה');
 const model=app.locals.conciergeAgent||askChatAgent;
 res.json(await conciergeTurn(p,{message,trigger,history},model));
}));
app.post('/api/projects/:id/provision',route(async(req,res)=>locked(req.params.id,async()=>{
 const p=await store.read(req.params.id);const result=await provision(p);p.provisioning=result;await persist(p);res.json(result);
})));
app.post('/api/projects/:id/research',route(async(req,res)=>locked(req.params.id,async()=>{
 const p=await store.read(req.params.id);
 const result=await researchGarmin(p);
 const profile=validateProfile(result.profile);
 p.catalog=result.catalog;p.research=result.report;
 p.revisions.push({number:p.revisions.length+1,profile,note:'מחקר קטלוג מלא ומעבד Garmin',createdAt:new Date().toISOString()});
 await persist(p);runtimes.clear();res.json(summary(p));
})));
app.post('/api/projects/:id/scrape',route(async(req,res)=>locked(req.params.id,async()=>{
 const p=await store.read(req.params.id);
 if(!p.catalog?.products?.length)throw Error('נדרש קטלוג לפני סריקת באדג׳ים');
 const scan=await scrapeCatalog(p);p.catalog.products=applyObservations(p.catalog.products,scan);
 p.badgeScan=scan;refreshDerived(p);p.events.push({text:`נסרקו ${scan.pages} עמודים; זוהו ${scan.observations.reduce((n,o)=>n+o.badges.length,0)} באדג׳ים ב־${scan.observations.length} מוצרים. ${scan.errors.length} עמודים נכשלו.`,at:scan.scannedAt});
 await persist(p);runtimes.clear();res.json(summary(p));
})));
app.get('/api/projects/:id/download',route(async(req,res)=>{
 const p=await store.read(req.params.id);res.set('Content-Disposition','attachment; filename="tenant-module.zip"').type('application/zip').send(zipFiles(buildArtifacts(p).files));
}));
app.get('/api/projects/:id/readiness',route(async(req,res)=>{
 const p=await store.read(req.params.id);
 if(!p.revisions?.length)return res.json({ready:false,score:0,checks:[],deployment:null});
 const r=studioTools.dashboard_readiness.run({p,profile:p.revisions.at(-1).profile,services:{refreshSourceFields,database:{fields:dbFields,search:dbSearch,importField:importDbField}}});
 res.json(r);
}));
app.get('/api/projects/:id/artifacts',route(async(req,res)=>{
 const p=await store.read(req.params.id),r=p.revisions.at(-1);if(!r)throw Error('טרם נוצר מודול');
 res.json(buildArtifacts(p));
}));
app.get('/',(_req,res)=>res.sendFile(dir+'public/studio.html'));
app.use(express.static(dir+'public'));
app.use((error,_req,res,_next)=>{if(res.headersSent){res.end();return;}res.status(400).json({error:error.message});});
export {app};
if(import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const host=process.env.HOST||'0.0.0.0';app.listen(port,host,()=>{console.log(`Tenant Studio: http://${host==='0.0.0.0'?'127.0.0.1':host}:${port}`);recoverBuilds().catch(console.error);});}
