// Builds the one file Rikushet's page loads: dist/semantix-rikushet.js = this configuration + the engine.
//   node exports/rikushet-cdn/build-bundle.mjs
// Same shape as exports/steimatzky-cdn/build-bundle.mjs: one tag (in GTM or the theme), no configuration round trip
// before the engine starts, and the shared engine file on the CDN is left as it is:
//   <script async src="https://rikushet-semantix.pages.dev/rikushet/semantix.js"></script>
// The store's site key comes from RIKUSHET_SITE_KEY or the user document (read only, never printed). The server can
// still steer the built file: abTests (the studio's rollout split) and features.disabled apply from the next page view.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {BOOT} from '../../core/takeover-export.mjs';

const ROOT='/Users/galpaz/Desktop/tenant-studio',HERE=new URL('./',import.meta.url),ENGINE='/Users/galpaz/Desktop/semantix-cdn/semantix-engine.min.js';
const require=createRequire(ROOT+'/x.js');
async function siteKey(){
 if(process.env.RIKUSHET_SITE_KEY)return process.env.RIKUSHET_SITE_KEY;
 require('dotenv').config({path:ROOT+'/.env'});
 const {MongoClient}=require('mongodb'),c=new MongoClient(process.env.STUDIO_DASHBOARD_MONGODB_URI||process.env.MONGODB_URI,{serverSelectionTimeoutMS:8000});
 try{await c.connect();const u=await c.db('users').collection('users').findOne({username:'rikushet'},{projection:{apiKey:1}});if(!u?.apiKey)throw Error('no apiKey on user rikushet');return u.apiKey;}finally{await c.close();}
}
const SITE_KEY=await siteKey();
const ENDPOINTS={siteConfig:'/site-config',search:'/search',fastSearch:'/fast-search',productClick:'/product-click',searchToCart:'/search-to-cart',zeroSearch:'/zero-search',logQuery:'/log-query',autocomplete:'/autocomplete'};
const inline=v=>JSON.stringify(v).replace(/</g,'\\u003c').replace(new RegExp('\\u2028','g'),'\\u2028').replace(new RegExp('\\u2029','g'),'\\u2029');
const swap=(text,from,to)=>{if(text.split(from).length!==2)throw Error('BOOT changed; not found: '+from.slice(0,60));return text.replace(from,()=>to);};

const config=JSON.parse(await readFile(new URL('siteConfig.json',HERE),'utf8'));
config.nativeCard.cardTemplate=(await readFile(new URL('card.html',HERE),'utf8')).trim();
// Production settings: shoppers get Semantix (no shadow), no console logging, no consent bar.
config.features={...config.features,shadowMode:false,disabled:false};
config.debug={enabled:false};
config.behavior={...config.behavior,fallbackMs:0};
config.replace={...config.replace,loader:{...(config.replace?.loader||{}),color:'#bfd630'}};
// Enter opens the store's home page with ?sx_q= (it answers in ~0.1 s, the results page in ~2.8 s): a loader, then the
// full Semantix results there. The store's own results page and search are never requested.
config.autocomplete={...config.autocomplete,searchInPage:true,resultsShell:{path:'/',param:'sx_q',native:'/catalogsearch/result/'}};
config.consent={...config.consent,enabled:false};
// The store's cards have no add-to-cart button (color and size are picked on the product page): none here either.
config.addToCart={mode:'off'};
// The same vendor's custom checkout as Steimatzky (Idus_Checkout); not seen on a real Rikushet order yet.
config.orderTracking={...config.orderTracking,pages:['/checkout/index/success','/checkout/onepage/success','/checkout/success']};
// Built-in split = what a visitor gets when the server's answer is late or missing: the store's own search (shadow),
// Semantix only for the pinned operator browser (open any page once with ?semantix_vid=vis-test-rikushet).
config.abTests={...(config.abTests||{}),semantix_takeover:{enabled:true,sticky:false,fallback:true,updatedBy:'build-bundle',variants:[{id:'semantix',weight:0},{id:'native',weight:100,features:{shadowMode:true}}],pins:{'vis-test-rikushet':'semantix'}}};
let engine=await readFile(ENGINE,'utf8');
const prepaint=(await readFile(new URL('prepaint.js',HERE),'utf8')).split('\n').filter(l=>!l.startsWith('//')).join('\n').trim();
if(!prepaint.includes('semantix-antiflicker'))throw Error('pre-paint script not found in prepaint.js');
const skin=(await readFile(new URL('skin.js',HERE),'utf8')).split('\n').filter(l=>!l.startsWith('//')).join('\n').trim();
const theme=(await readFile(new URL('theme.css',HERE),'utf8')).replace(/\/\*[\s\S]*?\*\//g,'').replace(/\s*\n\s*/g,'').trim();
if(!engine.includes('window.SemantixSettings'))throw Error('engine file not found');
const version=createHash('sha256').update(inline(config)).update(engine).update(prepaint).update(theme).update(skin).update(SITE_KEY).digest('hex').slice(0,12);

let boot=BOOT;
boot=swap(boot,"var s=document.createElement('script');s.src=S.engineSrc;s.async=false;document.head.appendChild(s);","engine();");
boot=swap(boot,"function merge(over){","function merge(over){var o={};if(over&&over.abTests&&typeof over.abTests==='object')o.abTests=over.abTests;if(over&&over.features&&over.features.disabled===true)o.features={disabled:true};over=o;");
boot=swap(boot,"var timer=setTimeout(start,2000);","var timer=setTimeout(start,1000);");

const out=`/*! Semantix search · rikushet.co.il · ${version} · built ${new Date().toISOString()} */
(function(){
if(window.__semantix_bundle_ran||window.__semantix_engine_v5)return;window.__semantix_bundle_ran=true;
var me=document.currentScript,T=window.SemantixSettings||{},key=(me&&me.getAttribute('data-key'))||T.apiKey||${inline(SITE_KEY)};
try{${prepaint}}catch(e){}
try{${skin}}catch(e){}
try{var th=document.createElement('style');th.id='semantix-rikushet-theme';th.textContent=${inline(theme)};document.head.appendChild(th);}catch(e){}
window.__semantix_loader_ran=true;window.__semantix_engine_loaded=true;
var S={apiBase:((me&&me.getAttribute('data-api'))||T.apiBase||'https://api.semantix-ai.com').replace(/\\/+$/,''),apiKey:key,version:${inline(version)},endpoints:${inline(ENDPOINTS)},siteConfig:${inline(config)}};
try{Object.defineProperty(window,'SemantixSettings',{configurable:false,get:function(){return S;},set:function(){}});}catch(e){window.SemantixSettings=S;}
function engine(){
${engine}
}
${boot}
})();
`;
await mkdir(new URL('dist/',HERE),{recursive:true});
await writeFile(new URL('dist/semantix-rikushet.js',HERE),out);
console.log('dist/semantix-rikushet.js',(out.length/1024).toFixed(0)+' KB','version',version);
