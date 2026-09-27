import {refreshClientProfile} from './core/client-brain.mjs';
import {reviewSearchPerformance,proposalRequest} from './core/search-performance.mjs';
import {workspaceAgent} from './core/workspace-agent.mjs';
import {studioAgent,tools as studioTools,createStudioSearch} from './core/studio-agent.mjs';
import {auditSearches} from './core/search-audit.mjs';
import {readProductionSignals,buildBaseline,evaluateBaseline,applyPopularity,baselineRegressions} from './core/baseline.mjs';
import {researchProcessing,trialPlan,runPlan,undoPlan} from './core/processing-lab.mjs';
import {buildScraper,sampleProductUrls} from './core/scraper-builder.mjs';
import {mergeCrawl,get as getPage} from './core/site-crawler.mjs';
import {createCrawlDb} from './core/crawl-store.mjs';
import {crawlStatus,crawlSettings,crawlTarget,startCrawl,stopCrawl,validateSettings,ensureLocalWorker} from './core/crawl-control.mjs';
import {runInProcess,runningInProcess} from './core/crawl-worker.mjs';
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
import {stat,mkdir,rename,rm} from 'node:fs/promises';
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
import {createMirror,overlayTag,SiteBlocked,fetchOrigin,isChallenge} from './core/site-mirror.mjs';
import {detectTakeover,mergeSiteConfig,applySettings} from './core/search-takeover.mjs';
import {readSiteConfig,publishSiteConfig,rollbackSiteConfig,listBackups,storefrontDefaults} from './core/takeover-control.mjs';
import {engineTag,engineSource,engineDir,previewConfig,enginePage,recordEvent,readEvents,clearEvents} from './core/takeover-preview.mjs';
import {createNativeSearch,catalogLookup} from './core/native-search.mjs';
import {storeHome,detectStore,demoBuildOptions} from './core/onboard.mjs';
import {fetchPublic} from './discover.mjs';
import {buildMiniServer} from './mini-server.mjs';
import {buildStorefrontPlugin,buildWidgetCode} from './storefront-plugin.mjs';
import {attachPlugin,pluginSummary,readPluginFile,updatePlugin,rollbackPlugin,releasePlugin} from './core/plugin-workspace.mjs';
import {exportToDashboard,dashboardStatus,codeStatus} from './core/dashboard-export.mjs';
import {readControl,setControl} from './core/production-control.mjs';
import {publishModule,readPublished,editionKey} from './core/module-publish.mjs';
import {connectToDashboard,syncProductsToDashboard,suggestNames} from './core/dashboard-connect.mjs';
import {slugOf} from './mini-server.mjs';
const dir=fileURLToPath(new URL('.',import.meta.url));
const dataDir=resolve(process.env.STUDIO_DATA_DIR||dir+'data');
const agentLogs=createStore(resolve(dataDir,'agent-logs'));
const store=createStore(dataDir),runs=createRunStore(resolve(dataDir,'runs'));
const queue=new Set();let draining=false;
const locks=new Set(),runtimes=new Map();let active=0;
const port=Number(process.env.PORT||process.env.STUDIO_PORT||4320),token=randomUUID();
const allowRemote=process.env.ALLOW_REMOTE==='true'||!!process.env.RENDER||process.env.NODE_ENV==='production';
const app=express();
app.use('/api/projects/:id/plugin/import',express.json({limit:'12mb'}));
app.use('/api/projects/:id/plugin/edit',express.json({limit:'2mb'}));
app.use('/api/projects/:id/takeover/settings',express.json({limit:'256kb'}));
app.use(express.json({limit:'32kb',verify:(req,_res,buffer)=>{req.rawBody=buffer;}}));
// Demo mirror on its own host: http://<project-id>.demo.localhost:<port>/ serves the store at the root, so sites whose
// JavaScript router expects "/" (Vue/React storefronts) work, and the store's code never runs on the studio's origin.
// Everything on such a host is the mirror: the studio API is not reachable from it.
const DEMO_HOST=new RegExp(`^([a-f0-9-]{36})\\.demo\\.localhost:${port}$`,'i');
app.use((req,res,next)=>{
 const m=!allowRemote&&DEMO_HOST.exec(req.headers.host||'');if(!m)return next();
 const id=m[1].toLowerCase();
 if(req.headers.origin&&req.headers.origin!==`http://${id}.demo.localhost:${port}`)return res.status(403).json({code:'ORIGIN_DENIED',error:'מקור הבקשה אינו מורשה'});
 if(req.path.startsWith('/api/')||req.get('X-Studio-Token'))return res.status(404).end();
 req.demoHost=id;
 if(req.path!=='/demo-overlay.js'&&!req.path.startsWith(`/demo/${id}/`)&&req.path!==`/demo/${id}`){req.url=`/demo/${id}`+req.url;req.originalUrl=req.url;}
 res.set('Cache-Control','no-store');next();
});
app.use((req,res,next)=>{
 if(req.demoHost)return next();
 if(!allowRemote){
  if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host))return res.status(403).json({code:'HOST_DENIED',error:'יש לפתוח את ה־Studio בכתובת המקומית שלו'});
  if(req.headers.origin&&!['http://127.0.0.1:'+port,'http://localhost:'+port].includes(req.headers.origin))return res.status(403).json({code:'ORIGIN_DENIED',error:'מקור הבקשה אינו מורשה'});
 }
 res.set('Cache-Control','no-store');next();
});
const route=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
// ---------- demo mirror: the tenant's own site, with semantix search injected ----------
const mirror=createMirror({dataDir}),native=createNativeSearch();
const lookups=new WeakMap();
function lookupFor(rt,url){if(!lookups.has(rt))lookups.set(rt,catalogLookup(rt.products,new URL(url).origin));return lookups.get(rt);}
// Up to n semantix results (the service pages at 50).
async function searchUpTo(rt,query,n){
 let r=await rt.search({query:String(query).slice(0,200),limit:Math.min(n,50)});const matches=[...(r.matches||[])],total=r.total??matches.length;
 while(matches.length<n&&r.nextCursor){r=await rt.search({cursor:r.nextCursor,limit:Math.min(n-matches.length,50)});matches.push(...(r.matches||[]));}
 return {matches,total};
}
export function demoProductUrl(id,storeUrl,value,prefix=`/demo/${id}`){
 try{const target=new URL(value,new URL(storeUrl).origin),store=new URL(storeUrl);if(!['http:','https:'].includes(target.protocol))return null;return target.hostname.replace(/^www\./,'')===store.hostname.replace(/^www\./,'')?`${prefix}${target.pathname}${target.search}${target.hash}`:target.href;}catch{return null;}
}
// Path prefix of the mirror as the browser sees it: none on the demo host, /demo/<id> on the studio host.
const demoPrefix=(req,id)=>req.demoHost?'':`/demo/${id}`;
const demoMode=req=>{const value=/(?:^|;\s*)semantix_demo_mode=(native|overlay|plugin|engine)(?:;|$)/.exec(req.get('Cookie')||'')?.[1];return value||'native';};
const DEMO=/^\/demo\/([a-f0-9-]{36})(\/.*)?$/;
// Root-relative requests the rewriter could not see (built at runtime by site JS) arrive without the prefix; the Referer tells us which mirror sent them.
app.use((req,res,next)=>{
 if(DEMO.test(req.path)||req.path==='/demo-overlay.js'||req.get('X-Studio-Token'))return next();
 const ref=req.get('Referer');let m=null;try{m=ref&&DEMO.exec(new URL(ref).pathname);}catch{}
 if(!m)return next();
 res.redirect(307,'/demo/'+m[1]+req.originalUrl);
});
app.post('/demo/:id/__semantix/search',route(async(req,res)=>{
 if(active>=2)return res.status(429).json({error:'המערכת עסוקה, נסו שוב'});active++;
 try{const {query,cursor,limit}=req.body||{},project=await store.meta(req.params.id);const r=await (await runtime(req.params.id)).search(cursor?{cursor}:{query:String(query||'').slice(0,200),limit:Math.min(Number(limit)||24,48)});
  res.json({total:r.total,nextCursor:r.nextCursor,message:r.message,matches:(r.matches||[]).map(p=>({id:p.id,title:p.title,url:demoProductUrl(req.params.id,project.url,p.url,demoPrefix(req,req.params.id)),image:p.image,price:p.price,regularPrice:p.regularPrice,currency:p.currency||project.currency||'ILS',stockStatus:p.stockStatus}))});
 }finally{active--;}
}));
app.get('/demo/:id/__semantix/plugin.js',route(async(req,res)=>{
 const p=await store.read(req.params.id);if(!p.revisions?.length)throw Error('נדרשת גרסת חיפוש שמורה');
 const base=`${req.protocol}://${req.get('host')}`,prefix=demoPrefix(req,p.id);
 const code=buildWidgetCode({endpoint:`/demo/${p.id}/__semantix/search`,apiKey:'',storeOrigin:base+prefix+'/',platform:p.platform||'custom',currency:p.currency||'ILS'});
 res.type('application/javascript; charset=utf-8').set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).send(code);
}));
// ---------- full takeover preview: the real semantix-cdn loader + engine, answered by the studio ----------
app.get('/demo/:id/__semantix/engine/:file(loader.js|engine.js)',route(async(req,res)=>{
 await store.meta(req.params.id);const src=await engineSource(req.params.file);
 res.type('application/javascript; charset=utf-8').set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Semantix-Engine':src.from}).send(src.code);
}));
app.post('/demo/:id/__semantix/engine/site-config',route(async(req,res)=>{const p=await store.read(req.params.id);if(!p.takeover?.siteConfig)return res.status(404).json({error:'siteConfig not found'});res.json(previewConfig(p.takeover));}));
async function engineSearch(req,res,request){
 if(active>=2)return res.status(429).json({error:'busy'});active++;
 try{const project=await store.meta(req.params.id),r=await (await runtime(req.params.id)).search(request);res.json(enginePage(r,u=>demoProductUrl(req.params.id,project.url,u,demoPrefix(req,req.params.id))));}finally{active--;}
}
app.post('/demo/:id/__semantix/engine/:kind(search|fast-search)',route(async(req,res)=>{
 const {query,limit}=req.body||{};recordEvent(req.params.id,req.params.kind,{query,limit});
 await engineSearch(req,res,{query:String(query||'').slice(0,200),limit:Math.min(Number(limit)||24,48)});
}));
app.get('/demo/:id/__semantix/engine/search/:more(load-more|auto-load-more)',route(async(req,res)=>{
 recordEvent(req.params.id,req.params.more,{});await engineSearch(req,res,{cursor:String(req.query.token||''),limit:24});
}));
// Tracking the engine sends (product-click, search-to-cart incl. checkout, zero-search…) is logged for verification only.
app.post('/demo/:id/__semantix/engine/:event([a-z-]{3,40})',route(async(req,res)=>{await store.meta(req.params.id);recordEvent(req.params.id,req.params.event,req.body);res.status(204).end();}));

// In the engine preview, add-to-cart requests the engine sends are answered here in the store's own response shape, so
// the whole flow (button → cart request → tracking) runs; nothing is sent to the store and its real cart does not change.
const CART_OK={magento:()=>({}),woocommerce:()=>({fragments:{},cart_hash:''}),shopify:b=>({items:(b?.items||[]).map(i=>({id:i.id,quantity:i.quantity||1}))})};
app.post(DEMO,express.text({type:()=>true,limit:'32kb'}),(req,res,next)=>previewCartAdd(req,res,next).catch(next));
async function previewCartAdd(req,res,next){
 if(demoMode(req)!=='engine')return next();
 const [,id,rest]=DEMO.exec(req.path),p=await store.read(id),cfg=p.takeover?.siteConfig;
 const patterns=cfg?.cartInterceptor?.atcPatterns||[],path=rest+(req.originalUrl.includes('?')?req.originalUrl.slice(req.originalUrl.indexOf('?')):'');
 if(!cfg?.addToCart||cfg.addToCart.mode!=='engine'||!patterns.some(x=>path.toLowerCase().includes(x.toLowerCase())))return next();
 // JSON bodies (Shopify) were already parsed by the app-wide JSON parser; form bodies arrive as text.
 const body=typeof req.body==='string'?Object.fromEntries(new URLSearchParams(req.body)):{...(req.body||{})};
 if(body&&typeof body==='object')delete body.form_key;
 recordEvent(id,'preview-cart-add',{path:rest,body});
 res.json((CART_OK[cfg.platform]||CART_OK.magento)(body));
}
app.all(DEMO,route(async(req,res)=>{
 const [,id,rest]=DEMO.exec(req.path);if(!rest)return res.redirect(302,'/demo/'+id+'/');
 if(!['GET','HEAD'].includes(req.method))return res.status(403).json({error:'מראה ההדגמה לקריאה בלבד — פעולות כמו הוספה לסל או התחברות אינן נשלחות לאתר האמיתי'});
 if(req.get('Service-Worker'))return res.status(404).end();
 const p=await store.meta(id);if(!p.url)throw Error('לפרויקט אין כתובת אתר');
 const url=new URL(req.originalUrl,'http://x'),refresh=url.searchParams.has('__semantix_refresh');url.searchParams.delete('__semantix_refresh');
 // ?__semantix_mode=plugin|overlay|native switches how search is demonstrated (remembered in a studio-only cookie).
 const asked=url.searchParams.get('__semantix_mode');
 if(asked){url.searchParams.delete('__semantix_mode');const selected=['plugin','overlay','native','engine'].includes(asked)?asked:'native';res.cookie('semantix_demo_mode',selected,{path:req.demoHost?'/':'/demo/'+id,sameSite:'lax',httpOnly:true});return res.redirect(302,demoPrefix(req,id)+url.pathname.slice(('/demo/'+id).length)+url.search);}
 const mode=demoMode(req);
 const path=url.pathname.slice(('/demo/'+id).length)+url.search;
 try{
  const transform=mode==='native'?async({url:href,text,type,request})=>{
   const rt=await runtime(id);
   return native.render({project:p,url:href,text,type,lookup:lookupFor(rt,p.url),fetchText:u=>mirror.fetchText(p,u,request),search:(q,n)=>searchUpTo(rt,q,n)});
  }:null;
  const injection=mode==='plugin'?`<meta name="robots" content="noindex,nofollow"><script defer src="/demo/${id}/__semantix/plugin.js"></script>`:mode==='engine'?engineTag(p):overlayTag(p,mode,demoPrefix(req,id));
  const r=await mirror.serve(p,path,{prefix:demoPrefix(req,id),absolute:req.demoHost?`http://${req.headers.host}`:demoPrefix(req,id),refresh,userAgent:req.get('User-Agent'),accept:req.get('Accept'),language:req.get('Accept-Language'),ajax:req.get('X-Requested-With')==='XMLHttpRequest',overlay:injection,transform});
  res.status(r.status).set(r.headers);res.end(req.method==='HEAD'?undefined:r.body);
 }catch(e){
  if(e instanceof SiteBlocked){const min=Math.max(1,Math.ceil((e.until-Date.now())/60000));return res.status(503).set('Retry-After',String(min*60)).type('text/html; charset=utf-8').send(`<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><title>ההדגמה מושהית</title><body style="font-family:system-ui;max-width:560px;margin:12vh auto;padding:0 16px;line-height:1.6;color:#1b1f24"><h1 style="font-size:22px">האתר ביקש אימות מהשרת של ההדגמה</h1><p>מנגנון הגנת הבוטים של ${String(new URL(p.url).hostname).replace(/[<>&"]/g,'')} חסם זמנית בקשות מהשרת הזה. ההדגמה לא עוקפת את החסימה.</p><p>דפים שכבר נטענו בעבר ממשיכים לעבוד מהמטמון. נסו שוב בעוד כ־${min} דקות, או בקשו מהלקוח להתיר את כתובת ה־IP של השרת.</p><p><a href="javascript:history.back()">חזרה</a></p></body></html>`);}
  res.status(502).type('text/plain; charset=utf-8').send('המראה לא הצליח לטעון את הדף מהאתר: '+e.message);
 }
}));
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
// Stopping an agent: the browser aborts its stream; the next (or in-flight) model call then rejects with Stopped.
// Agents persist only on completion, so a stopped turn leaves the project as it was (an audit keeps fixes already saved).
class Stopped extends Error{constructor(){super('הפעולה נעצרה לבקשתך');this.stopped=true;}}
function stopOnClose(res){
 let stop;const stopped=new Promise((_,reject)=>{stop=()=>reject(new Stopped());});stopped.catch(()=>{});
 const state={stopped:false};res.on('close',()=>{if(!res.writableEnded){state.stopped=true;stop();}});
 state.guard=fn=>async(...args)=>{if(state.stopped)throw new Stopped();return Promise.race([fn(...args),stopped]);};
 return state;
}
async function locked(id,fn){if(locks.has(id)||active>=2)throw Error('כבר מתבצעת פעולה. נסו שוב בעוד רגע.');locks.add(id);active++;try{return await fn()}finally{locks.delete(id);active--}}
function summary(p,run=null){return {...p,pluginWorkspace:p.pluginWorkspace?{name:p.pluginWorkspace.name,platform:p.pluginWorkspace.platform,revision:p.pluginWorkspace.revisions.at(-1)?.number}:null,productCards:undefined,searchIndex:undefined,vectorIndex:undefined,studioVectors:p.studioVectors?{model:p.studioVectors.model,dimensions:p.studioVectors.dimensions,count:p.studioVectors.ids.length,builtAt:p.studioVectors.builtAt}:undefined,tagAssignments:Object.fromEntries(Object.entries(p.tagAssignments||{}).map(([tag,a])=>[tag,{counts:a.counts,productsScanned:a.productsScanned,failedBatches:a.failedBatches}])),buildRun:run?{...run,checkpoints:undefined,pinnedProfile:undefined}:null,catalog:p.catalog?{...p.catalog,products:undefined,count:p.catalog.products.length}:null}}
async function projectSummary(p){const run=p.buildRunId?await runs.read(p.buildRunId):null;return {...summary(p,run),learning:learningSummary(p),chatModel:chatModel(),studioModel:studioModel(),previewSearchAvailable:!p.revisions.length&&run?.status==='partial'&&run.stages.some(s=>s.key==='index'&&s.status==='completed'),connectorAvailable:!!connectorFor(p),takeoverReady:!!p.takeover?.siteConfig?.features?.fullReplace}}
async function persist(p){p.events=p.events.slice(-100);p.updatedAt=new Date().toISOString();const saved=await store.save(p);schedulePublish(p);return saved;}
// Every approved revision of an exported module is published to the store's database (semantix_module), where
// dashboard-server picks it up within 30 s; the production switch on the user still decides whether shoppers see it.
// Publishes of one project run one after another (debounced), always from the latest saved state.
const publishState=new Map(),publishTimers=new Map(),publishChains=new Map();
function schedulePublish(p){
 if(!p.dashboardExport?.slug||!p.revisions?.length||!p.productCards?.length)return;
 const key=editionKey(p),state=publishState.get(p.id);if(state?.key===key&&!state.error)return;
 clearTimeout(publishTimers.get(p.id));
 publishTimers.set(p.id,setTimeout(()=>{publishTimers.delete(p.id);
  const run=(publishChains.get(p.id)||Promise.resolve()).then(async()=>{
   try{const fresh=await store.read(p.id);if(!fresh.dashboardExport?.slug)return;
    const r=await (app.locals.publishModule||publishModule)(fresh,fresh.dashboardExport.slug);
    publishState.set(p.id,{key:editionKey(fresh),revision:r.revision,at:new Date().toISOString(),error:null});}
   catch(e){publishState.set(p.id,{key,error:e.message,at:new Date().toISOString()});console.error('[publish]',p.id,e.message);}});
  publishChains.set(p.id,run);run.finally(()=>{if(publishChains.get(p.id)===run)publishChains.delete(p.id);});
 },app.locals.publishDelayMs??1500).unref?.());
}
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
const runtimeByFile=new Map();
async function runtime(id,activeVersion=false,previewRunId=null){
 // Skip re-parsing an unchanged (possibly 100MB+) project file when its runtime is already built.
 let fileKey=null;if(/^[a-f0-9-]{36}$/.test(id)){try{fileKey=id+':'+(await stat(resolve(dataDir,id+'.json'))).mtimeMs+':'+activeVersion+':'+(previewRunId||'');}catch{}}
 const known=fileKey&&runtimeByFile.get(fileKey);if(known&&runtimes.has(known))return runtimes.get(known);
 const built=await buildRuntime(id,activeVersion,previewRunId);
 if(fileKey){runtimeByFile.clear();runtimeByFile.set(fileKey,built.key);}
 return built.runtime;
}
async function buildRuntime(id,activeVersion,previewRunId){
 const p=await store.read(id);if(previewRunId){const run=await runs.read(previewRunId);if(run.projectId!==id||run.status!=='partial')throw Error('תצוגת הבנייה אינה זמינה');const bundle=await runs.asset(previewRunId,'bundle');Object.assign(p,{catalog:bundle.catalog,tagAssignments:bundle.tagAssignments,productCards:bundle.productCards,storeContext:bundle.storeContext,searchIndex:bundle.searchIndex,vectorIndex:bundle.vectorIndex});p.productCardsProfileHash=hash(bundle.profile);p.revisions=[{number:0,profile:bundle.profile}];}
 if(activeVersion){if(!p.activeBuildId)throw Error('אין גרסה פעילה');const bundle=await runs.asset(p.activeBuildId,'bundle');Object.assign(p,{catalog:bundle.catalog,tagAssignments:bundle.tagAssignments,productCards:bundle.productCards,storeContext:bundle.storeContext,searchIndex:bundle.searchIndex,vectorIndex:bundle.vectorIndex});p.productCardsProfileHash=hash(bundle.profile);p.revisions=[{number:p.activeRevisionNumber||1,profile:bundle.profile}];}
 if(!p.revisions.length)throw Error('עדיין לא נוצר מודול');const revision=p.revisions.at(-1),key=id+':'+revision.number+':'+p.updatedAt+':'+activeVersion+':'+(previewRunId||'');
 if(!runtimes.has(key)){runtimes.clear();let retrieve;
  const runId=previewRunId?null:activeVersion?p.activeBuildId:p.latestBuildId;
  if(runId){const r=await runs.read(runId);if(r.index?.mongo?.atlas==='ready'&&(activeVersion||!p.mongoPolicyDirty)&&p.productCardsProfileHash===hash(revision.profile))retrieve=await createMongoRetriever(p.productCards,{...revision.profile,tenantId:id},r.index.mongo);}
  runtimes.set(key,createDraftRuntime(p,revision,{retrieve}));}
 return {key,runtime:runtimes.get(key)};
}
async function drainBuilds(){
 if(draining)return;draining=true;
 try{for(const id of [...queue]){
  if(active>=2)break;
  const p=await store.read(id);if(!p.buildRunId){queue.delete(id);continue;}const run=await runs.read(p.buildRunId);
  if(run.status!=='queued'){queue.delete(id);continue;}if(locks.has(id))continue;
  queue.delete(id);
  const work=locked(id,async()=>{
   const result=await executeBuild(p,run,runs,{provisionIndex:provision,...app.locals.buildDeps});
   finishRepair(run);await runs.save(run);
   // An onboarding build that finished with gaps (e.g. some pages unreadable) is still a usable demo draft; the gaps stay in its report.
   const demoDraft=run.trigger==='onboard'&&result.run.status==='partial';
   if(result.bundle&&(result.run.status==='ready'||demoDraft)){
    Object.assign(p,{catalog:result.bundle.catalog,tagAssignments:result.bundle.tagAssignments,productCards:result.bundle.productCards,productCardsProfileHash:hash(result.bundle.profile),storeContext:result.bundle.storeContext,searchIndex:result.bundle.searchIndex,vectorIndex:result.bundle.vectorIndex});
    p.revisions.push({number:p.revisions.length+1,profile:result.bundle.profile,createdAt:new Date().toISOString(),note:'בנייה מלאה '+run.id.slice(0,8)});
    run.revisionNumber=p.revisions.at(-1).number;await runs.save(run);
    p.buildReport={coverage:run.coverage,metrics:run.metrics,validation:run.validation,index:run.index,errors:run.errors,warnings:run.warnings};p.mongoPolicyDirty=false;p.name=result.bundle.profile.name;p.latestBuildId=run.id;p.status='draft';p.buildHistory=[...(p.buildHistory||[]),{id:run.id,at:new Date().toISOString(),products:result.bundle.productCards.length}].slice(-20);
    if(run.trigger==='onboard'){const warnings=[...new Set(run.warnings||[])].slice(0,4),failed=(run.validation?.checks||[]).filter(c=>!c.passed&&c.name).map(c=>c.name);
     p.onboarding={...p.onboarding,status:'ready',finishedAt:new Date().toISOString()};
     p.messages.push({role:'assistant',text:[`**הלקוח מוכן להדגמה.** נבנו ${result.bundle.productCards.length.toLocaleString('he-IL')} כרטיסי מוצר, קונטקסט חנות ואינדקס חיפוש.`,'לחץ על **הדגמה על האתר** כדי לראות את האתר של הלקוח עם החיפוש שלנו, או כתוב כאן מה לבדוק ולשפר.',...(demoDraft?['','בנייה חלקית — פערים שנשארו:',...failed.map(n=>'- בדיקה שלא עברה: `'+n+'`')]:[]),...(warnings.length?['','הערות:',...warnings.map(w=>'- '+w)]:[])].join('\n')});}
    else p.messages.push({role:'assistant',text:'הבנייה הסתיימה: קטלוג, תגיות, כרטיסי מוצר, קונטקסט ואינדקס מוכנים לבדיקה.'});
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
async function recoverBuilds(){for(const item of await store.metas()){if(!item.tagging)continue;const project=await store.read(item.id);if(project.tagging){project.tagging=false;project.events.push({text:'סיווג התגיות הקודם נקטע בהפעלת השרת מחדש. ניתן להמשיך לערוך; הסיווג שנקטע דורש ניסיון נוסף.',at:new Date().toISOString()});await persist(project);}}
 for(const run of await runs.list()){
 if(run.repair?.status==='analyzing'){run.repair.status='failed';run.repair.result='האבחון נקטע בהפעלה מחדש. אפשר לנסות שוב.';await runs.save(run);}
 if(run.status==='running'){if(run.repair?.status==='executing'){run.repair.status='needs_input';run.repair.result='הטיפול נעצר בהפעלה מחדש. ניתן להמשיך מההתקדמות שנשמרה.';}run.status='paused';run.message='השרת הופעל מחדש; נקודות ההמשך נשמרו';for(const s of run.stages)if(s.status==='running')s.status='pending';await runs.save(run);}
 if(run.status==='queued')queue.add(run.projectId);
 }await drainBuilds();}
const queueTimer=setInterval(()=>drainBuilds().catch(console.error),2000);queueTimer.unref();
let syncing=false;
async function syncTick(){if(syncing)return;syncing=true;try{for(const item of await store.metas()){
 if(locks.has(item.id)||active>=2)continue;if(!syncDue(item)&&!item.pendingSyncEvents)continue;const p=await store.read(item.id);if(!syncDue(p)&&!p.pendingSyncEvents?.length)continue;
 if(p.buildRunId&&['queued','running','paused'].includes((await runs.read(p.buildRunId)).status))continue;
 if(p.revisions.length>=100){p.sync.enabled=false;p.events.push({text:'עדכון אוטומטי נעצר במגבלת 100 גרסאות',at:new Date().toISOString()});await persist(p);continue;}
 const prior=await runs.read(p.latestBuildId);await enqueueBuild(p.id,prior.options,{trigger:'sync'});
 }await drainBuilds();}finally{syncing=false;}}
const syncTimer=setInterval(()=>syncTick().catch(console.error),30000);syncTimer.unref();
app.get('/api/projects',route(async(_req,res)=>res.json(await store.list())));
app.get('/api/projects/:id',route(async(req,res)=>res.json(await projectSummary(await store.read(req.params.id)))));
app.post('/api/existing-client',route(async(req,res)=>locked('existing-client',async()=>{
 const username=req.body.username,userId=typeof req.body.userId==='string'?req.body.userId:null;if(typeof username!=='string'||!username.trim()||username.length>120)throw Error('יש להזין שם משתמש קיים');
 // Without a pick, an already-open project with this exact username is reused; a pick is always resolved first.
 if(!userId)for(const item of await store.metas()){if(item.username!==username.trim())continue;const p=await store.read(item.id);if(p.existingClient?.username===username.trim())return res.json(await projectSummary(p));}
 if((await store.list()).length>=30)throw Error('מגבלת 30 פרויקטים מקומיים');
 let p;
 try{p=await (app.locals.loadExistingClient||loadExistingClient)(username,{userId});}
 catch(e){if(e.code==='AMBIGUOUS')return res.status(409).json({error:e.message,code:e.code,candidates:e.candidates});throw e;}
 for(const item of await store.metas()){if(item.username!==p.existingClient?.username)continue;const open=await store.read(item.id);if(open.existingClient?.dbName===p.existingClient?.dbName)return res.json(await projectSummary(open));}
 await persist(p);res.json(await projectSummary(p));
})));
app.post('/api/projects',route(async(req,res)=>{
 const {url,platform}=req.body;const parsed=new URL(url);if(parsed.protocol!=='https:'||!['shopify','woocommerce','magento','custom'].includes(platform))throw Error('בחרו כתובת HTTPS ופלטפורמה');
 if((await store.list()).length>=30)throw Error('מגבלת 30 פרויקטים מקומיים');
 const p={id:randomUUID(),url:parsed.href,platform,name:parsed.hostname,status:'created',events:[],messages:[],revisions:[],updatedAt:new Date().toISOString()};await persist(p);res.json(summary(p));
}));
// New client from a URL: detect the platform and the best public catalog source, write a dedicated scraper when the
// pages lack structured data, then queue a demo build (catalog → research → tags → cards → context → index). Streams NDJSON.
const onboarding=new Set();
app.post('/api/onboard',route(async(req,res)=>{
 const home=storeHome(req.body?.url),host=new URL(home).hostname.replace(/^www\./,'');
 for(const item of await store.metas())if(item.url&&!item.existing&&new URL(item.url).hostname.replace(/^www\./,'')===host)return res.json({existing:true,project:await projectSummary(await store.read(item.id))});
 if((await store.list()).length>=30)throw Error('מגבלת 30 פרויקטים מקומיים');
 if(onboarding.has(host))throw Error('האתר הזה כבר בתהליך קליטה');if(onboarding.size>=2)throw Error('שתי קליטות כבר רצות; נסו שוב בעוד רגע');
 onboarding.add(host);
 res.status(200).set({'Content-Type':'application/x-ndjson; charset=utf-8','X-Accel-Buffering':'no'});res.flushHeaders();
 let closed=false;res.on('close',()=>{closed=true;});const send=e=>{if(!closed)res.write(JSON.stringify(e)+'\n');};const halt=stopOnClose(res);
 let p=null;
 try{
  const fetchSource=halt.guard(app.locals.onboardFetch||((url,options)=>fetchPublic(url,0,options)));
  const detection=await detectStore(home,{fetchSource,onEvent:async e=>send(e)});
  send({type:'detected',detection});
  p={id:randomUUID(),url:detection.origin,platform:detection.platform,name:detection.title||host,status:'created',events:[],messages:[],revisions:[],updatedAt:new Date().toISOString(),
   onboarding:{startedAt:new Date().toISOString(),status:'detected',detection}};
  p.messages.push({role:'user',text:'קליטת לקוח חדש: '+detection.origin});
  await persist(p);
  if(detection.source.scraper){
   send({type:'note',text:'בונה סורק ייעודי לדפי המוצר של האתר'});
   const scraper=await buildScraper(p,{planner:halt.guard(app.locals.planner||askPlanner),fetchPage:url=>fetchSource(url),samples:detection.samples.slice(0,3),validation:detection.samples.slice(3),onEvent:async e=>send(e)});
   const fill=scraper.validation.fill;
   if(fill.name<0.8||fill.key<0.8){p.onboarding.status='needs_source';p.messages.push({role:'assistant',text:'לא הצלחתי לכתוב סורק אמין לדפי המוצר של האתר (שם/מזהה מוצר לא חולצו ברוב הדפים). בקשו מהלקוח פיד מוצרים (CSV/JSON) והמשיכו בממשק המתקדם.'});await persist(p);throw Error('הסורק הייעודי לא עבר אימות על דפי הדוגמה');}
   scraper.status='active';
   send({type:'scraper',fill,productUrl:scraper.spec.productUrl,fields:Object.keys(scraper.spec.fields)});
  }
  const source={platform:'API ציבורי של הפלטפורמה',sitemap:'מפת האתר',crawl:'מעקב אחר קישורי האתר'}[detection.source.sourceType];
  p.messages.push({role:'assistant',text:[`**${p.name}** — ${detection.platform==='custom'?'אתר מותאם':detection.platform}. מקור הקטלוג: ${source}${detection.source.scraper?' עם סורק ייעודי שנכתב לאתר':''}.`,'',...detection.notes.map(n=>'- '+n),'','מתחיל בנייה: קטלוג מלא → מחקר החנות והתחום → תגיות → כרטיסי מוצר → קונטקסט → אינדקס. אפשר לעקוב כאן.'].join('\n')});
  p.onboarding.status='building';await persist(p);
  if(halt.stopped)throw new Stopped();
  const run=await enqueueBuild(p.id,demoBuildOptions(detection),{trigger:'onboard'});
  send({type:'done',project:await projectSummary(await store.read(p.id)),runId:run.id});
 }catch(e){
  if(p){try{const saved=await store.read(p.id);if(!saved.revisions.length&&!saved.buildRunId){saved.onboarding={...saved.onboarding,status:saved.onboarding?.status==='needs_source'?'needs_source':e.stopped?'stopped':'failed',error:e.message};await persist(saved);}}catch{}}
  send({type:e.stopped?'stopped':'error',message:e.message,projectId:p?.id||null});
 }finally{onboarding.delete(host);res.end();}
}));
app.post('/api/projects/:id/onboard/build',route(async(req,res)=>{
 const p=await store.read(req.params.id),detection=p.onboarding?.detection;if(!detection)throw Error('ללקוח הזה אין זיהוי אתר מקליטה');
 if(detection.source.scraper&&p.scraper?.status!=='active')throw Error('דרוש סורק ייעודי פעיל — בנה אותו בלשונית ״סורק״');
 const run=await enqueueBuild(p.id,demoBuildOptions(detection),{trigger:'onboard'});res.status(202).json({started:true,runId:run.id});
}));
// Deleting a client moves its project file, build runs and agent log to data/trash/<id>-<time>/ (restorable by moving
// them back) and drops its demo mirror cache. The client's own source database is never touched. The name must be retyped.
app.post('/api/projects/:id/delete',route(async(req,res)=>locked(req.params.id,async()=>{
 const id=req.params.id,p=await store.meta(id);
 if(typeof req.body?.name!=='string'||req.body.name.trim()!==String(p.name).trim())throw Error('שם הלקוח לאישור המחיקה אינו תואם');
 const owned=(await runs.list()).filter(r=>r.projectId===id);
 if(owned.some(r=>['queued','running'].includes(r.status)))throw Error('בנייה רצה ללקוח הזה — השהה או בטל אותה לפני מחיקה');
 const dest=resolve(dataDir,'trash',id+'-'+Date.now());await mkdir(resolve(dest,'runs'),{recursive:true});
 const move=async(from,to)=>{try{await rename(from,to);}catch(e){if(e.code!=='ENOENT')throw e;}};
 await move(resolve(dataDir,id+'.json'),resolve(dest,id+'.json'));await rm(resolve(dataDir,id+'.meta.json'),{force:true});
 for(const r of owned)await move(resolve(dataDir,'runs',r.id),resolve(dest,'runs',r.id));
 await move(resolve(dataDir,'agent-logs',id+'.json'),resolve(dest,'agent-log.json'));
 await rm(resolve(dataDir,'mirror',id),{recursive:true,force:true});
 const crawlStore=app.locals.crawlStore||crawls;if(crawlStore)try{if((await crawlStore.meta(id))?.desired==='running')await crawlStore.control(id,{desired:'stopped'});}catch{}
 queue.delete(id);runtimes.clear();runtimeByFile.clear();
 res.json({deleted:true,name:p.name,trash:dest});
})));
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
 const record=async entry=>{log.events.push({...entry,at:new Date().toISOString()});log.events=log.events.slice(-400);await agentLogs.save(archive);};
 res.status(200).set({'Content-Type':'application/x-ndjson; charset=utf-8','X-Accel-Buffering':'no'});res.flushHeaders();
 let closed=false;res.on('close',()=>{closed=true;});const halt=stopOnClose(res);
 const send=event=>{if(!closed)res.write(JSON.stringify(event)+'\n');};
 const model=async prompt=>{await record({type:'model_request',characters:prompt.length});try{const r=await (app.locals.studioAgent||askStudioAgent)(prompt);await record({type:'model_response',raw:String(r?.rawResponse||JSON.stringify(r)).slice(0,50000),usage:r?.usage});return r;}catch(e){await record({type:'model_error',message:e.message,raw:String(e.modelResponse||'').slice(0,50000)});throw e;}};
 try{
  const judge=async prompt=>{await record({type:'judge_request',characters:prompt.length});const r=await (app.locals.studioJudge||app.locals.studioAgent||askJudgeAgent)(prompt);await record({type:'judge_response',raw:String(r?.rawResponse||JSON.stringify(r)).slice(0,20000)});return r;};
  const next=await studioAgent(p,message,{model:halt.guard(model),judge:halt.guard(judge),context,services:app.locals.studioServices,onEvent:async e=>{send(e);if(e.type!=='note')await record({...e,products:undefined});}});
  await persist(next);runtimes.clear();log.status='completed';send({type:'done',project:await projectSummary(next)});
 }catch(e){log.status=e.stopped?'stopped':'failed';log.error=e.message;send({type:e.stopped?'stopped':'error',message:e.message});}
 log.finishedAt=new Date().toISOString();await agentLogs.save(archive);res.end();
})));
// Site crawl: the studio controls it through MongoDB (STUDIO_CRAWL_DB) and a crawl worker does the work — on Render,
// or on this computer when STUDIO_CRAWL_WORKER=local. Merging into the working catalog happens here, under the project lock.
const crawlDb=process.env.STUDIO_DASHBOARD_MONGODB_URI||process.env.MONGODB_URI?createCrawlDb():null,crawls=app.locals.crawlStore||crawlDb?.store;
const needCrawls=()=>{const s=app.locals.crawlStore||crawls;if(!s)throw Error('הסורק דורש חיבור MongoDB');return s;};
async function mergeCrawled(id){const s=await needCrawls().read(id);if(!s||!Object.keys(s.products).length)throw Error('אין עדיין דפים שנסרקו למיזוג');
 const p=await store.read(id),profile=p.revisions.at(-1).profile,before=p.baseline?(p.baselineEval?.profileHash===hash(profile)&&p.baselineEval.indexVersion===p.searchIndex?.version?p.baselineEval:evaluateBaseline(p,profile)):null;
 const counts=mergeCrawl(p,s,p.scraper?.status==='active'?p.scraper.spec:null);
 // A merge changes what exists and what is in stock: measure it against production and report, do not block.
 let impact=null;if(before){evaluateStored(p);const lost=baselineRegressions(before,p.baselineEval);impact={keptBefore:before.summary.keptShare,keptAfter:p.baselineEval.summary.keptShare,lost:lost.slice(0,20).map(r=>({query:r.query,missing:(r.missing||[]).map(m=>m.title)}))};}
 await persist(p);runtimes.clear();return {...counts,pages:Object.keys(s.products).length,impact};}
const crawlView=async id=>{const p=await store.read(id);return {...crawlStatus(await needCrawls().meta(id),crawlSettings(p),p.siteCrawl||null),workerMode:crawlMode(),inProcess:runningInProcess(id)};};
// Default: the studio runs crawls itself. STUDIO_CRAWL_WORKER=local keeps the detached local worker, =remote a Render worker.
const crawlMode=()=>['local','remote'].includes(process.env.STUDIO_CRAWL_WORKER)?process.env.STUDIO_CRAWL_WORKER:'studio';
const crawlLog=(id,...parts)=>console.log('[crawl]',id.slice(0,8),...parts);
// After a restart, crawls that should be running continue in this studio once their previous lease lapses.
async function resumeCrawls(){if(crawlMode()!=='studio'||!crawls)return;
 const tick=async()=>{for(const item of await store.metas()){if(runningInProcess(item.id))continue;const m=await crawls.meta(item.id).catch(()=>null);if(m?.desired==='running'&&(!m.lease||Date.parse(m.lease.until)<Date.now()))runInProcess(crawls,item.id,{log:crawlLog});}};
 await tick();setInterval(()=>tick().catch(e=>console.error('crawl resume',e.message)),60000).unref();}
app.get('/api/projects/:id/crawl',route(async(req,res)=>res.json(await crawlView(req.params.id))));
app.post('/api/projects/:id/crawl/start',route(async(req,res)=>locked(req.params.id,async()=>{const p=await store.read(req.params.id);await startCrawl(p,needCrawls(),{reseed:req.body?.reseed===true});if(crawlMode()==='local')await ensureLocalWorker(dataDir);else if(crawlMode()==='studio')runInProcess(needCrawls(),p.id,{log:crawlLog});res.json(await crawlView(p.id));})));
app.post('/api/projects/:id/crawl/stop',route(async(req,res)=>{const p=await store.read(req.params.id);await stopCrawl(p,needCrawls());res.json(await crawlView(p.id));}));
app.post('/api/projects/:id/crawl/settings',route(async(req,res)=>locked(req.params.id,async()=>{const p=await store.read(req.params.id);p.crawler={...p.crawler,...validateSettings(req.body||{})};await persist(p);const meta=await needCrawls().meta(p.id);if(meta)await needCrawls().control(p.id,{settings:crawlSettings(p)});res.json(await crawlView(p.id));})));
app.post('/api/projects/:id/crawl/merge',route(async(req,res)=>locked(req.params.id,async()=>{const counts=await mergeCrawled(req.params.id);res.json({...counts,crawl:await crawlView(req.params.id)});})));
// Auto-merge: every 10 minutes, tenants that enabled it get newly crawled pages merged (skipped while the project is busy).
// Local worker mode: a worker that exited (its watchdog, a crash) is started again, so a crawl never stays stuck.
if(process.env.STUDIO_CRAWL_WORKER==='local')setInterval(()=>ensureLocalWorker(dataDir).then(w=>{if(w.started)console.log('crawl worker restarted',w.pid);}).catch(e=>console.error('crawl worker',e.message)),5*60*1000).unref();
if(crawls)setInterval(async()=>{try{for(const item of await store.metas()){const id=item.id;if(locks.has(id)||!crawlSettings(item).autoMerge)continue;const p=await store.read(id);const m=await crawls.meta(id);if(!m||(m.productCount||0)<=(p.siteCrawl?.pages||0))continue;await locked(id,()=>mergeCrawled(id)).catch(()=>{});}}catch(e){console.error('auto-merge',e.message);}},10*60*1000).unref();
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
 const p=await store.read(req.params.id),signals=await (app.locals.productionSignals||readProductionSignals)(p,{days});applyPopularity(p,signals);p.baseline=buildBaseline(p,signals);evaluateStored(p);runtimes.clear();await persist(p);res.json(baselineView(p));
})));
app.post('/api/projects/:id/baseline/evaluate',route(async(req,res)=>locked(req.params.id,async()=>{const p=await store.read(req.params.id);if(!p.baseline)throw Error('יש לבנות קודם את הבסיס');evaluateStored(p);await persist(p);res.json(baselineView(p));})));
// Processing lab: a strong model researches this tenant and proposes processing; each plan is tried on a sample,
// then run and measured against the production baseline (rolled back if it loses anything that works).
const streamed=(req,res,work)=>locked(req.params.id,async()=>{
 res.status(200).set({'Content-Type':'application/x-ndjson; charset=utf-8','X-Accel-Buffering':'no'});res.flushHeaders();
 let closed=false;res.on('close',()=>{closed=true;});const send=e=>{if(!closed)res.write(JSON.stringify(e)+'\n');};const halt=stopOnClose(res);
 try{send({type:'done',...await work(send,halt.guard)});}catch(e){send({type:e.stopped?'stopped':'error',message:e.message});}res.end();
});
app.post('/api/projects/:id/client-profile',route(async(req,res)=>locked(req.params.id,async()=>{
 const p=await store.read(req.params.id);const profile=await refreshClientProfile(p);await persist(p);res.json(profile);
})));
app.get('/api/projects/:id/performance',route(async(req,res)=>{const p=await store.read(req.params.id);res.json({profile:p.clientProfile||null,report:p.performanceReport||null});}));
app.post('/api/projects/:id/performance/review',route(async(req,res)=>streamed(req,res,async(send,guard)=>{
 const p=await store.read(req.params.id);const report=await reviewSearchPerformance(p,{days:req.body?.days??30,planner:guard(app.locals.planner||askPlanner),search:guard(async query=>createStudioSearch(p,p.revisions.at(-1).profile)(query,8)),onEvent:guard(async e=>send(e))});await persist(p);return {report};
})));
app.post('/api/projects/:id/performance/:proposal/prepare',route(async(req,res)=>{
 const p=await store.read(req.params.id);res.json({message:proposalRequest(p,req.params.proposal)});
}));
app.get('/api/projects/:id/processing',route(async(req,res)=>{const p=await store.read(req.params.id);res.json(p.processingLab||{status:'none'});}));
app.post('/api/projects/:id/processing/research',route(async(req,res)=>streamed(req,res,async(send,guard)=>{
 const p=await store.read(req.params.id);const lab=await researchProcessing(p,{planner:guard(app.locals.planner||askPlanner),dbFields:p.existingClient?dbFields:async()=>null,onEvent:async e=>send(e)});await persist(p);return {lab};
})));
app.post('/api/projects/:id/processing/:plan/undo',route(async(req,res)=>locked(req.params.id,async()=>{const p=await store.read(req.params.id);const plan=undoPlan(p,req.params.plan);await persist(p);runtimes.clear();res.json(plan);})));
app.post('/api/projects/:id/processing/:plan/trial',route(async(req,res)=>locked(req.params.id,async()=>{const p=await store.read(req.params.id);const plan=await trialPlan(p,req.params.plan,{worker:app.locals.processingWorker||askProcessing,dbSearch});await persist(p);res.json(plan);})));
app.post('/api/projects/:id/processing/:plan/run',route(async(req,res)=>streamed(req,res,async(send,guard)=>{
 const p=await store.read(req.params.id);const r=await runPlan(p,req.params.plan,{worker:guard(app.locals.processingWorker||askProcessing),importField:importDbField,search:q=>createStudioSearch(q,q.revisions.at(-1).profile),...(app.locals.embed&&{embed:app.locals.embed}),onEvent:async e=>send(e)});await persist(p);runtimes.clear();return {result:r,lab:p.processingLab};
})));
// Dedicated scraper: the planner model writes a product-page spec from sample pages; validated against the catalog,
// activated by the operator, then used by the tenant's crawl (a reseed builds the page list with its URL rule).
app.get('/api/projects/:id/scraper',route(async(req,res)=>{const p=await store.read(req.params.id);res.json(p.scraper||{status:'none'});}));
app.post('/api/projects/:id/scraper/build',route(async(req,res)=>streamed(req,res,async(send,guard)=>{
 const p=await store.read(req.params.id);if(!p.url||!/^https:/.test(p.url))throw Error('ללקוח אין כתובת אתר HTTPS');
 const fetchPage=app.locals.fetchPage||(async url=>{await new Promise(r=>setTimeout(r,1000));return getPage(url);});
 const urls=await sampleProductUrls(p,{fetchPage,count:8});
 const scraper=await buildScraper(p,{planner:guard(app.locals.planner||askPlanner),fetchPage:guard(fetchPage),samples:urls.slice(0,4),validation:urls.slice(4),onEvent:async e=>send(e)});await persist(p);return {scraper};
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
 let closed=false;res.on('close',()=>{closed=true;});const send=event=>{if(!closed)res.write(JSON.stringify(event)+'\n');};const halt=stopOnClose(res);
 try{
  const next=await auditSearches(p,{fix,limit,fixLimit,source,model:halt.guard(app.locals.studioAgent||askStudioAgent),judge:halt.guard(app.locals.studioJudge||app.locals.studioAgent||askJudgeAgent),services:app.locals.studioServices,signals:app.locals.searchSignals,onEvent:async e=>send(e)});
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
app.get('/api/projects/:id/plugin',route(async(req,res)=>res.json(pluginSummary(await store.read(req.params.id)))));
app.get('/api/projects/:id/plugin/file',route(async(req,res)=>res.json(readPluginFile(await store.read(req.params.id),req.query.path))));
app.post('/api/projects/:id/plugin/import',route(async(req,res)=>locked(req.params.id,async()=>{
 const p=await store.read(req.params.id),result=attachPlugin(p,req.body);await persist(p);res.json(result);
})));
app.post('/api/projects/:id/plugin/edit',route(async(req,res)=>locked(req.params.id,async()=>{
 const p=await store.read(req.params.id),result=updatePlugin(p,req.body);await persist(p);res.json(result);
})));
app.post('/api/projects/:id/plugin/rollback',route(async(req,res)=>locked(req.params.id,async()=>{
 const p=await store.read(req.params.id),result=rollbackPlugin(p,req.body);await persist(p);res.json(result);
})));
app.post('/api/projects/:id/plugin/generate',route(async(req,res)=>locked(req.params.id,async()=>{
 const p=await store.read(req.params.id),{manifest,files}=buildStorefrontPlugin(p,req.body);
 const result=attachPlugin(p,{name:'Semantix '+manifest.platform,platform:manifest.platform,expectedRevision:req.body.expectedRevision,source:'generated',files:Object.entries(files).map(([path,content])=>({path,content,encoding:'utf8'}))});
 await persist(p);res.json(result);
})));
app.post('/api/projects/:id/plugin/release',route(async(req,res)=>locked(req.params.id,async()=>{
 const p=await store.read(req.params.id),{release,zip}=releasePlugin(p,req.body);await persist(p);
 res.set('Content-Disposition',`attachment; filename="semantix-${release.platform}-r${release.revision}.zip"`).type('application/zip').send(zip);
})));
// ---------- full search takeover (siteConfig for the semantix-cdn engine) ----------
const takeoverBackups=()=>resolve(dataDir,'dashboard-backups','siteconfig');
const REQUIRED_STEPS=['resultsGrid','productCard','cardTemplate','cardFill'];
function takeoverView(p){
 const t=p.takeover;if(!t)return {takeover:null,engine:engineDir()?'local':'cdn',events:readEvents(p.id)};
 const ready=REQUIRED_STEPS.every(n=>t.report?.steps?.find(s=>s.name===n)?.ok);
 return {takeover:{...t,ready},engine:engineDir()?'local':'cdn',events:readEvents(p.id)};
}
// Search pages are read like a browser would (redirects followed, bot challenges respected, never cached).
async function takeoverFetch(url){
 for(let hop=0;hop<4;hop++){
  const r=await fetchOrigin(url,{accept:'text/html,application/xhtml+xml'});
  if(isChallenge(r))throw new SiteBlocked(Date.now()+10*60000);
  if([301,302,303,307,308].includes(r.status)&&r.headers.location){url=new URL(r.headers.location,url).href;continue;}
  return {status:r.status,text:r.body.toString('utf8'),url};
 }
 throw Error('יותר מדי הפניות בדף החיפוש');
}
const applyTakeoverSettings=applySettings;
app.get('/api/projects/:id/takeover',route(async(req,res)=>res.json(takeoverView(await store.read(req.params.id)))));
app.post('/api/projects/:id/takeover/detect',route(async(req,res)=>streamed(req,res,async(send,guard)=>{
 const p=await store.read(req.params.id);if(!p.url)throw Error('לפרויקט אין כתובת אתר');
 const result=await detectTakeover({url:p.url,products:p.productCards||[],fetchPage:guard(app.locals.takeoverFetch||takeoverFetch),onEvent:guard(async e=>send(e.type==='step'?{type:'note',text:`${e.ok?'✓':'✗'} ${e.name}: ${e.detail}`}:e))});
 // A fresh detection becomes the new base; the operator's settings are carried over and re-applied.
 const next={...result,detectedConfig:result.siteConfig,settings:p.takeover?.settings,published:p.takeover?.published||null};
 p.takeover=applyTakeoverSettings(next,{});
 await persist(p);return takeoverView(p);
})));
app.post('/api/projects/:id/takeover/settings',route(async(req,res)=>locked(req.params.id,async()=>{
 const p=await store.read(req.params.id);if(!p.takeover)throw Error('יש להריץ קודם זיהוי');applyTakeoverSettings(p.takeover,req.body);await persist(p);res.json(takeoverView(p));
})));
app.post('/api/projects/:id/takeover/events/clear',route(async(req,res)=>{await store.meta(req.params.id);clearEvents(req.params.id);res.json({events:[]});}));
app.get('/api/projects/:id/takeover/production',route(async(req,res)=>{
 const p=await store.read(req.params.id);if(!p.takeover)throw Error('יש להריץ קודם זיהוי');
 const current=await (app.locals.readSiteConfig||readSiteConfig)(p);
 res.json({...current,merged:mergeSiteConfig(current.siteConfig,p.takeover.siteConfig),backups:await listBackups(p,takeoverBackups())});
}));
app.post('/api/projects/:id/takeover/publish',route(async(req,res)=>locked(req.params.id,async()=>{
 const p=await store.read(req.params.id),view=takeoverView(p);if(!view.takeover?.ready)throw Error('הזיהוי לא הושלם בהצלחה — אין מה לפרסם');
 const result=await (app.locals.publishSiteConfig||publishSiteConfig)(p,p.takeover.siteConfig,{expectedHash:String(req.body?.expectedHash||''),backups:takeoverBackups()});
 p.takeover.published={at:result.at,hash:result.hash,backup:result.backup.split('/').pop(),users:result.users};
 p.events.push({type:'takeover-published',at:result.at,users:result.users});await persist(p);res.json({...takeoverView(p),result:{...result,siteConfig:undefined}});
})));
app.post('/api/projects/:id/takeover/rollback',route(async(req,res)=>locked(req.params.id,async()=>{
 const p=await store.read(req.params.id),result=await (app.locals.rollbackSiteConfig||rollbackSiteConfig)(p,String(req.body?.backup||''),{backups:takeoverBackups()});
 if(p.takeover)p.takeover.published=null;p.events.push({type:'takeover-rolled-back',at:new Date().toISOString(),backup:result.restored});await persist(p);res.json({...takeoverView(p),result});
})));

app.get('/api/projects/:id/storefront-defaults',route(async(req,res)=>res.json(await (app.locals.storefrontDefaults||storefrontDefaults)(await store.read(req.params.id)))));
app.post('/api/projects/:id/storefront-plugin',route(async(req,res)=>{
 const p=await store.read(req.params.id);
 const platform=req.body.platform||(await refreshClientProfile(p)).platform.value;
 if(!platform)throw Error('בחרו פלטפורמה ליצירת התוסף');
 const {manifest,files}=buildStorefrontPlugin(p,{...req.body,platform});
 res.set('Content-Disposition',`attachment; filename="semantix-${manifest.platform}-${manifest.version}.zip"`).type('application/zip').send(zipFiles(files));
}));
app.post('/api/projects/:id/storefront-code',route(async(req,res)=>{
 const p=await store.read(req.params.id),{manifest,files}=buildStorefrontPlugin(p,{endpoint:req.body.endpoint,apiKey:req.body.apiKey,platform:'custom'});
 res.json({manifest,code:files['embed.html']});
}));
// The tenant's mini server for dashboard-server: tenants/<slug>/ + the shared registry, as a ZIP.
app.get('/api/projects/:id/mini-server',route(async(req,res)=>{
 const {manifest,files}=buildMiniServer(await store.read(req.params.id));
 res.set('Content-Disposition',`attachment; filename="semantix-${manifest.slug}-r${manifest.revision}.zip"`).type('application/zip').send(zipFiles(files));
}));
// Local export: writes the module's code into the dashboard-server checkout and publishes its data to the store's database.
app.get('/api/dashboard',route(async(_req,res)=>res.json(await dashboardStatus())));
app.post('/api/projects/:id/dashboard-export',route(async(req,res)=>locked(req.params.id,async()=>{
 const p=await store.read(req.params.id),result=await (app.locals.exportToDashboard||exportToDashboard)(p,{backups:resolve(dataDir,'dashboard-backups')});
 p.dashboardExport={at:new Date().toISOString(),slug:result.slug,dbName:result.manifest.dbName,revision:result.manifest.revision,path:result.path,verified:result.verified?.ok??null};
 if(result.published)publishState.set(p.id,{key:editionKey(p),revision:result.published.revision,at:new Date().toISOString(),error:null});await persist(p);res.json(result);
})));
// A store onboarded from its URL becomes a dashboard client: users.users + <dbName>.products in the existing schema.
app.get('/api/projects/:id/dashboard-connect',route(async(req,res)=>{const p=await store.read(req.params.id);res.json({connected:p.existingClient?{username:p.existingClient.username,dbName:p.existingClient.dbName,createdByStudio:!!p.existingClient.createdByStudio}:null,suggestion:p.existingClient?null:suggestNames(p)});}));
app.post('/api/projects/:id/dashboard-connect',route(async(req,res)=>locked(req.params.id,async()=>{
 const p=await store.read(req.params.id),r=await (app.locals.connectToDashboard||connectToDashboard)(p,{username:req.body?.username,dbName:req.body?.dbName,email:req.body?.email||null});
 const at=new Date().toISOString();p.existingClient={username:r.username,dbName:r.dbName,collection:'products',loadedAt:at,connectedAt:at,createdByStudio:true};
 p.events.push({text:`חובר לדאשבורד: משתמש ${r.username}, מסד ${r.dbName}, ${r.products} מוצרים`,at});await persist(p);res.json(r);
})));
app.post('/api/projects/:id/dashboard-sync',route(async(req,res)=>locked(req.params.id,async()=>{
 const p=await store.read(req.params.id),r=await (app.locals.syncProductsToDashboard||syncProductsToDashboard)(p);
 p.events.push({text:`סונכרנו ${r.products} מוצרים למסד ${p.existingClient.dbName}`,at:new Date().toISOString()});await persist(p);res.json(r);
})));
// Production switch for the tenant's module in dashboard-server (read every 15 s there). Operator action only.
// Production switch = the merchant's user document (users.users → semantix), which dashboard-server loads per request.
app.get('/api/projects/:id/production',route(async(req,res)=>{const p=await store.read(req.params.id),slug=p.dashboardExport?.slug||slugOf(p);
 let found=null,error=null,published=null;
 const [control,head]=await Promise.allSettled([(app.locals.readControl||readControl)(p),p.dashboardExport?(app.locals.readPublished||readPublished)(p,slug):null]);
 if(control.status==='fulfilled')found=control.value;else error=control.reason.message;
 published={...(head.status==='fulfilled'?head.value:{error:head.reason.message}),lastAttempt:publishState.get(p.id)||null};
 const code=await (app.locals.codeStatus||codeStatus)(p).catch(()=>null);
 res.json({slug,published,code,user:found?.user||null,users:found?.users||[],consistent:found?.consistent??true,control:found?.control||null,otherModule:!!found?.control?.module&&found.control.module!==slug,error,exported:p.dashboardExport||null,revision:p.revisions.length});}));
app.post('/api/projects/:id/production',route(async(req,res)=>locked(req.params.id,async()=>{const p=await store.read(req.params.id),slug=p.dashboardExport?.slug||slugOf(p);
 if(req.body?.enabled===true&&!p.dashboardExport)throw Error('יש לייצא את המודול לפני הפעלה');
 const {control}=await (app.locals.setControl||setControl)(p,slug,req.body||{},{revision:p.dashboardExport?.revision??null});
 p.events.push({text:`מודול הפרודקשן ${control.enabled?`הופעל (${control.percent}%)`:'כובה'}`,at:control.updatedAt});await persist(p);res.json({slug,control});})));
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
if(import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const host=process.env.HOST||'0.0.0.0';app.listen(port,host,()=>{console.log(`Tenant Studio: http://${host==='0.0.0.0'?'127.0.0.1':host}:${port}`);recoverBuilds().catch(console.error);resumeCrawls().catch(e=>console.error('crawl resume',e.message));});}
