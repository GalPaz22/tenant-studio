import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {storeHome,detectStore,demoBuildOptions,pageLinks,productEvidence} from './core/onboard.mjs';
import {collectCatalog} from './core/catalog.mjs';
import {newBuild,executeBuild,validateBuildOptions} from './core/build.mjs';
import {createRunStore} from './core/run-store.mjs';
import {createDraftRuntime} from './runtime.mjs';
import {hash} from './core/catalog.mjs';

const site=pages=>async url=>{const u=new URL(url),key=u.pathname+u.search;if(key in pages)return pages[key];throw Error('Source HTTP 404');};
const jsonld=(name,sku,price)=>`<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'Product',name,sku,offers:{price,priceCurrency:'ILS',availability:'https://schema.org/InStock'}})}</script>`;
// A store without an API, sitemap or JSON-LD: products live in markup under /item/<slug>, reached from a category page.
const markup=(name,price)=>`<html><body><h1 class="t">${name}</h1><span class="price" data-price-amount="${price}">₪${price}</span><button>הוספה לסל</button><p class="stock">במלאי</p></body></html>`;
const plain={
 '/':'<html><head><title>Pots &amp; Pans</title></head><body><a href="/category/kitchen">מטבח</a><a href="/about">אודות</a><a href="/cart">סל</a></body></html>',
 '/robots.txt':'User-agent: *\nDisallow: /item/secret',
 '/category/kitchen':'<a href="/item/pan">מחבת</a><a href="/item/pot">סיר</a><a href="/item/secret">סוד</a><a href="/category/kitchen?page=2&utm=x">2</a><a href="https://other.co/item/x">x</a>',
 '/category/kitchen?page=2':'<a href="/item/wok">ווק</a><a href="/item/pan#reviews">מחבת</a>',
 '/about':'<h1>עלינו</h1>',
 '/item/pan':markup('מחבת',120),'/item/pot':markup('סיר',150),'/item/wok':markup('ווק',99),'/item/secret':markup('סוד',1),
};
const spec={productUrl:'^/item/([a-z0-9-]+)$',sitemapFilter:'product',fields:{name:{selector:'h1.t'},price:{selector:'.price',attr:'data-price-amount'},availability:{selector:'.stock',instock:'במלאי'}}};

test('a bare domain becomes the store home over HTTPS; private or odd addresses are refused',()=>{
 assert.equal(storeHome('shop.co.il'),'https://shop.co.il/');assert.equal(storeHome('http://shop.co.il/some/page?x=1'),'https://shop.co.il/');
 assert.throws(()=>storeHome('localhost'));assert.throws(()=>storeHome('https://u:p@shop.co'));assert.throws(()=>storeHome(''));
});
test('links keep only same-origin pages with plain pagination; product evidence tells JSON-LD from markup',()=>{
 assert.deepEqual(pageLinks(plain['/category/kitchen'],'https://pots.co/category/kitchen','https://pots.co/'),['https://pots.co/item/pan','https://pots.co/item/pot','https://pots.co/item/secret','https://pots.co/category/kitchen?page=2']);
 assert.equal(productEvidence('<html>'+jsonld('A','1',5)+'</html>'),'jsonld');assert.equal(productEvidence(markup('סיר',150)),'markup');assert.equal(productEvidence(plain['/about']),null);
});
test('Shopify and WooCommerce public catalogs are detected by probing, not by guessing',async()=>{
 const shopify=await detectStore('https://shop.co',{fetchSource:site({'/':'<script src="https://cdn.shopify.com/x.js"></script><title>Shop</title>','/products.json?limit=1':JSON.stringify({products:[{id:1}]})})});
 assert.equal(shopify.platform,'shopify');assert.deepEqual(shopify.source,{sourceType:'platform',scraper:false});assert.equal(shopify.title,'Shop');
 const woo=await detectStore('wp.co',{fetchSource:site({'/':'<link href="/wp-content/plugins/woocommerce/a.css">','/wp-json/wc/store/v1/products?per_page=1':'[{"id":3}]'})});
 assert.equal(woo.platform,'woocommerce');assert.equal(woo.source.sourceType,'platform');
 // WooCommerce with a closed Store API falls through to its product sitemap and JSON-LD pages.
 const closed=await detectStore('wp.co',{fetchSource:site({'/':'<link href="/wp-content/plugins/woocommerce/a.css">','/robots.txt':'Sitemap: https://wp.co/sitemap_index.xml',
  '/sitemap_index.xml':'<sitemapindex><sitemap><loc>https://wp.co/post-sitemap.xml</loc></sitemap><sitemap><loc>https://wp.co/product-sitemap.xml</loc></sitemap></sitemapindex>',
  '/product-sitemap.xml':'<urlset><url><loc>https://wp.co/product/a</loc></url><url><loc>https://wp.co/product/b</loc></url></urlset>',
  '/product/a':jsonld('A','a1',10),'/product/b':jsonld('B','b1',20)})});
 assert.equal(closed.platform,'custom');assert.deepEqual(closed.source,{sourceType:'sitemap',sitemapUrl:'https://wp.co/sitemap_index.xml',sitemapFilter:'product',scraper:false});
 assert.ok(closed.notes.some(n=>/סגור/.test(n)));
});
test('without API or sitemap the store is followed by its links, and markup-only pages call for a dedicated scraper',async()=>{
 const d=await detectStore('pots.co',{fetchSource:site(plain)});
 assert.equal(d.source.sourceType,'crawl');assert.equal(d.source.scraper,true);assert.ok(d.samples.includes('https://pots.co/item/pan'));assert.ok(!d.samples.includes('https://pots.co/item/secret'),'robots.txt is obeyed');
 const o=demoBuildOptions(d);assert.equal(o.verifySource,false);assert.ok(o.politeMs>=400);assert.equal(o.scanPages,false);
 assert.deepEqual(validateBuildOptions(o,'custom').sourceType,'crawl');
 await assert.rejects(detectStore('empty.co',{fetchSource:site({'/':'<a href="/about">a</a>','/about':'hi'})}),/לא מצאתי דפי מוצר/);
});
test('crawl collection follows links under robots.txt, reads product pages with the spec and never repeats a product',async()=>{
 const assets={},project={id:randomUUID(),url:'https://pots.co/',platform:'custom',scraper:{status:'active',spec}};
 const result=await collectCatalog(project,{sourceType:'crawl',scraper:true},{},{fetchSource:site(plain),asset:async(k,v)=>{assets[k]=v;},checkpoint:async()=>{},control:async()=>{},report:async()=>{}});
 const rows=result.pages.flatMap(k=>assets[k].rows);
 assert.deepEqual(rows.map(r=>r.id).sort(),['pan','pot','wok']);assert.equal(rows.find(r=>r.id==='wok').price,99);assert.equal(rows[0].stockStatus,'instock');
 assert.equal(result.complete,true);assert.equal(result.frontier,undefined);assert.ok(result.pagesDiscovered>=6);
});
test('a sitemap filter reads only product sitemaps',async()=>{
 const pages={'/sitemap.xml':'<sitemapindex><sitemap><loc>https://s.co/pages.xml</loc></sitemap><sitemap><loc>https://s.co/products-1.xml</loc></sitemap></sitemapindex>','/pages.xml':'<urlset><url><loc>https://s.co/about</loc></url></urlset>',
  '/products-1.xml':'<urlset><url><loc>https://s.co/p/1</loc></url></urlset>','/p/1':jsonld('One','1',5),'/about':'<h1>about</h1>'};
 const seen=[],fetchSource=async(u,o)=>{seen.push(new URL(u).pathname);return site(pages)(u,o);},assets={};
 const r=await collectCatalog({id:'x',url:'https://s.co/',platform:'custom'},{sourceType:'sitemap',sitemapUrl:'https://s.co/sitemap.xml',sitemapFilter:'product'},{},{fetchSource,asset:async(k,v)=>{assets[k]=v;},checkpoint:async()=>{},control:async()=>{},report:async()=>{}});
 assert.ok(!seen.includes('/pages.xml')&&!seen.includes('/about'));assert.equal(r.count,1);
});

const profile={name:'Pots',domain:'kitchenware',productTypes:{pan:{categories:[],queryAliases:['מחבת']}},colors:{},finishes:{},queryAliases:{},semanticAliases:{},tagDefinitions:{},badgeCandidates:{categories:[],tags:[]},badgeRules:[],pipeline:{maxCandidates:20,lightweightRouter:false}};
const agent=async prompt=>prompt.startsWith('Return JSON {summary:')?{summary:'Kitchen store',vocabulary:[],shoppingQuestions:[],businessFacts:[],policies:[]}:{profile,message:'ok'};
const model=async({stage})=>({data:stage==='merchant-facts'?{products:[]}:{decisions:[]}});
const research=async()=>({text:'',sources:[],claims:[],queries:[]});

test('a crawled demo build with the dedicated scraper yields searchable cards without a second full read',async()=>{const root=await mkdtemp(tmpdir()+'/onboard-build-');try{
 const repo=createRunStore(root),p={id:randomUUID(),url:'https://pots.co/',platform:'custom',revisions:[],messages:[],events:[],scraper:{status:'active',spec}};
 const options=validateBuildOptions({...demoBuildOptions({source:{sourceType:'crawl',scraper:true}}),politeMs:0},p.platform),run=newBuild(p,options);await repo.save(run);
 const fetched=[];const fetchSource=async(u,_r,o)=>{fetched.push(u);return site(plain)(u,o);};
 const result=await executeBuild(p,run,repo,{fetchSource,agent,model,research});
 assert.ok(result.bundle,JSON.stringify(result.run.errors));assert.equal(result.bundle.productCards.length,3);assert.equal(result.run.coverage.membershipVerified,'skipped');
 assert.ok(!result.run.validation.checks.some(c=>c.name==='source-membership-stable'));assert.equal(fetched.filter(u=>u==='https://pots.co/item/pan').length,1,'each page is read once');
 const rt=createDraftRuntime({...p,...result.bundle,productCardsProfileHash:hash(result.bundle.profile)},{number:1,profile:result.bundle.profile});
 assert.equal((await rt.search({query:'ווק',limit:5})).matches[0].title,'ווק');
}finally{await rm(root,{recursive:true,force:true});}});

test('POST /api/onboard detects, writes and activates a scraper, queues the demo build and ends with a demo-ready client',async()=>{
 const root=await mkdtemp(tmpdir()+'/onboard-api-');process.env.STUDIO_DATA_DIR=root;
 const probe=createServer().listen(0,'127.0.0.1');await new Promise(r=>probe.once('listening',r));const port=probe.address().port;await new Promise(r=>probe.close(r));process.env.STUDIO_PORT=String(port);
 const {app}=await import('./server.mjs');const server=app.listen(port,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{
  app.locals.onboardFetch=site(plain);app.locals.planner=async()=>spec;
  app.locals.buildDeps={fetchSource:async(u,_r,o)=>site(plain)(u,o),agent,model,research};
  const base='http://127.0.0.1:'+port,headers={Host:'127.0.0.1:'+port,'Content-Type':'application/json'};
  headers['X-Studio-Token']=(await (await fetch(base+'/api/session',{headers})).json()).token;
  const response=await fetch(base+'/api/onboard',{method:'POST',headers,body:JSON.stringify({url:'pots.co'})});
  const events=(await response.text()).trim().split('\n').map(l=>JSON.parse(l));
  const done=events.find(e=>e.type==='done');assert.ok(done,JSON.stringify(events.filter(e=>e.type==='error')));
  assert.ok(events.some(e=>e.type==='scraper'&&e.fill.name===1));assert.equal(done.project.onboarding.detection.source.sourceType,'crawl');assert.equal(done.project.scraper.status,'active');
  const id=done.project.id;let p;
  for(let i=0;i<100;i++){p=await (await fetch(base+'/api/projects/'+id,{headers})).json();if(p.revisions?.length||['failed','paused'].includes(p.buildRun?.status))break;await new Promise(r=>setTimeout(r,100));}
  assert.equal(p.revisions.length,1,JSON.stringify(p.buildRun?.errors||p.buildRun?.message));assert.equal(p.catalog.count,3);assert.equal(p.onboarding.status,'ready');assert.match(p.messages.at(-1).text,/מוכן להדגמה/);
  const again=await (await fetch(base+'/api/onboard',{method:'POST',headers,body:JSON.stringify({url:'https://www.pots.co'})})).json();assert.equal(again.existing,true);assert.equal(again.project.id,id);
  const search=await (await fetch(base+'/demo/'+id+'/__semantix/search',{method:'POST',headers,body:JSON.stringify({query:'סיר'})})).json();assert.equal(search.matches[0].title,'סיר');
 }finally{server.close();await rm(root,{recursive:true,force:true});}
});
