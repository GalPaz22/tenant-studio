// Builds the one file Mano Vino's page loads for the concierge: dist/semantix-manovino.js = concierge.css + concierge.js.
//   node exports/manovino-cdn/build-bundle.mjs
// It stands on its own: the site's search (/AISearch/) and its tracking script (manoVino.js on the worker) stay as they
// are. The whole install is one tag after the tracking script (theme or GTM):
//   <script async src="https://manovino-semantix.pages.dev/manovino/semantix.js"></script>
// The keys are the ones the tracking script already prints on every page; data-key / data-api on the tag win over them.
// Who sees the panel is the server's switch, users.conciergeRollout ({visitors:[...]} or {enabled:true}); without it
// /concierge/decide answers open:false and nothing shows.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const SEARCH_KEY=process.env.MANOVINO_SITE_KEY||'semantix_688736e523c0352ad78525fe_1753691812345';
const TRACKING_KEY=process.env.MANOVINO_TRACKING_KEY||'16d045a947580156564aaaa46e127d8b';
// Seconds on the results without opening a bottle before the idle moment is asked.
const IDLE_MS=Number(process.env.MANOVINO_IDLE_MS)||12000;
const HERE=new URL('./',import.meta.url);
const inline=v=>JSON.stringify(v).replace(/</g,'\\u003c').replace(new RegExp('\\u2028','g'),'\\u2028').replace(new RegExp('\\u2029','g'),'\\u2029');

const js=(await readFile(new URL('concierge.js',HERE),'utf8')).split('\n').filter(l=>!l.startsWith('//')).join('\n').trim();
if(!js.startsWith('function semantixManoVinoConcierge(S){'))throw Error('concierge script not found in concierge.js');
const css=(await readFile(new URL('concierge.css',HERE),'utf8')).replace(/\/\*[\s\S]*?\*\//g,'').replace(/\s*\n\s*/g,'').trim();
const version=createHash('sha256').update(js).update(css).update(SEARCH_KEY).update(TRACKING_KEY).update(String(IDLE_MS)).digest('hex').slice(0,12);

const out=`/*! Semantix concierge · manovino.co.il · ${version} · built ${new Date().toISOString()} */
(function(){
if(window.__semantix_mv_concierge)return;window.__semantix_mv_concierge=true;
var me=document.currentScript;
var S={apiBase:((me&&me.getAttribute('data-api'))||'https://api.semantix-ai.com').replace(/\\/+$/,''),apiKey:(me&&me.getAttribute('data-key'))||${inline(SEARCH_KEY)},trackingKey:${inline(TRACKING_KEY)},idleMs:Number(me&&me.getAttribute('data-idle-ms'))||${IDLE_MS},version:${inline(version)}};
try{var th=document.createElement('style');th.id='semantix-manovino-concierge';th.textContent=${inline(css)};document.head.appendChild(th);}catch(e){}
${js}
try{semantixManoVinoConcierge(S);}catch(e){}
})();
`;
await mkdir(new URL('dist/',HERE),{recursive:true});
await writeFile(new URL('dist/semantix-manovino.js',HERE),out);
console.log('dist/semantix-manovino.js',(out.length/1024).toFixed(1)+' KB','version',version);
