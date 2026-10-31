import {test} from 'node:test';import assert from 'node:assert/strict';
import {robotsRules,robotsAllows,parseProductPage,runCrawl,mergeCrawl,retryAfter,sweepStoreApi,pagesToRead,seedCrawl} from './core/site-crawler.mjs';
import {extractWithSpec,DEFAULT_SPEC} from './core/scraper-builder.mjs';
import {sellable} from './core/core.mjs';
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

const page=(sku,availability='InStock')=>`<script type="application/ld+json">{"sku":"${sku}","name":"n","offers":{"availability":"${availability}"}}</script>`;
const wooSpec={productUrl:'/product/([^/?#]+)',fields:{name:{jsonld:'name'}}};
test('pages are read side by side and applied in queue order; a refusal falls back to one at a time without skipping a page',async()=>{
 const queue=[1,2,3,4,5,6].map(n=>'https://s.co/'+n),state={queue,next:0,products:{},errors:{},failures:0,robots:{rules:[]}};
 let running=0,peak=0,calls=0;
 const fetcher=async url=>{running++;peak=Math.max(peak,running);await new Promise(r=>setImmediate(r));running--;if(++calls===2)return {status:429,headers:{get:()=>null},text:async()=>''};return response(200,page(url.split('/').pop()));};
 await runCrawl(state,{store:{save:async s=>s},fetcher,rateMs:0,concurrency:3,pause:async()=>{}});
 assert.equal(peak,3);assert.equal(state.status,'done');assert.deepEqual(Object.keys(state.products).sort(),['1','2','3','4','5','6']);
 const slow={queue:['https://s.co/1','https://s.co/2'],next:0,products:{},errors:{},failures:0,robots:{rules:[],delay:1}};running=peak=0;calls=-99;
 await runCrawl(slow,{store:{save:async s=>s},fetcher,rateMs:0,concurrency:3,pause:async()=>{}});assert.equal(peak,1,'a crawl-delay keeps it to one at a time');
});
test('a timed-out page is tried again at the end of the queue; a missing page is not',async()=>{
 const queue=['https://s.co/1','https://s.co/2'],state={queue:[...queue],next:0,products:{},errors:{},failures:0,robots:{rules:[]}},calls={};
 const fetcher=async url=>{calls[url]=(calls[url]||0)+1;if(url.endsWith('/1')&&calls[url]===1)throw Error('The operation was aborted due to timeout');if(url.endsWith('/2'))return response(404);return response(200,page('1'));};
 await runCrawl(state,{store:{save:async s=>s},fetcher,rateMs:0,pause:async()=>{}});
 assert.equal(state.status,'done');assert.ok(state.products['1']);assert.deepEqual(Object.keys(state.errors),[queue[1]]);assert.deepEqual([calls[queue[0]],calls[queue[1]]],[2,1]);
});
test('checkpoints hand the store only the pages this run touched',async()=>{
 const saved=[],state={queue:Array.from({length:45},(_,i)=>'https://s.co/'+(i+100)),next:0,products:{old:{sku:'old'}},errors:{},failures:0,robots:{rules:[]}};
 await runCrawl(state,{store:{save:async s=>{saved.push(s.dirty.size);s.dirty.clear();return s;}},rateMs:0,pause:async()=>{},fetcher:async url=>response(200,page(url.split('/').pop()))});
 assert.ok(Math.max(...saved)<=20,'at most a checkpoint of pages at a time: '+saved);
});
test('the Store API listing replaces page reads, and only unseen, changed or newly hidden pages are left to read',async()=>{
 const rows=[{id:1,name:'כיסוי &amp; מגן',permalink:'https://s.co/product/a/',prices:{price:'4900',currency_minor_unit:2,currency_code:'ILS'},is_in_stock:true,is_on_backorder:false,images:[{src:'i'}],categories:[{name:'כיסויים'}]},
  {id:2,name:'מגן',permalink:'https://s.co/product/b/',prices:{price:'2900',currency_minor_unit:2},is_in_stock:true,is_on_backorder:true,images:[],categories:[]}];
 const asked=[],fetcher=async url=>{asked.push(url);return response(200,JSON.stringify(rows));};
 const state={origin:'https://s.co',products:{a:{sku:'a',author:'x',name:'old',url:'u',categories:[]}}};
 const listed=await sweepStoreApi(state,{spec:wooSpec,fetcher,rateMs:0,pause:async()=>{}});
 assert.equal(asked.length,1);assert.equal(listed.complete,true);assert.deepEqual([...listed.swept],['a','b']);
 assert.deepEqual([state.products.a.name,state.products.a.price,state.products.a.author,state.products.a.stockStatus,state.products.a.categories],['כיסוי & מגן',49,'x','instock',['כיסויים']]);
 assert.equal(state.products.b.stockStatus,'onbackorder');
 const again=await sweepStoreApi(state,{spec:wooSpec,fetcher,rateMs:0,pause:async()=>{}});assert.equal(again.changed,0,'an unchanged listing leaves nothing to save');
 const u=k=>'https://s.co/product/'+k+'/',keyOf=url=>url.split('/').at(-2);
 const products={a:{},same:{crawledAt:'2026-10-20',stockStatus:'outofstock'},edited:{crawledAt:'2026-10-20',stockStatus:'outofstock'},soldout:{crawledAt:'2026-10-20',stockStatus:'instock'}};
 const lastmod={[u('same')]:'2026-10-01',[u('edited')]:'2026-10-25',[u('soldout')]:'2026-10-01',[u('new')]:'2026-10-01'};
 assert.deepEqual(pagesToRead(['a','same','edited','soldout','new'].map(u),{products,lastmod,swept:new Set(['a']),sweepComplete:true,keyOf}),[u('edited'),u('soldout'),u('new')]);
 assert.deepEqual(pagesToRead([u('same')],{products,lastmod:{},keyOf}),[u('same')],'no dates: nothing can be skipped');
 const broken=await sweepStoreApi({origin:'https://s.co',products:{}},{spec:wooSpec,fetcher:async()=>response(404),rateMs:0,pause:async()=>{}});assert.equal(broken.complete,false,'a closed API only means the page crawl does the work');
});
test('the sitemap gives each page its date, and a passing sitemap failure does not drop its products',async()=>{
 let tries=0;const fetcher=async url=>{if(url.endsWith('/robots.txt'))return response(404);if(url.endsWith('/sitemap.xml'))return response(200,'<sitemapindex><sitemap><loc>https://s.co/product-sitemap.xml</loc></sitemap></sitemapindex>');if(++tries===1)throw Error('fetch failed');return response(200,'<urlset><url><loc>https://s.co/product/a</loc><lastmod>2026-10-02T10:00:00+00:00</lastmod><image:image><image:loc>https://s.co/i.jpg</image:loc></image:image></url></urlset>');};
 const s=await seedCrawl({id:'x',url:'https://s.co/'},{fetcher,spec:wooSpec,clicks:async()=>[],catalogUrls:async()=>[]});
 assert.deepEqual(s.queue,['https://s.co/product/a']);assert.equal(s.lastmod['https://s.co/product/a'],'2026-10-02T10:00:00+00:00');assert.equal(tries,2);
});
test('backorder is what the store says it is: buyable, kept on merge, and in both the card and the raw row',()=>{
 const spec={...DEFAULT_SPEC,productUrl:'/p/(\\w+)'};
 assert.equal(extractWithSpec(page('1','https://schema.org/BackOrder'),'https://s.co/p/1',spec).stockStatus,'onbackorder');
 assert.equal(extractWithSpec(page('1','https://schema.org/OutOfStock'),'https://s.co/p/1',spec).stockStatus,'outofstock');
 assert.equal(sellable({stockStatus:'onbackorder'},{}),true);assert.equal(sellable({stockStatus:'outofstock',price:10},{}),false);
 const p=existingProject('s',{dbName:'s'},[{id:'7',name:'מגן',url:'https://s.co/p/a7',stockStatus:'instock'}]);
 mergeCrawl(p,{products:{a7:{sku:'a7',name:'מגן',stockStatus:'onbackorder',price:null,crawledAt:'t'}}},{...spec});
 assert.equal(p.productCards[0].stockStatus,'onbackorder');assert.equal(p.catalog.products[0].stockStatus,'onbackorder');
});
