import {test} from 'node:test';import assert from 'node:assert/strict';
import {summarizeWeek,weeklyCandidates,recentlyReviewed,readWeekSignals} from './core/weekly-review.mjs';import {summarizeCustomer} from './core/customer-analytics.mjs';
import {auditSearches} from './core/search-audit.mjs';import {tools} from './core/studio-agent.mjs';
import {existingProject} from './existing-client.mjs';import {createIndexRetriever} from './core/search-index.mjs';

const at=m=>new Date(Date.parse('2026-10-01T10:00:00Z')+m*6e4).toISOString(),opts={from:'2026-09-30T00:00:00Z',to:'2026-10-07T00:00:00Z',limit:Infinity,minSearches:1,query:'',sort:'searches'};
const q=(query,s,m,resultCount)=>({query,session_id:s,timestamp:at(m),...(resultCount!==undefined&&{resultCount})});
const ev=(search_query,s,m,extra={})=>({search_query,session_id:s,timestamp:at(m),product_id:'1',...extra});
// sells: clicked, carted, bought. dead: searched, nothing. looked: clicked only. carted: cart, no order. empty: 0 results. vague: searched again at once.
const data=()=>({queries:[q('sells','a',0,5),q('sells','b',0,5),q('dead','c',0,4),q('dead','d',0,4),q('dead','e',0,4),q('looked','f',0,3),q('looked','g',0,3),q('carted','h',0,2),q('carted','i',0,2),q('empty','j',0,0),
  q('vague','k',0,9),q('other words','k',1,9),q('vague','l',0,9),q('else','l',1,9),q('vag','m',0,9),q('vague','m',1,9),q('once','n',0,1)],
 clicks:[ev('sells','a',1),ev('looked','f',1)],carts:[ev('sells','a',2),ev('carted','h',1)],
 purchases:[{order_id:'1',session_id:'a',timestamp:at(3),event_type:'checkout_completed',search_query:'sells'}]});
const week=()=>summarizeWeek(summarizeCustomer(data(),opts));

test('every query of the week is scanned and flagged by where its funnel breaks',()=>{
 const w=week(),issues=Object.fromEntries(w.queries.map(x=>[x.query,x.issues.join()]));
 assert.deepEqual(issues,{dead:'noClicks',vague:'noClicks,refined',sells:'',looked:'noCart',carted:'noPurchase',empty:'zero','other words':'',else:'',vag:'',once:''});
 assert.equal(w.distinctQueries,10);assert.equal(w.sampledSearches,17);assert.equal(w.flaggedQueries,5,'vague counts once');assert.deepEqual(w.issues.noClicks,{queries:2,searches:6});
 assert.equal(w.queries.find(x=>x.query==='sells').purchases,1);assert.equal(w.queries.find(x=>x.query==='dead').sessions,3,'sessions are counted, never listed');
});
test('without click or purchase events nothing is called unclicked or unbought',()=>{
 const d=data(),w=summarizeWeek(summarizeCustomer({queries:d.queries,carts:d.carts},opts));
 assert.deepEqual(w.queries.filter(x=>x.issues.length).map(x=>[x.query,x.issues.join()]),[['vague','refined'],['empty','zero']]);
 assert.equal(w.queries[0].purchases,undefined);assert.equal(w.purchaseTracking,false);
});
test('the worklist puts broken funnels first, keeps places for top unflagged queries and skips recently cleared ones',()=>{
 const w=week();
 assert.deepEqual(weeklyCandidates(w,{limit:5}).map(c=>[c.query,c.reasons.join()]),[['empty','zero'],['dead','noClicks'],['looked','noCart'],['carted','noPurchase'],['sells','top']]);
 assert.deepEqual(weeklyCandidates(w,{limit:10}).slice(0,5).map(c=>c.query),['empty','dead','looked','carted','vague']);
 const p={weeklyReview:{checked:{dead:{at:new Date().toISOString(),status:'ok'},empty:{at:new Date().toISOString(),status:'problem'},looked:{at:'2026-01-01T00:00:00Z',status:'ok'}}}};
 assert.deepEqual([...recentlyReviewed(p)],['dead']);
 assert.ok(!weeklyCandidates(w,{limit:10,skip:recentlyReviewed(p)}).some(c=>c.query==='dead'));
});
test('the week is read from the project database over a bounded window',async()=>{
 const client={db(name){assert.equal(name,'shop');return {collection(c){return {aggregate(){return {async toArray(){return c==='queries'?[{query:'x',session_id:'s',timestamp:new Date(Date.now()-36e5).toISOString()}]:[];}};}};}};}};
 const w=await readWeekSignals({existingClient:{dbName:'shop'}},{days:7},{client});assert.equal(w.distinctQueries,1);assert.equal(w.days,7);
 await assert.rejects(readWeekSignals({existingClient:{dbName:'shop'}},{days:31},{client}));
});

const lexical=(p,profile)=>query=>{const r=createIndexRetriever(p.productCards,{...profile,tenantId:p.id},p.searchIndex)(query);return {...r,metadata:{phase:'lexical',llmUsed:false}};};
const shop=()=>existingProject('shop',{dbName:'shop'},[{id:'1',name:'יומן',author:'הלן בר',stockStatus:'instock'},{id:'2',name:'יומן התינוקת שלי',stockStatus:'instock'},{id:'3',name:'הארי פוטר ואבן החכמים',stockStatus:'instock'}]);
const row=(query,searches,extra={})=>({query,searches,searchSessions:searches,clicks:0,carts:0,purchases:0,zeroResults:0,measuredResults:searches,refinedSessions:0,cartRate:0,...extra});
const weekOf=async()=>({...summarizeWeek({window:{from:'a',to:'b'},totals:{searches:39,clicks:60,carts:4,purchases:2},purchaseTrackingEvidence:true,complete:true,warnings:[],queries:[row('הארי פוטר',30,{clicks:60,carts:4,purchases:2}),row('יומן',9)]}),days:7});
const judge=async prompt=>{const d=JSON.parse(prompt.slice(prompt.lastIndexOf('DATA ')+5)),c=d.results[0];
 return {queries:[{query:c.query,returned:c.returned.map(x=>({id:x.id,verdict:c.query==='יומן'&&x.id==='1'?'unwanted':'wanted'})),missing:[]}],summary:'x'};};
const services={createSearch:lexical,database:{clicks:async()=>({clicks:0,products:[]})}};
test('a weekly run fixes the unclicked query, reports the scan and does not recheck it next time',async()=>{
 const good=async prompt=>prompt.includes('TOOL RESULTS []')?{tools:[{name:'link_term',term:'יומן',mode:'only',productIds:['2']}]}:{message:'צומצם',verify:['יומן']};
 const next=await auditSearches(shop(),{model:good,judge,fix:true,source:'week',week:weekOf,services});
 const r=Object.fromEntries(next.audit.results.map(x=>[x.query,x]));
 assert.deepEqual(r['יומן'].reasons,['noClicks']);assert.equal(r['יומן'].fix.status,'fixed');assert.deepEqual(r['הארי פוטר'].reasons,['top']);assert.equal(next.revisions.length,2);
 const text=next.messages.at(-1).text;assert.match(text,/סריקת 7 הימים האחרונים:\*\* 2 שאילתות שונות ב־39 חיפושים; ב־1 מהן/);assert.match(text,/בלי קליקים: 1 שאילתות \(9 חיפושים\)/);assert.match(next.messages.at(-2).text,/חיפושי 7 הימים האחרונים/);
 assert.deepEqual(Object.values(next.weeklyReview.checked).map(v=>v.status).sort(),['fixed','ok']);assert.equal(next.audit.source,'week');
 await assert.rejects(auditSearches(next,{model:good,judge,fix:true,source:'week',week:weekOf,services}),/כבר נבדקו/);
});
test('the agent reads the same scan as a worklist',async()=>{
 const r=await tools.weekly_scan.run({p:shop(),services:{week:weekOf}},{});
 assert.deepEqual(r.worklist.map(c=>c.query),['יומן','הארי פוטר']);assert.equal(r.queries,undefined);assert.match(tools.weekly_scan.say({},r),/2 שאילתות שונות · 1 עם משפך שבור/);
});
