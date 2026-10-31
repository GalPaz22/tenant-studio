import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeGrowth } from './core/dashboard/growth/analysis.js';
import { searchBusiness } from './core/dashboard/analytics/search-business.js';
import { experimentMetrics } from './core/dashboard/weekly/metrics.js';
import { scanGrowth, configureGrowth, growthState, tickGrowthMonitors, projectGrowthStore } from './core/dashboard/growth/service.js';
import { configureDashboardStorage } from './core/dashboard/core/db.js';
const DAY = 86400000, now = Date.UTC(2026, 9, 23), base = now - 3 * DAY;
const sources = () => Object.fromEntries(['queries','product_clicks','cart','checkout_events'].map(k => [k, { status:'ok', truncated:false }]));
function fixture() {
  const ev = { queries:[], clicks:[], carts:[], checkouts:[], purchases:[], sources:sources() };
  for (let i=0;i<12;i++) ev.queries.push({ q:i<6?'coffee':'tea', s:'s'+i, t:base, names:['machine'], zero:false });
  for (let i=0;i<6;i++) {
    ev.clicks.push({ q:'tea', s:'s'+(i+6), t:base+1000 });
    ev.carts.push({ q:'tea', s:'s'+(i+6), t:base+2000 });
  }
  ev.purchases.push({ s:'s6', q:'tea', t:base+3000, orderId:'o1', total:120, currency:'ILS', items:[] });
  return ev;
}
function assignments() { return new Map(Array.from({ length:12 }, (_,i) => ['s'+i, { t:base, arm:i<6?'control':'v1' }])); }

test('business metrics deduplicate orders, include zero revenue sessions and attribute once after exposure', () => {
  const ev=fixture(); ev.purchases.push({...ev.purchases[0]}, { ...ev.purchases[0], orderId:'old', t:base-1 }, { ...ev.purchases[0], orderId:'late', t:base+DAY+1 }, { ...ev.purchases[0], orderId:'elsewhere', q:'unseen' });
  const m=searchBusiness(ev,assignments(),{now,patterns:new Set(['coffee','tea'])});
  assert.equal(m.complete,true); assert.equal(m.arms[0].purchaseRate,0);
  assert.equal(m.arms[0].revenue[0].revenuePerSearchSession,0);
  assert.equal(m.arms[0].revenue[0].averageOrder,null);
  assert.equal(m.arms[1].orders,1); assert.equal(m.arms[1].revenue[0].amount,120);
  assert.equal(m.arms[1].revenue[0].averageOrder,120); assert.equal(m.arms[1].revenue[0].revenuePerSearchSession,20);
  assert.equal(m.comparison.difference,20); assert.equal(m.comparison.signal,'inconclusive');
  assert.ok(!JSON.stringify(m).includes('s6'));
});

test('missing money or order identity suppresses business inference instead of partial totals', () => {
  for (const patch of [{total:null},{total:-1},{currency:null},{orderId:null}]) {
    const ev=fixture(); Object.assign(ev.purchases[0],patch);
    const m=searchBusiness(ev,assignments(),{now});
    assert.equal(m.complete,false); assert.equal(m.arms[1].purchaseRate,1/6);
    assert.ok(m.arms[1].revenue.every(r=>r.amount===null)); assert.equal(m.comparison,null);
  }
});

test('different currencies are never added or divided by a shared session denominator', () => {
  const ev=fixture(); ev.purchases.push({...ev.purchases[0], orderId:'usd',total:30,currency:'USD'});
  const m=searchBusiness(ev,assignments(),{now});
  assert.equal(m.comparison,null); assert.deepEqual(m.currencies,['ILS','USD']);
  assert.deepEqual(m.arms[1].revenue.map(r=>r.averageOrder),[120,30]);
  assert.ok(m.arms[1].revenue.every(r=>r.revenuePerSearchSession===null));
});

test('24h maturity and original tracking quality gate both experiment money and opportunity rates', () => {
  const ev=fixture(),a=assignments();a.set('s6',{t:now-1000,arm:'v1'});
  let m=searchBusiness(ev,a,{now}); assert.equal(m.arms[1].pending,1);assert.equal(m.arms[1].orders,0);
  ev.sources.checkout_events.truncated=true;m=searchBusiness(ev,assignments(),{now});assert.equal(m.arms[0].purchaseRate,null);assert.equal(m.complete,false);
  ev.sources.checkout_events.truncated=false;
  for(let i=0;i<50;i++)ev.queries.push({q:'missing',s:null,t:base,names:[],zero:true});
  const g=analyzeGrowth(ev,{now});assert.equal(g.summary.rates.purchase,null);assert.ok(g.opportunities.every(o=>o.purchaseRate===null));
});

test('growth distinguishes failed results, no-click and reformulation, without classifying typing as failure', () => {
  const ev=fixture();ev.queries.push({q:'coff',s:'s0',t:base-3000,names:[],zero:true},{q:'espresso',s:'s0',t:base+1000,names:[],zero:true});
  const g=analyzeGrowth(ev,{now}),coffee=g.opportunities.find(o=>o.query==='coffee');
  assert.ok(coffee.signals.some(s=>s.kind==='no_click')); assert.ok(coffee.signals.some(s=>s.kind==='reformulated'));
  assert.ok(!g.opportunities.find(o=>o.query==='coff').signals.some(s=>s.kind==='reformulated'));
  assert.ok(g.opportunities.find(o=>o.query==='espresso').signals.some(s=>s.kind==='zero_results'));
  assert.equal(g.summary.rates.purchase,1/12);assert.equal(g.business.arms[0].revenue[0].revenuePerSearchSession,10);
  ev.sources.queries.truncated=true;const partial=analyzeGrowth(ev,{now});assert.equal(partial.coverage.complete,false);assert.equal(partial.opportunities.length,0);
});

test('one reliable purchase outside the mature cohort allows a measured zero inside it', () => {
  const ev=fixture();ev.purchases=[];ev.queries.push({q:'tea',s:'fresh',t:now-2000,names:[],zero:false});
  ev.purchases.push({q:'tea',s:'fresh',t:now-1000,orderId:'fresh-order',currency:'ILS',total:90,items:[]});
  const g=analyzeGrowth(ev,{now});assert.equal(g.summary.rates.purchase,0);assert.equal(g.summary.pendingSessions,1);
  assert.equal(g.business.arms[0].revenue[0].amount,0);
});

test('experiment excludes conflicting assignments from monetary and conversion denominators alike', () => {
  const ev=fixture(),exp={startedAt:new Date(base),primaryMetric:'cart',targeting:{patterns:['coffee','tea']},arms:[{key:'control'},{key:'v1'}],delivery:'randomized'};
  const exposure=[...assignments()].map(([s,a])=>({session_id:s,timestamp:new Date(a.t),query:s==='s6'?'tea':'coffee',arm:a.arm}));
  exposure.push({...exposure[6],arm:'control'});
  const m=experimentMetrics(exposure,ev,exp,{now});assert.equal(m.excludedContaminated,1);assert.equal(m.business.arms[1].sessions,5);assert.equal(m.business.arms[1].orders,0);
});

function memory() {
  const rows=[];
  const matches=(r,f)=>Object.entries(f).every(([k,v])=>k==='$or'?v.some(x=>matches(r,x)):v&&typeof v==='object'&&!(v instanceof Date)?Object.entries(v).every(([op,w])=>op==='$exists'?(r[k]!==undefined)===w:op==='$lte'?+r[k]<=+w:op==='$ne'?r[k]!==w:false):r[k]===v);
  const col={async createIndex(){},async findOne(f){return rows.find(r=>matches(r,f))||null;},async updateOne(f,u,{upsert=false}={}){let r=rows.find(r=>matches(r,f));const insert=!r;if(!r&&upsert){r={dbName:f.dbName};rows.push(r);}if(!r)return {matchedCount:0};Object.assign(r,insert?u.$setOnInsert:{},u.$set);for(const k of Object.keys(u.$unset||{}))delete r[k];return {matchedCount:1};}};
  return {rows,mongo:{db:()=>({collection:()=>col})}};
}

test('monitor opt-in is tenant scoped, scans coalesce, and failures retain the last good report',async()=>{
  const f=memory();configureDashboardStorage({mongo:f.mongo,redis:null});
  try {
    await assert.rejects(configureGrowth({dbName:'own'},'true'),/בוליאני/);
    await configureGrowth({dbName:'own'},true);assert.equal((await growthState({dbName:'other'})).enabled,false);
    let calls=0,release;const wait=new Promise(resolve=>release=resolve);
    const loadEvents=async()=>{calls++;await wait;return fixture();};
    const a=scanGrowth({dbName:'own'},{now,loadEvents}),b=scanGrowth({dbName:'own'},{now,loadEvents});release();
    await Promise.all([a,b]);assert.equal(calls,1);assert.equal(f.rows[0].status,'ready');
    const previous=f.rows[0].report;
    await assert.rejects(scanGrowth({dbName:'own'},{now:now+1,loadEvents:async()=>{throw Error('offline');}}));
    assert.equal(f.rows[0].report,previous);assert.equal(f.rows[0].status,'failed');
    await configureGrowth({dbName:'own'},false);await tickGrowthMonitors();assert.equal(f.rows[0].enabled,false);
    assert.ok(!('dbName' in await growthState({dbName:'own'})));
    await assert.rejects(projectGrowthStore({}),/לחבר/);
  } finally {configureDashboardStorage(null);}
});

test('authenticated growth routes derive the store from the session, ignoring a forged body or query database',async()=>{
  const {default:express}=await import('express');
  const {installCustomerDashboard}=await import('./core/customer-dashboard.mjs');
  const old=process.env.STUDIO_CUSTOMER_API_TOKEN;process.env.STUDIO_CUSTOMER_API_TOKEN='growth-fixture';
  const f=memory(),app=express();app.use(express.json());
  const close=await installCustomerDashboard(app,{operations:{},storage:{mongo:f.mongo,redis:null},resolveTenant:async key=>key==='owned-key'?{dbName:'owned-store',apiKey:key}:null});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const url=`http://127.0.0.1:${server.address().port}/api/customer-dashboard/optimization/search-growth`;
  try{
    const denied=await fetch(url+'/settings?tenant=owned-key',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({enabled:true})});assert.equal(denied.status,401);
    const response=await fetch(url+'/settings?tenant=owned-key&dbName=foreign',{method:'POST',headers:{'content-type':'application/json','X-Studio-Customer-Token':'growth-fixture'},body:JSON.stringify({enabled:true,dbName:'foreign',apiKey:'foreign-key'})});
    assert.equal(response.status,200);assert.equal((await response.json()).enabled,true);
    assert.equal(f.rows.length,1);assert.equal(f.rows[0].dbName,'owned-store');
    const foreign=await fetch(url+'?tenant=foreign-key',{headers:{'X-Studio-Customer-Token':'growth-fixture'}});assert.equal(foreign.status,401);
  }finally{close();await new Promise(r=>server.close(r));configureDashboardStorage(null);if(old===undefined)delete process.env.STUDIO_CUSTOMER_API_TOKEN;else process.env.STUDIO_CUSTOMER_API_TOKEN=old;}
});

test('direct cart or purchase actions are engagement even without a product click',()=>{
  const ev=fixture();ev.clicks=[];
  for(let i=0;i<6;i++)ev.carts.push({q:'coffee',s:'s'+i,t:base+1000});
  const g=analyzeGrowth(ev,{now});assert.ok(!g.opportunities.some(o=>o.signals.some(s=>s.kind==='no_click')));
});

test('monetary and headline purchase conversion share exact matched-query attribution',()=>{
  const ev=fixture();ev.purchases.push({...ev.purchases[0],s:'s7',q:'not-searched',orderId:'unrelated'});
  const g=analyzeGrowth(ev,{now});assert.equal(g.summary.rates.purchase,g.business.arms[0].purchaseRate);assert.equal(g.summary.rates.purchase,1/12);
  ev.queries.push({q:'espresso',s:'s0',t:base+1000,zero:true,names:[]});
  const coffee=analyzeGrowth(ev,{now}).opportunities.find(o=>o.query==='coffee');
  assert.deepEqual(coffee.refinements,[{query:'espresso',sessions:1}]);
});
