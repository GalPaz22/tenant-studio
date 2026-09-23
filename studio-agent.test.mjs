import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';import {tmpdir} from 'node:os';import {createServer} from 'node:net';
import {studioAgent,tools} from './core/studio-agent.mjs';import {existingProject} from './existing-client.mjs';import {createStore} from './store.mjs';
import {createIndexRetriever} from './core/search-index.mjs';

const books=()=>existingProject('books',{dbName:'books'},[{id:'1',name:'אבא עושה בושות',author:'מאיר שלו',stockStatus:'instock'},{id:'2',name:'יונה ונער',author:'מאיר שלו',stockStatus:'instock'},{id:'3',name:'ספר אחר',author:'עמוס עוז',stockStatus:'instock'}]);
const lexical=(p,profile)=>query=>{const r=createIndexRetriever(p.productCards,{...profile,tenantId:p.id},p.searchIndex)(query);return {...r,metadata:{phase:'lexical',llmUsed:false}};};
const scripted=(...replies)=>{let i=0;const prompts=[];const model=async prompt=>{prompts.push(prompt);return typeof replies[i]==='function'?replies[i++](prompt):replies[i++];};model.prompts=prompts;return model;};

test('agent investigates, fixes a typo, verifies with the working rules and saves one version',async()=>{
 const p=books(),events=[];
 const model=scripted({note:'בודק',tools:[{name:'search',query:'מאר שלו'}]},{tools:[{name:'add_spelling',from:'מאר שלו',to:'מאיר שלו'},{name:'search',query:'מאר שלו'}]},{message:'**תוקן.** עכשיו 2 תוצאות'});
 const judge=async prompt=>{assert.match(prompt,/אבא עושה בושות/);return {queries:[{query:'מאר שלו',returned:[{id:'1',verdict:'wanted'},{id:'2',verdict:'wanted'}],missing:[]}],summary:'מוחזרים ספרי מאיר שלו'};};
 const next=await studioAgent(p,'מאר שלו לא עובד',{model,judge,onEvent:async e=>events.push(e),services:{createSearch:lexical}});
 const searches=events.filter(e=>e.type==='tool_done'&&e.name==='search');
 assert.equal(searches[0].text,'חיפוש ״מאר שלו״ — 0 תוצאות');assert.equal(searches[1].text,'חיפוש ״מאר שלו״ — 2 תוצאות');assert.equal(searches[1].products.length,2);
 assert.deepEqual(events.map(e=>e.type),['note','tool','tool_done','tool','tool_done','tool','tool_done','tool','tool_done','message']);
 assert.equal(events.at(-2).name,'verify');assert.match(events.at(-1).text,/✅ אימות אוטומטי/);
 assert.equal(next.revisions.length,2);assert.equal(next.revisions[1].profile.queryAliases['מאר שלו'],'מאיר שלו');assert.deepEqual(next.revisions[1].changes,['תיקון כתיב ״מאר שלו״ ← ״מאיר שלו״']);
 assert.equal(p.revisions.length,1,'input project is not mutated');
 const reply=next.messages.at(-1);assert.equal(reply.role,'assistant');assert.equal(reply.version,2);assert.equal(reply.steps.length,4);assert.equal(reply.verification.satisfied,true);
 assert.ok(model.prompts[0].includes('ONE merchant: "books"'));assert.ok(model.prompts[1].includes('"tool":"search"'));
});

test('inspect_query shows why a combination is empty and analyze paints one customer picture',async()=>{
 const p=existingProject('books',{dbName:'books'},[{id:'1',name:'תפוח',stockStatus:'instock'},{id:'2',name:'בננה',stockStatus:'instock'},{id:'3',name:'מארז',stockStatus:'outofstock'}]);
 const ctx={p,profile:p.revisions[0].profile,services:{signals:async()=>({top:[{query:'תפוח בננה',searches:9,zeroResults:9}]})}};
 const miss=tools.inspect_query.run(ctx,{query:'תפוח בננה'});assert.equal(miss.total,0);assert.equal(miss.why.kind,'no-intersection');assert.equal(miss.termHits.find(t=>t.term==='תפוח').exact,1);
 const captured=tools.inspect_query.run({...ctx,profile:{...ctx.profile,scopedAliases:[{id:'a',term:'מארז מיוחד',productIds:['3']}]}},{query:'מארז מיוחד'});assert.equal(captured.total,0);assert.equal(captured.why.kind,'scoped-only');
 const picture=await tools.analyze.run(ctx);assert.equal(picture.catalog.products,3);assert.equal(picture.analytics.top[0].query,'תפוח בננה');assert.equal(picture.rules.counts.spelling,0);
});
test('a quote-only spelling is rejected, and a short pin cannot hide titles that already contain the word',()=>{
 const p=existingProject('books',{dbName:'books'},[{id:'1',name:'תנ"ך מהדורת המעלות',stockStatus:'instock'},{id:'2',name:'תנ״ך קורן',stockStatus:'instock'}]);
 const ctx={p,profile:p.revisions[0].profile};
 assert.throws(()=>tools.add_spelling.run(ctx,{from:'תנך',to:'תנ"ך'}),/זהות/);
 assert.throws(()=>tools.link_term.run(ctx,{term:'תנ״ך',productIds:['1']}),/כותרות/);
 const linked=tools.link_term.run(ctx,{term:'מארז מיוחד',productIds:['1']});
 assert.equal(linked.products,1);
});
test('nested tool arguments still search, and a false empty-catalog claim after failed lookups is not saved',async()=>{
 const p=books();
 const nested=scripted({tools:[{name:'find_products',arguments:{contains:'מאיר'}}]},{message:'נמצאו ספרים'});
 const found=await studioAgent(p,'חפש מאיר',{model:nested,services:{createSearch:lexical}});
 assert.equal(found.messages.at(-1).steps[0].ok,true);assert.match(found.messages.at(-1).steps[0].text,/מאיר/);
 const lying=scripted({tools:[{name:'find_products'}]},{message:'סרקתי את הקטלוג ואין קינדל'},{message:'סרקתי שוב ואין'});
 const next=await studioAgent(p,'חפש קינדל',{model:lying,services:{createSearch:lexical}});
 assert.match(lying.prompts.at(-1),/הכלים לא רצו/);assert.match(next.messages.at(-1).text,/החיפוש לא רץ/);assert.equal(next.messages.at(-1).steps[0].ok,false);
});
test('read-only questions and failed tools do not create versions or fake changes',async()=>{
 const p=books(),events=[];
 const next=await studioAgent(p,'מה יש בקטלוג?',{model:scripted({tools:[{name:'overview'},{name:'remove_rule',kind:'spelling',key:'nothing'},{name:'nope'}]},{message:'יש 3 ספרים'}),onEvent:async e=>events.push(e),services:{createSearch:lexical}});
 assert.equal(next.revisions.length,1);assert.deepEqual(next.messages.at(-1).changes,[]);
 const done=events.filter(e=>e.type==='tool_done');assert.deepEqual(done.map(e=>e.ok),[true,false,false]);assert.match(done[2].text,/כלי לא קיים/);
});

test('changes that break a confirmed example are sent back once, then refused without saving',async()=>{
 const p=books();p.learning={examples:[{id:'e1',query:'שלו',includeIds:['1','2'],excludeIds:[],status:'confirmed'}],proposals:[]};
 const fixing=scripted({tools:[{name:'add_spelling',from:'שלו',to:'עוז'}]},{message:'בוצע'},{tools:[{name:'remove_rule',kind:'spelling',key:'שלו'}]},{message:'הוסר, הבדיקות עוברות'});
 const next=await studioAgent(p,'שנה',{model:fixing,services:{createSearch:lexical}});
 assert.ok(fixing.prompts[2].includes('השמירה נחסמה'));assert.equal(next.revisions.length,1);
 await assert.rejects(()=>studioAgent(p,'שנה',{model:scripted({tools:[{name:'add_spelling',from:'שלו',to:'עוז'}]},{message:'בוצע'},{message:'בוצע שוב'}),services:{createSearch:lexical}}),/שוברים בדיקות קבועות: שלו/);
});

test('data tools rebuild the index before the next search and saved examples guard later turns',async()=>{
 const p=books();
 const database={fields:async()=>({fields:[]}),search:async()=>({total:0}),importField:async q=>{for(const c of q.productCards)c.specifications={...c.specifications,shelf:'מדף-'+c.id};(q.processingHistory??=[]).push({target:'shelf',ids:q.productCards.map(c=>c.id)});return {imported:3};}};
 const next=await studioAgent(p,'ייבא מדף',{model:scripted({tools:[{name:'db_import_field',field:'shelf',target:'shelf'},{name:'inspect_query',query:'מדף-2'},{name:'add_example',query:'מדף-2',includeIds:['2']}]},{message:'יובא'}),services:{createSearch:lexical,database}});
 assert.equal(next.messages.at(-1).steps[1].text,'אבחנת ״מדף-2״ — 1');assert.equal(next.learning.examples[0].status,'confirmed');
 assert.equal(next.searchIndex.terms['מדף'].length,3);assert.equal(tools.check_examples.run({p:next,profile:next.revisions.at(-1).profile}).passed,1);
});

test('studio endpoint streams NDJSON events and persists the turn',async()=>{
 const root=await mkdtemp(tmpdir()+'/studio-');process.env.STUDIO_DATA_DIR=root;
 const probe=createServer().listen(0,'127.0.0.1');await new Promise(r=>probe.once('listening',r));const port=probe.address().port;await new Promise(r=>probe.close(r));process.env.STUDIO_PORT=String(port);
 const {app}=await import('./server.mjs');const server=app.listen(port,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{
  const p=books();await createStore(root).save(p);
  app.locals.studioAgent=scripted({tools:[{name:'add_spelling',from:'שליו',to:'שלו'}]},{message:'נוסף תיקון'});app.locals.studioServices={createSearch:lexical};
  const base='http://127.0.0.1:'+port,headers={Host:'127.0.0.1:'+port,'Content-Type':'application/json'};
  headers['X-Studio-Token']=(await (await fetch(base+'/api/session',{headers})).json()).token;
  const page=await fetch(base+'/',{headers});assert.match(await page.text(),/studio\.js/);
  const response=await fetch(base+'/api/projects/'+p.id+'/studio',{method:'POST',headers,body:JSON.stringify({message:'תקן שליו'})});
  assert.match(response.headers.get('content-type'),/ndjson/);
  const events=(await response.text()).trim().split('\n').map(l=>JSON.parse(l));
  assert.deepEqual(events.map(e=>e.type),['tool','tool_done','message','done']);assert.equal(events[3].project.revisions.length,2);
  assert.equal((await createStore(root).read(p.id)).messages.at(-1).text,'נוסף תיקון');
  const bad=await fetch(base+'/api/projects/'+p.id+'/studio',{method:'POST',headers,body:JSON.stringify({message:''})});assert.equal(bad.status,400);
 }finally{server.close();}
});

const diaries=()=>existingProject('books',{dbName:'books'},[
 {id:'1',name:'יומן',author:'הלן בר',productTypes:['סיפורת'],stockStatus:'instock'},{id:'2',name:'יומן מלחמה פרטי',productTypes:['אוטוביוגרפיה'],stockStatus:'instock'},
 {id:'3',name:'יומן התינוקת שלי',productTypes:['הריון לידה ותינוק'],stockStatus:'instock'},{id:'4',name:'יומן הקריאה שלי',productTypes:['יומנים ומוצרי נייר'],stockStatus:'instock'},
 {id:'5',name:'יומן זכרונות חד קרן',productTypes:['יומנים ומוצרי נייר'],stockStatus:'outofstock'}].map(d=>({...d,specifications:{סוג:d.productTypes[0]}})));
test('facet shows which kinds carry a word, and a narrowing link returns only the chosen kind',async()=>{
 const p=diaries(),ctx={p,profile:structuredClone(p.revisions[0].profile)};
 const f=tools.facet.run(ctx,{field:'specifications.סוג',titleContains:'יומן'});assert.equal(f.selected,5);assert.equal(f.values.find(v=>v.value==='יומנים ומוצרי נייר').visible,1);
 assert.throws(()=>tools.link_term.run(ctx,{term:'יומן',field:'specifications.סוג',values:['יומנים ומוצרי נייר']}),/mode:"only"/);
 const linked=tools.link_term.run(ctx,{term:'יומן',mode:'only',titleContains:'יומן',field:'specifications.סוג',values:['יומנים ומוצרי נייר','תינוק']});
 assert.deepEqual([linked.mode,linked.products,linked.visible],['only',3,2]);
 const found=lexical(p,ctx.profile)('יומן');assert.deepEqual(found.matches.map(m=>m.id).sort(),['3','4']);
 assert.equal(lexical(p,p.revisions[0].profile)('יומן').total,4,'without the rule the novels are returned too');
 const added=tools.link_term.run(ctx,{term:'יומן',mode:'add',replace:true,productIds:['4','1','2','3','5']});assert.equal(added.mode,'add');assert.equal(ctx.profile.scopedAliases[0].mode,undefined);
});
test('a fix is not accepted until a fresh search satisfies the reviewer',async()=>{
 const p=diaries(),events=[],verdicts=[];
 const model=scripted(
  {tools:[{name:'search',query:'יומן'}]},{message:'החיפוש תקין, מוחזרים 4 מוצרים',verify:['יומן']},
  prompt=>{assert.match(prompt,/NOT SATISFIED/);assert.match(prompt,/עדיין מוחזרים רומנים/);return {tools:[{name:'facet',field:'specifications.סוג',titleContains:'יומן'},{name:'link_term',term:'יומן',mode:'only',titleContains:'יומן',field:'specifications.סוג',values:['יומנים ומוצרי נייר','תינוק']}]};},
  {message:'**תוקן:** ״יומן״ מחזיר רק יומנים',verify:['יומן']});
 const judge=async prompt=>{const data=JSON.parse(prompt.slice(prompt.lastIndexOf('DATA ')+5)),ids=data.results[0].returned.map(x=>x.id).sort();verdicts.push(ids);
  return {queries:[{query:'יומן',returned:ids.map(id=>({id,verdict:['1','2'].includes(id)?'unwanted':'wanted'})),missing:[],note:ids.includes('1')?'עדיין מוחזרים רומנים':''}],summary:ids.includes('1')?'לא תקין':'מוחזרים רק יומנים'};};
 const next=await studioAgent(p,'החיפוש ״יומן״ מחזיר ספרים. רוצה רק יומנים',{model,judge,onEvent:async e=>events.push(e),services:{createSearch:lexical}});
 assert.deepEqual(verdicts,[['1','2','3','4'],['3','4']]);
 const reply=next.messages.at(-1);assert.equal(reply.verification.satisfied,true);assert.equal(reply.verification.rounds,1);assert.match(reply.text,/✅ אימות אוטומטי:\*\* חיפוש ״יומן״ מחזיר 2 תוצאות/);
 assert.equal(next.revisions.at(-1).profile.scopedAliases[0].mode,'only');assert.ok(events.some(e=>e.type==='note'&&/האימות לא עבר/.test(e.text)));
});
test('after the verification rounds run out the operator is told the fix still fails',async()=>{
 const p=diaries();let i=0;
 const model=async()=>i++%2===0?{tools:[{name:'add_spelling',from:'יומנן'+i,to:'יומן'}]}:{message:'תוקן',verify:['יומן']};
 const judge=async()=>({queries:[{query:'יומן',returned:[{id:'1',verdict:'unwanted'}],missing:[],note:'מוחזרים רומנים'}],summary:'לא תקין'});
 const next=await studioAgent(p,'החיפוש ״יומן״ לא טוב',{model,judge,services:{createSearch:lexical}});
 const reply=next.messages.at(-1);assert.equal(reply.verification.satisfied,false);assert.equal(reply.verification.rounds,3);assert.match(reply.text,/⚠️ האימות האוטומטי לא עבר אחרי 3 סבבי תיקון/);assert.match(reply.text,/מוחזרים רומנים/);
 assert.equal(next.revisions.length,1,'an unverified fix is not saved');assert.match(reply.text,/השינויים לא נשמרו/);assert.ok(reply.discarded.length>=3);
});
test('a reviewer outage does not block saving and is reported',async()=>{
 const p=books();const model=scripted({tools:[{name:'add_spelling',from:'מאר שלו',to:'מאיר שלו'}]},{message:'תוקן'});
 const next=await studioAgent(p,'״מאר שלו״ לא עובד',{model,judge:async()=>{throw Error('offline')},services:{createSearch:lexical}});
 assert.equal(next.revisions.length,2);assert.match(next.messages.at(-1).text,/לא ניתן היה לקבל חוות דעת/);assert.equal(next.messages.at(-1).verification.satisfied,null);
});
test('answering again without any change after a failed verification is sent back, not re-verified',async()=>{
 const p=diaries();let judged=0;const prompts=[];
 const model=async prompt=>{prompts.push(prompt);return prompts.length===1?{tools:[{name:'add_spelling',from:'יומנן',to:'יומן'}]}:{message:'תוקן',verify:['יומן']};};
 const next=await studioAgent(p,'״יומן״ מחזיר ספרים',{model,judge:async()=>{judged++;return {queries:[{query:'יומן',returned:[{id:'2',verdict:'unwanted'}],missing:[]}],summary:'לא'};},services:{createSearch:lexical}});
 assert.equal(judged,1);assert.match(prompts.at(-1),/nothing changed since the failed verification/);assert.match(next.messages.at(-1).text,/⚠️ האימות האוטומטי לא עבר/);
});
test('reviewer verdicts are grounded: invented ids cannot fail a good fix, and named unwanted products reach the agent',async()=>{
 const p=diaries(),profile=structuredClone(p.revisions[0].profile);profile.scopedAliases=[{id:'a',term:'יומן',mode:'only',productIds:['3','4']}];p.revisions.push({number:2,profile});
 const model=async()=>({message:'תקין',verify:['יומן']});
 const next=await studioAgent(p,'בדוק ״יומן״',{model,judge:async()=>({queries:[{query:'יומן',returned:[{id:'3',verdict:'wanted'},{id:'4',verdict:'wanted'},{id:'999',verdict:'unwanted'}],missing:['1','888']}],summary:'x'}),services:{createSearch:lexical}});
 const v=next.messages.at(-1).verification;assert.equal(v.satisfied,false,'1 is a real not-returned product the reviewer wants');assert.match(v.queries[0].problems,/חסרים מוצרים רצויים.*״יומן״/);assert.doesNotMatch(v.queries[0].problems,/999|888/);
 const ok=await studioAgent(p,'בדוק ״יומן״',{model:scripted({message:'תקין'}),judge:async()=>({queries:[{query:'יומן',returned:[{id:'3',verdict:'wanted'},{id:'4',verdict:'wanted'},{id:'999',verdict:'unwanted'}],missing:['888']}],summary:'רק יומנים'}),services:{createSearch:lexical}});
 assert.equal(ok.messages.at(-1).verification.satisfied,true);
});
test('one malformed model reply is retried instead of failing the turn',async()=>{
 const p=books();let n=0;const model=async()=>{if(n++===0)throw Error('המודל החזיר JSON לא תקין');return {message:'בסדר'};};
 const next=await studioAgent(p,'מה שלומך',{model,services:{createSearch:lexical}});assert.equal(next.messages.at(-1).text,'בסדר');
});
test('an "only" selection replaces the older wider list, and bare excludeValues filter titles',()=>{
 const p=diaries(),ctx={p,profile:structuredClone(p.revisions[0].profile)};
 tools.link_term.run(ctx,{term:'יומן',mode:'only',titleContains:'יומן'});assert.equal(ctx.profile.scopedAliases[0].productIds.length,5);
 const r=tools.link_term.run(ctx,{term:'יומן',mode:'only',titleContains:'יומן',excludeValues:['מלחמה','יומן הקריאה']});
 assert.equal(r.products,3);assert.deepEqual(ctx.profile.scopedAliases[0].productIds.sort(),['1','3','5']);
 tools.link_term.run(ctx,{term:'יומן',productIds:['4']});assert.equal(ctx.profile.scopedAliases[0].productIds.length,1,'a later selection on an only-rule still replaces');
});
test('shopper_clicks reports clicked products that the catalog lacks',async()=>{
 const {dbShopperClicks}=await import('./existing-client.mjs');const p=diaries();
 const fake=(rows)=>async(_,fn)=>fn({collection:name=>({find:()=>({sort:()=>({limit:()=>({toArray:async()=>name==='product_clicks'?rows:[]})})})})});
 const r=await dbShopperClicks(p,{query:'יומן'},fake([{product_name:'יומן הקריאה שלי',product_url:'https://x/4'},{product_name:'נעלם',product_url:'https://x/digital/999'},{product_name:'נעלם',product_url:'https://x/999'}]));
 assert.equal(r.clicks,3);assert.deepEqual(r.products.map(x=>[x.title,x.clicks,x.inCatalog]),[['נעלם',2,false],['יומן הקריאה שלי',1,true]]);assert.equal(r.missingFromCatalog,1);
});
