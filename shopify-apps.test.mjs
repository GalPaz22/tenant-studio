import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {publishToShopify,readApp,organizations,syncExtension} from './core/shopify-apps.mjs';

const EXT='extensions/semantix-search/';
const built=(version='aaa111')=>({manifest:{slug:'shop',version,siteKey:'included'},files:{[EXT+'shopify.extension.toml']:'name = "Semantix Search"\ntype = "theme"\n',[EXT+'blocks/semantix-search.liquid']:'block '+version,[EXT+'assets/semantix-engine.js']:'engine','INSTALL.md':'x','manifest.json':'{}'}});
// A stand-in for Shopify CLI: `app init` scaffolds an app folder named after the app, `app deploy` registers the extension.
function fakeCli(calls){
 return async(args,{onLine=()=>{}}={})=>{
  calls.push(args);
  if(args[1]==='init'){const at=args[args.indexOf('--path')+1],name=args[args.indexOf('--name')+1],dir=join(at,name.toLowerCase().replace(/\s+/g,'-'));
   await mkdir(join(dir,'extensions'),{recursive:true});await mkdir(join(dir,'node_modules/x'),{recursive:true});
   await mkdir(join(dir,'extensions/app-home'),{recursive:true});await writeFile(join(dir,'extensions/app-home/shopify.extension.toml'),'type = "ui_extension"');
   await writeFile(join(dir,'shopify.app.toml'),`client_id = "c1d123abcdef45678901"\nname = "${name}"\n[webhooks]\napi_version = "2027-01"\n[access_scopes]\nscopes = "write_products"\n[metaobjects.app.faq]\nname = "FAQ"\n`);await writeFile(join(dir,'package.json'),'{"dependencies":{"@shopify/cli":"4"}}');return {code:0,output:'created'};}
  if(args[1]==='deploy'){const dir=args[args.indexOf('--path')+1],toml=join(dir,EXT,'shopify.extension.toml'),text=await readFile(toml,'utf8');
   if(!/^uid/m.test(text))await writeFile(toml,text+'uid = "ext-uid-1"\n');onLine('Released');return {code:0,output:'See https://shopify.dev/docs/apps\nNew version released [1]\n[1] https://dev.shopify.com/dashboard/1/apps/2/versions/3'};}
  return {code:1,output:'unknown'};
 };
}

test('the first publish creates the client app, later ones deploy a new version into the same app',async()=>{
 process.env.SHOPIFY_APPS_DIR=await mkdtemp(join(tmpdir(),'apps-'));
 const calls=[],exec=fakeCli(calls);
 await assert.rejects(publishToShopify(built(),{exec}),/ארגון/,'an app is never created in an organization nobody chose');
 const first=await publishToShopify(built(),{organizationId:'166778357',exec,now:new Date('2026-10-03T12:30:00Z')});
 assert.equal(first.created,true);assert.equal(first.clientId,'c1d123abcdef45678901');assert.equal(first.version,'sx-aaa111-2610031230');assert.equal(first.url,'https://dev.shopify.com/dashboard/1/apps/2/versions/3');
 assert.deepEqual(calls[0].slice(0,8),['app','init','--template','none','--name','semantix-shop','--organization-id','166778357']);
 assert.deepEqual(calls[1].slice(0,2),['app','deploy']);assert.ok(calls[1].includes('--allow-updates'));
 const dir=join(process.env.SHOPIFY_APPS_DIR,'shop');
 assert.deepEqual((await readdir(process.env.SHOPIFY_APPS_DIR)).sort(),['config.json','shop'],'the scratch folder is gone and the organization is remembered');
 // Only the client id comes from the CLI's sample app: no scopes, no sample extensions, no dependencies.
 assert.deepEqual((await readdir(dir)).sort(),['INSTALL.md','extensions','package.json','semantix-export.json','shopify.app.toml']);
 assert.deepEqual(await readdir(join(dir,'extensions')),['semantix-search']);
 const toml=await readFile(join(dir,'shopify.app.toml'),'utf8');
 assert.match(toml,/scopes = ""/);assert.match(toml,/api_version = "2027-01"/);assert.ok(!/metaobjects|write_products/.test(toml));
 assert.equal(JSON.parse(await readFile(join(dir,'package.json'),'utf8')).dependencies,undefined);
 assert.equal(await readFile(join(dir,EXT,'blocks/semantix-search.liquid'),'utf8'),'block aaa111');
 assert.equal(JSON.parse(await readFile(join(dir,'semantix-export.json'),'utf8')).version,'aaa111');
 // A new export keeps the extension's uid, so the deploy updates the same extension; no second app is created.
 const second=await publishToShopify(built('bbb222'),{exec,now:new Date('2026-10-04T08:00:00Z')});
 assert.equal(second.created,false);assert.equal(calls.filter(c=>c[1]==='init').length,1);
 assert.match(await readFile(join(dir,EXT,'shopify.extension.toml'),'utf8'),/type = "theme"\nuid = "ext-uid-1"\n$/);
 assert.equal(await readFile(join(dir,EXT,'blocks/semantix-search.liquid'),'utf8'),'block bbb222');
 assert.equal((await readApp('shop')).exported.version,'bbb222');
});

test('a failed deploy reports what the CLI said, and organizations are read from its JSON',async()=>{
 process.env.SHOPIFY_APPS_DIR=await mkdtemp(join(tmpdir(),'apps-'));
 await mkdir(join(process.env.SHOPIFY_APPS_DIR,'shop'),{recursive:true});await writeFile(join(process.env.SHOPIFY_APPS_DIR,'shop/shopify.app.toml'),'client_id = "cid9"\n');
 await assert.rejects(publishToShopify(built(),{exec:async()=>({code:1,output:'You are not logged in\nRun shopify auth login'})}),/shopify auth login/);
 assert.deepEqual(await organizations({exec:async()=>({code:0,output:'npm warn x\n{"organizations":[{"id":"1","name":"A"}]}\n'})}),[{id:'1',name:'A'}]);
 await assert.rejects(syncExtension(join(process.env.SHOPIFY_APPS_DIR,'shop'),{manifest:{},files:{'../evil.txt':'x'}}),/נתיב/);
});

test('an export with the web pixel installs its package once and keeps each extension its own uid',async()=>{
 process.env.SHOPIFY_APPS_DIR=await mkdtemp(join(tmpdir(),'apps-'));
 const dir=join(process.env.SHOPIFY_APPS_DIR,'shop'),PIXEL='extensions/semantix-pixel/';
 await mkdir(join(dir,PIXEL),{recursive:true});await mkdir(join(dir,EXT),{recursive:true});
 await writeFile(join(dir,'shopify.app.toml'),'client_id = "c1d123abcdef45678901"\nname = "semantix-shop"\n[webhooks]\napi_version = "2027-01"\n');
 await writeFile(join(dir,PIXEL,'shopify.extension.toml'),'name = "old"\ntype = "web_pixel_extension"\nuid = "pixel-uid"\n\n[settings]\ntype = "object"\n');
 await writeFile(join(dir,EXT,'shopify.extension.toml'),'name = "Semantix Search"\ntype = "theme"\nuid = "theme-uid"\n');
 const withPixel=built();withPixel.files[PIXEL+'shopify.extension.toml']='name = "Semantix measurement"\ntype = "web_pixel_extension"\nruntime_context = "strict"\n\n[settings]\ntype = "object"\n';
 withPixel.files[PIXEL+'src/index.js']='register()';withPixel.files[PIXEL+'package.json']='{}';
 const calls=[],installs=[];
 const npm=async(args,{cwd})=>{installs.push([args[0],cwd]);await mkdir(join(cwd,'node_modules/@shopify/web-pixels-extension'),{recursive:true});await writeFile(join(cwd,'node_modules/@shopify/web-pixels-extension/package.json'),'{}');return {code:0,output:''};};
 await publishToShopify(withPixel,{exec:fakeCli(calls),npm});await publishToShopify(withPixel,{exec:fakeCli(calls),npm});
 assert.deepEqual(installs,[['install',dir]],'installed on the first publish only');
 // uid is a top-level key: it stays above the first table.
 assert.equal(await readFile(join(dir,PIXEL,'shopify.extension.toml'),'utf8'),'name = "Semantix measurement"\ntype = "web_pixel_extension"\nruntime_context = "strict"\nuid = "pixel-uid"\n\n[settings]\ntype = "object"\n');
 assert.match(await readFile(join(dir,EXT,'shopify.extension.toml'),'utf8'),/uid = "theme-uid"\n$/);
 assert.deepEqual(JSON.parse(await readFile(join(dir,'package.json'),'utf8')).workspaces,['extensions/*']);
});
