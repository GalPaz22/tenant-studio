import {spawn} from 'node:child_process';
import {open,readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

// The studio controls a tenant's crawl through the shared store: it sets what should happen (desired, settings,
// target) and reads progress. A crawl worker — on Render, or on this computer with STUDIO_CRAWL_WORKER=local — does the work.
export const DEFAULT_SETTINGS={rateMs:1000,autoMerge:false,sources:{clicks:true,sitemap:true,catalog:true}};
export const crawlSettings=p=>({...DEFAULT_SETTINGS,...p.crawler,sources:{...DEFAULT_SETTINGS.sources,...p.crawler?.sources}});
export function validateSettings(input){
 const s={...input};
 if(s.rateMs!==undefined&&(!Number.isInteger(s.rateMs)||s.rateMs<500||s.rateMs>60000))throw Error('קצב הסריקה חייב להיות בין 0.5 ל־60 שניות לדף');
 if(s.autoMerge!==undefined&&typeof s.autoMerge!=='boolean')throw Error('מיזוג אוטומטי לא תקין');
 if(s.sources!==undefined&&(typeof s.sources!=='object'||Object.entries(s.sources).some(([k,v])=>!['clicks','sitemap','catalog'].includes(k)||typeof v!=='boolean')))throw Error('מקורות לא תקינים');
 return Object.fromEntries(Object.entries(s).filter(([k])=>['rateMs','autoMerge','sources'].includes(k)));
}
export const alive=pid=>{if(!Number.isInteger(pid)||pid<=0)return false;try{process.kill(pid,0);return true;}catch(e){return e.code==='EPERM';}};

export function crawlStatus(meta,settings,merged=null,{now=Date.now()}={}){
 if(!meta||meta.status==='none'&&!meta.desired)return {status:'none',running:false,settings};
 const running=!!meta.lease&&Date.parse(meta.lease.until)>now,done=meta.next||0,total=meta.total||0,products=meta.productCount||0;
 const elapsed=meta.runStartedAt&&meta.updatedAt?(Date.parse(meta.updatedAt)-Date.parse(meta.runStartedAt))/1000:0,pace=elapsed>0?(done-(meta.runStartNext||0))/elapsed:0;
 const status=running?'running':meta.desired==='running'?'waiting':meta.status==='running'?'interrupted':meta.status;
 return {status,running,worker:running?meta.lease.host:null,desired:meta.desired||null,done,total,products,
  errors:(meta.errors||[]).length,recentErrors:(meta.errors||[]).slice(-5),sources:meta.sources||null,startedAt:meta.startedAt||null,updatedAt:meta.updatedAt||null,
  pagesPerMinute:running?Math.round(pace*60):0,etaMinutes:running&&pace>0?Math.round((total-done)/pace/60):null,
  blockedReason:meta.blockedReason||null,lastMerge:merged,unmerged:Math.max(0,products-(merged?.pages||0)),settings};
}
export const crawlTarget=p=>{if(!p.url||!/^https:/.test(p.url))throw Error('ללקוח אין כתובת אתר HTTPS לסריקה');return {url:p.url,dbName:p.existingClient?.dbName||null};};
export async function startCrawl(p,store,{reseed=false}={}){
 const meta=await store.meta(p.id);
 await store.control(p.id,{desired:'running',settings:crawlSettings(p),target:crawlTarget(p),reseedRequested:reseed||!meta?.total});
}
export async function stopCrawl(p,store){const meta=await store.meta(p.id);if(meta?.desired!=='running')throw Error('הסורק לא רץ');await store.control(p.id,{desired:'stopped'});}

// Local mode only: keep one crawl worker process alive on this computer (it survives studio restarts).
const root=fileURLToPath(new URL('..',import.meta.url));
export async function ensureLocalWorker(dataDir){
 const pidFile=`${dataDir}/crawls/worker.pid`;await mkdir(`${dataDir}/crawls`,{recursive:true});
 const pid=Number(await readFile(pidFile,'utf8').catch(()=>''));if(alive(pid))return {pid,started:false};
 const log=await open(`${dataDir}/crawls/worker.log`,'a');
 const child=spawn(process.execPath,[root+'crawl-worker.mjs'],{cwd:root,detached:true,stdio:['ignore',log.fd,log.fd],env:{...process.env,STUDIO_DATA_DIR:dataDir}});
 child.unref();await log.close();await writeFile(pidFile,String(child.pid));return {pid:child.pid,started:true};
}
