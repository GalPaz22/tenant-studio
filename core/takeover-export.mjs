import {createHash} from 'node:crypto';
import {apiBase as defaultApiBase} from './takeover-control.mjs';

// The full search takeover as a Shopify Theme App Extension (an app embed in <head>). Unlike the CDN loader, the export
// is self-contained: the store's takeover configuration (the studio's demo configuration) is written into the block and
// the engine ships as the extension's own asset, so installing it needs neither a CDN release nor a siteConfig in the
// dashboard database — only a search server that answers for the store's site key.
// The written configuration is the base. On top of it the storefront lays the store's siteConfig from the search
// server (POST /site-config, kept in localStorage for 5 minutes), so anything can be changed from the server without a
// new export: switching Semantix off, an A/B split between Semantix and the store's own search (abTests), a selector
// or card fix. Only a new engine needs a new export. The WooCommerce export (a WordPress plugin) works the same way.

const ENDPOINTS={siteConfig:'/site-config',search:'/search',fastSearch:'/fast-search',productClick:'/product-click',searchToCart:'/search-to-cart',zeroSearch:'/zero-search',autocomplete:'/autocomplete'};
const ASSET='semantix-engine.js';
const inline=v=>JSON.stringify(v).replace(/</g,"\\u003c").replace(/[\u2028\u2029]/g,c=>"\\u"+c.charCodeAt(0).toString(16));

// The client's folder and file name: the store's host without www and its suffix.
export const shopSlug=url=>new URL(url).hostname.replace(/^www\./,'').split('.')[0].replace(/[^a-z0-9-]/gi,'').toLowerCase()||'store';
function httpsOrigin(value){
 let u;try{u=new URL(value);}catch{throw Error('שרת החיפוש: נדרשת כתובת HTTPS מלאה');}
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('שרת החיפוש: נדרשת כתובת HTTPS ללא סיסמה או פרמטרים');
 return u.origin+u.pathname.replace(/\/+$/,'');
}

// Runs in <head> after window.SemantixSettings holds the written configuration. In order: lay the remote configuration
// over it, hide the results area before first paint when this visitor gets Semantix results, load the engine.
//   remote — from the last answer kept in localStorage; refreshed in the background when older than 5 minutes. A
//            browser with no kept answer waits for the server (up to 2 s) before the engine starts, so a switch-off or
//            an A/B split set on the server holds from the very first page view. 404 = the store has no remote
//            configuration; a failed request leaves the written configuration in charge.
//   consent — the engine's cookie-consent bar is never shown by an export, whatever either configuration says.
//   hide   — only on a results page, only when full replacement is on and the engine did not record on the previous
//            page view that this visitor gets the store's own results (A/B variant); the engine removes the rule, the
//            timer is the safety net.
export const BOOT=`(function(){var S=window.SemantixSettings,C=S.siteConfig,KEY='semantix_remote_v1',TTL=300000,style=null,started=false;
function merge(over){for(var k in over){var v=over[k],b=C[k];C[k]=(v&&typeof v==='object'&&!Array.isArray(v)&&b&&typeof b==='object'&&!Array.isArray(b))?Object.assign({},b,v):v;}}
function list(v){return (Array.isArray(v)?v:[v]).filter(function(x){return typeof x==='string'&&x.trim();});}
function wanted(){try{var f=C.features||{},r=C.replace||{};if(!f.fullReplace||f.disabled===true||f.shadowMode===true)return null;
if(r.searchPath&&!new RegExp(r.searchPath).test(location.pathname))return null;
var p=new URLSearchParams(location.search),k=(C.queryParams&&C.queryParams.length)?C.queryParams:['q'],hit=false;for(var i=0;i<k.length;i++)if((p.get(k[i])||'').trim())hit=true;if(!hit)return null;
try{var fx=JSON.parse(localStorage.getItem('semantix_fx')||'null');if(fx&&fx.fullReplace===false)return null;}catch(e){}
var g=r.scope==='main'?list(r.root).map(function(s){return s+'>*';}):[];if(!g.length)g=list(C.selectors&&C.selectors.resultsGrid);if(!g.length)return null;
var h=list(r.hide);return g.join(',')+'{visibility:hidden!important}'+(h.length?h.join(',')+'{display:none!important}':'');}catch(e){return null;}}
function hide(){var css=wanted();if(!css){if(style){style.remove();style=null;}return;}if(style)return;
style=document.createElement('style');style.id='semantix-antiflicker';style.textContent=css;document.head.appendChild(style);
var st=style;setTimeout(function(){st.remove();},Number((C.replace||{}).revealTimeoutMs)>0?Number(C.replace.revealTimeoutMs):2500);}
function start(){if(started)return;started=true;C.consent=Object.assign({},C.consent,{enabled:false});hide();var s=document.createElement('script');s.src=S.engineSrc;s.async=false;document.head.appendChild(s);}
function refresh(done){try{fetch(S.apiBase+S.endpoints.siteConfig,{method:'POST',headers:{'Content-Type':'application/json','X-API-Key':S.apiKey}})
.then(function(r){return r.ok?r.json():(r.status===404?{}:null);})
.then(function(cfg){if(cfg&&typeof cfg==='object'&&!Array.isArray(cfg)){try{localStorage.setItem(KEY,JSON.stringify({ts:Date.now(),key:S.apiKey,cfg:cfg}));}catch(e){}if(done)done(cfg);}else if(done)done(null);})
.catch(function(){if(done)done(null);});}catch(e){if(done)done(null);}}
var kept=null;try{kept=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){}
if(kept&&kept.key===S.apiKey&&kept.cfg){merge(kept.cfg);start();if(Date.now()-kept.ts>TTL)refresh(null);}
else{hide();var timer=setTimeout(start,2000);refresh(function(cfg){clearTimeout(timer);if(!started&&cfg)merge(cfg);start();});}
})();`;

// Purchases happen on Shopify's checkout, where no theme code runs. A web pixel (the app's second extension) does:
// it reports checkout start and the completed order — with the visitor id, the last search and the A/B group the
// engine left in the browser's storage — to the same endpoint the storefront's cart events go to. It is switched on
// per store with the search server and site key as its settings (core/shopify-feed.mjs ensurePixel).
export const PIXEL_DIR='extensions/semantix-pixel/';
const PIXEL_TOML=`name = "Semantix measurement"
type = "web_pixel_extension"
runtime_context = "strict"

[customer_privacy]
analytics = true
marketing = false
preferences = false
sale_of_data = "disabled"

[settings]
type = "object"

[settings.fields.apiBase]
name = "Search server"
description = "Semantix search server address"
type = "single_line_text_field"
validations = [
  { name = "min", value = "1" }
]

[settings.fields.apiKey]
name = "Site key"
description = "Semantix site key of this store"
type = "single_line_text_field"
validations = [
  { name = "min", value = "1" }
]
`;
export const PIXEL_SOURCE=`import {register} from '@shopify/web-pixels-extension';

// Semantix measurement on checkout: checkout started and order completed, tied to the visitor's searches.
register(({analytics, browser, settings}) => {
  const tail = gid => (gid == null ? null : String(gid).split('/').pop());
  const read = async (store, key) => { try { return await browser[store].getItem(key); } catch (e) { return null; } };
  // What the storefront engine left for this visitor: its id, the last search and the A/B groups.
  const context = async () => {
    const [sid, ab, query] = await Promise.all([
      read('localStorage', 'semantix_visitor_id'), read('localStorage', 'semantix_ab_current'), read('sessionStorage', 'semantix_last_query')]);
    let groups = null;
    try { groups = ab ? JSON.parse(ab) : null; } catch (e) {}
    return {session_id: sid || null, search_query: query || null, ...(groups ? {ab_tests: groups} : {})};
  };
  const send = document => fetch(String(settings.apiBase).replace(/\\/+$/, '') + '/search-to-cart', {
    method: 'POST', keepalive: true,
    headers: {'Content-Type': 'application/json', 'X-API-Key': settings.apiKey},
    body: JSON.stringify({document}),
  }).catch(() => {});
  const order = (event, type) => {
    const c = (event.data && event.data.checkout) || {};
    const amount = money => (money && money.amount != null ? Number(money.amount) : null);
    return {
      event_type: type, timestamp: event.timestamp, platform: 'shopify', source: 'web-pixel',
      checkout_token: c.token || null, order_id: tail(c.order && c.order.id),
      total_price: amount(c.totalPrice), subtotal_price: amount(c.subtotalPrice), currency: c.currencyCode || null,
      line_items: (c.lineItems || []).map(l => {
        const v = l.variant || {}, p = v.product || {};
        return {product_id: tail(p.id), variant_id: tail(v.id), name: l.title || p.title || null, sku: v.sku || null, quantity: l.quantity, price: amount(v.price)};
      }),
    };
  };
  analytics.subscribe('checkout_started', async event => send({...order(event, 'checkout_initiated'), ...(await context())}));
  analytics.subscribe('checkout_completed', async event => send({...order(event, 'checkout_completed'), ...(await context())}));
});
`;

export function buildShopifyTakeover(project,{apiBase,apiKey='',engine,now=new Date()}={}){
 const config=project.takeover?.siteConfig;
 if(!config)throw Error('יש להריץ קודם זיהוי של החלפת החיפוש');
 if(config.platform!=='shopify')throw Error('הייצוא הזה מיועד לחנות Shopify');
 if(typeof engine!=='string'||!engine.includes('SemantixSettings'))throw Error('קוד המנוע לא נטען');
 const base=httpsOrigin(apiBase||defaultApiBase());
 apiKey=String(apiKey||'').trim();
 if(apiKey&&!/^[A-Za-z0-9_-]{8,128}$/.test(apiKey))throw Error('מפתח אתר לא תקין');
 const json=inline(config);
 // The configuration sits inside {% raw %} (the card template's {{tokens}} are not Liquid).
 if(/\{%-?\s*endraw/.test(json))throw Error('התצורה מכילה תגית Liquid שאי אפשר להטמיע');
 const host=new URL(project.url).hostname,slug=shopSlug(project.url);
 const version=createHash('sha256').update(json).update(engine).update(base).digest('hex').slice(0,12);
 const schema={name:'Semantix Search',target:'head',settings:[
  {type:'paragraph',content:'Replaces the store search (suggestions and the results page) with Semantix. Configured in Semantix Studio.'},
  {type:'text',id:'api_key',label:'Site key',info:apiKey?'Leave empty to use the key this extension was exported with.':'Paste the Semantix site key of this store.'},
  {type:'text',id:'api_base',label:'Search server',info:'Leave empty.'},
 ]};
 const block=`{% comment %}
  Semantix Search — full search takeover for ${host} (configuration ${version}, exported ${now.toISOString().slice(0,10)}).
  Generated by Tenant Studio: suggestions under the search field and the search results page are rendered by the
  Semantix engine (assets/${ASSET}) from the configuration below. Do not edit by hand — export again from the studio.
{% endcomment %}
{%- liquid
  assign sx_key = block.settings.api_key | default: '${apiKey}'
  assign sx_api = block.settings.api_base | default: '${base}'
-%}
{%- if sx_key != blank -%}
<script>
window.SemantixSettings={apiBase:{{ sx_api | json }},apiKey:{{ sx_key | json }},engineSrc:{{ '${ASSET}' | asset_url | json }},version:${inline(version)},endpoints:${inline(ENDPOINTS)},
siteConfig:{% raw %}${json}{% endraw %}};
${BOOT}
</script>
{%- else -%}
<!-- Semantix Search: no site key — set it in the app embed settings -->
{%- endif -%}

{% schema %}
${JSON.stringify(schema,null,2)}
{% endschema %}
`;
 if(Buffer.byteLength(block)>90*1024)throw Error('התצורה גדולה מדי לבלוק Liquid (מגבלת Shopify: 100KB) — קצרו את תבנית הכרטיס');
 const dir='extensions/semantix-search/';
 const f=config.features||{},r=config.replace||{};
 const manifest={platform:'shopify',slug,store:host,version,delivery:'theme-app-extension',status:'generated-not-deployed',apiBase:base,siteKey:apiKey?'included':'set-in-embed-settings',
  features:{autocomplete:f.autocomplete===true,resultsPage:f.fullReplace===true?(r.scope==='main'?'main':'grid'):'off',addToCart:config.addToCart?.mode||'off'},engineBytes:Buffer.byteLength(engine),exportedAt:now.toISOString()};
 const install=`# Semantix Search — ${host}

הרחבת Theme App Extension שמחליפה את החיפוש של החנות: הצעות החיפוש (אוטוקומפליט) ודף תוצאות החיפוש.

## מה יש בחבילה
- \`${dir}blocks/semantix-search.liquid\` — App embed שנטען ב־<head>, עם התצורה של החנות (סלקטורים, תבנית הכרטיס המקורי, הוספה לסל, מעקב).
- \`${dir}assets/${ASSET}\` — מנוע Semantix. Shopify מארחת אותו; אין תלות ב־CDN.
- \`${dir}shopify.extension.toml\`

## התקנה
1. העתיקו את התיקייה \`extensions/semantix-search\` אל פרויקט אפליקציית Shopify (לצד ההרחבות הקיימות).
2. \`shopify app deploy\` — בהרצה הראשונה ה־CLI יוצר מזהה להרחבה ושומר אותו ב־shopify.extension.toml.
3. התקינו את האפליקציה בחנות ${host}.
4. בעורך התבנית: App embeds ← הפעילו את **Semantix Search**${apiKey?'':' והדביקו את מפתח האתר בשדה Site key'} ← Save.
5. אם פועל App embed אחר של Semantix (No-Result Saver) — כבו אותו. רק אחד מהם צריך לפעול.

## מדידה
המנוע מדווח חיפושים, קליקים והוספות לסל. רכישות מדווחות על ידי ה־Web Pixel שבתיקיית extensions/semantix-pixel (בצ׳קאאוט של Shopify קוד התבנית לא רץ): תחילת צ׳קאאוט והזמנה שהושלמה, עם מזהה הגולש, החיפוש האחרון וקבוצת ה־A/B. הפיקסל מופעל לכל חנות מהסטודיו אחרי ההתקנה, ודורש npm install בתיקיית האפליקציה לפני הפריסה (הסטודיו מריץ אותו).

## מה משתנה באתר
${f.autocomplete?`- אוטוקומפליט: הרכיב המקורי מוסתר (${(config.autocomplete?.hide||[]).join(', ')||'—'}) והמאזינים שלו לשדה החיפוש לא מופעלים. ההצעות של Semantix נפתחות ${config.autocomplete?.mount?'בתוך '+config.autocomplete.mount+', מתחת לשדה':'בפאנל מתחת לשדה'}.\n`:''}${f.fullReplace?`- דף החיפוש (${r.searchPath||'/search'}): ${r.scope==='main'?`כל מה שבתוך ${r.root} (בין ההאדר לפוטר) מוחלף בכותרת ובתוצאות של Semantix, בכרטיסי המוצר המקוריים של התבנית. עובד גם כשלחיפוש המקורי אין תוצאות.`:'כרטיסי התוצאות המקוריים מוחלפים בתוצאות של Semantix.'}\n`:''}- אם שרת החיפוש לא עונה, הדף המקורי של החנות מוצג כרגיל.

## שליטה מרחוק (בלי ייצוא מחדש)
התצורה שבהרחבה היא הבסיס. מעליה מונחת תצורת החנות משרת החיפוש (POST /site-config, credentials.siteConfig של המשתמש), שנשמרת בדפדפן ל־5 דקות. כך אפשר מהסטודיו: לכבות את Semantix, לחלק את הגולשים בין Semantix לחיפוש המקורי (A/B, לפי אחוז), או לתקן סלקטור ותבנית כרטיס — והשינוי מגיע לאתר תוך עד 5 דקות. רק מנוע חדש דורש ייצוא ופריסה מחדש.

## תנאי מוקדם
שרת החיפוש ${base} צריך לענות למפתח האתר של החנות: POST /search, GET /autocomplete, GET /search/load-more, ו־CORS עבור https://${host}.

## עדכון והסרה
תצורה או מנוע חדשים: ייצוא מחדש מהסטודיו, החלפת הקבצים ו־\`shopify app deploy\`. להסרה: כבו את ה־App embed.
`;
 const files={
  [dir+'shopify.extension.toml']:'name = "Semantix Search"\ntype = "theme"\n',
  [dir+'blocks/semantix-search.liquid']:block,
  [dir+'assets/'+ASSET]:engine,
  // Shopify CLI reads the extension's locales folder on every deploy.
  [dir+'locales/en.default.json']:'{}\n',
  [PIXEL_DIR+'shopify.extension.toml']:PIXEL_TOML,
  [PIXEL_DIR+'src/index.js']:PIXEL_SOURCE,
  [PIXEL_DIR+'package.json']:JSON.stringify({name:'semantix-pixel',version:'1.0.0',private:true,main:'src/index.js',license:'UNLICENSED',dependencies:{'@shopify/web-pixels-extension':'^2.18.0'}},null,2)+'\n',
  'INSTALL.md':install,
  'manifest.json':JSON.stringify(manifest,null,2),
 };
 return {manifest,files};
}

// The same takeover as a WordPress plugin for a WooCommerce store: a small configuration script in <head> (the written
// configuration + BOOT) and the engine beside it. Activating the plugin is the whole install.
export function buildWooTakeover(project,{apiBase,apiKey='',engine,now=new Date()}={}){
 const config=project.takeover?.siteConfig;
 if(!config)throw Error('יש להריץ קודם זיהוי של החלפת החיפוש');
 if(config.platform!=='woocommerce')throw Error('הייצוא הזה מיועד לחנות WooCommerce');
 if(typeof engine!=='string'||!engine.includes('SemantixSettings'))throw Error('קוד המנוע לא נטען');
 const base=httpsOrigin(apiBase||defaultApiBase());
 apiKey=String(apiKey||'').trim();
 if(!/^[A-Za-z0-9_-]{8,128}$/.test(apiKey))throw Error('לתוסף WooCommerce נדרש מפתח האתר של החנות (חברו אותה לדאשבורד או הזינו מפתח)');
 const host=new URL(project.url).hostname,slug=shopSlug(project.url),json=inline(config);
 const version=createHash('sha256').update(json).update(engine).update(base).update(apiKey).digest('hex').slice(0,12);
 // engineSrc is filled in by the page (the plugin's own URL), so the files can be served from any path.
 const boot=`window.SemantixSettings={apiBase:${inline(base)},apiKey:${inline(apiKey)},engineSrc:(document.currentScript&&document.currentScript.src||'').replace(/semantix-config\\.js(\\?.*)?$/,'${ASSET}?v=${version}'),version:${inline(version)},endpoints:${inline(ENDPOINTS)},
siteConfig:${json}};
${BOOT}
`;
 const php=`<?php
/**
 * Plugin Name: Semantix Search
 * Description: Replaces the store search (suggestions and the results page) with Semantix. Configured in Semantix Studio for ${host}.
 * Version: 1.0.${now.toISOString().slice(0,10).replace(/-/g,'')}
 * Requires Plugins: woocommerce
 */
if (!defined('ABSPATH')) exit;
// Printed first in <head>: the configuration script decides before first paint whether this visitor gets Semantix
// results, then loads the engine. Both files are static.
add_action('wp_head', function () {
    if (is_admin()) return;
    echo '<script src="' . esc_url(plugins_url('assets/semantix-config.js', __FILE__) . '?v=${version}') . '"></script>' . "\\n";
}, 1);
// The completed order, once (a mark on the order stops a refresh of the page from reporting it again): sent from the
// shopper's browser with the visitor id, the last search and the A/B group the engine keeps there.
add_action('woocommerce_thankyou', function ($order_id) {
    $order = wc_get_order($order_id);
    if (!$order || $order->get_meta('_semantix_reported')) return;
    $order->update_meta_data('_semantix_reported', '1');
    $order->save();
    $items = array();
    foreach ($order->get_items() as $item) {
        $items[] = array(
            'product_id' => (string) $item->get_product_id(),
            'variant_id' => $item->get_variation_id() ? (string) $item->get_variation_id() : null,
            'name' => $item->get_name(),
            'quantity' => (int) $item->get_quantity(),
            'price' => (float) $order->get_item_total($item, true),
        );
    }
    $data = array(
        'event_type' => 'checkout_completed', 'platform' => 'woocommerce', 'source' => 'order-received',
        'order_id' => (string) $order->get_order_number(), 'total_price' => (float) $order->get_total(),
        'currency' => $order->get_currency(), 'line_items' => $items,
    );
    echo '<script>(function(d){try{var S=window.SemantixSettings;if(!S)return;var g=null;try{g=JSON.parse(localStorage.getItem("semantix_ab_current")||"null");}catch(e){}'
        . 'd.session_id=localStorage.getItem("semantix_visitor_id");d.search_query=sessionStorage.getItem("semantix_last_query");if(g)d.ab_tests=g;'
        . 'fetch(S.apiBase+S.endpoints.searchToCart,{method:"POST",keepalive:true,headers:{"Content-Type":"application/json","X-API-Key":S.apiKey},body:JSON.stringify({document:d})});}catch(e){}})('
        . wp_json_encode($data) . ');</script>' . "\\n";
}, 20, 1);
`;
 const f=config.features||{},r=config.replace||{};
 const manifest={platform:'woocommerce',slug,store:host,version,delivery:'wordpress-plugin',status:'generated-not-installed',apiBase:base,siteKey:'included',
  features:{autocomplete:f.autocomplete===true,resultsPage:f.fullReplace===true?(r.scope==='main'?'main':'grid'):'off',addToCart:config.addToCart?.mode||'off'},engineBytes:Buffer.byteLength(engine),exportedAt:now.toISOString()};
 const install=`# Semantix Search — ${host}

תוסף WordPress שמחליף את החיפוש של החנות: הצעות החיפוש ודף תוצאות החיפוש.

## התקנה
בוורדפרס: תוספים ← תוסף חדש ← העלאת תוסף ← העלו את ה־ZIP ← הפעילו את Semantix Search. להסרה: השביתו את התוסף.

## שליטה מרחוק (בלי התקנה מחדש)
התצורה שבתוסף היא הבסיס. מעליה מונחת תצורת החנות משרת החיפוש (POST /site-config), שנשמרת בדפדפן ל־5 דקות: כיבוי, חלוקת A/B בין Semantix לחיפוש המקורי, תיקון סלקטור או תבנית כרטיס — מהסטודיו, והשינוי מגיע לאתר תוך עד 5 דקות. רק מנוע חדש דורש התקנה של ZIP חדש.

## תנאי מוקדם
שרת החיפוש ${base} צריך לענות למפתח האתר של החנות ולאפשר CORS עבור https://${host}. אם האתר משתמש ב־cache של דפים או בתוסף אופטימיזציה שמעכב JavaScript, יש להחריג את assets/semantix-config.js מהעיכוב.
`;
 const files={
  'semantix-search/semantix-search.php':php,
  'semantix-search/assets/semantix-config.js':boot,
  ['semantix-search/assets/'+ASSET]:engine,
  'semantix-search/INSTALL.md':install,
  'semantix-search/manifest.json':JSON.stringify(manifest,null,2),
 };
 return {manifest,files};
}
