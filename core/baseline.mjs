import {MongoClient} from 'mongodb';
import {applyRanking} from './ranking.mjs';
import {normalize} from './core.mjs';
import {createIndexRetriever,buildSearchIndex} from './search-index.mjs';

// Production baseline: what the CURRENT (to be replaced) search does for real shoppers, from its own logs.
// A query "works" in production when shoppers clicked or carted its results; those products are what the new
// search must keep returning. A query "fails" in production when it mostly returned nothing or was never clicked;
// that is where the new search must deliver. Built from the tenant database, evaluated locally and deterministically.
const KEEP_TOP=24;
const tailOf=url=>String(url||'').split('?')[0].replace(/\/$/,'').split('/').pop();

export async function readProductionSignals(p,{days=30,uri=process.env.STUDIO_DASHBOARD_MONGODB_URI||process.env.MONGODB_URI}={}){
 if(!p.existingClient)throw Error('הבסיס נבנה מנתוני החיפוש של לקוח קיים');if(!uri)throw Error('חסר חיבור למסד הנתונים');
 const c=new MongoClient(uri,{serverSelectionTimeoutMS:10000});
 try{await c.connect();const db=c.db(p.existingClient.dbName),since=new Date(Date.now()-days*864e5);
  // Timestamps are Date objects in some tenants and ISO strings in others.
  const window=async name=>{const one=await db.collection(name).findOne({},{sort:{_id:-1},projection:{timestamp:1}});return {timestamp:{$gte:one?.timestamp instanceof Date?since:since.toISOString()}};};
  const key={$toLower:{$trim:{input:'$query'}}};
  const queries=await db.collection('queries').aggregate([{$match:{...await window('queries'),query:{$type:'string'}}},{$group:{_id:key,searches:{$sum:1},zero:{$sum:{$cond:[{$eq:[{$size:{$ifNull:['$deliveredProducts',[]]}},0]},1,0]}},form:{$first:'$query'},delivered:{$last:'$deliveredProducts'}}}],{allowDiskUse:true,maxTimeMS:120000}).toArray();
  const events=async name=>db.collection(name).aggregate([{$match:{...await window(name),search_query:{$type:'string'},product_url:{$type:'string'},...(name==='cart'&&{event_type:'add_to_cart'})}},{$group:{_id:{q:{$toLower:{$trim:{input:'$search_query'}}},u:'$product_url'},n:{$sum:1},title:{$first:'$product_name'}}}],{allowDiskUse:true,maxTimeMS:120000}).toArray().catch(()=>[]);
  return {days,since:since.toISOString(),queries,clicks:await events('product_clicks'),carts:await events('cart')};
 }finally{await c.close();}
}

// Popularity = how often shoppers of the current search chose a product (clicks + 3×carts, any query). Written on
// cards and raw products so ranking keeps what production shoppers prefer; the index is rebuilt.
export function applyPopularity(p,signals){
 const byTail=new Map(p.productCards.map(c=>[tailOf(c.url||c.id),c])),score=new Map();
 for(const [list,w] of [[signals.clicks,1],[signals.carts,3]])for(const e of list){const c=byTail.get(tailOf(e._id.u));if(c)score.set(c.id,(score.get(c.id)||0)+e.n*w);}
 const raws=new Map(p.catalog.products.map(x=>[String(x.id),x]));
 for(const c of p.productCards){const v=score.get(c.id)||0;if(v)c.popularity=v;else delete c.popularity;const raw=raws.get(c.id);if(raw){if(v)raw.popularity=v;else delete raw.popularity;}}
 p.searchIndex=buildSearchIndex(p.productCards,'popularity-'+Date.now());
 return score.size;
}
export function buildBaseline(p,signals,{minSearches=3,limit=600}={}){
 const cards=p.productCards||[],byTail=new Map(cards.map(c=>[tailOf(c.url||c.id),c])),byTitle=new Map(cards.map(c=>[normalize(c.title),c]));
 const shown=c=>c&&!c.hidden&&c.stockStatus==='instock';
 const events=new Map();
 for(const [kind,list] of [['clicks',signals.clicks],['carts',signals.carts]])for(const e of list){const q=normalize(e._id.q);if(!q)continue;const per=events.get(q)||new Map(),t=tailOf(e._id.u),g=per.get(t)||{tail:t,title:e.title||'',clicks:0,carts:0};g[kind]+=e.n;per.set(t,g);events.set(q,per);}
 const merged=new Map();// "Kindle" and "kindle " are one query
 for(const r of signals.queries){const q=normalize(r._id);if(!q)continue;const m=merged.get(q)||{query:r.form?.trim()||r._id,searches:0,zero:0,delivered:r.delivered||[]};m.searches+=r.searches;m.zero+=r.zero;merged.set(q,m);}
 const out=[];
 for(const [q,m] of merged){
  if(m.searches<minSearches)continue;
  const products=[...(events.get(q)?.values()||[])].map(g=>{const card=byTail.get(g.tail)||byTitle.get(normalize(g.title));return {id:card?.id||null,title:card?.title||g.title,clicks:g.clicks,carts:g.carts,inCatalog:!!card,visible:shown(card)};}).sort((a,b)=>b.carts-a.carts||b.clicks-a.clicks);
  const clicks=products.reduce((s,x)=>s+x.clicks,0),carts=products.reduce((s,x)=>s+x.carts,0);
  // A product is a keep target when shoppers clearly chose it: carted, or clicked repeatedly and a real share of the
  // query's clicks. One-off clicks are noise (a shopper who searched one thing and then wandered).
  const targets=products.filter(x=>(x.carts>0||x.clicks>=3)&&(!clicks||x.clicks/clicks>=0.1||x.carts>0)).slice(0,8);
  out.push({query:m.query,key:q,searches:m.searches,productionZeroRate:+(m.zero/m.searches).toFixed(2),clicks,carts,
   production:targets.length?'works':m.zero/m.searches>=0.5||m.searches>=5&&!clicks?'fails':'unclear',
   targets:targets.filter(x=>x.visible).map(({id,title,clicks,carts})=>({id,title,clicks,carts})),
   unavailable:targets.filter(x=>!x.visible).map(({title,inCatalog,clicks})=>({title,inCatalog,clicks})),productionTop:(m.delivered||[]).slice(0,5)});
 }
 out.sort((a,b)=>b.searches-a.searches);
 return {builtAt:new Date().toISOString(),days:signals.days,since:signals.since,queries:out.slice(0,limit),totalQueries:merged.size,totalSearches:[...merged.values()].reduce((s,m)=>s+m.searches,0)};
}

// Deterministic evaluation of the working rules against the baseline (the same local retriever the guard uses).
export function evaluateBaseline(p,profile,baseline=p.baseline,{index,only}={}){
 if(!baseline?.queries?.length)return null;
 const idx=index||p.searchIndex||buildSearchIndex(p.productCards,'baseline');
 const retrieve=createIndexRetriever(p.productCards,{...profile,tenantId:p.id},idx),byId=new Map(p.productCards.map(c=>[c.id,c])),shown=c=>c&&!c.hidden&&c.stockStatus==='instock';
 const results=baseline.queries.filter(b=>!only||only.has(b.query)).map(b=>{
  const r=retrieve(b.query),ids=applyRanking(r.matches,profile.rankingRules,b.query).matches.slice(0,KEEP_TOP).map(m=>m.id),rank=new Map(ids.map((id,i)=>[id,i+1]));
  if(b.production==='works'){
   // Only targets shoppers can see now count: one that went out of stock or disappeared is a catalog gap, not a search loss.
   const targets=b.targets.filter(t=>shown(byId.get(t.id))),unavailableNow=b.targets.length-targets.length;
   if(!targets.length)return {query:b.query,searches:b.searches,production:'works',status:'gap',total:r.total,unavailableNow};
   const found=targets.filter(t=>rank.has(t.id));
   return {query:b.query,searches:b.searches,production:'works',status:found.length===targets.length?'kept':found.length?'partial':'lost',total:r.total,...(unavailableNow&&{unavailableNow}),
    missing:targets.filter(t=>!rank.has(t.id)).map(t=>({id:t.id,title:t.title})),ranks:Object.fromEntries(found.map(t=>[t.id,rank.get(t.id)]))};
  }
  return {query:b.query,searches:b.searches,production:b.production,status:r.total?'answers':'empty',total:r.total};
 });
 const sum=f=>results.filter(f).reduce((s,r)=>s+r.searches,0),works=sum(r=>r.production==='works'&&r.status!=='gap');
 return {at:new Date().toISOString(),results,
  summary:{keptShare:works?+(sum(r=>r.status==='kept')/works).toFixed(3):null,kept:results.filter(r=>r.status==='kept').length,partial:results.filter(r=>r.status==='partial').length,lost:results.filter(r=>r.status==='lost').length,
   gaps:results.filter(r=>r.status==='gap').length,productionFails:results.filter(r=>r.production==='fails').length,failsWeAnswer:results.filter(r=>r.production==='fails'&&r.status==='answers').length}};
}
// Queries the rules kept before and no longer keep: a change that causes these must not be saved.
export function baselineRegressions(before,after){
 if(!before||!after)return [];const prev=new Map(before.results.map(r=>[r.key||r.query,r]));const order={kept:2,partial:1,lost:0};
 return after.results.filter(r=>{const b=prev.get(r.key||r.query);return b&&r.production==='works'&&b.status in order&&r.status in order&&order[r.status]<order[b.status];})
  .map(r=>({query:r.query,searches:r.searches,was:prev.get(r.query).status,now:r.status,missing:r.missing}));
}
