import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHmac} from 'node:crypto';
import {mkdtemp,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validHmac,validShop,authorizeUrl,exchangeCode,fetchFeed,applyFeed,validateFeed,feedDue,createInstalls,appUrls,appCredentials,ensurePixel} from './core/shopify-feed.mjs';
import {appToml} from './core/shopify-apps.mjs';
import {connectorFor,useShopifyInstalls} from './core/connectors.mjs';

const profile={name:'Store',domain:'home',productTypes:{},colors:{},finishes:{},queryAliases:{},tagDefinitions:{},badgeCandidates:{categories:[],tags:[]},badgeRules:[],pipeline:{maxCandidates:20,lightweightRouter:false}};
const sign=(query,secret)=>createHmac('sha256',secret).update(Object.keys(query).sort().map(k=>`${k}=${query[k]}`).join('&')).digest('hex');
const card=(id,over={})=>({id:String(id),title:'מוצר '+id,description:'',specifications:{},url:'https://www.shop.example/products/p'+id,image:'https://cdn/x'+id+'.jpg',images:['https://cdn/x'+id+'.jpg'],price:100,regularPrice:null,stockStatus:'instock',hidden:false,categories:[],tags:[],variants:[{id:'v'+id,sku:'',title:'Default',price:100,regularPrice:null,stockStatus:'instock',options:[],gtin:''}],priceRange:{min:100,max:100},...over});
const row=(id,over={})=>({id:String(id),title:'מוצר '+id,handle:'p'+id,body_html:'<p>תיאור</p>',vendor:'',product_type:'',tags:[],currency:'ILS',published:true,images:[{src:'https://cdn/x'+id+'.jpg'}],variants:[{id:'v'+id,title:'Default',sku:'',price:'100.00',compare_at_price:null,barcode:'',available:true}],...over});
const project=cards=>({id:'cc08140d-e09c-487c-8128-b645820c221b',url:'https://www.shop.example/',platform:'shopify',revisions:[{number:1,profile}],catalog:{products:cards.map(c=>({...c,name:c.title}))},productCards:cards,events:[]});

test('requests are verified with the app secret, and the code is exchanged for a token with product access',async()=>{
 const q={shop:'fox.myshopify.com',timestamp:'1790000000',host:'abc'};
 assert.equal(validHmac({...q,hmac:sign(q,'s3cret')},'s3cret'),true);
 assert.equal(validHmac({...q,hmac:sign(q,'other')},'s3cret'),false);assert.equal(validHmac({...q,shop:'evil.myshopify.com',hmac:sign(q,'s3cret')},'s3cret'),false);assert.equal(validHmac(q,'s3cret'),false);
 assert.ok(validShop('fox-home.myshopify.com'));assert.ok(!validShop('fox.myshopify.com.evil.io'));assert.ok(!validShop('https://fox.myshopify.com'));
 const u=new URL(authorizeUrl({shop:'fox.myshopify.com',clientId:'cid',redirectUrl:'https://studio.example/shopify/p/callback',state:'n1'}));
 assert.equal(u.origin+u.pathname,'https://fox.myshopify.com/admin/oauth/authorize');assert.equal(u.searchParams.get('scope'),'read_products,write_pixels,read_customer_events');assert.equal(u.searchParams.get('state'),'n1');
 const calls=[],ok=async(url,o)=>{calls.push([url,JSON.parse(o.body)]);return {ok:true,json:async()=>({access_token:'shpat_x',scope:'read_products'})};};
 assert.deepEqual(await exchangeCode({shop:'fox.myshopify.com',code:'c1',clientId:'cid',secret:'s3cret',fetch:ok}),{token:'shpat_x',scope:'read_products'});
 assert.deepEqual(calls[0],['https://fox.myshopify.com/admin/oauth/access_token',{client_id:'cid',client_secret:'s3cret',code:'c1'}]);
 await assert.rejects(exchangeCode({shop:'fox.myshopify.com',code:'c',clientId:'cid',secret:'s',fetch:async()=>({ok:true,json:async()=>({access_token:'t',scope:'read_orders'})})}),/read_products/);
 // The app's configuration asks for product access only when the studio can be reached by Shopify.
 process.env.STUDIO_PUBLIC_URL='https://studio.example/';
 const urls=appUrls('p1');assert.deepEqual(urls,{applicationUrl:'https://studio.example/shopify/p1/app',redirectUrl:'https://studio.example/shopify/p1/callback'});
 const toml=appToml({clientId:'abc',name:'semantix-shop',apiVersion:'2027-01',sync:{...urls,scopes:'read_products'}});
 assert.match(toml,/scopes = "read_products"/);assert.match(toml,/application_url = "https:\/\/studio\.example\/shopify\/p1\/app"/);assert.match(toml,/embedded = false/);assert.match(toml,/redirect_urls = \[ "https:\/\/studio\.example\/shopify\/p1\/callback" \]/);
 assert.match(appToml({clientId:'abc',name:'x',apiVersion:'2027-01'}),/scopes = ""/);
 delete process.env.STUDIO_PUBLIC_URL;assert.equal(appUrls('p1'),null);
});

test('the catalog is read page by page, with every variant, waiting when Shopify throttles',async()=>{
 const node=(n,more=false)=>({id:'gid://shopify/Product/'+n,title:'מוצר '+n,handle:'p'+n,descriptionHtml:'',vendor:'V',productType:'כוסות',tags:['a'],status:n===3?'DRAFT':'ACTIVE',onlineStoreUrl:n===2?null:'https://x/p'+n,images:{nodes:[{url:'https://cdn/'+n+'.jpg'}]},
  variants:{nodes:[{id:'gid://shopify/ProductVariant/'+n+'1',title:'A',sku:'s'+n,price:'10.00',compareAtPrice:'15.00',barcode:null,availableForSale:true}],pageInfo:{hasNextPage:more,endCursor:more?'vc':null}}});
 const waits=[],seen=[];let throttled=false;
 const fetch=async(url,o)=>{const {query,variables}=JSON.parse(o.body);seen.push(variables);assert.equal(o.headers['X-Shopify-Access-Token'],'tok');assert.equal(url,'https://fox.myshopify.com/admin/api/2026-07/graphql.json');
  if(!throttled){throttled=true;return {ok:true,status:200,json:async()=>({errors:[{message:'Throttled',extensions:{code:'THROTTLED'}}]})};}
  if(variables.id)return {ok:true,status:200,json:async()=>({data:{product:{variants:{nodes:[{id:'gid://shopify/ProductVariant/12',title:'B',sku:'s1b',price:'8.00',compareAtPrice:null,barcode:null,availableForSale:false}],pageInfo:{hasNextPage:false}}}}})};
  const first=!variables.cursor;
  return {ok:true,status:200,json:async()=>({data:{shop:{currencyCode:'ILS'},products:{nodes:first?[node(1,true),node(2)]:[node(3)],pageInfo:{hasNextPage:first,endCursor:first?'c1':null}}},extensions:{cost:{actualQueryCost:first?900:10,throttleStatus:{currentlyAvailable:first?100:900,restoreRate:100}}}})};};
 const rows=await fetchFeed({shop:'fox.myshopify.com',token:'tok',fetch,sleep:async ms=>{waits.push(ms);}});
 assert.deepEqual(rows.map(r=>[r.id,r.published,r.variants.length]),[['1',true,2],['2',false,1],['3',false,1]]);
 assert.deepEqual(rows[0].variants[1],{id:'12',title:'B',sku:'s1b',price:'8.00',compare_at_price:null,barcode:null,available:false});
 assert.deepEqual(waits,[2000,8000],'once for the throttle error, once to let the bucket refill');
 await assert.rejects(fetchFeed({shop:'fox.myshopify.com',token:'bad',fetch:async()=>({ok:false,status:401,json:async()=>({})})}),e=>e.code==='UNAUTHORIZED');
});

test('the feed updates prices and stock in place, adds new products, hides removed ones and never re-enriches',()=>{
 const cards=Array.from({length:30},(_,i)=>card(i+1,{summary:'תקציר מועשר',extractedFacts:{a:1}}));
 cards[4].hidden=true;                                   // hidden by the operator
 const p=project(cards);p.vectorIndex={contentHash:null,vectors:{}};
 const rows=cards.map(c=>row(c.id));
 rows[0].variants[0]={...rows[0].variants[0],price:'79.90',compare_at_price:'100.00'};   // discounted
 rows[1].variants[0].available=false;                    // sold out
 rows[2].published=false;                                // unpublished
 rows.splice(3,1);                                       // product 4 deleted from the store
 rows.push(row(99,{title:'כוס חדשה',product_type:'כוסות',variants:[{id:'v99',title:'Default',sku:'n99',price:'25.00',compare_at_price:'30.00',barcode:'',available:true}]}));
 const r=applyFeed(p,rows,{now:new Date('2026-10-04T03:00:00Z')});
 assert.deepEqual({updated:r.updated,added:r.added,removed:r.removed,restored:r.restored,unchanged:r.unchanged},{updated:2,added:1,removed:2,restored:0,unchanged:26});
 const by=id=>p.productCards.find(c=>c.id===String(id));
 assert.equal(by(1).price,79.9);assert.equal(by(1).regularPrice,100);assert.equal(by(1).summary,'תקציר מועשר','enrichment is untouched');assert.deepEqual(by(1).extractedFacts,{a:1});
 assert.equal(p.catalog.products[0].price,79.9,'the raw catalog follows');
 assert.equal(by(2).stockStatus,'outofstock');
 assert.equal(by(3).hidden,true);assert.equal(by(3).feedHidden,true);assert.equal(by(4).hidden,true);
 assert.equal(by(5).hidden,true);assert.equal(by(5).feedHidden,undefined);
 const added=by(99);assert.equal(added.title,'כוס חדשה');assert.equal(added.price,25);assert.equal(added.regularPrice,30);assert.equal(added.hidden,false);assert.equal(added.enrichmentStatus,'pending');assert.equal(added.url,'https://www.shop.example/products/p99');assert.deepEqual(added.categories,['כוסות']);
 assert.equal(p.catalog.products.at(-1).source,'shopify-feed');
 assert.equal(p.searchIndex.documents,31);assert.ok(p.searchIndex.terms['חדשה'].includes('99'));
 // The next day product 3 is published again and nothing else moved: only it changes, the operator's choice stays.
 const next=p.productCards.filter(c=>c.id!=='4').map(c=>row(c.id,{variants:[{id:c.variants[0].id,title:c.variants[0].title,sku:c.variants[0].sku,price:String(c.price),compare_at_price:c.regularPrice==null?null:String(c.regularPrice),barcode:'',available:c.stockStatus==='instock'}],title:c.title,product_type:c.categories[0]||''}));
 const r2=applyFeed(p,next);
 assert.deepEqual({updated:r2.updated,added:r2.added,removed:r2.removed,restored:r2.restored},{updated:0,added:0,removed:0,restored:1});
 assert.equal(by(3).hidden,false);assert.equal(by(5).hidden,true);assert.equal(by(4).hidden,true);
 // A read that lost most of the catalog is refused instead of hiding the store.
 assert.throws(()=>applyFeed(p,next.slice(0,5)),/בוטל/);
 assert.equal(p.productCards.filter(c=>!c.hidden).length,29);
});

test('the store token stays out of the project and the browser, and opens the authorized connector',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'installs-')),installs=createInstalls(dir);
 try{
  assert.equal(await installs.get('p1'),null);assert.equal(installs.peek('p1'),null);
  await installs.set('p1',{shop:'fox.myshopify.com',token:'shpat_secret',scope:'read_products',installedAt:'2026-10-03T10:00:00Z'});
  assert.deepEqual(await installs.view('p1'),{shop:'fox.myshopify.com',scope:'read_products',installedAt:'2026-10-03T10:00:00Z'});
  assert.equal((await stat(join(dir,'shopify-installs.json'))).mode&0o077,0,'readable by the studio only');
  assert.equal((await createInstalls(dir).get('p1')).token,'shpat_secret');
  useShopifyInstalls(installs.peek);
  const c=connectorFor({id:'p1',url:'https://www.shop.example/',platform:'shopify'});
  assert.equal(c.kind,'shopify');assert.equal(c.origin,'https://fox.myshopify.com');assert.equal(c.headers['X-Shopify-Access-Token'],'shpat_secret');
  assert.equal(connectorFor({id:'p2',url:'https://www.shop.example/',platform:'shopify'}),null);
  await installs.remove('p1');assert.equal(connectorFor({id:'p1',url:'https://www.shop.example/',platform:'shopify'}),null);
 }finally{useShopifyInstalls(()=>null);await rm(dir,{recursive:true,force:true});}
 // A shared collection: what one studio writes, another reads (after its cache expires), and removal reaches both.
 const docs=new Map(),collection=async()=>({find:()=>({toArray:async()=>[...docs].map(([_id,d])=>({_id,...d}))}),updateOne:async({_id},{$set})=>{docs.set(_id,{...docs.get(_id),...$set});},deleteOne:async({_id})=>{docs.delete(_id);}});
 let clock=0;const render=createInstalls('/nonexistent',{collection}),local=createInstalls('/nonexistent',{collection,now:()=>clock});
 assert.equal(await local.get('p9'),null);
 await render.set('p9',{shop:'fox.myshopify.com',token:'shpat_shared',scope:'read_products',installedAt:'2026-10-04T00:00:00Z',extra:'dropped'});
 assert.equal(await local.get('p9'),null,'still the cached read');clock+=61000;
 assert.deepEqual(await local.get('p9'),{shop:'fox.myshopify.com',token:'shpat_shared',scope:'read_products',installedAt:'2026-10-04T00:00:00Z'});
 assert.deepEqual(await local.ids(),['p9']);assert.equal(local.shared,true);
 await local.remove('p9');assert.equal(docs.size,0);
 process.env.STUDIO_SHOPIFY_APPS=JSON.stringify({p1:{clientId:'cid',secret:'sec'},p2:{clientId:'only'}});
 assert.deepEqual(appCredentials('p1'),{clientId:'cid',secret:'sec'});assert.equal(appCredentials('p2'),null);assert.equal(appCredentials('p3'),null);
 const f=validateFeed({enabled:true},Date.parse('2026-10-03T00:00:00Z'));assert.equal(f.nextAt,'2026-10-04T00:00:00.000Z');
 assert.equal(feedDue({feed:f},Date.parse('2026-10-03T12:00:00Z')),false);assert.equal(feedDue({feed:f},Date.parse('2026-10-04T00:00:01Z')),true);assert.equal(feedDue({feed:{...f,enabled:false}},Date.parse('2026-10-05T00:00:00Z')),false);
 assert.throws(()=>validateFeed({intervalMinutes:5}),/תדירות/);
});

test('install through the studio: the merchant opens the app, the token is kept, the feed runs and reports',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-feed-'));process.env.STUDIO_DATA_DIR=dir;process.env.STUDIO_SHOPIFY_INSTALLS='file';
 const id='cc08140d-e09c-487c-8128-b645820c221b';
 process.env.STUDIO_PUBLIC_URL='https://studio.example';process.env.STUDIO_SHOPIFY_APPS=JSON.stringify({[id]:{clientId:'cid',secret:'s3cret'}});
 const server=createServer().listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 process.env.STUDIO_PORT=String(server.address().port);process.env.PORT=process.env.STUDIO_PORT;
 const {app}=await import('./server.mjs');server.on('request',app);
 const url='http://127.0.0.1:'+server.address().port,headers={Host:'127.0.0.1:'+process.env.PORT,'Content-Type':'application/json'};
 const cards=Array.from({length:3},(_,i)=>card(i+1));
 try{
  await writeFile(join(dir,id+'.json'),JSON.stringify(project(cards)));
  const q={shop:'fox.myshopify.com',timestamp:'1790000000'},qs=o=>new URLSearchParams(o).toString();
  // The merchant never sees the studio: whatever happens, the answer is a redirect into the store's Shopify admin.
  const admin='https://fox.myshopify.com/admin/themes/current/editor?context=apps',embed=admin+'&activateAppId=cid%2Fsemantix-search';
  const go=async(path,extra={})=>{const r=await fetch(url+path,{headers:{...headers,...extra},redirect:'manual'});return [r.status,r.headers.get('location')];};
  // Unsigned or wrongly signed requests start nothing, and a project this studio has no credentials for neither.
  assert.deepEqual(await go(`/shopify/${id}/app?${qs({...q,hmac:'0'.repeat(64)})}`),[302,admin]);
  assert.deepEqual(await go(`/shopify/${'0'.repeat(8)}-0000-0000-0000-${'0'.repeat(12)}/app?${qs(q)}`),[302,admin]);
  assert.deepEqual(await go(`/shopify/${id}/app?shop=evil.example`),[302,'https://admin.shopify.com/']);
  const open=await fetch(`${url}/shopify/${id}/app?${qs({...q,hmac:sign(q,'s3cret')})}`,{headers,redirect:'manual'});
  assert.equal(open.status,302);const to=new URL(open.headers.get('location'));
  assert.equal(to.host,'fox.myshopify.com');assert.equal(to.searchParams.get('redirect_uri'),`https://studio.example/shopify/${id}/callback`);
  const cookie=open.headers.get('set-cookie').split(';')[0],state=to.searchParams.get('state');assert.equal(cookie,'sx_shopify_state='+state);
  app.locals.exchangeCode=async o=>{assert.equal(o.code,'code1');assert.equal(o.secret,'s3cret');return {token:'shpat_live',scope:'read_products'};};
  const back={...q,code:'code1',state};
  // A callback without the browser that started the install keeps no token.
  assert.deepEqual(await go(`/shopify/${id}/callback?${qs({...back,hmac:sign(back,'s3cret')})}`),[302,embed]);
  await assert.rejects(readFile(join(dir,'shopify-installs.json'),'utf8'),/ENOENT/);
  // The real one completes the install and lands on the theme editor with the embed offered for activation.
  assert.deepEqual(await go(`/shopify/${id}/callback?${qs({...back,hmac:sign(back,'s3cret')})}`,{Cookie:cookie}),[302,embed]);
  assert.equal(JSON.parse(await readFile(join(dir,'shopify-installs.json'),'utf8'))[id].token,'shpat_live');
  const saved=JSON.parse(await readFile(join(dir,id+'.json'),'utf8'));assert.equal(saved.shopifyFeed.enabled,true);assert.ok(!JSON.stringify(saved).includes('shpat_live'),'the token is not in the project');
  // Opening the app again goes straight to the admin, without a new authorization.
  assert.deepEqual(await go(`/shopify/${id}/app?${qs({...q,hmac:sign(q,'s3cret')})}`),[302,embed]);
  const session=await (await fetch(url+'/api/session',{headers})).json();headers['X-Studio-Token']=session.token;
  const status=await (await fetch(`${url}/api/projects/${id}/shopify-feed`,{headers})).json();
  assert.deepEqual(status.install,{shop:'fox.myshopify.com',scope:'read_products',installedAt:status.install.installedAt});assert.equal(status.credentials,true);assert.ok(!JSON.stringify(status).includes('shpat'));
  app.locals.fetchFeed=async o=>{assert.equal(o.token,'shpat_live');assert.equal(o.shop,'fox.myshopify.com');const rows=cards.map(c=>row(c.id));rows[0].variants[0].price='55.00';return rows;};
  const run=await fetch(`${url}/api/projects/${id}/shopify-feed/run`,{method:'POST',headers,body:'{}'});
  const events=(await run.text()).trim().split('\n').map(l=>JSON.parse(l)),end=events.at(-1);
  assert.equal(end.type,'done',JSON.stringify(end));assert.equal(end.result.updated,1);assert.equal(end.result.fetched,3);
  const after=JSON.parse(await readFile(join(dir,id+'.json'),'utf8'));
  assert.equal(after.productCards[0].price,55);assert.equal(after.shopifyFeed.last.updated,1);assert.ok(Date.parse(after.shopifyFeed.nextAt)>Date.now()+23*3600000);
  // A revoked token ends the feed and forgets the install.
  app.locals.fetchFeed=async()=>{throw Object.assign(Error('revoked'),{code:'UNAUTHORIZED'});};
  const failed=(await (await fetch(`${url}/api/projects/${id}/shopify-feed/run`,{method:'POST',headers,body:'{}'})).text()).trim().split('\n').map(l=>JSON.parse(l)).at(-1);
  assert.equal(failed.type,'error');
  const off=await (await fetch(`${url}/api/projects/${id}/shopify-feed`,{headers})).json();assert.equal(off.install,null);assert.equal(off.feed.enabled,false);assert.match(off.feed.last.error,/revoked/);
 }finally{delete process.env.STUDIO_PUBLIC_URL;delete process.env.STUDIO_SHOPIFY_APPS;await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});

test('the checkout pixel is created once, updated when its settings change and left alone otherwise',async()=>{
 const calls=[];let stored=null;
 const fetch=async(url,o)=>{const {query,variables}=JSON.parse(o.body);calls.push(query.split('{')[0].trim()+(variables?.id?':'+variables.id:''));assert.equal(url,'https://fox.myshopify.com/admin/api/2026-07/graphql.json');assert.equal(o.headers['X-Shopify-Access-Token'],'tok');
  if(query.startsWith('query'))return {ok:true,status:200,json:async()=>stored?{data:{webPixel:stored}}:{data:{webPixel:null},errors:[{message:'No web pixel was found for this app.'}]}};
  if(query.includes('webPixelCreate')){stored={id:'gid://shopify/WebPixel/1',settings:variables.webPixel.settings};return {ok:true,status:200,json:async()=>({data:{webPixelCreate:{userErrors:[],webPixel:{id:stored.id}}}})};}
  stored={...stored,settings:variables.webPixel.settings};return {ok:true,status:200,json:async()=>({data:{webPixelUpdate:{userErrors:[],webPixel:{id:stored.id}}}})};};
 const settings={apiBase:'https://api.example',apiKey:'k1'},args={shop:'fox.myshopify.com',token:'tok',fetch};
 assert.deepEqual(await ensurePixel({...args,settings}),{id:'gid://shopify/WebPixel/1',created:true,updated:false});
 assert.deepEqual(JSON.parse(stored.settings),settings);
 assert.deepEqual(await ensurePixel({...args,settings}),{id:'gid://shopify/WebPixel/1',created:false,updated:false});
 assert.deepEqual(await ensurePixel({...args,settings:{...settings,apiKey:'k2'}}),{id:'gid://shopify/WebPixel/1',created:false,updated:true});
 assert.equal(JSON.parse(stored.settings).apiKey,'k2');
 assert.equal(calls.filter(c=>c.startsWith('mutation')).length,2);
 await assert.rejects(ensurePixel({...args,settings:{apiBase:'https://api.example'}}),/מפתח האתר/);
 await assert.rejects(ensurePixel({...args,settings,fetch:async()=>({ok:false,status:403,json:async()=>({})})}),e=>e.code==='UNAUTHORIZED');
 await assert.rejects(ensurePixel({...args,settings,fetch:async(u,o)=>({ok:true,status:200,json:async()=>JSON.parse(o.body).query.startsWith('query')?{data:{webPixel:null}}:{data:{webPixelCreate:{userErrors:[{message:'Settings are invalid'}],webPixel:null}}}})}),/Settings are invalid/);
});
