// Read-only store-wide growth analysis. Exports aggregate metrics, never raw identities.
// Run: node --env-file=.env scripts/beautics-growth-analysis.mjs
import { MongoClient } from 'mongodb';
import { writeFile } from 'node:fs/promises';
import { parseTime, isPurchase, orderTotal, queryProjection } from '../core/dashboard/analytics/events.js';
const NOW=Date.now(),DAY=86400000,FROM=NOW-28*DAY,GAP=1800000;
const stamp=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem'}).format(NOW);
const sid=r=>String(r.session_id||r.sessionId||'').trim();
const pid=v=>String(v??'').replace(/^woo_product_/,'');
const ts=r=>parseTime(r.timestamp)??parseTime(r.created_at)??r._id?.getTimestamp?.().getTime();
const norm=v=>String(v??'').toLowerCase().trim().replace(/\s+/g,' ');
const pct=(n,d)=>d?+(100*n/d).toFixed(2):null,round=n=>+n.toFixed(2);
const quantile=(a,q)=>{const s=[...a].sort((a,b)=>a-b);return s.length?s[Math.floor((s.length-1)*q)]:null;};
const countBy=(a,f)=>[...Map.groupBy(a,f)].map(([key,v])=>({key,n:v.length})).sort((a,b)=>b.n-a.n);
const c=new MongoClient(process.env.MONGODB_URI,{serverSelectionTimeoutMS:12000});
try{
 await c.connect();const db=c.db('woo-beautics-shop-co-il');
 const base={_id:1,session_id:1,sessionId:1,timestamp:1,created_at:1,source:1,event_type:1,product_id:1,product_name:1};
 const [catalog,queries,clicks,carts,checkout,conversations,zero]=await Promise.all([
  db.collection('products').find({},{projection:{_id:0,id:1,numericId:1,name:1,price:1,regularPrice:1,salePrice:1,stockStatus:1,hidden:1,category:1,softCategory:1,badges:1,badgeCandidates:1,url:1}}).maxTimeMS(45000).toArray(),
  db.collection('queries').find({},{projection:{...base,...queryProjection}}).maxTimeMS(45000).toArray(),
  db.collection('product_clicks').find({},{projection:{...base,search_query:1,device:{$cond:[{$regexMatch:{input:{$ifNull:['$user_agent','']},regex:'mobile|android|iphone|ipad',options:'i'}},'mobile','other']}}}).maxTimeMS(45000).toArray(),
  db.collection('cart').find({},{projection:{...base,search_query:1,quantity:1,price:1}}).maxTimeMS(45000).toArray(),
  db.collection('checkout_events').find({},{projection:{...base,search_query:1,order_id:1,order_total:1,currency:1,status:1,financial_status:1,total_price:1,
   'items.product_id':1,'items.product_name':1,'items.quantity':1,'items.price':1,'line_items.product_id':1,'line_items.name':1,'line_items.quantity':1,
   device:{$cond:[{$regexMatch:{input:{$ifNull:['$user_agent','']},regex:'mobile|android|iphone|ipad',options:'i'}},'mobile','other']}}}).maxTimeMS(45000).toArray(),
  db.collection('concierge_conversations').find({},{projection:{_id:1,session_id:1,created_at:1,reason:1,turns:1,'transcript.at':1}}).maxTimeMS(45000).toArray(),
  db.collection('zero_searches').find({},{projection:{_id:0,query:1,hits:1,recovered_count:1,first_seen:1,last_seen:1}}).maxTimeMS(45000).toArray(),
 ]);
 const byId=new Map(catalog.map(p=>[pid(p.id),p]));
 const recent=a=>a.filter(r=>ts(r)>=FROM&&ts(r)<=NOW);
 const allPurchase=checkout.filter(isPurchase),orderMap=new Map();
 for(const r of allPurchase.sort((a,b)=>ts(a)-ts(b)))if(r.order_id&&!orderMap.has(String(r.order_id)))orderMap.set(String(r.order_id),r);
 const allOrders=[...orderMap.values()],paid=recent(allOrders).filter(r=>r.source==='woocommerce_order_completed'&&r.currency==='ILS'&&orderTotal(r)>0);
 const lines=o=>(o.items??o.line_items??[]).map(i=>({id:pid(i.product_id),name:i.product_name||i.name||byId.get(pid(i.product_id))?.name||'',qty:Number(i.quantity)||0,lineRevenue:typeof i.price==='number'?i.price:null}));
 function moneyStats(orders){const amounts=orders.map(orderTotal),units=orders.map(o=>lines(o).reduce((s,i)=>s+i.qty,0));return {orders:orders.length,grossILS:round(amounts.reduce((s,n)=>s+n,0)),aov:round(amounts.reduce((s,n)=>s+n,0)/(amounts.length||1)),median:quantile(amounts,.5),p25:quantile(amounts,.25),p75:quantile(amounts,.75),p90:quantile(amounts,.9),averageUnits:round(units.reduce((s,n)=>s+n,0)/(units.length||1)),medianUnits:quantile(units,.5),averageDistinctProducts:round(orders.reduce((s,o)=>s+new Set(lines(o).map(i=>i.id)).size,0)/(orders.length||1)),missingVisitor:orders.filter(o=>!/^vis-/.test(sid(o))).length,
   buckets:[0,100,200,300,350,399,450,600,1000,2000].map((low,i,a)=>({from:low,to:a[i+1]??null,orders:amounts.filter(n=>n>=low&&(a[i+1]==null||n<a[i+1])).length})),
   singleUnitOrders:units.filter(n=>n===1).length,oneDistinctProductOrders:orders.filter(o=>new Set(lines(o).map(i=>i.id)).size===1).length};}
 const productSales=new Map(),pairMap=new Map(),familyOrders=new Map();
 const family=p=>{const n=norm(p.name);if(/build up|בילד אפ/.test(n))return'בילד אפ';if(/hard base|בייס גומי/.test(n))return'הארד בייס';if(/shiny top|שייני טופ/.test(n))return'שייני טופ';if(/לק ג.?ל|basic\s*\d|\d.*basic/.test(n))return'לקים ובייסיק';if(/פדים|נייר מניקור|כפפות|מקלות לנזילות/.test(n))return'מתכלים';if(/מכונת שיוף/.test(n))return'מכונות שיוף';if(/מנורת ייבוש/.test(n))return'מנורות ייבוש';if(/ראש |ראשי /.test(n))return'ראשי שיוף';return'אחר';};
 for(const o of paid){const items=lines(o),ids=[...new Set(items.map(i=>i.id).filter(Boolean))].sort(),families=new Set(),seen=new Set();for(const i of items){const p=byId.get(i.id);const g=productSales.get(i.id)||{productId:i.id,name:i.name,orders:0,units:0,lineRevenue:0,currentPrice:p?.price??null,available:!!p&&p.stockStatus==='instock'&&!p.hidden,category:p?.softCategory||p?.category||[]};if(!seen.has(i.id))g.orders++;seen.add(i.id);g.units+=i.qty;g.lineRevenue+=i.lineRevenue??0;productSales.set(i.id,g);families.add(family(i));}for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const key=ids[i]+'|'+ids[j];pairMap.set(key,(pairMap.get(key)||0)+1);}for(const f of families){const a=familyOrders.get(f)||[];a.push(o);familyOrders.set(f,a);}}
 const events=[];
 const add=(rows,kind,fn=()=>true)=>{for(const r of rows)if(fn(r)&&ts(r)>=FROM-2*DAY&&ts(r)<=NOW&&/^vis-/.test(sid(r)))events.push({s:sid(r),t:ts(r),kind,pid:pid(r.product_id),q:norm(r.query??r.search_query),raw:r});};
 add(queries,'search');add(clicks,'click');add(carts,'cart',r=>r.source==='woocommerce_add_to_cart');add(checkout,'checkout',r=>r.event_type==='checkout_initiated');add(paid,'purchase');add(conversations,'concierge');
 const visits=[];for(const [s,ev]of Map.groupBy(events,e=>e.s)){ev.sort((a,b)=>a.t-b.t);let v;for(const e of ev){if(!v||e.t-v.last>GAP){v={s,events:[],first:e.t,last:e.t};visits.push(v);}v.events.push(e);v.last=e.t;}}
 const cohort=visits.filter(v=>v.first>=FROM);
 function funnel(vv,anchorKind=null){const rr={visits:vv.length,searchVisits:0,clickVisits:0,cartVisits:0,checkoutVisits:0,purchaseVisits:0,orders:0,grossILS:0,cartThenCheckout:0,cartThenPurchase:0,checkoutThenPurchase:0};for(const v of vv){const at=anchorKind?v.events.find(e=>e.kind===anchorKind)?.t:v.first;if(at==null)continue;const ev=v.events.filter(e=>e.t>=at);for(const k of['search','click','cart','checkout','purchase'])if(ev.some(e=>e.kind===k))rr[k+'Visits']++;const ca=ev.find(e=>e.kind==='cart'),ch=ev.find(e=>e.kind==='checkout');if(ca&&ev.some(e=>e.kind==='checkout'&&e.t>=ca.t))rr.cartThenCheckout++;if(ca&&ev.some(e=>e.kind==='purchase'&&e.t>=ca.t))rr.cartThenPurchase++;if(ch&&ev.some(e=>e.kind==='purchase'&&e.t>=ch.t))rr.checkoutThenPurchase++;for(const p of ev.filter(e=>e.kind==='purchase')){rr.orders++;rr.grossILS+=orderTotal(p.raw)||0;}}rr.grossILS=round(rr.grossILS);rr.purchaseRatePct=pct(rr.purchaseVisits,rr.visits);rr.cartToPurchasePct=pct(rr.cartThenPurchase,rr.cartVisits);rr.checkoutToPurchasePct=pct(rr.checkoutThenPurchase,rr.checkoutVisits);return rr;}
 const queryGroups=new Map(),productGroups=new Map();
 for(const v of cohort){for(const [q,qe]of Map.groupBy(v.events.filter(e=>e.kind==='search'),e=>e.q)){if(!q)continue;const at=qe[0].t,post=v.events.filter(e=>e.t>=at),g=queryGroups.get(q)||{query:q,visits:0,searches:0,zeroVisits:0,clickVisits:0,cartVisits:0,purchaseVisits:0,results:[]};g.visits++;g.searches+=qe.length;g.zeroVisits+=qe.some(e=>e.raw.zero_results===true||e.raw._analyticsResultCount===0)?1:0;for(const k of['click','cart','purchase'])if(post.some(e=>e.kind===k))g[k+'Visits']++;if(qe.at(-1).raw.deliveredProducts?.length)g.results=qe.at(-1).raw.deliveredProducts.slice(0,5);queryGroups.set(q,g);}
  for(const id of new Set(v.events.filter(e=>e.kind==='click'||e.kind==='cart').map(e=>e.pid).filter(Boolean))){const ev=v.events.filter(e=>e.pid===id),p=byId.get(id),g=productGroups.get(id)||{productId:id,name:p?.name||ev[0]?.raw.product_name||'',price:p?.price??null,available:!!p&&p.stockStatus==='instock'&&!p.hidden,clickVisits:0,cartVisits:0,clickThenCartVisits:0,cartThenPurchaseVisits:0};const cl=ev.find(e=>e.kind==='click'),ca=ev.find(e=>e.kind==='cart');if(cl)g.clickVisits++;if(ca)g.cartVisits++;if(cl&&ca&&ca.t>=cl.t)g.clickThenCartVisits++;if(ca&&v.events.some(e=>e.kind==='purchase'&&e.t>=ca.t&&lines(e.raw).some(i=>i.id===id)))g.cartThenPurchaseVisits++;productGroups.set(id,g);}}
 const queryVisitorCounts=new Map();for(const v of cohort)for(const q of new Set(v.events.filter(e=>e.kind==='search').map(e=>e.q))){const m=queryVisitorCounts.get(q)||new Map();m.set(v.s,(m.get(v.s)||0)+1);queryVisitorCounts.set(q,m);}
 const queryRows=[...queryGroups.values()].map(g=>{const m=queryVisitorCounts.get(g.query);return{...g,distinctVisitors:m.size,largestVisitorVisitSharePct:pct(Math.max(...m.values()),g.visits),clickRatePct:pct(g.clickVisits,g.visits),cartRatePct:pct(g.cartVisits,g.visits),purchaseRatePct:pct(g.purchaseVisits,g.visits)};});
 const productRows=[...productGroups.values()].map(g=>({...g,clickToCartPct:pct(g.clickThenCartVisits,g.clickVisits),cartToPurchasePct:pct(g.cartThenPurchaseVisits,g.cartVisits)}));
 const topSales=[...productSales.values()].map(g=>({...g,lineRevenue:round(g.lineRevenue)})).sort((a,b)=>b.orders-a.orders);
 const pairs=[...pairMap].filter(([,n])=>n>=5).map(([key,n])=>{const[a,b]=key.split('|'),pa=productSales.get(a),pb=productSales.get(b);return{a:{id:a,name:pa.name,currentPrice:pa.currentPrice,available:pa.available,orders:pa.orders},b:{id:b,name:pb.name,currentPrice:pb.currentPrice,available:pb.available,orders:pb.orders},ordersTogether:n,shareOfA:pct(n,pa.orders),shareOfB:pct(n,pb.orders),lift:round(n*paid.length/(pa.orders*pb.orders))};}).sort((a,b)=>b.ordersTogether-a.ordersTogether);
 const completions=paid.map(o=>({gross:orderTotal(o),ids:new Set(lines(o).map(i=>i.id))}));
 const smaller=paid.filter(o=>orderTotal(o)<399),near=paid.filter(o=>orderTotal(o)>=300&&orderTotal(o)<399);
 const lowCost=topSales.filter(p=>p.available&&p.currentPrice>0&&p.currentPrice<=60).slice(0,30).map(p=>({...p,ordersUnder399:smaller.filter(o=>lines(o).some(i=>i.id===p.productId)).length}));
 const result={generatedAt:new Date(NOW),window:{from:new Date(FROM),to:new Date(NOW),days:28},
  methodology:{sessions:'Persistent visitor IDs split by >30-minute gaps in observed events. No pageview stream; approximate visits.',paidOrders:'Distinct positive ILS completed orders from woocommerce_order_completed server paid hook only. Gross order revenue, not net profit; no refund or COGS data.',queryRates:'Distinct reconstructed search visits with later commerce in same visit. A visit can include multiple queries; a query association is not proof the query caused the sale.',cart:'Successful server hook only; checkout completion rates concern only matchable visitor IDs.',pairs:'Order co-occurrence, not causal recommendations or validated technical compatibility.',threshold:'Gross order totals include tax/shipping; counts below 399 are proxies, not exact merchandise subtotal eligibility. Existing site rules must be used at checkout.',coverage:'Sources loaded without row limit and with explicit projections; no truncated source is treated as complete. Older paid tracking regimes excluded from current metrics.'},
  inventory:{catalog:catalog.length,inStockVisible:catalog.filter(p=>p.stockStatus==='instock'&&!p.hidden).length,totalHistoricalQueries:queries.length,totalHistoricalClicks:clicks.length,totalHistoricalCartEvents:carts.length,totalHistoricalCheckoutEvents:checkout.length,totalHistoricalConversations:conversations.length,firstQuery:new Date(Math.min(...queries.map(ts))),recentSearchEvents:recent(queries).length,recentSuccessCartEvents:recent(carts).filter(r=>r.source==='woocommerce_add_to_cart').length},
  orders:moneyStats(paid),last7Days:moneyStats(paid.filter(o=>ts(o)>=NOW-7*DAY)),
  weeks:[0,1,2,3].map(i=>({weekEnding:new Date(NOW-i*7*DAY),...moneyStats(paid.filter(o=>ts(o)>=NOW-(i+1)*7*DAY&&ts(o)<NOW-i*7*DAY)),search:funnel(cohort.filter(v=>v.first>=NOW-(i+1)*7*DAY&&v.first<NOW-i*7*DAY&&v.events.some(e=>e.kind==='search')),'search')})),
  funnelAllObserved:funnel(cohort),funnelSearch:funnel(cohort.filter(v=>v.events.some(e=>e.kind==='search')),'search'),
  conciergeReach:{visits:cohort.filter(v=>v.events.some(e=>e.kind==='concierge')).length,searchVisitsWithConcierge:cohort.filter(v=>v.events.some(e=>e.kind==='search')&&v.events.some(e=>e.kind==='concierge')).length},
  funnelCart:funnel(cohort.filter(v=>v.events.some(e=>e.kind==='cart')),'cart'),
  funnelCheckout:funnel(cohort.filter(v=>v.events.some(e=>e.kind==='checkout')),'checkout'),
  topQueries:queryRows.sort((a,b)=>b.visits-a.visits).slice(0,40),
  searchLeaks:queryRows.filter(g=>g.visits>=10).sort((a,b)=>b.visits*(1-b.cartVisits/b.visits)-a.visits*(1-a.cartVisits/a.visits)).slice(0,30),
  highZeroQueries:queryRows.filter(g=>g.visits>=3&&g.zeroVisits).sort((a,b)=>b.zeroVisits-a.zeroVisits).slice(0,20),
  queryCoverage:{visits:cohort.filter(v=>v.events.some(e=>e.kind==='search')).length,zeroVisits:cohort.filter(v=>v.events.some(e=>e.kind==='search'&&(e.raw.zero_results===true||e.raw._analyticsResultCount===0))).length},
  topProducts:topSales.slice(0,50),topPairs:pairs.slice(0,45),
  lowCartProducts:productRows.filter(p=>p.clickVisits>=10).sort((a,b)=>b.clickVisits-b.clickThenCartVisits-(a.clickVisits-a.clickThenCartVisits)).slice(0,25),
  cartLeaks:productRows.filter(p=>p.cartVisits>=15).sort((a,b)=>(b.cartVisits-b.cartThenPurchaseVisits)-(a.cartVisits-a.cartThenPurchaseVisits)).slice(0,25),
  families:[...familyOrders].map(([family,orders])=>({family,...moneyStats(orders)})).sort((a,b)=>b.orders-a.orders),
  threshold:{grossOrdersUnder399:smaller.length,grossOrders300to399:near.length,grossGapTo399:round(near.reduce((s,o)=>s+399-orderTotal(o),0)),grossMedianGap:quantile(near.map(o=>399-orderTotal(o)),.5)},
  affordableComplements:lowCost,
  historicalZeroCounters:zero.sort((a,b)=>(b.hits||0)-(a.hits||0)).slice(0,15).map(({query,hits,recovered_count,first_seen,last_seen})=>({query,hits,recovered_count,first_seen,last_seen})),
  scenarios:{plus30ILSperOrder:paid.length*30,plus5PctAov:round(paid.reduce((s,o)=>s+orderTotal(o),0)*.05),plus10PctAov:round(paid.reduce((s,o)=>s+orderTotal(o),0)*.1)},
 };
 for(const key of['funnelSearch','funnelCart','funnelCheckout']){const f=result[key];if(f.purchaseVisits>f.visits||f.cartThenPurchase>f.cartVisits||f.checkoutThenPurchase>f.checkoutVisits)throw Error('Invalid funnel');}
 await writeFile(`reports/beautics-growth-${stamp}.json`,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
}finally{await c.close();}
