import {test} from 'node:test';import assert from 'node:assert/strict';
import {existingProject} from './existing-client.mjs';
import {decideTrigger,outOfStockHits,applyConciergeSettings,settingsOf,conciergeTurn,inspectTrigger,soldOutHits} from './core/concierge.mjs';
import {studioAgent,tools} from './core/studio-agent.mjs';
import {createIndexRetriever} from './core/search-index.mjs';

const shop=()=>existingProject('books',{dbName:'books'},[{id:'1',name:'אבא עושה בושות',author:'מאיר שלו',stockStatus:'instock',price:80},{id:'2',name:'יונה ונער',author:'מאיר שלו',stockStatus:'outofstock',price:70}]);
const lexical=(p,profile)=>query=>{const r=createIndexRetriever(p.productCards,{...profile,tenantId:p.id},p.searchIndex)(query);return {...r,metadata:{phase:r.total?'lexical':'lexical',llmUsed:false,exactCount:r.total}};};

test('trigger matches dashboard moments: empty, out of stock, non-literal, and stays closed on a literal hit',()=>{
 const p=shop();applyConciergeSettings(p,{enabled:true});
 assert.equal(decideTrigger({matches:[],metadata:{phase:'lexical'}},'xyz',settingsOf(p)).reason,'no_results');
 const oos=outOfStockHits(p.productCards,'יונה ונער');assert.equal(oos[0].id,'2');
 assert.equal(decideTrigger({matches:[],metadata:{phase:'lexical'}},'יונה ונער',settingsOf(p),oos).reason,'out_of_stock');
 assert.equal(decideTrigger({matches:[{id:'1',stockStatus:'instock'}],metadata:{phase:'closest-alternatives'}},'משהו',settingsOf(p)).reason,'non_literal');
 assert.equal(decideTrigger({matches:[{id:'1',stockStatus:'instock'}],metadata:{phase:'lexical',exactCount:1}},'מאיר שלו',settingsOf(p)),null);
 assert.equal(decideTrigger({matches:[],metadata:{phase:'lexical'}},'xyz',{enabled:false}),null);
});

test('shopper turn uses only this catalog and present_products',async()=>{
 const p=shop();applyConciergeSettings(p,{enabled:true,context:'חנות ספרים'});
 let n=0;const model=async()=>++n===1?{tools:[{name:'search_catalog',query:'מאיר שלו'}]}:{message:'יש את אבא עושה בושות במלאי.',present:['1']};
 const r=await conciergeTurn(p,{message:'יש משהו של שלו?',trigger:{reason:'no_results',query:'שליו'}},model,{search:lexical(p,p.revisions[0].profile)});
 assert.equal(r.products[0].id,'1');assert.ok(!r.products.some(x=>x.id==='2'));assert.deepEqual(r.steps,['search_catalog']);
 // Arguments nested under args reach the tool as well (the query is not lost).
 n=0;const steps=[];const nested=async()=>++n===1?{note:'מחפש',tools:[{name:'search_catalog',args:{query:'מאיר שלו'}}]}:{message:'יש.',present:['1']};
 await conciergeTurn(p,{message:'יש משהו של שלו?'},nested,{search:lexical(p,p.revisions[0].profile),onEvent:e=>e.type==='step'&&steps.push(e.text)});
 assert.deepEqual(steps,['מחפש ״מאיר שלו״']);
 // A malformed reply (the model layer marks it with modelResponse) is asked once more; other failures are not.
 n=0;const slip=async()=>{if(++n===1)throw Object.assign(Error('JSON לא תקין'),{modelResponse:'{'});return {message:'יש.',present:['1']};};
 assert.equal((await conciergeTurn(p,{message:'יש?'},slip,{search:lexical(p,p.revisions[0].profile)})).reply,'יש.');assert.equal(n,2);
 await assert.rejects(conciergeTurn(p,{message:'יש?'},async()=>{throw Error('offline');},{search:lexical(p,p.revisions[0].profile)}),/offline/);
});

test('studio agent can enable concierge without a search-rule revision',async()=>{
 const p=shop();let n=0;
 const next=await studioAgent(p,'הפעל קונסיירז׳',{model:async()=>++n===1?{tools:[{name:'configure_concierge',enabled:true,autoOpen:true,context:'ספרים'}]}:{message:'הופעל'},services:{createSearch:lexical}});
 assert.equal(next.concierge.enabled,true);assert.equal(next.concierge.context,'ספרים');assert.equal(next.revisions.length,1);
 const preview=await tools.preview_concierge.run({p:next,profile:next.revisions[0].profile,search:async()=>({matches:[],total:0,metadata:{phase:'lexical'}})},{query:'אין כזה'});
 assert.equal(preview.trigger.reason,'no_results');
});

test('opening policy and model settings persist, preserve existing fields and reject invalid input',()=>{
 const p=shop();applyConciergeSettings(p,{enabled:true,context:'ספרים',triggerPrompt:'רק בקשות המלצה',model:'gemini-3.8-flash'});
 applyConciergeSettings(p,{autoOpen:false});
 assert.equal(settingsOf(p).triggerPrompt,'רק בקשות המלצה');assert.equal(settingsOf(p).model,'gemini-3.8-flash');assert.equal(settingsOf(p).context,'ספרים');
 const before=structuredClone(p.concierge);
 for(const settings of [{model:'invented-model'},{triggerPrompt:'x'.repeat(4001)},{model:5}])assert.throws(()=>applyConciergeSettings(p,settings));
 assert.deepEqual(p.concierge,before);
 applyConciergeSettings(p,{triggerPrompt:'',model:null});assert.equal(settingsOf(p).triggerPrompt,'');assert.equal(settingsOf(p).model,null);
});

test('opening policy can open literal results and suppress default empty-result triggers',async()=>{
 const {evaluateConciergeTrigger}=await import('./core/concierge.mjs');const p=shop();
 applyConciergeSettings(p,{enabled:true,autoOpen:false,triggerPrompt:'פתח רק לבקשות המלצה',model:'gemini-3.8-flash'});
 const r=await evaluateConciergeTrigger(p,'תמליץ על ספר',{matches:[p.productCards[0]],metadata:{phase:'lexical',exactCount:1}},async(prompt,options)=>{assert.equal(options.model,'gemini-3.8-flash');assert.equal(options.purpose,'trigger');assert.match(prompt,/פתח רק לבקשות המלצה/);return {should_open:true,explanation:'הלקוח מבקש המלצה'};});
 assert.equal(r.trigger.reason,'merchant_policy');assert.equal(r.trigger.display,'pill');assert.equal(r.decision.explanation,'הלקוח מבקש המלצה');
 const closed=await evaluateConciergeTrigger(p,'xyz',{matches:[]},async()=>({should_open:false,explanation:'אין בקשת המלצה'}));assert.equal(closed.trigger,null);
});

test('default and disabled policies avoid model calls; invalid policy decisions fail closed',async()=>{
 const {evaluateConciergeTrigger}=await import('./core/concierge.mjs');const p=shop();let calls=0;const model=async()=>{calls++;throw Error('offline');};
 applyConciergeSettings(p,{enabled:true});assert.equal((await evaluateConciergeTrigger(p,'xyz',{matches:[]},model)).trigger.reason,'no_results');assert.equal(calls,0);
 applyConciergeSettings(p,{triggerPrompt:'הפעל לפי הצורך'});const fail=await evaluateConciergeTrigger(p,'xyz',{matches:[]},model);assert.equal(fail.trigger,null);assert.ok(fail.decision.error);
 for(const answer of [{should_open:'yes',explanation:'test'},{should_open:true},{should_open:true,explanation:'x'.repeat(501)}])assert.equal((await evaluateConciergeTrigger(p,'xyz',{matches:[]},async()=>answer)).trigger,null);
 applyConciergeSettings(p,{enabled:false});await evaluateConciergeTrigger(p,'xyz',{matches:[]},model);assert.equal(calls,1);
});

test('shopper calls use the selected model independently of studio configuration',async()=>{
 const p=shop();applyConciergeSettings(p,{enabled:true,model:'gemini-2.5-flash'});
 await conciergeTurn(p,{message:'שלום'},async(_prompt,opts)=>{assert.deepEqual(opts,{model:'gemini-2.5-flash',purpose:'chat'});return {message:'איך אפשר לעזור?',present:[]};});
});

test('agent previews evaluate merchant policy using the concierge service',async()=>{
 const p=shop();applyConciergeSettings(p,{enabled:true,triggerPrompt:'אל תפתח ללא המלצה',model:'gemini-3.8-flash'});
 const r=await tools.preview_concierge.run({p,search:async()=>({matches:[],total:0}),services:{conciergeAgent:async()=>({should_open:false,explanation:'לא ביקש המלצה'})}},{query:'ספר מסוים'});
 assert.equal(r.trigger,null);assert.equal(r.decision.source,'merchant_policy');assert.equal(r.model,'gemini-3.8-flash');
});

test('natural-language studio turn changes opening policy/model and previews positive and negative queries',async()=>{
 const p=shop();let n=0;const calls=[];
 const next=await studioAgent(p,'פתח רק כשמבקשים המלצה, השתמש ב-gemini-3.8-flash ובדוק',{model:async()=>++n===1?{tools:[{name:'configure_concierge',enabled:true,triggerPrompt:'פתח רק כשמבקשים המלצה',model:'gemini-3.8-flash'}]}:n===2?{tools:[{name:'preview_concierge',query:'תמליץ על ספר'},{name:'preview_concierge',query:'אבא עושה בושות'}]}:{message:'נשמר ונבדק'},services:{createSearch:lexical,conciergeAgent:async(prompt,options)=>{calls.push(options.model);return {should_open:prompt.includes('תמליץ על ספר'),explanation:'החלטה לפי בקשת המלצה'};}}});
 assert.equal(next.concierge.model,'gemini-3.8-flash');assert.equal(next.concierge.triggerPrompt,'פתח רק כשמבקשים המלצה');assert.deepEqual(calls,['gemini-3.8-flash','gemini-3.8-flash']);assert.equal(next.revisions.length,1);
});

test('pre-search classifier judges the query alone, opens conversational queries and fails closed',async()=>{
 const {classifyConciergeQuery}=await import('./core/concierge.mjs');const p=shop();let calls=0;
 assert.equal((await classifyConciergeQuery(p,'מתנה לסבא',async()=>{calls++;})).open,false);assert.equal(calls,0);
 applyConciergeSettings(p,{enabled:true,autoOpen:false,model:'gemini-3.8-flash'});
 const open=await classifyConciergeQuery(p,'מתנה לסבא שאוהב היסטוריה',async(prompt,options)=>{assert.deepEqual(options,{model:'gemini-3.8-flash',purpose:'classify'});assert.match(prompt,/מתנה לסבא/);assert.doesNotMatch(prompt,/SEARCH DATA/);return {open:true,explanation:'בקשת מתנה'};});
 assert.equal(open.trigger.reason,'conversational');assert.equal(open.trigger.display,'pill');assert.equal(open.trigger.query,'מתנה לסבא שאוהב היסטוריה');
 assert.equal((await classifyConciergeQuery(p,'מאיר שלו',async()=>({open:false,explanation:'שם סופר'}))).trigger,null);
 for(const model of [async()=>{throw Error('offline');},async()=>({open:'yes',explanation:'x'}),async()=>({open:true})]){const r=await classifyConciergeQuery(p,'מתנה',model);assert.equal(r.open,false);assert.ok(r.decision.error);}
 applyConciergeSettings(p,{triggerPrompt:'פתח רק לבקשות מתנה'});
 await classifyConciergeQuery(p,'מתנה',async prompt=>{assert.match(prompt,/MERCHANT POLICY.*פתח רק לבקשות מתנה/s);return {open:true,explanation:'מתנה'};});
});

test('a streamed turn reports thinking, steps and candidate products before the final answer',async()=>{
 const p=shop();applyConciergeSettings(p,{enabled:true});const events=[];
 let n=0;const model=async()=>++n===1?{note:'בודק ספרים של מאיר שלו',tools:[{name:'search_catalog',query:'מאיר שלו'}]}:{message:'יש את אבא עושה בושות.',present:['1']};
 const r=await conciergeTurn(p,{message:'ספר של שלו במתנה',trigger:{reason:'conversational'}},model,{search:lexical(p,p.revisions[0].profile),onEvent:e=>events.push(e)});
 assert.deepEqual(events.map(e=>e.type),['thinking','step','products']);assert.equal(events[0].text,'בודק ספרים של מאיר שלו');assert.match(events[1].text,/מאיר שלו/);
 assert.deepEqual(events[2].products.map(x=>x.id),['1']);assert.equal(events[2].products[0].description,undefined);assert.equal(r.products[0].id,'1');
});

test('a product named in the query that exists only out of stock is a sold-out moment',()=>{
 const cards=[{id:'1',title:'לטם נביולו',stockStatus:'outofstock'},{id:'2',title:'ברולו נביולו',stockStatus:'instock'}];
 assert.deepEqual(soldOutHits(cards,'לטם נביולו',[cards[1]]).map(c=>c.id),['1']);
 assert.deepEqual(soldOutHits(cards,'נביולו',[cards[1]]),[]);
 assert.deepEqual(soldOutHits(cards,'ברולו',[cards[1]]),[]);
 // The same name spelled one letter apart is in stock.
 assert.deepEqual(soldOutHits([{id:'3',title:'הארלן קובן הבריחה',stockStatus:'outofstock'}],'הארלן קובן',[{id:'4',title:'הרלן קובן אל תעזוב',stockStatus:'instock'}]),[]);
});
