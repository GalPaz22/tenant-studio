import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {mkdtemp,readdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {rolloutTest,rolloutOf,readRollout,publishRollout,ROLLOUT_TEST} from './core/takeover-control.mjs';
import {mergeSiteConfig} from './core/search-takeover.mjs';
import {BOOT,buildWooTakeover,buildShopifyTakeover} from './core/takeover-export.mjs';
import {engineDir,ENGINE_FILES} from './core/takeover-preview.mjs';

// A users collection that understands dotted paths, like MongoDB.
function fakeUsers(docs){
 const at=(d,path,make)=>{const keys=path.split('.'),last=keys.pop();let o=d;for(const k of keys){if(o[k]===null||typeof o[k]!=='object'){if(!make)return [null,last];if(o[k]===null)throw Error('Cannot create field in null');o[k]={};}o=o[k];}return [o,last];};
 return {docs,find:q=>({limit:()=>({toArray:async()=>docs.filter(d=>d.dbName===q.dbName&&typeof d.apiKey==='string')})}),
  bulkWrite:async ops=>{let n=0;for(const {updateOne:{filter,update}} of ops){const d=docs.find(x=>x._id===filter._id);if(!d)continue;n++;
   for(const [k,v] of Object.entries(update.$set||{})){const [o,key]=at(d,k,true);o[key]=v;}
   for(const k of Object.keys(update.$unset||{})){const [o,key]=at(d,k,false);if(o)delete o[key];}}
   return {modifiedCount:n};}};
}
const client=users=>({db:()=>({collection:()=>users})});
const project={id:'0f0e0d0c-0b0a-4908-8706-050403020100',url:'https://www.shop.example/',existingClient:{dbName:'shop'}};

test('the rollout is one test in the production siteConfig; everything else in it is left alone',async()=>{
 const users=fakeUsers([
  {_id:'a',username:'store',dbName:'shop',apiKey:'k1',credentials:{siteConfig:{consent:{enabled:true},abTests:{other:{enabled:true,variants:[{id:'x',weight:1}]}}}}},
  {_id:'b',username:'staff',dbName:'shop',apiKey:'k2',credentials:{siteConfig:null}},
  {_id:'c',username:'new',dbName:'shop',apiKey:'k3',credentials:{}},
  {_id:'d',username:'other',dbName:'other',apiKey:'k4',credentials:{siteConfig:{x:1}}}]);
 const backups=await mkdtemp(join(tmpdir(),'rollout-')),opts={backups,client:client(users)};
 assert.equal((await readRollout(project,{client:client(users)})).percent,null);
 const r=await publishRollout(project,30,opts);assert.equal(r.users,3);
 const t=users.docs[0].credentials.siteConfig.abTests[ROLLOUT_TEST];
 assert.deepEqual(t.variants,[{id:'semantix',weight:30},{id:'native',weight:70,features:{shadowMode:true}}]);assert.equal(t.sticky,false);
 assert.deepEqual(users.docs[0].credentials.siteConfig.consent,{enabled:true});assert.ok(users.docs[0].credentials.siteConfig.abTests.other,'another test stays');
 assert.equal(rolloutOf(users.docs[1].credentials.siteConfig),30,'a null siteConfig becomes one that holds the test');assert.equal(rolloutOf(users.docs[2].credentials.siteConfig),30);
 assert.deepEqual(users.docs[3].credentials.siteConfig,{x:1},'another store is never touched');
 assert.deepEqual(await readRollout(project,{client:client(users)}).then(x=>[x.percent,x.consistent]),[30,true]);
 const saved=JSON.parse(await readFile(join(backups,(await readdir(backups))[0]),'utf8'));
 assert.equal(saved.reason,'rollout');assert.deepEqual(saved.users.map(u=>u.siteConfig?.abTests?Object.keys(u.siteConfig.abTests):null),[['other'],null,null]);
 await publishRollout(project,0,opts);assert.equal(rolloutOf(users.docs[0].credentials.siteConfig),0);
 await publishRollout(project,100,opts);assert.equal(rolloutOf(users.docs[1].credentials.siteConfig),100);
 await publishRollout(project,null,opts);assert.equal(rolloutOf(users.docs[0].credentials.siteConfig),null);assert.ok(users.docs[0].credentials.siteConfig.abTests.other);
 await assert.rejects(publishRollout(project,150,opts),/0 ל־100/);await assert.rejects(publishRollout(project,12.5,opts),/שלם/);
 // Copying the demo configuration to production later keeps the rollout.
 const merged=mergeSiteConfig({abTests:{[ROLLOUT_TEST]:rolloutTest(40)}},{platform:'shopify',queryParams:['q'],selectors:{},nativeCard:{},features:{fullReplace:true},replace:{},cartInterceptor:{},clickTracking:{}});
 assert.equal(rolloutOf(merged),40);
});

// The engine's bucket: FNV-1a of "<visitor id>:<test name>" over the variants in order.
const unit=str=>{let h=0x811c9dc5;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,0x01000193);}return (h>>>0)/4294967296;};
const bucket=(vid,test)=>{const total=test.variants.reduce((n,v)=>n+v.weight,0),target=unit(vid+':'+ROLLOUT_TEST)*total;let acc=0;for(const v of test.variants){acc+=v.weight;if(target<acc)return v.id;}return test.variants.at(-1).id;};
test('raising the percentage only adds visitors to Semantix, and the ends are absolute',async()=>{
 const visitors=Array.from({length:4000},(_,i)=>'vis-'+i+'-'+(i*7919).toString(36));
 const share=p=>visitors.filter(v=>bucket(v,rolloutTest(p))==='semantix');
 assert.equal(share(0).length,0);assert.equal(share(100).length,visitors.length);
 const at20=new Set(share(20)),at50=new Set(share(50));
 assert.ok(Math.abs(at20.size/visitors.length-0.2)<0.03&&Math.abs(at50.size/visitors.length-0.5)<0.03,`${at20.size} / ${at50.size}`);
 assert.ok([...at20].every(v=>at50.has(v)),'nobody who had Semantix at 20% loses it at 50%');
 // The engine in the local checkout honours "sticky": false (the split is not remembered in the browser).
 const dir=engineDir();if(dir){const code=await readFile(join(dir,ENGINE_FILES['engine.js']),'utf8');assert.match(code,/test\.sticky !== false/);assert.match(code,/semantix_fx/);}
});

// The boot script in a stand-in browser: localStorage, fetch, <head>.
function browser({kept=null,remote,fx=null,search='?q=cup',path='/search'}={}){
 const items=new Map();if(kept)items.set('semantix_remote_v1',JSON.stringify(kept));if(fx)items.set('semantix_fx',JSON.stringify(fx));
 const head=[],timers=[];let respond;const answered=new Promise(r=>{respond=r;});
 const settings={apiBase:'https://api.example',apiKey:'key12345',engineSrc:'https://cdn/engine.js',endpoints:{siteConfig:'/site-config'},
  siteConfig:{queryParams:['q'],features:{fullReplace:true,autocomplete:true},selectors:{resultsGrid:['ul.g']},replace:{searchPath:'^/search',scope:'main',root:'#main',hide:['.facets']}}};
 const el=tag=>({tag,remove(){const i=head.indexOf(this);if(i>=0)head.splice(i,1);}});
 const ctx={window:{SemantixSettings:settings},location:{pathname:path,search},URLSearchParams,Date,JSON,Object,Array,Number,RegExp,
  localStorage:{getItem:k=>items.has(k)?items.get(k):null,setItem:(k,v)=>items.set(k,v)},
  document:{createElement:el,head:{appendChild:n=>head.push(n)}},
  setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout:id=>{if(timers[id-1])timers[id-1].cancelled=true;},
  fetch:async(url,o)=>{ctx.requested=[url,o.headers['X-API-Key']];const r=typeof remote==='function'?remote():remote;if(r instanceof Error){setImmediate(respond);throw r;}if(typeof r?.then==='function')return r;
   setImmediate(respond);return {ok:r.status===200,status:r.status,json:async()=>r.body};}};
 vm.runInNewContext(BOOT,ctx);
 return {settings,head,items,timers,ctx,answered,engine:()=>head.filter(n=>n.tag==='script').length,hidden:()=>head.some(n=>n.tag==='style')};
}
const settle=async b=>{await b.answered;for(let i=0;i<6;i++)await new Promise(r=>setImmediate(r));};

test('the remote configuration decides: from the first page view, and from the kept answer afterwards',async()=>{
 assert.ok(!BOOT.includes('{{')&&!BOOT.includes('{%'),'safe inside a Liquid block');
 // First visit, the server says Semantix is off: the results area was hidden while waiting, the engine starts with it off.
 let b=browser({remote:{status:200,body:{features:{disabled:true}}}});
 assert.equal(b.engine(),0,'the engine waits for the server');assert.equal(b.hidden(),true);
 await settle(b);
 assert.deepEqual(b.ctx.requested,['https://api.example/site-config','key12345']);
 assert.equal(b.engine(),1);assert.equal(b.hidden(),false);assert.equal(JSON.stringify(b.settings.siteConfig.features),JSON.stringify({fullReplace:true,autocomplete:true,disabled:true}));
 assert.equal(b.settings.siteConfig.consent.enabled,false);
 assert.equal(JSON.parse(b.items.get('semantix_remote_v1')).cfg.features.disabled,true);
 // Later visits use the kept answer at once and do not ask again within 5 minutes.
 b=browser({kept:{ts:Date.now(),key:'key12345',cfg:{abTests:{semantix_takeover:rolloutTest(50)},replace:{hide:['.x']}}},remote:()=>{throw Error('no request expected');}});
 assert.equal(b.engine(),1);assert.equal(b.ctx.requested,undefined);assert.equal(rolloutOf(JSON.parse(JSON.stringify(b.settings.siteConfig))),50);
 assert.equal(JSON.stringify(b.settings.siteConfig.replace),JSON.stringify({searchPath:'^/search',scope:'main',root:'#main',hide:['.x']}),'objects are laid over, lists are replaced');
 assert.equal(b.head.find(n=>n.tag==='style').textContent,'#main>*{visibility:hidden!important}.x{display:none!important}');
 // The cookie-consent bar stays off even when the remote configuration asks for it.
 b=browser({kept:{ts:Date.now(),key:'key12345',cfg:{consent:{enabled:true,title:'x'}}}});assert.equal(b.engine(),1);
 assert.equal(JSON.stringify(b.settings.siteConfig.consent),JSON.stringify({enabled:false,title:'x'}));
 // A kept answer older than 5 minutes is used and refreshed for the next page view.
 b=browser({kept:{ts:Date.now()-6*60000,key:'key12345',cfg:{features:{disabled:true}}},remote:{status:200,body:{}}});
 assert.equal(b.engine(),1);assert.equal(b.hidden(),false);await settle(b);
 assert.equal(JSON.stringify(JSON.parse(b.items.get('semantix_remote_v1')).cfg),'{}');assert.equal(b.settings.siteConfig.features.disabled,true,'this page view keeps what it started with');
 // No remote configuration (404), a failing server, a slow server: the written configuration runs.
 b=browser({remote:{status:404,body:{error:'siteConfig not found'}}});await settle(b);
 assert.equal(b.engine(),1);assert.equal(b.hidden(),true);assert.equal(b.settings.siteConfig.features.disabled,undefined);
 b=browser({remote:Error('network')});await settle(b);assert.equal(b.engine(),1);assert.equal(b.items.has('semantix_remote_v1'),false);
 b=browser({remote:()=>new Promise(()=>{})});const wait=b.timers.find(t=>t.ms===2000);assert.ok(wait);wait.fn();assert.equal(b.engine(),1);
 // A visitor the engine recorded as getting the store's own results is never hidden; a kept answer of another key is ignored.
 b=browser({kept:{ts:Date.now(),key:'key12345',cfg:{}},fx:{fullReplace:false}});assert.equal(b.hidden(),false);assert.equal(b.engine(),1);
 b=browser({kept:{ts:Date.now(),key:'another',cfg:{features:{disabled:true}}},remote:{status:404,body:{}}});assert.equal(b.engine(),0);await settle(b);assert.equal(b.engine(),1);assert.equal(b.settings.siteConfig.features.disabled,undefined);
 // Not a results page: nothing is hidden.
 b=browser({kept:{ts:Date.now(),key:'key12345',cfg:{}},path:'/products/x',search:''});assert.equal(b.hidden(),false);assert.equal(b.engine(),1);
});

test('the WooCommerce export is a plugin with the same boot, and both exports explain the remote control',()=>{
 const siteConfig={platform:'woocommerce',queryParams:['s'],features:{fullReplace:true,autocomplete:true},selectors:{resultsGrid:['ul.products']},nativeCard:{cardTemplate:'<li class="product"><a href="{{url}}">{{name}}</a></li>'},replace:{scope:'main',root:'main'},addToCart:{mode:'engine'}};
 const engine='(function(){const S=window.SemantixSettings||{};})();',p={...project,takeover:{siteConfig}};
 const {manifest,files}=buildWooTakeover(p,{apiBase:'https://api.example.com',apiKey:'site_key_12345678',engine,now:new Date('2026-10-03T10:00:00Z')});
 assert.deepEqual(Object.keys(files),['semantix-search/semantix-search.php','semantix-search/assets/semantix-config.js','semantix-search/assets/semantix-engine.js','semantix-search/INSTALL.md','semantix-search/manifest.json']);
 assert.match(files['semantix-search/semantix-search.php'],/Plugin Name: Semantix Search/);assert.match(files['semantix-search/semantix-search.php'],/add_action\('wp_head'[\s\S]*assets\/semantix-config\.js[\s\S]*, 1\);/);
 // The configuration script, run as the page would: settings from the file, the engine URL beside it.
 const head=[],ctx={window:{},location:{pathname:'/',search:''},URLSearchParams,Date,JSON,Object,Array,Number,RegExp,localStorage:{getItem:()=>JSON.stringify({ts:Date.now(),key:'site_key_12345678',cfg:{}}),setItem:()=>{}},
  document:{currentScript:{src:'https://shop.example/wp-content/plugins/semantix-search/assets/semantix-config.js?v=1'},createElement:tag=>({tag,remove(){}}),head:{appendChild:n=>head.push(n)}},setTimeout:()=>0,clearTimeout:()=>{},fetch:async()=>({ok:false,status:500})};
 vm.runInNewContext(files['semantix-search/assets/semantix-config.js'],ctx);
 assert.equal(JSON.stringify(ctx.window.SemantixSettings.siteConfig),JSON.stringify({...siteConfig,consent:{enabled:false}}),'the written configuration, with the consent bar off');assert.equal(ctx.window.SemantixSettings.apiKey,'site_key_12345678');
 assert.equal(head[0].src,`https://shop.example/wp-content/plugins/semantix-search/assets/semantix-engine.js?v=${manifest.version}`);
 assert.equal(manifest.delivery,'wordpress-plugin');assert.match(files['semantix-search/INSTALL.md'],/שליטה מרחוק/);
 assert.throws(()=>buildWooTakeover(p,{apiBase:'https://api.example.com',engine}),/מפתח האתר/);
 assert.throws(()=>buildWooTakeover({...p,takeover:{siteConfig:{...siteConfig,platform:'shopify'}}},{apiBase:'https://api.example.com',apiKey:'site_key_12345678',engine}),/WooCommerce/);
 const shopify=buildShopifyTakeover({...p,takeover:{siteConfig:{...siteConfig,platform:'shopify'}}},{apiBase:'https://api.example.com',engine});
 assert.ok(shopify.files['extensions/semantix-search/blocks/semantix-search.liquid'].includes(BOOT));assert.match(shopify.files['INSTALL.md'],/שליטה מרחוק/);
});
