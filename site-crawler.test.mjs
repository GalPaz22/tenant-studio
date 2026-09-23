import {test} from 'node:test';import assert from 'node:assert/strict';
import {robotsRules,robotsAllows,parseProductPage,runCrawl,mergeCrawl} from './core/site-crawler.mjs';
import {existingProject} from './existing-client.mjs';

test('robots rules: longest match wins, wildcards and other agents are respected',()=>{
 const r=robotsRules('User-agent: OAI-SearchBot\nDisallow: /\n\nUser-agent: *\nAllow: /\nDisallow: /catalogsearch/result/\nDisallow: /*?q=\nDisallow: /*price=*\nCrawl-delay: 2');
 assert.equal(r.delay,2);assert.ok(robotsAllows(r,'https://x.co/011375350'));assert.ok(!robotsAllows(r,'https://x.co/catalogsearch/result/?a=1'));assert.ok(!robotsAllows(r,'https://x.co/books?q=a'));assert.ok(!robotsAllows(r,'https://x.co/books?price=1-2'));
});
test('product JSON-LD yields sku, author, publisher, price and stock',()=>{
 const html=`<script type="application/ld+json">{"@type":"book","name":"נעלם בלי להשאיר סימן","url":"https://s.co/011375350","sku":"011375350","offers":{"@type":"Offer","availability":"InStock","price":"86.40","priceCurrency":"ILS"},"publisher":"כנרת זמורה","author":"הרלן קובן"}</script>`;
 const p=parseProductPage(html,'https://s.co/011375350');assert.deepEqual([p.sku,p.author,p.publisher,p.price,p.stockStatus],['011375350','הרלן קובן','כנרת זמורה',86.4,'instock']);
 assert.equal(parseProductPage('<html></html>','https://s.co/1'),null);
});
const response=(status,body='',location)=>({status,headers:{get:k=>k==='location'?location:null},text:async()=>body});
test('a crawl stops when the host redirects off-site, and resumes from its checkpoint',async()=>{
 const saves=[];const store={save:async s=>{saves.push(s.next);return s;}};
 const state={queue:['https://s.co/1','https://s.co/2'],next:0,products:{},errors:{},failures:0,robots:{rules:[]}};
 let calls=0;const blocked=async()=>{calls++;return response(302,'','https://abuse.host/');};
 const originalTimeout=global.setTimeout;global.setTimeout=(fn)=>originalTimeout(fn,0);
 try{await runCrawl(state,{store,fetcher:blocked,rateMs:0});}finally{global.setTimeout=originalTimeout;}
 assert.equal(state.status,'blocked');assert.equal(state.next,0);assert.equal(calls,3);
 const ok=async url=>response(200,`<script type="application/ld+json">{"sku":"${url.split('/').pop()}","name":"n","offers":{"availability":"OutOfStock"}}</script>`);
 await runCrawl(state,{store,fetcher:ok,rateMs:0});assert.equal(state.status,'done');assert.deepEqual(Object.keys(state.products),['1','2']);
});
test('merge fills missing authors, refreshes stock and adds products the database lacks',()=>{
 const p=existingProject('s',{dbName:'s'},[{id:'online:iw:IL:011374531',name:'הילד מהיער',url:'https://s.co/011374531',stockStatus:'instock'}]);
 const counts=mergeCrawl(p,{products:{'011374531':{sku:'011374531',name:'הילד מהיער',author:'הרלן קובן',stockStatus:'outofstock',price:88,crawledAt:'t'},'011375350':{sku:'011375350',name:'נעלם בלי להשאיר סימן',url:'https://s.co/011375350',author:'הרלן קובן',stockStatus:'instock',price:86.4,crawledAt:'t'}}});
 assert.deepEqual(counts,{updated:1,added:1,stockChanged:1,authorsFilled:1});
 const added=p.productCards.find(c=>c.title==='נעלם בלי להשאיר סימן');assert.equal(added.id,'online:iw:IL:011375350');assert.equal(added.specifications.author,'הרלן קובן');
 assert.deepEqual(p.searchIndex.terms['קובן'].sort(),['online:iw:IL:011374531','online:iw:IL:011375350']);
});
