import {test} from 'node:test';
import assert from 'node:assert/strict';
import {storesFromIndex,platformHint,englishLayout,typo,prefixed,titleMatches,parseResults,parseSuggest,searchForm,searchPlan,planQueries,judge,scoreSearch,extractContacts,contactPages,auditStore,searchProviders} from './core/prospect.mjs';

// A fake store: pages by path+query; anything else is a 404.
const site=pages=>async url=>{const u=new URL(url),key=decodeURIComponent(u.pathname+u.search);const v=pages[key];if(v===undefined)return {status:404,url,text:''};return typeof v==='object'?{status:200,url:v.url||url,text:v.text}:{status:200,url,text:v};};
const card=(slug,name)=>`<li class="product"><a href="/product/${slug}/"><img alt="${name}"><h2 class="woocommerce-loop-product__title">${name}</h2></a><a href="/product/${slug}/" class="button">הוספה לסל</a></li>`;
const results=(q,cards)=>`<html><head><title>תוצאות חיפוש: ${q}</title></head><body><header><nav><a href="/product/menu-item/">פריט בתפריט</a></nav></header><main><h1>תוצאות עבור "${q}"</h1><ul class="products">${cards.join('')}</ul></main><footer><a href="mailto:info@shop.co.il">info@shop.co.il</a></footer></body></html>`;
const none=q=>`<html><head><title>${q}</title></head><body><h1>${q}</h1><p>לא נמצאו מוצרים התואמים את הבחירה שלך.</p></body></html>`;

test('the URL index becomes stores with product-page counts and a platform hint',()=>{
 const lines=['https://www.a.co.il/products/x','https://a.co.il/products/y','https://b.co.il/product/z','https://b.co.il/about','nonsense'].map(url=>url==='nonsense'?url:JSON.stringify({url})).join('\n');
 const m=storesFromIndex(lines);
 assert.equal(m.get('a.co.il').productUrls,2);assert.equal(platformHint(m.get('a.co.il')),'shopify');assert.equal(platformHint(m.get('b.co.il')),'woocommerce');assert.equal(m.get('b.co.il').productUrls,1);
});
test('shopper variants: English keyboard layout, a swapped-letter typo, a Hebrew prefix',()=>{
 assert.equal(englishLayout('שמלה'),'ankv');assert.equal(englishLayout('מסכה לשיער'),'nxfv kahgr');
 assert.equal(typo('מחברות'),'מחרבות');assert.equal(typo('אב'),null);
 assert.equal(prefixed('שמלה'),'השמלה');assert.equal(prefixed('הדפסה'),null);assert.equal(prefixed('nike'),null);
 assert.ok(titleMatches('פולדרים','פולדר קשיח'));assert.ok(titleMatches('השמלות','שמלת ערב'));assert.ok(!titleMatches('שמפו','שמן לשיער'));
});
test('result pages: products are counted by their links, menus ignored; an explicit "no results" is zero; a silent page is unknown',()=>{
 const r=parseResults(results('שמלה',[card('red-dress','שמלה אדומה'),card('blue-dress','שמלה כחולה')]),'שמלה','https://shop.co.il/?s=שמלה');
 assert.deepEqual(r,{measurable:true,count:2,titles:['שמלה אדומה','שמלה כחולה'],emptyMessage:false});
 assert.equal(parseResults(none('zqxjv'),'zqxjv','https://shop.co.il/?s=zqxjv').count,0);
 assert.equal(parseResults(none('zqxjv'),'zqxjv','https://shop.co.il/?s=zqxjv').measurable,true);
 assert.equal(parseResults('<html><body>חיפשת zqxjv , תוצאות: 0</body></html>','zqxjv','https://k.co.il/search/?q=zqxjv').measurable,true,'Konimbo wording');
 assert.equal(parseResults('<html><title>x</title><body><h1>שמלה</h1><div id="app"></div></body></html>','שמלה','https://shop.co.il/?s=שמלה').measurable,false);
 assert.equal(parseResults('<html><title>Home</title><body>'+card('a','A')+'</body></html>','שמלה','https://shop.co.il/?s=שמלה').measurable,false,'a page that never mentions the query is not its results page');
 const single=parseResults('<html><body><h1>שמלה אדומה</h1><script type="application/ld+json">{"@type":"Product","name":"שמלה אדומה","offers":{"price":1}}</script></body></html>','שמלה','https://shop.co.il/product/red-dress/');
 assert.deepEqual([single.count,single.titles[0]],[1,'שמלה אדומה']);
 assert.deepEqual(parseSuggest(JSON.stringify({resources:{results:{products:[{title:'A'},{title:'B'}]}}})).titles,['A','B']);
});
test('the site search form is used with its hidden fields; platform endpoints and vendors are recognised',()=>{
 const form=searchForm('<form role="search" action="/"><input type="search" name="s"><input type="hidden" name="post_type" value="product"></form>','https://shop.co.il/');
 assert.deepEqual(form,{action:'https://shop.co.il/',param:'s',hidden:{post_type:'product'}});
 const plans=searchPlan('woocommerce',form,'https://shop.co.il/');
 assert.equal(plans[0].url('שמלה'),'https://shop.co.il/?post_type=product&s=%D7%A9%D7%9E%D7%9C%D7%94');
 assert.ok(plans.some(p=>p.kind==='wc'));assert.ok(!searchPlan('woocommerce',form,'https://shop.co.il/',['FiboSearch']).some(p=>p.kind==='wc'));
 assert.equal(searchPlan('shopify',null,'https://s.co.il/')[0].kind,'json');
 assert.deepEqual(searchProviders('<script src="https://cdn.klevu.com/x.js"></script><div class="dgwt-wcas-search">'),['Klevu','FiboSearch']);
});
test('queries: grounded in the catalog, with typo / layout / prefix variants of the answerable ones',async()=>{
 const ask=async()=>({queries:[{q:'שמלות',kind:'head'},{q:'One Shop',kind:'brand'},{q:'שמלה לחתונה',kind:'natural',intent:'שמלות ערב'},{q:'bad',kind:'weird'}]});
 const qs=await planQueries({title:'One Shop',nav:['שמלות','חולצות'],products:[{title:'שמלת ערב שחורה',type:'שמלות',brand:'Zara'}]},{ask});
 assert.deepEqual(qs.map(q=>[q.q,q.kind,q.of||null]),[['שמלות','head',null],['שמלה לחתונה','natural',null],['שלמות','typo','שמלות'],['anku,','layout','שמלות'],['השמלות','prefix','שמלות']]);
 const plain=await planQueries({title:'x',nav:['חולצות'],products:[]});
 assert.equal(plain[0].q,'חולצות');assert.ok(plain.some(q=>q.kind==='layout'));
});
test('judging: variants pass when they reach what the intended query reached; the score weighs each check',async()=>{
 const rs=[{q:'שמלה',kind:'head',measurable:true,count:2,titles:['שמלה אדומה','שמלה כחולה']},{q:'ankv',kind:'layout',of:'שמלה',measurable:true,count:0,titles:[]},{q:'שמלע',kind:'typo',of:'שמלה',measurable:true,count:1,titles:['שמלה אדומה']},{q:'מתנה',kind:'natural',measurable:true,count:3,titles:['כוס','צלחת','מזלג']},{q:'x',kind:'synonym',measurable:false,count:0,titles:[]}];
 const j=await judge(rs);
 assert.deepEqual(j.map(r=>r.pass),[true,false,true,false,null]);
 const s=scoreSearch(j);
 assert.equal(s.score,Math.round((25+15)/(25+10+15+8)*100));assert.equal(s.zeroRate,25);
 assert.deepEqual(s.fixes.map(f=>f.kind),['layout','natural']);assert.deepEqual(s.fixes[0].examples,['ankv']);
 const judged=await judge(rs.slice(3,4),{ask:async()=>({verdicts:[{i:0,relevant:4}]})});assert.equal(judged[0].pass,true);
});
test('contacts come from the business\'s own pages; junk addresses are dropped',()=>{
 const c=extractContacts('<body><a href="mailto:Sales@Shop.co.il?subject=hi">כתבו לנו</a> טלפון: 03-1234567 או 054-123-4567 *2700 <a href="https://wa.me/972541234567">וואטסאפ</a><a href="https://facebook.com/shop">fb</a><img src="logo@2x.png"> ח.פ. 514123456 support@sentry.io</body>');
 assert.deepEqual(c.emails,['sales@shop.co.il']);assert.deepEqual(c.phones,['031234567','0541234567','*2700']);assert.deepEqual(c.whatsapp,['972541234567']);
 assert.equal(c.social.facebook,'https://facebook.com/shop');assert.equal(c.companyId,'514123456');
 assert.deepEqual(contactPages('<a href="/about">אודות</a><a href="/contact-us">צור קשר</a><a href="https://other.co/contact">x</a><a href="/shop">חנות</a>','https://shop.co.il/'),['https://shop.co.il/contact-us','https://shop.co.il/about']);
});

// Unlisted searches get the store's "no results" page.
const store=(search,fallback=none)=>{const pages=site({
 '/':'<html><head><title>חנות שמלות</title></head><body><nav><a href="/c/dresses">שמלות</a><a href="/contact">צור קשר</a></nav><form role="search" action="/"><input type="search" name="s"><input type="hidden" name="post_type" value="product"></form><script src="/wp-content/plugins/woocommerce/x.js"></script></body></html>',
 '/contact':'<body>טלפון 03-7654321 <a href="mailto:owner@dress.co.il">owner@dress.co.il</a></body>',
 '/wp-json/wc/store/v1/products?per_page=100':JSON.stringify([{name:'שמלה אדומה',categories:[{name:'שמלות'}]},{name:'שמלה כחולה',categories:[{name:'שמלות'}]}]),
 ...Object.fromEntries(Object.entries(search).map(([q,v])=>[`/?post_type=product&s=${q}`,v])),
});return async(url,o)=>{const u=new URL(url),q=u.searchParams.get('s');const r=await pages(url,o);return r.status===404&&q!==null&&u.pathname==='/'?{status:200,url,text:fallback(q)}:r;};};
test('a store whose search breaks on typos and layout becomes a lead with its contacts; a good one does not',async()=>{
 const hits=[card('red','שמלה אדומה'),card('blue','שמלה כחולה')];
 const bad=await auditStore('dress.co.il',{get:store({'שמלות':results('שמלות',hits),'שמלה אדומה':results('שמלה אדומה',hits.slice(0,1))}),delayMs:0});
 assert.equal(bad.status,'audited');assert.equal(bad.platform,'woocommerce');assert.equal(bad.measuredVia,'results-page');
 assert.ok(bad.score<70);assert.equal(bad.lead,true);assert.deepEqual(bad.contacts.emails,['owner@dress.co.il']);assert.ok(bad.contacts.phones.includes('037654321'));
 const good=await auditStore('dress.co.il',{get:store({zqxjv:none('zqxjv')},q=>results(q,[...hits,card('q-'+encodeURIComponent(q),'שמלה '+q)])),delayMs:0});
 assert.equal(good.score,100);assert.equal(good.lead,false);assert.equal(good.contacts,undefined);
});
test('pages that cannot be read honestly are not scored: same list for every query, or products shown for nonsense',async()=>{
 const hits=[card('red','שמלה אדומה'),card('blue','שמלה כחולה')],all=q=>results(q,hits);
 const ignores=await auditStore('dress.co.il',{get:store({},all),delayMs:0});
 assert.equal(ignores.status,'unmeasurable');assert.equal(ignores.lead,undefined);
 const moved=await auditStore('old.co.il',{get:async url=>new URL(url).hostname==='old.co.il'?{status:301,url:'https://new.co.il/',text:'',offsite:true}:{status:503,url,text:'',blocked:true},delayMs:0});
 assert.deepEqual([moved.host,moved.movedFrom,moved.status],['new.co.il','old.co.il','unreachable']);
});
