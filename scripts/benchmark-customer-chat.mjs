// Read-only benchmark of real Studio operations and real tenant data. It keeps
// projects/drafts in a temporary folder; no dashboard history or live rules change.
// node --env-file=.env scripts/benchmark-customer-chat.mjs --db=<store> --data-dir=<studio-data> [--legacy] [--output=/tmp/result.json]
import {createStore} from '../store.mjs';
import {getMongo} from '../core/dashboard/core/db.js';
import {buildConversionReport,reportDigest} from '../core/dashboard/analytics/report.js';
import {getDashboardReport} from '../core/dashboard/analytics/report-cache.js';
import {installCustomerChat} from '../core/customer-chat.mjs';
import {studioOperationTransport} from '../core/customer-dashboard.mjs';
import {askStudioAgent,askJudgeAgent} from '../model.mjs';
import {workspaceContext} from '../core/workspace-context.mjs';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import express from 'express';
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const [key,...value]=a.replace(/^--/,'').split('=');return [key,value.join('=')||true];}));
if(typeof args.db!=='string')throw Error('--db=<store database> is required');
const dbName=args.db,source=createStore(resolve(args['data-dir']||process.env.STUDIO_DATA_DIR||'data'));
const candidates=(await source.metas()).filter(p=>p.dbName===dbName);
if(candidates.length!==1)throw Error('Select a Studio data folder with exactly one project for this store');
const project=await source.read(candidates[0].id);delete project.contextSnapshot;project.messages=[];
const root=await mkdtemp(join(tmpdir(),'studio-chat-benchmark-')),store=createStore(root),mongo=await getMongo(),rows=[];
await store.save(project);
const messages=['כמה מוצרים יש בקטלוג? ענה במשפט אחד מתוך הנתונים בלבד.','מה היו שלושת החיפושים הנפוצים בחנות ב־30 הימים האחרונים? אל תשנה דבר.'];
try{
 for(const [index,message] of [...messages,messages[1]].entries()){
  const start=performance.now();let firstModel=null,firstText=null,modelMs=0,modelCalls=0,analyticsMs=0,analytics=null;
  if(args.legacy){const at=performance.now();analytics=reportDigest(await buildConversionReport({dbName},{days:30,persist:false}));analyticsMs+=performance.now()-at;}
  const wrap=fn=>async(prompt,options)=>{firstModel??=performance.now()-start;const at=performance.now();modelCalls++;try{return await fn(prompt,options);}finally{modelMs+=performance.now()-at;}};
  const stop=()=>{throw Error('Benchmark must not persist or publish');};
  const operations=installCustomerChat(express(),{store,drafts:createStore(join(root,'drafts')),persist:stop,publish:stop,locked:async(_id,fn)=>fn(),resolveTenant:async()=>({dbName}),model:()=>wrap(askStudioAgent),judge:()=>wrap(askJudgeAgent),loadAnalytics:async(tenant,options)=>{const at=performance.now();try{return await getDashboardReport(tenant,options);}finally{analyticsMs+=performance.now()-at;}},...(args.legacy?{services:()=>({workspaceContext})}:{})});
  const response=await studioOperationTransport(operations)('turn',{apiKey:'read-only-benchmark',message,history:[],analytics,analyticsDays:30},AbortSignal.timeout(180000));
  if(!response.ok)throw Error('Studio returned '+response.status);
  const reader=response.body.getReader(),decoder=new TextDecoder();let pending='',result;
  while(true){const chunk=await reader.read();pending+=decoder.decode(chunk.value,{stream:!chunk.done});const lines=pending.split('\n');pending=lines.pop()||'';if(chunk.done&&pending.trim())lines.push(pending);
   for(const line of lines){if(!line.trim())continue;const event=JSON.parse(line);if(event.type==='answer_delta'&&event.delta)firstText??=performance.now()-start;if(event.type==='error')throw Error(event.message);if(event.type==='done'){result=event;firstText??=performance.now()-start;}}
   if(chunk.done)break;
  }
  if(!result||result.actions.length||result.draft)throw Error('Benchmark did not return a read-only answer');
  const row={case:index===0?'catalog':index===1?'analytics-cold':'analytics-repeat',firstModelMs:Math.round(firstModel),firstTextMs:Math.round(firstText),elapsedMs:Math.round(performance.now()-start),modelMs:Math.round(modelMs),modelCalls,analyticsMs:Math.round(analyticsMs),summary:result.summary};rows.push(row);console.log(JSON.stringify(row));
 }
 if(typeof args.output==='string')await writeFile(args.output,JSON.stringify(rows,null,2));
}finally{await rm(root,{recursive:true,force:true});await mongo.close();}
