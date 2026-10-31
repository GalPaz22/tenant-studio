import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStore} from './store.mjs';
import {existingProject} from './existing-client.mjs';

test('concierge settings require a session, persist per project, and selected model reaches chat and search policy',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'concierge-api-'));process.env.STUDIO_DATA_DIR=dir;
 const server=createServer().listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 process.env.PORT=process.env.STUDIO_PORT=String(server.address().port);
 const {app,shellFor}=await import('./server.mjs');server.on('request',app);
 const store=createStore(dir),p=existingProject('books',{dbName:'books'},[{id:'1',name:'ספר מומלץ',stockStatus:'instock',price:80}]);await store.save(p);
 const base='http://127.0.0.1:'+server.address().port,headers={'Content-Type':'application/json'},path=base+'/api/projects/'+p.id;
 const post=(suffix,body)=>fetch(path+suffix,{method:'POST',headers,body:JSON.stringify(body)});
 try{
  assert.equal((await post('/concierge/settings',{enabled:true})).status,403);
  headers['X-Studio-Token']=(await (await fetch(base+'/api/session')).json()).token;
  // Autocomplete demo endpoint: rule-driven suggestions, an unfinished last word included, no model involved.
  const typed=await (await post('/suggest',{query:'ספר מו'})).json();assert.deepEqual(typed.matches.map(x=>x.title),['ספר מומלץ']);assert.deepEqual(typed.completed,['מומלץ']);assert.equal(typeof typed.elapsedMs,'number');
  assert.deepEqual((await (await post('/suggest',{query:'x'})).json()).matches,[]);
  const settings={enabled:true,autoOpen:false,triggerPrompt:'פתח רק לבקשת המלצה',model:'gemini-3.8-flash'};
  const saved=await post('/concierge/settings',settings);assert.equal(saved.status,200,await saved.clone().text());
  const summary=await saved.json();assert.equal(summary.concierge.model,settings.model);assert.ok(summary.conciergeModels.includes(settings.model));
  assert.equal((await store.read(p.id)).concierge.triggerPrompt,settings.triggerPrompt);
  const snapshot=await readFile(join(dir,p.id+'.json'),'utf8');assert.equal((await post('/concierge/settings',{model:'unsupported'})).status,400);assert.equal(await readFile(join(dir,p.id+'.json'),'utf8'),snapshot);
  const calls=[];app.locals.conciergeAgent=async(_prompt,options)=>{calls.push(options);return options.purpose==='trigger'?{should_open:false,explanation:'אין בקשת המלצה'}:{message:'מה תרצה לקרוא?',present:[]};};
  const search=await post('/search',{query:'ספר',limit:8});assert.equal(search.status,200,await search.clone().text());const result=await search.json();assert.equal(result.concierge,null);assert.equal(result.conciergeDecision.explanation,'אין בקשת המלצה');
  const chat=await post('/concierge',{message:'שלום'});assert.equal(chat.status,200,await chat.clone().text());assert.equal((await chat.json()).reply,'מה תרצה לקרוא?');
  assert.deepEqual(calls,[{model:settings.model,purpose:'trigger'},{model:settings.model,purpose:'chat'}]);
  // Pre-search path: classify first, the search then spends no model call, and the turn arrives as events.
  calls.length=0;app.locals.conciergeAgent=async(_prompt,options)=>{calls.push(options.purpose);return options.purpose==='classify'?{open:true,explanation:'בקשת המלצה'}:calls.filter(x=>x==='chat').length===1?{note:'מחפש ספר',tools:[{name:'get_product',id:'1'}]}:{message:'הנה ספר',present:['1']};};
  const pre=await (await post('/concierge/classify',{query:'תמליץ לי על ספר'})).json();assert.equal(pre.open,true);assert.equal(pre.trigger.reason,'conversational');
  const fast=await (await post('/search',{query:'ספר',limit:8,conciergeClassified:true})).json();assert.equal(fast.concierge,null);assert.ok(Array.isArray(fast.matches));
  const streamed=await post('/concierge/stream',{message:'תמליץ לי על ספר',trigger:pre.trigger});assert.match(streamed.headers.get('content-type'),/ndjson/);
  const events=(await streamed.text()).trim().split('\n').map(JSON.parse);assert.deepEqual(events.map(e=>e.type),['thinking','step','done']);assert.equal(events.at(-1).reply,'הנה ספר');assert.equal(events.at(-1).products[0].id,'1');
  assert.deepEqual(calls,['classify','chat','chat']);
  // Both turns above were saved: the JSON one under a server-made id, the streamed one grouped by the id it returned.
  const sid=events.at(-1).conversationId;assert.match(sid,/^[a-f0-9-]{36}$/);
  app.locals.conciergeAgent=async()=>({message:'ויש גם זה',present:['1']});
  assert.equal((await post('/concierge',{message:'עוד משהו?',conversationId:sid})).status,200);
  app.locals.conciergeAgent=async()=>{throw Error('offline');};assert.notEqual((await post('/concierge',{message:'ועוד?',conversationId:sid})).status,200);
  assert.equal((await post('/concierge',{message:'x',conversationId:'../etc'})).status,400);
  const log=await (await fetch(path+'/concierge/conversations',{headers})).json();assert.equal(log.total,2);
  const conv=log.conversations.find(c=>c.id===sid);assert.equal(conv.trigger.reason,'conversational');
  assert.deepEqual(conv.turns.map(t=>t.message),['תמליץ לי על ספר','עוד משהו?','ועוד?']);assert.equal(conv.turns[0].reply,'הנה ספר');assert.deepEqual(conv.turns[0].products.map(x=>x.id),['1']);assert.deepEqual(conv.turns[0].steps,['get_product']);assert.equal(conv.turns[2].error,'offline');
  // A result-based moment (nothing found) still asks the merchant policy, which the pre-search classifier could not check.
  calls.length=0;app.locals.conciergeAgent=async(_prompt,options)=>{calls.push(options.purpose);return {should_open:true,explanation:'אין תוצאות'};};
  const empty=await (await post('/search',{query:'qqqzzz',limit:8,conciergeClassified:true})).json();
  assert.ok(['no_results','non_literal'].includes(empty.concierge.reason));assert.deepEqual(calls,['trigger']);
  // The demo mirror offers the same classifier and streamed turn without a studio session (its host has no /api),
  // and learns from the project meta whether to load the advisor at all.
  app.locals.conciergeAgent=async(_prompt,options)=>options.purpose==='classify'?{open:true,explanation:'בקשת המלצה'}:{message:'הנה ספר',present:['1']};
  const demo=(suffix,body)=>fetch(base+'/demo/'+p.id+'/__semantix/concierge'+suffix,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const offered=await (await demo('/decide',{query:'תמליץ לי על ספר'})).json();assert.equal(offered.open,true);assert.equal(offered.trigger.reason,'conversational');
  // A plain query that finds nothing opens the advisor as well (here by the merchant policy saved above); one that
  // finds its product does not.
  app.locals.conciergeAgent=async(prompt,options)=>options.purpose==='classify'?{open:false,explanation:'שם מוצר'}:options.purpose==='trigger'?{should_open:prompt.includes('qqqzzz'),explanation:'לפי התוצאות'}:{message:'הנה ספר',present:['1']};
  assert.ok(['no_results','non_literal'].includes((await (await demo('/decide',{query:'qqqzzz'})).json()).trigger.reason));
  assert.deepEqual(await (await demo('/decide',{query:'ספר מומלץ'})).json(),{open:false});
  assert.equal(shellFor('<h1>zqsemantixshellqz</h1><a href="/s?q=zqsemantixshellqz">','יין <b> & גבינה'),'<h1>יין &#60;b&#62; &#38; גבינה</h1><a href="/s?q='+encodeURIComponent('יין <b> & גבינה')+'">');
  const said=(await (await demo('/stream',{message:'תמליץ לי על ספר',trigger:offered.trigger})).text()).trim().split('\n').map(JSON.parse);
  assert.equal(said.at(-1).type,'done');assert.equal(said.at(-1).reply,'הנה ספר');assert.equal(said.at(-1).products[0].id,'1');
  assert.equal((await store.meta(p.id)).concierge,true);
 }finally{delete app.locals.conciergeAgent;await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});
