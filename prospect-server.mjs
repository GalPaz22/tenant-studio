import 'dotenv/config';
import express from 'express';
import {mkdir,readFile,writeFile,readdir,rename} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {auditStore,pageFetcher,isShop,platformHint} from './core/prospect.mjs';
import {askProcessing} from './model.mjs';

// Local workspace for prospecting: the found stores, their search audits, and where each lead stands.
//   node prospect-server.mjs [--port 4180]   → http://127.0.0.1:4180
// Listens on 127.0.0.1 only (the data holds business contact details). Audits run here, a few at a time,
// and keep the Mac from idle-sleeping while they run.

const HERE=dirname(fileURLToPath(import.meta.url));
const DIR=resolve(process.env.PROSPECT_DIR||'data/prospects'),AUDITS=DIR+'/audits',STORES=DIR+'/stores.json',RANKED=DIR+'/ranked.json',PIPELINE=DIR+'/pipeline.json';
const PORT=Number(process.argv[process.argv.indexOf('--port')+1])||4180,PARALLEL=3,THRESHOLD=70;
const NOT_SHOP=/\.(ac|gov|muni|idf|k12|net)\.il$/i,HOST=/^[a-z0-9][a-z0-9.-]{1,120}$/;
const readJson=async(f,d)=>{try{return JSON.parse(await readFile(f,'utf8'));}catch{return d;}};
const saveJson=async(f,v)=>{const t=f+'.tmp';await writeFile(t,JSON.stringify(v,null,1),{mode:0o600});await rename(t,f);};
const safeName=h=>h.replace(/[^a-z0-9.-]/gi,'_');
const STAGES=['new','todo','contacted','replied','demo','won','lost'];

async function audits(){
 await mkdir(AUDITS,{recursive:true});const out=new Map();
 for(const f of await readdir(AUDITS)){if(!f.endsWith('.json'))continue;const a=await readJson(`${AUDITS}/${f}`,null);if(a){out.set(a.host,a);if(a.movedFrom)out.set(a.movedFrom,a);}}
 return out;
}
async function listStores(){
 const [ranked,crawl,pipeline,done]=await Promise.all([readJson(RANKED,{sites:{}}),readJson(STORES,{stores:{}}),readJson(PIPELINE,{}),audits()]);
 const rows=new Map();
 for(const s of Object.values(ranked.sites)){if(!s.store||!isShop(s)||NOT_SHOP.test(s.host))continue;const host=s.movedTo||s.host;rows.set(host,{host,rank:s.rank,platform:s.platform,source:'traffic'});}
 for(const s of Object.values(crawl.stores)){if(s.productUrls<20)continue;const r=rows.get(s.host)||{host:s.host,platform:platformHint(s),source:'crawl'};r.productUrls=s.productUrls;rows.set(s.host,r);}
 for(const host of Object.keys(pipeline))if(!rows.has(host))rows.set(host,{host,source:'manual'});
 return [...rows.values()].map(r=>{
  const a=done.get(r.host),p=pipeline[r.host]||{};
  return {...r,title:a?.title||null,platform:a?.platform||r.platform||null,providers:a?.providers||[],
   audit:a?{status:a.status,score:a.score??null,grade:a.grade||null,confidence:a.confidence||null,lead:!!a.lead,zeroRate:a.zeroRate??null,note:a.note||null,auditedAt:a.auditedAt,contacts:!!(a.contacts&&(a.contacts.emails?.length||a.contacts.phones?.length))}:null,
   stage:p.stage||'new',notes:p.notes||'',excluded:!!p.excluded,updatedAt:p.updatedAt||null,
   state:queue.includes(r.host)?'queued':running.has(r.host)?'running':null};
 });
}

// ---------- audit queue ----------
const queue=[],running=new Map(),get=pageFetcher();let caffeinate=null,finished=0;
const ask=(process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY)?askProcessing:null;
function keepAwake(on){
 if(process.platform!=='darwin')return;
 if(on&&!caffeinate){caffeinate=spawn('caffeinate',['-i','-w',String(process.pid)],{stdio:'ignore'});caffeinate.on('exit',()=>{caffeinate=null;});}
 if(!on&&caffeinate){caffeinate.kill();caffeinate=null;}
}
async function runOne(host){
 running.set(host,Date.now());let a,timer;
 try{a=await Promise.race([auditStore(host,{get,ask,threshold:THRESHOLD}),new Promise((_,fail)=>{timer=setTimeout(()=>fail(Error('הבדיקה חרגה מ־6 דקות')),6*60000);})]);}
 catch(e){a={host,status:'error',note:e.message,auditedAt:new Date().toISOString()};}
 finally{clearTimeout(timer);}
 const ranked=await readJson(RANKED,{sites:{}}),r=Object.values(ranked.sites).find(s=>s.host===host||s.movedTo===host||s.host===a.host);if(r)a.rank=r.rank;
 await saveJson(`${AUDITS}/${safeName(a.host||host)}.json`,a);
 console.log(`${host}: ${a.status==='audited'?'ציון '+a.score:a.status+' '+(a.note||'')}`);
 running.delete(host);finished++;pump();
}
function pump(){
 while(running.size<PARALLEL&&queue.length)runOne(queue.shift());
 keepAwake(running.size>0);
}

// ---------- http ----------
const app=express();app.use(express.json({limit:'1mb'}));
const route=fn=>async(req,res)=>{try{res.json(await fn(req,res));}catch(e){res.status(400).json({error:e.message});}};
const hostParam=h=>{h=String(h||'').toLowerCase().replace(/^www\./,'');if(!HOST.test(h))throw Error('כתובת לא תקינה');return h;};
app.get('/',(_,res)=>res.sendFile(HERE+'/public/prospects.html'));
app.get('/prospects.js',(_,res)=>res.sendFile(HERE+'/public/prospects.js'));
app.get('/api/stores',route(async()=>({stores:await listStores(),ai:!!ask,threshold:THRESHOLD})));
app.get('/api/audit/:host',route(async req=>{const h=hostParam(req.params.host),a=(await audits()).get(h);if(!a)throw Error('אין בדיקה לאתר הזה');return a;}));
app.get('/api/queue',route(async()=>({running:[...running.keys()],queued:queue,finished})));
app.post('/api/queue',route(async req=>{
 const hosts=(req.body.hosts||[]).slice(0,500).map(hostParam);
 for(const h of hosts)if(!queue.includes(h)&&!running.has(h))queue.push(h);
 pump();return {queued:queue.length,running:running.size};
}));
app.delete('/api/queue',route(async()=>{queue.length=0;return {queued:0,running:running.size};}));
app.patch('/api/pipeline/:host',route(async req=>{
 const h=hostParam(req.params.host),all=await readJson(PIPELINE,{}),p={...all[h]};
 if(req.body.stage!==undefined){if(!STAGES.includes(req.body.stage))throw Error('שלב לא מוכר');p.stage=req.body.stage;}
 if(req.body.notes!==undefined)p.notes=String(req.body.notes).slice(0,5000);
 if(req.body.excluded!==undefined)p.excluded=!!req.body.excluded;
 p.updatedAt=new Date().toISOString();all[h]=p;await mkdir(DIR,{recursive:true});await saveJson(PIPELINE,all);return p;
}));

app.listen(PORT,'127.0.0.1',()=>console.log(`ממשק הלידים: http://127.0.0.1:${PORT}${ask?'':'  (בלי מפתח Gemini: שאילתות ושיפוט פשוטים יותר)'}`));
