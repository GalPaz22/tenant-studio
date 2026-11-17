// Shipi 16.11: re-id every crawl: card that has a live Mongo row (matched by URL) to the live id.
// Dry run by default; --apply saves and publishes (ask first).
import 'dotenv/config';
import {readFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {MongoClient} from 'mongodb';
import {createStore} from '../store.mjs';
import {publishModule,readPublished} from '../core/module-publish.mjs';
import {hash} from '../core/hash.mjs';
const root=resolve(new URL('../',import.meta.url).pathname),id='a6e8f510-d27c-4776-95e6-3f7c5d3db2dc',file=resolve(root,'data',id+'.json');
const source=await readFile(file,'utf8'),p=JSON.parse(source);
const c=new MongoClient(process.env.STUDIO_DASHBOARD_MONGODB_URI||process.env.MONGODB_URI,{serverSelectionTimeoutMS:10000});
try{await c.connect();
 const rows=await c.db('shipi').collection('products').find({notInStore:{$ne:true}},{projection:{id:1,url:1}}).toArray();
 const norm=u=>String(u||'').replace(/\/$/,'').toLowerCase(),byUrl=new Map(rows.map(r=>[norm(r.url),String(r.id)]));
 const taken=new Set(p.productCards.map(x=>String(x.id))),map=new Map(),targets=new Set();
 for(const x of p.productCards){if(!String(x.id).startsWith('crawl:'))continue;const to=byUrl.get(norm(x.url));if(!to)continue;if(taken.has(to)||targets.has(to))throw Error('target id collision '+to);targets.add(to);map.set(x.id,to);}
 console.log('mapped',map.size);
 const walk=v=>{if(typeof v==='string')return map.get(v)??v;if(Array.isArray(v)){for(let i=0;i<v.length;i++)v[i]=walk(v[i]);return v;}if(v&&typeof v==='object'){for(const k of Object.keys(v)){const nk=map.get(k)??k,val=walk(v[k]);if(nk!==k){delete v[k];}v[nk]=val;}}return v;};
 const q=walk(structuredClone(p));
 const left=q.productCards.filter(x=>String(x.id).startsWith('crawl:')).length;
 console.log('cards',q.productCards.length,'crawl left',left,'catalog',q.catalog.products.length);
 if(left!==p.productCards.filter(x=>String(x.id).startsWith('crawl:')).length-map.size)throw Error('unexpected remaining crawl count');
 if(!process.argv.includes('--apply')){console.log('dry run ok');process.exit(0);}
 const head=await readPublished(q,'shipi',{client:c});console.log('head',head.digest,head.revision);
 if(hash(await readFile(file,'utf8'))!==hash(source))throw Error('Project changed');
 await copyFile(file,resolve(root,'data/backups',id+'.before-relink-all-1116-'+Date.now()+'.json'));
 q.mongoPolicyDirty=true;q.updatedAt=new Date().toISOString();q.events??=[];q.events.push({at:q.updatedAt,text:`קישור ${map.size} כרטיסי crawl למזהים החיים`});
 await createStore(resolve(root,'data')).save(q);
 console.log(JSON.stringify(await publishModule(q,'shipi',{client:c})));
}finally{await c.close();}
