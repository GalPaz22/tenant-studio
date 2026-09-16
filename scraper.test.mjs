import {test} from 'node:test';import assert from 'node:assert/strict';
import {extractObservations,applyObservations,scrapeCatalog} from './scraper.mjs';
const products=[{id:'1',url:'https://example.com/product/a'},{id:'2',url:'https://example.com/product/b'}];
test('Garmin custom cards associate stock links and NEW labels with the correct product',()=>{
 const html='<article class="css-article-product"><a href="/product/a">A</a><a class="garmin-bs-plp-badge" href="/product/a?open_branch_stock=1"><span aria-hidden="true"></span>זמין בסניפי הרשת</a><div class="product-label"><svg></svg><p>NEW</p></div></article><article class="css-article-product"><a href="/product/b">B</a></article>';
 const result=extractObservations(html,'https://example.com/',products);
 assert.deepEqual(result[0].badges.map(b=>b.text),['זמין בסניפי הרשת','NEW']);
 assert.deepEqual(result[1].badges,[]);
});
test('badges stay on their own card; hidden and unrelated labels are excluded',()=>{
 const html='<span class="badge">Global</span><ul><li class="product"><a href="/product/a">A</a><span class="onsale">מבצע</span><span class="badge" hidden>Hidden</span></li><li class="product"><a href="/product/b">B</a><span class="badge">חדש</span><span class="tagged_as"><a rel="tag">Sport</a></span></li></ul>';
 const result=extractObservations(html,'https://example.com/',products);
 assert.deepEqual(result[0].badges.map(b=>b.text),['מבצע']);assert.deepEqual(result[1].badges.map(b=>b.text),['חדש']);assert.deepEqual(result[1].tags,['Sport']);
});
test('rerun removes stale scraper labels on observed cards, preserves manual badges and unvisited products',()=>{
 const original=[{...products[0],badges:[{text:'Old',source:'site-scraper'},{text:'Manual',source:'sync'}]}, {...products[1],badges:[{text:'Keep',source:'site-scraper'}]}];
 const scan={observations:[{id:'1',badges:[],tags:[],sourceUrl:'https://example.com/',observedAt:'now'}]};
 const updated=applyObservations(original,scan);assert.deepEqual(updated[0].badges.map(b=>b.text),['Manual']);assert.deepEqual(updated[1],original[1]);assert.deepEqual(applyObservations(updated,scan),updated);
});
test('failed pages preserve previous data and report failures',async()=>{
 const result=await scrapeCatalog({url:'https://example.com',catalog:{products}},async()=>{throw Error('timeout')});assert.equal(result.errors.length,3);assert.equal(result.observations.length,0);
});
