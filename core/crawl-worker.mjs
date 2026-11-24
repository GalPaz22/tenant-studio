import {hostname} from 'node:os';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {openSync,closeSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {seedCrawl,runCrawl,sweepStoreApi,pagesToRead,readClickedUrls,readCatalogUrls} from './site-crawler.mjs';
import {productKey,DEFAULT_SPEC} from './scraper-builder.mjs';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// One worker serves every tenant whose crawl the studio set to "running". It needs no local project files: the
// target (site URL, client database) comes with the job, so the same code runs on a laptop or as a Render worker.
export async function workOnce(store,{owner,projectId=null,seed=seedCrawl,run=runCrawl,sweep=sweepStoreApi,afterScan=async()=>{},log=console.log,shouldExit=()=>false,beat=()=>{},seedOptions={}}={}){
 const job=await store.claim(owner,projectId);if(!job)return false;
 const id=job._id,settings={rateMs:1000,concurrency:3,sources:{clicks:true,sitemap:true,catalog:true},...job.settings},spec=job.target?.spec||null;
 let stop=false,exitReason=null;
 const halted=ctl=>{if(!ctl||ctl.desired!=='running'){stop=true;exitReason='stopped-by-studio';}if(shouldExit()){stop=true;exitReason='worker-exit';}};
 // Seeding, a store listing and a long backoff write no checkpoints: the lease and a stop from the studio do not wait for one.
 const keep=setInterval(()=>store.renew(id,owner).then(halted).catch(()=>{}),60000);keep.unref?.();
 try{
 let state=await store.read(id);
 if(job.rescanRequested||job.reseedRequested||!state.queue.length){
  log(id,'seeding',job.target?.url);
  const project={id,url:job.target.url,existingClient:job.target.dbName?{dbName:job.target.dbName}:null};
  const fresh=await seed(project,{sources:settings.sources,clicks:readClickedUrls,catalogUrls:readCatalogUrls,spec:job.target.spec||null,...seedOptions});
  const keyOf=u=>productKey(u,spec||DEFAULT_SPEC),found=fresh.queue.length;
  // A WooCommerce store answers most of the catalog from one listing; only what it does not cover needs a page read.
  const listing=job.target?.platform==='woocommerce'&&spec&&!job.fullRescanRequested?await sweep({...fresh,products:state.products},{spec,rateMs:settings.rateMs,shouldStop:()=>stop||shouldExit(),log:(...parts)=>{beat();log(id,...parts);}}):null;
  // Keep collected data available for merging. A rescan rereads what may have changed (all pages when asked for a full one,
  // or when the sitemap has no dates); discovery only skips known product keys, including URLs with a trailing slash.
  if(!job.rescanRequested){const crawled=new Set(Object.keys(state.products));fresh.queue=fresh.queue.filter(u=>!crawled.has(keyOf(u)));}
  else if(!job.fullRescanRequested)fresh.queue=pagesToRead(fresh.queue,{products:state.products,lastmod:fresh.lastmod,swept:listing?.swept,sweepComplete:listing?.complete,keyOf});
  delete fresh.lastmod;
  state={...state,...fresh,products:state.products,errors:job.rescanRequested?{}:state.errors,startedAt:job.rescanRequested?fresh.startedAt:state.startedAt||fresh.startedAt,next:0};
  await store.save(state,{queue:true});await store.control(id,{reseedRequested:false,rescanRequested:false,fullRescanRequested:false});
  log(id,'queue',state.queue.length,'of',found,JSON.stringify(state.sources),listing?`listing ${listing.swept.size} products, ${listing.changed} changed`:'');
 }
 state.runStartedAt=new Date().toISOString();state.runStartNext=state.next;state.failures=0;delete state.blockedReason;
 const guarded={save:async(s,options)=>{await store.save(s,options);beat();halted(await store.renew(id,owner));}};
 await run(state,{store:guarded,spec,rateMs:settings.rateMs,concurrency:settings.concurrency,shouldStop:()=>stop||shouldExit(),onProgress:s=>log(id,`${s.next}/${s.queue.length}`,'products',Object.keys(s.products).length,s.status)});
 await store.save(state);
 // A worker shutting down (Render deploy/restart) leaves the job running so the next worker resumes it.
 const finished=['done','blocked'].includes(state.status);
 // A finished scan reaches the store's live rows before the job is released; a failure here is logged, not a failed scan.
 if(state.status==='done')try{log(id,'store rows',JSON.stringify(await afterScan(state,job)));}catch(e){log(id,'store rows failed',e.message);}
 await store.release(id,owner,{desired:finished?state.status:exitReason==='worker-exit'||shouldExit()?undefined:'stopped'});
 log(id,'released',state.status,exitReason||'');
 }finally{clearInterval(keep);}
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
// The studio's default: the same job in a process of its own, which keeps running through a studio restart.
const spawned=new Map(),root=fileURLToPath(new URL('..',import.meta.url));
export function spawnCrawl(projectId,dataDir,{log=console.log,launch=spawn}={}){
 if(spawned.has(projectId))return spawned.get(projectId);
 mkdirSync(`${dataDir}/crawls`,{recursive:true});const out=openSync(`${dataDir}/crawls/${projectId}.log`,'a');
 const child=launch(process.execPath,[root+'crawl-worker.mjs','--project',projectId],{cwd:root,detached:true,stdio:['ignore',out,out],env:{...process.env,STUDIO_DATA_DIR:dataDir}});
 closeSync(out);child.unref();spawned.set(projectId,child);
 const done=result=>{if(spawned.get(projectId)===child)spawned.delete(projectId);log(projectId,'crawl process ended',result);};
 child.once('exit',done);child.once('error',e=>done(e.message));return child;
}
export const runningInProcess=projectId=>inProcess.has(projectId)||spawned.has(projectId);
