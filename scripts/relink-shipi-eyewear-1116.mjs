// Shipi 16.11: three eyewear cards still carry crawl: ids while the live rows have numeric ids, so the
// "משקפיים" collection route dropped them. Re-id them by URL; --apply saves and publishes (ask first).
import 'dotenv/config';
import {readFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {MongoClient} from 'mongodb';
import {createStore} from '../store.mjs';
import {publishModule,readPublished} from '../core/module-publish.mjs';
import {hash} from '../core/hash.mjs';
const root=resolve(new URL('../',import.meta.url).pathname),id='a6e8f510-d27c-4776-95e6-3f7c5d3db2dc',file=resolve(root,'data',id+'.json');
const source=await readFile(file,'utf8');let text=source;const p=JSON.parse(source);
const c=new MongoClient(process.env.STUDIO_DASHBOARD_MONGODB_URI||process.env.MONGODB_URI,{serverSelectionTimeoutMS:10000});
try{await c.connect();
 const rows=await c.db('shipi').collection('products').find({source:'site-scan',categories:'משקפיים',notInStore:{$ne:true}},{projection:{id:1,url:1}}).toArray();
 const norm=u=>String(u||'').replace(/\/$/,'').toLowerCase(),byUrl=new Map(rows.map(r=>[norm(r.url),String(r.id)]));
 const map=[];for(const x of p.productCards)if(String(x.id).startsWith('crawl:')&&(x.collections||[]).includes('משקפיים')||String(x.id).startsWith('crawl:')&&JSON.stringify(x.tags).includes('d08c61c0')){const to=byUrl.get(norm(x.url));if(to)map.push([x.id,to]);}
 console.log(map);if(map.length!==3)throw Error('expected 3 matches, got '+map.length);
 for(const [from,to] of map){if(JSON.stringify(to)&&text.includes(JSON.stringify(to)))console.warn('target id already present',to);text=text.split(JSON.stringify(from)).join(JSON.stringify(to));}
 const q=JSON.parse(text);console.log('cards now',q.productCards.filter(x=>map.some(m=>m[1]===x.id)).map(x=>x.id+' '+x.title.slice(0,40)));
 if(!process.argv.includes('--apply')){console.log('dry run ok');process.exit(0);}
 const head=await readPublished(q,'shipi',{client:c});console.log('head',head.digest,head.revision);
 if(hash(await readFile(file,'utf8'))!==hash(source))throw Error('Project changed');
 await copyFile(file,resolve(root,'data/backups',id+'.before-relink-1116-'+Date.now()+'.json'));
 q.mongoPolicyDirty=true;q.updatedAt=new Date().toISOString();q.events??=[];q.events.push({at:q.updatedAt,text:'קישור שלושה כרטיסי משקפיים למזהים החיים'});
 await createStore(resolve(root,'data')).save(q);
 console.log(JSON.stringify(await publishModule(q,'shipi',{client:c})));
}finally{await c.close();}
