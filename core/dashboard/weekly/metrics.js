import { reportGate } from '../analytics/work-limit.js';
import { tenantDb } from '../core/db.js';
import { loadStoreEvents, DAY_MS, normalizeQuery } from '../analytics/events.js';
import { measuredConversion } from '../analytics/measurement.js';
import { storeFunnel, queryFunnel, uniquePurchases, SessionTimeline, WINDOWS } from '../analytics/conversion.js';
import { searchBusiness } from '../analytics/search-business.js';

export function wilson(successes,n){if(!n)return null;const z=1.95996398454,p=successes/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return [Math.max(0,c-h),Math.min(1,c+h)];}
// Only sessions with a completed attribution window enter rate denominators.
// Match events after each session's OWN first exposure, never the global start.
export function experimentMetrics(exposures,events,exp,{now=Date.now(),truncated=false}={}){
 const unique=new Map(),contaminated=new Set(),queries=new Set(exp.targeting.patterns.map(normalizeQuery));
 const end=exp.endedAt?+new Date(exp.endedAt):now,start=+new Date(exp.startedAt||exp.createdAt);
 for(const e of exposures){const t=+new Date(e.timestamp),s=e.session_id;if(!s||t<start||t>end||!queries.has(normalizeQuery(e.query))||!exp.arms.some(a=>a.key===e.arm))continue;const previous=unique.get(s);if(previous&&previous.arm!==e.arm)contaminated.add(s);if(!previous||t<previous.t)unique.set(s,{s,t,arm:e.arm,features:e.serpFeatures||[]});}
 for(const s of contaminated)unique.delete(s);
 const timeline=new SessionTimeline(events.queries),measured=measuredConversion(events,storeFunnel(events),queryFunnel(events));
 const primary=exp.primaryMetric||'cart',complete=measured.funnel.rates[primary]!==null&&!truncated;
 const collections={click:events.clicks,cart:events.carts,purchase:uniquePurchases(events.purchases).list};
 const rows=exp.delivery==='all'?exp.arms.filter(a=>a.key==='v1'):exp.arms;
 const arms=rows.map(a=>{
   const sessions=[...unique.values()].filter(e=>e.arm===a.key),mature=sessions.filter(e=>e.t+DAY_MS<=now),ids=new Set(mature.map(e=>e.s));
   const converted=new Set();
   for(const event of collections[primary]||[]){const exposure=unique.get(event.s);if(!exposure||!ids.has(event.s)||event.t<exposure.t||event.t>exposure.t+WINDOWS[primary])continue;const q=event.q||timeline.preceding(event.s,event.t,WINDOWS[primary])?.q;if(!q||!queries.has(q)||!timeline.searched(event.s,q,event.t,WINDOWS[primary]))continue;converted.add(event.s);}
   const n=mature.length,k=converted.size,rate=complete&&n?k/n:null;
   return {key:a.key,exposures:sessions.length,sessions:n,pending:sessions.length-n,conversions:complete?k:null,rate,interval:rate===null?null:wilson(k,n),presentationConfirmed:sessions.filter(e=>e.features.includes('weekly-serp-v1')).length};
 });
 let comparison=null;const control=arms.find(a=>a.key==='control'),variant=arms.find(a=>a.key==='v1');
 if(control?.rate!==null&&variant?.rate!==null&&control&&variant){const ci=[variant.interval[0]-control.interval[1],variant.interval[1]-control.interval[0]],sufficient=control.sessions>=100&&variant.sessions>=100&&control.conversions+variant.conversions>=20;comparison={difference:variant.rate-control.rate,relativeLift:control.rate?variant.rate/control.rate-1:null,interval:ci,sufficient,signal:sufficient&&ci[0]>0?'positive':sufficient&&ci[1]<0?'negative':'inconclusive'};}
 const patches=[...exp.arms.map(a=>a.patch||{}),...exp.arms.flatMap(a=>(a.patch?.queryPatches||[]).map(q=>q.patch))],presentationRequired=patches.some(p=>p.productNotes?.length||p.productBundles?.length);
 const business=searchBusiness(events,unique,{now,patterns:queries,truncated,keys:rows.map(a=>a.key)});
 return {business,presentationRequired,mode:exp.delivery==='all'?'observational':'randomized',primaryMetric:primary,asOf:new Date(now),arms,comparison,complete,excludedContaminated:contaminated.size,coverage:measured.funnel.coverage,sourceWarnings:Object.entries(events.sources).filter(([,v])=>v.status!=='ok'||v.truncated).map(([source,v])=>({source,status:v.status,truncated:!!v.truncated})),reason:!complete?'אין כיסוי מדידה מלא למדד שנבחר. אירועים חסרים אינם אפס המרות.':!unique.size?'טרם נרשמו חשיפות עם מזהה ביקור משותף לחיפוש ולמעקב.':'ביקורים נכנסים לשיעור ההמרה לאחר 24 שעות. זיהוי מכשירים וביקורים שונים אינו מאוחד; אין קביעה אוטומטית של מנצח.'};
}
const cache=new Map(),pending=new Map();
export async function loadExperimentMetrics(exp){
 const key=String(exp._id)+':'+exp.status+':'+String(exp.endedAt||''),hit=cache.get(key);if(hit&&Date.now()-hit.at<30000)return hit.value;if(pending.has(key))return pending.get(key);
 const run=reportGate.run(async()=>{const db=await tenantDb(exp.dbName),from=new Date(Math.max(+new Date(exp.startedAt||exp.createdAt),(exp.endedAt?+new Date(exp.endedAt):Date.now())-28*DAY_MS)),end=exp.endedAt?new Date(+new Date(exp.endedAt)+DAY_MS):new Date();
 const exposures=[];const cursor=db.collection('experiment_exposures').find({experiment_id:String(exp._id),timestamp:{$gte:from,$lte:end}},{projection:{session_id:1,arm:1,query:1,timestamp:1,serpFeatures:1},maxTimeMS:15000}).sort({timestamp:1}).limit(50001);for await(const e of cursor)exposures.push(e);
 const events=await loadStoreEvents(exp.dbName,from,end);const value={...experimentMetrics(exposures,events,exp,{truncated:exposures.length>50000}),windowFrom:from,windowTo:end};cache.set(key,{at:Date.now(),value});while(cache.size>4)cache.delete(cache.keys().next().value);return value;
 });pending.set(key,run);try{return await run;}finally{pending.delete(key);}
}
