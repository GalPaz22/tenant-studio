import {test} from 'node:test';import assert from 'node:assert/strict';
import {extractListingLabels,catalogLookup,scanStoreLabels,applyLabelScan,labelScanConfig,pageUrls} from './core/label-scan.mjs';
import {editionKey} from './core/module-publish.mjs';
import {buildSearchIndex} from './core/search-index.mjs';
const card=(post,url,labels,sale=false)=>`<div class="product-col"><div class="product-item post-${post} product"><div class="product-img">${labels.map(t=>`<span class="custom-label">${t}</span>`).join('')}${sale?'<span class="matat_sale_badge">מבצע</span>':''}<a href="${url}"><img></a></div><div class="product-detail"><a href="${url}">x</a></div></div></div>`;
const products=[{id:'woo_product_11',url:'https://shop.example/product/a'},{id:'woo_product_12',url:'https://shop.example/product/b'},{id:'woo_product_13',url:'https://shop.example/product/c'}];
const project=()=>({id:'p',url:'https://shop.example',catalog:{products:structuredClone(products)},productCards:structuredClone(products).map(p=>({...p,title:p.id,description:'',categories:[],tags:[],specifications:{},badges:[{text:'מבצע',kind:'sale',source:'price'}]})),revisions:[{number:1}]});
test('a listing card gives its store labels to its product, by post id or link; sale pills are not labels',()=>{
 const lookup=catalogLookup(products);
 const html=card(11,'/product/a',['2 ב100 ש"ח','779 ש״ח לחברי vip'],true)+card(99,'https://shop.example/product/b',['10 ב299 ש"ח'])+card(98,'/product/zzz',['לא בקטלוג']);
 const r=extractListingLabels(html,'https://shop.example/shop',lookup);
 assert.equal(r.cards,3);
 assert.deepEqual(Object.fromEntries(r.labels),{woo_product_11:['2 ב100 ש"ח','779 ש״ח לחברי vip'],woo_product_12:['10 ב299 ש"ח']});
});
test('the scan walks /shop, /shop/page/2 … and stops at a missing page; a complete scan clears labels a product lost',async()=>{
 const pages={'https://shop.example/shop':card(11,'/product/a',['2 ב100 ש"ח']),'https://shop.example/shop/page/2':card(12,'/product/b',[])+card(13,'/product/c',['1+1'])};
 const asked=[],fetchSource=async url=>{asked.push(url);if(!pages[url])throw Error('Source HTTP 404');return pages[url];};
 const p=project();p.productCards[1].badges.push({text:'ישן',kind:'merchant',source:'label-scan'});
 const scan=await scanStoreLabels(p,{fetchSource});
 assert.equal(scan.complete,true);assert.equal(scan.products,3);assert.equal(scan.labelled,2);assert.deepEqual(scan.counts,{'2 ב100 ש"ח':1,'1+1':1});
 assert.ok(asked.includes('https://shop.example/shop/page/3'));
 p.searchIndex=buildSearchIndex(p.productCards,'studio-1');
 const before=editionKey(p),summary=applyLabelScan(p,scan);
 assert.equal(p.searchIndex.contentHash,buildSearchIndex(p.productCards,'x').contentHash,'the index follows the relabelled cards');assert.equal(p.searchIndex.version,'studio-1');
 assert.deepEqual(summary.changes,{added:2,removed:1,changed:0});
 assert.deepEqual(p.productCards.map(c=>c.badges.map(b=>b.text)),[['2 ב100 ש"ח','מבצע'],['מבצע'],['1+1','מבצע']]);
 assert.deepEqual(p.catalog.products[0].badges.map(b=>[b.text,b.kind,b.source]),[['2 ב100 ש"ח','merchant','label-scan']]);
 assert.notEqual(editionKey(p),before,'a label change publishes a new edition');
 // Renamed label: only the text changes.
 pages['https://shop.example/shop']=card(11,'/product/a',['2 ב90 ש"ח']);
 const again=applyLabelScan(p,await scanStoreLabels(p,{fetchSource}));
 assert.deepEqual(again.changes,{added:0,removed:0,changed:1});assert.equal(p.productCards[0].badges[0].text,'2 ב90 ש"ח');
});
test('a partial scan (error mid-way) keeps the labels of products it did not see',async()=>{
 const p=project();p.productCards[2].badges.push({text:'1+1',kind:'merchant',source:'label-scan'});
 const fetchSource=async url=>{if(url.endsWith('/page/2'))throw Error('Source timeout');if(url.endsWith('/shop'))return card(11,'/product/a',['2 ב100 ש"ח']);throw Error('Source HTTP 404');};
 const scan=await scanStoreLabels(p,{fetchSource});assert.equal(scan.complete,false);
 applyLabelScan(p,scan);assert.deepEqual(p.productCards[2].badges.map(b=>b.text),['מבצע','1+1']);
});
test('a theme that repeats its last page ends the scan; config is validated',async()=>{
 const p={...project(),labelScanConfig:{concurrency:1}},fetchSource=async()=>card(11,'/product/a',['x']);
 const scan=await scanStoreLabels(p,{fetchSource});assert.equal(scan.pages,2);assert.equal(scan.complete,true);
 assert.equal(pageUrls(p)(3),'https://shop.example/shop/page/3');
 assert.throws(()=>labelScanConfig({labelScanConfig:{pagePattern:'{listing}?page'}}),/נתיב העמודים/);
});
