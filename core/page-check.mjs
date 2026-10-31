// Product-page liveness for an existing client's catalog: the store's own page answers 404/410 for a product it removed.
// Rows no sync ever stamped (lastSeenAt) carry no field that tells a live product from a dead one, so the page is asked.
// Anything other than 404/410 (200, a redirect that lands on a page, 403 from the store's CDN, a timeout) counts as live
// or unknown, never as gone.
export const GONE=[404,410];
const UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

// Rows worth asking: never stamped by a sync in a catalog whose syncs stamp most rows. all:true asks every row with a page URL.
export function rowsToCheck(rows,{all=false}={}){
 const stamped=rows.filter(r=>r.lastSeenAt).length,tracked=rows.length>0&&stamped>=rows.length/2;
 return rows.filter(r=>pageUrl(r)&&(all||(tracked&&!r.lastSeenAt)));
}
export const pageUrl=r=>{try{const u=new URL(r.url||r.permalink);return ['http:','https:'].includes(u.protocol)?u.href:null;}catch{return null;}};

// HEAD first (no body); a store that refuses HEAD is asked with GET. status null = no answer (network error, timeout).
export async function checkPage(url,{fetch=globalThis.fetch,timeoutMs=15000}={}){
 const ask=async method=>{const r=await fetch(url,{method,redirect:'follow',headers:{'user-agent':UA},signal:AbortSignal.timeout(timeoutMs)});r.body?.cancel?.().catch(()=>{});return r.status;};
 try{const s=await ask('HEAD');return [405,501].includes(s)?await ask('GET'):s;}catch{return null;}
}

// Checks rows a few at a time with a pause between requests, so the store sees a slow crawler, not a burst.
export async function checkPages(rows,{fetch,concurrency=4,delayMs=150,onProgress=()=>{}}={}){
 const out=new Array(rows.length);let next=0,done=0;
 const worker=async()=>{while(next<rows.length){const i=next++,r=rows[i];
  out[i]={id:String(r.id??r._id),url:pageUrl(r),status:await checkPage(pageUrl(r),{fetch})};
  onProgress(++done,rows.length);if(delayMs)await new Promise(s=>setTimeout(s,delayMs));}};
 await Promise.all(Array.from({length:Math.min(concurrency,rows.length)},worker));
 return out;
}

// gone = 404/410; live = any other answer; unknown = no answer or blocked (403/429/5xx).
export function classify(status){return GONE.includes(status)?'gone':status==null||status===403||status===429||status>=500?'unknown':'live';}
