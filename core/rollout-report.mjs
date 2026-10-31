import {MongoClient} from 'mongodb';
import {ROLLOUT_TEST,readRollout} from './takeover-control.mjs';

// What the rollout did: the store's own event collections, split by the visitor's group in the Semantix / native test.
//   tracking_events  ab_exposure — one per visitor, group and day (every visitor, whether or not they searched)
//   queries          searches (Semantix /search, and the native group's searches registered in shadow mode)
//   product_clicks   clicks on result cards
//   cart             add_to_cart
//   checkout_events  checkout_initiated / checkout_completed (the Shopify web pixel, the WooCommerce order page)
// A visitor's group is the one of their exposures; cart and checkout events carry it too and fill in for visitors whose
// exposure fell outside the window. The comparison that matters is among searchers: of the visitors who searched, how many
// bought — the only step the two groups experience differently.
// Left out of both groups: bots (a crawler has a new visitor id on every visit), visitors seen in both groups in the
// window (conflicts — the split moved, or the old unmarked fallback) and "<variant>:fallback" / ":pinned" events.
// quality says whether the numbers can carry a claim yet: verified orders exist, the split matches its weights, few
// conflicts. Until then a difference between the groups is not attributable to the takeover.

const session=r=>String(r.session_id||r.sessionId||'');
const time=r=>new Date(r.timestamp||r.created_at).getTime();
const group=r=>{const v=r.ab_tests?.[ROLLOUT_TEST];return v==='semantix'||v==='native'?v:null;};
const PAID_OUT=/refunded|voided|cancel/i;
const BOT=/bot\b|bot\/|crawl|spider|slurp|lighthouse|headless|facebookexternalhit|bingpreview|ahrefs|semrush/i;
const human=r=>!BOT.test(String(r.user_agent||''));

export function reportOptions(a={},now=Date.now()){
 const days=Number(a.days??14);if(!Number.isInteger(days)||days<1||days>90)throw Error('טווח הדוח: בין יום ל־90 ימים');
 return {from:new Date(now-days*864e5).toISOString(),to:new Date(now).toISOString(),days};
}

// Two-proportion z test; |z| ≥ 1.96 is the usual 95% line. With few purchases it says "not yet" for a long time — which is the truth.
export function compare(a,b){
 if(!a.n||!b.n)return null;
 const pa=a.x/a.n,pb=b.x/b.n,p=(a.x+b.x)/(a.n+b.n),se=Math.sqrt(p*(1-p)*(1/a.n+1/b.n));
 return {lift:pb>0?(pa-pb)/pb:null,z:se>0?(pa-pb)/se:null,significant:se>0&&Math.abs((pa-pb)/se)>=1.96};
}

// Sample-ratio check: with the split's real share, is this many visitors in Semantix a matter of chance? |z| ≥ 3.
export function splitCheck(semantix,native,expectedShare){
 const n=semantix+native;if(!n||expectedShare===null||expectedShare===undefined||expectedShare<=0||expectedShare>=1)return {semantix,native,share:n?semantix/n:null,expectedShare:expectedShare??null,z:null,mismatch:false};
 const z=(semantix-n*expectedShare)/Math.sqrt(n*expectedShare*(1-expectedShare));return {semantix,native,share:semantix/n,expectedShare,z,mismatch:Math.abs(z)>=3};
}
export function summarizeRollout({exposures=[],queries=[],clicks=[],carts=[],confirmed=[],checkouts=[]},options){
 const inWindow=r=>time(r)>=Date.parse(options.from)&&time(r)<Date.parse(options.to);
 const of=new Map(),both=new Set();let bots=0;
 const assign=r=>{const s=session(r),g=group(r);if(!s||!g)return;if(of.has(s)&&of.get(s)!==g)both.add(s);of.set(s,g);};
 // Exposures decide; cart and checkout events only fill in visitors that have none.
 const seen=exposures.filter(inWindow);bots=new Set(seen.filter(r=>!human(r)).map(session)).size;
 seen.filter(human).forEach(assign);
 const exposed=new Set(of.keys());
 const purchases=checkouts.filter(inWindow).filter(human),activity=[...carts.filter(inWindow).filter(human),...purchases];
 for(const r of activity)if(!exposed.has(session(r)))assign(r);
 for(const s of both)of.delete(s);
 const make=()=>({visitors:new Set(),searchers:new Set(),searches:0,clickers:new Set(),clicks:0,carters:new Set(),carts:0,confirmedCarters:new Set(),confirmedCarts:0,searchIds:new Set(),attributedCarts:0,attributedOrders:0,attributedRevenue:0,checkoutStarters:new Set(),buyers:new Set(),orders:0,revenue:0});
 const groups={semantix:make(),native:make()},unknown={searches:0,clicks:0,carts:0,orders:0,revenue:0,noSession:0};
 for(const [s,g] of of)groups[g].visitors.add(s);
 const bucket=r=>{const s=session(r);return s&&of.has(s)?groups[of.get(s)]:null;};
 for(const r of queries.filter(inWindow)){const g=bucket(r);if(!g){unknown.searches++;if(!session(r))unknown.noSession++;continue;}g.searches++;g.searchers.add(session(r));if(r.search_id)g.searchIds.add(r.search_id);}
 for(const r of clicks.filter(inWindow)){const g=bucket(r);if(!g){unknown.clicks++;continue;}g.clicks++;g.clickers.add(session(r));}
 for(const r of carts.filter(inWindow)){if(r.event_type&&r.event_type!=='add_to_cart')continue;const g=bucket(r);if(!g){unknown.carts++;continue;}g.carts++;g.carters.add(session(r));}
 for(const r of confirmed.filter(inWindow).filter(human)){const g=bucket(r);if(!g)continue;g.confirmedCarts++;g.confirmedCarters.add(session(r));if(r.search_id&&g.searchIds.has(r.search_id))g.attributedCarts++;}
 const orders=new Set();let currency=null;
 for(const r of purchases){
  const g=bucket(r);
  if(r.event_type==='checkout_initiated'){if(g)g.checkoutStarters.add(session(r));continue;}
  if(r.event_type&&r.event_type!=='checkout_completed')continue;
  if(PAID_OUT.test(String(r.financial_status||r.shopify_data?.financial_status||r.status||'')))continue;
  const key=r.order_id?String(r.order_id):null;if(key){if(orders.has(key))continue;orders.add(key);}
  const amount=Number(r.total_price);currency??=r.currency||null;
  if(!g){unknown.orders++;unknown.revenue+=Number.isFinite(amount)?amount:0;continue;}
  g.orders++;g.revenue+=Number.isFinite(amount)?amount:0;g.buyers.add(session(r));
  if(r.search_id&&g.searchIds.has(r.search_id)){g.attributedOrders++;g.attributedRevenue+=Number.isFinite(amount)?amount:0;}
 }
 const rate=(x,n)=>n?x/n:null,overlap=(a,b)=>{let n=0;for(const s of a)if(b.has(s))n++;return n;};
 const view=g=>{const searchBuyers=overlap(g.buyers,g.searchers);return {
  visitors:g.visitors.size,searchers:g.searchers.size,searches:g.searches,clickers:g.clickers.size,clicks:g.clicks,carters:g.carters.size,carts:g.carts,
  checkoutStarters:g.checkoutStarters.size,buyers:g.buyers.size,orders:g.orders,revenue:Math.round(g.revenue*100)/100,
  searchersWhoClicked:overlap(g.clickers,g.searchers),searchersWhoCarted:overlap(g.carters,g.searchers),searchersWhoBought:searchBuyers,
  confirmedCarters:g.confirmedCarters.size,confirmedCarts:g.confirmedCarts,searchersWhoConfirmedCart:overlap(g.confirmedCarters,g.searchers),
  trackedSearches:g.searchIds.size,attributedCarts:g.attributedCarts,attributedOrders:g.attributedOrders,attributedRevenue:Math.round(g.attributedRevenue*100)/100,
  conversion:rate(g.buyers.size,g.visitors.size),searchConversion:rate(searchBuyers,g.searchers.size),
  searchClickRate:rate(overlap(g.clickers,g.searchers),g.searchers.size),searchCartRate:rate(overlap(g.carters,g.searchers),g.searchers.size),
  searchConfirmedCartRate:rate(overlap(g.confirmedCarters,g.searchers),g.searchers.size),
  revenuePerVisitor:rate(g.revenue,g.visitors.size),averageOrder:rate(g.revenue,g.orders)};};
 const semantix=view(groups.semantix),native=view(groups.native);
 const cmp=(x,n)=>compare({x:semantix[x],n:semantix[n]},{x:native[x],n:native[n]});
 const split=splitCheck(semantix.visitors,native.visitors,options.expectedShare),conflicts=both.size,assigned=semantix.visitors+native.visitors+conflicts;
 const reasons=[];
 if(!semantix.orders&&!native.orders)reasons.push('no-verified-orders');
 if(split.mismatch)reasons.push('split-mismatch');
 if(options.splitChanged)reasons.push('split-changed-in-window');
 if(assigned&&conflicts/assigned>0.01)reasons.push('group-conflicts');
 const quality={attributable:!reasons.length,reasons,conflicts,bots,split};
 return {from:options.from,to:options.to,days:options.days,currency,quality,semantix,native,unknown:{...unknown,revenue:Math.round(unknown.revenue*100)/100},
  lift:{searchConversion:cmp('searchersWhoBought','searchers'),conversion:cmp('buyers','visitors'),searchCartRate:cmp('searchersWhoCarted','searchers'),searchConfirmedCartRate:cmp('searchersWhoConfirmedCart','searchers'),searchClickRate:cmp('searchersWhoClicked','searchers')}};
}

export async function readRolloutReport(project,args={},deps={}){
 const options=reportOptions(args,deps.now?.()??Date.now()),dbName=project.existingClient?.dbName||project.dashboardExport?.dbName;
 if(!dbName)throw Error('נדרש לקוח מחובר למסד dashboard');
 let client=deps.client;
 if(!client){const uri=process.env.STUDIO_DASHBOARD_MONGODB_URI||process.env.MONGODB_URI;if(!uri)throw Error('חסר חיבור למסד');client=new MongoClient(uri,{serverSelectionTimeoutMS:8000});}
 try{
  if(!deps.client)await client.connect();
  const db=client.db(dbName),sources={},data={exposures:[],queries:[],clicks:[],carts:[],confirmed:[],checkouts:[]};
  const list=[['tracking_events','exposures',{event_type:'ab_exposure'}],['tracking_events','confirmed',{event_type:'add_to_cart_confirmed'}],['queries','queries',{}],['product_clicks','clicks',{}],['product_click_events','clicks',{}],['cart','carts',{event_type:'add_to_cart'}],['checkout_events','checkouts',{}]];
  const projection={_id:0,session_id:1,sessionId:1,search_id:1,user_agent:1,timestamp:1,created_at:1,event_type:1,ab_tests:1,order_id:1,total_price:1,currency:1,financial_status:1,status:1,'shopify_data.financial_status':1};
  await Promise.all(list.map(async([name,kind,extra])=>{
   const date={$convert:{input:{$ifNull:['$timestamp','$created_at']},to:'date',onError:null,onNull:null}};
   const filter={$expr:{$and:[{$gte:[date,new Date(options.from)]},{$lt:[date,new Date(options.to)]}]},...extra};
   try{const rows=await db.collection(name).aggregate([{$match:filter},{$sort:{_id:-1}},{$limit:200001},{$project:projection}],{maxTimeMS:30000}).toArray();
    sources[kind==='confirmed'?'add_to_cart_confirmed':name]={status:'ok',rows:Math.min(rows.length,200000),truncated:rows.length>200000};data[kind].push(...rows.slice(0,200000));}
   catch{sources[kind==='confirmed'?'add_to_cart_confirmed':name]={status:'unavailable',rows:null,truncated:false};}
  }));
  // The split as it stands: a window that reaches before its last change mixes two splits, and a check against one is meaningless.
  let rollout=null;try{const read=deps.readRollout||!deps.client&&readRollout;if(read)rollout=await read(project);}catch{}
  const expectedShare=typeof rollout?.percent==='number'?rollout.percent/100:null,splitChanged=!!rollout?.updatedAt&&Date.parse(rollout.updatedAt)>Date.parse(options.from);
  return {...summarizeRollout(data,{...options,expectedShare:splitChanged?null:expectedShare,splitChanged}),sources};
 }finally{if(!deps.client)await client.close();}
}
