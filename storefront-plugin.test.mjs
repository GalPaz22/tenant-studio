import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {buildStorefrontPlugin,buildWidgetCode} from './storefront-plugin.mjs';
import {zipFiles} from './zip.mjs';
const project={id:'test',platform:'woocommerce',url:'https://store.example',revisions:[{number:3}],secret:'PRIVATE-SERVER-SECRET'};
const options={endpoint:'https://api.example/search',cdnUrl:'https://cdn.example/assets',apiKey:'public-storefront'};
test('bundled builds need no CDN and provide local platform assets or a complete inline embed',()=>{
 for(const platform of ['woocommerce','shopify','magento','custom']){
  const {files,manifest}=buildStorefrontPlugin(project,{endpoint:options.endpoint,platform});
  assert.equal(manifest.delivery,'bundled');assert.equal(manifest.platform,platform);
  const asset=Object.keys(files).find(p=>p.endsWith('.js'));assert.ok(asset);new vm.Script(files[asset]);
  assert.ok(!Object.keys(files).some(p=>p.startsWith('cdn/')));
  if(platform==='woocommerce'){assert.ok(Object.keys(files).every(p=>p.startsWith('semantix-search/')));assert.match(files['semantix-search/semantix-search.php'],/plugin_dir_url/);}
  if(platform==='shopify')assert.match(files['extensions/semantix-search/blocks/search.liquid'],/asset_url/);
  if(platform==='magento')assert.match(files['app/code/Semantix/Search/view/frontend/layout/default.xml'],/Semantix_Search::js/);
  if(platform==='custom'){assert.equal((files['embed.html'].match(/<\/script>/g)||[]).length,1);new vm.Script(files['embed.html'].split('<script>')[1].split('</script>')[0]);}
 }
});
test('each platform produces an installable adapter and a matching content-addressed CDN bundle',()=>{
 for(const platform of ['woocommerce','shopify','magento','custom']){
  const {files,manifest}=buildStorefrontPlugin(project,{...options,platform});
  const asset=Object.keys(files).find(k=>k.startsWith('cdn/public/semantix-'));
  assert.ok(manifest.assetUrl.endsWith(asset.split('/').at(-1)));
  assert.equal(manifest.status,'generated-not-deployed');new vm.Script(files[asset]);
  assert.ok(zipFiles(files).length>100);assert.ok(!JSON.stringify(files).includes(project.secret));
  const adapter={woocommerce:'semantix-search/semantix-search.php',shopify:'shopify/extensions/semantix-search/blocks/search.liquid',magento:'magento/app/code/Semantix/Search/view/frontend/layout/default.xml',custom:'custom/embed.html'}[platform];
  assert.ok(files[adapter].includes(manifest.assetUrl));
  assert.equal(JSON.parse(files['cdn/wrangler.json']).assets.directory,'./public');
 }
 const a=buildStorefrontPlugin(project,options),b=buildStorefrontPlugin(project,{...options,endpoint:'https://other.example/search'});
 assert.notEqual(a.manifest.version,b.manifest.version);
});
test('rejects unsupported platforms, missing revisions, private or malformed configuration',()=>{
 for(const patch of [{platform:'bad'},{endpoint:'http://api.example/search'},{endpoint:'https://user:secret@api.example/search'},{cdnUrl:'https://localhost'},{endpoint:'https://api.example/search?token=secret'},{apiKey:'a\nb'}])assert.throws(()=>buildStorefrontPlugin(project,{...options,...patch}));
 assert.throws(()=>buildStorefrontPlugin({...project,revisions:[]},options));
});
test('demo uses the same widget source with a local search endpoint',()=>{
 const code=buildWidgetCode({endpoint:'/demo/tenant/__semantix/search',apiKey:'',storeOrigin:'http://127.0.0.1:4320/demo/tenant/',platform:'woocommerce'});
 new vm.Script(code);assert.match(code,/\/demo\/tenant\/__semantix\/search/);assert.match(code,/platform":"woocommerce/);
});
test('widget connects native search, replaces product grids and clones theme cards',()=>{
 const {files}=buildStorefrontPlugin(project,options),code=Object.entries(files).find(([k])=>k.startsWith('cdn/public/semantix-'))[1];
 new vm.Script(code);
 assert.match(code,/document\.addEventListener\('submit'/);
 assert.match(code,/history\.pushState/);
 assert.match(code,/data-semantix-results/);
 assert.match(code,/cloneNode\(true\)/);
 assert.match(code,/ul\.products/);
 assert.doesNotMatch(code,/attachShadow|showModal|class="launcher"/);
});
