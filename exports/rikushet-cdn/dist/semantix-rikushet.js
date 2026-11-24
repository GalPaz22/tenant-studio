/*! Semantix search · rikushet.co.il · b0c4c3f169f2 · built 2026-11-23T12:52:31.040Z */
(function(){
if(window.__semantix_bundle_ran||window.__semantix_engine_v5)return;window.__semantix_bundle_ran=true;
var me=document.currentScript,T=window.SemantixSettings||{},key=(me&&me.getAttribute('data-key'))||T.apiKey||"9f82218b45b9807885fd667c04d097a7d00e35f6dbef4c33de5d2ff465087e04";
try{(function(){var p=new URLSearchParams(location.search),q=(p.get("sx_q")||"").trim(),fx={};try{fx=JSON.parse(localStorage.getItem("semantix_fx")||"null")||{}}catch(e){}var nat=function(){location.replace("/catalogsearch/result/?q="+encodeURIComponent(q))};if(q&&location.pathname==="/"){if(fx.autocomplete===false)return nat();var s=document.createElement("style");s.id="semantix-shell-wait";s.textContent="#maincontent>*:not([data-semantix-typed]){display:none!important}#maincontent{min-height:60vh}#maincontent:not(:has([data-semantix-typed]))::before{content:'';display:block;margin:120px auto;width:2.5rem;height:2.5rem;background:url(/pub/media/loading_image/default/loader_1.gif) center/contain no-repeat}";document.head.appendChild(s);addEventListener("load",function(){setTimeout(function(){if(!window.__semantix_engine_v5)nat()},3000)});return}if(/^\/catalogsearch\/result/.test(location.pathname)&&fx.fullReplace!==false){var a=document.createElement("style");a.id="semantix-antiflicker";a.textContent="ul.product-items,.message.info.empty,.message.notice{visibility:hidden!important}";document.head.appendChild(a);setTimeout(function(){a.remove()},5000)}})();}catch(e){}
try{(function(){
var D=Object.create(null),API=/\/(search|fast-search|autocomplete)(\?|$)/;
function keep(o,depth){
 if(!o||typeof o!=='object'||depth>5)return;
 if(Array.isArray(o)){for(var i=0;i<o.length;i++)keep(o[i],depth+1);return;}
 if((o.id!=null||o.sku)&&(o.title||o.name)){if(o.id!=null)D[String(o.id)]=o;if(o.sku)D[String(o.sku)]=o;}
 for(var k in o)if(o[k]&&typeof o[k]==='object')keep(o[k],depth+1);
}
var of=window.fetch;
if(of)window.fetch=function(u){
 var p=of.apply(this,arguments),url=typeof u==='string'?u:(u&&u.url)||'';
 if(API.test(url.split('#')[0].replace(/^https?:\/\/[^\/]+/,'').replace(/^\/__sx/,'')))p.then(function(r){try{r.clone().json().then(function(j){keep(j,0);schedule();}).catch(function(){});}catch(e){}}).catch(function(){});
 return p;
};
function esc(t){return String(t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function stamp(el,text,bg){
 if(!text){el.textContent='';return;}
 el.innerHTML='<span class="value dark hasbg" dir="rtl" style="background:'+bg+';--bg-color:'+bg+'">'+esc(text)+'</span>';
}
function fill(li){
 var p=D[li.getAttribute('data-semantix-pid')];if(!p)return false;
 var q=function(s){return li.querySelector('[data-sx-slot="'+s+'"]')};
 var b=Array.isArray(p.badges)?p.badges:[],of=function(k){return b.filter(function(x){return x&&x.kind===k})};
 var brand=q('brand'),br=of('rk-brand')[0];if(brand)brand.textContent=br?br.text:'';
 var sale=q('sale'),sl=of('rk-sale')[0];if(sale)stamp(sale,sl&&sl.text,'#011231');
 var st=q('stamp'),sp=of('rk-stamp')[0];if(st)stamp(st,sp&&sp.text,'#000000');
 var sw=q('swatches'),c=of('rk-swatch');
 if(sw){
  sw.innerHTML=c.length?'<div class="swatch-attribute color"><div class="swatch-attribute-options clearfix">'+c.map(function(x){
   var bg=x.color?'background:'+esc(x.color)+' no-repeat center;background-size:initial':'background:url('+esc(x.image)+') center/cover no-repeat';
   return '<div class="swatch-option color" title="'+esc(x.text||'')+'" style="'+bg+'"></div>';}).join('')+'</div></div>':'';
 }
 li.setAttribute('data-sx-skin','1');return true;
}
var queued=false;
function run(){queued=false;var l=document.querySelectorAll('li.semantix-product-card:not([data-sx-skin])');for(var i=0;i<l.length;i++)fill(l[i]);}
function schedule(){if(!queued){queued=true;requestAnimationFrame(run);}}
function start(){new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});schedule();}
if(document.documentElement)start();else document.addEventListener('DOMContentLoaded',start);
var n=0,t=setInterval(function(){schedule();if(++n>600)clearInterval(t);},1000);
})();}catch(e){}
try{var th=document.createElement('style');th.id='semantix-rikushet-theme';th.textContent="[data-semantix-typed] .page-heading-title{color:#bfd630;font-size:21px;font-weight:700;text-align:center;margin:20px 0}body:has([data-semantix-typed]) .mage-dropdown-dialog::after{display:none!important}body.search-open [data-semantix-typed]{padding-top:78px}body:has([data-semantix-typed]){overflow:auto!important;overflow-y:auto!important}#maincontent:not(:has([data-semantix-typed]))::before{border:0!important;border-radius:0!important;width:2.5rem!important;height:2.5rem!important;background:url(/pub/media/loading_image/default/loader_1.gif) center/contain no-repeat!important;animation:none!important}[data-semantix-bar-loader] .sx-track{display:none!important}[data-semantix-bar-loader]::before{content:'';display:block;width:2.5rem;height:2.5rem;background:url(/pub/media/loading_image/default/loader_1.gif) center/contain no-repeat}[data-semantix-bar-loader] .sx-text{color:#1e1e1e!important;opacity:1!important}[data-semantix-store-loader] i,[data-semantix-store-more] i{display:none!important}[data-semantix-store-loader]::before,[data-semantix-store-more]::before{content:'';display:block;width:2.5rem;height:2.5rem;background:url(/pub/media/loading_image/default/loader_1.gif) center/contain no-repeat}[data-semantix-loading]::before{background-image:linear-gradient(90deg,transparent,#bfd630,transparent)!important;opacity:.8!important}";document.head.appendChild(th);}catch(e){}
window.__semantix_loader_ran=true;window.__semantix_engine_loaded=true;
var S={apiBase:((me&&me.getAttribute('data-api'))||T.apiBase||'https://api.semantix-ai.com').replace(/\/+$/,''),apiKey:key,version:"b0c4c3f169f2",endpoints:{"siteConfig":"/site-config","search":"/search","fastSearch":"/fast-search","productClick":"/product-click","searchToCart":"/search-to-cart","zeroSearch":"/zero-search","logQuery":"/log-query","autocomplete":"/autocomplete"},siteConfig:{"siteId":"","platform":"magento","enabled":true,"domains":[],"queryParams":["q"],"removeSelectors":[],"selectors":{"resultsGrid":["ul.product-items"],"productCard":["li.product-item"],"noResults":[".message.info.empty",".message.notice"],"pageTitle":[],"resultsRoot":[],"searchInput":"#header-search-input","productPage":"","productId":"","productName":"","zero":{"enabled":true,"host":[],"gridTag":"ul","gridClass":"products list items product-items semantix-zero-grid","columns":{"desktop":4,"tablet":2,"mobile":2},"insert":{"mode":"append","target":[]},"style":{"gapPx":16,"marginTopPx":16,"cardWidth":"100%"}}},"nativeCard":{"cloneFromSelector":"li.product-item","templateHtml":null,"cardTemplate":"\u003cli class=\"product-item semantix-product-card\"\n    data-semantix-custom=\"1\"\n    data-semantix-ai=\"1\"\n    data-semantix-injected=\"1\"\n    data-semantix-pid=\"{{id}}\"\n    data-semantix-name=\"{{name}}\"\n    data-stock-status=\"{{stockStatus}}\"\n    data-on-sale=\"{{onSale}}\"\n    data-mode=\"category\"\n    style=\"opacity: 1; transition: opacity 260ms;\">\n\n  \u003cstyle>\n    /* The grid is the store's: four across, two on a phone. Everything inside the card is the store's own markup and CSS. */\n    ul.product-items:has(> li.semantix-product-card) {\n      display: grid !important;\n      grid-template-columns: repeat(4, minmax(0, 1fr)) !important;\n      gap: 21px !important;\n      align-items: start !important;\n    }\n    @media (max-width: 767px) {\n      ul.product-items:has(> li.semantix-product-card) {\n        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;\n        gap: 21px 10px !important;\n      }\n    }\n    li.semantix-product-card { width: 100% !important; min-width: 0 !important; max-width: 100% !important; margin: 0 !important; }\n    /* Slots the skin fills; empty ones take no room */\n    li.semantix-product-card [data-sx-slot]:empty { display: none; }\n  \u003c/style>\n\n  \u003cdiv class=\"start-product-item\">\n    \u003cdiv class=\"product details\">\n      \u003cdiv class=\"product-image\">\u003cdiv class=\"image\">\n        \u003cdiv class=\"product-item-photo-shop\">\n          \u003ca href=\"{{url}}\" rel=\"nofollow\" class=\"action product_link\" tabindex=\"0\">\n            \u003cspan class=\"product-item-image product-image-container\">\n              \u003cspan class=\"product-image-wrapper\">\n                \u003cimg class=\"product-image-photo\" src=\"{{image}}\" alt=\"{{name}}\" />\n              \u003c/span>\n            \u003c/span>\n          \u003c/a>\n        \u003c/div>\n      \u003c/div>\n      \u003cdiv class=\"product-category-stampa_sale-swatch product-stampa_sale\" data-sx-slot=\"sale\" style=\"--swatch-color:#011231;\">\u003c/div>\u003c/div>\n\n      \u003cdiv class=\"product-content-wrap\">\n        \u003cdiv class=\"product-content\">\n          \u003cdiv dir=\"ltr\" lang=\"en\" class=\"product-category-brand product-brand\" data-sx-slot=\"brand\">\u003c/div>\n          \u003cdiv dir=\"rtl\" lang=\"he\" class=\"product-category-name product-name\">\n            \u003ca href=\"{{url}}\" class=\"action product_link\" title=\"{{name}}\">{{name}}\u003c/a>\n          \u003c/div>\n        \u003c/div>\n        \u003cdiv class=\"product-price\">\u003cdiv class=\"product_category_price product_price\">\n          \u003cdiv class=\"price-box has_special_price price-final_price\" data-role=\"priceBox\">\n            \u003cspan class=\"normal-price\">\u003cspan class=\"price-container price-final_price tax\">\n              \u003cspan class=\"price-label\">מחיר מוצר\u003c/span>\n              \u003cspan data-price-type=\"finalPrice\" class=\"price-wrapper\">\u003cspan class=\"price\">{{price}}&nbsp;₪\u003c/span>\u003c/span>\n            \u003c/span>\u003c/span>\n            \u003cspan class=\"old-price sly-old-price\" data-semantix-if=\"onSale\">\u003cspan class=\"price-container price-final_price tax\">\n              \u003cspan class=\"price-label\">מחיר רגיל\u003c/span>\n              \u003cspan data-price-type=\"oldPrice\" class=\"price-wrapper\">\u003cspan class=\"price\">{{regularPrice}}&nbsp;₪\u003c/span>\u003c/span>\n            \u003c/span>\u003c/span>\n          \u003c/div>\n        \u003c/div>\u003c/div>\n        \u003cdiv class=\"product-bottom-content\">\n          \u003cdiv class=\"product-category-stampa-swatch product-stampa\" data-sx-slot=\"stamp\" style=\"--swatch-color:#000000;\">\u003c/div>\n          \u003cdiv class=\"product-options-wrapper\">\u003cdiv class=\"fieldset\">\u003cdiv class=\"swatch-opt\" data-sx-slot=\"swatches\">\u003c/div>\u003c/div>\u003c/div>\n        \u003c/div>\n      \u003c/div>\n    \u003c/div>\n  \u003c/div>\n\u003c/li>","useCustomTemplate":true,"map":{"titleSelector":"","priceSelector":"","imageSelector":"","linkSelector":""},"cleanupSelectors":[],"disableAddToCart":true,"disablePostFix":true},"behavior":{"injectPosition":"prepend","injectCount":6,"fadeMs":260,"loaderMinMs":450,"waitForDomMs":8000,"loader":true,"fallbackMs":0},"consent":{"enabled":false,"storageKey":"semantix_consent_v3","logoUrl":"https://semantix-ai.com/powered.png","title":"🍪 חיפוש מותאם אישית","text":"מאשרים ל־Semantix לשמור סשן לשיפור התוצאות? (בלי אישור עדיין תראה תוצאות חכמות, פשוט בלי session)","acceptText":"כן, אשר","declineText":"לא, תודה","zIndex":1000000},"clickTracking":{"enabled":true,"trackNativeClicks":true,"addToCartSelector":"#product-addtocart-button, .tocart","universalMode":true,"universalLinkSelector":"a.product_link","forceNavDelay":true,"forceNavDelayMs":80,"queueKey":"semantix_click_q_v1","queueMax":25,"cartInterceptor":{"enabled":true,"urlPatterns":["/checkout/cart/add"],"checkoutPatterns":[],"productIdField":"product","quantityField":"qty"}},"placeholderRotate":{"enabled":false,"placeholders":[],"intervalMs":2400,"fadeMs":220,"startDelayMs":600,"pauseOnFocus":true,"onlyIfEmpty":true,"textColor":"#6b7280"},"features":{"rerankBoost":false,"injectIntoGrid":false,"zeroReplace":true,"disabled":false,"shadowMode":false,"fullReplace":true,"autocomplete":true},"abTests":{"semantix_takeover":{"enabled":true,"sticky":false,"fallback":true,"updatedBy":"build-bundle","variants":[{"id":"semantix","weight":0},{"id":"native","weight":100,"features":{"shadowMode":true}}],"pins":{"vis-test-rikushet":"semantix"}}},"sessionModes":{},"texts":{"loader":""},"branding":{"logoUrl":"https://semantix-ai.com/powered.png","loadingText":"Semantix AI מחפש עבורך...","logoSize":120,"showLogo":false},"skeleton":{"loadingText":"Loading AI recommendations..."},"autocompleteFooter":{"enabled":false,"text":"מופעל על ידי Semantix AI ✨","selector":".autocomplete-dropdown","fontSize":"13px"},"aiBadge":{"enabled":false,"text":"AI","position":"top-right","backgroundColor":"rgba(139, 92, 246, 0.1)","textColor":"#8b5cf6","borderColor":"#8b5cf6","borderWidth":"1px","borderStyle":"solid","borderRadius":"8px","fontSize":"11px","fontWeight":"600","padding":"3px 8px","boxShadow":"0 4px 12px rgba(139, 92, 246, 0.25)","zIndex":10},"debug":{"enabled":false},"zero":{"replaceNoResultsText":"מחפש תוצאות חכמות...","replaceNoResultsSelector":"","columns":{"desktop":4}},"replace":{"searchPath":"^/catalogsearch/result","hide":[".products-list-filter-wrapper",".category-single-filter",".toolbar",".category_promotion",".message.info.empty",".message.notice"],"limit":24,"autoLoadMore":true,"loadingMoreText":"טוען עוד…","loader":{"color":"#bfd630"}},"autocomplete":{"input":"#header-search-input","hide":["#search_autocomplete","div.search_autocomplete","div.search_autocomplete_wrap"],"minChars":2,"display":"grid","gridLimit":12,"debounceMs":250,"root":"#maincontent","gridTag":"ul","gridClass":"products list items product-items","gridWrapClass":"products wrapper PRODUCTS products-PRODUCTS","title":"תוצאות חיפוש עבור: '{q}'","titleClass":"page-heading-title","searchInPage":true,"resultsShell":{"path":"/","param":"sx_q","native":"/catalogsearch/result/"}},"addToCart":{"mode":"off"},"orderTracking":{"pages":["/checkout/index/success","/checkout/onepage/success","/checkout/success"]}}};
try{Object.defineProperty(window,'SemantixSettings',{configurable:false,get:function(){return S;},set:function(){}});}catch(e){window.SemantixSettings=S;}
function engine(){
(function () {
  "use strict";

  // ============================================================
  // Semantix Engine v5 - With Branded Loading
  // - Branded logo overlay during 0-results recovery
  // - Single API call per click
  // ============================================================

  const S = window.SemantixSettings || {};
  const C = S.siteConfig || {};

  // Ensure tracking endpoints are always set
  if (S.endpoints) {
    if (!S.endpoints.productClick) S.endpoints.productClick = "/product-click";
    if (!S.endpoints.searchToCart) S.endpoints.searchToCart = "/search-to-cart";
    if (!S.endpoints.zeroSearch)   S.endpoints.zeroSearch   = "/zero-search";
    if (!S.endpoints.logQuery)     S.endpoints.logQuery     = "/log-query";
  }

  if (!S.apiBase || !S.endpoints?.fastSearch || !S.endpoints?.search) {
    console.warn("[Semantix] Engine: missing apiBase/search endpoints");
    return;
  }

  if (window.__semantix_engine_v5) return;
  window.__semantix_engine_v5 = true;

  /* ------------------------ defaults ------------------------ */

  const DEFAULTS = {
    queryParams: ["q", "s", "query", "search", "term"],

    behavior: {
      injectPosition: "prepend",
      injectCount: 6,
      rerankCount: 0,      // Max products to FETCH for rerank (0 = unlimited, server decides)
      fadeMs: 180,
      loaderMinMs: 450,
      waitForDomMs: 8000,
      enableRerank: false, // hard-disabled at engine level — kept false regardless of config
      enableInject: false, // hard-disabled at engine level — kept false regardless of config
      rerenderGuard: true, // Watch for framework re-renders (dynamic JS / SPA sites) and re-inject
      rerenderGuardMs: 350,  // Debounce delay (ms) before re-injecting after re-render
      rerenderGuardMax: 3, // Max re-injection attempts per page load
      fallbackMs: 0        // >0: a search or suggestion request with no answer by then gives the store's own search back (0 = wait)
    },

    consent: {
      enabled: false,          // hard-disabled at engine level — kept false regardless of config (see getConsentState)
      storageKey: "semantix_consent_v3",
      logoUrl: "https://semantix-ai.com/powered.png",
      title: "🍪 חיפוש מותאם אישית",
      text: "מאשרים ל־Semantix לשמור סשן לשיפור התוצאות?",
      acceptText: "כן, אשר",
      declineText: "לא, תודה",
      zIndex: 1000000
    },

    branding: {
      logoUrl: "https://semantix-ai.com/powered.png",
      loadingText: "Semantix AI מחפש עבורך...",
      logoSize: 120,
      showLogo: true
    },

    // Autocomplete no-results replacement
    autocompleteFooter: {
      enabled: false,
      text: "מופעל על ידי Semantix AI",
      selector: null,  // Selector for no-results text element
      fontSize: null   // e.g., "12px", "0.9em" - null keeps original size
    },

    selectors: {
      resultsGrid: null,
      productCard: null,
      noResults: null,
      resultsRoot: null,
      searchInput: null,
      pageTitle: null,
      productPage: null,    // Optional selector to confirm product page context
      productId: null,      // Optional selector for product id on product page
      productName: null     // Optional selector for product name on product page
    },

    // Zero results recovery grid configuration
    zero: {
      enabled: true,
      maxProducts: 25,  // Max products to show in zero-results grid (separate from injectCount)
      replaceNoResultsText: null,  // Text to show instead of "no results" while loading (e.g. "מחפש תוצאות חכמות...")
      replaceNoResultsSelector: null,  // Selector to hunt for the specific text element (e.g. "h2", ".no-results-title", "p.empty-message")
      gridTag: "ul",
      gridClass: "products semantix-zero-grid",
      columns: { desktop: 4, tablet: 3, mobile: 2 },
      style: { gapPx: 16, marginTopPx: 16, cardWidth: "100%" },
      host: ["main", "#main", ".main-content", "body"],
      insert: { mode: "after", target: [".search__header-title", ".no-results", "[class*='no-results']"] }
    },

    nativeCard: {
      map: {
        linkSelector: null,
        titleSelector: null,
        priceSelector: null,
        imageSelector: null
      },
      cleanupSelectors: [],  // Selectors to remove from card (badges, buttons, etc)
      disableAddToCart: true,
      cardTemplate: null,  // HTML string with placeholders: {{url}}, {{name}}, {{image}}, {{price}}
      useCustomTemplate: true,  // If true, cardTemplate is used as-is with placeholders (not modified)
      disablePostFix: false  // Set to true to disable post-injection fix
    },

    clickTracking: {
      enabled: true,
      trackNativeClicks: true,
      forceNavDelay: true,
      forceNavDelayMs: 120,
      queueKey: "semantix_click_q_v2",
      queueMax: 25,
      dedupeWindowMs: 2500,
      // Universal tracking - works on any platform
      universalMode: false,  // Set to true for non-Shopify/WooCommerce platforms
      universalLinkSelector: null,  // Custom selector for product links (e.g., "a.product-link")
      addToCartSelector: null  // Fallback selector(s) for add-to-cart buttons (string or array)
    },

    // Cart interceptor — monitors fetch/XHR to detect ATC & checkout without DOM selectors
    cartInterceptor: {
      enabled: true,
      // URL patterns to detect add-to-cart requests (matched via string includes)
      atcPatterns: null,        // Custom ATC URL patterns (array of strings). Auto-detected if null.
      checkoutPatterns: null,   // Custom checkout URL patterns (array). Auto-detected if null.
      productIdField: null,     // Field name in request body for product ID (e.g. "product_id"). Auto-detected if null.
      quantityField: null       // Field name in request body for quantity. Auto-detected if null.
    },

    placeholderRotate: {
      enabled: false,
      placeholders: [],
      intervalMs: 2400,
      fadeMs: 220,
      startDelayMs: 600,
      pauseOnFocus: true,
      onlyIfEmpty: true,
      textColor: null        // Placeholder text color (e.g. "#888", "rgba(0,0,0,0.4)"). null = default
    },

    aiBadge: {
      enabled: true,
      text: "AI",
      position: "top-right",  // top-right, top-left, bottom-right, bottom-left
      backgroundColor: "rgba(139, 92, 246, 0.1)",
      textColor: "#8b5cf6",
      borderColor: "#8b5cf6",
      borderWidth: "1px",
      borderStyle: "solid",
      borderRadius: "8px",
      fontSize: "11px",
      fontWeight: "600",
      padding: "3px 8px",
      boxShadow: "0 4px 12px rgba(139, 92, 246, 0.25)",
      zIndex: 10
    },

    // Skeleton loading card shown in the existing grid before AI results are injected
    skeleton: {
      loadingText: "\u05D8\u05D5\u05E2\u05DF \u05D4\u05DE\u05DC\u05E6\u05D5\u05EA AI",  // "טוען המלצות AI" (full card)
      compactText: "\u05D8\u05D5\u05E2\u05DF \u05EA\u05D5\u05E6\u05D0\u05D5\u05EA AI",  // "טוען תוצאות AI" (narrow bar)
      // When the grid lays out a single product per row (common on mobile), the full
      // skeleton card overlays the whole screen — so show a slim loading bar instead.
      compactSingleRow: true,
      // Card width / grid width ratio above which the grid is treated as single-column
      compactWidthRatio: 0.85
    },

    features: {
      disabled: false,       // Kill switch — set to true to disable the entire engine
      allowedDomains: null,  // Optional domain allowlist. Empty/null = run everywhere
      injectIntoGrid: false, // hard-disabled at engine level — kept false regardless of config
      rerankBoost: false,    // hard-disabled at engine level — kept false regardless of config
      zeroReplace: true,
      shadowMode: false,     // Shadow mode — detect queries & track clicks/ATC, but skip all DOM injection
      fullReplace: false,    // Replace the native results grid entirely with Semantix results (see `replace`)
      autocomplete: false    // Replace the store's own search suggestions with Semantix ones (see `autocomplete`)
    },

    // Full results-page takeover (features.fullReplace). Separate from the hard-disabled
    // rerank/inject: native cards are removed and Semantix results render in the native grid
    // with nativeCard.cardTemplate, in Semantix order. The loader hides the grid before first
    // paint (anti-flicker) from the cached config; the engine reveals it when done or on failure.
    replace: {
      searchPath: null,        // Optional path prefix/regex source that identifies the results page ("/catalogsearch/result")
      hide: [],                // Native elements that no longer apply after replacement (count, sort, pager, native filters)
      limit: 0,                // 0 = server default batch
      revealTimeoutMs: 2500,   // Loader safety net: show the native grid if Semantix has not rendered by then
      loadMore: true,          // Show a "load more" button driven by the API pagination tokens
      // While Semantix results load: "bar" — a loading bar centred in the results area; "skeleton" — skeleton card;
      // "none" — nothing (the area stays empty until results arrive).
      loader: { type: "bar", text: "מחפש עבורך…", color: "#16261f", minHeight: 280 },
      loadMoreText: "הצג עוד תוצאות",
      loadMoreClass: "",       // Optional theme button classes, e.g. "action primary"
      aiBadge: false,          // Show the AI badge on replaced cards too
      // "grid" — only the native grid is swapped and `hide` lists what else goes.
      // "main" — Semantix owns everything between the header and the footer: every native element inside `root`
      //          is hidden except the grid's own ancestors (they carry the theme's layout), and a Semantix heading
      //          is shown above the grid. Works on pages with no native results too (the grid is rebuilt from `shell`).
      scope: "grid",
      root: null,              // scope "main": the page's content element between header and footer ("main", "#main")
      shell: null,             // scope "main": [{tag, cls:[…]}] from below `root` down to the grid, for pages with no native grid
      title: "תוצאות חיפוש עבור “{q}”",
      titleClass: "",          // Theme heading classes for the title
      countText: "{n} מוצרים"
    },

    // Search suggestions takeover (features.autocomplete). The store's own suggestion component is hidden and its
    // listeners on the search field never fire; Semantix suggestions open under the field.
    autocomplete: {
      input: null,             // Search field selector(s); selectors.searchInput when null
      hide: [],                // The store's own suggestion elements
      mount: null,             // Element the panel is placed in, under the field (a search drawer's body). null = a panel anchored to the field
      blockNative: true,       // Stop the theme's own input/keyup listeners on the field
      minChars: 2,
      debounceMs: 160,
      limit: 6,                // Products shown
      suggestions: 4,          // Query suggestions shown
      currency: "₪",
      productsTitle: "מוצרים",
      suggestionsTitle: "חיפושים מוצעים",
      viewAllText: "לכל התוצאות עבור “{q}”",
      emptyText: "לא נמצאו מוצרים עבור “{q}”",
      zIndex: 2147483000
    },

    // Add to cart from Semantix cards (buttons marked data-semantix-atc in nativeCard.cardTemplate).
    //   engine — the engine adds to the store's own cart (id resolved from the product page / Shopify .js)
    //   link   — the button opens the product page
    //   off    — no handling (template buttons do nothing special)
    // Products that need a choice (size, format…) or are out of stock always open the product page.
    addToCart: {
      mode: "off",
      addingText: "מוסיף…",
      addedText: "נוסף לסל ✓",
      formSelector: null,      // Product-page add-to-cart form; platform defaults when null
      sections: null,          // Shopify: sections to re-render after adding (e.g. ["cart-drawer","cart-icon-bubble"])
      openCart: true,          // Shopify: open the theme's cart drawer / notification after adding
      refresh: null,           // Custom platforms: "reload" to reload the page after adding
      toast: true,             // Confirmation message with a link to the cart after adding
      toastText: "המוצר נוסף לסל",
      cartText: "לסל הקניות",
      cartUrl: null            // Platform default (/checkout/cart/, /cart/, /cart) when null
    },

    debug: { enabled: false }
  };

  function getCfg(path, fallback) {
    const seg = path.split(".");
    let cur = C;
    for (const k of seg) cur = (cur && cur[k] !== undefined) ? cur[k] : undefined;
    return cur !== undefined ? cur : fallback;
  }

  const cfg = {
    queryParams: getCfg("queryParams", DEFAULTS.queryParams),
    behavior: { ...DEFAULTS.behavior, ...(getCfg("behavior", {}) || {}) },
    consent: { ...DEFAULTS.consent, ...(getCfg("consent", {}) || {}) },
    branding: { ...DEFAULTS.branding, ...(getCfg("branding", {}) || {}) },
    autocompleteFooter: { ...DEFAULTS.autocompleteFooter, ...(getCfg("autocompleteFooter", {}) || {}) },
    selectors: { ...DEFAULTS.selectors, ...(getCfg("selectors", {}) || {}) },
    nativeCard: {
      ...DEFAULTS.nativeCard,
      ...(getCfg("nativeCard", {}) || {}),
      map: { ...DEFAULTS.nativeCard.map, ...((getCfg("nativeCard.map", {}) || {})) }
    },
    clickTracking: { ...DEFAULTS.clickTracking, ...(getCfg("clickTracking", {}) || {}) },
    cartInterceptor: { ...DEFAULTS.cartInterceptor, ...(getCfg("cartInterceptor", {}) || {}), ...(getCfg("clickTracking.cartInterceptor", {}) || {}) },
    placeholderRotate: { ...DEFAULTS.placeholderRotate, ...(getCfg("placeholderRotate", {}) || {}) },
    aiBadge: { ...DEFAULTS.aiBadge, ...(getCfg("aiBadge", {}) || {}) },
    skeleton: { ...DEFAULTS.skeleton, ...(getCfg("skeleton", {}) || {}) },
    features: { ...DEFAULTS.features, ...(getCfg("features", {}) || {}) },
    replace: { ...DEFAULTS.replace, ...(getCfg("replace", {}) || {}) },
    autocomplete: { ...DEFAULTS.autocomplete, ...(getCfg("autocomplete", {}) || {}) },
    orderTracking: getCfg("orderTracking", null) || undefined,
    addToCart: { ...DEFAULTS.addToCart, ...(getCfg("addToCart", {}) || {}) },
    // Support both "zero" and "selectors.zero" locations
    zero: {
      ...DEFAULTS.zero,
      ...(getCfg("zero", {}) || {}),
      ...(getCfg("selectors.zero", {}) || {}),
      columns: { 
        ...DEFAULTS.zero.columns, 
        ...((getCfg("zero.columns", {}) || {})),
        ...((getCfg("selectors.zero.columns", {}) || {}))
      },
      style: { 
        ...DEFAULTS.zero.style, 
        ...((getCfg("zero.style", {}) || {})),
        ...((getCfg("selectors.zero.style", {}) || {}))
      },
      insert: { 
        ...DEFAULTS.zero.insert, 
        ...((getCfg("zero.insert", {}) || {})),
        ...((getCfg("selectors.zero.insert", {}) || {}))
      }
    },
    debug: { ...DEFAULTS.debug, ...(getCfg("debug", {}) || {}) }
  };

  // Log the final merged config for debugging
  console.log("[Semantix] 🎛️ Final merged config:", {
    'behavior.enableRerank': cfg.behavior?.enableRerank,
    'behavior.enableInject': cfg.behavior?.enableInject,
    'features.rerankBoost': cfg.features?.rerankBoost,
    'features.injectIntoGrid': cfg.features?.injectIntoGrid,
    'features.zeroReplace': cfg.features?.zeroReplace,
    'zero.enabled': cfg.zero?.enabled
  });

  const log = (...a) => cfg.debug.enabled && console.log("[Semantix]", ...a);

  function normalizeAllowedDomains(value) {
    const list = Array.isArray(value) ? value : [value];
    return list
      .filter(Boolean)
      .map(domain => String(domain).trim().toLowerCase())
      .map(domain => domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].split(":")[0])
      .filter(Boolean);
  }

  function getConfiguredAllowedDomains(freshCfg = window.SemantixSettings?.siteConfig || {}) {
    return normalizeAllowedDomains(
      freshCfg.features?.allowedDomains ??
      freshCfg.features?.allowedDomain ??
      freshCfg.features?.domain ??
      freshCfg.allowedDomains ??
      cfg.features?.allowedDomains ??
      cfg.features?.allowedDomain ??
      cfg.features?.domain
    );
  }

  function isCurrentDomainAllowed(freshCfg) {
    const allowedDomains = getConfiguredAllowedDomains(freshCfg);
    if (!allowedDomains.length) return true;

    const host = location.hostname.toLowerCase().replace(/^www\./, "");
    return allowedDomains.some(domain => host === domain || host.endsWith(`.${domain}`));
  }

  /* ------------------------ DOM utils ------------------------ */

  function q1(sel, root = document) { try { const s = typeof sel === "string" ? sel.trim() : ""; return s ? root.querySelector(s) : null; } catch { return null; } }
  function qa(sel, root = document) { try { const s = typeof sel === "string" ? sel.trim() : ""; return s ? Array.from(root.querySelectorAll(s)) : []; } catch { return []; } }
  function one(arr, root = document) {
    for (const s of (arr || [])) {
      const el = q1(s, root);
      if (el) return el;
    }
    return null;
  }

  function ensureStyles() {
    if (document.getElementById("semantix-style-inject")) return;
    const st = document.createElement("style");
    st.id = "semantix-style-inject";
    st.textContent = `
      @keyframes semantixSpin{to{transform:rotate(360deg)}}

      /* Branded loading overlay (for 0 results recovery) — badge + skeleton grid */
      .semantix-branded-loader{
        margin:32px auto;
        max-width:1200px;
        padding:0 16px;
        width:100%;
        box-sizing:border-box;
        grid-column:1/-1;
        flex-basis:100%;
        font-family:inherit;
        opacity:0;
        transition:opacity 350ms ease;
      }
      .semantix-branded-loader.show{opacity:1}
      .semantix-branded-loader-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        flex-wrap:wrap;
        margin:0 0 18px;
      }
      .semantix-branded-loader-badge{
        display:inline-flex;
        align-items:center;
        gap:8px;
        font-size:.95em;
        font-weight:600;
        opacity:.85;
      }
      .semantix-branded-loader-spinner{
        width:16px;
        height:16px;
        border:2px solid rgba(0,0,0,.15);
        border-top-color:currentColor;
        border-radius:50%;
        animation:semantixSpin .7s linear infinite;
      }
      .semantix-branded-loader-text{
        font-size:inherit;
        font-weight:600;
        color:inherit;
      }
      .semantix-branded-loader-logo{
        width:var(--sx-logo-size, 100px);
        height:auto;
        object-fit:contain;
        opacity:0.9;
      }
      .semantix-branded-loader-grid{
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:20px;
      }
      @media(max-width:1024px){.semantix-branded-loader-grid{grid-template-columns:repeat(3,1fr)}}
      @media(max-width:768px){.semantix-branded-loader-grid{grid-template-columns:repeat(2,1fr)}}

      /* Consent bar */
      .semantix-consentbar{position:fixed;left:50%;transform:translate(-50%,18px);bottom:14px;width:min(920px,calc(100vw - 22px));z-index:var(--sx-z,1000000);opacity:0;transition:opacity 200ms ease,transform 220ms ease;pointer-events:none}
      .semantix-consentbar.show{opacity:1;transform:translate(-50%,0);pointer-events:auto}
      .semantix-consentbar-inner{background:#fff;border:1px solid rgba(0,0,0,.10);box-shadow:0 18px 55px rgba(0,0,0,.18);border-radius:16px;padding:14px;display:flex;gap:14px;align-items:center;justify-content:space-between;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial}
      .semantix-consentbar-left{display:flex;gap:12px;align-items:center;min-width:0}
      .semantix-consentbar-logo{width:34px;height:34px;border-radius:10px;object-fit:contain;background:#fff;flex:0 0 auto}
      .semantix-consentbar-title{font-size:14px;font-weight:800;margin:0 0 2px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .semantix-consentbar-sub{font-size:13px;opacity:.75;margin:0;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .semantix-consentbar-actions{display:flex;gap:10px;flex:0 0 auto}
      .semantix-btn{appearance:none;border:1px solid rgba(0,0,0,.14);border-radius:12px;padding:10px 12px;font-weight:800;font-size:13px;cursor:pointer;background:#fff;white-space:nowrap}
      .semantix-btn.primary{background:#111;color:#fff;border-color:#111}
      .semantix-btn:active{transform:translateY(1px)}
      @media(max-width:520px){.semantix-consentbar-inner{flex-direction:column;align-items:stretch}.semantix-consentbar-actions{width:100%}.semantix-btn{width:100%}}

      /* AI Product Badge - Dynamic from config - ONLY for injected cards */
      ${cfg.aiBadge.enabled ? `
      [data-semantix-ai="1"][data-semantix-injected="1"]{
        position:relative;
        transition:opacity ${cfg.behavior.fadeMs}ms ease;
      }
      
      [data-semantix-ai="1"][data-semantix-injected="1"]::before{
        content:"${cfg.aiBadge.text}";
        position:absolute;
        ${cfg.aiBadge.position === 'top-right' ? 'top:-10px;right:16px;' : ''}
        ${cfg.aiBadge.position === 'top-left' ? 'top:-10px;left:16px;' : ''}
        ${cfg.aiBadge.position === 'bottom-right' ? 'bottom:-10px;right:16px;' : ''}
        ${cfg.aiBadge.position === 'bottom-left' ? 'bottom:-10px;left:16px;' : ''}
        background:${cfg.aiBadge.backgroundColor};
        color:${cfg.aiBadge.textColor};
        font-size:${cfg.aiBadge.fontSize};
        font-weight:${cfg.aiBadge.fontWeight};
        padding:${cfg.aiBadge.padding};
        border-radius:${cfg.aiBadge.borderRadius};
        z-index:${cfg.aiBadge.zIndex};
        border:${cfg.aiBadge.borderWidth} ${cfg.aiBadge.borderStyle} ${cfg.aiBadge.borderColor};
        box-shadow:${cfg.aiBadge.boxShadow};
        font-family:system-ui,-apple-system,sans-serif;
        text-transform:uppercase;
      }
      ` : ''}

      /* Special label (printed/digital price badges + legacy sale badge).
         Selectors are intentionally plain so site CSS can restyle to match native badges. */
      .semantix-special-labels{display:inline-flex;gap:6px;flex-wrap:wrap}
      .semantix-special-label{
        display:inline-flex;
        align-items:center;
        gap:4px;
        font-size:12px;
        font-weight:600;
        padding:3px 8px;
        border-radius:6px;
        background:rgba(17,17,17,.06);
        color:#111;
        line-height:1.4;
        font-family:system-ui,-apple-system,sans-serif;
      }
      .semantix-special-label svg{flex:0 0 auto}
      .semantix-special-label--legacy{background:#e11d48;color:#fff}

      /* Generic conditional-block helper for any custom cardTemplate: an element whose
         visibility is driven by a {{specialLabel.*.enabled}}/{{specialLabel.plain}}
         placeholder (e.g. data-enabled="{{specialLabel.printed.enabled}}") hides itself
         automatically when that placeholder resolved to empty. Not specific to any field
         or site — works for every {{...enabled}}/{{specialLabel.plain}} placeholder. */
      [data-enabled=""]{display:none !important}

      /* Skeleton loader for enrichment mode */
      .semantix-skeleton-card{
        position:relative;
        overflow:hidden;
        border-radius:12px;
        background:#f8f8f9;
        border:1px solid rgba(0,0,0,.06);
        display:flex;
        flex-direction:column;
        opacity:0;
        animation:semantixSkeletonIn 150ms ease forwards;
      }
      @keyframes semantixSkeletonIn{to{opacity:1}}
      .semantix-skeleton-img{
        width:100%;
        aspect-ratio:1/1;
        background:linear-gradient(110deg,#ebebed 30%,#f5f5f6 50%,#ebebed 70%);
        background-size:200% 100%;
        animation:semantixShimmer 1s ease-in-out infinite;
      }
      .semantix-skeleton-body{padding:14px 12px;display:flex;flex-direction:column;gap:10px}
      .semantix-skeleton-line{
        height:12px;
        border-radius:6px;
        background:linear-gradient(110deg,#ebebed 30%,#f5f5f6 50%,#ebebed 70%);
        background-size:200% 100%;
        animation:semantixShimmer 1s ease-in-out infinite;
      }
      .semantix-skeleton-line.w75{width:75%}
      .semantix-skeleton-line.w50{width:50%}
      .semantix-skeleton-line.w35{width:35%}
      .semantix-skeleton-badge{
        display:inline-flex;
        align-items:center;
        gap:6px;
        margin-top:4px;
        padding:5px 10px;
        border-radius:8px;
        background:rgba(139,92,246,0.07);
        border:1px solid rgba(139,92,246,0.15);
        width:fit-content;
      }
      .semantix-skeleton-badge-dot{
        width:6px;height:6px;
        border-radius:50%;
        background:#8b5cf6;
        animation:semantixPulse .9s ease-in-out infinite;
      }
      .semantix-skeleton-badge-text{
        font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
        font-size:11px;
        font-weight:600;
        color:#8b5cf6;
        letter-spacing:0.02em;
      }
      @keyframes semantixShimmer{0%{background-position:200% 0}to{background-position:-200% 0}}
      @keyframes semantixPulse{0%,100%{opacity:.4}50%{opacity:1}}
      .semantix-skeleton-card.out{
        opacity:0!important;
        transform:scale(0.97);
        transition:opacity 120ms ease,transform 120ms ease;
      }
      /* Compact slim loading bar for single-product-per-row grids (mobile) */
      .semantix-skeleton-bar{
        box-sizing:border-box;
        width:100%;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:8px;
        padding:10px 14px;
        margin:0 0 12px;
        border-radius:10px;
        background:rgba(139,92,246,0.06);
        border:1px solid rgba(139,92,246,0.15);
        opacity:0;
        animation:semantixSkeletonIn 150ms ease forwards;
      }
      .semantix-skeleton-bar-dot{
        width:6px;height:6px;
        border-radius:50%;
        background:#8b5cf6;
        animation:semantixPulse .9s ease-in-out infinite;
      }
      .semantix-skeleton-bar-text{
        font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
        font-size:12px;
        font-weight:600;
        color:#8b5cf6;
        letter-spacing:0.02em;
      }
      .semantix-skeleton-bar.out{
        opacity:0!important;
        transition:opacity 120ms ease;
      }

      /* Other */
      .semantix-ph-fade{transition:opacity var(--sx-ph-ms,220ms) ease}
      .semantix-ai-grid{list-style:none!important;margin:0!important;padding:0!important;width:100%!important}
      .semantix-ai-grid>*{list-style:none!important}
      .semantix-basic-card:hover{box-shadow:0 4px 12px rgba(0,0,0,0.1)}
    `;
    document.head.appendChild(st);
  }

  /* ------------------------ storage ------------------------ */

  // Windows-1255 (Hebrew) byte→char map for 0x80-0xFF
  const WIN1255 = "\u20AC\uFFFD\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\uFFFD\u2039\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\uFFFD\u203A\uFFFD\uFFFD\uFFFD\uFFFD\u00A0\u00A1\u00A2\u00A3\u20AA\u00A5\u00A6\u00A7\u00A8\u00A9\u00D7\u00AB\u00AC\u00AD\u00AE\u00AF\u00B0\u00B1\u00B2\u00B3\u00B4\u00B5\u00B6\u00B7\u00B8\u00B9\u00F7\u00BB\u00BC\u00BD\u00BE\u00BF\u05B0\u05B1\u05B2\u05B3\u05B4\u05B5\u05B6\u05B7\u05B8\u05B9\u05BA\u05BB\u05BC\u05BD\u05BE\u05BF\u05C0\u05C1\u05C2\u05C3\u05F0\u05F1\u05F2\u05F3\u05F4\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\u05D0\u05D1\u05D2\u05D3\u05D4\u05D5\u05D6\u05D7\u05D8\u05D9\u05DA\u05DB\u05DC\u05DD\u05DE\u05DF\u05E0\u05E1\u05E2\u05E3\u05E4\u05E5\u05E6\u05E7\u05E8\u05E9\u05EA\uFFFD\uFFFD\u200E\u200F\uFFFD";

  function decodeWin1255(raw) {
    // raw is the percent-encoded string straight from the URL (e.g. %E0%E3%E5%ED)
    let out = "";
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] === '%') {
        const hex = parseInt(raw.substr(i + 1, 2), 16);
        if (hex >= 0x80) {
          out += WIN1255[hex - 0x80];
        } else {
          out += String.fromCharCode(hex);
        }
        i += 2;
      } else if (raw[i] === '+') {
        out += ' ';
      } else {
        out += raw[i];
      }
    }
    return out;
  }

  function isGarbledHebrew(str) {
    // After UTF-8 decode of Win-1255 bytes, Hebrew shows as Latin chars in 0xC0-0xFF range
    // or replacement chars. Detect by checking for high ratio of non-printable/garbled chars.
    if (!str) return false;
    let garbled = 0;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      if ((c >= 0xC0 && c <= 0xFF) || c === 0xFFFD) garbled++;
    }
    return garbled > str.length * 0.4;
  }

  function getRawParam(key) {
    // Extract raw percent-encoded value from location.search without decoding
    const search = location.search;
    const pattern = new RegExp('[?&]' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^&]*)', 'i');
    const m = search.match(pattern);
    return m ? m[1] : null;
  }

  function getQuery() {
    const p = new URLSearchParams(location.search);
    for (const k of cfg.queryParams) {
      const v = p.get(k);
      if (!v) continue;
      // Check if the decoded value looks garbled (Win-1255 misread as UTF-8)
      if (isGarbledHebrew(v)) {
        const raw = getRawParam(k);
        if (raw) {
          const decoded = decodeWin1255(raw);
          console.log(`[Semantix] Detected Win-1255 encoding for "${k}", decoded: "${decoded}"`);
          return decoded;
        }
      }
      return v;
    }
    return null;
  }

  function lsGet(k, fb = "") { try { return localStorage.getItem(k) ?? fb; } catch { return fb; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch {} }
  function ssGet(k, fb = "") { try { return sessionStorage.getItem(k) ?? fb; } catch { return fb; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch {} }

  // The consent bar is hard-disabled at the engine level: no configuration (site config, A/B variant, test mode)
  // can show it. On Shopify the store's own consent decides (Customer Privacy API, the store's cookie banner):
  // until it allows analytics, no visitor id is created or sent and no click / cart / exposure event leaves the
  // browser — search itself still works, anonymously. Elsewhere the merchant's site is responsible for consent.
  function shopifyStorefront() {
    return !!(window.Shopify && (window.Shopify.shop || window.Shopify.theme));
  }
  function getConsentState() {
    if (!shopifyStorefront()) return "granted";
    const cp = window.Shopify.customerPrivacy;
    if (!cp || typeof cp.analyticsProcessingAllowed !== "function") return "pending";
    try { return cp.analyticsProcessingAllowed() ? "granted" : "denied"; } catch { return "denied"; }
  }
  function analyticsAllowed() { return getConsentState() === "granted"; }
  // Loads Shopify's consent API when the theme has not; re-runs `then` whenever the visitor's choice changes.
  function watchShopifyConsent(then) {
    if (!shopifyStorefront()) return;
    try { document.addEventListener("visitorConsentCollected", () => then()); } catch {}
    if (window.Shopify.customerPrivacy) { then(); return; }
    try {
      if (typeof window.Shopify.loadFeatures === "function") {
        window.Shopify.loadFeatures([{ name: "consent-tracking-api", version: "0.1" }], err => { if (!err) then(); });
      }
    } catch {}
  }

  // Product data is inserted into the store's page: text is escaped and only web links are kept as links.
  function escHtml(v) {
    return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function safeUrl(v) {
    const u = String(v ?? "").trim();
    if (!u) return "";
    try { return /^https?:$/.test(new URL(u, location.href).protocol) ? u : ""; } catch { return ""; }
  }

  // Visitor identity. Persisted in localStorage, so it survives tab closes and
  // spans visits — it identifies a browser, not a single sitting.
  //
  // The id is still sent on the wire as `session_id`: the backend, its stored
  // events, and the personalization profiles are all keyed by that field name.
  // Renaming the key here is a client-side concern only.
  const VISITOR_ID_KEY = "semantix_visitor_id";
  const LEGACY_VISITOR_ID_KEY = "semantix_session_id";

  // Reads the stored id without minting one. Adopts the pre-rename key on first
  // sight so returning visitors keep the id their server-side profile is under.
  function getVisitorId() {
    const vid = lsGet(VISITOR_ID_KEY, "");
    if (vid) return vid;

    const legacy = lsGet(LEGACY_VISITOR_ID_KEY, "");
    if (legacy) {
      lsSet(VISITOR_ID_KEY, legacy);
      return legacy;
    }
    return "";
  }

  function ensureVisitorId() {
    if (!analyticsAllowed()) return undefined;
    let vid = getVisitorId();
    if (!vid) {
      vid = "vis-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
      lsSet(VISITOR_ID_KEY, vid);
    }
    return vid;
  }

  /* ------------------------ test modes (per visitor id) ------------------------ */
  //
  // Two ways to run a specific browser in a different engine mode:
  //
  //  1. Server-driven — siteConfig.sessionModes maps visitor id → mode:
  //       "sessionModes": { "vis-123-abc": "shadow", "vis-456-def": "off",
  //                         "vis-789-ghi": { "injectIntoGrid": false } }
  //     A string value picks a preset; an object is merged into cfg.features.
  //     (Ids minted before the visitor-id rename start with "sess-" instead.)
  //
  //  2. Local override — URL params for hands-on testing:
  //       ?semantix_vid=vis-123-abc      adopt a known visitor id
  //       ?semantix_mode=shadow          persist a local mode override
  //       ?semantix_mode=clear           remove the local override
  //     Local override wins over sessionModes. Also via __SemantixDebug.testMode.

  const MODE_OVERRIDE_KEY = "semantix_mode_override";

  // Presets can set features and behavior.
  //   normal — leave shadow/kill-switch, respect the site's other feature flags
  //   full   — force zero-results recovery on, even if the site-wide config has
  //            it disabled (shadow-rollout configs). NOTE: rerankBoost/injectIntoGrid
  //            are hard-disabled at the engine level (see rerankGrid/canRerank/canInject)
  //            and cannot be re-enabled by this or any other override.
  const MODE_PRESETS = {
    shadow:   { features: { shadowMode: true,  disabled: false } },
    off:      { features: { disabled: true } },
    disabled: { features: { disabled: true } },
    normal:   { features: { shadowMode: false, disabled: false } },
    full:     {
      features: { shadowMode: false, disabled: false, zeroReplace: true }
    }
  };

  // A sessionModes entry can be a preset name, a bare features object,
  // or an explicit { features, behavior } object.
  function normalizeOverride(entry) {
    if (typeof entry === "string") return MODE_PRESETS[entry] || null;
    if (entry && typeof entry === "object") {
      return (entry.features || entry.behavior) ? entry : { features: entry };
    }
    return null;
  }

  function consumeTestParams() {
    let params;
    try { params = new URLSearchParams(location.search); } catch { return; }

    // semantix_sid stays accepted — it's baked into existing QA links and docs.
    const vid = params.get("semantix_vid") || params.get("semantix_sid");
    if (vid) {
      lsSet(VISITOR_ID_KEY, vid);
      console.log("[Semantix Test] 🧪 visitor id forced via URL:", vid);
    }

    const mode = params.get("semantix_mode");
    if (mode) {
      if (mode === "clear") {
        try { localStorage.removeItem(MODE_OVERRIDE_KEY); } catch {}
        console.log("[Semantix Test] 🧪 mode override cleared");
      } else if (MODE_PRESETS[mode]) {
        lsSet(MODE_OVERRIDE_KEY, mode);
        console.log("[Semantix Test] 🧪 mode override set via URL:", mode);
      } else {
        console.warn("[Semantix Test] unknown mode:", mode, "— valid:", Object.keys(MODE_PRESETS).join(", "), ", clear");
      }
    }
  }

  // Priority: local override (URL / localStorage) > server sessionModes map.
  function resolveModeOverride() {
    const local = lsGet(MODE_OVERRIDE_KEY, "");
    if (local && MODE_PRESETS[local]) {
      return { source: "local", mode: local, override: MODE_PRESETS[local] };
    }

    const fresh = window.SemantixSettings?.siteConfig || {};
    const map = fresh.sessionModes || C.sessionModes;
    if (!map || typeof map !== "object") return null;

    // Match on either the current visitor id or the legacy session id, so a
    // sessionModes entry keyed by an old "sess-" id keeps working even after
    // this browser's semantix_visitor_id has since been overwritten with a
    // newer "vis-" id (or vice versa). Current id wins if both are in the map.
    const vid = getVisitorId();
    const legacyVid = lsGet(LEGACY_VISITOR_ID_KEY, "");
    const matchedId = (vid && vid in map) ? vid : (legacyVid && legacyVid in map) ? legacyVid : null;
    if (!matchedId) return null;

    const entry = map[matchedId];
    const override = normalizeOverride(entry);
    if (!override) {
      console.warn("[Semantix Test] sessionModes entry for", matchedId, "is invalid:", entry);
      return null;
    }
    return { source: "sessionModes", mode: typeof entry === "string" ? entry : "custom", override };
  }

  // Merge the override into BOTH the merged cfg and the fresh siteConfig,
  // because the engine re-reads siteConfig.features at runtime (kill switch,
  // shadow mode, consent bar, placeholder rotator).
  function applyModeOverride() {
    const o = resolveModeOverride();
    if (!o) return;
    const s = window.SemantixSettings = window.SemantixSettings || {};
    s.siteConfig = s.siteConfig || {};
    if (o.override.features) {
      cfg.features = { ...cfg.features, ...o.override.features };
      s.siteConfig.features = { ...(s.siteConfig.features || {}), ...o.override.features };
    }
    if (o.override.behavior) {
      cfg.behavior = { ...cfg.behavior, ...o.override.behavior };
      s.siteConfig.behavior = { ...(s.siteConfig.behavior || {}), ...o.override.behavior };
    }
    console.log(`[Semantix Test] 🧪 Mode override active (${o.source}): ${o.mode}`, o.override);
  }

  /* ------------------------ a/b tests (weighted, sticky per visitor) ------------------------ */
  //
  // siteConfig.abTests splits visitors into named-test variants by weight and
  // merges the winning variant's features/behavior into cfg — e.g. to run
  // zero-results recovery for only half of sessions:
  //
  //   "abTests": {
  //     "zero_results_only": {
  //       "enabled": true,
  //       "variants": [
  //         { "id": "control",   "weight": 50 },
  //         { "id": "zero_only", "weight": 50,
  //           "features": { "rerankBoost": false, "injectIntoGrid": false, "zeroReplace": true } }
  //       ]
  //     }
  //   }
  //
  // Assignment is deterministic (hash of visitor id + test name) AND sticky
  // (persisted in localStorage under semantix_ab_<testName>), so a visitor
  // stays in the same bucket across visits even if variant weights are later
  // edited on the server. The assigned variant ids are attached to
  // search/zero-search/click payloads (see abTestPayloadFields) so results
  // can be split out server-side. A sessionModes/local mode override (above)
  // always wins over an A/B assignment — it's applied after this.
  //
  // "sticky": false on a test turns the localStorage memory off: the bucket is
  // then only the hash, so editing the weights on the server moves visitors.
  // With the variants kept in the same order, raising the first one's weight
  // only ever moves visitors into it — a rollout that can be ramped (or pulled
  // back to 0) from the server.

  const AB_ASSIGN_PREFIX = "semantix_ab_";
  const ASSIGNED_AB_VARIANTS = {}; // testName -> variantId

  function hashToUnit(str) {
    // FNV-1a 32-bit, mapped to [0, 1)
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0) / 4294967296;
  }

  function pickVariant(variants, unit) {
    const total = variants.reduce((sum, v) => sum + (Number(v.weight) || 0), 0);
    if (total <= 0) return null;
    let acc = 0;
    const target = unit * total;
    for (const v of variants) {
      acc += Number(v.weight) || 0;
      if (target < acc) return v;
    }
    return variants[variants.length - 1];
  }

  // "pins" on a test ({ "<visitor id>": "<variant id>" }) puts those visitors in that variant whatever the weights say,
  // e.g. an operator's own browser on Semantix while every shopper stays on the store's search (weight 0). A pinned
  // visitor is reported as "<variant>:pinned", so their events stay out of the group comparison.
  function pinnedVariant(test, validIds) {
    const pins = test.pins;
    if (!pins || typeof pins !== "object" || Array.isArray(pins)) return null;
    const vid = getVisitorId(), legacyVid = lsGet(LEGACY_VISITOR_ID_KEY, "");
    const id = (vid && Object.prototype.hasOwnProperty.call(pins, vid)) ? pins[vid]
      : (legacyVid && Object.prototype.hasOwnProperty.call(pins, legacyVid)) ? pins[legacyVid] : null;
    return typeof id === "string" && validIds.has(id) ? test.variants.find(v => v.id === id) : null;
  }

  function resolveAbTestVariant(testName, test) {
    if (!test || test.enabled === false || !Array.isArray(test.variants) || !test.variants.length) return null;

    const storageKey = AB_ASSIGN_PREFIX + testName;
    const validIds = new Set(test.variants.map(v => v.id));
    const sticky = test.sticky !== false;

    const pinned = pinnedVariant(test, validIds);
    if (pinned) return { ...pinned, pinned: true };

    const stored = sticky ? lsGet(storageKey, "") : "";
    if (stored && validIds.has(stored)) return test.variants.find(v => v.id === stored);

    const unit = hashToUnit(ensureVisitorId() + ":" + testName);
    const picked = pickVariant(test.variants, unit);
    if (picked && sticky) lsSet(storageKey, picked.id);
    return picked;
  }

  function applyAbTests() {
    const fresh = window.SemantixSettings?.siteConfig || {};
    const tests = fresh.abTests || C.abTests;
    if (!tests || typeof tests !== "object") return;

    const s = window.SemantixSettings = window.SemantixSettings || {};
    s.siteConfig = s.siteConfig || {};

    for (const testName of Object.keys(tests)) {
      const variant = resolveAbTestVariant(testName, tests[testName]);
      if (!variant) continue;

      // tests[testName].fallback: the built-in split, used only because the server's did not answer in time. Such a visitor
      // was never really assigned, so "<variant>:fallback" keeps them out of the group comparison: counted as native, they
      // were a third of the Semantix group on Steimatzky (hash in Semantix, config late, logged native) — a split that does
      // not match the weights and a native group that is the slow connections.
      ASSIGNED_AB_VARIANTS[testName] = variant.pinned ? variant.id + ":pinned" : tests[testName].fallback === true ? variant.id + ":fallback" : variant.id;

      if (variant.features) {
        cfg.features = { ...cfg.features, ...variant.features };
        s.siteConfig.features = { ...(s.siteConfig.features || {}), ...variant.features };
      }
      if (variant.behavior) {
        cfg.behavior = { ...cfg.behavior, ...variant.behavior };
        s.siteConfig.behavior = { ...(s.siteConfig.behavior || {}), ...variant.behavior };
      }
      console.log(`[Semantix Test] 🧪 A/B "${testName}" → variant "${variant.id}"`, variant);
    }
  }

  // Spread into tracking payloads so assigned variants can be split out server-side.
  function abTestPayloadFields() {
    return Object.keys(ASSIGNED_AB_VARIANTS).length ? { ab_tests: { ...ASSIGNED_AB_VARIANTS } } : {};
  }

  // One id per search, kept from the search until the order: a click, a confirmed add to cart and the purchase carry the
  // search that led to them, instead of being joined afterwards by visitor and time. The same query keeps its id while
  // the shopper pages or returns to it; another query, or half an hour later, is a new search. Survives page loads.
  const SEARCH_CONTEXT_KEY = "semantix_search_ctx", SEARCH_IDLE_MS = 30 * 60 * 1000, SEARCH_ATTRIBUTION_MS = 7 * 864e5;
  function searchContext() {
    try {
      const c = JSON.parse(lsGet(SEARCH_CONTEXT_KEY, "null"));
      return c && c.id && Date.now() - c.at < SEARCH_ATTRIBUTION_MS ? c : null;
    } catch { return null; }
  }
  function searchPayloadFields(q) {
    const fields = abTestPayloadFields();
    try {
      if (!analyticsAllowed()) return fields;
      let c = searchContext();
      if (!c || c.q !== q || Date.now() - c.at > SEARCH_IDLE_MS) c = { id: "srch-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10), q };
      c.at = Date.now();
      delete c.typed;
      lsSet(SEARCH_CONTEXT_KEY, JSON.stringify(c));
      return { ...fields, search_id: c.id, visit_id: visitId() };
    } catch { return fields; }
  }
  function withSearchId(payload) {
    const c = searchContext();
    return c && !payload.search_id ? { ...payload, search_id: c.id } : payload;
  }

  // A click or an add to cart names a search only when it can be shown to have come from it:
  //   results_page    it happened on the results of that search
  //   typed_results   a product picked from the list shown while typing: no full search ran, so the pick logs one
  //   autocomplete    a product picked from the suggestions for it
  //   clicked_result  a product the shopper opened from those results on this visit (click_id names the click)
  //   none            anything else, even right after a search: no search_id, and the reports don't count it
  // A visit ends after 30 idle minutes, while the visitor id (session_id on the wire) stays for good; the server
  // can check each link from the stored rows alone: core/rollout-report.mjs in the studio.
  const VISIT_KEY = "semantix_visit", SEARCH_CLICKS_KEY = "semantix_search_clicks";
  function visitId() {
    let v = null;
    try { v = JSON.parse(lsGet(VISIT_KEY, "null")); } catch {}
    if (!v?.id || Date.now() - v.at > SEARCH_IDLE_MS) v = { id: "vst-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10) };
    v.at = Date.now();
    lsSet(VISIT_KEY, JSON.stringify(v));
    return v.id;
  }
  // The search whose results this page shows, the only search a click here can come from.
  function pageSearch(typed) {
    const q = String(getQuery() || resultsShell()?.q || "").trim();
    if (!q) return null;
    const c = searchContext();
    if (c && String(c.q).trim() === q) return c;
    searchPayloadFields(q);
    const fresh = searchContext();
    if (!fresh || String(fresh.q).trim() !== q) return null;
    if (typed) {
      fresh.typed = true;
      lsSet(SEARCH_CONTEXT_KEY, JSON.stringify(fresh));
      logTypedSearch(fresh);
    }
    return fresh;
  }
  // keepalive: the pick usually leaves the page right away.
  function logTypedSearch(c) {
    try {
      fetch(S.apiBase + (S.endpoints?.logQuery || "/log-query"), {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ query: c.q, typed: true, zero_results: false, session_id: ensureVisitorId(), search_id: c.id, visit_id: visitId(), ...abTestPayloadFields() }),
        keepalive: true
      }).catch(() => {});
    } catch {}
  }
  function inTypedList(card) {
    return !!card?.closest?.("[data-semantix-typed]");
  }
  function inSearchResults(card) {
    return !!card && (card.getAttribute("data-semantix-ai") === "1" || !!matchClosestSelector(card, asList(cfg.selectors?.resultsGrid)));
  }
  function productPath(href) {
    try { return new URL(href, location.href).pathname; } catch { return ""; }
  }
  function searchClicks() {
    try { return JSON.parse(lsGet(SEARCH_CLICKS_KEY, "[]")) || []; } catch { return []; }
  }
  function linkClick(payload, inResults, typed) {
    const visit_id = visitId(), picked = payload.source === "autocomplete" && !!payload.search_query;
    if (picked) searchPayloadFields(payload.search_query);
    const c = picked ? searchContext() : inResults ? pageSearch(typed) : null;
    if (!c) return { ...payload, visit_id, search_link: "none" };
    lsSet(SEARCH_CLICKS_KEY, JSON.stringify([...searchClicks(), { id: payload.event_id, pid: String(payload.product_id), path: productPath(payload.product_url), search_id: c.id, q: c.q, visit_id }].slice(-30)));
    return { ...payload, visit_id, search_id: c.id, search_query: c.q, search_link: picked ? "autocomplete" : c.typed ? "typed_results" : "results_page" };
  }
  // The button the shopper last pressed, for the store's answer that follows: which product's card it was on (none on a
  // product page: then the page's own product), and whether that card is a search result.
  let ATC_PRESS = null;
  function linkCart(payload) {
    const visit_id = visitId();
    if (payload.event_type !== "add_to_cart" && payload.event_type !== "add_to_cart_confirmed") return { ...withSearchId(payload), visit_id };
    const press = ATC_PRESS && Date.now() - ATC_PRESS.at < 10000 ? ATC_PRESS : null;
    const c = press?.inResults ? pageSearch(press.typed) : null;
    // card_path: the product's own address, which names its SKU on a results page too (an order lists SKUs).
    const pid = String(payload.product_id || ""), path = press?.path || location.pathname;
    if (c) return { ...payload, visit_id, card_path: path, search_id: c.id, search_query: c.q, search_link: c.typed ? "typed_results" : "results_page" };
    const click = searchClicks().reverse().find(k => k.visit_id === visit_id && ((pid && k.pid === pid) || k.path === path));
    if (click) return { ...payload, visit_id, card_path: path, search_id: click.search_id, search_query: click.q, click_id: click.id, search_link: "clicked_result" };
    return { ...payload, visit_id, card_path: path, search_link: "none" };
  }

  consumeTestParams();
  applyAbTests();
  applyModeOverride();

  /* ------------------------ api ------------------------ */

  function headers() {
    const h = { "Content-Type": "application/json" };
    if (S.apiKey) h["X-API-Key"] = S.apiKey;
    return h;
  }

  // behavior.fallbackMs: a request with no complete answer by then is aborted and fails, and every caller already gives
  // the page back as the store rendered it on failure (results grid, zero-results page).
  function deadline() {
    const ms = Number(cfg.behavior?.fallbackMs) || 0;
    if (!(ms > 0) || !window.AbortController) return { signal: undefined, clear() {} };
    const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
    return { signal: c.signal, clear: () => clearTimeout(t) };
  }

  function apiPost(endpoint, payload) {
    const d = deadline();
    return fetch(S.apiBase + endpoint, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(payload || {}),
      signal: d.signal
    }).then(async (r) => {
      const t = await r.text();
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${t.slice(0, 250)}`);
      return JSON.parse(t);
    }).catch(e => {
      if (e?.name === "AbortError") throw new Error("no answer within " + cfg.behavior.fallbackMs + " ms — the store's own search stays");
      throw e;
    }).finally(d.clear);
  }

  /* ------------------------ zero-results tracking ------------------------ */
  // Report a search whose NATIVE results were 0, so zero-result sessions can be
  // counted server-side. Deduped per browser session (sessionStorage) so cache
  // hits, refreshes, and SPA re-renders don't inflate counts.
  function trackZeroSearch(q, recoveredCount, source) {
    try {
      const key = "semantix_zero_tracked_v1";
      let seen = [];
      try { seen = JSON.parse(ssGet(key, "[]")) || []; } catch {}
      if (seen.includes(q)) return;
      seen.push(q);
      ssSet(key, JSON.stringify(seen.slice(-50)));
      if (!analyticsAllowed()) return;
      apiPost(S.endpoints.zeroSearch, {
        query: q,
        session_id: ensureVisitorId(),
        page_url: location.href,
        recovered_count: recoveredCount, // null = unknown (shadow mode)
        source: source || "live",
        timestamp: new Date().toISOString(),
        ...abTestPayloadFields()
      }).then(() => log("📤 Zero-results search tracked:", q))
        .catch(() => {});
    } catch {}
  }

  /* ------------------------ consent bar ------------------------ */

  function maybeShowConsentBar() {
    return; // hard-disabled at engine level — see getConsentState
    if (!cfg.consent.enabled) return;
    if (cfg.features?.shadowMode === true || window.SemantixSettings?.siteConfig?.features?.shadowMode === true) return;
    const st = getConsentState();
    if (st === "granted" || st === "denied") return;

    ensureStyles();
    if (document.querySelector('.semantix-consentbar[data-owned="1"]')) return;

    const bar = document.createElement("div");
    bar.className = "semantix-consentbar";
    bar.setAttribute("data-owned", "1");
    bar.style.setProperty("--sx-z", String(cfg.consent.zIndex || 1000000));
    bar.innerHTML = `
      <div class="semantix-consentbar-inner">
        <div class="semantix-consentbar-left">
          <img class="semantix-consentbar-logo" src="${cfg.consent.logoUrl}" alt="Semantix"/>
          <div style="min-width:0">
            <div class="semantix-consentbar-title">${cfg.consent.title}</div>
            <p class="semantix-consentbar-sub">${cfg.consent.text}</p>
          </div>
        </div>
        <div class="semantix-consentbar-actions">
          <button class="semantix-btn" data-act="deny">${cfg.consent.declineText}</button>
          <button class="semantix-btn primary" data-act="grant">${cfg.consent.acceptText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(bar);
    requestAnimationFrame(() => bar.classList.add("show"));

    bar.addEventListener("click", (e) => {
      const act = e.target?.getAttribute?.("data-act");
      if (act === "grant" || act === "deny") {
        lsSet(cfg.consent.storageKey, act === "grant" ? "granted" : "denied");
        bar.classList.remove("show");
        setTimeout(() => bar.remove(), 240);
      }
    });
  }

  /* ------------------------ overlays ------------------------ */

  // (overlay removed — replaced by skeleton loader below)

  // Detect grids that lay out a single product per row (common on mobile).
  // In that case the full skeleton card spans the whole screen, so we prefer a slim bar.
  function isSingleColumnGrid(grid, baseCard) {
    if (!grid) return false;
    const ratio = cfg.skeleton?.compactWidthRatio ?? DEFAULTS.skeleton.compactWidthRatio;
    const gridWidth = grid.clientWidth || grid.offsetWidth || 0;
    if (!gridWidth) return false;
    const cardWidth = baseCard?.offsetWidth || grid.children?.[0]?.offsetWidth || 0;
    if (!cardWidth) return false;
    return (cardWidth / gridWidth) >= ratio;
  }

  // Skeleton card loader for enrichment mode (inject/rerank)
  function showSkeletonLoader(grid, baseCard) {
    if (!grid) return null;
    ensureStyles();

    // Single-product-per-row grids → slim loading bar instead of a full overlay card
    const compactEnabled = cfg.skeleton?.compactSingleRow ?? DEFAULTS.skeleton.compactSingleRow;
    if (compactEnabled && isSingleColumnGrid(grid, baseCard)) {
      const compactText = cfg.skeleton?.compactText ?? DEFAULTS.skeleton.compactText;
      const safeCompactText = String(compactText).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
      const bar = document.createElement("div");
      bar.className = "semantix-skeleton-bar";
      bar.setAttribute("data-semantix-skeleton", "1");
      bar.innerHTML = `
        <span class="semantix-skeleton-bar-dot"></span>
        <span class="semantix-skeleton-bar-text">${safeCompactText}</span>
      `;
      grid.prepend(bar);
      console.log("[Semantix] Showing compact skeleton bar (single-column grid)");
      return [bar];
    }

    const count = 1;

    // Match card tag from existing cards or grid children
    const cardTag = baseCard?.tagName?.toLowerCase() ||
                    grid.children[0]?.tagName?.toLowerCase() || "li";

    const skeletons = [];
    for (let i = 0; i < count; i++) {
      const skel = document.createElement(cardTag);
      // Inherit the base card's classes so the skeleton respects grid column sizing
      // (important for dynamic/SSR grids like Nuxt where column width is class-driven)
      if (baseCard?.className) {
        skel.className = baseCard.className + " semantix-skeleton-card";
      } else {
        skel.className = "semantix-skeleton-card";
      }
      // Pin measured pixel width as fallback for grids not yet hydrated
      if (baseCard) {
        const w = baseCard.offsetWidth;
        if (w > 0) { skel.style.width = w + "px"; skel.style.maxWidth = w + "px"; }
      }
      skel.setAttribute("data-semantix-skeleton", "1");
      const loadingText = cfg.skeleton?.loadingText ?? DEFAULTS.skeleton.loadingText;
      const safeLoadingText = String(loadingText).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
      skel.innerHTML = `
        <div class="semantix-skeleton-img"></div>
        <div class="semantix-skeleton-body">
          <div class="semantix-skeleton-line w75"></div>
          <div class="semantix-skeleton-line w50"></div>
          <div class="semantix-skeleton-line w35"></div>
          <div class="semantix-skeleton-badge">
            <span class="semantix-skeleton-badge-dot"></span>
            <span class="semantix-skeleton-badge-text">${safeLoadingText}</span>
          </div>
        </div>
      `;
      grid.prepend(skel);
      skeletons.push(skel);
    }

    console.log(`[Semantix] Showing ${count} skeleton cards`);
    return skeletons;
  }

  function hideSkeletonLoader(skeletons) {
    if (!skeletons || !skeletons.length) return;
    skeletons.forEach(s => s.classList.add("out"));
    setTimeout(() => {
      skeletons.forEach(s => { try { s.remove(); } catch {} });
    }, 150);
  }

  // Branded loader for 0 results recovery - shows big logo!
  // Branded loader for 0 results recovery - CONTAINER OVERLAY
  function showBrandedLoader(noResultsEl) {
    ensureStyles();
    
    // Remove any existing loader
    const existing = document.querySelector('[data-semantix-loader="1"]');
    if (existing) existing.remove();
    
    const loader = document.createElement("div");
    loader.className = "semantix-branded-loader";
    loader.setAttribute("data-semantix-loader", "1");
    loader.style.setProperty("--sx-logo-size", `${cfg.branding.logoSize || 100}px`);
    const logoHtml = cfg.branding.showLogo === false ? "" : `
        <img class="semantix-branded-loader-logo" src="${cfg.branding.logoUrl}" alt="Powered by Semantix" />`;

    const skelCard = `
      <div class="semantix-skeleton-card">
        <div class="semantix-skeleton-img"></div>
        <div class="semantix-skeleton-body">
          <div class="semantix-skeleton-line w75"></div>
          <div class="semantix-skeleton-line w35"></div>
        </div>
      </div>`;

    loader.innerHTML = `
      <div class="semantix-branded-loader-head">
        <div class="semantix-branded-loader-badge">
          <span class="semantix-branded-loader-spinner"></span>
          <span class="semantix-branded-loader-text">${cfg.branding.loadingText}</span>
        </div>
${logoHtml}
      </div>
      <div class="semantix-branded-loader-grid">${skelCard.repeat(4)}</div>
    `;

    // Insert after noResults element, or in main content area
    if (noResultsEl && noResultsEl.parentElement) {
      noResultsEl.parentElement.insertBefore(loader, noResultsEl.nextSibling);
    } else {
      // Fallback: find main content area
      const main = q1("main") || q1("[role='main']") || q1(".main-content") || q1("#main") || document.body;
      main.appendChild(loader);
    }

    // Show immediately
    loader.classList.add("show");
    return loader;
  }

  function hideBrandedLoader(loader) {
    if (!loader) return;
    loader.classList.remove("show");
    setTimeout(() => { try { loader.remove(); } catch {} }, 380);
  }

  function restoreNoResultsNow(noResultsEl) {
    if (!noResultsEl) return;
    noResultsEl.style.transition = "none";
    noResultsEl.style.opacity = "1";
    noResultsEl.style.display = "";
    requestAnimationFrame(() => { noResultsEl.style.transition = ""; });
  }

  /* ------------------------ autocomplete no-results replacement ------------------------ */

  function attachAutocompleteNoResults() {
    const acf = cfg.autocompleteFooter;
    if (!acf?.enabled || !acf?.selector || !acf?.text) return;
    if (window.__semantix_acf_attached) return;
    window.__semantix_acf_attached = true;
    
    function replaceText() {
      const el = q1(acf.selector);
      if (!el) return;
      
      // Skip if already replaced
      if (el.getAttribute("data-semantix-replaced") === "1") return;
      
      // Replace the text
      el.textContent = acf.text;
      el.setAttribute("data-semantix-replaced", "1");
      el.style.direction = "rtl";
      
      // Apply fontSize if configured
      if (acf.fontSize) {
        el.style.fontSize = acf.fontSize;
      }
      
      console.log("[Semantix] Replaced autocomplete no-results text");
    }
    
    // Observe for the element appearing
    const observer = new MutationObserver(() => {
      replaceText();
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Try immediately and after delays
    replaceText();
    setTimeout(replaceText, 100);
    setTimeout(replaceText, 300);
  }

  /* ------------------------ placeholder rotator ------------------------ */

  function resolveSearchInput() {
    const cfgSel = cfg.selectors?.searchInput;
    if (cfgSel) {
      const selectors = Array.isArray(cfgSel) ? cfgSel : [cfgSel];
      for (const s of selectors) {
        const el = q1(s);
        if (el?.tagName?.toLowerCase() === "input") return el;
      }
    }
    const candidates = ["input[type='search']", "input[name='s']", "input[name='q']", "input[name*='search']", "form[action*='search'] input[type='text']", "header input[type='text']"];
    for (const s of candidates) {
      const el = q1(s);
      if (el?.tagName?.toLowerCase() === "input") return el;
    }
    return null;
  }

  function attachPlaceholderRotatorOnce() {
    const pr = cfg.placeholderRotate;
    if (!pr?.enabled || window.__semantix_ph_attached) return;
    window.__semantix_ph_attached = true;

    const list = (pr.placeholders || []).filter(Boolean);
    if (!list.length) {
      console.log("[Semantix Placeholder] No placeholders configured");
      return;
    }
    
    console.log(`[Semantix Placeholder] Starting rotator with ${list.length} placeholders`);

    let inputEl = null;
    let idx = 0;
    let isRunning = false;

    function applyPlaceholderStyle(el) {
      // Add CSS for faded placeholder styling
      const styleId = "semantix-placeholder-style";
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        const phColor = pr.textColor || "rgba(0, 0, 0, 0.4)";
        style.textContent = `
          .semantix-ph-input::placeholder {
            color: ${phColor} !important;
            font-weight: 400 !important;
            opacity: 0.7 !important;
          }
          .semantix-ph-input::-webkit-input-placeholder {
            color: ${phColor} !important;
            font-weight: 400 !important;
            opacity: 0.7 !important;
          }
          .semantix-ph-input::-moz-placeholder {
            color: ${phColor} !important;
            font-weight: 400 !important;
            opacity: 0.7 !important;
          }
          .semantix-ph-fade {
            transition: opacity ${pr.fadeMs || 220}ms ease !important;
          }
        `;
        document.head.appendChild(style);
      }
      el.classList.add("semantix-ph-input", "semantix-ph-fade");
    }

    async function tick() {
      if (!inputEl) return;

      // Skip if user has typed something
      if (pr.onlyIfEmpty && inputEl.value?.trim()) return;
      // Pause on focus only when the user has actually typed (empty focused input still rotates)
      if (pr.pauseOnFocus && document.activeElement === inputEl && inputEl.value?.trim()) return;

      // Fade out
      inputEl.style.opacity = "0.3";
      await new Promise(r => setTimeout(r, pr.fadeMs || 220));

      // Change placeholder
      idx = (idx + 1) % list.length;
      inputEl.setAttribute("placeholder", list[idx]);
      
      // Fade in
      inputEl.style.opacity = "1";
      
      console.log(`[Semantix Placeholder] Changed to: "${list[idx]}" (${idx + 1}/${list.length})`);
    }

    function startRotation() {
      if (isRunning) return;
      isRunning = true;
      
      const intervalMs = pr.intervalMs || 2400;
      const startDelayMs = pr.startDelayMs || 600;
      
      console.log(`[Semantix Placeholder] Starting rotation (interval: ${intervalMs}ms, delay: ${startDelayMs}ms)`);
      
        setTimeout(() => {
        tick(); // First tick
        setInterval(tick, intervalMs);
      }, startDelayMs);
    }

    function ensureBound() {
      const el = resolveSearchInput();
      if (el) {
        const currentPlaceholder = el.getAttribute("placeholder");
        const expectedPlaceholder = list[idx];
        if (inputEl !== el || currentPlaceholder !== expectedPlaceholder) {
          const isNewEl = inputEl !== el;
          inputEl = el;
          if (isNewEl) {
            idx = 0;
            inputEl.setAttribute("placeholder", list[0]);
          } else {
            // Placeholder was reset by the page, re-apply the current one
            inputEl.setAttribute("placeholder", expectedPlaceholder);
          }
          applyPlaceholderStyle(inputEl);
          console.log(`[Semantix Placeholder] Bound to input, current placeholder: "${inputEl.getAttribute("placeholder")}"`);
          if (isNewEl) {
            startRotation();
          }
        }
      }
    }

    // Initial bind
    ensureBound();
    
    // Re-check periodically (for SPAs)
    setInterval(ensureBound, 2500);
  }

  /* ------------------------ grid/cards ------------------------ */

  const FALLBACK_GRIDS = ["ul.products", ".products", ".grid--uniform", ".product-grid", ".collection-grid", "[data-section-type='search'] .grid", "main .grid"];
  const FALLBACK_CARDS = ["li.product", ".grid__item", ".product-card", ".card-wrapper", "article.card-wrapper", ".product-item", ".card", "[data-product-id]", ".product", "[class*='product-card']"];
  const TITLE_SELECTORS = [".card__heading a", ".card__heading", ".card-information__text a", ".product-card__title", ".grid-product__title", ".product__title", ".product-title", ".card-title", ".woocommerce-loop-product__title", "h3 a", "h2 a", "h3", "h2"];
  // Fallback selectors for detecting zero-results pages when no config is provided
  const FALLBACK_NO_RESULTS = [
    ".no-results", "[class*='no-results']", "[class*='no_results']",
    ".search-no-results", ".empty-search", ".search__no-results",
    "[data-no-results]", "#no-search-results",
    ".woocommerce-info", ".woocommerce-no-products-found",
    ".empty-state", "[class*='empty-state']",
    ".search-empty", "[class*='search-empty']"
  ];

  function resolveGrid() {
    const cfgGrid = cfg.selectors?.resultsGrid;
    const sels = Array.isArray(cfgGrid) && cfgGrid.length ? cfgGrid : FALLBACK_GRIDS;
    const mainAreas = ["main", "[role='main']", "#main", ".main-content"];
    for (const m of mainAreas) {
      const main = q1(m);
      if (main) { const g = one(sels, main); if (g && !g.hasAttribute("data-semantix-zero-grid")) return g; }
    }
    for (const sel of sels) {
      for (const el of qa(sel)) {
        if (!el.closest("footer, header") && !el.hasAttribute("data-semantix-zero-grid")) return el;
      }
    }
    return null;
  }

  function resolveCards(grid) {
    if (!grid) return [];
    const cfgCard = cfg.selectors?.productCard;
    const sels = Array.isArray(cfgCard) && cfgCard.length ? cfgCard : FALLBACK_CARDS;
    for (const s of sels) {
      const els = qa(s, grid).filter(el => el.getAttribute("data-semantix-ai") !== "1");
      if (els.length) return els;
    }
    return [];
  }


  async function waitForGridOrNoResults(timeoutMs) {
    const start = Date.now();
    console.log(`[Semantix] Waiting for grid or noResults (timeout: ${timeoutMs}ms)`);
    // On the configured results page of a whole-area takeover the page is ours whatever the store rendered. When the
    // store found no products its theme may show only article/page results (no grid, no "no results" text): once the
    // server-rendered page is parsed, a short settle is enough instead of the full wait with the store's page showing.
    const ownPage = mainScopeEnabled() && onResultsPath();
    let parsedAt = 0;

    while (Date.now() - start < timeoutMs) {
      // FIRST PRIORITY: Check if we have a grid with cards
      const grid = resolveGrid();
      const cards = resolveCards(grid);

      if (grid && cards.length) {
        console.log(`[Semantix] ✅ Found grid with ${cards.length} cards - using RERANK mode`);
        return { grid, cards, noResults: null };
      }

      if (ownPage && !grid && document.readyState !== "loading") {
        if (!parsedAt) parsedAt = Date.now();
        else if (Date.now() - parsedAt >= 300) {
          console.log(`[Semantix] ✅ Results page parsed with no native grid - taking over the results area`);
          return { grid: null, cards: [], noResults: null };
        }
      }

      // SECOND PRIORITY: Only if NO grid/cards, check for noResults element
      const noResultsSelectors = cfg.selectors?.noResults;
      const noResultsCandidates = noResultsSelectors || FALLBACK_NO_RESULTS;
      if (noResultsCandidates) {
        const noResults = one(noResultsCandidates);
        if (noResults) {
          const isVisible = noResults.offsetParent !== null ||
                           (getComputedStyle(noResults).display !== 'none' &&
                            getComputedStyle(noResults).visibility !== 'hidden');
          if (isVisible) {
            console.log(`[Semantix] ✅ Found visible noResults element - using ZERO RESULTS mode`);
            return { grid: null, cards: [], noResults };
          }
        }
      }

      await new Promise(r => setTimeout(r, 120));
    }

    // Timeout - return whatever we have
    console.log(`[Semantix] ⏱️ Timeout reached, checking final state...`);
    let grid = resolveGrid();
    let cards = resolveCards(grid);

    if (grid && cards.length) {
      console.log(`[Semantix] ✅ Final: Found grid with ${cards.length} cards - using RERANK mode`);
      return { grid, cards, noResults: null };
    }

    let noResults = one(cfg.selectors?.noResults || FALLBACK_NO_RESULTS);

    // Ambiguous case: a grid element matched but has zero cards, and no
    // confirmed noResults element either. This is the state that's most
    // prone to a false "zero results" read — the grid container can exist
    // in the DOM before the native site finishes populating it (client-side
    // filtering, stock/personalization AJAX, slow devices/connections).
    // Give it one grace window before treating it as a confirmed empty grid.
    if (grid && !cards.length && !noResults) {
      console.log(`[Semantix] 🕗 Grid found but empty and no noResults — grace period before confirming zero`);
      const graceMs = 3000;
      const graceStart = Date.now();
      while (Date.now() - graceStart < graceMs) {
        await new Promise(r => setTimeout(r, 200));
        grid = resolveGrid();
        cards = resolveCards(grid);
        if (grid && cards.length) {
          console.log(`[Semantix] ✅ Grace period: grid populated with ${cards.length} cards - using RERANK mode`);
          return { grid, cards, noResults: null };
        }
        noResults = one(cfg.selectors?.noResults || FALLBACK_NO_RESULTS);
        if (noResults) break;
      }
    }

    if (noResults) {
      console.log(`[Semantix] ✅ Final: Using ZERO RESULTS mode`);
    } else {
      console.log(`[Semantix] ⚠️ Final: No grid and no noResults element found`);
    }
    return { grid, cards, noResults };
  }

  /* ------------------------ card template ------------------------ */

  const TEMPLATE_KEY = "semantix_tpl_v5";

  function saveCardTemplate(card) {
    if (!card) return;
    try {
      const clone = card.cloneNode(true);
      ["data-semantix-ai", "data-semantix-pid", "data-semantix-name", "data-semantix-url", "data-semantix-source"].forEach(a => clone.removeAttribute(a));
      lsSet(TEMPLATE_KEY, clone.outerHTML);
    } catch {}
  }

  function loadCardTemplate() {
    try {
      const html = lsGet(TEMPLATE_KEY, "");
      if (!html) return null;
      const temp = document.createElement("div");
      temp.innerHTML = html;
      return temp.firstElementChild;
    } catch { return null; }
  }

  /* ------------------------ fill card ------------------------ */

  function pickLink(card) {
    const sel = cfg.nativeCard?.map?.linkSelector;
    if (sel) { const a = q1(sel, card); if (a?.getAttribute("href")) return a; }
    return q1("a[href]", card);
  }

  function pickTitle(card) {
    const sel = cfg.nativeCard?.map?.titleSelector;
    if (sel) { const el = q1(sel, card); if (el) return el; }
    for (const s of TITLE_SELECTORS) { const el = q1(s, card); if (el) return el; }
    const link = pickLink(card);
    if (link) {
      let t = q1("h2, h3", link);
      if (!t) { t = document.createElement("h2"); t.className = "product-title"; link.appendChild(t); }
      return t;
    }
    return null;
  }

  function pickPrice(card) {
    const sel = cfg.nativeCard?.map?.priceSelector;
    if (sel) { const el = q1(sel, card); if (el) return el; }
    return q1(".price, .amount, [class*='price']", card);
  }

  function pickImage(card) {
    const sel = cfg.nativeCard?.map?.imageSelector;
    if (sel) { const el = q1(sel, card); if (el) return el; }
    return q1("img", card);
  }

  function formatPriceValue(price) {
    const raw = (price ?? "").toString();
    if (!raw) return raw;

    const externalFormatter = window.semantixFormatPrice || window.SemantixFormatPrice;
    if (typeof externalFormatter === "function") {
      try {
        const formatted = externalFormatter(raw);
        if (formatted !== undefined && formatted !== null) return formatted.toString();
      } catch (e) {
        console.warn("[Semantix] External price formatter failed:", e);
      }
    }

    // nativeCard.priceDecimals pins the store's own decimals (e.g. 2 → "100.80"); unset keeps the locale default.
    const decimals = Number.isInteger(cfg.nativeCard?.priceDecimals) ? cfg.nativeCard.priceDecimals : null;
    return raw.replace(/\d[\d,.]*/g, (part) => {
      if (part.includes(",")) return part;
      const num = Number(part.replace(/,/g, ""));
      if (!Number.isFinite(num)) return part;
      return decimals === null ? num.toLocaleString("he-IL") : num.toLocaleString("he-IL", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    });
  }

  function stripActions(card) {
    if (cfg.nativeCard?.disableAddToCart === false) return;
    ["a.add_to_cart_button", "button[name='add']", "form[action*='cart']", "[data-add-to-cart]"].forEach(s => qa(s, card).forEach(x => x.remove()));
  }

  /* ------------------------ special label ------------------------ */
  // Icons are chosen by the engine (never sourced from product data — no icon/image
  // URL is ever supplied for specialLabel), so each variant renders its own inline SVG.

  const SPECIAL_LABEL_ICONS = {
    printed: '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false"><path d="M4 3.6h7.2a2 2 0 0 1 2 2V17l-5.6-2.4L4 17V5.6a2 2 0 0 1 2-2Z" stroke-linejoin="round"/></svg>',
    digital: '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false"><rect x="3" y="4" width="14" height="9.5" rx="1.2"/><path d="M7.5 17h5M10 13.5V17" stroke-linecap="round"/></svg>',
    club: '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false"><path d="M10 3.2l1.7 3.5 3.9.5-2.8 2.7.7 3.9-3.5-1.8-3.5 1.8.7-3.9-2.8-2.7 3.9-.5z" stroke-linejoin="round"/></svg>'
  };

  function formatSpecialLabelPrice(value, currency) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "";
    if (currency) {
      try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(num);
      } catch (e) {
        return currency + num.toLocaleString("he-IL");
      }
    }
    return num.toLocaleString("he-IL");
  }

  function specialLabelBadge(type, value, currency, iconKey) {
    const price = formatSpecialLabelPrice(value, currency);
    if (!price) return "";
    return `<span class="semantix-special-label semantix-special-label--${type}">${SPECIAL_LABEL_ICONS[iconKey || type]}<span class="semantix-special-label__price">${escHtml(price)}</span></span>`;
  }

  /**
   * Build HTML for product.specialLabel.
   * Supports the structured format: { printed:{enabled,value,club:{enabled,value}}, digital:{...}, currency }
   * and the legacy boolean format: specialLabel: true
   */
  function buildSpecialLabelHtml(product) {
    const sl = product && product.specialLabel;
    if (!sl) return "";

    if (sl === true) {
      return '<span class="semantix-special-label semantix-special-label--legacy">Sale</span>';
    }

    if (typeof sl !== "object") return "";

    const currency = sl.currency || "";
    let html = "";
    if (sl.printed && sl.printed.enabled) html += specialLabelBadge("printed", sl.printed.value, currency);
    if (sl.printed && sl.printed.club && sl.printed.club.enabled) html += specialLabelBadge("printed-club", sl.printed.club.value, currency, "club");
    if (sl.digital && sl.digital.enabled) html += specialLabelBadge("digital", sl.digital.value, currency);
    if (sl.digital && sl.digital.club && sl.digital.club.enabled) html += specialLabelBadge("digital-club", sl.digital.club.value, currency, "club");
    return html ? `<span class="semantix-special-labels">${html}</span>` : "";
  }

  function fillCard(card, p) {
    const title = (p.name || p.title || "").toString();
    const price = formatPriceValue(p.priceFormatted || p.price || "");

    const a = pickLink(card);
    if (a && safeUrl(p.url)) { a.setAttribute("href", safeUrl(p.url)); a.style.cssText = "display:block;text-decoration:none;color:inherit"; }

    const t = pickTitle(card);
    if (t && title) { t.textContent = title; t.style.cssText = "display:block;visibility:visible;opacity:1"; }

    const pr = pickPrice(card);
    if (pr && price) { pr.textContent = price; pr.style.cssText = "display:block;visibility:visible;opacity:1"; }

    const img = pickImage(card);
    if (img && safeUrl(p.image)) {
      ["srcset", "sizes", "data-src", "data-srcset"].forEach(attr => img.removeAttribute(attr));
      img.setAttribute("src", safeUrl(p.image));
    }

    (cfg.nativeCard?.cleanupSelectors || []).forEach(sel => qa(sel, card).forEach(x => x.remove()));
    stripActions(card);

    const pid = p.id || p.product_id || p.productId || p.sku || p.handle || "";
    card.setAttribute("data-semantix-ai", "1");
    card.setAttribute("data-semantix-pid", String(pid));
    card.setAttribute("data-semantix-name", title);
    card.setAttribute("data-semantix-url", String(p.url || ""));
    card.style.cssText = "opacity:1;visibility:visible";
  }

  /* ------------------------ inject ------------------------ */

  /* ------------------------ SIMPLE CARD CLONING ------------------------ */

  /**
   * Get card template - from config HTML string or from DOM
   */
  function getCardTemplate(fallbackCard) {
    // First priority: cardTemplate from config (HTML string)
    const templateHtml = cfg.nativeCard?.cardTemplate;
    const useCustom = cfg.nativeCard?.useCustomTemplate !== false;
    
    if (templateHtml && typeof templateHtml === "string") {
      try {
        const temp = document.createElement("div");
        temp.innerHTML = templateHtml.trim();
        const card = temp.firstElementChild;
        if (card) {
          // Mark as custom template if configured
          if (useCustom) {
            card.setAttribute("data-semantix-custom", "1");
            console.log("[Semantix] Using CUSTOM cardTemplate from config (with placeholders)");
          } else {
            console.log("[Semantix] Using cardTemplate from config");
          }
          return card;
        }
      } catch (e) {
        console.warn("[Semantix] Failed to parse cardTemplate:", e);
      }
    }
    
    // Second priority: saved template in localStorage
    const saved = loadCardTemplate();
    if (saved) {
      console.log("[Semantix] Using saved template from localStorage");
      return saved;
    }
    
    // Third priority: fallback card from DOM
    if (fallbackCard) {
      // Save it for future use
      saveCardTemplate(fallbackCard);
      return fallbackCard;
    }
    
    return null;
  }

  /**
   * Fine-grained specialLabel fields for sites that want to build their own markup
   * per format (title text, wrapper classes, native price-box structure, etc.) instead
   * of using the generic {{specialLabel}} badge. Every value is a plain string so it's
   * safe to use inside both HTML content and element attributes.
   *
   * {{specialLabel.printed.value}}         -> formatted price (currency-aware) or ""
   * {{specialLabel.printed.enabled}}       -> "true" or ""  (drive conditional CSS with it)
   * {{specialLabel.printed.club.value}}    -> formatted club price (currency-aware) or ""
   * {{specialLabel.printed.club.enabled}}  -> "true" or ""
   * {{specialLabel.digital.value}}         -> formatted price (currency-aware) or ""
   * {{specialLabel.digital.enabled}}       -> "true" or ""
   * {{specialLabel.digital.club.value}}    -> formatted club price (currency-aware) or ""
   * {{specialLabel.digital.club.enabled}}  -> "true" or ""
   * {{specialLabel.currency}}              -> raw currency code, e.g. "ILS", or ""
   * {{specialLabel.legacy}}                -> "true" when specialLabel is the legacy `true`, else ""
   */
  function buildSpecialLabelFields(product) {
    const sl = product && product.specialLabel;
    const isObj = sl && typeof sl === "object";
    const currency = (isObj && sl.currency) || "";

    function group(g) {
      const enabled = !!(g && g.enabled);
      const clubEnabled = !!(g && g.club && g.club.enabled);
      return {
        enabled,
        value: enabled ? formatSpecialLabelPrice(g.value, currency) : "",
        clubEnabled,
        clubValue: clubEnabled ? formatSpecialLabelPrice(g.club.value, currency) : ""
      };
    }

    const printed = group(isObj && sl.printed);
    const digital = group(isObj && sl.digital);

    return {
      "specialLabel.printed.value": printed.value,
      "specialLabel.printed.enabled": printed.enabled ? "true" : "",
      "specialLabel.printed.club.value": printed.clubValue,
      "specialLabel.printed.club.enabled": printed.clubEnabled ? "true" : "",
      "specialLabel.digital.value": digital.value,
      "specialLabel.digital.enabled": digital.enabled ? "true" : "",
      "specialLabel.digital.club.value": digital.clubValue,
      "specialLabel.digital.club.enabled": digital.clubEnabled ? "true" : "",
      "specialLabel.currency": currency,
      "specialLabel.legacy": sl === true ? "true" : "",
      // Inverse of printed/digital: "true" when neither structured format is enabled
      // (legacy true, legacy false, missing, or both disabled) — drives a plain-price
      // fallback block the same way {{specialLabel.printed.enabled}} drives its own.
      "specialLabel.plain": (!printed.enabled && !digital.enabled) ? "true" : ""
    };
  }

  function replaceSpecialLabelFields(str, fields, encode = v => v) {
    let out = str;
    for (const key in fields) {
      out = out.replace(new RegExp("\\{\\{" + key.replace(/\./g, "\\.") + "\\}\\}", "g"), () => encode(fields[key]));
    }
    return out;
  }

  /**
   * Clone an existing card and update only the essential parts
   * This is the simplest and most reliable way to inject cards
   * CONFIG SELECTORS ALWAYS TAKE PRIORITY!
   */
  function cloneAndFillCard(templateCard, product) {
    if (!templateCard || !product) return null;
    
    // Check if this is a custom HTML template (has placeholders)
    const isCustomTemplate = templateCard.innerHTML && (
      templateCard.innerHTML.includes('{{') || 
      templateCard.getAttribute('data-semantix-custom') === '1'
    );
    
    // Deep clone the card
    const card = templateCard.cloneNode(true);

    // Remove id attribute — prevents duplicate element IDs when cloning native cards
    // (sites like refaeli use id="item_id_XXXXX" which must be unique). Skipped when
    // the id is itself a placeholder (custom template), since it resolves to a
    // per-product value below instead of staying a fixed duplicate string.
    const existingId = card.getAttribute("id");
    if (existingId && !existingId.includes("{{")) {
      card.removeAttribute("id");
    }
    // Remove sequential position classes (box0, box1, box2…) — the clone always comes
    // from the first card (box0) and keeping that class causes CSS conflicts when the
    // site styles cards differently based on their index class.
    if (card.className) {
      card.className = card.className.replace(/\bbox\d+\b/g, "").replace(/\s{2,}/g, " ").trim();
    }

    // Get product data
    const url = safeUrl(product.url || product.link || product.href || "");
    const name = product.name || product.title || "";
    const image = safeUrl(product.image || product.img || "");
    const price = formatPriceValue(product.priceFormatted || product.price || "");
    const id = product.id || product.product_id || product.productId || "";
    const sku = product.sku || "";
    const handle = product.handle || "";
    const explanation = product.explanation || product.reason || product.ai_explanation || "";
    const author = product.author || product.author_name || "";
    const offerId = product.offerId ?? product.offer_id ?? id;
    const stockStatus = product.stockStatus || product.stock_status || product.availability || "";
    // Boolean stock tokens for themes that drive stock state from an attribute (product_outofstock="true").
    const outOfStock = stockStatus ? String(/out|sold|unavailable|^false$|^0$/i.test(String(stockStatus))) : "false";
    const inStock = outOfStock === "true" ? "false" : "true";
    const onSale = String(!!(product.onSale !== undefined ? product.onSale : product.on_sale));
    const salePrice = formatPriceValue(product.salePriceFormatted || product.salePrice || "");
    // The price before a discount, and whether there is one: {{regularPrice}} and data-semantix-if="onSale".
    const regularRaw = product.regularPrice ?? product.regular_price ?? product.compareAtPrice ?? product.compare_at_price ?? "";
    const discounted = Number(regularRaw) > 0 && Number(product.price) > 0 && Number(regularRaw) > Number(product.price);
    const regularPrice = discounted ? formatPriceValue(regularRaw) : "";
    const flags = { onSale: discounted, inStock: inStock === "true", outOfStock: outOfStock === "true" };
    const specialLabel = buildSpecialLabelHtml(product);
    const specialLabelFields = buildSpecialLabelFields(product);

    // If custom template, replace placeholders and return
    if (isCustomTemplate) {
      console.log("[Semantix Card] Using CUSTOM template with placeholders");
      console.log("[Semantix Card] Product data:", { url, name, image, price, id, sku, handle });
      console.log("[Semantix Card] Raw product object:", product);

      let html = card.innerHTML;

      // Replace all placeholders in HTML content. Every product value is escaped; {{specialLabel}} is markup the
      // engine builds itself from numbers.
      const values = {
        url, link: url, name, title: name, image, img: image, price, id, product_id: id, sku, handle,
        explanation, reason: explanation, author, "author.enabled": author ? "true" : "", offerId: String(offerId),
        stockStatus, outOfStock, inStock, onSale, salePrice, regularPrice, seriesFirst: product.seriesFirst === true ? "true" : ""
      };
      html = html.replace(/\{\{(url|link|name|title|image|img|price|id|product_id|sku|handle|explanation|reason|author\.enabled|author|offerId|stockStatus|outOfStock|inStock|onSale|salePrice|regularPrice|seriesFirst)\}\}/g, (_, k) => escHtml(values[k]))
        .replace(/\{\{specialLabel\}\}/g, () => specialLabel);
      html = replaceSpecialLabelFields(html, specialLabelFields, escHtml);

      card.innerHTML = html;

      // Replace placeholders in ATTRIBUTES (href, src, data-*, etc.)
      // Includes `card` itself — querySelectorAll("*") only returns descendants, but
      // custom templates commonly put placeholders (id, data-*) on the root element too.
      const allElements = [card, ...card.querySelectorAll("*")];
      allElements.forEach(el => {
        Array.from(el.attributes).forEach(attr => {
          if (attr.value.includes("{{")) {
            let newValue = attr.value
              .replace(/\{\{url\}\}/g, url)
              .replace(/\{\{link\}\}/g, url)  // alias for url
              .replace(/\{\{name\}\}/g, name)
              .replace(/\{\{title\}\}/g, name)
              .replace(/\{\{image\}\}/g, image)
              .replace(/\{\{img\}\}/g, image)  // alias for image
              .replace(/\{\{price\}\}/g, price)
              .replace(/\{\{id\}\}/g, id)
              .replace(/\{\{product_id\}\}/g, id)
              .replace(/\{\{sku\}\}/g, sku)
              .replace(/\{\{handle\}\}/g, handle)
              .replace(/\{\{explanation\}\}/g, explanation)
              .replace(/\{\{reason\}\}/g, explanation)
              .replace(/\{\{author\}\}/g, author)
              .replace(/\{\{author\.enabled\}\}/g, author ? "true" : "")
              .replace(/\{\{offerId\}\}/g, String(offerId))
              .replace(/\{\{stockStatus\}\}/g, stockStatus)
              .replace(/\{\{outOfStock\}\}/g, outOfStock)
              .replace(/\{\{inStock\}\}/g, inStock)
              .replace(/\{\{onSale\}\}/g, onSale)
              .replace(/\{\{salePrice\}\}/g, salePrice)
              .replace(/\{\{regularPrice\}\}/g, regularPrice);
            newValue = replaceSpecialLabelFields(newValue, specialLabelFields);
            el.setAttribute(attr.name, newValue);
          }
        });
      });

      console.log("[Semantix Card] Replaced placeholders in HTML and attributes");

      // Parts of the template that exist only for some products (the price before a discount).
      card.querySelectorAll("[data-semantix-if]").forEach(el => {
        if (flags[el.getAttribute("data-semantix-if")]) el.removeAttribute("data-semantix-if");
        else el.remove();
      });

      // Mark as custom and AI
      card.setAttribute("data-semantix-custom", "1");
      card.setAttribute("data-semantix-ai", "1");
      card.setAttribute("data-semantix-injected", "1");
      card.setAttribute("data-semantix-pid", String(id));
      card.setAttribute("data-semantix-name", String(name));
      if (explanation) card.setAttribute("data-semantix-explanation", explanation);
      if (author) card.setAttribute("data-semantix-author", author);

      return card;
    }
    
    // ============ STEP 1: CLEANUP (config selectors FIRST, then defaults) ============
    
    // Config cleanupSelectors - ALWAYS APPLIED FIRST
    const cleanupSelectors = cfg.nativeCard?.cleanupSelectors || [];
    for (const sel of cleanupSelectors) {
      const elements = qa(sel, card);
      if (elements.length) {
        console.log(`[Semantix Card] Removing ${elements.length} elements: ${sel}`);
        elements.forEach(el => el.remove());
      }
    }
    
    // Default cleanup - common unwanted elements
    qa("[class*='badge'], [class*='sold-out'], [class*='sale'], .card__badge, .badge", card).forEach(el => {
      el.remove();
    });
    
    // ============ STEP 2: UPDATE LINKS ============
    
    // Config linkSelector first
    const cfgLinkSel = cfg.nativeCard?.map?.linkSelector;
    if (cfgLinkSel && url) {
      const links = qa(cfgLinkSel, card);
      if (links.length) {
        console.log(`[Semantix Card] Updating ${links.length} links via config selector: ${cfgLinkSel}`);
        links.forEach(link => link.setAttribute("href", url));
      }
    }
    // Also update ALL links
    qa("a[href]", card).forEach(link => {
      if (url) link.setAttribute("href", url);
    });
    
    // ============ STEP 3: UPDATE IMAGES ============
    
    // Config imageSelector first
    const cfgImgSel = cfg.nativeCard?.map?.imageSelector;
    if (cfgImgSel && image) {
      const imgs = qa(cfgImgSel, card);
      if (imgs.length) {
        console.log(`[Semantix Card] Updating ${imgs.length} images via config selector: ${cfgImgSel}`);
        imgs.forEach(img => {
          img.setAttribute("src", image);
          img.removeAttribute("srcset");
          img.removeAttribute("data-srcset");
          img.removeAttribute("data-src");
          if (name) img.setAttribute("alt", name);
        });
      }
    }
    // Also update ALL images
    qa("img", card).forEach(img => {
      if (image) {
        img.setAttribute("src", image);
        img.removeAttribute("srcset");
        img.removeAttribute("data-srcset");
        img.removeAttribute("data-src");
        if (name) img.setAttribute("alt", name);
      }
    });
    
    // ============ STEP 4: UPDATE TITLE (config selector ALWAYS wins) ============
    
    let titleUpdated = false;
    
    // Config titleSelector - HIGHEST PRIORITY
    const cfgTitleSel = cfg.nativeCard?.map?.titleSelector;
    if (cfgTitleSel && name) {
      const titleEls = qa(cfgTitleSel, card);
      if (titleEls.length) {
        console.log(`[Semantix Card] Updating title via config selector: ${cfgTitleSel}`);
        titleEls.forEach(el => { el.textContent = name; });
        titleUpdated = true;
      }
    }
    
    // Fallback to default selectors only if config didn't work
    if (!titleUpdated && name) {
      const titleSelectors = [
        ...TITLE_SELECTORS,
        "a > span",
        ".card__heading",
        "[class*='title']",
        "[class*='name']"
      ];
      
      for (const sel of titleSelectors) {
      const el = q1(sel, card);
        if (el) {
          el.textContent = name;
          titleUpdated = true;
          break;
        }
      }
    }
    
    // ============ STEP 5: UPDATE PRICE (config selector ALWAYS wins) ============
    
    let priceUpdated = false;
    
    // Config priceSelector - HIGHEST PRIORITY
    const cfgPriceSel = cfg.nativeCard?.map?.priceSelector;
    if (cfgPriceSel && price) {
      const priceEls = qa(cfgPriceSel, card);
      if (priceEls.length) {
        console.log(`[Semantix Card] Updating price via config selector: ${cfgPriceSel}`);
        priceEls.forEach(el => { el.textContent = price; });
        priceUpdated = true;
      }
    }
    
    // Fallback to default selectors only if config didn't work
    if (!priceUpdated && price) {
      const priceSelectors = [
        ".price-item",
        ".price",
        "[class*='price']",
        ".money",
        "s",
        "span.price"
      ];
      
      for (const sel of priceSelectors) {
        const els = qa(sel, card);
        if (els.length) {
          els[0].textContent = price;
          els.slice(1).forEach(el => el.style.display = "none");
          priceUpdated = true;
          break;
        }
      }
    }
    
    // ============ STEP 6: SAVE ALL DATA TO ATTRIBUTES (for post-fix) ============
    
    const pid = product.id || product.product_id || product.productId || product.sku || product.handle || "";
    card.setAttribute("data-semantix-ai", "1");
    card.setAttribute("data-semantix-injected", "1");
    card.setAttribute("data-semantix-reranked", "1");
    card.setAttribute("data-semantix-pid", String(pid));
    card.setAttribute("data-semantix-name", name);
    card.setAttribute("data-semantix-url", url);
    card.setAttribute("data-semantix-image", image);
    card.setAttribute("data-semantix-price", price);
    if (explanation) card.setAttribute("data-semantix-explanation", explanation);
    if (author) card.setAttribute("data-semantix-author", author);

    return card;
  }

  /**
   * Some Magento-based stores (e.g. steimatzky) serve product images through a resized
   * /cache/<hash>/ variant that can 404 or lag behind the source image. Strip the cache
   * segment, test-load the original, and swap it in only if it actually loads — never
   * touch an image that's already working.
   */
  function fixCachedProductImage(img) {
    if (img.dataset.semantixImgFixed === "1") return;
    if (!img.src || !img.src.includes("/cache/")) return;

    const original = img.src.replace(/\/cache\/[a-f0-9]+\//, "/");
    if (original === img.src) { img.dataset.semantixImgFixed = "1"; return; }

    const test = new Image();
    test.onload = () => {
      img.src = original;
      img.removeAttribute("srcset");
      img.dataset.semantixImgFixed = "1";
    };
    test.onerror = () => {
      img.dataset.semantixImgFixed = "1"; // don't retry
    };
    test.src = original;
  }

  /**
   * Post-injection fix - ensures all injected cards have correct data
   * This fixes the "all cards same title" bug by reading from data attributes
   * Can be disabled via nativeCard.disablePostFix: true
   */
  function fixInjectedCards() {
    // Check if disabled
    if (cfg.nativeCard?.disablePostFix) {
      return;
    }
    
    // Only fix cards that haven't been fixed yet
    const cards = qa('[data-semantix-injected="1"]:not([data-semantix-fixed="1"])');
    if (!cards.length) return;
    
    console.log(`[Semantix Fix] Fixing ${cards.length} injected cards...`);
    
    cards.forEach((card, index) => {
      const name = card.getAttribute("data-semantix-name") || "";
      const url = safeUrl(card.getAttribute("data-semantix-url"));
      const image = safeUrl(card.getAttribute("data-semantix-image"));
      const price = card.getAttribute("data-semantix-price") || "";
      
      // Mark as fixed FIRST to prevent re-processing
      card.setAttribute("data-semantix-fixed", "1");

      qa("img.product-image-photo", card).forEach(fixCachedProductImage);

      if (!name && !url) return; // Skip if no data
      
      // Only fix if config selectors are provided (don't guess)
      const cfgTitleSel = cfg.nativeCard?.map?.titleSelector;
      const cfgPriceSel = cfg.nativeCard?.map?.priceSelector;
      
      // Fix title - ONLY if config selector provided
      if (cfgTitleSel && name) {
        const els = qa(cfgTitleSel, card);
        if (els.length) {
          els.forEach(el => { el.textContent = name; });
        }
      }
      
      // Fix links
      if (url) {
        qa("a[href]", card).forEach(a => {
          a.setAttribute("href", url);
        });
      }
      
      // Fix images
      if (image) {
        qa("img", card).forEach(img => {
          img.setAttribute("src", image);
          img.removeAttribute("srcset");
          img.removeAttribute("data-srcset");
          img.removeAttribute("data-src");
          if (name) {
            img.setAttribute("alt", name);
          }
        });
      }
      
      // Fix price - ONLY if config selector provided
      if (cfgPriceSel && price) {
        const els = qa(cfgPriceSel, card);
        if (els.length) {
          els[0].textContent = price;
        }
      }
    });
    
    console.log(`[Semantix Fix] ✅ Fixed ${cards.length} cards`);
  }

  /**
   * Setup observer to auto-fix cards when injected
   */
  let _fixObserverSetup = false;
  let _fixDebounceTimer = null;
  
  function setupCardFixObserver() {
    // Prevent multiple observers
    if (_fixObserverSetup) return;
    _fixObserverSetup = true;
    
    // Debounced fix function to prevent rapid-fire calls
    const debouncedFix = () => {
      if (_fixDebounceTimer) clearTimeout(_fixDebounceTimer);
      _fixDebounceTimer = setTimeout(() => {
        fixInjectedCards();
      }, 100);
    };
    
    // Observe grid for changes
    const gridSelectors = [
      cfg.selectors?.resultsGrid,
      ".products",
      ".product-grid",
      "ul.products",
      "[data-semantix-zero-grid]"
    ].flat().filter(Boolean);
    
    for (const sel of gridSelectors) {
      const grid = q1(sel);
      if (grid) {
        const observer = new MutationObserver((mutations) => {
          // Only react to childList changes (new nodes), not attribute/text changes
          const hasNewNodes = mutations.some(m => m.type === "childList" && m.addedNodes.length > 0);
          if (hasNewNodes) {
            debouncedFix();
          }
        });
        observer.observe(grid, { childList: true, subtree: false }); // subtree: false to reduce noise
        console.log(`[Semantix Fix] Observing grid: ${sel}`);
        break;
      }
    }
    
    // Run once on setup
    fixInjectedCards();
  }

  function fadeIn(el, ms) {
    el.style.opacity = "0";
    el.style.transition = `opacity ${ms}ms ease`;
    requestAnimationFrame(() => el.style.opacity = "1");
  }

  /**
   * Normalize string for comparison - remove special chars, extra spaces, lowercase
   */
  function normalizeStr(str) {
    if (!str) return "";
    return str
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[^\w\s\u0590-\u05FF]/g, " ") // Keep only letters, numbers, spaces (+ Hebrew)
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Extract product handle/slug from URL
   */
  function extractHandle(url) {
    if (!url) return "";
    try {
      // Remove query params and hash
      const clean = url.split("?")[0].split("#")[0];
      // Try common patterns
      const patterns = [
        /\/products\/([^/]+)\/?$/,
        /\/product\/([^/]+)\/?$/,
        /\/item\/([^/]+)\/?$/,
        /\/p\/([^/]+)\/?$/,
      ];
      for (const p of patterns) {
        const m = clean.match(p);
        if (m) return m[1].toLowerCase();
      }
      // Fallback - last path segment
      const segments = clean.split("/").filter(Boolean);
      return (segments[segments.length - 1] || "").toLowerCase();
    } catch {
      return "";
    }
  }

  /**
   * Check if two strings are similar enough (fuzzy match)
   */
  function isSimilar(s1, s2, threshold = 0.75) {
    const n1 = normalizeStr(s1);
    const n2 = normalizeStr(s2);
    
    if (!n1 || !n2) return false;
    if (n1 === n2) return true;
    if (n1.includes(n2) || n2.includes(n1)) return true;
    
    // Dice coefficient for fuzzy matching
    const bigrams1 = new Set();
    const bigrams2 = new Set();
    
    for (let i = 0; i < n1.length - 1; i++) bigrams1.add(n1.slice(i, i + 2));
    for (let i = 0; i < n2.length - 1; i++) bigrams2.add(n2.slice(i, i + 2));
    
    if (bigrams1.size === 0 || bigrams2.size === 0) return false;
    
    let intersection = 0;
    for (const bg of bigrams1) {
      if (bigrams2.has(bg)) intersection++;
    }
    
    const score = (2 * intersection) / (bigrams1.size + bigrams2.size);
    return score >= threshold;
  }

  /**
   * Get all possible identifiers from a product object
   */
  function getProductIdentifiers(product) {
    // Extract ID from various possible fields
    const rawId = product.id || product.product_id || product.productId || product.ID || "";
    
    // Handle Shopify GID format: "gid://shopify/Product/123456"
    let cleanId = String(rawId);
    if (cleanId.includes("gid://")) {
      const match = cleanId.match(/\/(\d+)$/);
      if (match) cleanId = match[1];
    }
    
    const ids = {
      id: cleanId.toLowerCase(),
      productId: String(product.product_id || product.productId || cleanId || "").toLowerCase(),
      sku: String(product.sku || product.SKU || product.variant_sku || "").toLowerCase(),
      handle: String(product.handle || product.slug || "").toLowerCase(),
      url: String(product.url || product.link || product.href || "").toLowerCase(),
      urlHandle: extractHandle(product.url || product.link || product.href),
      name: normalizeStr(product.name || product.title || product.product_name || ""),
      rawName: String(product.name || product.title || product.product_name || "")
    };
    
    // Also extract handle from URL if not provided
    if (!ids.handle && ids.urlHandle) {
      ids.handle = ids.urlHandle;
    }
    
    return ids;
  }

  /**
   * Get all possible identifiers from a DOM card element
   */
  function getCardIdentifiers(card) {
    // Get ID from multiple possible data attributes
    let productId = (
      card.getAttribute("data-product-id") ||
      card.getAttribute("data-product_id") ||
      card.getAttribute("data-productid") ||
      card.getAttribute("data-id") ||
      card.getAttribute("data-item-id") ||
      ""
    );
    
    // Handle Shopify GID format
    if (productId.includes("gid://")) {
      const match = productId.match(/\/(\d+)$/);
      if (match) productId = match[1];
    }
    
    // Also check nested elements for data-product-id
    if (!productId) {
      const nested = card.querySelector("[data-product-id], [data-id]");
      if (nested) {
        productId = nested.getAttribute("data-product-id") || nested.getAttribute("data-id") || "";
        if (productId.includes("gid://")) {
          const match = productId.match(/\/(\d+)$/);
          if (match) productId = match[1];
        }
      }
    }
    
    const ids = {
      productId: productId.toLowerCase(),
      handle: (
        card.getAttribute("data-product-handle") ||
        card.getAttribute("data-handle") ||
        card.getAttribute("data-slug") ||
        ""
      ).toLowerCase(),
      sku: (
        card.getAttribute("data-sku") || 
        card.getAttribute("data-variant-sku") ||
        ""
      ).toLowerCase(),
      urls: [],
      urlHandles: [],
      names: []
    };
    
    // Collect all links
    const links = qa("a[href]", card);
    for (const link of links) {
      const href = link.getAttribute("href") || "";
      if (href && !href.startsWith("#") && !href.startsWith("javascript:")) {
        ids.urls.push(href.toLowerCase());
        const handle = extractHandle(href);
        if (handle) ids.urlHandles.push(handle);
      }
    }
    
    // Collect all possible title texts
    const titleSelectors = [
      ...TITLE_SELECTORS,
      "[itemprop='name']",
      ".name",
      ".title",
      "h1", "h2", "h3", "h4"
    ];
    
    for (const sel of titleSelectors) {
      const el = q1(sel, card);
      if (el) {
        const text = (el.textContent || "").trim();
        if (text && text.length > 1 && text.length < 200) {
          ids.names.push(normalizeStr(text));
        }
      }
    }
    
    // Also check image alt
    const img = q1("img", card);
    if (img) {
      const alt = (img.getAttribute("alt") || "").trim();
      if (alt && alt.length > 1 && alt.length < 200) {
        ids.names.push(normalizeStr(alt));
      }
    }
    
    return ids;
  }

  /**
   * Find existing product card in the grid - AGGRESSIVE MATCHING
   * Searches in grid first, then in entire document
   */
  function findExistingProductCard(grid, product, searchIndex) {
    if (!grid || !product) return null;
    
    const pIds = getProductIdentifiers(product);
    
    console.log(`[Semantix Rerank #${searchIndex}] 🔍 Searching for:`, {
      name: pIds.rawName,
      id: pIds.id,
      productId: pIds.productId,
      handle: pIds.handle,
      urlHandle: pIds.urlHandle,
      sku: pIds.sku
    });
    
    // Get all cards - ALWAYS search entire document to catch duplicates anywhere
    const cfgCard = cfg.selectors?.productCard || [];
    const cardSelectors = [...new Set([...cfgCard, ...FALLBACK_CARDS])].join(",");
    
    // Search in entire document to find ALL products (including outside grid)
    let allCards = qa(cardSelectors, document);
    
    console.log(`[Semantix Rerank #${searchIndex}] 🌐 Searching entire page - found ${allCards.length} potential cards`);
    
    // Filter out non-card elements
    allCards = allCards.filter(card => {
      const tag = card.tagName.toLowerCase();
      // Skip if it's a link or button
      if (tag === "a" || tag === "button") return false;
      
      // Skip small utility elements (counters, badges, etc)
      const cls = card.className || "";
      if (cls.match(/\b(count|counter|quantity|badge|cart|btn|button|icon)\b/i)) return false;
      
      // Skip if it has very little content (likely a utility div)
      if (card.children.length === 0 && card.textContent.trim().length < 10) return false;
      
      // Skip if it's inside another card (nested)
      const parent = card.parentElement?.closest(cardSelectors);
      if (parent && (grid.contains(parent) || document.body.contains(parent))) {
        // Only skip if parent is a different card
        if (parent !== card) return false;
      }
      
      // Skip if it doesn't contain an image or link (probably not a product card)
      const hasImage = card.querySelector("img");
      const hasLink = card.querySelector("a[href]");
      if (!hasImage && !hasLink) return false;
      
      return true;
    });
    
    console.log(`[Semantix Rerank #${searchIndex}] Found ${allCards.length} cards to check`);
    
    for (let i = 0; i < allCards.length; i++) {
      const card = allCards[i];
      
      // Skip already reranked cards
      if (card.getAttribute("data-semantix-reranked") === "1") continue;
      // Skip already injected cards
      if (card.getAttribute("data-semantix-injected") === "1") continue;
      
      const cIds = getCardIdentifiers(card);
      
      // === MATCH BY ID (multiple formats) ===
      const productIds = [pIds.id, pIds.productId, pIds.sku].filter(Boolean).map(String);
      const cardIds = [cIds.productId, cIds.sku].filter(Boolean).map(String);
      
      for (const pId of productIds) {
        for (const cId of cardIds) {
          if (pId === cId) {
            const inGrid = grid.contains(card);
            const location = inGrid ? "in grid" : "⚠️ OUTSIDE grid";
            console.log(`[Semantix Rerank #${searchIndex}] ✅ MATCH by ID: "${pId}" (${location})`);
            return card;
          }
        }
      }
      
      // === MATCH BY HANDLE ===
      const productHandles = [pIds.handle, pIds.urlHandle].filter(Boolean);
      const cardHandles = [cIds.handle, ...cIds.urlHandles].filter(Boolean);
      
      for (const pH of productHandles) {
        for (const cH of cardHandles) {
          // Exact match
          if (pH === cH) {
            const inGrid = grid.contains(card);
            const location = inGrid ? "in grid" : "⚠️ OUTSIDE grid";
            console.log(`[Semantix Rerank #${searchIndex}] ✅ MATCH by handle: "${pH}" (${location})`);
            return card;
          }
          // Partial match (one contains the other)
          if (pH.length > 3 && cH.length > 3) {
            if (pH.includes(cH) || cH.includes(pH)) {
              console.log(`[Semantix Rerank #${searchIndex}] ✅ MATCH by partial handle: "${pH}" ~ "${cH}"`);
              return card;
            }
          }
        }
      }
      
      // === MATCH BY NAME (FUZZY) ===
      if (pIds.name && pIds.name.length > 2) {
        for (const cName of cIds.names) {
          if (cName && cName.length > 2) {
            // Exact normalized match
            if (pIds.name === cName) {
              console.log(`[Semantix Rerank #${searchIndex}] ✅ MATCH by exact name: "${pIds.rawName}"`);
              return card;
            }
            // Fuzzy match (80% similarity)
            if (isSimilar(pIds.name, cName, 0.8)) {
              console.log(`[Semantix Rerank #${searchIndex}] ✅ MATCH by similar name: "${pIds.rawName}" ≈ "${cName}"`);
              return card;
            }
            // Contains match (for partial names)
            if (pIds.name.length > 5 && cName.length > 5) {
              if (pIds.name.includes(cName) || cName.includes(pIds.name)) {
                const inGrid = grid.contains(card);
                const location = inGrid ? "in grid" : "⚠️ OUTSIDE grid";
                console.log(`[Semantix Rerank #${searchIndex}] ✅ MATCH by name contains: "${pIds.rawName}" ~ "${cName}" (${location})`);
                return card;
              }
            }
          }
        }
      }
    }
    
    console.log(`[Semantix Rerank #${searchIndex}] ❌ NOT FOUND in DOM: "${pIds.rawName}"`);
    return null;
  }

  /**
   * RERANK products in grid - move existing cards up, inject only if not found
   * Order: All reranked cards first, then all injected cards (never in the middle!)
   */
  /**
   * Hoist non-card siblings (e.g. category banners, backgroundgroups) that appear
   * BETWEEN product cards up to the position BEFORE the first native card.
   * This prevents them from getting "stuck" in the middle after rerank moves cards around.
   */
  function hoistNonCardSiblings(grid, nativeCards) {
    if (!nativeCards.length) return;
    const cardSet = new Set(nativeCards);
    const firstCard = nativeCards[0];
    let hoisted = 0;

    // Returns true if the element looks like a product card, even if resolveCards missed it.
    // This prevents hoisting product cards that didn't match the active selector.
    function looksLikeProductCard(el) {
      if (cardSet.has(el)) return true;
      if (el.hasAttribute("data-product-id") || el.hasAttribute("data-product-handle")) return true;
      if (el.querySelector("[data-product-id], [data-product-handle]")) return true;
      if (el.querySelector("a[href*='/product'], a[href*='/catalog'], a[href*='/item']")) return true;
      if (el.querySelector("img") && el.querySelector("a[href]")) return true; // has image + link = likely a card
      return false;
    }

    const children = Array.from(grid.children);
    let passedFirstCard = false;
    for (const child of children) {
      if (child === firstCard) { passedFirstCard = true; continue; }
      if (!passedFirstCard) continue;
      if (
        !looksLikeProductCard(child) &&
        !child.hasAttribute("data-semantix-ai") &&
        !child.hasAttribute("data-semantix-skeleton") &&
        !child.hasAttribute("data-semantix-injected")
      ) {
        console.log("[Semantix Rerank] Hoisting non-card sibling:", child.tagName, child.className);
        grid.insertBefore(child, firstCard);
        hoisted++;
      }
    }
    if (hoisted) console.log(`[Semantix Rerank] ✅ Hoisted ${hoisted} non-card siblings before first card`);
  }

  function rerankGrid(grid, baseCard, products) {
    if (!grid || !products.length) return;
    
    // Check both cfg.behavior AND cfg.features for backwards compatibility
    // READ FRESH from siteConfig!
    const freshCfg = window.SemantixSettings?.siteConfig || {};
    
    // Hard-disabled: rerank/inject must never activate, regardless of any
    // config, session mode, or A/B test override. Only zero-results recovery runs.
    const enableRerank = false;
    const enableInject = false;
    
    console.log(`[Semantix Rerank] ====== Starting rerank for ${products.length} products ======`);
    console.log(`[Semantix Rerank] Config check:`, {
      'cfg.behavior.enableRerank': cfg.behavior?.enableRerank,
      'cfg.behavior.enableInject': cfg.behavior?.enableInject,
      'cfg.features.rerankBoost': cfg.features?.rerankBoost,
      'cfg.features.injectIntoGrid': cfg.features?.injectIntoGrid,
      'freshCfg.features.rerankBoost': freshCfg.features?.rerankBoost,
      'freshCfg.features.injectIntoGrid': freshCfg.features?.injectIntoGrid,
      'FINAL enableRerank': enableRerank,
      'FINAL enableInject': enableInject
    });
    
    // Flag that Semantix is performing DOM mutations (suppresses the re-render guard observer)
    window.__semantix_injecting = true;

    // Remove any previously injected AI-only cards
    const removed = qa('[data-semantix-ai="1"][data-semantix-injected="1"]', grid);
    console.log(`[Semantix Rerank] Removing ${removed.length} previously injected cards`);
    removed.forEach(n => n.remove());

    // Reset reranked flags
    qa('[data-semantix-reranked="1"]', grid).forEach(n => {
      n.removeAttribute("data-semantix-reranked");
      n.removeAttribute("data-semantix-ai");
    });
    
    // Get the template card (from config, localStorage, or DOM)
    const templateCard = getCardTemplate(baseCard);
    if (!templateCard) {
      console.warn("[Semantix Rerank] No card template available!");
      window.__semantix_injecting = false;
      return;
    }
    
    // Track which products we've already processed (by ID and name)
    const processedIds = new Set();
    const processedNames = new Set();

    // First pass: scan ALL products — rerank uses full array, inject is capped later
    const toRerank = [];  // {card, product} pairs
    const toInject = [];  // products not found in DOM

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const pIds = getProductIdentifiers(product);
      
      // Check if we already processed this product (duplicate in API response)
      const idKey = pIds.id || pIds.productId || pIds.sku || "";
      const nameKey = pIds.name;
      
      if (idKey && processedIds.has(idKey)) {
        console.log(`[Semantix Rerank #${i+1}] ⏭️ SKIP duplicate ID: "${idKey}"`);
        continue;
      }
      if (nameKey && processedNames.has(nameKey)) {
        console.log(`[Semantix Rerank #${i+1}] ⏭️ SKIP duplicate name: "${pIds.rawName}"`);
        continue;
      }
      
      // Mark as processed
      if (idKey) processedIds.add(idKey);
      if (nameKey) processedNames.add(nameKey);
      
      const card = findExistingProductCard(grid, product, i + 1);
      
      if (card) {
        toRerank.push({ card, product });
      } else {
        toInject.push(product);
      }
    }
    
    console.log(`[Semantix Rerank] First pass: ${toRerank.length} found, ${toInject.length} to inject`);
    
    // Check config to see what we should do
    if (!enableRerank && !enableInject) {
      console.log(`[Semantix Rerank] ⚠️ Both rerank and inject are disabled - doing nothing`);
      window.__semantix_injecting = false;
      return [];
    }
    
    // Hoist any non-card siblings (e.g. category banners) that sit between product cards
    // BEFORE computing the insertion anchor — so they end up above the card area, not in the middle.
    hoistNonCardSiblings(grid, resolveCards(grid));

    // Find the insertion anchor for the card area BEFORE any cards are moved.
    //
    // Problem: many grid containers (like refaeli's div.wrap_boxs) contain a mix of
    // non-product siblings (sort bars, <style> tags, category headers) BEFORE the cards.
    // Using grid.firstChild as the insert point lands Semantix cards ABOVE those headers,
    // breaking the page layout.
    //
    // Fix: use resolveCards() — which already knows how to find the right cards for this
    // site — to locate the first native card, then anchor to the element immediately before
    // it (a stable non-card sibling that Semantix never moves).
    const _firstNativeCard = resolveCards(grid)[0] || null;
    const _cardAreaHeaderEl = _firstNativeCard?.previousElementSibling ?? null;
    // getCardInsertRef() always returns a valid child of grid (or null = append).
    // _cardAreaHeaderEl is a non-card element, so it stays in grid throughout reranking.
    const getCardInsertRef = () => {
      if (_cardAreaHeaderEl && _cardAreaHeaderEl.parentNode === grid) {
        return _cardAreaHeaderEl.nextSibling; // right after the header, right before cards
      }
      // No header before cards — fall back to first card's position or firstChild
      return (_firstNativeCard && _firstNativeCard.parentNode === grid)
        ? _firstNativeCard
        : grid.firstChild;
    };
    console.log(`[Semantix Rerank] Card insertion anchor: ${_cardAreaHeaderEl ? _cardAreaHeaderEl.tagName + '#' + (_cardAreaHeaderEl.id || _cardAreaHeaderEl.className.split(' ')[0]) : 'none (first card / firstChild)'}`);

    // Two fragments: reranked cards always prepend, injected cards position depends on native count
    const rerankFragment = document.createDocumentFragment();
    const injectFragment = document.createDocumentFragment();

    // Add reranked cards to rerankFragment IN ORDER (if rerank is enabled)
    if (enableRerank) {
      for (let i = 0; i < toRerank.length; i++) {
        const { card, product } = toRerank[i];

        card.setAttribute("data-semantix-reranked", "1");
        card.setAttribute("data-semantix-ai", "1");
        card.setAttribute("data-semantix-pid", String(product.id || product.product_id || ""));
        card.setAttribute("data-semantix-name", String(product.name || product.title || ""));

        rerankFragment.appendChild(card);
      }
      console.log(`[Semantix Rerank] ✅ Reranked ${toRerank.length} existing cards`);
    } else {
      console.log(`[Semantix Rerank] ⏭️ SKIP rerank (disabled in config)`);
    }

    // Add injected cards to injectFragment (if inject is enabled)
    // Inject is capped by injectCount; rerank above used the full array
    if (enableInject) {
      const injectLimit = cfg.behavior.injectCount || 6;
      let injectedCount = 0;
      for (const product of toInject) {
        if (injectedCount >= injectLimit) break;
        // Double-check this product isn't already in the grid under a different match
        const existingInGrid = findExistingProductCard(grid, product, 0);
        if (existingInGrid) {
          console.log(`[Semantix Rerank] ⏭️ SKIP inject - found in grid: ${product.name || product.id}`);
          continue;
        }

        const clone = cloneAndFillCard(templateCard, product);
        if (clone) {
          injectFragment.appendChild(clone);
          injectedCount++;
          console.log(`[Semantix Rerank] Injected: ${product.name || product.id}`);
        }
      }
      console.log(`[Semantix Rerank] ✅ Injected ${injectedCount}/${toInject.length} new cards (limit: ${injectLimit})`);
    } else {
      console.log(`[Semantix Rerank] ⏭️ SKIP inject (disabled in config)`);
    }

    // Reranked cards go first — anchored to the start of the card area, not grid.firstChild
    grid.insertBefore(rerankFragment, getCardInsertRef());

    // Injected cards: append after natives if few native products remain, otherwise prepend
    const nativeCount = grid.children.length;
    if (nativeCount < 5) {
      console.log(`[Semantix Rerank] Native count (${nativeCount}) < 5 — appending injected cards after natives`);
      grid.appendChild(injectFragment);
    } else {
      // Insert at card area start (after headers/sort bars, before native cards)
      grid.insertBefore(injectFragment, getCardInsertRef());
    }
    
    // Apply fade-in animation to all AI cards
    qa('[data-semantix-reranked="1"]', grid).forEach(card => {
      card.style.opacity = "0";
      requestAnimationFrame(() => {
        card.style.transition = `opacity ${cfg.behavior.fadeMs || 120}ms ease`;
        card.style.opacity = "1";
      });
    });
    
    const rerankedActual = enableRerank ? toRerank.length : 0;
    const injectedActual = enableInject ? toInject.length : 0;
    
    console.log(`[Semantix Rerank] ====== Summary ======`);
    console.log(`[Semantix Rerank] Config: rerank=${enableRerank}, inject=${enableInject}`);
    console.log(`[Semantix Rerank] ${enableRerank ? '✅' : '⏭️'} Reranked: ${rerankedActual}/${toRerank.length}`);
    console.log(`[Semantix Rerank] ${enableInject ? '➕' : '⏭️'} Injected: ${injectedActual}/${toInject.length}`);
    if (enableRerank && enableInject) {
      console.log(`[Semantix Rerank] 📍 Final order: [${rerankedActual} reranked] → [${injectedActual} injected] → [rest]`);
    } else if (enableRerank) {
      console.log(`[Semantix Rerank] 📍 Final order: [${rerankedActual} reranked] → [rest] (injection disabled)`);
    } else if (enableInject) {
      console.log(`[Semantix Rerank] 📍 Final order: [${injectedActual} injected] → [rest] (rerank disabled)`);
    }
    
    const result = qa('[data-semantix-reranked="1"]', grid);

    // Clear injection flag and attach the re-render guard for dynamic-JS sites
    window.__semantix_injecting = false;
    attachRerenderGuard(grid, baseCard, products);

    return result;
  }

  // Keep old function name for compatibility but use rerank logic
  function injectIntoGrid(grid, baseCard, products) {
    return rerankGrid(grid, baseCard, products);
  }

  /**
   * Re-render guard — watches the grid after injection and re-injects if the site's
   * JS framework flushes our cards (common on dynamic-JS / SPA / Nuxt / Vue sites).
   *
   * Detection logic:
   *   • We count Semantix cards present right after injection (baseline).
   *   • If a childList mutation fires (from outside Semantix) and our Semantix cards
   *     are gone while fresh native cards exist, we treat it as a framework re-render.
   *   • We debounce and re-inject, up to rerenderGuardMax times.
   */
  function attachRerenderGuard(grid, baseCard, products, render = rerankGrid) {
    if (cfg.behavior?.rerenderGuard === false) return;
    if (!grid) return;

    // Disconnect any previous guard on this grid element
    if (grid._semantixGuardObserver) {
      try { grid._semantixGuardObserver.disconnect(); } catch {}
    }

    const debounceMs = cfg.behavior?.rerenderGuardMs || 350;
    const maxAttempts = cfg.behavior?.rerenderGuardMax || 3;
    let attempts = 0;
    let guardTimer = null;

    const observer = new MutationObserver(() => {
      // Ignore mutations caused by Semantix itself
      if (window.__semantix_injecting) return;

      const ourCards = grid.querySelectorAll('[data-semantix-injected="1"], [data-semantix-reranked="1"]');
      if (ourCards.length > 0) return; // Our cards still present — nothing to do

      // Our cards disappeared — check if there are fresh native cards (framework re-rendered)
      const nativeCards = resolveCards(grid);
      if (!nativeCards.length) return; // Grid is empty too, skip

      if (attempts >= maxAttempts) {
        console.log(`[Semantix Guard] Max re-inject attempts (${maxAttempts}) reached — stopping`);
        observer.disconnect();
        return;
      }

      clearTimeout(guardTimer);
      guardTimer = setTimeout(() => {
        attempts++;
        console.log(`[Semantix Guard] Framework re-render detected (attempt ${attempts}/${maxAttempts}) — re-injecting`);
        observer.disconnect();
        grid._semantixGuardObserver = null;

        // Re-run injection on the current grid state
        window.__semantix_injecting = true;
        try {
          render(grid, nativeCards[0] || baseCard, products);
        } finally {
          window.__semantix_injecting = false;
        }

        // Re-attach guard for subsequent re-renders
        attachRerenderGuard(grid, baseCard, products, render);
      }, debounceMs);
    });

    observer.observe(grid, { childList: true });
    grid._semantixGuardObserver = observer;
    console.log("[Semantix Guard] Watching grid for framework re-renders");
  }

  function createGridWithProducts(noResultsEl, products, templateCard) {
    // Check if zero grid already exists - prevent duplicates
    const existingZeroGrid = q1("[data-semantix-zero-grid]");
    if (existingZeroGrid) {
      console.log(`[Semantix Zero] Grid already exists, skipping creation`);
      return existingZeroGrid;
    }
    
    if (noResultsEl) noResultsEl.style.display = "none";

    ensureStyles();

    // Get template card — prioritizes nativeCard.cardTemplate from config
    const baseCard = getCardTemplate(templateCard) || createBasicCard();
    console.log(`[Semantix Zero] Card template: ${baseCard.getAttribute('data-semantix-custom') === '1' ? 'HTML template from config' : baseCard.className.includes('basic') ? 'basic fallback' : 'DOM/localStorage template'}`);

    // Get zero results config - read directly from cfg.zero which is already merged
    const zeroCfg = cfg.zero;
    const gridTag = zeroCfg.gridTag || "ul";
    const gridClass = zeroCfg.gridClass || "products semantix-zero-grid";
    const columns = {
      desktop: zeroCfg.columns?.desktop ?? 4,
      tablet: zeroCfg.columns?.tablet ?? 3,
      mobile: zeroCfg.columns?.mobile ?? 2
    };
    const style = {
      gapPx: zeroCfg.style?.gapPx ?? 16,
      marginTopPx: zeroCfg.style?.marginTopPx ?? 16,
      cardWidth: zeroCfg.style?.cardWidth || "100%"
    };
    const hostSelectors = zeroCfg.host || ["main", "#main", ".main-content", "body"];
    const insertCfg = zeroCfg.insert || { mode: "after", target: [] };

    // Try to copy the real grid's tag + classes so the site's CSS applies to cards
    let realGridTag = gridTag;
    let realGridClass = gridClass;
    const realGrid = resolveGrid();
    if (realGrid) {
      realGridTag = realGrid.tagName.toLowerCase();
      realGridClass = realGrid.className + " semantix-zero-grid";
      console.log(`[Semantix Zero] Copying real grid: <${realGridTag} class="${realGrid.className}">`);
    } else {
      // No real grid on page — try to detect from config selector
      const gridSel = cfg.selectors?.resultsGrid;
      if (gridSel) {
        // Extract tag and class from selector like "ul.products" or ".product-grid"
        const m = (Array.isArray(gridSel) ? gridSel[0] : gridSel)?.match?.(/^(\w+)?\.?([\w-]+)?/);
        if (m) {
          if (m[1]) realGridTag = m[1];
          if (m[2]) realGridClass = m[2] + " semantix-zero-grid";
        }
      }
      console.log(`[Semantix Zero] No real grid found, using config: <${realGridTag} class="${realGridClass}">`);
    }

    // Create grid element with same tag + classes as the real grid
    const grid = document.createElement(realGridTag);
    grid.className = realGridClass;
    grid.setAttribute("data-semantix-zero-grid", "1");

    // Add responsive styles via media queries - use config values
    const styleId = "semantix-zero-grid-style";
    let existingStyle = document.getElementById(styleId);
    if (existingStyle) existingStyle.remove(); // Remove old style to update with new config

    const styleEl = document.createElement("style");
    styleEl.id = styleId;
    styleEl.textContent = `
      [data-semantix-zero-grid] {
        display: grid !important;
        grid-template-columns: repeat(${columns.mobile}, 1fr) !important;
        gap: ${style.gapPx}px !important;
        margin-top: ${style.marginTopPx}px;
      padding: 0;
        list-style: none;
        width: 100%;
      }
      @media (min-width: 750px) {
        [data-semantix-zero-grid] {
          grid-template-columns: repeat(${columns.tablet}, 1fr) !important;
        }
      }
      @media (min-width: 990px) {
        [data-semantix-zero-grid] {
          grid-template-columns: repeat(${columns.desktop}, 1fr) !important;
        }
      }
      [data-semantix-zero-grid] > * {
        list-style: none !important;
        width: ${style.cardWidth} !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
      }
    `;
    document.head.appendChild(styleEl);

    // Find where to insert the grid
    let insertPoint = null;
    let insertMode = insertCfg.mode || "after";

    // Priority 1: branded loader already sits in the right spot — insert after it
    const brandedEl = document.querySelector('[data-semantix-loader="1"]');
    if (brandedEl && brandedEl.parentElement) {
      insertPoint = brandedEl;
      insertMode = "after";
      console.log(`[Semantix Zero] Using branded loader as anchor`);
    }

    // Priority 2: config insert target selectors
    if (!insertPoint) {
      const insertTargets = Array.isArray(insertCfg.target) ? insertCfg.target : [insertCfg.target].filter(Boolean);
      for (const sel of insertTargets) {
        const el = q1(sel);
        if (el && el.parentElement) {
          insertPoint = el;
          console.log(`[Semantix Zero] Found insert target: ${sel}`);
          break;
        }
      }
    }

    // Priority 3: noResultsEl
    if (!insertPoint && noResultsEl && noResultsEl.parentElement) {
      insertPoint = noResultsEl;
      insertMode = "after";
      console.log(`[Semantix Zero] Using noResults element as anchor`);
    }

    // Insert grid
    if (insertPoint && insertPoint.parentElement) {
      if (insertMode === "after") {
        insertPoint.parentElement.insertBefore(grid, insertPoint.nextSibling);
      } else if (insertMode === "before") {
        insertPoint.parentElement.insertBefore(grid, insertPoint);
      } else if (insertMode === "replace") {
        insertPoint.parentElement.replaceChild(grid, insertPoint);
      }
      console.log(`[Semantix Zero] Inserted grid ${insertMode} anchor (parent: ${insertPoint.parentElement.tagName}.${insertPoint.parentElement.className})`);
    } else {
      // Fallback: find host and append
      let host = null;
      for (const sel of hostSelectors) {
        host = q1(sel);
        if (host) break;
      }
      (host || document.body).appendChild(grid);
      console.log(`[Semantix Zero] ⚠️ No anchor found, appended to ${host ? host.tagName + '.' + host.className : 'body'}`);
    }

    // Add products to grid — zero results uses ALL products (up to 25), NOT injectCount
    const zeroLimit = cfg.zero?.maxProducts || 25;
    const count = Math.min(zeroLimit, products.length);
    for (let i = 0; i < count; i++) {
      const clone = cloneAndFillCard(baseCard, products[i]);
      if (clone) {
      clone.style.listStyle = "none";
      grid.appendChild(clone);
        fadeIn(clone, cfg.behavior.fadeMs || 120);
      }
    }

    // Smooth entrance for the whole grid (matches the loader's fade-out)
    fadeIn(grid, 350);

    console.log(`[Semantix Zero] Created grid with ${count}/${products.length} products (limit: ${zeroLimit}, columns: ${columns.desktop}/${columns.tablet}/${columns.mobile})`);
    return grid;
  }

  function createBasicCard() {
    const card = document.createElement("div");
    card.className = "product semantix-basic-card";
    card.style.cssText = "border:1px solid #e0e0e0;padding:15px;border-radius:8px;background:#fff;transition:box-shadow 0.2s";
    card.innerHTML = `<a href="" style="text-decoration:none;color:inherit;display:block"><img src="" alt="" style="width:100%;height:auto;margin-bottom:12px;border-radius:4px"><h3 class="product-title" style="margin:8px 0;font-size:16px;line-height:1.3;color:#333"></h3><div class="price" style="font-weight:bold;font-size:18px;color:#000;margin-top:8px"></div></a>`;
    return card;
  }

  /* ============================================================
     CLICK TRACKING v5
     ============================================================ */

  const CLICK_ENABLED = !!S.endpoints?.productClick && cfg.clickTracking.enabled !== false;
  const ATC_ENABLED = !!(S.endpoints?.searchToCart || S.endpoints?.search_to_cart || S.endpoints?.searchToCartEndpoint || S.endpoints?.searchToCartUrl) || true;

  let lastSentTime = 0;
  let lastSentPid = "";
  let lastAtcTime = 0;
  let lastAtcPid = "";
  const DEDUPE_MS = cfg.clickTracking.dedupeWindowMs || 2500;

  function queueLoad() { try { return JSON.parse(ssGet(cfg.clickTracking.queueKey, "[]")); } catch { return []; } }
  function queueSave(arr) { ssSet(cfg.clickTracking.queueKey, JSON.stringify(arr || [])); }
  function queuePush(p) { const q = queueLoad(); q.push(p); if (q.length > 25) q.shift(); queueSave(q); }

  function clickUrl() { return S.apiBase + S.endpoints.productClick; }
  function atcUrl() {
    const ep = S.endpoints?.searchToCart || S.endpoints?.search_to_cart || S.endpoints?.searchToCartEndpoint || S.endpoints?.searchToCartUrl || "/search-to-cart";
    return S.apiBase ? S.apiBase + ep : ep;
  }

  function sendClick(event, inResults, typed) {
    if (!CLICK_ENABLED || !analyticsAllowed()) return;

    const url = clickUrl();
    const payload = linkClick(event, inResults, typed);
    const body = JSON.stringify(payload);

    if (navigator.sendBeacon && !S.apiKey) {
      try {
        const sent = navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
        if (sent) {
          log("✅ Click sent (beacon)");
          return;
        }
      } catch {}
    }

      fetch(url, {
        method: "POST",
        headers: headers(),
        body,
        keepalive: true
    }).then(r => {
      if (r.ok) log("✅ Click sent (fetch)");
      else queuePush(payload);
    }).catch(() => {
      queuePush(payload);
    });
  }

  // Keep a reference to the original fetch BEFORE any wrapping
  const _origFetchForSend = window.fetch.bind(window);

  function sendSearchToCart(documentPayload) {
    if (!analyticsAllowed()) return;
    if (window.SemantixWooTracking?.serverCartTracking && documentPayload.event_type === "add_to_cart") return;
    if (!ATC_ENABLED) return;
    const url = atcUrl();
    if (!url) { log("⚠️ search-to-cart: no URL configured"); return; }
    const body = JSON.stringify({ document: documentPayload.event_type === "ab_exposure" ? documentPayload : linkCart(documentPayload) });
    log("🛒 Sending to:", url, "| payload product_id:", documentPayload.product_id);
    // Use the saved fetch ref to avoid going through the cart interceptor wrapper
    (_origFetchForSend || fetch)(url, {
      method: "POST",
      headers: headers(),
      body,
      keepalive: true
    }).then(r => {
      if (r.ok) log("🛒 ✅ search-to-cart sent successfully");
      else log("⚠️ search-to-cart failed", r.status, r.statusText);
    }).catch(e => { log("⚠️ search-to-cart error:", e?.message); });
  }

  async function flushQueue() {
    if (!CLICK_ENABLED || !analyticsAllowed()) return;
    const q = queueLoad();
    if (!q.length) return;

    const remaining = [];
    for (const p of q) {
      try {
        const r = await fetch(clickUrl(), { method: "POST", headers: headers(), body: JSON.stringify(p) });
        if (!r.ok) remaining.push(p);
      } catch { remaining.push(p); }
    }
    queueSave(remaining);
  }

  /**
   * Detect the e-commerce platform
   */
  function detectPlatform() {
    // An explicit siteConfig.platform (set by the studio from the store's own pages) wins over DOM sniffing,
    // which misses themes that hide platform markers (e.g. a custom Magento theme without window.Mage).
    const forced = window.SemantixSettings?.siteConfig?.platform || C.platform;
    if (typeof forced === "string" && forced) return forced;

    // Shopify
    if (window.Shopify || document.querySelector('script[src*="shopify"]') || document.querySelector('[data-shopify]')) {
      return "shopify";
    }
    
    // WooCommerce
    if (document.body.classList.contains('woocommerce') || 
        document.querySelector('.woocommerce') || 
        document.querySelector('script[src*="woocommerce"]')) {
      return "woocommerce";
    }
    
    // Magento
    if (window.Mage || document.querySelector('script[src*="magento"]') || document.body.classList.contains('cms-home')) {
      return "magento";
    }
    
    // BigCommerce
    if (window.BCData || document.querySelector('script[src*="bigcommerce"]')) {
      return "bigcommerce";
    }
    
    // PrestaShop
    if (window.prestashop || document.querySelector('script[src*="prestashop"]')) {
      return "prestashop";
    }
    
    // OpenCart
    if (document.querySelector('script[src*="opencart"]') || document.querySelector('#cart-total')) {
      return "opencart";
    }
    
    // Wix
    if (window.wixBiSession || document.querySelector('meta[name="generator"][content*="Wix"]')) {
      return "wix";
    }
    
    // Custom/Unknown
    return cfg.clickTracking.universalMode ? "universal" : "unknown";
  }

  function getProductId(card, href, link) {
    // Check Semantix data attribute first (for AI cards)
    const pid = card?.getAttribute("data-semantix-pid") || 
                card?.getAttribute("data-product-id") || 
                card?.getAttribute("data-product_id") ||
                card?.getAttribute("data-product-handle") ||
                card?.getAttribute("data-item-id") ||
                card?.getAttribute("data-id") ||
                card?.getAttribute("data-favorite-product-id");
    if (pid) return pid;

    // Check link element data attributes
    if (link) {
      const linkPid = link.getAttribute("data-product-id") ||
                     link.getAttribute("data-product_id") ||
                     link.getAttribute("data-item-id") ||
                     link.getAttribute("data-id") ||
                     link.getAttribute("data-favorite-product-id");
      if (linkPid) return linkPid;
    }

    if (href) {
      // Shopify: /products/product-handle
      let m = href.match(/\/products\/([^?#/]+)/);
      if (m) return m[1];
      
      // Generic: /product/123 or /product/product-name
      m = href.match(/\/product[s]?\/([^?#/]+)/);
      if (m) return m[1];
      
      // Item pattern: /item/123
      m = href.match(/\/item\/([^?#/]+)/);
      if (m) return m[1];
      
      // Numeric HTML: /123.html
      m = href.match(/\/(\d+)\.html/);
      if (m) return m[1];
      
      // Query params: ?product_id=123 or ?item_id=123
      try { 
        const u = new URL(href, location.origin); 
        const paramId = u.searchParams.get("product_id") || 
                       u.searchParams.get("product-id") ||
                       u.searchParams.get("item_id") ||
                       u.searchParams.get("item-id") ||
                       u.searchParams.get("id") ||
                       u.searchParams.get("add-to-cart"); 
        if (paramId) return paramId; 
    } catch {}

      // Catalog pattern: /catalog/category/product
      m = href.match(/\/catalog\/[^/]+\/([^?#/]+)/);
      if (m) return m[1];
    }

    // WooCommerce class pattern
    const cls = card?.className || "";
    const postMatch = cls.match(/\bpost-(\d+)\b/);
    if (postMatch) return postMatch[1];

    // Last resort - use the href itself as identifier
    return href || "";
  }

  function getProductName(card, link) {
    // 1. Semantix stored name
    const sxName = card?.getAttribute("data-semantix-name");
    if (sxName?.trim()) return sxName.trim();

    // 2. Config selector
    const cfgSel = cfg.nativeCard?.map?.titleSelector;
    if (cfgSel) { const el = q1(cfgSel, card); if (el) { const t = el.textContent?.trim(); if (t && t.length < 300) return t; } }

    // 3. Standard selectors (extended for universal mode)
    const universalTitleSelectors = [
      ...TITLE_SELECTORS,
      ".item-title",
      ".listing-title",
      "[class*='product-name']",
      "[class*='item-name']",
      "[class*='product-title']",
      "[class*='item-title']",
      "[itemprop='name']",
      ".name",
      ".title"
    ];
    
    for (const sel of universalTitleSelectors) {
      const el = q1(sel, card);
      if (el) { const t = el.textContent?.trim(); if (t && t.length > 0 && t.length < 300) return t; }
    }

    // 4. Text from clicked link
    if (link) {
      const h = q1("h1, h2, h3, h4, .title, .name, [class*='title'], [class*='name']", link);
      if (h) { const t = h.textContent?.trim(); if (t && t.length < 300) return t; }
      
      // Get title attribute
      const titleAttr = link.getAttribute("title");
      if (titleAttr?.trim() && titleAttr.length < 300) return titleAttr.trim();
      
      // Get aria-label
      const ariaLabel = link.getAttribute("aria-label");
      if (ariaLabel?.trim() && ariaLabel.length < 300) return ariaLabel.trim();
      
      const lt = link.textContent?.trim();
      if (lt && lt.length < 300 && !lt.match(/^[\d\s.,₪$€]+$/) && !lt.toLowerCase().includes("cart")) {
        return lt;
      }
    }

    // 5. Image alt
    const img = q1("img", card);
    const alt = img?.getAttribute("alt")?.trim();
    if (alt && alt.length < 300 && !alt.includes("placeholder")) return alt;

    return null;
  }

  function findCard(target) {
    // Priority 1: Semantix AI card (most reliable — we set these attributes)
    const aiCard = target?.closest?.("[data-semantix-ai='1']");
    if (aiCard) return aiCard;

    // Priority 2: Config selectors (site-specific, set by admin)
    const cfgCard = cfg.selectors?.productCard || [];
    for (const sel of cfgCard) {
      try { const c = target?.closest?.(sel); if (c) return c; } catch {}
    }

    // Priority 3: Data-attribute cards (explicit product IDs)
    const dataCard = target?.closest?.("[data-product-id], [data-item-id]");
    if (dataCard) return dataCard;

    // Priority 4: Fallback selectors
    for (const sel of FALLBACK_CARDS) {
      try { const c = target?.closest?.(sel); if (c) return c; } catch {}
    }

    // NO aggressive DOM walking — if we can't find a card via selectors, return null
    return null;
  }

  function isProductLink(href, linkEl) {
    if (!href) return false;
    
    // Universal mode - check if link matches custom selector
    if (cfg.clickTracking.universalMode) {
      const customSel = cfg.clickTracking.universalLinkSelector;
      if (customSel && linkEl) {
        try {
          // Check if the link itself matches or is inside a matching element
          if (linkEl.matches(customSel) || linkEl.closest(customSel)) {
    return true;
          }
        } catch {}
      }
      // In universal mode, also track any link that looks like a product
      // Check for common product URL patterns across platforms
      if (href.includes("/product") || 
          href.includes("/item") || 
          href.includes("/p/") ||
          href.includes("/catalog/") ||
          href.includes("/shop/") ||
          href.match(/\/\d+\.html/) ||  // numeric ID pages
          href.match(/[?&]product[_-]?id=/i) ||
          href.match(/[?&]item[_-]?id=/i)) {
        return true;
      }
    }
    
    // Standard mode - Shopify/WooCommerce product page patterns only
    return href.includes("/products/") || href.includes("/product/");
  }

  function normalizeSelectors(sel) {
    if (Array.isArray(sel)) return sel.filter(s => typeof s === "string" && s.trim().length);
    if (typeof sel === "string" && sel.trim().length) return [sel.trim()];
    return [];
  }

  function matchClosestSelector(target, selectors) {
    for (const s of selectors) {
      try {
        const el = target?.closest?.(s);
        if (el) return el;
      } catch {}
    }
    return null;
  }

  function getPageProductId() {
    // Config selector first
    const cfgSel = cfg.selectors?.productId;
    if (cfgSel) {
      const el = q1(cfgSel);
      const v = el?.getAttribute?.("content") || el?.value || el?.textContent;
      if (v && String(v).trim()) return String(v).trim();
    }

    // Common input fields
    const input = q1("input[name='id'], input[name='product_id'], input[name='add-to-cart']");
    if (input?.value) return String(input.value).trim();

    // Common data attributes
    const dataEl = q1("[data-product-id], [data-product_id], [data-item-id], [data-id]");
    if (dataEl) {
      const v = dataEl.getAttribute("data-product-id") ||
                dataEl.getAttribute("data-product_id") ||
                dataEl.getAttribute("data-item-id") ||
                dataEl.getAttribute("data-id");
      if (v && String(v).trim()) return String(v).trim();
    }

    // Meta tags
    const metaSku = q1("meta[itemprop='sku'], meta[property='product:retailer_item_id'], meta[property='og:sku']");
    const mv = metaSku?.getAttribute("content");
    if (mv && String(mv).trim()) return String(mv).trim();

    // URL fallback
    const href = location?.href || "";
    if (href) return getProductId(null, href, null);

    return null;
  }

  function getPageProductName() {
    const cfgSel = cfg.selectors?.productName;
    if (cfgSel) {
      const el = q1(cfgSel);
      const t = el?.textContent?.trim();
      if (t) return t;
    }

    const h1 = q1("h1, [itemprop='name'], .product__title, .product-title, .product-name");
    const ht = h1?.textContent?.trim();
    if (ht) return ht;

    const og = q1("meta[property='og:title'], meta[name='twitter:title']");
    const ot = og?.getAttribute("content")?.trim();
    if (ot) return ot;

    return null;
  }

  function attachClickTracking() {
    if (!CLICK_ENABLED || window.__semantix_click_v5) return;
    window.__semantix_click_v5 = true;

    log("Click tracking v5 initialized");
    if (analyticsAllowed()) visitId();
    flushQueue();
    
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushQueue(); });
    window.addEventListener("pagehide", flushQueue);

    const atcSelectors = normalizeSelectors(cfg.clickTracking.addToCartSelector);
    const productPageSelectors = normalizeSelectors(cfg.selectors?.productPage);

    if (atcSelectors.length) {
      document.addEventListener("click", function(ev) {
        if (ev.button !== 0 || !ev.isTrusted) return;

        const btn = matchClosestSelector(ev.target, atcSelectors);
        if (!btn || btn.hasAttribute("data-semantix-atc")) return; // the engine's own button reports through the cart interceptor

        const card = findCard(btn);
        ATC_PRESS = { at: Date.now(), path: card ? productPath(q1("a[href]", card)?.getAttribute("href") || "") : "", inResults: inSearchResults(card), typed: inTypedList(card) };
        const isProductPage = productPageSelectors.length
          ? !!q1(productPageSelectors[0]) || !!matchClosestSelector(btn, productPageSelectors)
          : !!q1("form[action*='cart'], form[action*='add'], form[action*='checkout']");

        const isAI = card ? card.getAttribute("data-semantix-ai") === "1" : false;
        if (!isAI && (window.SemantixWooTracking?.nativeClickTracking || !cfg.clickTracking.trackNativeClicks)) return;

        const link = card ? q1("a[href]", card) : null;
        const href = link?.getAttribute("href") || btn.getAttribute("href") || location.href || "";
        const pid = card ? getProductId(card, href, link) : getPageProductId();
        if (!pid) return;

        const now = Date.now();
        if (pid === lastAtcPid && (now - lastAtcTime) < DEDUPE_MS) {
          log(`⏭️ Duplicate ATC blocked: ${pid}`);
          return;
        }
        lastAtcTime = now;
        lastAtcPid = pid;

        // Determine detailed source
        const isInjected = card ? card.getAttribute("data-semantix-injected") === "1" : false;
        const isReranked = card ? card.getAttribute("data-semantix-reranked") === "1" : false;
        const isZeroRecovery = card ? !!card.closest("[data-semantix-zero-grid]") : false;
        let source = isProductPage ? "product-page" : "native";
        if (isZeroRecovery)  source = "zero-results";
        else if (isInjected) source = "inject";
        else if (isReranked) source = "rerank";
        else if (isAI)       source = "ai";

        const name = card ? getProductName(card, link) : getPageProductName();
        const sid = ensureVisitorId();
        const lastQuery = getQuery() || ssGet("semantix_last_query", "") || null;

        const payload = {
          event_type: "add_to_cart",
          search_query: lastQuery || null,
          product_id: String(pid),
          product_name: name || null,
          product_url: href || null,
          source: source,
          is_ai: isAI,
          platform: detectPlatform(),
          session_id: sid,
          query_mode: isZeroRecovery ? "zero-results" : (lastQuery ? "enrichment" : "browse"),
          search_results: LAST_SEARCH_RESULTS || null,
          tier2_results: LAST_TIER2_RESULTS || null,
          searchMetadata: LAST_SEARCH_METADATA || null,
          search_classification: LAST_SEARCH_CLASSIFICATION || null,
          ...abTestPayloadFields()
        };

        log("📤 ATC:", pid, `source=${source}`, `query_mode=${payload.query_mode}`, `session=${sid}`);
        sendSearchToCart(payload);
      }, true);
    }

    document.addEventListener("click", function(ev) {
      // Only real left-clicks (not middle-click, right-click, or programmatic)
      if (ev.button !== 0 || !ev.isTrusted) return;

      const link = ev.target?.closest?.("a[href]");
      if (!link) return;

      const href = link.getAttribute("href") || "";
      if (!href || href === "#" || href.startsWith("javascript:")) return;
      if (!isProductLink(href, link)) return;

      const card = findCard(ev.target);
      if (!card) return;

      const isAI = card.getAttribute("data-semantix-ai") === "1";
      if (!isAI && (window.SemantixWooTracking?.nativeClickTracking || !cfg.clickTracking.trackNativeClicks)) return;

      const pid = getProductId(card, href, link);
      if (!pid) return;

      const now = Date.now();
      if (pid === lastSentPid && (now - lastSentTime) < DEDUPE_MS) {
        log(`⏭️ Duplicate blocked: ${pid}`);
        return;
      }
      lastSentTime = now;
      lastSentPid = pid;

      // Determine detailed source
      const isInjected = card.getAttribute("data-semantix-injected") === "1";
      const isReranked = card.getAttribute("data-semantix-reranked") === "1";
      const isZeroRecovery = !!card.closest("[data-semantix-zero-grid]");
      let source = "native";
      if (isZeroRecovery)  source = "zero-results";
      else if (isInjected) source = "inject";
      else if (isReranked) source = "rerank";
      else if (isAI)       source = "ai";

      const name = getProductName(card, link);
      const sid = ensureVisitorId();
      const searchQuery = getQuery() || ssGet("semantix_last_query", "") || null;

      const payload = {
        event_id: "clk-" + now + "-" + Math.random().toString(36).slice(2, 8),
        product_id: String(pid),
        product_name: name || null,
        search_query: searchQuery,
        interaction_type: "click",
        timestamp: new Date().toISOString(),
        product_url: href,
        source: source,
        is_ai: isAI,
        platform: detectPlatform(),
        session_id: sid,
        query_mode: isZeroRecovery ? "zero-results" : (searchQuery ? "enrichment" : "browse"),
        ...abTestPayloadFields()
      };

      log("📤 Click:", pid, `source=${source}`, `query_mode=${payload.query_mode}`, `session=${sid}`);
      sendClick(payload, inSearchResults(card), inTypedList(card));

      if (cfg.clickTracking.forceNavDelay && !ev.defaultPrevented && !ev.metaKey && !ev.ctrlKey) {
        ev.preventDefault();
        setTimeout(() => { location.href = href; }, cfg.clickTracking.forceNavDelayMs || 120);
      }
    }, true);

    log("✅ Click listener ready");
  }

  /* ====================== CART INTERCEPTOR (fetch/XHR) ====================== */

  function attachCartInterceptor() {
    if (window.__semantix_cart_interceptor) return;
    if (!ATC_ENABLED) return;

    // Support cartInterceptor at top level OR nested inside clickTracking.
    // clickTracking.cartInterceptor wins when both exist: it's the one that
    // gets refreshed by bootstrap()'s post-fetch config rebuild, while the
    // top-level cfg.cartInterceptor is sealed at first (pre-fetch) cfg build
    // and never truthy-falls-through since it's always a non-empty object.
    const interceptorCfg = { ...cfg.cartInterceptor, ...cfg.clickTracking?.cartInterceptor };
    if (interceptorCfg.enabled === false) return;
    window.__semantix_cart_interceptor = true;

    const platform = detectPlatform();

    // Built-in platform patterns
    const PLATFORM_PATTERNS = {
      woocommerce: {
        atc: ["wc-ajax=add_to_cart", "?add-to-cart=", "wc-ajax=update_cart_item"],
        checkout: ["wc-ajax=checkout", "/checkout/", "wc-ajax=update_order_review"],
        pidFields: ["product_id", "add-to-cart", "variation_id"],
        qtyField: "quantity"
      },
      shopify: {
        atc: ["/cart/add.js", "/cart/add.json", "/cart/update.js"],
        checkout: ["/checkout", "/checkouts/"],
        pidFields: ["id", "items[0][id]"],
        qtyField: "quantity"
      },
      magento: {
        atc: ["/checkout/cart/add", "form_key"],
        checkout: ["/checkout/", "/onepage/"],
        pidFields: ["product", "item"],
        qtyField: "qty"
      },
      bigcommerce: {
        atc: ["/cart.php", "/remote/v1/cart/add"],
        checkout: ["/checkout.php", "/checkout"],
        pidFields: ["product_id", "productId"],
        qtyField: "quantity"
      },
      prestashop: {
        atc: ["controller=cart", "add=1", "?add"],
        checkout: ["controller=order", "/order"],
        pidFields: ["id_product"],
        qtyField: "qty"
      },
    };

    // Resolve patterns — custom config overrides auto-detect
    // Support both "atcPatterns" and "urlPatterns" as aliases
    const pp = PLATFORM_PATTERNS[platform] || {};
    const atcPatterns = interceptorCfg.atcPatterns || interceptorCfg.urlPatterns || pp.atc || [];
    const checkoutPatterns = interceptorCfg.checkoutPatterns || pp.checkout || [];
    // Session-level checkout events (no product id) only where checkout patterns were set explicitly (studio config);
    // the broad built-in patterns (e.g. Magento "/checkout/" also matches mini-cart edits) keep the old behaviour.
    const sessionCheckout = Array.isArray(interceptorCfg.checkoutPatterns) && interceptorCfg.checkoutPatterns.length > 0;
    const pidFields = interceptorCfg.productIdField
      ? [interceptorCfg.productIdField]
      : (pp.pidFields || ["product_id", "pid", "id", "item_id", "product", "productId", "item", "sku"]);
    const qtyField = interceptorCfg.quantityField || pp.qtyField || "quantity";
    const qtyFields = [qtyField, "quantity", "quan", "qty", "count"].filter((v, i, a) => a.indexOf(v) === i);

    if (!atcPatterns.length && !checkoutPatterns.length) {
      log("🛒 Cart interceptor: no patterns for platform:", platform);
      return;
    }

    log("🛒 Cart interceptor active | platform:", platform, "| ATC patterns:", atcPatterns, "| checkout:", checkoutPatterns);

    function matchesPatterns(url, patterns) {
      if (!url || !patterns.length) return false;
      const lower = url.toLowerCase();
      return patterns.some(p => lower.includes(p.toLowerCase()));
    }

    function extractPid(body) {
      if (!body) return null;

      // FormData
      if (body instanceof FormData) {
        for (const f of pidFields) {
          const v = body.get(f);
          if (v) return String(v);
        }
        return null;
      }

      // URLSearchParams
      if (body instanceof URLSearchParams) {
        for (const f of pidFields) {
          const v = body.get(f);
          if (v) return String(v);
        }
        return null;
      }

      // String (JSON or URL-encoded)
      if (typeof body === "string") {
        // Try JSON
        try {
          const j = JSON.parse(body);
          return extractPidFromObj(j);
        } catch {}

        // URL-encoded
        try {
          const params = new URLSearchParams(body);
          for (const f of pidFields) {
            const v = params.get(f);
            if (v) return String(v);
          }
        } catch {}
      }

      // Plain object
      if (typeof body === "object" && body !== null) {
        return extractPidFromObj(body);
      }

      return null;
    }

    function extractPidFromObj(obj) {
      for (const f of pidFields) {
        if (obj[f] !== undefined && obj[f] !== null) return String(obj[f]);
      }
      // Shopify items array
      if (Array.isArray(obj.items) && obj.items[0]) {
        for (const f of pidFields) {
          if (obj.items[0][f] !== undefined) return String(obj.items[0][f]);
        }
      }
      return null;
    }

    function extractQty(body) {
      if (!body) return 1;
      try {
        if (body instanceof FormData) return parseInt(body.get(qtyField)) || 1;
        if (body instanceof URLSearchParams) return parseInt(body.get(qtyField)) || 1;
        if (typeof body === "string") {
          try { const j = JSON.parse(body); return parseInt(j[qtyField]) || 1; } catch {}
          try { return parseInt(new URLSearchParams(body).get(qtyField)) || 1; } catch {}
        }
        if (typeof body === "object") return parseInt(body[qtyField]) || 1;
      } catch {}
      return 1;
    }

    function extractPidFromUrl(url) {
      if (!url) return null;
      // Check all configured pidFields in URL query params (handles GET requests)
      try {
        const urlObj = new URL(url, location.origin);
        for (const f of pidFields) {
          const v = urlObj.searchParams.get(f);
          if (v) return String(v);
        }
      } catch {}
      // ?add-to-cart=123 (WooCommerce shorthand fallback)
      const m = url.match(/[?&]add-to-cart=(\d+)/);
      if (m) return m[1];
      return null;
    }

    function extractQtyFromUrl(url) {
      if (!url) return 1;
      try {
        const urlObj = new URL(url, location.origin);
        for (const f of qtyFields) {
          const v = urlObj.searchParams.get(f);
          const n = parseInt(v);
          if (n > 0) return n;
        }
      } catch {}
      return 1;
    }

    // Fallback: get numeric product ID from page DOM (works on product pages)
    function extractPidFromDom() {
      // WooCommerce: hidden input or button value
      const wcInput = q1("input[name='product_id'], input[name='add-to-cart'], button[name='add-to-cart']");
      if (wcInput) {
        const v = wcInput.value || wcInput.getAttribute("value");
        if (v && /^\d+$/.test(v)) return v;
      }
      // WooCommerce: body class contains postid-NNN
      const bodyClass = document.body?.className || "";
      const postMatch = bodyClass.match(/postid-(\d+)/);
      if (postMatch) return postMatch[1];
      // data-product_id on form or wrapper
      const dpid = q1("[data-product_id], [data-product-id]");
      if (dpid) {
        const v = dpid.getAttribute("data-product_id") || dpid.getAttribute("data-product-id");
        if (v && /^\d+$/.test(v)) return v;
      }
      // Fallback to getPageProductId() if available
      try { const p = getPageProductId(); if (p) return String(p); } catch {}
      return null;
    }

    function handleInterceptedRequest(url, body, eventType) {
      let pid = extractPid(body) || extractPidFromUrl(url);

      // Log raw extraction for debugging
      log("🛒 Raw extracted PID:", pid, "| from body type:", typeof body === "object" ? body?.constructor?.name : typeof body);

      // If PID is not numeric (could be a slug or cart_item_key), try DOM fallback
      if (!pid || (typeof pid === "string" && !/^\d+$/.test(pid))) {
        const domPid = extractPidFromDom();
        if (domPid) {
          log("🛒 Body PID was non-numeric:", pid, "→ using DOM fallback:", domPid);
          pid = domPid;
        } else if (!pid && !(eventType === "checkout" && sessionCheckout)) {
          log("🛒 Intercepted", eventType, "but no product ID found | url:", url);
          return;
        }
        // A checkout (order placement) is a session-level event: it is sent without a product id.
        // If we have a non-numeric pid and no DOM fallback, still send it (could be a slug/handle)
      }

      const now = Date.now();
      const dedupeKey = pid || eventType;
      if (dedupeKey === lastAtcPid && (now - lastAtcTime) < DEDUPE_MS) {
        log("🛒 ⏭️ Duplicate intercepted", eventType, "blocked:", pid);
        return;
      }
      lastAtcTime = now;
      lastAtcPid = dedupeKey;

      const qty = body ? extractQty(body) : extractQtyFromUrl(url);
      const sid = ensureVisitorId();
      const lastQuery = getQuery() || ssGet("semantix_last_query", "") || null;
      const name = getPageProductName();

      const payload = {
        event_type: eventType,
        search_query: lastQuery || null,
        product_id: pid ? String(pid) : null,
        product_name: pid ? (name || null) : null,
        product_url: location.href,
        quantity: qty,
        source: "intercepted",
        is_ai: false,
        platform: platform,
        session_id: sid,
        query_mode: lastQuery ? "enrichment" : "browse",
        intercept_url: url,
        search_results: LAST_SEARCH_RESULTS || null,
        tier2_results: LAST_TIER2_RESULTS || null,
        searchMetadata: LAST_SEARCH_METADATA || null,
        search_classification: LAST_SEARCH_CLASSIFICATION || null,
        ...abTestPayloadFields()
      };

      // Added from a Semantix card: the platform id above comes from the store, the catalog id from our result.
      const ctx = window.__semantix_atc_context;
      if (ctx && eventType === "add_to_cart" && Date.now() - ctx.at < 10000) {
        payload.catalog_product_id = ctx.pid || null;
        payload.product_name = ctx.name || payload.product_name;
        payload.product_url = ctx.url || payload.product_url;
        payload.is_ai = true;
        payload.source = "semantix-card";
        window.__semantix_atc_context = null;
      }

      log("🛒 📤 Intercepted", eventType, "| pid:", pid, "| name:", name, "| qty:", qty, "| url:", url);
      sendSearchToCart(payload);
    }

    // ---- Wrap window.fetch ----
    const origFetch = window.fetch;
    window.fetch = function(input, init) {
      try {
        const url = typeof input === "string" ? input : (input?.url || "");
        const method = (init?.method || input?.method || "GET").toUpperCase();

        if (method === "POST" || method === "PUT" || method === "GET") {
          if (matchesPatterns(url, atcPatterns)) {
            handleInterceptedRequest(url, method === "GET" ? null : init?.body, "add_to_cart");
          } else if (matchesPatterns(url, checkoutPatterns)) {
            handleInterceptedRequest(url, method === "GET" ? null : init?.body, "checkout");
          }
        }
      } catch (e) {
        log("🛒 fetch intercept error:", e);
      }
      const answer = origFetch.apply(this, arguments);
      try {
        const url = typeof input === "string" ? input : (input?.url || "");
        if ((init?.method || input?.method || "GET").toUpperCase() === "POST" && matchesPatterns(url, atcPatterns))
          answer.then(r => r.clone().text().then(text => confirmCartAdd(url, init?.body, r.status, text))).catch(() => {});
      } catch {}
      return answer;
    };

    // A click on the button says nothing about the cart: the store can refuse (sold out, options missing). Its answer does.
    // add_to_cart_confirmed goes out once per answer that succeeded, beside the older add_to_cart events.
    function cartAnswerOk(status, text) {
      if (status < 200 || status >= 300) return false;
      try {
        const j = JSON.parse(text);
        if (j && (j.error || j.success === false)) return false;
        if (j && j.backUrl && !/checkout\/cart/.test(j.backUrl)) return false;
      } catch {}
      return true;
    }
    function confirmCartAdd(url, body, status, text) {
      if (!cartAnswerOk(status, text)) return;
      let pid = extractPid(body) || extractPidFromUrl(url);
      if (!pid || !/^\d+$/.test(String(pid))) pid = extractPidFromDom() || pid;
      sendSearchToCart({
        event_type: "add_to_cart_confirmed",
        event_id: "atc-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
        search_query: getQuery() || ssGet("semantix_last_query", "") || null,
        product_id: pid ? String(pid) : null,
        product_url: location.href,
        quantity: body ? extractQty(body) : extractQtyFromUrl(url),
        source: "cart-response",
        platform,
        session_id: ensureVisitorId(),
        ...abTestPayloadFields()
      });
    }

    // ---- Wrap XMLHttpRequest ----
    const origXHROpen = XMLHttpRequest.prototype.open;
    const origXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
      this.__semantix_method = method;
      this.__semantix_url = url;
      return origXHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(body) {
      try {
        const method = (this.__semantix_method || "").toUpperCase();
        const url = this.__semantix_url || "";

        if (method === "POST" && matchesPatterns(url, atcPatterns)) {
          this.addEventListener("load", () => { try { confirmCartAdd(url, body, this.status, this.responseType && this.responseType !== "text" ? "" : this.responseText); } catch {} });
        }
        if (method === "POST" || method === "PUT" || method === "GET") {
          if (matchesPatterns(url, atcPatterns)) {
            handleInterceptedRequest(url, method === "GET" ? null : body, "add_to_cart");
          } else if (matchesPatterns(url, checkoutPatterns)) {
            handleInterceptedRequest(url, method === "GET" ? null : body, "checkout");
          }
        }
      } catch (e) {
        log("🛒 XHR intercept error:", e);
      }
      return origXHRSend.apply(this, arguments);
    };

    log("🛒 ✅ Cart interceptor ready (fetch + XHR)");
  }

  /* ------------------------ the order, on the store's thank-you page ------------------------ */

  // The one proof of a purchase on a store without a server-side order feed: its own confirmation page, with an order
  // number. Everything else ("/checkout/" requests, the mini-cart) happens without an order. Magento by default;
  // siteConfig.orderTracking = { pages:[paths], orderSelector, totalSelector } for another layout, { enabled:false } off.
  // The order number comes from the store's dataLayer, else the page; no number, no event. The server drops a repeat
  // (event_id) and the group and search are the ones the visitor had when they bought.
  function orderFromDataLayer() {
    for (const e of [...(window.dataLayer || [])].reverse()) {
      const old = e?.ecommerce?.purchase, ga4 = e?.ecommerce?.transaction_id ? e.ecommerce : null;
      const id = old?.actionField?.id ?? ga4?.transaction_id ?? e?.transactionId;
      if (id) return { id: String(id), total: Number(old?.actionField?.revenue ?? ga4?.value ?? e?.transactionTotal), currency: ga4?.currency || e?.ecommerce?.currencyCode || null, items: old?.products || ga4?.items || [] };
    }
    return null;
  }
  function orderFromPage(oc) {
    const text = q1(oc.orderSelector || ".checkout-success .order-number, .checkout-success p span, .order-number")?.textContent || "";
    const id = text.match(/\d{4,}/)?.[0];
    if (!id) return null;
    const total = q1(oc.totalSelector || ".grand_total .price, .grand-total .price")?.textContent.replace(/[^\d.]/g, "");
    return { id, total: total ? Number(total) : NaN, currency: null, items: [] };
  }
  function trackOrderPage() {
    const oc = cfg.orderTracking || {};
    if (oc.enabled === false || !ATC_ENABLED) return;
    const pages = oc.pages || (detectPlatform() === "magento" ? ["/checkout/onepage/success", "/checkout/success", "/onepage/success"] : []);
    if (!pages.some(p => location.pathname.includes(p))) return;
    let tries = 0;
    const read = () => {
      const o = orderFromDataLayer() || orderFromPage(oc);
      if (!o) { if (++tries < 4) setTimeout(read, 1500); return; }
      if (lsGet("semantix_order_sent", "") === o.id) return;
      lsSet("semantix_order_sent", o.id);
      let groups = null;
      try { groups = JSON.parse(lsGet("semantix_ab_current", "null")); } catch {}
      sendSearchToCart({
        event_type: "checkout_completed", event_id: "order-" + o.id, order_id: o.id,
        total_price: Number.isFinite(o.total) ? o.total : null, currency: o.currency,
        items: (o.items || []).slice(0, 50).map(i => ({ id: i.id ?? i.item_id ?? null, name: i.name ?? i.item_name ?? null, quantity: i.quantity ?? null, price: i.price ?? null })),
        source: "order-page", platform: detectPlatform(), session_id: ensureVisitorId(), page_path: location.pathname,
        ...(groups ? { ab_tests: groups } : abTestPayloadFields())
      });
    };
    read();
  }

  /* ------------------------ session storage cache ------------------------ */

  const CACHE_KEY = "semantix_search_cache_v1";
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  function getCachedResults(query) {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (!cached) return null;
      
      const cache = JSON.parse(cached);
      const entry = cache[query];
      
      if (!entry) return null;
      
      // Check if expired
      if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        console.log("[Semantix Cache] ⏰ Expired cache for:", query);
        delete cache[query];
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        return null;
      }
      
      console.log("[Semantix Cache] ✅ Hit! Using cached results for:", query, `(${entry.products.length} products)`);
      return entry.products;
    } catch (e) {
      console.warn("[Semantix Cache] Error reading cache:", e);
      return null;
    }
  }

  function setCachedResults(query, products) {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      const cache = cached ? JSON.parse(cached) : {};
      
      cache[query] = {
        products: products,
        timestamp: Date.now()
      };
      
      // Limit cache size to last 20 queries
      const keys = Object.keys(cache);
      if (keys.length > 20) {
        const sorted = keys.sort((a, b) => cache[a].timestamp - cache[b].timestamp);
        sorted.slice(0, keys.length - 20).forEach(k => delete cache[k]);
      }
      
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      console.log("[Semantix Cache] 💾 Saved results for:", query, `(${products.length} products)`);
    } catch (e) {
      console.warn("[Semantix Cache] Error saving cache:", e);
    }
  }

  function clearCache() {
    try {
      sessionStorage.removeItem(CACHE_KEY);
      console.log("[Semantix Cache] 🗑️ Cache cleared");
    } catch (e) {
      console.warn("[Semantix Cache] Error clearing cache:", e);
    }
  }

  /* ------------------------ add to cart ------------------------ */

  const ATC_FORMS = {
    magento: "#product_addtocart_form, form[data-role='tocart-form'], form[action*='checkout/cart/add']",
    woocommerce: "form.cart, form[action*='add-to-cart']",
    custom: "form[action*='cart/add'], form[action*='add-to-cart'], form[action*='/cart']"
  };
  // Choices the shopper has to make on the product page; such products are not added blindly.
  const ATC_OPTIONS = "select[name^='super_attribute'], [name^='options['][required], select[name^='attribute_'], .variations select, input[name^='super_attribute'][type='radio']";
  const atcForms = new Map();

  function readCookie(name) {
    const m = document.cookie.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function setButtonText(btn, text) {
    const target = btn.querySelector("span") || btn;
    target.textContent = text;
  }

  // Reads the product page the way the shopper's browser would and returns its add-to-cart form fields.
  // Cached per URL (and form selector) as a promise, so a hover prefetch and the click share one request.
  // sel: a form other than addToCart.formSelector, e.g. one edition of a product sold in two (data-semantix-atc-form).
  function productForm(url, platform, sel) {
    url = new URL(url, location.href).href;
    const key = sel ? url + "\n" + sel : url;
    if (!atcForms.has(key)) {
      const p = readProductForm(url, platform, sel);
      atcForms.set(key, p);
      p.catch(() => atcForms.delete(key));
    }
    return atcForms.get(key);
  }

  async function readProductForm(url, platform, pick) {
    const res = await fetch(url, { credentials: "same-origin", headers: { Accept: "text/html" } });
    if (!res.ok) throw new Error("product page HTTP " + res.status);
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const sel = pick || cfg.addToCart?.formSelector || ATC_FORMS[platform] || ATC_FORMS.custom;
    const form = doc.querySelector(sel);
    if (!form) return null;
    const data = new URLSearchParams();
    // First value per field wins: themes that print related-product forms inside the main one (browsers merge nested
    // forms) would otherwise send several "product" values and add the wrong item. Array fields ("x[]") keep all values.
    form.querySelectorAll("input[name], select[name], textarea[name]").forEach(el => {
      if (el.disabled) return;
      if ((el.type === "checkbox" || el.type === "radio") && !el.checked) return;
      if (data.has(el.name) && !el.name.endsWith("[]")) return;
      data.append(el.name, el.value);
    });
    const submit = form.querySelector("button[type='submit'][name], button:not([type])[name]");
    if (submit && !data.has(submit.name)) data.append(submit.name, submit.value);
    const needsChoice = [...form.querySelectorAll(ATC_OPTIONS)].some(el => !el.value);
    return { action: new URL(form.getAttribute("action") || url, url).href, data: data.toString(), needsChoice };
  }

  function applyShopifySections(sections) {
    for (const [id, html] of Object.entries(sections || {})) {
      const target = document.getElementById("shopify-section-" + id);
      if (!target || typeof html !== "string") continue;
      const doc = new DOMParser().parseFromString(html, "text/html");
      const fresh = doc.getElementById("shopify-section-" + id) || doc.body.firstElementChild;
      if (fresh) target.innerHTML = fresh.innerHTML;
    }
  }

  // true = added; false = the product needs the product page (options, unavailable); throws on failure.
  async function platformAddToCart(url, pid, sel) {
    const platform = detectPlatform();
    if (platform === "shopify") {
      const u = new URL(url, location.href);
      const r = await fetch(u.pathname.replace(/\/$/, "") + ".js", { headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error("product.js HTTP " + r.status);
      const product = await r.json();
      const available = (product.variants || []).filter(v => v.available);
      if (available.length !== 1) return false;
      const sections = asList(cfg.addToCart?.sections);
      const res = await fetch(((window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || "/") + "cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ items: [{ id: available[0].id, quantity: 1 }], ...(sections.length ? { sections: sections.join(","), sections_url: location.pathname } : {}) })
      });
      if (!res.ok) throw new Error("cart/add HTTP " + res.status);
      const data = await res.json();
      if (data.sections) applyShopifySections(data.sections);
      document.dispatchEvent(new CustomEvent("cart:refresh", { bubbles: true }));
      if (cfg.addToCart?.openCart !== false) {
        const drawer = document.querySelector("cart-drawer, cart-notification");
        try { drawer?.classList?.remove("is-empty"); drawer?.open?.(); } catch {}
      }
      return true;
    }
    if (platform === "woocommerce") {
      const tail = String(pid || "").split(":").pop();
      let id = /^\d+$/.test(tail) ? tail : null;
      if (!id) {
        const f = await productForm(url, platform);
        if (!f || f.needsChoice) return false;
        const params = new URLSearchParams(f.data);
        id = params.get("add-to-cart") || params.get("product_id");
        if (!id) return false;
      }
      const ajax = (window.wc_add_to_cart_params?.wc_ajax_url || "/?wc-ajax=%%endpoint%%").replace("%%endpoint%%", "add_to_cart");
      const res = await fetch(ajax, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ product_id: id, quantity: "1" }), credentials: "same-origin" });
      if (!res.ok) throw new Error("wc-ajax HTTP " + res.status);
      const data = await res.json().catch(() => ({}));
      if (data.error) return false;
      for (const [sel, html] of Object.entries(data.fragments || {})) document.querySelectorAll(sel).forEach(el => { el.outerHTML = html; });
      if (window.jQuery) window.jQuery(document.body).trigger("added_to_cart", [data.fragments, data.cart_hash]);
      return true;
    }
    // Magento and custom stores: replay the product page's own form.
    const f = await productForm(url, platform, sel);
    if (!f || f.needsChoice) return false;
    const body = new URLSearchParams(f.data);
    const key = readCookie("form_key");
    if (key && body.has("form_key")) body.set("form_key", key);
    const res = await fetch(f.action, { method: "POST", body, credentials: "same-origin", headers: { "X-Requested-With": "XMLHttpRequest", "Content-Type": "application/x-www-form-urlencoded" } });
    if (!res.ok) throw new Error("cart add HTTP " + res.status);
    const data = await res.json().catch(() => ({}));
    if (data && data.backUrl) return false;  // Magento asks the shopper to finish on the product page
    if (platform === "magento" && typeof window.require === "function") {
      try { window.require(["Magento_Customer/js/customer-data"], cd => cd.reload(["cart", "messages"], true)); } catch {}
      // A minicart fed by the store's own add answer (Idus_Checkout listens on ajaxComplete) needs to see this one too.
      if (data?.checkout_data) try { window.require(["jquery"], $ => $(document).trigger("ajaxComplete", [{ responseJSON: data }, { url: f.action, type: "POST" }])); } catch {}
    } else if (cfg.addToCart?.refresh === "reload") {
      location.reload();
    }
    return true;
  }

  async function addToCartFrom(btn) {
    const card = btn.closest("[data-semantix-ai='1']");
    const url = btn.getAttribute("data-semantix-atc-url") || card?.querySelector("a[href]")?.href || "";
    const pid = btn.getAttribute("data-semantix-atc-id") || card?.getAttribute("data-semantix-pid") || "";
    const open = () => { if (url) location.href = url; };
    if (cfg.addToCart?.mode === "link" || btn.getAttribute("data-semantix-atc-oos") === "true") return open();
    if (btn.disabled || btn.getAttribute("aria-busy") === "true") return;
    const label = btn.innerHTML;
    btn.setAttribute("aria-busy", "true");
    if ("disabled" in btn) btn.disabled = true;
    setButtonText(btn, cfg.addToCart?.addingText || DEFAULTS.addToCart.addingText);
    window.__semantix_atc_context = { pid, name: card?.getAttribute("data-semantix-name") || "", url, at: Date.now() };
    ATC_PRESS = { at: Date.now(), path: productPath(url), inResults: inSearchResults(card), typed: inTypedList(card) }; // this click never reaches the listener that records the press
    const reset = () => { btn.innerHTML = label; btn.removeAttribute("aria-busy"); if ("disabled" in btn) btn.disabled = false; };
    try {
      const added = await platformAddToCart(url, pid, btn.getAttribute("data-semantix-atc-form") || "");
      if (!added) { reset(); return open(); }
      setButtonText(btn, cfg.addToCart?.addedText || DEFAULTS.addToCart.addedText);
      btn.setAttribute("data-semantix-added", "1");
      showCartToast(card?.getAttribute("data-semantix-name") || "");
      setTimeout(reset, 2200);
    } catch (e) {
      console.warn("[Semantix ATC] failed, opening the product page:", e?.message);
      reset();
      open();
    }
  }

  const CART_URLS = { magento: "/checkout/cart/", woocommerce: "/cart/", shopify: "/cart" };
  function showCartToast(name) {
    if (cfg.addToCart?.toast === false) return;
    document.querySelectorAll("[data-semantix-cart-toast]").forEach(n => n.remove());
    const box = document.createElement("div");
    box.setAttribute("data-semantix-cart-toast", "1");
    box.setAttribute("role", "status");
    box.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483000;display:flex;gap:14px;align-items:center;max-width:calc(100vw - 32px);padding:12px 18px;border-radius:12px;background:#16261f;color:#fff;font:inherit;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,.18);direction:rtl";
    const text = document.createElement("span");
    text.textContent = (cfg.addToCart?.toastText || DEFAULTS.addToCart.toastText) + (name ? ": " + name : "");
    text.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
    const link = document.createElement("a");
    link.href = cfg.addToCart?.cartUrl || CART_URLS[detectPlatform()] || "/cart";
    link.textContent = cfg.addToCart?.cartText || DEFAULTS.addToCart.cartText;
    link.style.cssText = "color:#d2e89d;font-weight:600;white-space:nowrap;text-decoration:underline";
    box.append(text, link);
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 4000);
  }

  let ATC_BOUND = false;
  function attachAddToCart() {
    if (ATC_BOUND || !cfg.addToCart?.mode || cfg.addToCart.mode === "off") return;
    ATC_BOUND = true;
    // Themes disable their add-to-cart controls until their own JS has initialised (e.g. Magento keeps
    // body[data-mage-init] → pointer-events:none). Semantix buttons do not depend on that, so they stay usable.
    const st = document.createElement("style");
    st.id = "semantix-atc-style";
    st.textContent = "[data-semantix-atc]{pointer-events:auto!important;cursor:pointer}" +
      "[data-semantix-ai='1'] :has(> [data-semantix-atc]){pointer-events:auto!important;opacity:1!important}";
    document.head.appendChild(st);
    // Reading the product page takes a moment; start when the pointer reaches a Semantix card so the click is instant.
    document.addEventListener("pointerover", e => {
      if (cfg.addToCart?.mode !== "engine" || detectPlatform() === "shopify") return;
      const btn = e.target?.closest?.("[data-semantix-ai='1']")?.querySelector?.("[data-semantix-atc]");
      if (!btn || btn.getAttribute("data-semantix-atc-oos") === "true") return;
      const url = btn.getAttribute("data-semantix-atc-url");
      if (url) productForm(url, detectPlatform()).catch(() => {});
    }, { passive: true });
    // Capture phase: theme handlers bound to similar markup never see clicks on Semantix buttons.
    document.addEventListener("click", e => {
      const btn = e.target?.closest?.("[data-semantix-atc]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      addToCartFrom(btn);
    }, true);
  }

  /* ------------------------ full replace ------------------------ */

  function fullReplaceEnabled() {
    const fresh = window.SemantixSettings?.siteConfig?.features || {};
    return cfg.features?.fullReplace === true && fresh.fullReplace !== false;
  }

  // Removes the loader's pre-paint hide rule. Safe to call any number of times.
  function revealNative() {
    const af = document.getElementById("semantix-antiflicker");
    if (af) { try { af.remove(); } catch {} }
  }

  function asList(v) {
    return (Array.isArray(v) ? v : [v]).filter(s => typeof s === "string" && s.trim());
  }

  // Persistent rules that apply only after a successful replacement.
  function applyReplaceStyles() {
    const hide = asList(cfg.replace?.hide);
    let el = document.getElementById("semantix-replace-style");
    if (!el) {
      el = document.createElement("style");
      el.id = "semantix-replace-style";
      document.head.appendChild(el);
    }
    // The AI badge marks recovered zero-result cards; on a fully replaced page every card is ours, so it is off unless asked for.
    const badge = cfg.replace?.aiBadge === true ? "" : "[data-semantix-replaced=\"1\"]::before{content:none!important;display:none!important}";
    // scope "main": inside the root only the grid's ancestors, the Semantix heading, loader and "load more" stay.
    const ours = ":not([data-semantix-keep]):not([data-semantix-head]):not([data-semantix-bar-loader]):not([data-semantix-load-more])";
    const scope = cfg.replace?.scope === "main"
      ? "[data-semantix-scope]>" + ours + ",[data-semantix-keep]:not([data-semantix-grid])>" + ours + "{display:none!important}"
      : "";
    // A kept column whose siblings (filters sidebar…) are now hidden takes its row's full width — otherwise it keeps the
    // width it had beside them and the grid sits off-centre (RTL: pushed right).
    const fill = cfg.replace?.scope === "main" ? "[data-semantix-fill]{flex:1 1 100%!important;max-width:100%!important;grid-column:1/-1!important}" : "";
    el.textContent = "[data-semantix-native-hidden]{display:none!important}" + badge + scope + fill +
      (hide.length ? hide.join(",") + "{display:none!important}" : "");
  }


  let nativeEmptyObserver = null;
  function releaseNativeEmptyState() {
    nativeEmptyObserver?.disconnect();
    nativeEmptyObserver = null;
    qa('[data-semantix-empty-hidden]').forEach(n => {
      n.removeAttribute('data-semantix-empty-hidden');
      n.removeAttribute('data-semantix-native-hidden');
    });
  }
  // early: the main-scope takeover hides the message while its search is still loading; releaseMain shows it again.
  function hideNativeEmptyState(grid, early = false) {
    nativeEmptyObserver?.disconnect();
    const root = grid.closest('main,[role="main"],#main,#MainContent') || grid.parentElement || grid;
    const selectors = [...asList(cfg.selectors?.noResults), '.no-results', '.search-no-results', '.woocommerce-no-products-found', '.search__no-results', '[data-no-results]'];
    const hide = () => {
      if (!grid.isConnected || (!early && !grid.querySelector('[data-semantix-replaced="1"]'))) return;
      const candidates = new Set();
      for (const selector of selectors) {
        try { root.querySelectorAll(selector).forEach(n => candidates.add(n)); } catch {}
      }
      // Some themes print an unclassified message inside the grid itself.
      grid.querySelectorAll('p,span,div,h2,h3').forEach(n => {
        const text = (n.textContent || '').trim();
        if (text.length < 240 && /^(?:לא נמצאו (?:מוצרים|תוצאות)|אין (?:מוצרים|תוצאות)|no (?:products|results) (?:found|match)|nothing found)/i.test(text)) candidates.add(n);
      });
      for (const node of candidates) {
        // A broad merchant selector may match a grid ancestor or a product's text.
        if (node === grid || node.contains(grid) || node.closest('[data-semantix-replaced],[data-semantix-head],[data-semantix-load-more]') || node.querySelector('[data-semantix-replaced]')) continue;
        node.setAttribute('data-semantix-empty-hidden', '1');
        node.setAttribute('data-semantix-native-hidden', '1');
      }
    };
    hide();
    // Themes may insert the message again while our cards are still present.
    nativeEmptyObserver = new MutationObserver(hide);
    nativeEmptyObserver.observe(root, {childList:true, subtree:true});
  }

  function productKey(p) {
    return String(p?.id ?? p?.product_id ?? p?.productId ?? p?.url ?? p?.name ?? "");
  }

  // Shopify: the store's own card for each result — its labels, colour swatches, price range and quick buy — read in one
  // request from the store's search ("id:1 OR id:2 …", rendered by the results section). A product it does not return
  // gets the template card. nativeCard.storeCards: false turns this off; { timeoutMs } bounds the wait (2.5 s).
  const storeCards = new Map();
  function productHandle(u) {
    try { const m = new URL(u, location.href).pathname.match(/\/products\/([^/?#]+)/); return m ? decodeURIComponent(m[1]) : ""; } catch { return ""; }
  }
  async function loadStoreCards(grid, products) {
    const opt = cfg.nativeCard?.storeCards;
    if (opt === false || detectPlatform() !== "shopify") return;
    const want = products.filter(p => /^\d+$/.test(String(p?.id ?? "")) && !storeCards.has(String(p.id)) && productHandle(p.url || ""));
    if (!want.length) return;
    const section = (grid?.closest(".shopify-section") || q1("main .shopify-section, #main .shopify-section"))?.id?.replace(/^shopify-section-/, "");
    const url = "/search?type=product" + (section ? "&section_id=" + encodeURIComponent(section) : "") +
      "&q=" + encodeURIComponent(want.map(p => "id:" + p.id).join(" OR "));
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), Number(opt?.timeoutMs) > 0 ? Number(opt.timeoutMs) : 2500);
    try {
      const r = await fetch(url, { signal: ctl.signal, credentials: "same-origin" });
      if (!r.ok) return;
      const doc = new DOMParser().parseFromString(await r.text(), "text/html");
      const byHandle = new Map(want.map(p => [productHandle(p.url), String(p.id)]));
      for (const card of doc.querySelectorAll(asList(cfg.selectors?.productCard).join(",") || "product-item")) {
        const id = byHandle.get(productHandle(card.querySelector('a[href*="/products/"]')?.getAttribute("href") || ""));
        if (id && !storeCards.has(id)) storeCards.set(id, card);
      }
      console.log(`[Semantix Replace] Store cards: ${want.filter(p => storeCards.has(String(p.id))).length}/${want.length}`);
    } catch (e) {
      console.warn("[Semantix Replace] Store cards unavailable:", e?.message);
    } finally {
      clearTimeout(timer);
    }
  }

  // Theme scripts bind their card controls once, at page load; a store card inserted later gets them here.
  // nativeCard.storeCards.bind: [{ selector, type, fn (a global function of the theme), capture }].
  const STORE_CARD_BIND = [{ selector: ".grid-product-colors", type: "click", fn: "handleColorPick", capture: true }]; // BOA colour swatches
  function bindStoreCard(card) {
    const list = Array.isArray(cfg.nativeCard?.storeCards?.bind) ? cfg.nativeCard.storeCards.bind : STORE_CARD_BIND;
    for (const b of list) {
      const fn = typeof b?.fn === "string" ? window[b.fn] : null;
      if (typeof fn !== "function" || typeof b.selector !== "string") continue;
      try { qa(b.selector, card).forEach(el => el.addEventListener(b.type || "click", fn, b.capture === true)); } catch {}
    }
  }

  function appendReplacedCards(grid, templateCard, products, seen, before = null) {
    const frag = document.createDocumentFragment();
    let count = 0;
    for (const p of products) {
      const key = productKey(p);
      if (key && seen.has(key)) continue;
      const own = storeCards.get(String(p?.id ?? ""));
      const card = own ? document.importNode(own, true) : cloneAndFillCard(templateCard, p);
      if (!card) continue;
      // The store rendered it: the post-render fixer (links, images, title) must leave it as it is.
      if (own) { card.setAttribute("data-semantix-fixed", "1"); bindStoreCard(card); }
      if (key) seen.add(key);
      card.removeAttribute("data-semantix-native-hidden");
      card.setAttribute("data-semantix-ai", "1");
      card.setAttribute("data-semantix-injected", "1");
      card.setAttribute("data-semantix-replaced", "1");
      frag.appendChild(card);
      count++;
    }
    grid.insertBefore(frag, before);
    return count;
  }

  // Swap the native cards for Semantix results, in Semantix order. Native cards are removed
  // only after at least one Semantix card rendered, so a template failure leaves the page as it was.
  function replaceGrid(grid, baseCard, products) {
    if (!grid || !products.length) return 0;
    const templateCard = getCardTemplate(baseCard);
    if (!templateCard) {
      console.warn("[Semantix Replace] No card template available");
      return 0;
    }
    window.__semantix_injecting = true;
    try {
      qa('[data-semantix-replaced="1"]', grid).forEach(n => n.remove());
      hoistNonCardSiblings(grid, resolveCards(grid));
      const natives = resolveCards(grid);
      const seen = new Set();
      const count = appendReplacedCards(grid, templateCard, products, seen, natives[0] || null);
      if (!count) return 0;
      natives.forEach(n => n.remove());
      hideNativeEmptyState(grid);
      grid._semantixSeen = seen;
      grid._semantixTemplate = templateCard;
      console.log(`[Semantix Replace] ✅ Rendered ${count} cards, removed ${natives.length} native cards`);
      return count;
    } finally {
      window.__semantix_injecting = false;
    }
  }

  function nextPage(pagination) {
    if (!pagination || pagination.hasMore === false) return null;
    if (pagination.secondBatchToken) return "/search/auto-load-more?token=" + encodeURIComponent(pagination.secondBatchToken);
    if (pagination.nextToken) return "/search/load-more?token=" + encodeURIComponent(pagination.nextToken);
    return null;
  }

  function attachLoadMore(grid, pagination) {
    document.querySelectorAll("[data-semantix-load-more]").forEach(n => n.remove());
    if (cfg.replace?.loadMore === false) return;
    let path = nextPage(pagination);
    if (!path) return;
    const wrap = document.createElement("div");
    wrap.setAttribute("data-semantix-load-more", "1");
    wrap.style.cssText = "display:flex;justify-content:center;margin:24px 0;width:100%";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = cfg.replace?.loadMoreClass || "";
    btn.textContent = cfg.replace?.loadMoreText || DEFAULTS.replace.loadMoreText;
    if (!btn.className) btn.style.cssText = "padding:12px 28px;border:1px solid currentColor;background:transparent;border-radius:6px;cursor:pointer;font:inherit";
    wrap.appendChild(btn);
    grid.insertAdjacentElement("afterend", wrap);
    // replace.autoLoadMore: the next page loads when the shopper nears the end of the grid; the button stays as
    // the fallback after a failed request.
    if (cfg.replace?.autoLoadMore === true) {
      let waiting = false;
      const near = () => {
        waiting = false;
        if (!wrap.isConnected) { window.removeEventListener("scroll", onScroll, true); return; }
        if (!btn.disabled && wrap.getBoundingClientRect().top - window.innerHeight < (Number(cfg.replace?.loadMoreOffset) || 700)) btn.click();
      };
      const onScroll = () => { if (!waiting) { waiting = true; setTimeout(near, 120); } };
      window.addEventListener("scroll", onScroll, { passive: true, capture: true });
      btn.textContent = cfg.replace?.loadingMoreText || "טוען עוד…";
      setTimeout(near, 600);
    }
    btn.addEventListener("click", async () => {
      if (!path || btn.disabled) return;
      btn.disabled = true;
      try {
        const r = await fetch(S.apiBase + path, { headers: headers() });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const data = await r.json();
        const more = Array.isArray(data?.products) ? data.products : [];
        await loadStoreCards(grid, more);
        window.__semantix_injecting = true;
        try {
          appendReplacedCards(grid, grid._semantixTemplate, more, grid._semantixSeen || new Set());
        } finally {
          window.__semantix_injecting = false;
        }
        path = nextPage(data?.pagination);
        if (!path || !more.length) wrap.remove();
        // Still in view after the new cards (a short page): the observer will not fire again by itself.
        else if (cfg.replace?.autoLoadMore === true) setTimeout(() => { if (wrap.isConnected && !btn.disabled && wrap.getBoundingClientRect().top - window.innerHeight < (Number(cfg.replace?.loadMoreOffset) || 700)) btn.click(); }, 400);
      } catch (e) {
        console.warn("[Semantix Replace] load more failed:", e?.message);
      } finally {
        btn.disabled = false;
      }
    });
  }

  // Loading bar centred in the results area. It sits just before the grid (the grid itself is empty while the native
  // cards are hidden) and keeps the area's height so the page does not jump when results arrive.
  function showBarLoader(grid) {
    const l = { ...DEFAULTS.replace.loader, ...(cfg.replace?.loader || {}) };
    if (!document.getElementById("semantix-bar-loader-style")) {
      const st = document.createElement("style");
      st.id = "semantix-bar-loader-style";
      st.textContent = `
        [data-semantix-bar-loader]{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;width:100%;box-sizing:border-box;padding:24px 16px;transition:opacity .18s ease}
        [data-semantix-bar-loader].out{opacity:0}
        [data-semantix-bar-loader] .sx-track{position:relative;width:min(320px,60%);height:4px;border-radius:999px;background:color-mix(in srgb,var(--sx-color) 14%,transparent);overflow:hidden}
        [data-semantix-bar-loader] .sx-fill{position:absolute;inset:0 auto 0 0;width:40%;border-radius:inherit;background:var(--sx-color);animation:sx-slide 1.1s ease-in-out infinite}
        [data-semantix-bar-loader] .sx-text{font:inherit;font-size:14px;color:var(--sx-color);opacity:.8}
        @keyframes sx-slide{0%{transform:translateX(-110%)}100%{transform:translateX(260%)}}
        @media (prefers-reduced-motion:reduce){[data-semantix-bar-loader] .sx-fill{animation:none;width:100%;opacity:.5}}`;
      document.head.appendChild(st);
    }
    const el = document.createElement("div");
    el.setAttribute("data-semantix-bar-loader", "1");
    el.setAttribute("role", "status");
    el.style.setProperty("--sx-color", /^#[0-9a-f]{3,8}$/i.test(l.color || "") ? l.color : DEFAULTS.replace.loader.color);
    el.style.minHeight = (Number(l.minHeight) > 0 ? Number(l.minHeight) : 280) + "px";
    const track = document.createElement("div"); track.className = "sx-track";
    const fill = document.createElement("div"); fill.className = "sx-fill"; track.appendChild(fill);
    el.appendChild(track);
    if (l.text) { const t = document.createElement("div"); t.className = "sx-text"; t.textContent = l.text; el.appendChild(t); }
    grid.parentElement ? grid.parentElement.insertBefore(el, grid) : grid.prepend(el);
    return [el];
  }

  function showReplaceLoader(grid, baseCard) {
    const type = cfg.replace?.loader?.type || DEFAULTS.replace.loader.type;
    if (type === "none") return null;
    if (type === "skeleton") return showSkeletonLoader(grid, baseCard);
    return showBarLoader(grid);
  }

  // Results page with native results → Semantix results in the native grid.
  // Returns true when Semantix owns the grid; false leaves the native results visible.
  async function runFullReplace(q, grid, cards) {
    const skeletons = showReplaceLoader(grid, cards[0]);
    cards.forEach(c => c.setAttribute("data-semantix-native-hidden", "1"));
    applyReplaceStyles();
    revealNative();
    const sid = getConsentState() === "granted" ? ensureVisitorId() : undefined;
    const t0 = Date.now();
    let ok = false;
    try {
      const payload = { query: q, modern: true, ...(sid ? { session_id: sid } : {}), ...searchPayloadFields(q) };
      if (cfg.replace?.limit > 0) payload.limit = cfg.replace.limit;
      const data = await apiPost(S.endpoints.search, payload);
      const products = Array.isArray(data?.products) ? data.products : [];
      LAST_SEARCH_RESULTS = products.map(p => p?.name || p?.title).filter(Boolean);
      LAST_SEARCH_METADATA = data?.searchMetadata || data?.search_metadata || null;
      console.log("[Semantix Replace] 📦 Received", products.length, "products");
      const fresh = await waitForGridOrNoResults(1000);
      const target = fresh.grid || grid;
      await loadStoreCards(target, products);
      const count = replaceGrid(target, (fresh.cards[0] || cards[0]), products);
      if (count) {
        ok = true;
        attachLoadMore(target, data?.pagination);
        attachRerenderGuard(target, cards[0], products, replaceGrid);
        setupCardFixObserver();
        fixInjectedCards();
      }
    } catch (e) {
      console.warn("[Semantix Replace] Error:", e?.message);
    } finally {
      if (!ok) {
        // Give the page back exactly as the store rendered it.
        qa("[data-semantix-native-hidden]").forEach(c => c.removeAttribute("data-semantix-native-hidden"));
        const st = document.getElementById("semantix-replace-style");
        if (st) st.remove();
      }
      const minMs = cfg.behavior.loaderMinMs || 250;
      setTimeout(() => hideSkeletonLoader(skeletons), Math.max(0, minMs - (Date.now() - t0)));
    }
    return ok;
  }

  /* ------------------------ full replace: the whole results area ------------------------ */

  function mainScopeEnabled() {
    return fullReplaceEnabled() && cfg.replace?.scope === "main";
  }

  function onResultsPath() {
    const sp = cfg.replace?.searchPath;
    if (!sp) return false;
    try { return new RegExp(sp).test(location.pathname); } catch { return false; }
  }

  function takeoverRoot() {
    return one([...asList(cfg.replace?.root), "main", "[role='main']", "#main", "#MainContent"]);
  }

  function fillText(tpl, vars) {
    return String(tpl || "").replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  }

  // The grid for a page that has no native one (no native results): replace.shell is walked from the root down,
  // reusing the elements the page already has and creating the missing levels.
  function buildShellGrid(root) {
    const shell = Array.isArray(cfg.replace?.shell) ? cfg.replace.shell : [];
    let parent = root;
    for (const step of shell) {
      const tag = String(step?.tag || "div").toLowerCase();
      const cls = asList(step?.cls);
      let el = Array.from(parent.children).find(c =>
        c.tagName.toLowerCase() === tag && cls.every(k => c.classList.contains(k)) && !c.hasAttribute("data-semantix-head"));
      if (!el) {
        // A missing level is a plain element with the same classes: a theme's custom element would start its own script.
        el = document.createElement(tag.includes("-") ? "div" : tag);
        if (cls.length) el.className = cls.join(" ");
        el.setAttribute("data-semantix-shell", "1");
        parent.appendChild(el);
      }
      parent = el;
    }
    return parent === root ? null : parent;
  }

  function mainHead(root, q) {
    qa("[data-semantix-head]").forEach(n => n.remove());
    const r = cfg.replace || {};
    const head = document.createElement("div");
    head.setAttribute("data-semantix-head", "1");
    head.style.cssText = "box-sizing:border-box;width:100%;padding:32px 16px 20px;text-align:center";
    const h = document.createElement("h1");
    h.className = r.titleClass || "";
    h.style.margin = "0";
    h.textContent = fillText(r.title || DEFAULTS.replace.title, { q });
    const count = document.createElement("p");
    count.setAttribute("data-semantix-count", "1");
    count.style.cssText = "margin:8px 0 0;font-size:14px;opacity:.7;min-height:1.4em";
    head.append(h, count);
    root.insertBefore(head, root.firstChild);
    return head;
  }

  // Gives the page back exactly as the store rendered it.
  function releaseMain() {
    releaseNativeEmptyState();
    qa("[data-semantix-head],[data-semantix-shell],[data-semantix-load-more],[data-semantix-bar-loader]").forEach(n => n.remove());
    for (const a of ["data-semantix-scope", "data-semantix-keep", "data-semantix-grid", "data-semantix-native-hidden", "data-semantix-fill"]) {
      qa("[" + a + "]").forEach(n => n.removeAttribute(a));
    }
    const st = document.getElementById("semantix-replace-style");
    if (st) st.remove();
  }

  // Results page, with or without native results → Semantix owns the area between header and footer.
  // null: could not start (nothing was touched). true: Semantix owns the page. false: the page was given back.
  async function runMainTakeover(q, found) {
    const root = takeoverRoot();
    if (!root) return null;
    const grid = (found.grid && root.contains(found.grid)) ? found.grid : buildShellGrid(root);
    if (!grid) return null;
    const natives = resolveCards(grid);
    root.setAttribute("data-semantix-scope", "1");
    grid.setAttribute("data-semantix-grid", "1");
    for (let n = grid; n && n !== root; n = n.parentElement) n.setAttribute("data-semantix-keep", "1");
      for (let n = grid.parentElement; n && n !== root; n = n.parentElement) {
        const d = n.parentElement && getComputedStyle(n.parentElement).display;
        if (/flex|grid/.test(d || "")) n.setAttribute("data-semantix-fill", "1");
      }
    natives.forEach(c => c.setAttribute("data-semantix-native-hidden", "1"));
    const head = mainHead(root, q);
    applyReplaceStyles();
    hideNativeEmptyState(grid, true);
    revealNative();
    const type = cfg.replace?.loader?.type || DEFAULTS.replace.loader.type;
    const loaderEls = type === "none" ? null : (type === "skeleton" && natives[0]) ? showSkeletonLoader(grid, natives[0]) : showBarLoader(grid);
    const sid = getConsentState() === "granted" ? ensureVisitorId() : undefined;
    const t0 = Date.now();
    let ok = false;
    try {
      const payload = { query: q, modern: true, ...(sid ? { session_id: sid } : {}), ...searchPayloadFields(q) };
      if (cfg.replace?.limit > 0) payload.limit = cfg.replace.limit;
      const data = await apiPost(S.endpoints.search, payload);
      const products = Array.isArray(data?.products) ? data.products : [];
      LAST_SEARCH_RESULTS = products.map(p => p?.name || p?.title).filter(Boolean);
      LAST_SEARCH_METADATA = data?.searchMetadata || data?.search_metadata || null;
      console.log("[Semantix Replace] 📦 Received", products.length, "products (main scope)");
      if (!natives.length) trackZeroSearch(q, products.length);
      if (products.length) await loadStoreCards(grid, products);
      const count = products.length ? replaceGrid(grid, natives[0] || null, products) : 0;
      if (count) {
        ok = true;
        const total = Number(data?.pagination?.totalAvailable ?? data?.total);
        const line = head.querySelector("[data-semantix-count]");
        if (line && Number.isFinite(total) && total > 0) line.textContent = fillText(cfg.replace?.countText || DEFAULTS.replace.countText, { n: total.toLocaleString("he-IL") });
        attachLoadMore(grid, data?.pagination);
        attachRerenderGuard(grid, natives[0] || null, products, replaceGrid);
        setupCardFixObserver();
        fixInjectedCards();
      }
    } catch (e) {
      console.warn("[Semantix Replace] Error:", e?.message);
    } finally {
      const minMs = ok ? (cfg.behavior.loaderMinMs || 250) : 0;
      setTimeout(() => hideSkeletonLoader(loaderEls), Math.max(0, minMs - (Date.now() - t0)));
      if (!ok) releaseMain();
    }
    return ok;
  }

  /* ------------------------ app-store takeover (Vue / Vuex storefronts) ------------------------ */

  // Storefronts that draw their results from an in-page store instead of server HTML (replace.scope "store").
  // Semantix decides which products and in what order; the shop's own components draw them, so the cart,
  // quantities, unit choices and product popups stay exactly the shop's. Configuration (replace.store):
  //   commit        mutation that receives the list of result products
  //   product       { url: "/…{id}…", method: "GET"|"POST", path?: "key" } — the shop's own product object by id
  //   root?         selector(s) of an element that carries the app (default: found automatically)
  //   cartMutation? mutation committed when the cart changes; cartProduct?: key of the product in its payload
  //   idAttr?       attribute on a native card holding the product id (default "data-product-id")
  //   stockKey?     boolean key of the shop's product object that says it can be bought now
  //   unavailable?  { key, value } — the shop's own mark for a product it does not sell right now when that is not
  //                 the stock flag (e.g. a catalog visibility of "hidden")
  //   outOfStock?   what to do with such products: "last" (default — after the available ones) or "hide"
  function storeConfig() {
    const s = cfg.replace?.store;
    return s && typeof s === "object" && typeof s.commit === "string" && s.product && typeof s.product.url === "string" ? s : null;
  }

  function storeScopeEnabled() {
    return fullReplaceEnabled() && cfg.replace?.scope === "store" && !!storeConfig();
  }

  let APP_STORE = null;
  function appStore() {
    if (APP_STORE) return APP_STORE;
    const ok = s => s && typeof s.commit === "function" && typeof s.subscribe === "function";
    for (const sel of asList(cfg.replace?.store?.root)) {
      const el = q1(sel);
      const s = el?.__vue__?.$store || el?.__vue_app__?.config?.globalProperties?.$store;
      if (ok(s)) return (APP_STORE = s);
    }
    if (!document.body) return null;
    for (const el of document.body.querySelectorAll("*")) {
      const s = el.__vue__?.$store || el.__vue_app__?.config?.globalProperties?.$store;
      if (ok(s)) return (APP_STORE = s);
    }
    return null;
  }

  async function waitForAppStore(timeoutMs) {
    const until = Date.now() + timeoutMs;
    for (;;) {
      const s = appStore();
      if (s || Date.now() > until) return s;
      await new Promise(r => setTimeout(r, 120));
    }
  }

  // The shop's own product object, read from the shop (same origin only) and kept for the page's lifetime.
  const STORE_PRODUCTS = new Map();
  function storeProduct(id) {
    const key = String(id ?? "").split(":").pop();
    if (!key) return Promise.resolve(null);
    if (!STORE_PRODUCTS.has(key)) {
      const spec = storeConfig().product;
      let url;
      try { url = new URL(fillText(spec.url, { id: encodeURIComponent(key) }), location.href); } catch { return Promise.resolve(null); }
      if (url.origin !== location.origin) return Promise.resolve(null);
      const p = fetch(url.href, { method: spec.method === "POST" ? "POST" : "GET", credentials: "same-origin", headers: { Accept: "application/json" } })
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          const obj = spec.path ? d?.[spec.path] : d;
          return obj && typeof obj === "object" && !Array.isArray(obj) && String(obj.id ?? "") === key ? obj : null;
        })
        .catch(() => null);
      STORE_PRODUCTS.set(key, p);
      p.then(v => { if (!v) STORE_PRODUCTS.delete(key); });
    }
    return STORE_PRODUCTS.get(key);
  }

  // The shop's object is today's truth about availability, newer than the search index.
  function storeAvailable(x) {
    const sc = storeConfig();
    if (sc.stockKey && x[sc.stockKey] === false) return false;
    const u = sc.unavailable;
    if (u && typeof u.key === "string" && x[u.key] === u.value) return false;
    return true;
  }
  function storeArrange(items) {
    const sc = storeConfig();
    if (!sc.stockKey && !sc.unavailable) return items;
    const yes = items.filter(storeAvailable);
    return sc.outOfStock === "hide" ? yes : yes.concat(items.filter(x => !storeAvailable(x)));
  }

  // What Semantix put in the store: { q, items, ids }. While the shopper stays on that query the list is ours.
  let STORE_OWN = null, STORE_COMMITTING = false, STORE_BOUND = false;
  function commitStoreResults(st) {
    STORE_COMMITTING = true;
    try { st.commit(storeConfig().commit, STORE_OWN.items); } finally { STORE_COMMITTING = false; }
  }

  // While Semantix is answering: the grid is dimmed, and the shop's "nothing found" screen (selectors.noResults) is
  // replaced by a loader — it would be a wrong answer for a search whose results are still on their way.
  let STORE_WAIT_TIMER = null;
  function storeDim(on) {
    let el = document.getElementById("semantix-store-wait");
    if (!on) {
      if (el) el.remove();
      clearInterval(STORE_WAIT_TIMER);
      qa("[data-semantix-store-loader]").forEach(n => n.remove());
      return;
    }
    if (el) return;
    const grid = asList(cfg.selectors?.resultsGrid), none = asList(cfg.selectors?.noResults);
    if (!grid.length && !none.length) return;
    el = document.createElement("style");
    el.id = "semantix-store-wait";
    el.textContent = (grid.length ? grid.join(",") + "{opacity:.3!important;pointer-events:none!important;transition:opacity .15s}" : "") +
      (none.length ? none.join(",") + "{display:none!important}" : "") +
      "[data-semantix-store-loader]{display:flex;flex-direction:column;align-items:center;gap:14px;padding:64px 16px;text-align:center;font-size:18px}" +
      "[data-semantix-store-loader][hidden]{display:none}" +
      "[data-semantix-store-loader] i{width:38px;height:38px;border-radius:50%;border:3px solid rgba(128,128,128,.25);border-top-color:currentColor;animation:semantix-store-spin .8s linear infinite}" +
      "@keyframes semantix-store-spin{to{transform:rotate(360deg)}}";
    document.head.appendChild(el);
    if (none.length) {
      // The loader stands where the "nothing found" screen is, and only while the grid has no products to show.
      const place = () => {
        const target = one(none);
        let loader = q1("[data-semantix-store-loader]");
        if (!target || !target.parentElement) { if (loader) loader.hidden = true; return; }
        if (!loader) {
          loader = document.createElement("div");
          loader.setAttribute("data-semantix-store-loader", "1");
          loader.setAttribute("role", "status");
          const text = document.createElement("span");
          text.textContent = cfg.replace?.loadingText || "טוען תוצאות…";
          loader.append(document.createElement("i"), text);
        }
        if (loader.parentElement !== target.parentElement) target.parentElement.insertBefore(loader, target);
        const g = one(grid);
        loader.hidden = !!(g && g.getClientRects().length && resolveCards(g).length);
      };
      place();
      clearInterval(STORE_WAIT_TIMER);
      STORE_WAIT_TIMER = setInterval(place, 150);
    }
    setTimeout(() => storeDim(false), 12000);
  }

  // Cart changes and card clicks, for both groups of a rollout (the native group is tracked in shadow mode).
  function attachStoreTracking() {
    const sc = storeConfig();
    if (STORE_BOUND || !sc || cfg.replace?.scope !== "store") return;
    STORE_BOUND = true;
    const quantities = new Map(), clicked = new Set();
    waitForAppStore(cfg.behavior.waitForDomMs || 8000).then(st => {
      if (!st) return;
      st.subscribe(m => {
        try {
          if (m.type === sc.commit && !STORE_COMMITTING && STORE_OWN && getQuery() === STORE_OWN.q && m.payload !== STORE_OWN.items) {
            // The shop's own search answered after ours; the page stays on the Semantix list.
            setTimeout(() => { if (STORE_OWN && getQuery() === STORE_OWN.q) commitStoreResults(st); }, 0);
            return;
          }
          if (!sc.cartMutation || m.type !== sc.cartMutation) return;
          const p = sc.cartProduct === "" ? m.payload : m.payload?.[sc.cartProduct || "product"];
          if (!p || p.id == null || m.payload?.onPageLoad) return;
          const id = String(p.id), now = Number(p.quantity) || 0, before = quantities.has(id) ? quantities.get(id) : 0;
          quantities.set(id, now);
          if (now <= before) return;
          const q = getQuery() || ssGet("semantix_last_query", "") || null;
          const ours = !!(STORE_OWN && STORE_OWN.ids.has(id) && getQuery() === STORE_OWN.q);
          sendSearchToCart({
            event_type: "add_to_cart",
            search_query: q,
            product_id: id,
            product_name: p.name || p.title || null,
            product_url: location.href,
            quantity: now - before,
            source: ours ? "semantix-store" : "store",
            is_ai: ours,
            platform: detectPlatform(),
            session_id: ensureVisitorId(),
            query_mode: q ? (ours ? "replace" : "enrichment") : "browse",
            search_results: LAST_SEARCH_RESULTS || null,
            searchMetadata: LAST_SEARCH_METADATA || null,
            ...abTestPayloadFields()
          });
        } catch {}
      });
    });
    const attr = sc.idAttr || "data-product-id";
    document.addEventListener("click", e => {
      try {
        if (!STORE_OWN || getQuery() !== STORE_OWN.q) return;
        const card = e.target?.closest?.("[" + attr + "]");
        const id = card?.getAttribute(attr);
        if (!id || !STORE_OWN.ids.has(id) || clicked.has(STORE_OWN.q + "|" + id)) return;
        clicked.add(STORE_OWN.q + "|" + id);
        const item = STORE_OWN.items.find(x => String(x.id) === id);
        sendClick({
          event_id: "clk-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
          product_id: id,
          product_name: item?.name || item?.title || null,
          search_query: STORE_OWN.q,
          interaction_type: "click",
          timestamp: new Date().toISOString(),
          product_url: location.href,
          source: "semantix-store",
          is_ai: true,
          platform: detectPlatform(),
          session_id: ensureVisitorId(),
          query_mode: "replace",
          ...abTestPayloadFields()
        }, true);
      } catch {}
    }, true);
  }

  // More results as the shopper nears the end of the grid (replace.loadMore false turns it off). The next page is
  // read from Semantix, its products from the shop, and the longer list is committed to the store again.
  let STORE_MORE_BUSY = false, STORE_SCROLL_BOUND = false;
  function storeMoreLoader(on) {
    qa("[data-semantix-store-more]").forEach(n => n.remove());
    const grid = one(asList(cfg.selectors?.resultsGrid));
    if (!on || !grid) return;
    const el = document.createElement("div");
    el.setAttribute("data-semantix-store-more", "1");
    el.setAttribute("role", "status");
    el.style.cssText = "display:flex;justify-content:center;align-items:center;gap:10px;width:100%;padding:24px 0;clear:both;font-size:15px;opacity:.75";
    const spin = document.createElement("i");
    spin.style.cssText = "width:22px;height:22px;border-radius:50%;border:2px solid rgba(128,128,128,.3);border-top-color:currentColor";
    try { spin.animate([{ transform: "rotate(0)" }, { transform: "rotate(360deg)" }], { duration: 800, iterations: Infinity }); } catch {}
    const text = document.createElement("span");
    text.textContent = cfg.replace?.loadingMoreText || "טוען עוד…";
    el.append(spin, text);
    grid.insertAdjacentElement("afterend", el);
  }
  async function storeLoadMore() {
    const own = STORE_OWN, st = appStore();
    if (STORE_MORE_BUSY || !own || !own.next || !st) return;
    STORE_MORE_BUSY = true;
    storeMoreLoader(true);
    try {
      const r = await fetch(S.apiBase + own.next, { headers: headers() });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const data = await r.json();
      const products = Array.isArray(data?.products) ? data.products : [];
      const fresh = storeArrange((await Promise.all(products.map(p => storeProduct(p?.id)))).filter(x => x && !own.ids.has(String(x.id))));
      if (STORE_OWN !== own || getQuery() !== own.q) return;
      own.next = products.length ? nextPage(data?.pagination) : null;
      const max = Number(cfg.replace?.maxItems) || 240;
      if (fresh.length) {
        own.items = own.items.concat(fresh).slice(0, max);
        own.ids = new Set(own.items.map(x => String(x.id)));
        LAST_SEARCH_RESULTS = (LAST_SEARCH_RESULTS || []).concat(products.map(p => p?.name || p?.title).filter(Boolean));
        commitStoreResults(st);
      }
      if (own.items.length >= max) own.next = null;
    } catch (e) {
      console.warn("[Semantix Store] load more failed:", e?.message);
      own.next = null;
    } finally {
      STORE_MORE_BUSY = false;
      storeMoreLoader(false);
      // A page that added nothing visible (already shown, or gone from the shop) must not end the scrolling.
      if (STORE_OWN === own && own.next) setTimeout(storeScrollCheck, 300);
    }
  }
  function storeScrollCheck() {
    if (STORE_MORE_BUSY || !STORE_OWN || !STORE_OWN.next || cfg.replace?.loadMore === false || getQuery() !== STORE_OWN.q) return;
    const grid = one(asList(cfg.selectors?.resultsGrid));
    if (!grid || !grid.getClientRects().length) return;
    // The last card marks the end of the list: a grid of floated cards has no height of its own.
    const cards = resolveCards(grid), last = cards[cards.length - 1] || grid;
    if (last.getBoundingClientRect().bottom - window.innerHeight < (Number(cfg.replace?.loadMoreOffset) || 700)) storeLoadMore();
  }
  function attachStoreScroll() {
    if (STORE_SCROLL_BOUND) return;
    STORE_SCROLL_BOUND = true;
    let tick = false;
    const onScroll = () => { if (tick) return; tick = true; requestAnimationFrame(() => { tick = false; storeScrollCheck(); }); };
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onScroll, { passive: true });
  }

  // true: the store shows the Semantix list. false: the shop's own results stay. null: no store on this page.
  async function runStoreTakeover(q) {
    const st = await waitForAppStore(cfg.behavior.waitForDomMs || 8000);
    // Suggestions shown in the grid while the shopper types (autocomplete.display "store") are already in hand.
    if (st && STORE_OWN && STORE_OWN.typed && STORE_OWN.q === q) {
      commitStoreResults(st);
      storeDim(false);
      revealNative();
      return true;
    }
    STORE_OWN = null;
    if (!st) return null;
    storeDim(true);
    let ok = false;
    try {
      const sid = getConsentState() === "granted" ? ensureVisitorId() : undefined;
      const payload = { query: q, modern: true, ...(sid ? { session_id: sid } : {}), ...searchPayloadFields(q) };
      if (cfg.replace?.limit > 0) payload.limit = cfg.replace.limit;
      const data = await apiPost(S.endpoints.search, payload);
      const products = Array.isArray(data?.products) ? data.products : [];
      LAST_SEARCH_RESULTS = products.map(p => p?.name || p?.title).filter(Boolean);
      LAST_SEARCH_METADATA = data?.searchMetadata || data?.search_metadata || null;
      const max = cfg.replace?.limit > 0 ? cfg.replace.limit : 24;
      let items = storeArrange((await Promise.all(products.slice(0, max).map(p => storeProduct(p?.id)))).filter(Boolean));
      // A first page that mostly went to unavailable products is topped up from the following pages.
      let next = nextPage(data?.pagination);
      for (let extra = 0; extra < 3 && next && items.length < Math.min(8, max) && getQuery() === q; extra++) {
        const r = await fetch(S.apiBase + next, { headers: headers() });
        if (!r.ok) break;
        const more = await r.json();
        const list = Array.isArray(more?.products) ? more.products : [];
        if (!list.length) { next = null; break; }
        const seen = new Set(items.map(x => String(x.id)));
        items = items.concat(storeArrange((await Promise.all(list.map(p => storeProduct(p?.id)))).filter(x => x && !seen.has(String(x.id)))));
        next = nextPage(more?.pagination);
      }
      console.log("[Semantix Store] 📦", products.length, "products from Semantix,", items.length, "found in the shop");
      if (items.length && getQuery() === q) {
        STORE_OWN = { q, items, ids: new Set(items.map(x => String(x.id))), next };
        commitStoreResults(st);
        ok = true;
        attachStoreScroll();
        setTimeout(storeScrollCheck, 400);
      }
    } catch (e) {
      console.warn("[Semantix Store] Error:", e?.message);
    } finally {
      storeDim(false);
      revealNative();
    }
    return ok;
  }

  /* ------------------------ autocomplete takeover ------------------------ */

  // autocomplete.resultsShell {path, param, native}: Enter opens a light page of the store (path, e.g. its home page)
  // with the words in ?param=, so the store's own results page — and the store's search behind it — is never
  // requested. That page shows a loader and then the full Semantix results in place of its content.
  function resultsShell() {
    const sh = cfg.autocomplete?.resultsShell;
    if (!sh || typeof sh !== "object" || !sh.param) return null;
    let q = "";
    try { q = (new URLSearchParams(location.search).get(sh.param) || "").trim(); } catch {}
    const path = sh.path || "/";
    return { path, param: sh.param, native: sh.native || "/catalogsearch/result/", q, here: !!q && location.pathname === path };
  }
  function shellHref(q) { const sh = resultsShell(); return sh.path + "?" + encodeURIComponent(sh.param) + "=" + encodeURIComponent(q); }
  function nativeResultsUrl(q) {
    const u = new URL(resultsShell()?.native || "/catalogsearch/result/", location.href);
    u.searchParams.set(cfg.queryParams?.[0] || "q", q);
    return u.pathname + u.search;
  }

  function autocompleteEnabled() {
    const fresh = window.SemantixSettings?.siteConfig?.features || {};
    if (cfg.features?.disabled === true || fresh.disabled === true) return false;
    if (cfg.features?.shadowMode === true || fresh.shadowMode === true) return false;
    return cfg.features?.autocomplete === true && fresh.autocomplete !== false;
  }

  // The store's suggestion component is hidden (autocomplete.hide) and never hears the field, and Semantix
  // suggestions open under the field: inside autocomplete.mount when the search lives in a drawer or modal,
  // otherwise as a panel anchored to the field.
  function attachAutocomplete() {
    if (window.__semantix_autocomplete || !autocompleteEnabled() || !isCurrentDomainAllowed()) return;
    window.__semantix_autocomplete = true;

    const ac = { ...DEFAULTS.autocomplete, ...(cfg.autocomplete || {}) };
    const inputSel = [...asList(ac.input), ...asList(cfg.selectors?.searchInput)].join(",") ||
      "input[type='search'], form[action*='search'] input[name='q'], form[action*='search'] input[name='s']";
    const isField = t => { try { return t instanceof HTMLInputElement && t.matches(inputSel); } catch { return false; } };
    const endpoint = S.endpoints?.autocomplete || "/autocomplete";
    const hide = asList(ac.hide);
    const z = Number(ac.zIndex) > 0 ? Number(ac.zIndex) : DEFAULTS.autocomplete.zIndex;

    const st = document.createElement("style");
    st.id = "semantix-ac-style";
    // behavior.fallbackMs: suggestions that fail or do not arrive in time give the store's own suggestions back for the
    // rest of this page view (they were only hidden, never stopped).
    let fallen = false;
    const fb = Number(cfg.behavior?.fallbackMs) || 0;
    function giveBack(why) {
      if (fallen) return;
      fallen = true;
      console.warn("[Semantix Autocomplete] the store's own suggestions are back:", why);
      if (hide.length) st.textContent = st.textContent.replace(hide.join(",") + "{display:none!important}", "");
      seq++; clearTimeout(timer);
      try { close(); } catch {}
      try { if (TYPED) typedRelease(true); } catch {}
    }
    // The request for one set of letters: aborted when newer letters come or (fallbackMs) when the answer is late.
    function suggestFetch(url) {
      try { ctrl?.abort(); } catch {}
      const mine = ctrl = window.AbortController ? new AbortController() : null;
      let late = false;
      const t = fb > 0 && mine ? setTimeout(() => { late = true; mine.abort(); }, fb) : 0;
      return fetch(url, { headers: headers(), signal: mine?.signal })
        .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .catch(e => { if (late) giveBack("no answer within " + fb + " ms"); else if (fb > 0 && e?.name !== "AbortError") giveBack(e?.message); throw e; })
        .finally(() => clearTimeout(t));
    }
    st.textContent = (hide.length ? hide.join(",") + "{display:none!important}" : "") + `
      [data-semantix-ac]{box-sizing:border-box;font:inherit;color:inherit;text-align:start;line-height:1.4}
      [data-semantix-ac] *{box-sizing:border-box}
      [data-semantix-ac][hidden]{display:none!important}
      [data-semantix-ac].sx-float{position:fixed;z-index:${z};background:#fff;color:#1c1c1c;border:1px solid rgba(0,0,0,.12);border-radius:10px;box-shadow:0 14px 36px rgba(0,0,0,.16);max-height:min(72vh,600px);overflow:auto;padding:6px}
      [data-semantix-ac].sx-inline{width:100%;padding:8px 0 16px}
      [data-semantix-ac] .sx-ac-title{font-size:12px;opacity:.6;padding:12px 12px 6px}
      [data-semantix-ac] .sx-ac-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 6px}
      [data-semantix-ac] .sx-ac-chip{display:inline-block;border:1px solid rgba(128,128,128,.35);border-radius:999px;padding:5px 12px;font-size:13px;text-decoration:none;color:inherit;background:transparent}
      [data-semantix-ac] .sx-ac-item{display:flex;align-items:center;gap:12px;padding:8px 12px;border-radius:8px;text-decoration:none;color:inherit}
      [data-semantix-ac] .sx-ac-item:hover,[data-semantix-ac] .sx-active{background:rgba(128,128,128,.14)}
      [data-semantix-ac] .sx-ac-item img{width:56px;height:56px;flex:none;object-fit:cover;border-radius:6px;background:rgba(128,128,128,.12)}
      [data-semantix-ac] .sx-ac-name{flex:1;min-width:0;font-size:14px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      [data-semantix-ac] .sx-ac-price{flex:none;font-size:14px;font-weight:600;white-space:nowrap}
      [data-semantix-ac] .sx-ac-all{display:block;margin-top:6px;padding:12px;border-top:1px solid rgba(128,128,128,.25);text-align:center;font-size:14px;font-weight:600;text-decoration:none;color:inherit}
      [data-semantix-ac] .sx-ac-note{padding:16px 12px;font-size:14px;opacity:.7;text-align:center}`;
    document.head.appendChild(st);

    let panel = null, field = null, active = -1, seq = 0, timer = null, ctrl = null, shownFor = "", quietUntil = 0;
    const cache = new Map();

    // Shopify's CDN resizes on request; the full-size product image is not needed for a 56px thumbnail.
    const thumb = u => { try { const x = new URL(u); if (/(^|\.)cdn\.shopify\.com$/.test(x.hostname) && !x.searchParams.has("width")) x.searchParams.set("width", "160"); return x.href; } catch { return u; } };
    const safeHref = u => { try { const x = new URL(u, location.href); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };

    // The results page for a query, built from the field's own form so the theme's parameters come along.
    function resultsUrl(input, q) {
      const form = input.form;
      let u;
      try { u = new URL(form?.getAttribute("action") || ac.resultsPath || "/search", location.href); } catch { u = new URL("/search", location.href); }
      if (form) {
        try { new FormData(form).forEach((v, k) => { if (typeof v === "string" && k !== input.name) u.searchParams.set(k, v); }); } catch {}
      }
      u.searchParams.set(input.name || cfg.queryParams?.[0] || "q", q);
      return u.pathname + u.search;
    }

    function ensurePanel(input) {
      const mount = ac.mount ? q1(ac.mount) : null;
      if (panel && panel.isConnected && (mount ? panel.parentElement === mount : panel.classList.contains("sx-float"))) return panel;
      if (panel) panel.remove();
      panel = document.createElement("div");
      panel.setAttribute("data-semantix-ac", "1");
      panel.setAttribute("role", "listbox");
      panel.dir = getComputedStyle(input).direction || document.documentElement.dir || "rtl";
      panel.hidden = true;
      panel.addEventListener("click", onPick);
      // Keep the field focused while a suggestion is pressed (a blur would close a drawer-less search on some themes).
      panel.addEventListener("mousedown", e => e.preventDefault());
      if (mount) { panel.className = "sx-inline"; mount.prepend(panel); }
      else { panel.className = "sx-float"; document.body.appendChild(panel); }
      return panel;
    }

    function place() {
      if (!panel || panel.hidden || !field || !panel.classList.contains("sx-float")) return;
      if (!field.isConnected || !field.getClientRects().length) { close(); return; }
      const r = (field.form || field).getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const width = Math.min(Math.max(r.width, 340), vw - 16);
      const left = Math.min(Math.max(8, panel.dir === "rtl" ? r.right - width : r.left), vw - width - 8);
      panel.style.top = Math.round(r.bottom + 6) + "px";
      panel.style.left = Math.round(left) + "px";
      panel.style.width = Math.round(width) + "px";
    }

    function close() {
      if (panel) panel.hidden = true;
      active = -1;
    }

    function setActive(i) {
      const opts = panel ? Array.from(panel.querySelectorAll("[data-sx-opt]")) : [];
      opts.forEach(o => o.classList.remove("sx-active"));
      active = opts.length ? (i + opts.length + 1) % (opts.length + 1) : -1;   // one extra stop: back in the field
      if (active === opts.length) active = -1;
      if (active >= 0) { opts[active].classList.add("sx-active"); opts[active].scrollIntoView({ block: "nearest" }); }
    }

    function note(text) {
      const n = document.createElement("div");
      n.className = "sx-ac-note";
      n.textContent = text;
      return n;
    }

    function normalize(data) {
      const rows = Array.isArray(data) ? data : [...(data?.suggestions || []), ...(data?.products || [])];
      const products = [], queries = [], seen = new Set();
      for (const r of rows) {
        if (!r) continue;
        const isString = typeof r === "string";
        const text = String(isString ? r : (r.suggestion || r.name || r.title || r.query || "")).trim();
        if (!text) continue;
        const url = isString ? null : safeHref(r.url || r.link || "");
        const isQuery = isString || !url || r.source === "queries" || r.source === "filter-match" || (!r.image && r.price == null);
        const key = isQuery ? "q:" + text.toLowerCase() : "p:" + url;
        if (seen.has(key)) continue;
        seen.add(key);
        if (isQuery) queries.push(text);
        else products.push({ id: r.id ?? r.product_id ?? "", name: text, url, image: safeHref(r.image || "") || "", price: r.price });
      }
      return { products: products.slice(0, Number(ac.limit) || 6), queries: queries.slice(0, Number(ac.suggestions) || 0) };
    }

    function render(input, q, data) {
      const p = ensurePanel(input);
      const { products, queries } = normalize(data);
      const kids = [];
      const title = text => { const t = document.createElement("div"); t.className = "sx-ac-title"; t.textContent = text; return t; };
      if (queries.length) {
        if (ac.suggestionsTitle) kids.push(title(ac.suggestionsTitle));
        const chips = document.createElement("div");
        chips.className = "sx-ac-chips";
        for (const text of queries) {
          const a = document.createElement("a");
          a.className = "sx-ac-chip";
          a.href = resultsUrl(input, text);
          a.textContent = text;
          a.setAttribute("data-sx-opt", "1");
          a.setAttribute("role", "option");
          chips.appendChild(a);
        }
        kids.push(chips);
      }
      if (products.length) {
        if (ac.productsTitle) kids.push(title(ac.productsTitle));
        for (const prod of products) {
          const a = document.createElement("a");
          a.className = "sx-ac-item";
          a.href = safeUrl(prod.url) || "#";
          a.setAttribute("data-sx-opt", "1");
          a.setAttribute("data-sx-product", String(prod.id || ""));
          a.setAttribute("role", "option");
          if (safeUrl(prod.image)) { const img = document.createElement("img"); img.src = thumb(safeUrl(prod.image)); img.alt = ""; a.appendChild(img); }
          const name = document.createElement("span"); name.className = "sx-ac-name"; name.textContent = prod.name; a.appendChild(name);
          if (prod.price != null && prod.price !== "" && Number.isFinite(Number(prod.price))) {
            const price = document.createElement("span");
            price.className = "sx-ac-price";
            price.dir = "ltr";
            price.textContent = formatPriceValue(prod.price) + (ac.currency ? " " + ac.currency : "");
            a.appendChild(price);
          }
          kids.push(a);
        }
      } else {
        kids.push(note(fillText(ac.emptyText, { q })));
      }
      const all = document.createElement("a");
      all.className = "sx-ac-all";
      all.href = resultsUrl(input, q);
      all.textContent = fillText(ac.viewAllText, { q });
      all.setAttribute("data-sx-opt", "1");
      kids.push(all);
      p.replaceChildren(...kids);
      p.hidden = false;
      p.setAttribute("data-sx-query", q);
      shownFor = q;
      active = -1;
      place();
    }

    async function suggest(input, q) {
      const mine = ++seq;
      field = input;
      if (cache.has(q)) { render(input, q, cache.get(q)); return; }
      const p = ensurePanel(input);
      if (p.hidden || !p.childElementCount) { p.replaceChildren(note("מחפש…")); p.hidden = false; place(); }
      try {
        const sid = getConsentState() === "granted" ? getVisitorId() : "";
        const data = await suggestFetch(S.apiBase + endpoint + "?query=" + encodeURIComponent(q) + (sid ? "&session_id=" + encodeURIComponent(sid) : ""));
        if (cache.size > 40) cache.clear();
        cache.set(q, data);
        if (mine === seq) render(input, q, data);
      } catch (e) {
        if (e?.name === "AbortError" || mine !== seq) return;
        console.warn("[Semantix Autocomplete]", e?.message);
        close();
      }
    }

    function onType(input, delay) {
      clearTimeout(timer);
      clearTimeout(prefetchTimer);
      if (fallen) return;
      // Right after the shopper went to the results, the app may focus or refill the field; that is not typing.
      if (Date.now() < quietUntil) return;
      const q = input.value.trim();
      if (q.length < (Number(ac.minChars) || 2)) { seq++; typing(0); close(); if (TYPED) typedRelease(true); return; }
      if (pageGrid()) {
        if ((q === shownFor && TYPED) || q === pendingFor) return;
        timer = setTimeout(() => { pendingFor = q; suggestInPage(input, q).finally(() => { if (pendingFor === q) pendingFor = ""; }); }, delay ?? (Number(ac.debounceMs) || 250));
        return;
      }
      if (gridDisplay()) {
        if ((q === shownFor && STORE_OWN && STORE_OWN.q === q) || q === pendingFor) return;
        timer = setTimeout(() => { pendingFor = q; suggestInGrid(input, q).finally(() => { if (pendingFor === q) pendingFor = ""; }); }, delay ?? (Number(ac.debounceMs) || 250));
        return;
      }
      if (q === shownFor && panel && panel.isConnected && !panel.hidden) return;
      timer = setTimeout(() => suggest(input, q), delay ?? (Number(ac.debounceMs) || 160));
    }

    function onPick(e) {
      const a = e.target?.closest?.("a[data-sx-opt]");
      if (!a) return;
      const q = panel.getAttribute("data-sx-query") || field?.value?.trim() || "";
      try { ssSet("semantix_last_query", q); } catch {}
      if (!a.hasAttribute("data-sx-product")) return;
      try {
        const pid = a.getAttribute("data-sx-product") || extractHandle(a.href) || "";
        if (!pid) return;
        sendClick({
          event_id: "clk-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
          product_id: String(pid),
          product_name: a.querySelector(".sx-ac-name")?.textContent || null,
          search_query: q || null,
          interaction_type: "click",
          timestamp: new Date().toISOString(),
          product_url: a.href,
          source: "autocomplete",
          is_ai: true,
          platform: detectPlatform(),
          session_id: ensureVisitorId(),
          query_mode: "autocomplete",
          ...abTestPayloadFields()
        });
      } catch {}
    }

    const block = ac.blockNative !== false;
    window.addEventListener("input", e => {
      if (!isField(e.target)) return;
      if (block) e.stopImmediatePropagation();
      onType(e.target);
    }, true);
    window.addEventListener("keyup", e => { if (block && isField(e.target)) e.stopImmediatePropagation(); }, true);
    window.addEventListener("focusin", e => { if (isField(e.target)) onType(e.target, 0); }, true);
    // autocomplete.takeSubmit: the shop's field never hears the typing (blockNative), so an app that keeps the text in
    // its own state would submit an empty search. Semantix sends the shopper to the results page itself — through the
    // app's router when it has one (no page load), otherwise by a normal navigation.
    let ROUTER = null;
    function appRouter() {
      if (ROUTER) return ROUTER;
      try {
        for (const el of document.body.querySelectorAll("*")) {
          const r = el.__vue__?.$router || el.__vue_app__?.config?.globalProperties?.$router;
          if (r && typeof r.push === "function") {
            // A router built with an absolute base (Carmella: home_url + "/") pushes to "/https://host/?s=…"; keep its path only.
            const b = r.history?.base;
            if (typeof b === "string" && /^\/?https?:\/\//.test(b)) { try { r.history.base = new URL(b.replace(/^\//, "")).pathname.replace(/\/$/, ""); } catch {} }
            return (ROUTER = r);
          }
        }
      } catch {}
      return null;
    }
    function routeTo(url, replace) {
      const router = appRouter();
      if (!router) return false;
      try {
        const done = replace && typeof router.replace === "function" ? router.replace(url) : router.push(url);
        if (done && typeof done.catch === "function") done.catch(() => {});
        return true;
      } catch { return false; }
    }

    // autocomplete.display "store": no panel — the suggestions are shown as the shop's own product cards in the
    // results grid while the shopper types (data from /autocomplete); Enter then runs the full search.
    const gridDisplay = () => ac.display === "store" && storeScopeEnabled() && !!appRouter();
    let typedNavUntil = 0, pendingFor = "";
    async function suggestInGrid(input, q) {
      const mine = ++seq;
      field = input;
      let data = cache.get(q);
      if (!data) {
        try {
          const sid = getConsentState() === "granted" ? getVisitorId() : "";
          data = await suggestFetch(S.apiBase + endpoint + "?query=" + encodeURIComponent(q) + (sid ? "&session_id=" + encodeURIComponent(sid) : ""));
          if (cache.size > 40) cache.clear();
          cache.set(q, data);
        } catch (e) {
          if (e?.name !== "AbortError") console.warn("[Semantix Autocomplete]", e?.message);
          return;
        }
      }
      if (mine !== seq) return;
      const rows = Array.isArray(data) ? data : [...(data?.suggestions || []), ...(data?.products || [])];
      const ids = [...new Set(rows.filter(r => r && typeof r === "object" && r.id != null).map(r => String(r.id)))];
      const shown = Number(ac.gridLimit) || 12;
      const items = storeArrange((await Promise.all(ids.slice(0, shown * 2).map(storeProduct))).filter(Boolean)).slice(0, shown);
      // Nothing to show for these letters: the grid keeps what it has.
      if (mine !== seq || !items.length) return;
      STORE_OWN = { q, items, ids: new Set(items.map(x => String(x.id))), typed: true };
      shownFor = q;
      try { ssSet("semantix_last_query", q); } catch {}
      if (getQuery() === q) {
        const st = appStore();
        if (st) commitStoreResults(st);
        return;
      }
      // The results view opens through the app's router; the run that follows the navigation shows the list.
      typedNavUntil = Date.now() + 4000;
      storeDim(true);
      routeTo(resultsUrl(input, q), !!getQuery());
    }

    // autocomplete.display "grid": for shops whose pages come from the server. While the shopper types, the page's
    // own content is put aside and the suggestions are shown in its place as cards from the shop's card template
    // (nativeCard.cardTemplate), under a results heading; the address becomes the results address for those words.
    // Emptying the field or going back gives the page back exactly as it was. Enter loads the real results page.
    const pageGrid = () => ac.display === "grid" && typeof cfg.nativeCard?.cardTemplate === "string" && !!cfg.nativeCard.cardTemplate;
    let TYPED = null;
    // While the suggestions for the field's words are on their way: <html data-semantix-typing> (a shop's theme shows its
    // own loader with it).
    let typingFor = 0;
    function typing(id) {
      typingFor = id;
      try { id ? document.documentElement.setAttribute("data-semantix-typing", "1") : document.documentElement.removeAttribute("data-semantix-typing"); } catch {}
    }
    function typedRelease(restoreUrl) {
      if (!TYPED) return;
      const t = TYPED;
      TYPED = null;
      try { t.box.remove(); } catch {}
      qa("[data-semantix-typed-hidden]").forEach(n => n.removeAttribute("data-semantix-typed-hidden"));
      shownFor = "";
      if (restoreUrl && t.pushed) { LAST_Q = t.lastQ; try { typedNavUntil = Date.now() + 1000; history.replaceState(history.state, "", t.url); } catch {} }
    }
    function typedShow(input, q, products) {
      const root = one([...asList(ac.root), ...asList(cfg.replace?.root), "main", "[role='main']", "#maincontent", "#MainContent"]);
      if (!root) return false;
      if (!TYPED || !TYPED.box.isConnected) {
        if (!document.getElementById("semantix-typed-style")) {
          const css = document.createElement("style");
          css.id = "semantix-typed-style";
          css.textContent = "[data-semantix-typed-hidden]{display:none!important}[data-semantix-typed]{width:100%;position:relative}" +
            "[data-semantix-loading]::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,currentColor,transparent);background-size:40% 100%;background-repeat:no-repeat;opacity:.5;animation:semantix-load 1.1s linear infinite}" +
            "@keyframes semantix-load{from{background-position:-40% 0}to{background-position:140% 0}}";
          document.head.appendChild(css);
        }
        const box = document.createElement("div");
        box.setAttribute("data-semantix-typed", "1");
        const h = document.createElement(ac.titleTag || "h1");
        h.className = ac.titleClass || cfg.replace?.titleClass || "";
        h.style.cssText = "text-align:center;margin:28px 0 24px";
        const wrap = document.createElement("div");
        wrap.className = ac.gridWrapClass || "";
        const grid = document.createElement(ac.gridTag || "ul");
        grid.className = ac.gridClass || "";
        wrap.appendChild(grid);
        box.append(h, wrap);
        Array.from(root.children).forEach(n => n.setAttribute("data-semantix-typed-hidden", "1"));
        root.appendChild(box);
        TYPED = { box, grid, h, url: location.href, lastQ: LAST_Q, pushed: false };
      }
      TYPED.h.textContent = fillText(ac.title || cfg.replace?.title || DEFAULTS.replace.title, { q });
      if (!replaceGrid(TYPED.grid, null, products)) return false;
      try { setupCardFixObserver(); fixInjectedCards(); } catch {}
      // The address follows the typing; the run that a navigation starts sees a query it already knows.
      LAST_Q = q;
      if (keepAddress) return true;
      try {
        typedNavUntil = Date.now() + 1000;
        const url = resultsUrl(input, q);
        if (TYPED.pushed) history.replaceState({ semantixTyped: true }, "", url);
        else { history.pushState({ semantixTyped: true }, "", url); TYPED.pushed = true; }
      } catch {}
      return true;
    }
    async function suggestInPage(input, q) {
      const mine = ++seq;
      field = input;
      let data = cache.get(q);
      if (!data) {
        typing(mine);
        try {
          const sid = getConsentState() === "granted" ? getVisitorId() : "";
          data = await suggestFetch(S.apiBase + endpoint + "?query=" + encodeURIComponent(q) + "&limit=" + (Number(ac.gridLimit) || 10) + (sid ? "&session_id=" + encodeURIComponent(sid) : ""));
          if (cache.size > 40) cache.clear();
          cache.set(q, data);
        } catch (e) {
          if (e?.name !== "AbortError") console.warn("[Semantix Autocomplete]", e?.message);
          return;
        } finally {
          if (typingFor === mine) typing(0);
        }
      }
      if (mine !== seq) return;
      const rows = Array.isArray(data) ? data : [...(data?.suggestions || []), ...(data?.products || [])];
      // Production suggestion rows carry a url but no id; the url identifies the product then.
      const products = rows.filter(r => r && typeof r === "object" && (r.url || r.link))
        .map(r => ({ ...r, id: r.id ?? (r.url || r.link), name: r.name || r.title || r.suggestion || "", url: r.url || r.link }))
        .slice(0, Number(ac.gridLimit) || 10);
      if (!products.length) return;
      try { ssSet("semantix_last_query", q); } catch {}
      if (typedShow(input, q, products)) { shownFor = q; schedulePrefetch(input, q); }
    }
    if (ac.display === "grid") {
      window.addEventListener("popstate", () => typedRelease(false));
    }
    // After the rest of this setup has run (runShell uses what is declared below).
    setTimeout(() => { const sh = resultsShell(); if (sh?.here && inPage()) runShell(sh); }, 0);

    function goToResults(input) {
      const q = input.value.trim();
      if (q.length < (Number(ac.minChars) || 2)) return false;
      const url = resultsUrl(input, q);
      try { ssSet("semantix_last_query", q); } catch {}
      quietUntil = Date.now() + 1500;
      typedNavUntil = 0;
      seq++; clearTimeout(timer); close();
      try { input.blur(); } catch {}
      // A list shown while typing is replaced by the full search for the same words.
      if (STORE_OWN && STORE_OWN.typed) STORE_OWN = null;
      if (getQuery() === q && storeScopeEnabled()) { LAST_Q = ""; run(); return true; }
      if (routeTo(url, false)) return true;
      location.assign(url);
      return true;
    }
    // autocomplete.searchInPage (display "grid"): Enter keeps the shopper on the page — the full search fills the
    // in-page grid and the address becomes the results address, so the store's results page (and the store's own search
    // behind it) is never requested. A failed, empty or late search (behavior.fallbackMs) opens the store's results page.
    const inPage = () => ac.searchInPage === true && pageGrid();
    let keepAddress = false;
    // The shell page: a loader (the install snippet's, or this one) until the full results replace the page's content.
    // A failed, empty or late search (behavior.fallbackMs) opens the store's results page after all.
    async function runShell(sh) {
      keepAddress = true;
      const wait = document.getElementById("semantix-shell-wait") || (() => {
        const st = document.createElement("style");
        st.id = "semantix-shell-wait";
        const root = asList(ac.root)[0] || "main";
        st.textContent = root + ">*:not([data-semantix-typed]){display:none!important}" + root + "{min-height:60vh}" +
          root + ":not(:has([data-semantix-typed]))::before{content:'';display:block;margin:120px auto;width:36px;height:36px;border:3px solid rgba(128,128,128,.25);border-top-color:currentColor;border-radius:50%;animation:semantix-spin .8s linear infinite}" +
          "@keyframes semantix-spin{to{transform:rotate(360deg)}}";
        document.head.appendChild(st);
        return st;
      })();
      // The search leaves at once; the page it is shown in may still be parsing (the engine can run from <head>).
      const searching = fullSearch(sh.q);
      if (document.readyState === "loading") await new Promise(r => document.addEventListener("DOMContentLoaded", r, { once: true }));
      const input = [...document.querySelectorAll(inputSel)].find(Boolean) || null;
      if (input) input.value = sh.q;
      try { ssSet("semantix_last_query", sh.q); } catch {}
      try { document.title = fillText(ac.title || cfg.replace?.title || DEFAULTS.replace.title, { q: sh.q }); } catch {}
      const { data, error } = await searching;
      const products = Array.isArray(data?.products) ? data.products : [];
      if (products.length && typedShow(input, sh.q, products)) {
        LAST_SEARCH_RESULTS = products.map(p => p?.name || p?.title).filter(Boolean);
        LAST_SEARCH_METADATA = data?.searchMetadata || data?.search_metadata || null;
        shownFor = sh.q;
        try { attachLoadMore(TYPED.grid, data?.pagination); } catch {}
        try { wait.remove(); } catch {}
        keepAddress = false;
        return;
      }
      console.warn("[Semantix Autocomplete] results page:", error?.message || "no results", "— opening the store's results page");
      location.replace(nativeResultsUrl(sh.q));
    }
    // One full search per set of words, shared by the prefetch and by Enter (a failed one is not kept).
    const fullSearches = new Map();
    let prefetchTimer = 0;
    function fullSearch(q) {
      if (fullSearches.has(q)) return fullSearches.get(q);
      const sid = getConsentState() === "granted" ? ensureVisitorId() : undefined;
      const payload = { query: q, modern: true, ...(sid ? { session_id: sid } : {}), ...searchPayloadFields(q) };
      if (cfg.replace?.limit > 0) payload.limit = cfg.replace.limit;
      const run = apiPost(S.endpoints.search, payload).then(data => ({ data }), error => ({ error }));
      fullSearches.set(q, run);
      if (fullSearches.size > 20) fullSearches.delete(fullSearches.keys().next().value);
      run.then(r => { if (r.error && fullSearches.get(q) === run) fullSearches.delete(q); });
      return run;
    }
    // autocomplete.prefetchSearchMs: once the shopper has stopped typing that long with suggestions on the page, the full
    // search for those words starts, so Enter usually finds it done.
    function schedulePrefetch(input, q) {
      clearTimeout(prefetchTimer);
      const ms = Number(ac.prefetchSearchMs) || 0;
      if (!(ms > 0) || !inPage()) return;
      prefetchTimer = setTimeout(() => { if (input.value.trim() === q) fullSearch(q); }, ms);
    }
    const loading = on => { try { if (TYPED) on ? TYPED.box.setAttribute("data-semantix-loading", "1") : TYPED.box.removeAttribute("data-semantix-loading"); } catch {} };
    // Enter answers at once: the suggestions already on the page for these words stay (or are fetched — the fast
    // index-only answer) while the full search runs; its results replace them when they arrive in time. Only when
    // there is nothing to show at all does the shopper go to the store's results page.
    async function searchInPage(input) {
      const q = input.value.trim();
      if (q.length < (Number(ac.minChars) || 2)) return false;
      if (resultsShell()) {
        clearTimeout(timer); close();
        try { ssSet("semantix_last_query", q); } catch {}
        location.assign(shellHref(q));
        return true;
      }
      const url = resultsUrl(input, q);
      clearTimeout(timer); close();
      try { input.blur(); } catch {}
      try { ssSet("semantix_last_query", q); } catch {}
      clearTimeout(prefetchTimer);
      const full = fullSearch(q);
      const showing = () => !!TYPED && TYPED.box.isConnected && shownFor === q;
      if (!showing()) await Promise.race([suggestInPage(input, q).catch(() => {}), full]);
      // The suggestions stay on the page while the full results load; a bar over them says so.
      loading(true);
      const { data, error } = await full;
      loading(false);
      const products = Array.isArray(data?.products) ? data.products : [];
      if (products.length && typedShow(input, q, products)) {
        seq++; // a suggestion answer still on its way must not cover the full results
        LAST_SEARCH_RESULTS = products.map(p => p?.name || p?.title).filter(Boolean);
        LAST_SEARCH_METADATA = data?.searchMetadata || data?.search_metadata || null;
        shownFor = q;
        try { attachLoadMore(TYPED.grid, data?.pagination); } catch {}
        return true;
      }
      if (showing()) {
        console.warn("[Semantix Autocomplete] full search:", error?.message || "no results", "— the suggestions stay");
        return true;
      }
      console.warn("[Semantix Autocomplete] results in page:", error?.message || "no results", "— opening the store's results page");
      typedRelease(false);
      location.assign(url);
      return true;
    }
    if (inPage()) {
      window.addEventListener("submit", e => {
        const fieldIn = [...(e.target?.querySelectorAll?.("input") || [])].find(isField);
        if (!fieldIn || fieldIn.value.trim().length < (Number(ac.minChars) || 2)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        searchInPage(fieldIn);
      }, true);
    }
    if (ac.takeSubmit === true) {
      window.addEventListener("submit", e => {
        const fieldIn = [...(e.target?.querySelectorAll?.("input") || [])].find(isField);
        if (!fieldIn) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        goToResults(fieldIn);
      }, true);
      const submitSel = asList(ac.submitButton).join(",");
      if (submitSel) window.addEventListener("click", e => {
        const btn = e.target?.closest?.(submitSel);
        if (!btn) return;
        const scope = btn.closest("form") || document;
        const fieldIn = [...scope.querySelectorAll("input")].find(i => isField(i) && i.value.trim()) || null;
        if (!fieldIn) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        goToResults(fieldIn);
      }, true);
    }

    window.addEventListener("keydown", e => {
      if (!isField(e.target)) return;
      if (e.key === "Enter" && inPage() && !(panel && !panel.hidden && active >= 0) && e.target.value.trim().length >= (Number(ac.minChars) || 2)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        searchInPage(e.target);
        return;
      }
      if (e.key === "Enter" && ac.takeSubmit === true && !(panel && !panel.hidden && active >= 0)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        goToResults(e.target);
        return;
      }
      if (!panel || panel.hidden) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        e.stopImmediatePropagation();
        setActive(active + (e.key === "ArrowDown" ? 1 : -1));
      } else if (e.key === "Enter" && active >= 0) {
        const opt = panel.querySelectorAll("[data-sx-opt]")[active];
        if (opt) { e.preventDefault(); e.stopImmediatePropagation(); opt.click(); }
      } else if (e.key === "Escape") {
        close();
      }
    }, true);
    document.addEventListener("pointerdown", e => {
      if (!panel || panel.hidden || !panel.classList.contains("sx-float")) return;
      if (panel.contains(e.target) || e.target === field) return;
      close();
    }, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.addEventListener("semantix:navigate", () => {
      // A navigation made for the letters being typed is part of the typing, not the end of it.
      if (Date.now() < typedNavUntil) return;
      quietUntil = Date.now() + 1500; seq++; clearTimeout(timer); close();
    });
    console.log("[Semantix Autocomplete] attached:", inputSel, ac.mount ? "→ " + ac.mount : "(floating panel)");
  }

  /* ------------------------ main ------------------------ */

  let LAST_Q = "", RUNNING = false;
  let LAST_SEARCH_RESULTS = [];
  let LAST_TIER2_RESULTS = [];
  let LAST_SEARCH_METADATA = null;
  let LAST_SEARCH_CLASSIFICATION = null;

  // Every exit from a run leaves the page visible: the loader's anti-flicker rule is removed
  // once the run settles, whether Semantix rendered, bailed out, or failed.
  async function run() {
    try {
      await runOnce();
    } finally {
      if (!RUNNING) revealNative();
    }
  }

  async function runOnce() {
    if (!isCurrentDomainAllowed()) {
      console.log("[Semantix] ⛔ Current domain is not allowed by config — doing nothing");
      return;
    }

    // Kill switch — check both merged cfg and fresh siteConfig
    const freshDisabled = window.SemantixSettings?.siteConfig?.features?.disabled;
    if (cfg.features?.disabled === true || freshDisabled === true) {
      console.log("[Semantix] ⛔ Engine disabled via features.disabled — doing nothing");
      return;
    }

    if (RUNNING) return;
    RUNNING = true;

    // Shadow mode — data collection only, zero DOM/UI changes.
    // Must be checked BEFORE any UI-touching calls (placeholder rotator,
    // autocomplete footer, consent bar, etc.).
    const freshShadow = window.SemantixSettings?.siteConfig?.features?.shadowMode;
    const isShadowMode = cfg.features?.shadowMode === true || freshShadow === true;

    if (isShadowMode) {
      // Passive tracking only — no UI mutations whatsoever
      attachClickTracking();
      attachCartInterceptor();
      attachStoreTracking();
      flushQueue();

      const q = getQuery();
      if (!q || q === LAST_Q) { RUNNING = false; return; }
      LAST_Q = q;
      try { ssSet("semantix_last_query", q); } catch {}

      console.log("[Semantix] 👻 Shadow mode — registering query on server (no DOM injection):", q);
      const shadowSid = getConsentState() === "granted" ? ensureVisitorId() : undefined;
      if (analyticsAllowed()) apiPost(S.endpoints.fastSearch, { query: q, modern: true, limit: 1, ...(shadowSid ? { session_id: shadowSid } : {}), ...searchPayloadFields(q) })
        .then(() => log("👻 Shadow query registered"))
        .catch(() => {});

      // Passively detect zero-results so shadow sessions are counted too.
      // waitForGridOrNoResults only READS the DOM (querySelector polling) —
      // no mutations, so it's shadow-safe. recovered_count is null because
      // shadow mode never fetches recovery products.
      try {
        const { grid, cards, noResults } = await waitForGridOrNoResults(cfg.behavior.waitForDomMs || 8000);
        const isZero = !grid || !!noResults || !cards.length; // empty grid counts as zero too
        const knownPage = !!grid || !!noResults; // neither found = unknown page, don't count
        if (isZero && knownPage) {
          console.log("[Semantix] 👻 Shadow mode — zero-results page detected, tracking");
          trackZeroSearch(q, null, "shadow");
        }
      } catch {}
      RUNNING = false;
      return;
    }

    // Normal mode — full UI + DOM injection
    attachPlaceholderRotatorOnce();
    attachAutocompleteNoResults();
    attachAutocomplete();
    maybeShowConsentBar();
    // Events are only sent once the store's consent allows analytics: what happens before the visitor accepts is
    // not collected; the A/B exposure goes out on the first page view after.
    if (!window.__semantix_consent_watch) { window.__semantix_consent_watch = true; watchShopifyConsent(() => { if (analyticsAllowed()) flushQueue(); }); }
    attachClickTracking();
    attachCartInterceptor();
    attachAddToCart();
    attachStoreTracking();
    flushQueue();

    const q = getQuery();
    // Leaving the results (in-app navigation) ends the query, so searching the same words again runs again.
    if (!q) { releaseNativeEmptyState(); LAST_Q = ""; STORE_OWN = null; RUNNING = false; return; }
    if (q === LAST_Q) { RUNNING = false; return; }
    LAST_Q = q;
    releaseNativeEmptyState();
    try { ssSet("semantix_last_query", q); } catch {}

    // Clean up any stale zero-results grid from a previous query.
    // In dynamic/SSR frameworks (Nuxt etc.) the native grid re-renders via the framework
    // but our injected DOM node is invisible to it and persists across searches.
    const staleZeroGrid = q1("[data-semantix-zero-grid]");
    if (staleZeroGrid) {
      try { staleZeroGrid.remove(); } catch {}
      console.log("[Semantix] 🧹 Removed stale zero-results grid from previous query");
    }

    console.log("[Semantix] 🔍 Starting run for query:", q);

    // ── Results drawn by the shop's own app from an in-page store (replace.scope "store") ──
    if (storeScopeEnabled()) {
      const owned = await runStoreTakeover(q);
      console.log("[Semantix] 🔁 Results page — app store:", owned === true ? "Semantix list" : owned === false ? "shop's own results kept" : "no store found");
      RUNNING = false;
      return;
    }
    console.log("[Semantix] 📋 Selectors config:", {
      resultsGrid: cfg.selectors?.resultsGrid || "(fallback)",
      productCard: cfg.selectors?.productCard || "(fallback)",
      noResults: cfg.selectors?.noResults || "(none)"
    });
    
    const { grid, cards, noResults } = await waitForGridOrNoResults(cfg.behavior.waitForDomMs || 8000);
    
    console.log("[Semantix] 📋 DOM state after wait:", {
      grid: grid ? grid.tagName + '.' + grid.className : 'NULL',
      cards: cards.length,
      noResults: noResults ? noResults.tagName + '.' + noResults.className : 'NULL'
    });
    
    // Proactively save first card as template so zero-results pages can reuse it
    if (cards.length) {
      saveCardTemplate(cards[0]);
    }

    // Determine if this is a 0-results situation.
    // A grid that exists but is empty is NOT zero-results — it's an inject target.
    const isZeroResults = !grid || !!noResults;

    // ── Whole results area (replace.scope "main"): with native results, with none, or — on the configured
    //    results path — with a layout the selectors did not recognise. ──
    if (mainScopeEnabled() && (grid || noResults || onResultsPath())) {
      console.log("[Semantix] 🔁 Results page — full replace (main scope)");
      const owned = await runMainTakeover(q, { grid, cards, noResults });
      if (owned !== null) {
        RUNNING = false;
        return;
      }
    }

    // ── Safety guard: no grid AND no noResults element = unknown page, abort silently ──
    if (!grid && !noResults) {
      console.log("[Semantix] ⚠️ No grid and no noResults element found — aborting to avoid layout damage");
      RUNNING = false;
      return;
    }

    // ── Early exit: rerank/inject are hard-disabled — only zero-results recovery runs ──
    // Still register the query on the server for tracking (no DOM/UI changes), the
    // same way shadow mode does, so has-results searches show up in the DB too.
    if (!isZeroResults && cards.length && fullReplaceEnabled()) {
      console.log("[Semantix] 🔁 Results page — full replace");
      await runFullReplace(q, grid, cards);
      RUNNING = false;
      return;
    }

    if (!isZeroResults) {
      console.log("[Semantix] ⏭️ Normal results page — rerank & inject are hard-disabled, tracking query only");
      const trackSid = getConsentState() === "granted" ? ensureVisitorId() : undefined;
      if (analyticsAllowed()) apiPost(S.endpoints.fastSearch, { query: q, modern: true, limit: 1, ...(trackSid ? { session_id: trackSid } : {}), ...searchPayloadFields(q) })
        .then(() => log("Result query registered"))
        .catch(() => {});
      RUNNING = false;
      return;
    }

    let skeletons = null;
    let brandedLoader = null;

    if (isZeroResults && noResults) {
      // True zero-results page: confirmed noResults element found
      console.log("[Semantix] 🚨 Zero results detected");
      // Replace "no results" text with custom message while engine loads
      const replaceTxt = cfg.zero?.replaceNoResultsText;
      if (replaceTxt) {
        const huntSel = cfg.zero?.replaceNoResultsSelector;
        let target = null;
        if (huntSel) {
          target = noResults.querySelector(huntSel) || q1(huntSel);
        }
        if (!target) {
          target = noResults.querySelector("h1, h2, h3, p") || noResults;
        }
        const originalText = target.textContent;
        target.textContent = replaceTxt;
        console.log(`[Semantix] Replaced "${originalText.trim().slice(0,50)}" → "${replaceTxt}" (${huntSel || 'auto-detected'})`);
        await new Promise(r => setTimeout(r, 800));
      }
      // Hide noResults immediately before showing branded loader
      noResults.style.transition = "none";
      noResults.style.opacity = "0";
      noResults.style.display = "none";
      brandedLoader = showBrandedLoader(noResults);
      log("Showing branded loader for 0 results");
    } else {
      // Normal results page (grid present, possibly empty) — use skeleton loader
      console.log("[Semantix] ✅ Normal/empty grid detected, grid:", grid);
      skeletons = showSkeletonLoader(grid, cards[0]);
    }
    
    const t0 = Date.now();

    const consent = getConsentState();
    const sid = consent === "granted" ? ensureVisitorId() : undefined;

    try {
      // Check cache first
      let products = getCachedResults(q);
      
      if (!products) {
        // Cache miss - fetch from API
        // Use /search for zero results (better quality), /fast-search for normal grids
        const endpoint = isZeroResults ? S.endpoints.search : S.endpoints.fastSearch;
        const endpointName = isZeroResults ? "search" : "fast-search";
        
        console.log(`[Semantix] 🔌 Using endpoint: ${endpointName} (isZeroResults: ${isZeroResults})`);

        // Zero results: request up to maxProducts
        // Rerank/inject: rerankCount controls fetch size (0 = no limit sent, server decides)
        const zeroLimit = cfg.zero?.maxProducts || 25;
        const rerankCount = cfg.behavior?.rerankCount || 0;
        const payload = { query: q, modern: true, ...(sid ? { session_id: sid } : {}), ...searchPayloadFields(q) };
        if (isZeroResults) payload.limit = zeroLimit;
        else if (rerankCount > 0) payload.limit = rerankCount;
        // rerankCount === 0: omit limit entirely — server returns its default maximum

        const data = await apiPost(endpoint, payload);
        products = Array.isArray(data?.products) ? data.products : [];
        LAST_SEARCH_RESULTS = Array.isArray(data?.search_results) ? data.search_results.filter(Boolean) : [];
        LAST_TIER2_RESULTS = Array.isArray(data?.tier2_results) ? data.tier2_results.filter(Boolean) : [];
        LAST_SEARCH_METADATA = data?.searchMetadata || data?.search_metadata || null;
        LAST_SEARCH_CLASSIFICATION = data?.search_classification || null;
        
        console.log("[Semantix] 📦 Received", products.length, "products from API");
        
        // Save to cache
        if (products.length > 0) {
          setCachedResults(q, products);
        }
      }
      
      if (!LAST_SEARCH_RESULTS.length && Array.isArray(products)) {
        LAST_SEARCH_RESULTS = products.map(p => p?.name || p?.title || p?.product_name).filter(Boolean);
      }
      console.log("[Semantix] 🎯 Using", products.length, "products");

      // Native results were 0 — count this session's zero-results search
      // (fires regardless of whether Semantix recovered anything).
      // Covers both zero styles: a noResults element AND an empty grid.
      if (isZeroResults || cards.length === 0) trackZeroSearch(q, products.length);

      if (products.length) {
        // Check zero replace feature flag
        const freshCfg = window.SemantixSettings?.siteConfig || {};
        const canZeroReplace = (cfg.features?.zeroReplace !== false) &&
                              (freshCfg.features?.zeroReplace !== false);

        // If zero replace is disabled and this is zero results, skip
        if (isZeroResults && !canZeroReplace) {
          console.log("[Semantix] ⚠️ Zero replace disabled - skipping zero grid creation");
          if (noResults) noResults.style.display = "";
          RUNNING = false;
          return;
        }
        
        // RE-FIND grid/cards in case DOM changed during API call
        console.log("[Semantix] 🔄 Re-checking DOM before injection...");
        const freshCheck = await waitForGridOrNoResults(1000); // Quick re-check
        const targetGrid = freshCheck.grid || grid;
        const targetCards = freshCheck.cards.length ? freshCheck.cards : cards;
        const targetNoResults = freshCheck.noResults || noResults;

        console.log("[Semantix] 📋 Fresh DOM check:", {
          grid: targetGrid ? targetGrid.tagName + '.' + targetGrid.className : 'NULL',
          cards: targetCards.length,
          noResults: targetNoResults ? 'found' : 'NULL'
        });

        if (targetGrid && targetCards.length) {
          console.log("[Semantix] ➡️ Injecting into grid");
          injectIntoGrid(targetGrid, targetCards[0], products);
        } else if (canZeroReplace) {
          console.log("[Semantix] ➡️ Creating new grid (zero replace)");
          createGridWithProducts(targetNoResults, products, targetCards[0] || cards[0]);
        } else {
          console.log("[Semantix] ⚠️ Zero replace disabled, not creating grid");
          if (noResults) restoreNoResultsNow(noResults);
        }
        
        // Run post-injection fix to ensure all cards have correct data
        setupCardFixObserver();
        fixInjectedCards();
      } else if (noResults) {
        // No products found, show the original no-results message
        if (brandedLoader) {
          try { brandedLoader.remove(); } catch {}
          brandedLoader = null;
        }
        restoreNoResultsNow(noResults);
      }
    } catch (e) {
      console.warn("[Semantix] Error:", e?.message);
      // On error, restore no-results message
      if (brandedLoader) {
        try { brandedLoader.remove(); } catch {}
        brandedLoader = null;
      }
      if (noResults) restoreNoResultsNow(noResults);
    } finally {
      const elapsed = Date.now() - t0;
      const minMs = cfg.behavior.loaderMinMs || 250;
      
      setTimeout(() => {
        hideSkeletonLoader(skeletons);
        hideBrandedLoader(brandedLoader);
      }, Math.max(0, minMs - elapsed));
      
      RUNNING = false;
    }
  }

  /* ------------------------ SPA hooks ------------------------ */

  if (!window.__semantix_spa) {
    window.__semantix_spa = true;
    const _push = history.pushState;
    const navigated = () => {
      try { window.dispatchEvent(new Event("semantix:navigate")); } catch {}
      // The wait state starts with the navigation itself, so the shop's "nothing found" screen is never painted
      // for a search Semantix is about to answer.
      try { const q = getQuery(); if (q && q !== LAST_Q && storeScopeEnabled()) storeDim(true); } catch {}
      setTimeout(run, 60);
    };
    history.pushState = function() { _push.apply(history, arguments); navigated(); };
    const _replace = history.replaceState;
    history.replaceState = function() { _replace.apply(history, arguments); navigated(); };
    window.addEventListener("popstate", navigated);
  }

  /* ------------------------ bootstrap ------------------------ */

  /**
   * Wait for SemantixSettings.siteConfig to be ready
   * Handles race condition where engine loads before siteConfig is fetched
   */
  async function waitForSemantixConfig(timeoutMs = 9000) {
    const t0 = Date.now();

    const isReady = () => {
      const s = window.SemantixSettings;
      return !!(s?.siteConfig && Object.keys(s.siteConfig).length > 0);
    };

    // Helper: await the promise exactly once, with a safety timeout
    let _promiseAwaited = false;
    const awaitPromiseOnce = async () => {
      if (_promiseAwaited || !window.__semantix_siteconfig_promise?.then) return;
      _promiseAwaited = true;
      try {
        const remaining = Math.max(500, timeoutMs - (Date.now() - t0));
        await Promise.race([
          window.__semantix_siteconfig_promise,
          new Promise(r => setTimeout(r, remaining))
        ]);
      } catch {}
    };

    // First attempt: await existing promise (if any), then check
    await awaitPromiseOnce();
    if (isReady()) { console.log("[Semantix] siteConfig ready!"); return; }

    // Simple poll: sleep 80ms, check isReady, await promise once if it appeared late
    while (Date.now() - t0 < timeoutMs) {
      await new Promise(r => setTimeout(r, 80));
      await awaitPromiseOnce(); // no-op after first call
      if (isReady()) { console.log("[Semantix] siteConfig ready!"); return; }
    }

    console.warn("[Semantix] Timeout waiting for siteConfig, proceeding anyway...");
  }
  
  /**
   * Start the engine after config is ready
   */
  async function bootstrap() {
    await waitForSemantixConfig(9000);
    
    // Refresh settings after waiting
    const S = window.SemantixSettings || {};
    const C = S.siteConfig || {};
    
    console.log("[Semantix] 📥 Fresh siteConfig from server:", C);
    
    // Rebuild cfg with fresh siteConfig
    Object.keys(DEFAULTS).forEach(key => {
      if (C[key] && typeof C[key] === "object" && !Array.isArray(C[key])) {
        cfg[key] = { ...DEFAULTS[key], ...C[key] };
      } else if (C[key] !== undefined) {
        cfg[key] = C[key];
      }
    });

    // Re-apply per-session test-mode override — the rebuild above overwrote
    // cfg.features, and the fresh config may carry the abTests/sessionModes map.
    applyAbTests();
    applyModeOverride();

    if (!isCurrentDomainAllowed(C)) {
      console.log("[Semantix] ⛔ Current domain is not allowed by config — engine will not start", {
        host: location.hostname,
        allowedDomains: getConfiguredAllowedDomains(C)
      });
      return;
    }
    
    console.log("[Semantix] 🔄 Config rebuilt after wait:", {
      'behavior.enableRerank': cfg.behavior?.enableRerank,
      'behavior.enableInject': cfg.behavior?.enableInject,
      'features.rerankBoost': cfg.features?.rerankBoost,
      'features.injectIntoGrid': cfg.features?.injectIntoGrid,
      'features.zeroReplace': cfg.features?.zeroReplace
    });
    
    // What this visitor gets, for the pre-paint hide rule of the next page view (loader / embed):
    // a visitor in a native-search variant must not have the results area hidden while the engine loads.
    try {
      const off = cfg.features?.disabled === true || cfg.features?.shadowMode === true;
      lsSet("semantix_fx", JSON.stringify({ fullReplace: !off && fullReplaceEnabled(), autocomplete: !off && cfg.features?.autocomplete === true }));
    } catch {}

    // Measurement of an A/B split needs every visitor counted in a group, whether or not they ever search:
    //  - the groups are kept in localStorage (semantix_ab_current) for code that runs outside the engine — the
    //    checkout pixel / the order-received page stamp purchases with them;
    //  - one "ab_exposure" event per visitor, group and day goes to the server (stored whole, like cart events).
    try {
      const groups = abTestPayloadFields().ab_tests || null;
      if (groups) {
        lsSet("semantix_ab_current", JSON.stringify(groups));
        const stamp = JSON.stringify(groups) + ":" + new Date().toISOString().slice(0, 10);
        if (lsGet("semantix_ab_exposed", "") !== stamp && cfg.features?.disabled !== true && analyticsAllowed()) {
          lsSet("semantix_ab_exposed", stamp);
          sendSearchToCart({ event_type: "ab_exposure", session_id: ensureVisitorId(), platform: detectPlatform(), page_path: location.pathname, ab_tests: groups });
        }
      } else {
        try { localStorage.removeItem("semantix_ab_current"); } catch {}
      }
    } catch {}

    // Attach cart interceptor on ALL pages (not just search pages),
    // so ATC events on product/category pages are also tracked.
    attachCartInterceptor();
    trackOrderPage();

    // Attach the rotating placeholder on ALL pages (not just search pages),
    // so the rotating search-box hint appears site-wide. Respect shadow mode
    // (no UI/DOM mutations) exactly like run() does.
    const bootShadow = window.SemantixSettings?.siteConfig?.features?.shadowMode;
    if (cfg.features?.shadowMode !== true && bootShadow !== true) {
      attachPlaceholderRotatorOnce();
      attachAutocomplete();
    }

    // A shell results link (autocomplete.resultsShell) opened by a visitor who does not get Semantix (A/B group with the
    // store's own search, switched off): the store's results page instead.
    { const sh = resultsShell(); if (sh?.here && !autocompleteEnabled()) location.replace(nativeResultsUrl(sh.q)); }

    // Start engine
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run);
  } else {
      run();
    }
  }
  
  // Also listen for event-based ready signal (if loader dispatches it)
  document.addEventListener("semantix:siteconfig", async (e) => {
    console.log("[Semantix] Received siteconfig event:", e.detail);
  }, { once: true });
  
  // Start bootstrap
  bootstrap();

  window.__SemantixDebug = { 
    cfg, 
    getProductId, 
    getProductName, 
    findCard, 
    run, 
    fixInjectedCards,
    addToCart: { productForm: url => productForm(url, detectPlatform()), add: (url, pid) => platformAddToCart(url, pid) },
    cache: {
      get: getCachedResults,
      set: setCachedResults,
      clear: clearCache
    },
    testMode: {
      get: () => lsGet(MODE_OVERRIDE_KEY, "") || null,
      set: (m) => {
        if (!MODE_PRESETS[m]) { console.warn("[Semantix Test] unknown mode:", m, "— valid:", Object.keys(MODE_PRESETS).join(", ")); return; }
        lsSet(MODE_OVERRIDE_KEY, m);
        console.log("[Semantix Test] 🧪 mode set to", m, "— reload the page to apply");
      },
      clear: () => {
        try { localStorage.removeItem(MODE_OVERRIDE_KEY); } catch {}
        console.log("[Semantix Test] 🧪 mode override cleared — reload the page to apply");
      },
      visitorId: () => getVisitorId() || null,
      setVisitorId: (vid) => {
        lsSet(VISITOR_ID_KEY, String(vid));
        console.log("[Semantix Test] 🧪 visitor id set to", vid, "— reload the page to apply");
      },
      // Pre-rename aliases, kept so existing QA muscle memory still works.
      sessionId: () => getVisitorId() || null,
      setSessionId: (vid) => {
        lsSet(VISITOR_ID_KEY, String(vid));
        console.log("[Semantix Test] 🧪 visitor id set to", vid, "— reload the page to apply");
      }
    }
  };
})();
}
(function(){var S=window.SemantixSettings,C=S.siteConfig,KEY='semantix_remote_v1',TTL=300000,style=null,started=false;
function merge(over){var o={};if(over&&over.abTests&&typeof over.abTests==='object')o.abTests=over.abTests;if(over&&over.features&&over.features.disabled===true)o.features={disabled:true};over=o;for(var k in over){var v=over[k],b=C[k];C[k]=(v&&typeof v==='object'&&!Array.isArray(v)&&b&&typeof b==='object'&&!Array.isArray(b))?Object.assign({},b,v):v;}}
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
function start(){if(started)return;started=true;C.consent=Object.assign({},C.consent,{enabled:false});hide();engine();}
function refresh(done){try{fetch(S.apiBase+S.endpoints.siteConfig,{method:'POST',headers:{'Content-Type':'application/json','X-API-Key':S.apiKey}})
.then(function(r){return r.ok?r.json():(r.status===404?{}:null);})
.then(function(cfg){if(cfg&&typeof cfg==='object'&&!Array.isArray(cfg)){try{localStorage.setItem(KEY,JSON.stringify({ts:Date.now(),key:S.apiKey,cfg:cfg}));}catch(e){}if(done)done(cfg);}else if(done)done(null);})
.catch(function(){if(done)done(null);});}catch(e){if(done)done(null);}}
var kept=null;try{kept=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){}
if(kept&&kept.key===S.apiKey&&kept.cfg){merge(kept.cfg);start();if(Date.now()-kept.ts>TTL)refresh(null);}
else{hide();var timer=setTimeout(start,1000);refresh(function(cfg){clearTimeout(timer);if(!started&&cfg)merge(cfg);start();});}
})();
})();
