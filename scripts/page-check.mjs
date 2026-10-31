// Product-page check for an existing client's catalog (core/page-check.mjs). Dry run only: it reads the client's
// products from Mongo, asks each never-stamped product's page, and writes reports/page-check-<db>-<date>.json.
// Nothing is written to Mongo.
//   node scripts/page-check.mjs --db steimatzky [--collection products] [--all] [--limit N]
import 'dotenv/config';
import {writeFileSync,mkdirSync} from 'node:fs';
import {MongoClient} from 'mongodb';
import {rowsToCheck,checkPages,classify} from '../core/page-check.mjs';

const args=process.argv.slice(2),opt=k=>{const i=args.indexOf('--'+k);return i<0?undefined:args[i+1]&&!args[i+1].startsWith('--')?args[i+1]:true;};
const db=opt('db'),coll=opt('collection')||'products';if(typeof db!=='string')throw Error('--db <name> is required');
const client=await MongoClient.connect(process.env.MONGODB_URI);
let rows;try{rows=await client.db(db).collection(coll).find({},{projection:{_id:0,id:1,name:1,url:1,permalink:1,lastSeenAt:1,stockStatus:1,price:1}}).toArray();}finally{await client.close();}
let todo=rowsToCheck(rows,{all:opt('all')===true});const limit=Number(opt('limit'));if(limit>0)todo=todo.slice(0,limit);
console.log(`${db}.${coll}: ${rows.length} rows, checking ${todo.length} pages`);
const results=await checkPages(todo,{fetch,onProgress:(n,t)=>{if(n%200===0||n===t)console.log(`progress ${n}/${t}`);}});
const meta=new Map(todo.map(r=>[String(r.id),r])),counts={},byStock={},byStatus={};
for(const r of results){const m=meta.get(r.id);r.name=String(m?.name||'').slice(0,80);r.stockStatus=m?.stockStatus??null;r.result=classify(r.status);
 counts[r.result]=(counts[r.result]||0)+1;const k=r.result+'|'+(r.stockStatus||'unknown');byStock[k]=(byStock[k]||0)+1;byStatus[r.status??'error']=(byStatus[r.status??'error']||0)+1;}
const summary={checked:results.length,counts,byStock,byStatus},file=`reports/page-check-${db}-${new Date().toISOString().slice(0,10)}.json`;
mkdirSync('reports',{recursive:true});writeFileSync(file,JSON.stringify({db,collection:coll,at:new Date().toISOString(),dryRun:true,summary,results},null,1));
console.log(JSON.stringify(summary,null,1)+'\nreport: '+file);
