import {MongoClient} from 'mongodb';
import {readShopperActivity} from './shopper-activity.mjs';
import {userFilter} from './production-control.mjs';
import {pluginHead} from './plugin-workspace.mjs';

// The picture the studio agent starts every turn with, so it reasons about the whole store rather than one query:
// the merchant's production settings (dashboard user), what shoppers did this week, how this studio module is set up
// (pipeline, ranking, functions, versions, baseline, export) and what the operator asked before.
// Live reads (user settings, shopper activity) are kept on the project and refreshed at most every 6 hours.
const REFRESH_MS=6*3600*1000;
// Only these user-document fields are read — never email, API key or platform credentials.
const USER_FIELDS={_id:0,name:1,platform:1,dbName:1,wooSiteUrl:1,active:1,syncMode:1,context:1,concierge:1,semantix:1,'credentials.showOutOfStock':1,'credentials.categories':1,'credentials.softCategories':1,'credentials.colors':1,'taxonomyDiscovery.notes':1};
export async function readDashboardUser(p){
 const uri=process.env.STUDIO_DASHBOARD_MONGODB_URI||process.env.MONGODB_URI;if(!uri)throw Error('חסר חיבור למסד הנתונים');
 const c=new MongoClient(uri,{serverSelectionTimeoutMS:8000});
 try{await c.connect();const docs=await c.db('users').collection('users').find(userFilter(p),{projection:USER_FIELDS}).limit(20).toArray();
  // Several key-holding users can share a store: the one with the store's platform settings describes it best.
  if(!docs.length)return null;const u=docs.find(d=>d.platform)||docs[0],list=v=>Array.isArray(v)?v.filter(x=>typeof x==='string'):[];
  return {name:u.name||null,platform:u.platform||null,dbName:u.dbName,site:u.wooSiteUrl||null,active:u.active!==false,syncMode:u.syncMode||null,
   storeContext:typeof u.context==='string'?u.context.slice(0,600):'',conciergeOn:u.concierge===true,showsOutOfStock:u.credentials?.showOutOfStock===true,
   productionModule:u.semantix&&typeof u.semantix==='object'?{module:u.semantix.module,enabled:u.semantix.enabled===true,percent:u.semantix.percent??100}:null,
   categories:list(u.credentials?.categories).slice(0,20),softCategories:{count:list(u.credentials?.softCategories).length,sample:list(u.credentials?.softCategories).slice(0,20)},
   colors:list(u.credentials?.colors).length,taxonomyNotes:typeof u.taxonomyDiscovery?.notes==='string'?u.taxonomyDiscovery.notes.slice(0,400):''};
 }finally{await c.close();}
}
async function refreshSnapshot(p,services,now){
 const snap=p.contextSnapshot;if(snap&&now-Date.parse(snap.at)<REFRESH_MS)return snap;
 const [user,activity]=await Promise.all([
  (services.dashboardUser||readDashboardUser)(p).catch(e=>({error:e.message})),
  (services.activity||readShopperActivity)(p,{days:7,limit:12}).catch(e=>({error:e.message}))]);
 const brief=a=>a?.error?{error:a.error}:{window:a.window,totals:a.totals,loggingGap:a.loggingGap?{days:a.loggingGap.searchesNotLoggedOn.length}:null,
  top:a.top.slice(0,12).map(t=>`${t.query} (${t.searches} חיפושים, ${t.clickSessions} הקליקו, ${t.cartSessions} לסל)`),zeroResults:a.zeroResults.slice(0,8).map(z=>`${z.query} ×${z.hits}`)};
 p.contextSnapshot={at:new Date(now).toISOString(),user,activity:brief(activity)};return p.contextSnapshot;
}
export async function workspaceContext(ctx,{now=Date.now()}={}){
 const p=ctx.p,pr=ctx.profile,live=p.existingClient?await refreshSnapshot(p,ctx.services||{},now):null;
 const revisions=p.revisions.slice(-5).reverse().map(r=>({version:r.number,at:r.createdAt?.slice(0,10),note:String(r.note||'').slice(0,80),changes:(r.changes||[]).slice(0,3).map(c=>String(c).slice(0,80))}));
 const b=p.baselineEval?.summary;
 return {
  store:{name:p.name,url:p.url,platform:p.platform,database:p.existingClient?.dbName||null,products:p.productCards?.length||0,visibleProducts:(p.productCards||[]).filter(c=>!c.hidden&&c.stockStatus==='instock').length},
  dashboardUser:live?.user||null,
  clientProfile:p.clientProfile||null,
  connectedPlugin:pluginHead(p)?{name:p.pluginWorkspace.name,platform:p.pluginWorkspace.platform,revision:pluginHead(p).number,files:pluginHead(p).files.length,status:'draft-not-deployed'}:null,
  searchPerformance:p.performanceReport?{at:p.performanceReport.at,revision:p.performanceReport.revision,summary:p.performanceReport.summary,proposals:p.performanceReport.proposals,limitations:p.performanceReport.limitations}:null,
  shoppersThisWeek:live?.activity||null,
  liveDataAt:live?.at||null,
  searchSetup:{pipeline:pr.pipeline||{},rankingRules:(pr.rankingRules||[]).map(r=>`${r.name}: ${r.action} ${r.field}=${r.values.slice(0,4).join('/')}${r.terms?.length?' ל־'+r.terms.slice(0,3).join('/'):''}`).slice(0,15),
   functions:Object.entries(pr.hooks||{}).map(([k,v])=>`${k}: ${String(v.note||'').slice(0,100)}`),linkedTerms:(pr.scopedAliases||[]).map(r=>`${r.term}(${r.mode||'add'})`).slice(0,25),
   spelling:Object.keys(pr.queryAliases||{}).length,synonyms:Object.keys(pr.semanticAliases||{}).length,tags:Object.keys(pr.tagDefinitions||{}).length},
  recentVersions:revisions,
  productionComparison:b?{kept:b.kept,partial:b.partial,lost:b.lost,gaps:b.gap,keptShare:b.keptShare}:null,
  exportedModule:p.dashboardExport?{slug:p.dashboardExport.slug,revision:p.dashboardExport.revision,at:p.dashboardExport.at?.slice(0,10),behind:p.revisions.length-(p.dashboardExport.revision||0)}:null,
  // The current request is not in the history yet, so every stored user message is an earlier one.
  earlierRequests:p.messages.filter(m=>m.role==='user').slice(-14).map(m=>String(m.text||'').replace(/\s+/g,' ').slice(0,90)),
 };
}
