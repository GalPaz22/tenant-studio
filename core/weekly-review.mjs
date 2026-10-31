import {readCustomerEvents,summarizeCustomer} from './customer-analytics.mjs';
import {normalize} from './core.mjs';

// The last days of shopper searches as a worklist: EVERY distinct query of the window (not a top-N sample) is scanned
// and flagged by where its funnel breaks — no results, no click, clicked but never added to cart, interest but no
// purchase, searched again right away. Read fresh on every run, so the list follows what shoppers do now.
export const WEEK_ISSUES=['zero','noClicks','noCart','noPurchase','refined'];
const SKIP_MS=7*864e5;
export function summarizeWeek(report,{minSearches=2}={}){
 const clickTracking=report.totals.clicks>0,cartTracking=report.totals.carts>0,purchaseTracking=!!report.purchaseTrackingEvidence;
 const queries=report.queries.filter(q=>q.searches>0).map(q=>{
  const issues=[],repeated=q.searches>=minSearches,engaged=q.clicks+q.carts>0;
  if(q.zeroResults>0)issues.push('zero');
  if(clickTracking&&repeated&&!engaged&&!q.purchases&&q.zeroResults<q.searches)issues.push('noClicks');
  // Without purchase events "no purchase" is unknown, not a finding.
  if(repeated&&engaged&&!q.purchases){if(cartTracking&&!q.carts)issues.push('noCart');else if(purchaseTracking)issues.push('noPurchase');}
  if(q.refinedSessions>=2&&q.refinedSessions/q.searchSessions>=.3)issues.push('refined');
  return {query:q.query,searches:q.searches,sessions:q.searchSessions,zeroResults:q.zeroResults,clicks:q.clicks,carts:q.carts,...(purchaseTracking&&{purchases:q.purchases}),refinedSessions:q.refinedSessions,
   ...(cartTracking&&{cartRate:q.cartRate??Math.min(1,q.carts/q.searches)}),issues};
 }).sort((a,b)=>b.searches-a.searches);
 const flagged=queries.filter(q=>q.issues.length);
 return {from:report.window.from,to:report.window.to,sampledSearches:report.totals.searches,distinctQueries:queries.length,totals:report.totals,clickTracking,cartTracking,purchaseTracking,complete:report.complete,warnings:report.warnings,
  issues:Object.fromEntries(WEEK_ISSUES.map(k=>[k,{queries:flagged.filter(q=>q.issues.includes(k)).length,searches:flagged.filter(q=>q.issues.includes(k)).reduce((n,q)=>n+q.searches,0)}])),
  flaggedQueries:flagged.length,flaggedSearches:flagged.reduce((n,q)=>n+q.searches,0),queries};
}
// Queries a recent run already found fine, fixed or unfixable by search rules are not rechecked for a week, so each
// run moves on to what is still open; unresolved problems come back.
export function recentlyReviewed(p,now=Date.now()){
 return new Set(Object.entries(p.weeklyReview?.checked||{}).filter(([,v])=>['ok','fixed','data-gap'].includes(v.status)&&now-Date.parse(v.at)<SKIP_MS).map(([k])=>k));
}
export function recordReview(p,results,now=Date.now()){
 const checked={...p.weeklyReview?.checked},at=new Date(now).toISOString();
 for(const r of results)checked[normalize(r.query)]={at,status:r.fix?.status==='fixed'?'fixed':r.status};
 p.weeklyReview={at,checked:Object.fromEntries(Object.entries(checked).filter(([,v])=>now-Date.parse(v.at)<2*SKIP_MS).sort((a,b)=>b[1].at.localeCompare(a[1].at)).slice(0,500))};
}
// Broken funnels first, taking turns between the kinds of problem (most searched first in each); a fifth of the
// places goes to the most searched queries without a flag, so a bad result that shoppers still click is caught too.
export function weeklyCandidates(week,{limit=20,skip=new Set()}={}){
 const open=week.queries.filter(q=>!skip.has(normalize(q.query))),picked=new Map();
 const add=(q,reasons)=>picked.set(normalize(q.query),{query:q.query,reasons,searches:q.searches,zeroResults:q.zeroResults,clicks:q.clicks,carts:q.carts,...(q.purchases!==undefined&&{purchases:q.purchases}),...(q.cartRate!==undefined&&{cartRate:q.cartRate})});
 const lists=WEEK_ISSUES.map(k=>open.filter(q=>q.issues.includes(k))),top=open.filter(q=>!q.issues.length),reserved=Math.min(top.length,Math.floor(limit/5));
 const flagged=max=>{for(let i=0;picked.size<max&&lists.some(l=>i<l.length);i++)for(const l of lists){const q=l[i];if(q&&picked.size<max&&!picked.has(normalize(q.query)))add(q,q.issues);}};
 flagged(limit-reserved);
 for(const q of top){if(picked.size>=limit)break;add(q,['top']);}
 return [...picked.values()];
}
export async function readWeekSignals(p,{days=7,now=Date.now()}={},deps={}){
 if(!Number.isInteger(days)||days<1||days>30)throw Error('טווח ימים: 1–30');
 const options={from:new Date(now-days*864e5).toISOString(),to:new Date(now).toISOString(),limit:Infinity,minSearches:1,query:'',sort:'searches'};
 const {data,sources}=await readCustomerEvents(p,options,deps);
 return {...summarizeWeek(summarizeCustomer(data,options,{sources})),days};
}
