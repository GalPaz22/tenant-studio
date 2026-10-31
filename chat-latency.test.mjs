import test from 'node:test';import assert from 'node:assert/strict';
import {messagePrefix} from './core/json-message-stream.mjs';import {createReportCache} from './core/dashboard/analytics/report-cache.js';
import {customerTools} from './core/customer-chat.mjs';
import {studioAgent} from './core/studio-agent.mjs';import {existingProject} from './existing-client.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('partial JSON streams Hebrew message text and buffers split escapes, emoji and tool payloads',()=>{
 const text='תשובה "בעברית"\nעם אימוג׳י 🎉';const encoded=JSON.stringify({message:text});let last='';
 for(let n=0;n<=encoded.length;n++){const prefix=messagePrefix(encoded.slice(0,n));assert.ok(text.startsWith(prefix));assert.ok(prefix.startsWith(last));last=prefix;}assert.equal(last,text);
 assert.equal(messagePrefix('{"message":"a\\u05d'), 'a');assert.equal(messagePrefix('{"message":"a\\u05d0'), 'aא');
 assert.equal(messagePrefix('{"message":"\\ud83d'), '');assert.equal(messagePrefix('{"message":"\\ud83d\\ude00'), '😀');
 for(const raw of ['{"tools":[{"name":"db_search","message":"secret"}]}','{"note":"private","message":"hidden"}','{"reasoning":"private"}','not json'])assert.equal(messagePrefix(raw),'');
});
test('report cache shares simultaneous dashboard/chat work, separates tenants and windows, expires after completion',async()=>{
 let clock=0,count=0;const cache=createReportCache({now:()=>clock,ttlMs:60,build:async(tenant,opts)=>{count++;await sleep(5);return {dbName:tenant.dbName,days:opts.days,sequence:count};}});
 const a=cache.get({dbName:'own'},{days:30}),b=cache.get({dbName:'own'},{days:30});assert.equal(a,b);clock=100;await a;
 assert.equal(await cache.get({dbName:'own'},{days:30}),await a);assert.equal(count,1);
 await cache.get({dbName:'foreign'},{days:30});await cache.get({dbName:'own'},{days:7});assert.equal(count,3);
 clock=161;await cache.get({dbName:'own'},{days:30});assert.equal(count,4);
 cache.invalidate('own');await cache.get({dbName:'own'},{days:30});assert.equal(count,5);
});
test('failed reports are never cached as empty or stale success; invalidation cannot resurrect a late result',async()=>{
 let count=0;const cache=createReportCache({build:async()=>{if(++count===1)throw Error('offline');return {count};}});
 await assert.rejects(()=>cache.get({dbName:'own'}),/offline/);assert.deepEqual(await cache.get({dbName:'own'}),{count:2});
 let release;const slow=createReportCache({build:()=>new Promise(r=>{release=r;})});const first=slow.get({dbName:'own'});await sleep(0);slow.invalidate('own');release({old:true});await first;assert.notEqual(slow.get({dbName:'own'}),first);
});
test('read-only Studio answer streams before completion while changes and forced verification never preview',async()=>{
 const p=existingProject('test',{dbName:'own'},[{id:1,name:'סרום',stockStatus:'instock'}]);delete p.existingClient;
 let streamed=false;const events=[];
 const model=async(_prompt,options)=>{if(options?.onText){await options.onText(null);await options.onText('תשובה');streamed=true;}return {message:'תשובה'};};
 const next=await studioAgent(p,'שלום',{model,streamAnswers:true,onEvent:async e=>{events.push(e);if(e.type==='answer_delta')assert.equal(streamed,false);}});
 assert.equal(next.messages.at(-1).text,'תשובה');assert.ok(events.some(e=>e.type==='answer_delta'));
 streamed=false;await studioAgent(p,'בדוק את ״סרום״',{model,judge:async()=>({queries:[],summary:''}),streamAnswers:true});assert.equal(streamed,false);
 let round=0;const changed=async(_prompt,options)=>{if(round++===0)return {tools:[{name:'add_spelling',from:'סרמ',to:'סרום'}]};assert.equal(options?.onText,null);return {message:'הוכנה הצעה'};};
 await studioAgent(p,'הוסף תיקון כתיב',{model:changed,streamAnswers:true});
});

test('customer analytics uses one measurement source and preserves explicit week/month windows',async()=>{
 const calls=[],p=existingProject('test',{dbName:'own'},[{id:1,name:'סרום'}]);
 const tools=customerTools(p,[],async days=>{calls.push(days);return {days:days??30};});
 assert.equal(tools.customer_analytics,undefined);assert.equal(tools.shopper_activity,undefined);assert.equal(tools.search_analytics,undefined);
 assert.deepEqual(await tools.dashboard_analytics.run(null,{days:7}),{days:7});assert.deepEqual(await tools.dashboard_analytics.run(null,{}),{days:30});assert.deepEqual(calls,[7,undefined]);
});
