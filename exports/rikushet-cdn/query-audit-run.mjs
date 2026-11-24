// Runs every distinct Rikushet query through the studio's search (the same revision as production) and scores it
// against what shoppers did after the store's search: was a product they clicked or added in our top 12 / 24, was it
// in our catalog at all, and did we return anything. Read only apart from the report.
//   node exports/rikushet-cdn/query-audit-run.mjs [concurrency=3]
import {readFile,writeFile} from 'node:fs/promises';
const ROOT='/Users/galpaz/Desktop/tenant-studio',DIR=ROOT+'/reports/rikushet-queries-2026-11-14',ID='5abfb35b-d727-4424-a8b1-ad3dc1940a59';
(await import(ROOT+'/node_modules/dotenv/lib/main.js')).default.config({path:ROOT+'/.env'});
const {createDraftRuntime}=await import(ROOT+'/runtime.mjs'),{hash}=await import(ROOT+'/core/catalog.mjs'),{createStore}=await import(ROOT+'/store.mjs');
const p=await createStore(ROOT+'/data').read(ID),rev=structuredClone(p.revisions.at(-1));
const rt=createDraftRuntime({...p,productCardsProfileHash:hash(rev.profile)},rev);
const key=u=>{try{return decodeURIComponent(new URL(u,'https://www.rikushet.co.il').pathname).split('/').filter(Boolean).pop()?.toLowerCase()||null}catch{return null}};
const live=new Map();for(const c of p.productCards){const k=key(c.url);live.set(k,c);live.set(String(c.sku||c.id).toLowerCase(),c);}
const rows=JSON.parse(await readFile(DIR+'/queries.json','utf8')),out=[];let next=0,done=0;
async function one(r){
 const t=Date.now();let res,error=null;try{res=await rt.search({query:r.query,limit:24});}catch(e){error=e.message;}
 const keys=(res?.matches||[]).map(m=>key(m.url));
 const judge=set=>{const ks=Object.keys(set);return ks.map(k=>{const c=live.get(k);return {key:k,name:r.names[k]||null,inCatalog:!!c,hidden:!!c?.hidden,rank:keys.indexOf(k)+1||null};});};
 out.push({query:r.query,searches:r.searches,visitors:r.visitors,ms:Date.now()-t,error,total:res?.total??null,returned:keys.length,
  mode:res?.metadata?.mode||res?.mode||null,top:(res?.matches||[]).slice(0,8).map(m=>m.title),clicks:judge(r.clicks),adds:judge(r.adds)});
 if(++done%25===0)process.stdout.write(`\r${done}/${rows.length}`);
}
await Promise.all(Array.from({length:Number(process.argv[2])||3},async()=>{while(next<rows.length)await one(rows[next++]);}));
const W=x=>x.searches,sum=(a,f)=>a.reduce((s,x)=>s+f(x),0);
const withTruth=out.filter(x=>x.clicks.length||x.adds.length),hit=(x,n)=>[...x.clicks,...x.adds].some(c=>c.rank&&c.rank<=n);
const summary={queries:out.length,searches:sum(out,W),errors:out.filter(x=>x.error).length,
 zero:{queries:out.filter(x=>!x.returned).length,searches:sum(out.filter(x=>!x.returned),W)},
 withClickOrAdd:withTruth.length,hitTop12:withTruth.filter(x=>hit(x,12)).length,hitTop24:withTruth.filter(x=>hit(x,24)).length,
 truthNotInCatalog:withTruth.filter(x=>[...x.clicks,...x.adds].every(c=>!c.inCatalog)).length,
 medianMs:out.map(x=>x.ms).sort((a,b)=>a-b)[Math.floor(out.length/2)]};
await writeFile(DIR+'/results.json',JSON.stringify({summary,results:out.sort((a,b)=>b.searches-a.searches)},null,1));
console.log('\n',summary,'\n'+DIR+'/results.json');
