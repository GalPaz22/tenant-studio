import {test} from 'node:test';import assert from 'node:assert/strict';
import {validateSpec,extractWithSpec,productKey,scoreSpec,buildScraper,pageEvidence} from './core/scraper-builder.mjs';
import {mergeCrawl,seedCrawl} from './core/site-crawler.mjs';import {existingProject} from './existing-client.mjs';

// A store without JSON-LD: everything lives in the markup; product URLs are slugs.
const page=(slug,name,price,stock,brand)=>`<html><head><title>${name}</title></head><body><header><nav>menu</nav></header><main><h1 class="product-title">${name}</h1><span class="price" data-price-amount="${price}">₪${price}</span><p class="stock">${stock?'במלאי':'אזל מהמלאי'}</p><div class="brand">מותג: ${brand}</div><section class="related"><h1 class="product-title">מוצר אחר</h1></section></main></body></html>`;
const site={'https://shop.co/p/red-mug':page('red-mug','ספל אדום',39.9,true,'Kiko'),'https://shop.co/p/blue-mug':page('blue-mug','ספל כחול',42,false,'Kiko'),'https://shop.co/p/pan':page('pan','מחבת',120,true,'Tefal'),'https://shop.co/p/pot':page('pot','סיר',150,true,'Tefal')};
const spec={productUrl:'^/p/([a-z0-9-]+)$',sitemapFilter:'product',fields:{name:{selector:'main > h1.product-title'},price:{selector:'.price',attr:'data-price-amount'},availability:{selector:'.stock',instock:'^במלאי'},brand:{selector:'.brand',pattern:'מותג:\\s*(.+)'}}};

test('a spec is validated: unsafe field names and broken regexes are dropped, name is required',()=>{
 const v=validateSpec({...spec,fields:{...spec.fields,'__proto__':{selector:'x'},bad:{pattern:'('},weird:{selector:'div[',jsonld:'x'}}});
 assert.deepEqual(Object.keys(v.fields).sort(),['availability','brand','name','price','weird']);assert.equal(v.fields.weird.selector,undefined);
 assert.throws(()=>validateSpec({productUrl:'x',fields:{price:{selector:'.p'}}}),/name/);assert.throws(()=>validateSpec({productUrl:'(',fields:{name:{selector:'h1'}}}),/productUrl/);
});
test('selector extraction ignores related-product carousels and reads attributes, patterns and stock text',()=>{
 const r=extractWithSpec(site['https://shop.co/p/blue-mug'],'https://shop.co/p/blue-mug',validateSpec(spec));
 assert.deepEqual([r.key,r.name,r.price,r.stockStatus,r.extra.brand],['blue-mug','ספל כחול',42,'outofstock','Kiko']);
 assert.equal(productKey('https://shop.co/p/pan?utm=1',spec),null,'query strings are not product pages');assert.equal(productKey('https://shop.co/cart',spec),null);
 const ev=pageEvidence(site['https://shop.co/p/pan'],'https://shop.co/p/pan');assert.equal(ev.h1,'מחבת');assert.doesNotMatch(ev.skeleton,/menu/);
});
test('build: a weak first spec gets one refinement round with the failures, and validation compares with the catalog',async()=>{
 const p=existingProject('shop',{dbName:'shop'},Object.entries(site).map(([url,html],i)=>({id:'x'+i,name:['ספל אדום','ספל כחול','מחבת','סיר'][i],url,stockStatus:'instock'})));p.url='https://shop.co';
 const prompts=[];const planner=async prompt=>{prompts.push(prompt);return prompts.length===1?{...spec,fields:{name:{selector:'h1'},price:{selector:'.nope'}}}:spec;};
 const b=await buildScraper(p,{planner,fetchPage:async u=>site[u],samples:Object.keys(site).slice(0,2),validation:Object.keys(site).slice(2)});
 assert.equal(prompts.length,2);assert.match(prompts[1],/fell short/);assert.equal(b.status,'draft');assert.equal(b.recommended,true);
 assert.deepEqual(b.validation.fill,{name:1,price:1,stock:1,key:1,author:0});assert.equal(b.validation.catalogAgreement,1);
});
test('the crawl seeds and merges with the dedicated spec (slug keys, extra fields)',async()=>{
 const p=existingProject('shop',{dbName:'shop'},[{id:'shop:red-mug',name:'ספל אדום',url:'https://shop.co/p/red-mug',stockStatus:'outofstock'}]);p.url='https://shop.co';
 const fetcher=async url=>({status:url.endsWith('robots.txt')?200:404,headers:{get:()=>null},text:async()=>'User-agent: *\nDisallow: /p/secret'});
 const state=await seedCrawl(p,{fetcher,spec:validateSpec(spec),clicks:async()=>['https://shop.co/p/pan','https://shop.co/p/secret','https://other.co/p/x','https://shop.co/about'],sources:{clicks:true,sitemap:false,catalog:true}});
 assert.deepEqual(state.queue,['https://shop.co/p/pan','https://shop.co/p/red-mug']);
 const products=Object.fromEntries(['red-mug','pan'].map(k=>{const r=extractWithSpec(site['https://shop.co/p/'+k],'https://shop.co/p/'+k,validateSpec(spec));return [r.key,{...r,sku:r.key,crawledAt:'t'}];}));
 const counts=mergeCrawl(p,{products},validateSpec(spec));assert.equal(counts.added,1);assert.equal(counts.stockChanged,1);
 const pan=p.productCards.find(c=>c.title==='מחבת');assert.equal(pan.id,'shop:pan');assert.equal(pan.specifications.brand,'Tefal');assert.equal(p.productCards.find(c=>c.id==='shop:red-mug').specifications.brand,'Kiko');
});
test('model patterns valid only without the unicode flag still work',()=>{
 const s=validateSpec({productUrl:'^/p/([a-z0-9\\-]+)$',sitemapFilter:'product\\-sitemap',fields:{name:{selector:'h1'},price:{selector:'.price',pattern:'([\\d\\.]+)'}}});
 assert.equal(productKey('https://shop.co/p/red-mug',s),'red-mug');
});
test('a product rule written for the full URL still yields the key',()=>{
 const s=validateSpec({productUrl:'https?://(?:www\\.)?shop\\.co/(\\d{6,15})(?:/|\\?|$)',fields:{name:{jsonld:'name'}}});
 assert.equal(productKey('https://www.shop.co/011375350',s),'011375350');assert.equal(productKey('https://www.shop.co/about',s),null);
});
