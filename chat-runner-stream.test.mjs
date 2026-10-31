import test from 'node:test';import assert from 'node:assert/strict';
import {configureDashboardStorage} from './core/dashboard/core/db.js';import {configureStudioTransport} from './core/dashboard/agent/studio-client.js';import {studioOperationTransport} from './core/customer-dashboard.mjs';import express from 'express';import {agentRoutes} from './core/dashboard/api/routes/agent.js';import {startAgentRun,subscribeRun} from './core/dashboard/agent/runner.js';
test('runner emits preview before completion, replaces it with checked answer, batches steps and never eagerly queries analytics',async()=>{
 const documents=[],writes=[],events=[];let release,firstText;
 const proceed=new Promise(r=>{release=r;}),visible=new Promise(r=>{firstText=r;});
 const runs={async insertOne(row){documents.push(row);},async updateMany(){},async findOne(){return documents[0];},async updateOne(_q,op){writes.push(op);Object.assign(documents[0],op.$set);},find(filter,options){assert.equal(filter.dbName,'own');assert.deepEqual(options.projection,{request:1,summary:1});return {sort(){return this;},limit(){return this;},async toArray(){return [];}};}};
 const mongo={db(name){return {collection(collection){if(name==='users')return {async findOne(){return {apiKey:'fixture',dbName:'own'};}};if(collection==='agent_runs')return runs;if(collection==='agent_run_locks')return {async findOneAndUpdate(){return {};},async deleteOne(){}};throw Error('Unexpected eager DB read: '+collection);}};}};
 configureDashboardStorage({mongo,redis:null});configureStudioTransport(studioOperationTransport({turn:async(req,res)=>{
  assert.equal(req.body.analytics,undefined);assert.equal(req.body.analyticsDays,7);res.status(200).set({});res.flushHeaders();
  for(const event of [{type:'note',text:'קורא את הבקשה'},{type:'tool',name:'overview'},{type:'tool_done',name:'overview',text:'נקרא קטלוג'},{type:'answer_reset'},{type:'answer_delta',delta:'תשובה בהכנה'}])res.write(JSON.stringify(event)+'\n');
  await proceed;res.end(JSON.stringify({type:'done',engine:'tenant-studio',summary:'תשובה סופית שנבדקה',actions:[],draft:null,modelCalls:1,usage:[],analyticsStatus:'not_requested'})+'\n');
 }}));
 const app=express();await agentRoutes({post(){},get(path,handler){if(!path.endsWith('/stream'))return;app.get(path,async(req,res)=>{req.raw=req;await handler(req,{raw:res,hijack(){}});});}});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 let sub;
 try{const started=await startAgentRun('fixture',{request:'שאלה על הקטלוג',days:7});sub=subscribeRun(started.runId,e=>{events.push(e);if(e.type==='text')firstText();});await visible;
  assert.equal(documents[0].status,'running');assert.equal(documents[0].summary,undefined);assert.equal(subscribeRun(started.runId,()=>{}).provisional,true);
  const response=await fetch(`http://127.0.0.1:${server.address().port}/agent/runs/${started.runId}/stream`,{signal:AbortSignal.timeout(3000)});assert.equal(response.headers.get('content-type'),'text/event-stream; charset=utf-8');const reader=response.body.getReader(),decoder=new TextDecoder();let wire=decoder.decode((await reader.read()).value);assert.match(wire,/תשובה בהכנה/);
  release();await started.done;while(true){const chunk=await reader.read();wire+=decoder.decode(chunk.value,{stream:!chunk.done});if(chunk.done)break;}assert.match(wire,/תשובה סופית שנבדקה/);assert.equal(documents[0].summary,'תשובה סופית שנבדקה');assert.equal(documents[0].reportMissing,false);
  assert.deepEqual(events.find(e=>e.type==='answer'),{type:'answer',text:'תשובה סופית שנבדקה'});assert.equal(events.at(-1).type,'done');assert.equal(writes.filter(x=>x.$push).length,1);
 }finally{release();sub?.unsubscribe();configureDashboardStorage(null);await new Promise(r=>server.close(r));}
});
