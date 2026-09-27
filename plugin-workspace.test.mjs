import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inflateRawSync} from 'node:zlib';
import {attachPlugin,pluginHead,pluginSummary,readPluginFile,updatePlugin,rollbackPlugin,releasePlugin} from './core/plugin-workspace.mjs';
import {studioAgent} from './core/studio-agent.mjs';
import {existingProject} from './existing-client.mjs';
const files=()=>[{path:'beautics/plugin.php',encoding:'utf8',content:'<?php\n/* Plugin Name: Beautics */'},
 {path:'beautics/card.js',encoding:'utf8',content:'const productId = 196465;'},
 {path:'beautics/image.png',encoding:'base64',content:Buffer.from([0,255,23,128]).toString('base64')}];
const attach=p=>attachPlugin(p,{name:'Beautics',platform:'woocommerce',files:files()});
function unzip(zip){const out={};let i=0;while(zip.readUInt32LE(i)===0x04034b50){const size=zip.readUInt32LE(i+18),n=zip.readUInt16LE(i+26),e=zip.readUInt16LE(i+28),path=zip.subarray(i+30,i+30+n).toString();const start=i+30+n+e;out[path]=inflateRawSync(zip.subarray(start,start+size));i=start+size;}return out;}
test('source imports preserve binary and platform files through edits, release and rollback',()=>{
 const p={revisions:[{number:7}]};attach(p);
 const f=readPluginFile(p,'beautics/card.js');
 assert.throws(()=>updatePlugin(p,{expectedRevision:0,edits:[]}),/השתנה/);
 assert.throws(()=>updatePlugin(p,{expectedRevision:1,edits:[{path:f.path,expectedHash:'stale',content:'x'}]}),/השתנה/);
 updatePlugin(p,{expectedRevision:1,note:'tracking',edits:[{path:f.path,expectedHash:f.hash,content:'const productId = "woo_product_196465";'}]});
 const {zip,release}=releasePlugin(p,{expectedRevision:2}),archive=unzip(zip);
 assert.deepEqual(archive['beautics/image.png'],Buffer.from([0,255,23,128]));assert.match(archive[f.path].toString(),/woo_product_/);
 assert.equal(release.searchRevision,7);assert.equal(release.status,'packaged-not-deployed');
 rollbackPlugin(p,{revision:1,expectedRevision:2});assert.equal(pluginHead(p).number,3);assert.equal(readPluginFile(p,f.path).content,f.content);
 assert.ok(pluginSummary(p).files.every(f=>!('content' in f)));
});
test('untrusted paths, duplicate files, invalid source and stale imports are rejected',()=>{
 for(const path of ['../x','/tmp/x','a/../../x','a/.env','a/.git/config','a\\x'])assert.throws(()=>attachPlugin({}, {name:'test',platform:'custom',files:[{path,encoding:'utf8',content:'x'}]}));
 assert.throws(()=>attachPlugin({}, {name:'x',platform:'custom',files:[files()[0],files()[0]]}),/כפול/);
 const p={};attach(p);assert.throws(()=>attach(p),/השתנה/);
 const f=readPluginFile(p,'beautics/card.js');updatePlugin(p,{expectedRevision:1,edits:[{path:f.path,expectedHash:f.hash,content:'const broken = ;'}]});
 assert.equal(pluginSummary(p).validation.ok,false);assert.throws(()=>releasePlugin(p,{expectedRevision:2}),/card.js/);
});
test('all four platforms can keep original source instead of replacing it with a generated widget',()=>{
 for(const [platform,path,content] of [['woocommerce','p.php','<?php /* Plugin Name: Original */'],['shopify','extensions/original/blocks/app.liquid','<div>original</div>'],['magento','app/code/Original/Search/registration.php','<?php // original'],['custom','widget.js','const original = true;']]){
  const p={};attachPlugin(p,{name:'Original',platform,files:[{path,content,encoding:'utf8'}]});assert.equal(pluginSummary(p).validation.ok,true);assert.equal(unzip(releasePlugin(p,{expectedRevision:1}).zip)[path].toString(),content);
 }
});
test('studio agent edits plugin on cloned workspace without changing search profile or auto publishing',async()=>{
 const p=existingProject('shop',{dbName:'shop'},[{id:'1',name:'base',stockStatus:'instock'}]);attach(p);const original=readPluginFile(p,'beautics/card.js');
 const replies=[{tools:[{name:'plugin_files'},{name:'plugin_read',path:original.path}]},{tools:[{name:'plugin_patch',path:original.path,expectedRevision:1,expectedHash:original.hash,before:'196465',after:'"woo_product_196465"',note:'analytics'}]},{tools:[{name:'plugin_validate'}]},{message:'תוקן מזהה התוסף'}];
 const result=await studioAgent(p,'תקן את המזהה בתוסף',{model:async()=>replies.shift(),services:{dashboardUser:async()=>null,activity:async()=>({error:'offline'})}});
 assert.match(readPluginFile(result,original.path).content,/woo_product_/);assert.equal(pluginHead(p).number,1);
 assert.equal(result.revisions.length,p.revisions.length);assert.equal(result.mongoPolicyDirty,p.mongoPolicyDirty);
 assert.match(result.messages.at(-1).text,/טיוטת התוסף/);
});

test('agent finds plugin code by search, reads numbered lines and edits a line range',async()=>{
 const {tools,pluginSearch,compactHistory}=await import('./core/studio-agent.mjs');
 const p={revisions:[{number:7}]};
 attachPlugin(p,{name:'Beautics',platform:'woocommerce',files:[{path:'b/track.js',encoding:'utf8',content:['const a=1;','function send(id){','  return fetch("/t",{body:JSON.stringify({product_id:id})});','}','const session_id=null;'].join('\n')}]});
 const ctx={p};
 const found=pluginSearch(p,{pattern:'SESSION_ID'});
 assert.deepEqual(found.matches.map(m=>[m.path,m.line]),[['b/track.js',5]]);assert.match(found.matches[0].context,/^3\| /m);
 assert.equal(pluginSearch(p,{pattern:'product_id:(\\w+)',regex:true}).matches[0].line,3);
 const read=tools.plugin_read.run(ctx,{path:'b/track.js',line:2,lines:2});
 assert.equal(read.content,'2| function send(id){\n3|   return fetch("/t",{body:JSON.stringify({product_id:id})});\n');
 assert.deepEqual([read.from,read.to,read.totalLines,read.more],[2,3,5,true]);
 tools.plugin_patch.run(ctx,{path:'b/track.js',expectedRevision:read.revision,expectedHash:read.hash,note:'prefix ids',startLine:3,endLine:3,replacement:'  return fetch("/t",{body:JSON.stringify({product_id:"woo_product_"+id})});'});
 const after=readPluginFile(p,'b/track.js');
 assert.match(after.content,/"woo_product_"\+id/);assert.equal(after.content.split('\n').length,5,'other lines untouched');
 assert.throws(()=>tools.plugin_patch.run(ctx,{path:'b/track.js',expectedRevision:2,expectedHash:after.hash,note:'x',startLine:4,endLine:9,replacement:''}),/טווח שורות/);
 // Plugin code read a few rounds ago is still in the agent's context; other old results are shortened.
 const history=[{tool:'plugin_read',round:1,result:{content:'x'.repeat(2000)}},{tool:'search',round:1,result:{text:'y'.repeat(2000)}}];
 const kept=compactHistory(history,6);
 assert.equal(kept[0].result.content.length,2000);assert.match(kept[1].result,/shortened/);
});
