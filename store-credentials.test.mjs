import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {mkdtemp,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCredentials,validateWooCredentials,checkWooCredentials} from './core/store-credentials.mjs';
import {authorizedPage,connectorFor,useStoredCredentials} from './core/connectors.mjs';
import {normalizeRecord} from './core/catalog.mjs';

const ck='ck_'+'a'.repeat(40),cs='cs_'+'b'.repeat(40);

test('Woo credentials are validated against the tenant store and kept in a private file',async()=>{
 assert.deepEqual(validateWooCredentials({url:'https://www.store.example/shop',key:ck,secret:cs},'https://store.example/'),{platform:'woocommerce',url:'https://www.store.example',key:ck,secret:cs});
 assert.equal(validateWooCredentials({key:ck,secret:cs},'https://store.example/').url,'https://store.example');
 assert.throws(()=>validateWooCredentials({url:'https://evil.example',key:ck,secret:cs},'https://store.example/'),/דומיין/);
 assert.throws(()=>validateWooCredentials({url:'http://store.example',key:ck,secret:cs},'https://store.example/'),/HTTPS/);
 assert.throws(()=>validateWooCredentials({key:'x',secret:cs},'https://store.example/'),/ck_/);
 assert.throws(()=>validateWooCredentials({key:ck,secret:'x'},'https://store.example/'),/cs_/);
 const dir=await mkdtemp(join(tmpdir(),'creds-'));
 try{const store=createCredentials(dir);await store.set('p1',{platform:'woocommerce',url:'https://store.example',key:ck,secret:cs,savedAt:'t'});
  assert.equal((await stat(join(dir,'store-credentials.json'))).mode&0o777,0o600);
  assert.equal((await createCredentials(dir).get('p1')).secret,cs);
  const view=await store.view('p1');assert.equal(view.key,'ck_…aaaa');assert.ok(!JSON.stringify(view).includes(cs));
  await store.remove('p1');assert.equal(await store.get('p1'),null);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('the connection check reports rejected keys and reads the store currency',async()=>{
 const c={url:'https://store.example',key:ck,secret:cs};
 await assert.rejects(checkWooCredentials(c,async()=>{throw Error('Source HTTP 401')}),/דחה את המפתחות/);
 const seen=[];const check=await checkWooCredentials(c,async(url,o)=>{seen.push(url);assert.equal(o.headers.Authorization,'Basic '+Buffer.from(ck+':'+cs).toString('base64'));return url.includes('currencies')?'{"code":"ILS"}':'[{"id":1,"name":"Watch"}]';});
 assert.equal(check.currency,'ILS');assert.equal(check.sample,'Watch');assert.ok(seen[0].startsWith('https://store.example/wp-json/wc/v3/products'));
});

test('stored credentials open an authorized WooCommerce read, with currency and the richer REST fields',async()=>{
 const p={id:randomUUID(),platform:'custom',url:'https://store.example/'};
 useStoredCredentials(id=>id===p.id?{platform:'woocommerce',url:'https://www.store.example',key:ck,secret:cs,check:{currency:'ILS'}}:null);
 try{const connector=connectorFor(p);assert.equal(connector.kind,'woocommerce');assert.equal(connector.origin,'https://www.store.example');
  const state={page:1,pageSize:25};const result=await authorizedPage(p,state,async url=>{assert.ok(url.startsWith('https://www.store.example/wp-json/wc/v3/products?'));
   return JSON.stringify([{id:7,name:'Watch',permalink:'https://store.example/p/watch',price:'90',regular_price:'120',on_sale:true,stock_status:'instock',stock_quantity:4,
    short_description:'<p>Light</p>',description:'<p>Full text</p>',weight:'0.2',dimensions:{length:'4',width:'4',height:'1'},categories:[{name:'Watches'}],tags:[],attributes:[{name:'Color',options:['Black']}]}]);});
  assert.equal(result.rows[0].currency,'ILS');
  const n=normalizeRecord(result.rows[0],result.platform,'https://store.example',result.sourceUrl);
  assert.equal(n.currency,'ILS');assert.equal(n.price,90);assert.equal(n.regularPrice,120);assert.equal(n.stockQuantity,4);assert.equal(n.onSale,true);
  assert.equal(n.description,'Light\nFull text');assert.equal(n.specifications['משקל'],'0.2');assert.equal(n.specifications['מידות'],'4 × 4 × 1');assert.equal(n.specifications.Color,'Black');
  // Keys saved for another host never reach a request.
  useStoredCredentials(()=>({platform:'woocommerce',url:'https://other.example',key:ck,secret:cs}));assert.throws(()=>connectorFor(p),/אינו תואם/);
 }finally{useStoredCredentials(()=>null);}
});

test('store API endpoints: check, save without echoing the secret, enable the authorized source, remove',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-creds-'));process.env.STUDIO_DATA_DIR=dir;process.env.STUDIO_SHOPIFY_INSTALLS='file';
 const id='5a1c2e7d-3f4b-4c8a-9d0e-1f2a3b4c5d6e';
 const server=createServer().listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 process.env.STUDIO_PORT=String(server.address().port);process.env.PORT=process.env.STUDIO_PORT;
 const {app}=await import('./server.mjs');server.on('request',app);
 const url='http://127.0.0.1:'+server.address().port,headers={Host:'127.0.0.1:'+process.env.PORT,'Content-Type':'application/json'};
 try{
  await writeFile(join(dir,id+'.json'),JSON.stringify({id,url:'https://store.example/',platform:'woocommerce',name:'Store',status:'created',events:[],messages:[],revisions:[],updatedAt:new Date().toISOString()}));
  headers['X-Studio-Token']=(await (await fetch(url+'/api/session',{headers})).json()).token;
  const post=(path,body)=>fetch(url+'/api/projects/'+id+path,{method:'POST',headers,body:JSON.stringify(body)});
  app.locals.fetchStoreApi=async()=>{throw Error('Source HTTP 401')};
  const refused=await post('/store-api',{url:'https://store.example',key:ck,secret:cs});assert.notEqual(refused.status,200);assert.match((await refused.json()).error,/דחה/);
  await assert.rejects(readFile(join(dir,'store-credentials.json'),'utf8'),/ENOENT/);
  app.locals.fetchStoreApi=async u=>u.includes('currencies')?'{"code":"ILS"}':'[{"id":1,"name":"Watch"}]';
  const saved=await (await post('/store-api',{url:'https://store.example',key:ck,secret:cs})).json();
  assert.equal(saved.connection.url,'https://store.example');assert.equal(saved.connection.check.currency,'ILS');assert.ok(!JSON.stringify(saved).includes(cs));
  const view=await (await fetch(url+'/api/projects/'+id+'/store-api',{headers})).json();assert.ok(!JSON.stringify(view).includes(cs));assert.equal(view.connection.key,'ck_…aaaa');
  const summary=await (await fetch(url+'/api/projects/'+id,{headers})).json();assert.equal(summary.connectorAvailable,true);assert.ok(!JSON.stringify(summary).includes(cs));
  assert.ok(!(await readFile(join(dir,id+'.json'),'utf8')).includes(cs),'the secret is not in the project');
  await post('/store-api/delete',{});assert.equal((await (await fetch(url+'/api/projects/'+id,{headers})).json()).connectorAvailable,false);
 }finally{delete app.locals.fetchStoreApi;await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});
