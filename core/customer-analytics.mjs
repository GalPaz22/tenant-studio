import {MongoClient} from 'mongodb';
const key=v=>typeof v==='string'?v.trim().toLowerCase().replace(/\s+/g,' '):'';
const session=r=>String(r.session_id||r.sessionId||'');
const time=r=>new Date(r.timestamp||r.created_at).getTime();
export function analyticsOptions(a={},now=Date.now()){
 const days=Number(a.days??30),limit=Number(a.limit??15),minSearches=Number(a.minSearches??20);
 if(!Number.isInteger(days)||days<1||days>90||!Number.isInteger(limit)||limit<1||limit>30||!Number.isInteger(minSearches)||minSearches<1||minSearches>100000)throw Error('days: 1–90; limit: 1–30; minSearches: 1–100000');
 const to=a.to?new Date(a.to):new Date(now),from=a.from?new Date(a.from):new Date(to.getTime()-days*864e5);
 if(!Number.isFinite(+from)||!Number.isFinite(+to)||from>=to||to-from>90*864e5||+to>now+60000)throw Error('טווח תאריכים לא תקין (עד 90 ימים, ללא תאריכים עתידיים)');
 if(a.query!==undefined&&(typeof a.query!=='string'||a.query.length>300))throw Error('שאילתה לא תקינה');
 const sort=a.sort||'low_conversion';if(!['low_conversion','searches','purchases','carts','clicks'].includes(sort))throw Error('סדר לא תקין');
 return {from:from.toISOString(),to:to.toISOString(),limit,minSearches,query:key(a.query),sort};
}
// Raw sessions stay inside this function; only aggregate, tenant-scoped evidence reaches the model.
export function summarizeCustomer({queries=[],clicks=[],carts=[],purchases=[]},options,{sources={},cards=[]}={}){
 const groups=new Map(),timeline=new Map(),products=new Map(),seenOrders=new Set();
 const get=q=>{q=key(q);if(!q)return null;if(!groups.has(q))groups.set(q,{query:q,searches:0,clicks:0,carts:0,purchases:0,explicitPurchases:0,inferredPurchases:0,zeroResults:0,measuredResults:0,sessions:new Set(),converted:new Set(),carted:new Set(),clicked:new Set()});return groups.get(q);};
 const inWindow=r=>time(r)>=Date.parse(options.from)&&time(r)<Date.parse(options.to);
 queries=queries.filter(inWindow);clicks=clicks.filter(inWindow);carts=carts.filter(inWindow);purchases=purchases.filter(inWindow);
 for(const r of queries){const g=get(r.query);if(!g)continue;g.searches++;const s=session(r);if(s){g.sessions.add(s);if(!timeline.has(s))timeline.set(s,[]);timeline.get(s).push({q:g.query,t:time(r)});}const n=r.resultCount??r.resultsCount??r.totalResults??r.delivered;if(typeof n==='number'){g.measuredResults++;if(n===0)g.zeroResults++;}}
 const queryTimeline=new Map();
 for(const [sid,list] of timeline){list.sort((a,b)=>a.t-b.t);const byQuery=new Map();for(const item of list){if(!byQuery.has(item.q))byQuery.set(item.q,[]);byQuery.get(item.q).push(item);}queryTimeline.set(sid,byQuery);}
 const preceding=(list,t)=>{let low=0,high=list.length;while(low<high){const mid=(low+high)>>>1;if(list[mid].t<=t)low=mid+1;else high=mid;}const item=list[low-1];return item&&t-item.t<=864e5?item:null;};
 const attribute=r=>{const explicit=key(r.search_query||r.query);if(explicit)return {q:explicit,kind:'explicit'};
  const before=preceding(timeline.get(session(r))||[],time(r));return before?{q:before.q,kind:'inferred'}:null;};
 const matchedSearch=(r,q)=>!!preceding(queryTimeline.get(session(r))?.get(q)||[],time(r));
 const revenue=new Map();
 const totals={searches:queries.length,clicks:clicks.length,carts:carts.length,purchases:0,unattributedPurchases:0,explicitPurchases:0,inferredPurchases:0,duplicateOrders:0};
 for(const [kind,rows] of [['clicks',clicks],['carts',carts],['purchases',purchases]])for(const r of rows){
  if(kind==='purchases'){
   if(r.event_type&&r.event_type!=='checkout_completed')continue;
   // Order webhooks without event_type are logged as orders; exclude known unpaid/refunded/cancelled states.
   const status=r.shopify_data?.financial_status||r.financial_status||r.status;
   if(status&& !['paid','completed','processing','partially_refunded'].includes(status))continue;
   if(!r.event_type&&!(r.order_id&&(Array.isArray(r.line_items)||Array.isArray(r.cart_items))))continue;
   if(r.order_id){const id=String(r.order_id);if(seenOrders.has(id)){totals.duplicateOrders++;continue;}seenOrders.add(id);}totals.purchases++;
   if(r.total_price!==null&&r.total_price!==undefined&&Number.isFinite(Number(r.total_price))&&typeof r.currency==='string'&&/^[A-Z]{3}$/.test(r.currency)){const entry=revenue.get(r.currency)||{currency:r.currency,amount:0,orders:0};entry.amount+=Number(r.total_price);entry.orders++;revenue.set(r.currency,entry);}
  }
  const attribution=attribute(r),g=attribution?get(attribution.q):null;
  if(g){g[kind]++;if(kind==='purchases'){g[attribution.kind+'Purchases']++;totals[attribution.kind+'Purchases']++;}
   const s=session(r);if(s&&matchedSearch(r,g.query))g[kind==='purchases'?'converted':kind==='carts'?'carted':'clicked'].add(s);
  }else if(kind==='purchases')totals.unattributedPurchases++;
  if(options.query&&g?.query!==options.query)continue;
  const items=kind==='purchases'?(r.line_items||r.cart_items||[]):[r];
  for(const item of items){const id=String(item.product_id??item.id??'');if(!id)continue;const p=products.get(id)||{id,clicks:0,carts:0,purchases:0};p[kind]++;products.set(id,p);}
 }
 const complete=Object.values(sources).every(s=>s.status==='ok'&&!s.truncated);
 const searchMissing=clicks.length>0&&!queries.length;
 const purchaseTrackingEvidence=[...groups.values()].some(g=>g.converted.size>0);
 const rows=[...groups.values()].map(g=>({query:g.query,searches:g.searches,searchSessions:g.sessions.size,clicks:g.clicks,carts:g.carts,purchases:g.purchases,explicitPurchases:g.explicitPurchases,inferredPurchases:g.inferredPurchases,convertedSearchSessions:g.converted.size,zeroResults:g.zeroResults,measuredResults:g.measuredResults,
  purchaseRate:complete&&purchaseTrackingEvidence&&g.sessions.size?g.converted.size/g.sessions.size:null,cartRate:complete&&g.sessions.size?g.carted.size/g.sessions.size:null,clickRate:complete&&g.sessions.size?g.clicked.size/g.sessions.size:null}));
 const eligible=rows.filter(r=>options.query?r.query===options.query:options.sort==='low_conversion'?r.searchSessions>=options.minSearches&&r.purchaseRate!==null:r.searches>0||r.purchases>0||r.clicks>0||r.carts>0);
 eligible.sort(options.sort==='low_conversion'?(a,b)=>a.purchaseRate-b.purchaseRate||b.searchSessions-a.searchSessions:(a,b)=>b[options.sort]-a[options.sort]);
 const byId=new Map(cards.map(c=>[String(c.id),c]));
 return {window:{from:options.from,to:options.to},sources,complete,totals,recordedOrderRevenue:[...revenue.values()].map(r=>({...r,amount:Math.round(r.amount*100)/100})),purchaseTrackingEvidence,purchaseAttributionCoverage:totals.purchases?(totals.explicitPurchases+totals.inferredPurchases)/totals.purchases:null,queries:eligible.slice(0,options.limit),matchingQueries:eligible.length,
  products:[...products.values()].sort((a,b)=>b.purchases-a.purchases||b.carts-a.carts||b.clicks-a.clicks).slice(0,options.limit).map(p=>{const c=byId.get(p.id);return {...p,title:c?.title||c?.name||null,inCatalog:!!c,available:!!c&&!c.hidden&&c.stockStatus==='instock'};}),
  methodology:{rate:'Distinct search sessions with a later attributed event / distinct search sessions for that query. Repeated searches in one session count once.',attribution:'Explicit query first; otherwise last preceding search in the same session within 24h (inferred, not proof). Orders deduplicated by order_id. Events without a matching search session contribute counts, never the rate.',minSearchSessions:options.minSearches,scope:'Recorded events in a bounded window, not all store sales; cohorts near the end have less time to convert. Product purchase counts are order-line occurrences, not quantities. Revenue is recorded order total by currency for orders with a valid amount/currency; not net revenue, refund-adjusted revenue or query-attributed revenue.',privacy:'No customer identities, contact details or raw session IDs returned.'},
  warnings:[...(totals.unattributedPurchases?[`${totals.unattributedPurchases} מתוך ${totals.purchases} רכישות ללא שיוך לשאילתה; שיעורי ההמרה מתארים רק רכישות מיוחסות, ולא את כלל המכירות.`]:[]),...(!complete?['נתונים חלקיים או מקור שנכשל: אין לחשב שיעור המרה או להציג את הספירות כמלאות.']:[]),...(searchMissing?['יש קליקים ללא רישום חיפושים בטווח; אין מכנה אמין להמרה.']:[]),...(!purchaseTrackingEvidence?['אין רכישות שניתן להתאים לסשן חיפוש בטווח; אין בסיס לדירוג המרה לרכישה. אין להסיק שאין מכירות.']:[]),...(rows.some(r=>r.searches&&!r.searchSessions)?['לחלק מהשאילתות חסרים מזהי סשן; אין עבורן שיעור המרה.']:[])]};
}
export function compactAnalytics(report,maxChars=5800){
 const out={...report,queries:[...report.queries],products:[...report.products]};
 let clipped=false;
 while(JSON.stringify(out).length>maxChars&&(out.queries.length>1||out.products.length)){
  if(out.products.length)out.products.pop();else out.queries.pop();clipped=true;
 }
 if(clipped)out.outputLimit={shownQueries:out.queries.length,matchingQueries:report.matchingQueries,note:'Use query for drilldown; output shortened, underlying source coverage is unchanged.'};
 return out;
}
export async function readCustomerAnalytics(p,args={},deps={}){
 const options=analyticsOptions(args);if(!p.existingClient?.dbName)throw Error('נדרש לקוח מחובר למסד dashboard');
 let client=deps.client;
 if(!client){const uri=process.env.STUDIO_DASHBOARD_MONGODB_URI||process.env.MONGODB_URI;if(!uri)throw Error('חסר חיבור למסד');client=new MongoClient(uri,{serverSelectionTimeoutMS:8000});}
 try{if(!deps.client)await client.connect();const db=client.db(p.existingClient.dbName),sources={},data={queries:[],clicks:[],carts:[],purchases:[]};
  const sourceList=[['queries','queries'],['product_clicks','clicks'],['product_click_events','clicks'],['cart','carts'],['add_to_cart_events','carts'],['checkout_events','purchases']];
  const projection={_id:0,query:1,search_query:1,session_id:1,sessionId:1,timestamp:1,created_at:1,event_type:1,order_id:1,product_id:1,resultCount:1,resultsCount:1,totalResults:1,'shopify_data.financial_status':1,financial_status:1,status:1,total_price:1,currency:1,'line_items.product_id':1,'cart_items.product_id':1};
  await Promise.all(sourceList.map(async([name,kind])=>{
   // Convert both ISO strings and BSON dates; a single half-open window also excludes future events.
   const date={$convert:{input:{$ifNull:['$timestamp','$created_at']},to:'date',onError:null,onNull:null}};
   const filter={$expr:{$and:[{$gte:[date,new Date(options.from)]},{$lt:[date,new Date(options.to)]}]},...(name==='cart'?{event_type:'add_to_cart'}:{})};
   try{const rows=await db.collection(name).aggregate([{$match:filter},{$sort:{_id:-1}},{$limit:50001},{$project:{...projection,...(kind==='queries'?{delivered:{$cond:[{$isArray:'$deliveredProducts'},{$size:'$deliveredProducts'},null]}}:{})}}],{maxTimeMS:20000}).toArray();sources[name]={status:'ok',rows:Math.min(rows.length,50000),truncated:rows.length>50000};data[kind].push(...rows.slice(0,50000));}
   catch{sources[name]={status:'unavailable',rows:null,truncated:false};}
  }));return summarizeCustomer(data,options,{sources,cards:p.productCards||[]});
 }finally{if(!deps.client)await client.close();}
}
