import {hostname} from 'node:os';
import {randomUUID} from 'node:crypto';
import {seedCrawl,runCrawl,readClickedUrls,readCatalogUrls} from './site-crawler.mjs';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// One worker serves every tenant whose crawl the studio set to "running". It needs no local project files: the
// target (site URL, client database) comes with the job, so the same code runs on a laptop or as a Render worker.
export async function workOnce(store,{owner,seed=seedCrawl,run=runCrawl,log=console.log,shouldExit=()=>false,seedOptions={}}={}){
 const job=await store.claim(owner);if(!job)return false;
 const id=job._id,settings={rateMs:1000,sources:{clicks:true,sitemap:true,catalog:true},...job.settings};
 let state=await store.read(id);
 if(job.reseedRequested||!state.queue.length){
  log(id,'seeding',job.target?.url);
  const project={id,url:job.target.url,existingClient:job.target.dbName?{dbName:job.target.dbName}:null};
  const fresh=await seed(project,{sources:settings.sources,clicks:readClickedUrls,catalogUrls:readCatalogUrls,...seedOptions});
  // Pages already crawled stay; only new pages are queued.
  const crawled=new Set(Object.keys(state.products));fresh.queue=fresh.queue.filter(u=>!crawled.has(u.split('/').pop()));
  state={...state,...fresh,products:state.products,errors:state.errors,startedAt:state.startedAt||fresh.startedAt,next:0};
  await store.save(state,{queue:true});await store.control(id,{reseedRequested:false});
  log(id,'queue',state.queue.length,JSON.stringify(state.sources));
 }
 let stop=false,exitReason=null;
 state.runStartedAt=new Date().toISOString();state.runStartNext=state.next;state.failures=0;delete state.blockedReason;
 const guarded={save:async s=>{await store.save(s);const ctl=await store.renew(id,owner);if(!ctl||ctl.desired!=='running'){stop=true;exitReason='stopped-by-studio';}if(shouldExit()){stop=true;exitReason='worker-exit';}}};
 await run(state,{store:guarded,rateMs:settings.rateMs,shouldStop:()=>stop||shouldExit(),onProgress:s=>log(id,`${s.next}/${s.queue.length}`,'products',Object.keys(s.products).length,s.status)});
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
  let worked=false;try{worked=await workOnce(store,{owner,log,shouldExit,...options});}catch(e){log('worker error',e.message);}
  if(!worked&&!shouldExit())await sleep(idleMs);
 }
 log('crawl worker exit');
}
