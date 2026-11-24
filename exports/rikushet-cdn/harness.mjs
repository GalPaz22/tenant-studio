// Local check of the production bundle on the live Rikushet site: pages go through this origin with
// dist/semantix-rikushet.js as the store's tag would load it, answered by the studio's saved Rikushet project.
// Static files and images stay on the store, so only pages pass here (the store reacts to volume from one address).
// Read-only: nothing is written to the site, to production configuration or to the database.
//   ?__split=<0-100>  the share for Semantix in this harness's /site-config (default 100)
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {rolloutTest} from '../../core/takeover-control.mjs';
const ROOT='/Users/galpaz/Desktop/tenant-studio',HERE=ROOT+'/exports/rikushet-cdn',PORT=4396;
(await import(ROOT+'/node_modules/dotenv/lib/main.js')).default.config({path:ROOT+'/.env'});
const {createDraftRuntime}=await import(ROOT+'/runtime.mjs'),{hash}=await import(ROOT+'/core/catalog.mjs'),{enginePage,engineSuggestions}=await import(ROOT+'/core/takeover-preview.mjs');
const https=(await import('node:https')).default,{scrapeAgent,scrapeExit}=await import(ROOT+'/core/egress.mjs');
function upstream(url,{method='GET',headers={},body}={}){
 return new Promise((ok,fail)=>{
  const req=https.request(url,{method,headers,agent:scrapeAgent()},res=>{const c=[];res.on('data',x=>c.push(x));res.on('error',fail);
   res.on('end',()=>ok({status:res.statusCode,type:String(res.headers['content-type']||''),location:res.headers.location||null,cookies:res.headers['set-cookie']||[],body:Buffer.concat(c)}));});
  req.setTimeout(30000,()=>req.destroy(Error('store timeout')));req.on('error',fail);req.end(body);
 });
}
const p=JSON.parse(await readFile(ROOT+'/data/5abfb35b-d727-4424-a8b1-ad3dc1940a59.json','utf8')),rev=structuredClone(p.revisions.at(-1));
const SITE='https://www.rikushet.co.il',ME='http://localhost:'+PORT;
const rt=createDraftRuntime({...p,productCardsProfileHash:hash(rev.profile)},rev),events=[];
const local=u=>typeof u==='string'?u.replace(SITE,ME):u;
const raw=req=>new Promise(r=>{const c=[];req.on('data',x=>c.push(x));req.on('end',()=>r(Buffer.concat(c)));});
const body=async req=>{try{return JSON.parse((await raw(req)).toString()||'{}')}catch{return {}}};
const jar=new Map();
// Pages link here; /pub/ (static files, images) stays on the store.
const rewrite=t=>t.split(SITE+'/').join(ME+'/').split(ME+'/pub/').join(SITE+'/pub/').split('https:\\/\\/www.rikushet.co.il\\/').join('http:\\/\\/localhost:'+PORT+'\\/').split('http:\\/\\/localhost:'+PORT+'\\/pub\\/').join('https:\\/\\/www.rikushet.co.il\\/pub\\/').split(SITE).join(ME);
async function proxy(req,res,u){
 if(u.searchParams.has('__split')){const v=u.searchParams.get('__split');u.searchParams.delete('__split');res.writeHead(302,{'Set-Cookie':'sx_split='+(/^\d+$/.test(v)?v:'')+'; Path=/; SameSite=Lax','Location':u.pathname+u.search});return res.end();}
 const headers={'User-Agent':req.headers['user-agent']||'Mozilla/5.0','Accept':req.headers.accept||'*/*','Accept-Language':'he-IL,he;q=0.9'};
 for(const h of ['content-type','x-requested-with'])if(req.headers[h])headers[h]=req.headers[h];
 if(jar.size)headers.Cookie=[...jar].map(([k,v])=>k+'='+v).join('; ');
 const b=['GET','HEAD'].includes(req.method)?undefined:await raw(req);
 const r=await upstream(SITE+u.pathname+u.search,{method:req.method,headers,body:b&&b.length?b:undefined});
 for(const c of r.cookies){const m=/^([^=;]+)=([^;]*)/.exec(c);if(m)jar.set(m[1],m[2]);}
 const out={'Content-Type':r.type,'Cache-Control':/text\/html|json/.test(r.type)?'no-store':'public, max-age=600'};if(r.location)out.Location=r.location.replace(SITE,ME);
 if(/text\/html|json/.test(r.type)){
  let t=rewrite(r.body.toString('utf8')).split('www.googletagmanager.com').join('gtm.invalid');
  if(/text\/html/.test(r.type))t=t.replace('</head>',()=>'<script async src="/__sx/bundle.js" data-key="harness" data-api="/__sx"></script></head>');
  res.writeHead(r.status,out);return res.end(t);
 }
 res.writeHead(r.status,out);res.end(r.body);
}
createServer(async(req,res)=>{
 const u=new URL(req.url,'http://x');
 if(!u.pathname.startsWith('/__sx/'))return proxy(req,res,u).catch(e=>{res.writeHead(502);res.end(String(e));});
 u.pathname=u.pathname.slice(5);
 const json=(v,code=200)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(v));};
 try{
  if(u.pathname==='/bundle.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});return res.end(await readFile(HERE+'/dist/semantix-rikushet.js'));}
  if(u.pathname==='/site-config'){const m=/(?:^|;\s*)sx_split=(\d+)/.exec(req.headers.cookie||''),c=JSON.parse(await readFile(HERE+'/siteConfig.json','utf8'));c.abTests={...(c.abTests||{}),semantix_takeover:rolloutTest(m?Number(m[1]):100,{by:'harness'})};return json(c);}
  if(u.pathname==='/events')return json(events.slice(-60));
  if(u.pathname==='/search'||u.pathname==='/fast-search'){const b=await body(req);events.push({at:Date.now(),kind:u.pathname,query:b.query});return json(enginePage(await rt.search({query:String(b.query||'').slice(0,200),limit:Math.min(Number(b.limit)||24,48)}),local));}
  if(u.pathname==='/search/load-more'||u.pathname==='/search/auto-load-more'){events.push({at:Date.now(),kind:u.pathname});return json(enginePage(await rt.search({cursor:String(u.searchParams.get('token')||''),limit:24}),local));}
  if(u.pathname==='/autocomplete'){const q=String(u.searchParams.get('query')||'').trim();if(q.length<2)return json([]);events.push({at:Date.now(),kind:'autocomplete',query:q});const r=await rt.suggest(q,{limit:Math.min(Number(u.searchParams.get('limit'))||10,24)}),full=enginePage(r,local).products,by=new Map(full.map(x=>[x.id,x]));return json(engineSuggestions(r.matches,local).map(x=>({...by.get(x.id),...x})));}
  if(req.method==='POST'){events.push({at:Date.now(),kind:u.pathname,body:await body(req)});return res.writeHead(204).end();}
  json({error:'not found'},404);
 }catch(e){json({error:e.message},500);}
}).listen(PORT,'127.0.0.1',()=>{const exit=scrapeExit();console.log('rikushet harness on '+ME+' ·',p.productCards.length,'products · store requests go '+(exit.proxied?'through '+exit.kind+' proxy '+exit.host+':'+exit.port:'out directly (STUDIO_SCRAPE_PROXY is not set)'));});
