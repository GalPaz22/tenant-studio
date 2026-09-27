import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';

// Preview of a full search takeover inside the demo mirror: the real semantix-cdn loader and engine run on the mirrored
// store, but their API is the studio (the project's current search revision), so nothing reaches production. Tracking
// calls the engine makes (clicks, add-to-cart, checkout) are kept in a short per-project log, which is how the studio
// verifies that the store's cart and checkout traffic is recognised.

const CDN='https://cdn.semantix-ai.com';
export const ENGINE_FILES={'loader.js':'semantix-loader.min.js','engine.js':'semantix-engine.min.js'};
// A local semantix-cdn checkout (unreleased engine changes) wins over the published CDN.
export function engineDir(){
 const dir=process.env.SEMANTIX_CDN_DIR||resolve(process.env.HOME||'','Desktop/semantix-cdn');
 return existsSync(resolve(dir,ENGINE_FILES['engine.js']))?dir:null;
}
export async function engineSource(name){
 const file=ENGINE_FILES[name];if(!file)return null;
 const dir=engineDir();if(dir)return {code:await readFile(resolve(dir,file),'utf8'),from:'local'};
 const r=await fetch(`${CDN}/${file}`);if(!r.ok)throw Error(`CDN ${r.status}`);return {code:await r.text(),from:'cdn'};
}

export function engineTag(project){
 const base=`/demo/${project.id}/__semantix/engine`;
 // configVersion changes whenever the project is saved, so an edit in the studio shows on the next demo load
 // instead of after the loader's 5-minute config cache.
 const settings={apiBase:base,apiKey:'studio-preview',engineSrc:base+'/engine.js',version:String(Date.now()),configVersion:String(project.updatedAt||''),
  endpoints:{siteConfig:'/site-config',search:'/search',fastSearch:'/fast-search',productClick:'/product-click',searchToCart:'/search-to-cart',zeroSearch:'/zero-search'}};
 // Stores that already run Semantix (e.g. through GTM) assign their own SemantixSettings later in the page, and the
 // mirror also injects this tag into HTML fragments the site loads with AJAX. Both would replace the preview's settings
 // (and the config the loader attached to them), so the preview's object is pinned and later assignments are ignored.
 // The store's own loader then stops at its "already ran" guard.
 const pin=`(function(){if(window.__semantixStudioPreview)return;window.__semantixStudioPreview=true;var s=${JSON.stringify(settings).replace(/</g,'\\u003c')};try{Object.defineProperty(window,'SemantixSettings',{configurable:false,get:function(){return s;},set:function(){}});}catch(e){window.SemantixSettings=s;}})();`;
 return `<meta name="robots" content="noindex,nofollow"><script>${pin}</script><script src="${base}/loader.js"></script>`;
}

// The config the preview engine receives: the proposal, with consent and branding prompts off so the page shows the
// store as shoppers will see it after the first visit.
export function previewConfig(takeover){
 const cfg=structuredClone(takeover?.siteConfig||{});
 cfg.consent={...(cfg.consent||{}),enabled:false};cfg.debug={enabled:true};
 return cfg;
}

// Studio search results → the engine's product shape (dashboard-server /search).
export function engineProducts(matches,productUrl){
 return (matches||[]).map(p=>({id:p.id,name:p.title,url:productUrl(p.url),image:p.image,price:p.price,regularPrice:p.regularPrice,
  onSale:Number.isFinite(p.regularPrice)&&Number.isFinite(p.price)&&p.regularPrice>p.price,stockStatus:p.stockStatus,author:p.specifications?.author||'',sku:p.sku||''}));
}
export const enginePage=(r,productUrl)=>({products:engineProducts(r.matches,productUrl),pagination:{hasMore:!!r.nextCursor,nextToken:r.nextCursor||null,totalAvailable:r.total??null,returned:(r.matches||[]).length}});

const logs=new Map(),LIMIT=200;
export function recordEvent(projectId,kind,body){
 const list=logs.get(projectId)||[];
 const json=body&&typeof body==='object'?JSON.stringify(body):'';
 list.push({at:new Date().toISOString(),kind,body:!json?null:json.length<=4000?JSON.parse(json):{truncated:true,keys:Object.keys(body).slice(0,30)}});
 logs.set(projectId,list.slice(-LIMIT));
}
export const readEvents=projectId=>logs.get(projectId)||[];
export const clearEvents=projectId=>logs.delete(projectId);
