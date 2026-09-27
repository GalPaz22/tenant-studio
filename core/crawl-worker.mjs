import {hostname} from 'node:os';
import {randomUUID} from 'node:crypto';
import {seedCrawl,runCrawl,readClickedUrls,readCatalogUrls} from './site-crawler.mjs';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// One worker serves every tenant whose crawl the studio set to "running". It needs no local project files: the
// target (site URL, client database) comes with the job, so the same code runs on a laptop or as a Render worker.
export async function workOnce(store,{owner,projectId=null,seed=seedCrawl,run=runCrawl,log=console.log,shouldExit=()=>false,beat=()=>{},seedOptions={}}={}){
 const job=await store.claim(owner,projectId);if(!job)return false;
 const id=job._id,settings={rateMs:1000,sources:{clicks:true,sitemap:true,catalog:true},...job.settings};
 let state=await store.read(id);
 if(job.reseedRequested||!state.queue.length){
  log(id,'seeding',job.target?.url);
  const project={id,url:job.target.url,existingClient:job.target.dbName?{dbName:job.target.dbName}:null};
  const fresh=await seed(project,{sources:settings.sources,clicks:readClickedUrls,catalogUrls:readCatalogUrls,spec:job.target.spec||null,...seedOptions});
  // Pages already crawled stay; only new pages are queued.
  const crawled=new Set(Object.keys(state.products));fresh.queue=fresh.queue.filter(u=>!crawled.has(u.split('/').pop()));
  state={...state,...fresh,products:state.products,errors:state.errors,startedAt:state.startedAt||fresh.startedAt,next:0};
  await store.save(state,{queue:true});await store.control(id,{reseedRequested:false});
  log(id,'queue',state.queue.length,JSON.stringify(state.sources));
 }
 let stop=false,exitReason=null;
 state.runStartedAt=new Date().toISOString();state.runStartNext=state.next;state.failures=0;delete state.blockedReason;
 const guarded={save:async s=>{await store.save(s);beat();const ctl=await store.renew(id,owner);if(!ctl||ctl.desired!=='running'){stop=true;exitReason='stopped-by-studio';}if(shouldExit()){stop=true;exitReason='worker-exit';}}};
 await run(state,{store:guarded,spec:job.target?.spec||null,rateMs:settings.rateMs,shouldStop:()=>stop||shouldExit(),onProgress:s=>log(id,`${s.next}/${s.queue.length}`,'products',Object.keys(s.products).length,s.status)});
 await store.save(state);
 // A worker shutting down (Render deploy/restart) leaves the job running so the next worker resumes it.
 const finished=['done','blocked'].includes(state.status);
 await store.release(id,owner,{desired:finished?state.status:exitReason==='worker-exit'||shouldExit()?undefined:'stopped'});
 log(id,'released',state.status,exitReason||'');
 return true;
}
export async function workLoop(store,{idleMs=15000,shouldExit=()=>false,log=console.log,...options}={}){
 const owner=`${hostname()}#${randomUUID().slice(0,8)}`;log('crawl worker',owner);
 while(!shouldExit()){
  options.beat?.();let worked=false;try{worked=await workOnce(store,{owner,log,shouldExit,...options});}catch(e){log('worker error',e.message);}
  if(!worked&&!shouldExit())await sleep(idleMs);
 }
 log('crawl worker exit');
}

// A worker that stops making progress (an await that never settles) exits, so a fresh worker takes over the job once
// its lease lapses. Beats come from every loop turn and every checkpoint save (at most ~20 pages apart).
export function watchdog({stallMs=30*60*1000,everyMs=60000,now=Date.now,onStall}={}){
 let last=now();const timer=setInterval(()=>{if(now()-last>stallMs){clearInterval(timer);onStall(Math.round((now()-last)/60000));}},everyMs);timer.unref?.();
 return {beat:()=>{last=now();},stop:()=>clearInterval(timer)};
}

// The studio runs a tenant's crawl itself, right away and alongside other tenants' crawls — no worker to wait for.
// It resumes after a studio restart (see resumeCrawls). A separate worker (Render, STUDIO_CRAWL_WORKER=remote) still
// works: leases keep one runner per tenant.
const inProcess=new Map();
export function runInProcess(store,projectId,{log=console.log,...options}={}){
 if(inProcess.has(projectId))return inProcess.get(projectId);
 const owner=`${hostname()}#studio-${randomUUID().slice(0,8)}`;
 const run=(async()=>{try{await workOnce(store,{owner,projectId,log,...options});}catch(e){log(projectId,'crawl error',e.message);}finally{inProcess.delete(projectId);}})();
 inProcess.set(projectId,run);return run;
}
export const runningInProcess=projectId=>inProcess.has(projectId);
