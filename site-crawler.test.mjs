import {test} from 'node:test';import assert from 'node:assert/strict';
import {robotsRules,robotsAllows,parseProductPage,runCrawl,mergeCrawl,retryAfter} from './core/site-crawler.mjs';
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
 try{await runCrawl(state,{store,fetcher:blocked,rateMs:0,pause:async()=>{}});}finally{global.setTimeout=originalTimeout;}
 assert.equal(state.status,'blocked');assert.equal(state.next,0);assert.equal(calls,3);
 const ok=async url=>response(200,`<script type="application/ld+json">{"sku":"${url.split('/').pop()}","name":"n","offers":{"availability":"OutOfStock"}}</script>`);
 await runCrawl(state,{store,fetcher:ok,rateMs:0,pause:async()=>{}});assert.equal(state.status,'done');assert.deepEqual(Object.keys(state.products),['1','2']);
});
test('a throttling host slows the crawl down and waits as asked, instead of ending it',async()=>{
 const store={save:async s=>s},waits=[];
 const state={queue:['https://s.co/1','https://s.co/2'],next:0,products:{},errors:{},failures:0,robots:{rules:[]}};
 let calls=0;const throttled=async url=>++calls<=5?{status:429,headers:{get:k=>k==='retry-after'?'120':null},text:async()=>''}:response(200,`<script type="application/ld+json">{"sku":"${url.split('/').pop()}","name":"n","offers":{"availability":"InStock"}}</script>`);
 await runCrawl(state,{store,fetcher:throttled,rateMs:0,pause:async ms=>{waits.push(ms);}});
 assert.equal(state.status,'done');assert.deepEqual(Object.keys(state.products),['1','2']);
 assert.deepEqual(waits.slice(0,5),[120000,120000,240000,480000,960000]);
 assert.ok(state.paceMs>0,'refusals leave a slower pace for the rest of the crawl');
 const stubborn=async()=>({status:503,headers:{get:()=>null},text:async()=>''}),s2={...state,queue:['https://s.co/3'],next:0,failures:0,status:'ready'};
 await runCrawl(s2,{store,fetcher:stubborn,rateMs:0,pause:async()=>{}});assert.equal(s2.status,'blocked');assert.equal(s2.failures,8);
});
test('retry-after reads seconds and HTTP dates',()=>{assert.equal(retryAfter('30'),30000);assert.equal(retryAfter(new Date(Date.UTC(2026,0,1,0,1)).toUTCString(),Date.UTC(2026,0,1)),60000);assert.equal(retryAfter('soon'),0);});
test('a successful retry clears the old page error and replaces its previous observation',async()=>{
 const url='https://s.co/123456',state={queue:[url],next:0,products:{123456:{sku:'123456',price:100}},errors:{[url]:'HTTP 503'},failures:0,robots:{rules:[]}};
 await runCrawl(state,{store:{save:async s=>s},pause:async()=>{},fetcher:async()=>response(200,'<script type="application/ld+json">{"sku":"123456","name":"Product","offers":{"price":49,"availability":"InStock"}}</script>')});
 assert.deepEqual(state.errors,{});assert.equal(state.products['123456'].price,49);assert.equal(state.status,'done');
});
test('merge fills missing authors, refreshes stock and adds products the database lacks',()=>{
 const p=existingProject('s',{dbName:'s'},[{id:'online:iw:IL:011374531',name:'הילד מהיער',url:'https://s.co/011374531',stockStatus:'instock'}]);
 const counts=mergeCrawl(p,{products:{'011374531':{sku:'011374531',name:'הילד מהיער',author:'הרלן קובן',stockStatus:'outofstock',price:88,crawledAt:'t'},'011375350':{sku:'011375350',name:'נעלם בלי להשאיר סימן',url:'https://s.co/011375350',author:'הרלן קובן',stockStatus:'instock',price:86.4,crawledAt:'t'}}});
 assert.deepEqual(counts,{updated:1,added:1,stockChanged:1,authorsFilled:1});
 const added=p.productCards.find(c=>c.title==='נעלם בלי להשאיר סימן');assert.equal(added.id,'online:iw:IL:011375350');assert.equal(added.specifications.author,'הרלן קובן');
 assert.deepEqual(p.searchIndex.terms['קובן'].sort(),['online:iw:IL:011374531','online:iw:IL:011375350']);
});
