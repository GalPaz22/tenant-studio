import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {collectCatalog,normalizeRecord,parseCsv} from './core/catalog.mjs';
import {authorizedPage,connectorFor} from './core/connectors.mjs';
import {validateBuildOptions} from './core/build.mjs';
import {validateSync,syncDue} from './core/sync.mjs';

test('authorized WooCommerce paging keeps credentials out of durable page assets',async()=>{const p={id:randomUUID(),platform:'woocommerce',url:'https://example.com/'},old=process.env.STUDIO_CONNECTORS;process.env.STUDIO_CONNECTORS=JSON.stringify({[p.id]:{host:'example.com',key:'fixture-key',secret:'fixture-secret'}});
 try{const pages=[],state={};const result=await collectCatalog(p,{sourceType:'authorized'},state,{fetchSource:async(url,options)=>{assert.ok(options.headers.Authorization.startsWith('Basic '));assert.equal(new URL(url).searchParams.get('status'),'publish');return JSON.stringify([{id:1,name:'A',permalink:'https://example.com/a',price:'0',regular_price:'0',stock_status:'instock',categories:[],tags:[]}])},asset:async(k,v)=>pages.push(v),checkpoint:async()=>{},control:async()=>{},report:async()=>{}});
  assert.equal(result.complete,true);assert.equal(result.coverage,'authoritative');assert.ok(!JSON.stringify(pages).includes('fixture-secret'));const normalized=normalizeRecord(pages[0].rows[0],'woocommerce','https://example.com',pages[0].sourceUrl);assert.equal(normalized.price,0);assert.equal(normalized.stockStatus,'instock');
 }finally{if(old===undefined)delete process.env.STUDIO_CONNECTORS;else process.env.STUDIO_CONNECTORS=old;}});

test('Shopify authorized connector uses cursors and exhausts variant pagination',async()=>{const p={id:randomUUID(),platform:'shopify',url:'https://example.com/'},old=process.env.STUDIO_CONNECTORS;process.env.STUDIO_CONNECTORS=JSON.stringify({[p.id]:{host:'example.com',shop:'fixture.myshopify.com',token:'fixture-token'}});
 try{let requests=0;const result=await authorizedPage(p,{pageSize:25,apiCursor:'previous'},async(url,options)=>{requests++;assert.ok(url.startsWith('https://fixture.myshopify.com/admin/api/'));assert.equal(options.method,'POST');const body=JSON.parse(options.body);
   if(body.variables.id)return JSON.stringify({data:{product:{variants:{nodes:[{id:'v2',title:'B',price:'20',inventoryPolicy:'CONTINUE'}],pageInfo:{hasNextPage:false}}}}});
   assert.equal(body.variables.cursor,'previous');return JSON.stringify({data:{shop:{currencyCode:'ILS'},products:{nodes:[{id:'p1',title:'Watch',descriptionHtml:'Description',handle:'watch',vendor:'Maker',productType:'Watch',tags:[],status:'ACTIVE',images:{nodes:[]},variants:{nodes:[{id:'v1',title:'A',price:'10',inventoryItem:{tracked:false}}],pageInfo:{hasNextPage:true,endCursor:'variants-next'}}}],pageInfo:{hasNextPage:false,endCursor:'end'}}}});});
  assert.equal(requests,2);assert.equal(result.complete,true);assert.equal(result.rows[0].variants.length,2);const normalized=normalizeRecord(result.rows[0],'shopify','https://example.com',result.sourceUrl);assert.equal(normalized.currency,'ILS');assert.equal(normalized.stockStatus,'instock');assert.equal(normalized.variants.length,2);
 }finally{if(old===undefined)delete process.env.STUDIO_CONNECTORS;else process.env.STUDIO_CONNECTORS=old;}});

test('sitemap crawler follows nested maps, attributes products and marks a failed URL as incomplete',async()=>{const state={},assets=[];const result=await collectCatalog({url:'https://example.com/',platform:'custom'},{sourceType:'sitemap',sitemapUrl:'https://example.com/sitemap.xml'},state,{fetchSource:async url=>{
 if(url.endsWith('/sitemap.xml'))return '<sitemapindex><sitemap><loc>https://example.com/products.xml</loc></sitemap></sitemapindex>';
 if(url.endsWith('/products.xml'))return '<urlset><url><loc>https://example.com/a</loc></url><url><loc>https://example.com/b</loc></url></urlset>';
 if(url.endsWith('/b'))throw Error('Source HTTP 500');return '<script type="application/ld+json">{"@type":"Product","sku":"a","name":"Watch"}</script>';
 },asset:async(k,v)=>assets.push(v),checkpoint:async()=>{},control:async()=>{},report:async()=>{}});assert.equal(result.count,1);assert.equal(result.complete,false);assert.equal(result.errors.length,1);assert.equal(assets[0].rows[0].sku,'a');});

test('feed CSV handles quoted commas/newlines, rejects malformed variant fields, and sync requires a valid interval',()=>{
 const rows=parseCsv('id,name,description\n1,"Watch, A","Line 1\nLine 2"\n');assert.equal(rows[0].name,'Watch, A');assert.equal(rows[0].description,'Line 1\nLine 2');
 assert.throws(()=>normalizeRecord({id:'1',name:'A',url:'https://example.com/a',variants:'not JSON'},'custom','https://example.com','https://example.com/feed'));
 assert.throws(()=>validateBuildOptions({sourceType:'feed',feedUrl:'http://example.com/feed'}));assert.throws(()=>validateSync({intervalMinutes:1}));
 const sync=validateSync({enabled:true,intervalMinutes:15});assert.equal(syncDue({sync,latestBuildId:'a'},Date.parse(sync.nextAt)+1),true);assert.equal(connectorFor({id:randomUUID(),url:'https://example.com',platform:'custom'}),null);
});
