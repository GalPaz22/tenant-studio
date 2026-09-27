import {MongoClient} from 'mongodb';

// What shoppers did in a time window, from every signal the store logs — so a question like "what do shoppers search
// most this week" has a real answer even when one source stopped logging:
//   queries          searches the server logged (query, timestamp)
//   product_clicks   clicks on search results (search_query, session_id, timestamp)
//   cart             add-to-cart from search (search_query, session_id, timestamp)
//   zero_searches    searches the storefront saw with no results (query, hits, last_seen, recovered_count)
// Per-day counts per source reveal logging gaps (e.g. searches stop being logged while clicks continue).
const text=v=>typeof v==='string'?v.trim().toLowerCase():'';
export function summarizeActivity({queries=[],clicks=[],carts=[],zero=[]},{from,to,limit=20}){
 const day=d=>new Date(d).toISOString().slice(0,10),days=new Map();
 const bump=(d,k)=>{if(!d||isNaN(new Date(d)))return;const key=day(d);if(!days.has(key))days.set(key,{day:key,searches:0,clicks:0,carts:0});days.get(key)[k]++;};
 for(const q of queries)bump(q.timestamp,'searches');for(const c of clicks)bump(c.timestamp,'clicks');for(const c of carts)bump(c.timestamp,'carts');
 const tally=(rows,field)=>{const m=new Map();for(const r of rows){const q=text(r[field]);if(!q)continue;const e=m.get(q)||{query:q,events:0,sessions:new Set()};e.events++;e.sessions.add(r.session_id||r.sessionId||r._id);m.set(q,e);}return m;};
 const searched=tally(queries,'query'),clicked=tally(clicks,'search_query'),carted=tally(carts,'search_query');
 const all=new Set([...searched.keys(),...clicked.keys(),...carted.keys()]);
 const top=[...all].map(q=>({query:q,searches:searched.get(q)?.events||0,clickSessions:clicked.get(q)?.sessions.size||0,clicks:clicked.get(q)?.events||0,cartSessions:carted.get(q)?.sessions.size||0,carts:carted.get(q)?.events||0}))
  .sort((a,b)=>(b.searches+b.clickSessions+b.cartSessions)-(a.searches+a.clickSessions+a.cartSessions)||b.clicks-a.clicks).slice(0,limit);
 const perDay=[...days.values()].sort((a,b)=>a.day.localeCompare(b.day));
 // Searches logged on few days while clicks keep flowing = the search log is missing, not the traffic.
 const clickDays=perDay.filter(d=>d.clicks>0),silent=clickDays.filter(d=>d.searches===0);
 const loggingGap=clickDays.length>=2&&silent.length>=Math.ceil(clickDays.length/2)?{searchesNotLoggedOn:silent.map(d=>d.day),note:'חיפושים לא נרשמו בימים האלה אף שהיו הקלקות מחיפוש — הדירוג מבוסס על הקלקות והוספות לסל'}:null;
 return {window:{from,to},totals:{searches:queries.length,clicks:clicks.length,carts:carts.length,zeroResultQueries:zero.length},loggingGap,perDay,top,
  zeroResults:zero.sort((a,b)=>(b.hits||0)-(a.hits||0)).slice(0,limit).map(z=>({query:z.query,hits:z.hits||0,recovered:z.recovered_count||0,lastSeen:z.last_seen}))};
}
export async function readShopperActivity(p,{days=7,limit=20,now=Date.now()}={}){
 if(!p.existingClient?.dbName)throw Error('הלקוח לא מחובר למסד של ה־dashboard — פתח אותו כ״לקוח קיים״ לפי שם משתמש או dbName');
 const uri=process.env.STUDIO_DASHBOARD_MONGODB_URI||process.env.MONGODB_URI;if(!uri)throw Error('חסר חיבור למסד הנתונים');
 const from=new Date(now-days*864e5),to=new Date(now),window=field=>({$or:[{[field]:{$gte:from}},{[field]:{$gte:from.toISOString()}}]});
 const c=new MongoClient(uri,{serverSelectionTimeoutMS:8000});
 try{await c.connect();const db=c.db(p.existingClient.dbName);
  const read=(name,filter,projection)=>db.collection(name).find(filter,{projection,maxTimeMS:30000}).limit(100000).toArray().catch(()=>[]);
  const [queries,clicks,carts,zero]=await Promise.all([
   read('queries',window('timestamp'),{_id:0,query:1,timestamp:1}),
   read('product_clicks',{...window('timestamp'),search_query:{$type:'string',$ne:''}},{_id:0,search_query:1,session_id:1,sessionId:1,timestamp:1}),
   read('cart',{...window('timestamp'),search_query:{$type:'string',$ne:''}},{_id:0,search_query:1,session_id:1,sessionId:1,timestamp:1}),
   read('zero_searches',window('last_seen'),{_id:0,query:1,hits:1,recovered_count:1,last_seen:1})]);
  return summarizeActivity({queries,clicks,carts,zero},{from:from.toISOString(),to:to.toISOString(),limit});
 }finally{await c.close();}
}
