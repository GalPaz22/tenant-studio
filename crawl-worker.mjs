// Crawl worker: serves every tenant whose site crawl the studio set to "running" (state in MongoDB, STUDIO_CRAWL_DB).
// Run locally with `node crawl-worker.mjs`, or as a Render Background Worker (see render.yaml).
// `node crawl-worker.mjs --import-local <projectId>` moves a crawl checkpoint from data/crawls/ into MongoDB once.
import 'dotenv/config';
import {readFile} from 'node:fs/promises';
import {createCrawlDb} from './core/crawl-store.mjs';
import {workLoop,watchdog} from './core/crawl-worker.mjs';
const {store,close}=createCrawlDb();
const i=process.argv.indexOf('--import-local');
if(i>=0){
 const id=process.argv[i+1],dir=process.env.STUDIO_DATA_DIR||new URL('./data',import.meta.url).pathname;
 const local=JSON.parse(await readFile(`${dir}/crawls/${id}.json`,'utf8')),project=JSON.parse(await readFile(`${dir}/${id}.json`,'utf8'));
 delete local.pid;await store.save({...local,projectId:id,status:local.status==='running'?'stopped':local.status},{queue:true});
 await store.control(id,{target:{url:project.url,dbName:project.existingClient?.dbName||null},settings:{rateMs:1000,sources:{clicks:true,sitemap:true,catalog:true},...project.crawler},desired:local.status==='done'?'done':'stopped'});
 console.log('imported',id,Object.keys(local.products).length,'pages,',local.next,'/',local.queue.length);await close();process.exit(0);
}
let exit=false;for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{exit=true;console.log('shutting down after current page…');});
const dog=watchdog({onStall:minutes=>{console.log(new Date().toISOString(),`no progress for ${minutes} minutes — exiting so a fresh worker resumes the crawl`);process.exit(1);}});
await workLoop(store,{shouldExit:()=>exit,beat:dog.beat});dog.stop();
await close();
