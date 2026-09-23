import {test} from 'node:test';import assert from 'node:assert/strict';
import {auditSearches,auditCandidates} from './core/search-audit.mjs';import {summarizeQueries} from './core/fast-track.mjs';
import {existingProject} from './existing-client.mjs';import {createIndexRetriever} from './core/search-index.mjs';

const lexical=(p,profile)=>query=>{const r=createIndexRetriever(p.productCards,{...profile,tenantId:p.id},p.searchIndex)(query);return {...r,metadata:{phase:'lexical',llmUsed:false}};};
const shop=()=>existingProject('shop',{dbName:'shop'},[{id:'1',name:'יומן',author:'הלן בר',stockStatus:'instock'},{id:'2',name:'יומן התינוקת שלי',stockStatus:'instock'},{id:'3',name:'הארי פוטר ואבן החכמים',stockStatus:'instock'}]);
const signals=async()=>({top:[{query:'הארי פוטר',searches:25,clicks:60},{query:'יומן',searches:9,clicks:0}],failed:[],noClicks:[{query:'יומן',searches:9,clicks:0}],sampledSearches:40,clickTracking:true});
// The reviewer wants baby diaries for "יומן" and is happy with anything for "הארי פוטר".
const judge=async prompt=>{const data=JSON.parse(prompt.slice(prompt.lastIndexOf('DATA ')+5)),c=data.results[0];
 return {queries:[{query:c.query,returned:c.returned.map(x=>({id:x.id,verdict:c.query==='יומן'&&x.id==='1'?'unwanted':'wanted'})),missing:[]}],summary:'x'};};

test('real click and cart collections, delivered counts and case variants feed the signals',()=>{
 const s=summarizeQueries([{query:'Kindle',delivered:3},{query:'kindle ',delivered:0},{query:'Kindle'},{query:'x'},{query:'x'},{query:'x'}],[{search_query:'kindle'}],[{search_query:'KINDLE'}]);
 assert.equal(s.top[0].query,'Kindle');assert.equal(s.top[0].searches,3);assert.equal(s.top[0].clicks,1);assert.equal(s.top[0].carts,1);assert.equal(s.failed[0].zeroResults,1);assert.deepEqual(s.noClicks.map(g=>g.query),['x']);
 assert.deepEqual(summarizeQueries([{query:'x'},{query:'x'},{query:'x'}]).noClicks,[],'without click tracking nothing is "never clicked"');
});
test('candidates mix zero-result, never-clicked and top queries without duplicates',()=>{
 const c=auditCandidates({failed:[{query:'a',searches:5}],noClicks:[{query:'b',searches:9}],top:[{query:'B',searches:9},{query:'c',searches:20}]},{limit:3});
 assert.deepEqual(c.map(x=>[x.query,x.reasons.join()]),[['a','zero'],['b','noClicks,top'],['c','top']]);
});
test('check-only audit reports findings and changes no rules',async()=>{
 const p=shop(),events=[];
 const next=await auditSearches(p,{model:async()=>{throw Error('no fixing')},judge,signals,services:{createSearch:lexical,database:{clicks:async()=>({clicks:0,products:[]})}},onEvent:async e=>events.push(e)});
 const byQuery=Object.fromEntries(next.audit.results.map(r=>[r.query,r]));
 assert.equal(byQuery['הארי פוטר'].status,'ok');assert.equal(byQuery['יומן'].status,'problem');assert.deepEqual(byQuery['יומן'].reasons,['noClicks','top']);assert.match(byQuery['יומן'].problems,/״יומן״/);
 assert.equal(next.revisions.length,1);assert.match(next.messages.at(-1).text,/נבדקו 2 חיפושים אמיתיים:\*\* 1 תקינים, 1 עם בעיה/);
 assert.equal(events.filter(e=>e.type==='tool_done'&&e.name==='audit_query').length,2);
});
test('auto-fix keeps a verified fix, saves it as a pending example, and discards an unverified one',async()=>{
 const p=shop();
 // The agent narrows "יומן" to the baby diary; its own verification uses the same reviewer.
 const good=async prompt=>prompt.includes('TOOL RESULTS []')?{tools:[{name:'link_term',term:'יומן',mode:'only',productIds:['2']}]}:{message:'צומצם',verify:['יומן']};
 const next=await auditSearches(p,{model:good,judge,fix:true,signals,services:{createSearch:lexical,database:{clicks:async()=>({clicks:0,products:[]})}}});
 const r=next.audit.results.find(r=>r.query==='יומן');assert.equal(r.fix.status,'fixed');assert.equal(next.revisions.length,2);assert.equal(next.revisions[1].profile.scopedAliases[0].mode,'only');
 const example=next.learning.examples.find(e=>e.query==='יומן');assert.deepEqual([example.status,example.includeIds,example.excludeIds],['pending',['2'],['1']]);
 assert.match(next.messages.at(-1).text,/1 תוקנו ואומתו/);
 // An agent that changes something but never satisfies the reviewer leaves the project untouched.
 let n=0;const bad=async()=>n++%2===0?{tools:[{name:'add_spelling',from:'יומנן'+n,to:'יומן'}]}:{message:'תוקן',verify:['יומן']};
 const kept=await auditSearches(p,{model:bad,judge,fix:true,signals,services:{createSearch:lexical,database:{clicks:async()=>({clicks:0,products:[]})}}});
 assert.equal(kept.audit.results.find(r=>r.query==='יומן').fix.status,'not-verified');assert.equal(kept.revisions.length,1);assert.match(kept.messages.at(-1).text,/לא אומתו ולא נשמרו/);
});
test('a query whose clicked products are missing or out of stock is reported as a catalog gap and not sent for fixing',async()=>{
 const p=shop();let asked=0;
 const clicks=async(_,{query})=>query==='יומן'?{clicks:30,products:[{title:'יומן סודי',clicks:20,inCatalog:false,visible:false},{title:'יומן התינוקת שלי',id:'2',clicks:5,inCatalog:true,visible:true}]}:{clicks:0,products:[]};
 const next=await auditSearches(p,{model:async()=>{asked++;return {message:'x'};},judge,fix:true,signals,services:{createSearch:lexical,database:{clicks}}});
 const r=next.audit.results.find(r=>r.query==='יומן');assert.equal(r.status,'data-gap');assert.match(r.problems,/חסרים בקטלוג: ״יומן סודי״/);assert.equal(r.fix,undefined);assert.equal(asked,0);
 assert.match(next.messages.at(-1).text,/פערים בקטלוג/);
});
