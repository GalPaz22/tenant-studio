import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {load} from 'cheerio';
import {detectTakeover,mergeSiteConfig,fillTemplate,buildCardTemplate,findGrid,findRoot,findAutocomplete,shellOf,uniqueSelector,sampleQueries,ZERO_QUERY,applySettings,cleanTemplate} from './core/search-takeover.mjs';
import {buildShopifyTakeover} from './core/takeover-export.mjs';
import {publishSiteConfig,rollbackSiteConfig,readSiteConfig,configHash} from './core/takeover-control.mjs';
import {engineTag,enginePage,engineSuggestions,previewConfig,recordEvent,readEvents,clearEvents} from './core/takeover-preview.mjs';

const origin='https://shop.example';
const products=[
 {id:'s:1001',title:'ספר בישול ביתי',url:origin+'/1001',image:origin+'/m/1001.jpg',price:66.6,stockStatus:'instock',specifications:{author:'רותי כהן'}},
 {id:'s:1002',title:'ספר בישול איטלקי',url:origin+'/1002',image:origin+'/m/1002.jpg',price:59,stockStatus:'outofstock',specifications:{author:'מרקו רוסי'}},
 {id:'s:1003',title:'ספר בישול טבעוני',url:origin+'/1003',image:origin+'/m/1003.jpg',price:72.5,stockStatus:'instock',specifications:{author:'דנה לוי'}},
 {id:'s:1004',title:'ספר בישול מהיר',url:origin+'/1004',image:origin+'/m/1004.jpg',price:49.9,stockStatus:'instock',specifications:{author:'יואב בר'}},
 ...Array.from({length:10},(_,i)=>({id:'s:2'+i,title:'ספר בישול נוסף '+i,url:origin+'/2'+i,price:10,stockStatus:'instock'})),
];
// A Magento-like custom theme: every card carries the store's own entity id, a per-product author link and badge.
const card=(p,i)=>`<li class="product-item item-${900+i}" data-id="${900+i}" data-productid="${900+i}"><form class="start-product-item" data-role="tocart-form" action="${origin}/checkout/cart/add/product/${900+i}" method="post" product_outofstock="${p.stockStatus==='outofstock'}"><input type="hidden" name="form_key" value="abc"><input type="hidden" name="product" value="${900+i}">
 <a href="${p.url}" class="product_link"><img class="photo" src="${origin}/cache/x/${p.id}.jpg" srcset="${origin}/cache/y/${p.id}.jpg 2x" alt="${p.title}"></a>
 <span class="rank">${i+1}</span>
 <div class="name"><a href="${p.url}" title="${p.title}">${p.title}</a></div>
 <div class="author"><a href="/authors/${encodeURIComponent(p.specifications?.author||'x')}">${p.specifications?.author||''}</a></div>
 <div class="price-box" data-price-amount="${p.price}"><span class="price">${p.price.toFixed(2)}&nbsp;₪</span></div>
 <button type="submit" class="action tocart">הוספה לסל</button><a class="towishlist" href="#">♡</a></form></li>`;
const page=(inner,{title='חיפוש'}={})=>`<!doctype html><html><head><title>${title}</title><script src="/static/version1/frontend/Magento_Catalog/x.js"></script></head><body data-mage-init="{}">
 <header><form id="search_mini_form" action="${origin}/catalogsearch/result/" method="get"><input id="search" type="text" name="q"></form><div id="search_autocomplete" class="search-autocomplete"></div>
 <nav><ul class="products"><li class="product-item"><a href="${products[0].url}">menu</a></li></ul></nav></header>
 <main id="maincontent"><div class="column main">${inner}</div></main><footer></footer></body></html>`;
const results=(list)=>page(`<div class="toolbar"><div class="layered-navigation"><span>${list.length*3} פריטים</span><label>מיון לפי</label><select><option>מחיר</option></select><div class="filter-options"><input type="checkbox"> מודפס</div></div>
 <div class="products wrapper"><ul class="products list items product-items">${list.map(card).join('')}</ul>
 <div class="load_next_wrapper">${list.length} פריטים נצפו מתוך ${list.length*3} <a href="?q=x&p=2">טען עוד</a></div></div></div>
 <div class="message info empty" style="display:none">לא נמצאו מוצרים</div>`);
const zero=page(`<div class="message notice"><div>לא נמצאו תוצאות לחיפוש שלך</div></div>`);

function fakeSite(){
 const seen=[];
 const fetchPage=async url=>{seen.push(url);const u=new URL(url);
  if(u.pathname==='/')return {status:200,text:page('<p>home</p>')};
  // Product page whose add-to-cart form (like Steimatzky's) has related-product forms printed inside it.
  if(/^\/\d{4}$/.test(u.pathname))return {status:200,text:page(`<form id="product_addtocart_form" action="${origin}/checkout/cart/add/product/77" method="post"><input type="hidden" name="product" value="77"><input type="hidden" name="form_key" value="k"><input name="qty" value="1"><button type="submit" class="tocart">הוספה לסל</button><form action="${origin}/checkout/cart/add/product/88"><input type="hidden" name="product" value="88"></form></form>`)};
  if(u.pathname==='/catalogsearch/result/'){const q=u.searchParams.get('q');if(q===ZERO_QUERY)return {status:200,text:zero};return {status:200,text:results(u.searchParams.get('p')==='2'?products.slice(4,8):products.slice(0,4))};}
  return {status:404,text:''};};
 return {fetchPage,seen};
}

test('detection finds the results grid from catalog links and proposes verified selectors',async()=>{
 const site=fakeSite(),r=await detectTakeover({url:origin,products,fetchPage:site.fetchPage});
 assert.equal(r.platform,'magento');
 assert.deepEqual(r.search,{path:'/catalogsearch/result/',param:'q',extra:{},from:'form',inputSelector:'#search'});
 const $=load(results(products.slice(0,4)));
 // The header menu copy of a card (inside <header>) is not the results grid.
 assert.equal($(r.siteConfig.selectors.resultsGrid[0]).length,1);assert.ok($(r.siteConfig.selectors.resultsGrid[0]).is('ul.product-items'));
 assert.equal($(r.siteConfig.selectors.resultsGrid[0]).find(r.siteConfig.selectors.productCard[0]).length,4);
 // The zero-results message is the one that exists only on the zero page, not the hidden template on a results page.
 assert.equal(r.noResults.onResultsPage,false);assert.ok(load(zero)(r.noResults.selector).text().includes('לא נמצאו'));
 assert.deepEqual(r.hidden.map(h=>h.kinds.join('/')),['count/sort/filters','count/pager']);
 // The whole results area: the page's own <main>, with the levels down to the grid for a page that has no grid.
 assert.deepEqual(r.siteConfig.replace,{searchPath:'^/catalogsearch/result',hide:r.hidden.map(h=>h.selector),scope:'main',root:'#maincontent',
  shell:[{tag:'div',cls:['column','main']},{tag:'div',cls:['toolbar']},{tag:'div',cls:['products','wrapper']},{tag:'ul',cls:['products','list','items','product-items']}],titleClass:''});
 assert.equal(load(zero)(r.siteConfig.replace.root).length,1,'the root exists on a page with no results');
 assert.ok(new RegExp(r.siteConfig.replace.searchPath).test('/catalogsearch/result/')&&!new RegExp(r.siteConfig.replace.searchPath).test('/catalog/x'));
 assert.equal(r.siteConfig.features.fullReplace,true);assert.equal(r.siteConfig.platform,'magento');
 assert.deepEqual(r.siteConfig.cartInterceptor.atcPatterns,['/checkout/cart/add']);
 assert.ok(!r.siteConfig.cartInterceptor.checkoutPatterns.some(p=>'/checkout/sidebar/removeItem'.includes(p)),'mini-cart edits are not checkouts');
 assert.equal(r.siteConfig.clickTracking.universalLinkSelector,r.siteConfig.selectors.productCard[0]+' a[href]');
 assert.ok(r.report.steps.every(s=>s.ok),JSON.stringify(r.report.steps));
 assert.ok(r.report.warnings.some(w=>/מזהה magento פנימי/.test(w)));
 // The store's suggestion list next to the search form is removed; ours opens as a panel under the field.
 assert.deepEqual(r.siteConfig.autocomplete,{input:'#search',hide:['#search_autocomplete'],mount:null});assert.equal(r.siteConfig.features.autocomplete,true);
 assert.ok(site.seen.some(u=>u.includes('p=2')));
 assert.deepEqual(r.siteConfig.addToCart,{mode:'engine'});
 assert.match(r.report.steps.find(s=>s.name==='addToCart').detail,/#product_addtocart_form · \/checkout\/cart\/add\/product\/# · form_key/);
});

test('card template turns the sample product into tokens and drops what belongs to it alone',async()=>{
 const $=load(results(products.slice(0,4))),found=findGrid($,u=>products.find(p=>p.url===new URL(u,origin).href)||null);
 const t=buildCardTemplate($,found.cards,origin);
 assert.equal(t.source.productId,'s:1001','an in-stock product is the template source');
 for(const token of ['{{url}}','{{name}}','{{image}}','{{price}}','{{author}}','{{outOfStock}}'])assert.ok(t.html.includes(token),token);
 for(const leak of ['901','900','66.6"','form_key','srcset','towishlist','/authors/','item-900','action=','<form','type="submit"'])assert.ok(!t.html.includes(leak),leak);
 // The card's own add-to-cart button stays (theme styling) and is handed to the engine.
 const $t=load(t.html),atc=$t('[data-semantix-atc]');
 assert.equal(t.addToCart,true);assert.equal(atc.length,1);assert.ok(atc.hasClass('tocart'));assert.equal(atc.attr('type'),'button');
 assert.deepEqual([atc.attr('data-semantix-atc-url'),atc.attr('data-semantix-atc-id'),atc.attr('data-semantix-atc-oos')],['{{url}}','{{id}}','{{outOfStock}}']);
 assert.equal(t.priceDecimals,2);
 assert.match(t.html,/class="product-item"/,'classes every card shares are kept');
 const filled=load(fillTemplate(t.html,products[1]));
 assert.equal(filled('a[title]').attr('href'),products[1].url);assert.ok(filled.text().includes('מרקו רוסי'));
 assert.equal(filled('[product_outofstock]').attr('product_outofstock'),'true');
 assert.equal(load(fillTemplate(t.html,products[0]))('[product_outofstock]').attr('product_outofstock'),'false');
});

test('selectors are unique, stable and skip ids and classes that carry numbers',()=>{
 const $=load('<main><div class="grid g-8812 is-loading"><ul id="list_33" class="items">x</ul></div><ul class="items">y</ul></main>');
 assert.equal(uniqueSelector($,$('ul').first()[0]),'div.grid ul.items');
 assert.equal(sampleQueries([{title:'ספר ילדים'},...Array.from({length:9},()=>({title:'ספר ילדים חדש'}))]).at(0),'ספר ילדים');
});

test('merge keeps unrelated production keys and replaces the takeover slice as a unit',()=>{
 const current={consent:{enabled:true,title:'x'},selectors:{resultsGrid:['old'],productCard:['old'],pageTitle:'h1'},features:{shadowMode:false,allowedDomains:['shop.example']},replace:{hide:['.stale']},abTests:{a:1}};
 const m=mergeSiteConfig(current,{platform:'magento',queryParams:['q'],selectors:{resultsGrid:['ul.g'],productCard:['li.c'],noResults:undefined},nativeCard:{cardTemplate:'<li>{{name}}</li>'},features:{fullReplace:true},replace:{hide:[]},cartInterceptor:{enabled:true},clickTracking:{universalMode:true}});
 assert.deepEqual(m.consent,current.consent);assert.deepEqual(m.abTests,{a:1});assert.equal(m.selectors.pageTitle,'h1');
 assert.deepEqual(m.selectors.resultsGrid,['ul.g']);assert.deepEqual(m.replace,{hide:[]});
 assert.deepEqual(m.features,{shadowMode:false,allowedDomains:['shop.example'],fullReplace:true});
});

function fakeUsers(docs){
 return {docs,find:q=>({limit:()=>({toArray:async()=>docs.filter(d=>d.dbName===q.dbName&&typeof d.apiKey==='string')})}),
  bulkWrite:async ops=>{let n=0;for(const {updateOne:{filter,update}} of ops){const d=docs.find(x=>String(x._id)===String(filter._id)&&(!filter.dbName||x.dbName===filter.dbName));if(!d)continue;n++;
   if(update.$set)for(const [k,v] of Object.entries(update.$set)){const [a,b]=k.split('.');d[a]={...(d[a]||{}),[b]:v};}
   if(update.$unset)for(const k of Object.keys(update.$unset)){const [a,b]=k.split('.');delete d[a]?.[b];}}
   return {modifiedCount:n};}};
}
const client=users=>({db:()=>({collection:()=>users})});

test('publishing writes only the reviewed version, backs up each user and can be rolled back',async()=>{
 const {ObjectId}=await import('mongodb');
 const a=new ObjectId(),b=new ObjectId(),users=fakeUsers([
  {_id:a,username:'store',dbName:'shop',apiKey:'k1',credentials:{siteConfig:{consent:{enabled:true}}}},
  {_id:b,username:'staff',dbName:'shop',apiKey:'k2',credentials:{}},
  {_id:new ObjectId(),username:'other',dbName:'other',apiKey:'k3',credentials:{siteConfig:{x:1}}}]);
 const project={id:'0f0e0d0c-0b0a-4908-8706-050403020100',existingClient:{dbName:'shop'}},backups=await mkdtemp(join(tmpdir(),'takeover-'));
 const proposal={platform:'magento',queryParams:['q'],selectors:{resultsGrid:['ul.g'],productCard:['li.c']},nativeCard:{cardTemplate:'<li>{{name}}</li>'},features:{fullReplace:true},replace:{hide:[]},cartInterceptor:{enabled:true},clickTracking:{}};
 const live=await readSiteConfig(project,{client:client(users)});
 assert.equal(live.consistent,false);assert.equal(live.hash,configHash({consent:{enabled:true}}));
 await assert.rejects(()=>publishSiteConfig(project,proposal,{expectedHash:configHash({}),backups,client:client(users)}),/השתנתה/);
 const r=await publishSiteConfig(project,proposal,{expectedHash:live.hash,backups,client:client(users)});
 assert.equal(r.users,2);assert.equal(users.docs[0].credentials.siteConfig.consent.enabled,true);assert.equal(users.docs[1].credentials.siteConfig.features.fullReplace,true);
 assert.deepEqual(users.docs[2].credentials.siteConfig,{x:1},'another store is never touched');
 const [file]=await readdir(backups);const saved=JSON.parse(await readFile(join(backups,file),'utf8'));
 assert.deepEqual(saved.users.map(u=>u.siteConfig),[{consent:{enabled:true}},null]);
 await rollbackSiteConfig(project,file,{backups,client:client(users)});
 assert.deepEqual(users.docs[0].credentials.siteConfig,{consent:{enabled:true}});assert.equal(users.docs[1].credentials.siteConfig,undefined);
 await assert.rejects(()=>rollbackSiteConfig(project,'../etc/passwd',{backups,client:client(users)}),/גיבוי/);
});

test('a search drawer keeps its place: its content is hidden and the suggestions mount inside it',()=>{
 const $=load(`<body><div class="shopify-section"><store-header class="header"><a href="/search" aria-controls="search-drawer">חיפוש</a></store-header>
  <mobile-navigation class="drawer"><div class="drawer__content"><ul><li>תפריט</li></ul></div></mobile-navigation>
  <predictive-search-drawer id="search-drawer" class="predictive-search drawer"><span class="drawer__overlay"></span>
   <header class="drawer__header"><form action="/search" class="predictive-search__form"><input class="predictive-search__input" type="text" name="q"></form><button type="button" class="drawer__close-button">x</button></header>
   <div class="drawer__content"><div class="predictive-search__content-wrapper"><div hidden class="predictive-search__results"></div></div></div>
   <footer hidden class="drawer__footer"><button type="submit">כל התוצאות</button></footer></predictive-search-drawer></div>
  <div id="main"><div class="shopify-section shopify-section--main-search"><section><header class="page-header"><h1 class="heading h2">חיפוש</h1></header><div class="product-list__inner"><a href="/p/1">1</a></div></section></div></div>
  <div class="shopify-section"><footer class="footer"></footer></div></body>`);
 assert.deepEqual(findAutocomplete($,$('input.predictive-search__input')[0]),{hide:['div.predictive-search__content-wrapper'],mount:'#search-drawer div.drawer__content'});
 // A theme without <main>: the content landmark is found by id, and a <header> inside the content does not stop it.
 const grid=$('.product-list__inner')[0],root=findRoot($,grid);
 assert.equal(root.attribs.id,'main');
 assert.deepEqual(shellOf(root,grid),[{tag:'div',cls:['shopify-section','shopify-section--main-search']},{tag:'section',cls:[]},{tag:'div',cls:['product-list__inner']}]);
});

test('the price before a discount becomes a conditional part, and a swatch that lost its colour is dropped',()=>{
 const item=(p,color)=>`<li class="card"><a href="${p.url}"><img src="${p.image}" alt="${p.title}"></a><a class="title" href="${p.url}">${p.title}</a>
  <div class="price-list"><span class="price price--highlight">${p.price.toFixed(2)} ₪</span><span class="price price--compare"><span class="sr">מחיר</span>${(p.price+20).toFixed(2)} ₪</span></div>
  <div class="swatches" data-url="${p.url}"><div class="swatch-wrap" data-title="${p.title}"><div class="swatch" style="background:${color}"></div></div></div></li>`;
 const list=products.slice(0,4),$=load(`<main><ul class="grid">${list.map((p,i)=>item(p,['#111','#eee','#a00','#0a0'][i])).join('')}</ul></main>`);
 const cards=$('li.card').toArray().map((el,i)=>({el,product:list[i]})),tpl=buildCardTemplate($,cards,origin);
 assert.match(tpl.html,/<span class="price price--compare" data-semantix-if="onSale"><span class="sr">מחיר<\/span>\{\{regularPrice\}\} ₪<\/span>/);
 assert.match(tpl.html,/price--highlight">\{\{price\}\} ₪/);
 assert.ok(!tpl.html.includes('swatch'),'the colourless swatch and the wrappers that held only it are gone');
 assert.equal(load(fillTemplate(tpl.html,{...list[1],regularPrice:79}),null,false)('.price--compare').text(),'מחיר79 ₪');
});

test('the Shopify export carries the demo configuration and the engine in one app embed',async()=>{
 const site=fakeSite(),r=await detectTakeover({url:origin,products,fetchPage:site.fetchPage});
 const engine='(function(){const S=window.SemantixSettings||{};})();';
 const project={id:'p1',url:'https://www.shop.example/',takeover:{siteConfig:{...r.siteConfig,platform:'shopify'}}};
 const {manifest,files}=buildShopifyTakeover(project,{apiBase:'https://api.example.com/',apiKey:'site_key_12345678',engine,now:new Date('2026-10-03T10:00:00Z')});
 const block=files['extensions/semantix-search/blocks/semantix-search.liquid'];
 assert.equal(files['extensions/semantix-search/assets/semantix-engine.js'],engine);
 assert.match(files['extensions/semantix-search/shopify.extension.toml'],/type = "theme"/);
 // The configuration is JSON inside {% raw %}: the card template's {{tokens}} must reach the browser untouched.
 const raw=/siteConfig:\{% raw %\}(.*)\{% endraw %\}\};/.exec(block)[1],cfg=JSON.parse(raw);
 assert.deepEqual(cfg,project.takeover.siteConfig);assert.ok(cfg.nativeCard.cardTemplate.includes('{{url}}'));assert.ok(!raw.includes('<'),'no markup can close the script');
 assert.ok(block.indexOf('{% raw %}')<block.indexOf('{{url}}')&&!block.replace(/\{% raw %\}.*\{% endraw %\}/s,'').includes('{{url}}'));
 assert.match(block,/default: 'site_key_12345678'/);assert.match(block,/default: 'https:\/\/api\.example\.com'/);assert.match(block,/"target": "head"/);assert.ok(!/consent_bar/.test(block),'no consent-bar setting');
 assert.match(block,/engineSrc:\{\{ 'semantix-engine\.js' \| asset_url \| json \}\}/);assert.ok(!/<script src=/.test(block),'the engine is loaded by the boot script, after the remote configuration');assert.match(block,/autocomplete:"\/autocomplete"|"autocomplete":"\/autocomplete"/);
 assert.deepEqual(manifest.features,{autocomplete:true,resultsPage:'main',addToCart:'engine'});assert.equal(manifest.siteKey,'included');assert.equal(manifest.slug,'shop');
 assert.match(files['INSTALL.md'],/shopify app deploy/);
 // No key at export: the embed asks for it in its settings.
 assert.equal(buildShopifyTakeover(project,{apiBase:'https://api.example.com',engine}).manifest.siteKey,'set-in-embed-settings');
 assert.throws(()=>buildShopifyTakeover(project,{apiBase:'http://api.example.com',engine}),/HTTPS/);
 assert.throws(()=>buildShopifyTakeover(project,{apiBase:'https://api.example.com',apiKey:"x' | y",engine}),/מפתח/);
 assert.throws(()=>buildShopifyTakeover({...project,takeover:{siteConfig:{...r.siteConfig}}},{apiBase:'https://api.example.com',engine}),/Shopify/);
});

test('preview pins its settings, answers in the engine shape and logs tracking',()=>{
 const tag=engineTag({id:'p1'});
 assert.match(tag,/Object\.defineProperty\(window,'SemantixSettings'/);assert.ok(tag.indexOf('defineProperty')<tag.indexOf('loader.js'));
 const page=enginePage({matches:[{id:'1',title:'א',url:'https://s/1',price:5,regularPrice:8,stockStatus:'instock',specifications:{author:'ב'}}],nextCursor:'c2',total:9},u=>'/demo/p1'+new URL(u).pathname);
 assert.deepEqual(page.pagination,{hasMore:true,nextToken:'c2',totalAvailable:9,returned:1});assert.equal(page.products[0].url,'/demo/p1/1');assert.equal(page.products[0].onSale,true);
 assert.equal(previewConfig({siteConfig:{consent:{enabled:true,title:'x'}}}).consent.enabled,false);
 // On the studio host the mirror is under /demo/<id>/, so the results path is not anchored to the start.
 assert.ok(new RegExp(previewConfig({siteConfig:{replace:{searchPath:'^/search'}}}).replace.searchPath).test('/demo/p1/search'));
 assert.match(tag,/autocomplete:'\/autocomplete'|"autocomplete":"\/autocomplete"/);
 assert.deepEqual(engineSuggestions([{id:'1',title:'א',url:'https://s/1',image:'https://s/1.jpg',price:5}],u=>'/demo/p1'+new URL(u).pathname),[{suggestion:'א',source:'products',id:'1',url:'/demo/p1/1',image:'https://s/1.jpg',price:5}]);
 clearEvents('p1');recordEvent('p1','search-to-cart',{document:{event_type:'checkout'}});recordEvent('p1','big',{blob:'x'.repeat(5000)});
 assert.equal(readEvents('p1')[0].body.document.event_type,'checkout');assert.equal(readEvents('p1')[1].body.truncated,true);
});

test('operator settings layer over detection and survive a new detection',async()=>{
 const site=fakeSite(),r=await detectTakeover({url:origin,products,fetchPage:site.fetchPage});
 const t={...r,detectedConfig:r.siteConfig};
 applySettings(t,{loader:{type:'bar',text:'רגע…',color:'#aa3300'},atcText:{addedText:'בסל!',toast:false},hide:[r.hidden[1].selector],overrides:{productCard:'li.item',cardTemplate:'<li><a href="{{url}}" onclick="x()">{{name}}</a><script>bad()</script></li>'}});
 assert.deepEqual(t.siteConfig.replace.loader,{type:'bar',text:'רגע…',color:'#aa3300'});
 assert.equal(t.siteConfig.addToCart.addedText,'בסל!');assert.equal(t.siteConfig.addToCart.toast,false);assert.equal(t.siteConfig.addToCart.mode,'engine');
 assert.deepEqual(t.siteConfig.replace.hide,[r.hidden[1].selector]);
 assert.deepEqual(t.siteConfig.selectors.productCard,['li.item']);assert.equal(t.siteConfig.clickTracking.universalLinkSelector,'li.item a[href]');
 assert.equal(t.siteConfig.nativeCard.cardTemplate,'<li><a href="{{url}}">{{name}}</a></li>','scripts and handlers are stripped');
 assert.deepEqual(t.detectedConfig.selectors.productCard,r.siteConfig.selectors.productCard,'the detection base is untouched');
 // Partial updates keep the rest; a new detection re-applies the operator's settings.
 applySettings(t,{loader:{text:'עוד רגע'}});assert.equal(t.siteConfig.replace.loader.color,'#aa3300');
 const again={...r,detectedConfig:structuredClone(r.siteConfig),settings:t.settings};applySettings(again,{});
 assert.deepEqual(again.siteConfig.selectors.productCard,['li.item']);assert.equal(again.siteConfig.replace.loader.text,'עוד רגע');
 applySettings(again,{reset:true});assert.deepEqual(again.siteConfig.selectors.productCard,r.siteConfig.selectors.productCard);
 // The whole-area takeover and our suggestions can each be switched off and back on.
 applySettings(again,{scope:'grid',autocomplete:false});assert.equal(again.siteConfig.replace.scope,'grid');assert.equal(again.siteConfig.features.autocomplete,false);
 assert.equal(again.detectedConfig.replace.scope,'main');
 applySettings(again,{scope:'main',autocomplete:true});assert.equal(again.siteConfig.replace.scope,'main');assert.equal(again.siteConfig.features.autocomplete,true);
 assert.equal(mergeSiteConfig({autocomplete:{input:'#old',hide:['.stale']}},again.siteConfig).autocomplete.input,'#search');
 assert.throws(()=>applySettings(t,{overrides:{resultsGrid:'ul[[['}}),/סלקטור/);
 assert.throws(()=>applySettings(t,{loader:{color:'red'}}),/צבע/);
 assert.throws(()=>cleanTemplate('<li>{{name}}</li>'),/\{\{url\}\}/);
});
