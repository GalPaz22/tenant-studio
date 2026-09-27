// Live demo mirror: serves a tenant's own storefront through the studio, byte-for-byte from its origin,
// with URLs rewritten to stay inside /demo/:id and the semantix search overlay injected.
// Scope: only the project's own host is proxied (not an open proxy); reads only (GET/HEAD); no cookies either way.
import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {gunzipSync,inflateSync,brotliDecompressSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {publicAddress} from '../discover.mjs';

const MAX_BYTES=25*1024*1024;
const DROP=new Set(['content-security-policy','content-security-policy-report-only','x-frame-options','strict-transport-security','set-cookie','content-length','content-encoding','transfer-encoding','connection','keep-alive','alt-svc','link','referrer-policy','cross-origin-opener-policy','cross-origin-embedder-policy','cross-origin-resource-policy','report-to','nel','permissions-policy','clear-site-data','expect-ct','server-timing']);
const TEXT=/^(text\/|application\/(javascript|x-javascript|json|ld\+json|xml|rss\+xml|manifest\+json)|image\/svg)/i;

// Bot-protection interstitials (Cloudflare, Shopify, generic). Never cached; they pause the site's harvesting.
const CHALLENGE=/needs to be verified|challenge-platform|cf-chl|just a moment\.\.\.|attention required|verify you are human|captcha/i;
export function isChallenge(r){
 const type=String(r.headers?.['content-type']||'');if(!/html/i.test(type)&&r.status<400)return false;
 const head=r.body.subarray(0,40000).toString('utf8');
 return r.status>=400?[403,429,503].includes(r.status)&&CHALLENGE.test(head):r.body.length<40000&&/needs to be verified|challenge-platform|cf-chl|just a moment\.\.\./i.test(head);
}
export class SiteBlocked extends Error{constructor(until){super('האתר חסם זמנית את בקשות שרת ההדגמה (הגנת בוטים)');this.until=until;}}
export const mirrorHosts=url=>{const h=new URL(url).hostname.toLowerCase().replace(/^www\./,'');return [h,'www.'+h];};
const escapeRe=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

// Absolute same-store URLs (plain, protocol-relative, JSON-escaped, URL-encoded) → mirror prefix.
export function rewriteAbsolute(text,hosts,prefix){
 const h=hosts.map(escapeRe).join('|');
 return text
  .replace(new RegExp(`(?:https?:)?//(?:${h})(?=[/"'\\s?#)<>]|$)`,'gi'),prefix)
  .replace(new RegExp(`(?:https?:)?\\\\/\\\\/(?:${h})(?=\\\\/|["'?#])`,'gi'),prefix.replaceAll('/','\\/'))
  .replace(new RegExp(`https?%3A%2F%2F(?:${h})(?=%2F|["'&])`,'gi'),encodeURIComponent(prefix));
}
const rootRelative=(value,prefix)=>value.startsWith('/')&&!value.startsWith('//')&&!value.startsWith(prefix+'/')&&value!==prefix?prefix+value:value;

// absolute: what absolute store URLs become (defaults to the path prefix). On the demo host the prefix is "" but
// absolute URLs stay absolute (the demo host's origin), because site code builds URLs from them (homeUrl + "path").
export function rewriteCss(css,hosts,prefix,absolute=prefix){
 return rewriteAbsolute(css,hosts,absolute)
  .replace(/url\(\s*(['"]?)(\/(?!\/)[^'")]*)\1\s*\)/gi,(_,q,u)=>`url(${q}${rootRelative(u,prefix)}${q})`)
  .replace(/@import\s+(['"])(\/(?!\/)[^'"]*)\1/gi,(_,q,u)=>`@import ${q}${rootRelative(u,prefix)}${q}`);
}

export function rewriteHtml(html,{hosts,prefix,inject='',absolute=prefix}){
 let out=rewriteAbsolute(html,hosts,absolute);
 out=out.replace(/(\s(?:href|src|action|poster|data-src|data-href|data-url|data-lazy-src|data-bg|formaction)\s*=\s*)(["'])(\/(?!\/)[^"']*)\2/gi,(_,a,q,u)=>a+q+rootRelative(u,prefix)+q);
 out=out.replace(/(\s(?:srcset|data-srcset|imagesrcset)\s*=\s*)(["'])([^"']*)\2/gi,(_,a,q,v)=>a+q+v.split(',').map(part=>part.replace(/^(\s*)(\/(?!\/)\S*)/,(_m,s,u)=>s+rootRelative(u,prefix))).join(',')+q);
 out=out.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,(_,o,css,c)=>o+rewriteCss(css,hosts,prefix,absolute)+c);
 out=out.replace(/(\sstyle\s*=\s*)(["'])([^"']*url\([^"']*)\2/gi,(_,a,q,css)=>a+q+rewriteCss(css,hosts,prefix,absolute)+q);
 // Rewritten resources would fail subresource integrity; CSP/referrer meta would break the mirror.
 out=out.replace(/\s(?:integrity|nonce)\s*=\s*(["'])[^"']*\1/gi,'');
 out=out.replace(/<meta[^>]+http-equiv\s*=\s*["']?(?:content-security-policy|refresh)["']?[^>]*>/gi,'');
 out=out.replace(/<meta[^>]+name\s*=\s*["']?referrer["']?[^>]*>/gi,'');
 out=out.replace(/<base\b[^>]*>/gi,'');
 const head=/<head\b[^>]*>/i.exec(out);
 return head?out.slice(0,head.index+head[0].length)+inject+out.slice(head.index+head[0].length):inject+out;
}

function decode(body,encoding=''){
 const e=String(encoding).toLowerCase();
 if(e.includes('br'))return brotliDecompressSync(body);
 if(e.includes('gzip'))return gunzipSync(body);
 if(e.includes('deflate'))try{return inflateSync(body)}catch{return body}
 return body;
}

// Pinned-DNS public HTTPS fetch that returns raw bytes and does NOT follow redirects (the browser does, inside the mirror).
export async function fetchOrigin(url,{userAgent,accept,language,ajax}={}){
 const u=new URL(url);
 if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443')throw Error('נדרשת כתובת HTTPS ציבורית');
 const answers=await lookup(u.hostname,{all:true,family:4});
 if(!answers.length||answers.some(x=>!publicAddress(x.address)))throw Error('כתובת רשת פנימית אינה מותרת');
 return new Promise((ok,fail)=>{
  const req=https.request(u,{method:'GET',headers:{'User-Agent':userAgent||'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36','Accept':accept||'*/*','Accept-Language':language||'he-IL,he;q=0.9,en;q=0.8','Accept-Encoding':'gzip, deflate, br',...(ajax?{'X-Requested-With':'XMLHttpRequest'}:{})},lookup:(_h,o,cb)=>o.all?cb(null,[{address:answers[0].address,family:4}]):cb(null,answers[0].address,4)},res=>{
   let size=0;const chunks=[];
   res.on('data',c=>{size+=c.length;if(size>MAX_BYTES)req.destroy(Error('המשאב גדול מדי למראה'));else chunks.push(c);});
   res.on('end',()=>{try{ok({status:res.statusCode,headers:res.headers,body:decode(Buffer.concat(chunks),res.headers['content-encoding'])})}catch(e){fail(e)}});
   res.on('error',fail);
  });req.setTimeout(20000,()=>req.destroy(Error('תם הזמן לטעינת האתר')));req.on('error',fail);req.end();
 });
}

export function createMirror({dataDir,fetcher=fetchOrigin}){
 const cacheDir=resolve(dataDir,'mirror');
 const keyOf=(id,url)=>resolve(cacheDir,id,createHash('sha256').update(url).digest('hex').slice(0,40));
 async function cached(id,url,refresh){
  const file=keyOf(id,url);
  if(!refresh)try{const meta=JSON.parse(await readFile(file+'.json','utf8'));return {...meta,body:await readFile(file+'.bin'),fromCache:true};}catch{}
  return null;
 }
 async function store(id,url,r){
  if(r.status!==200)return;
  const file=keyOf(id,url);await mkdir(resolve(cacheDir,id),{recursive:true});
  await writeFile(file+'.bin',r.body);await writeFile(file+'.json',JSON.stringify({status:r.status,headers:r.headers,url,savedAt:new Date().toISOString()}));
 }
 const blocked=new Map(); // project id → time until which background (harvest) fetches are paused
 async function raw(project,href,{refresh=false,background=false,...request}={}){
  if(!mirrorHosts(project.url).includes(new URL(href).hostname.toLowerCase()))throw Error('מחוץ לאתר הלקוח');
  let r=await cached(project.id,href,refresh);if(r)return r;
  if(background&&(blocked.get(project.id)||0)>Date.now())throw new SiteBlocked(blocked.get(project.id));
  r=await fetcher(href,request);
  if(isChallenge(r)){const until=Date.now()+10*60000;blocked.set(project.id,until);throw new SiteBlocked(until);}
  await store(project.id,href,r).catch(()=>{});
  return r;
 }
 // Origin text (cached, un-rewritten) for native search harvesting; null unless a 200 text response.
 async function fetchText(project,href,request={}){
  const r=await raw(project,href,{...request,background:true}),type=String(r.headers?.['content-type']||'');
  return r.status===200&&TEXT.test(type)?{text:r.body.toString('utf8'),type}:null;
 }
 // project: {id,url}; path: origin path+query (starting with /). Returns {status,headers,body}.
 // transform({url,text,type}) may return replacement origin text (before URL rewriting) or null.
 async function serve(project,path,{prefix='/demo/'+project.id,absolute=prefix,refresh=false,userAgent,accept,language,ajax,overlay,transform}={}){
  const origin=new URL(project.url).origin,hosts=mirrorHosts(project.url);
  const target=new URL(path,origin);if(!hosts.includes(target.hostname.toLowerCase()))throw Error('מחוץ לאתר הלקוח');
  const r=await raw(project,target.href,{refresh,userAgent,accept,language,ajax});
  const headers={};
  for(const [k,v] of Object.entries(r.headers||{}))if(!DROP.has(k.toLowerCase()))headers[k]=v;
  if(headers.location){const loc=new URL(headers.location,target);headers.location=hosts.includes(loc.hostname.toLowerCase())?prefix+loc.pathname+loc.search+loc.hash:loc.href;}
  headers['x-robots-tag']='noindex, nofollow';headers['referrer-policy']='same-origin';headers['cache-control']='no-store';
  const type=String(headers['content-type']||'');let body=r.body;
  if(TEXT.test(type)){
   let text=body.toString('utf8');
   // A failed transform serves the site's original response rather than breaking the page.
   if(transform&&r.status===200)try{const replaced=await transform({url:target.href,text,type,request:{userAgent,accept,language,ajax}});if(typeof replaced==='string')text=replaced;}catch(e){console.error('demo transform',target.pathname,e.message);}
   if(/html/i.test(type))text=rewriteHtml(text,{hosts,prefix,absolute,inject:overlay||''});
   else if(/css/i.test(type))text=rewriteCss(text,hosts,prefix,absolute);
   else text=rewriteAbsolute(text,hosts,absolute);
   body=Buffer.from(text,'utf8');
  }
  return {status:r.status,headers,body,fromCache:!!r.fromCache};
 }
 return {serve,fetchText,blockedUntil:id=>Math.max(0,(blocked.get(id)||0)-Date.now())};
}

// Shopper-facing snippet injected into every mirrored HTML page.
export function overlayTag(project,mode='native',prefix='/demo/'+project.id){
 const cfg={id:project.id,prefix,name:project.name||'',hosts:mirrorHosts(project.url),mode};
 return `<meta name="robots" content="noindex,nofollow"><script>window.__SEMANTIX_DEMO__=${JSON.stringify(cfg).replace(/</g,'\\u003c')};</script><script src="/demo-overlay.js"></script>`;
}
