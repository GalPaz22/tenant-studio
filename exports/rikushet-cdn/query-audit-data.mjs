// Reads Rikushet's logged searches and what shoppers did after them (clicks, adds) into one file per distinct query.
// Read only.   node exports/rikushet-cdn/query-audit-data.mjs → reports/rikushet-queries-<date>/queries.json
import {writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const ROOT='/Users/galpaz/Desktop/tenant-studio',require=createRequire(ROOT+'/x.js');require('dotenv').config({path:ROOT+'/.env'});
const {MongoClient}=require('mongodb');
const norm=q=>String(q||'').replace(/\s+/g,' ').trim().toLowerCase();
const key=u=>{try{return decodeURIComponent(new URL(u,'https://www.rikushet.co.il').pathname).split('/').filter(Boolean).pop()?.toLowerCase()||null}catch{return null}};
const c=await new MongoClient(process.env.STUDIO_DASHBOARD_MONGODB_URI||process.env.MONGODB_URI).connect(),db=c.db('rikushet');
const by=new Map(),get=q=>{if(!by.has(q))by.set(q,{query:q,searches:0,visitors:new Set(),clicks:new Map(),adds:new Map(),names:new Map()});return by.get(q);};
for await(const r of db.collection('queries').find({},{projection:{query:1,session_id:1}})){const q=norm(r.query);if(q.length<2)continue;const e=get(q);e.searches++;e.visitors.add(r.session_id);}
// A click or add counts for a query only when it is linked to that search (results page, typed list or a clicked result).
const linked=r=>['results_page','clicked_result','typed_results','autocomplete'].includes(r.search_link)&&r.search_query;
for await(const r of db.collection('product_clicks').find({},{projection:{search_query:1,search_link:1,product_url:1,product_name:1}})){if(!linked(r))continue;const e=by.get(norm(r.search_query));if(!e)continue;const k=key(r.product_url);if(!k)continue;e.clicks.set(k,(e.clicks.get(k)||0)+1);e.names.set(k,r.product_name);}
for await(const r of db.collection('cart').find({event_type:'add_to_cart'},{projection:{search_query:1,search_link:1,product_url:1,card_path:1,product_name:1}})){if(!linked(r))continue;const e=by.get(norm(r.search_query));if(!e)continue;const k=key(r.card_path||r.product_url);if(!k)continue;e.adds.set(k,(e.adds.get(k)||0)+1);e.names.set(k,r.product_name);}
await c.close();
const rows=[...by.values()].map(e=>({query:e.query,searches:e.searches,visitors:e.visitors.size,clicks:Object.fromEntries(e.clicks),adds:Object.fromEntries(e.adds),names:Object.fromEntries(e.names)})).sort((a,b)=>b.searches-a.searches);
const file=ROOT+'/reports/rikushet-queries-2026-11-14/queries.json';await writeFile(file,JSON.stringify(rows,null,1));
console.log({distinct:rows.length,searches:rows.reduce((s,r)=>s+r.searches,0),withClick:rows.filter(r=>Object.keys(r.clicks).length).length,withAdd:rows.filter(r=>Object.keys(r.adds).length).length},'\n'+file);
console.log(rows.slice(0,25).map(r=>r.searches+' '+r.query).join(' · '));
