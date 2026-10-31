import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {buildWooShadow} from './core/woo-shadow.mjs';

const project={url:'https://shipi.co.il/',takeover:{siteConfig:{platform:'woocommerce',queryParams:['s'],
 selectors:{resultsGrid:['.products-row'],productCard:['.product-col'],noResults:['.woocommerce-info'],searchInput:'#header_search_input'},
 features:{fullReplace:true,autocomplete:true},replace:{root:'#main'},nativeCard:{cardTemplate:'<div class="product-col">{{name}}</div>'},
 abTests:{forced:{enabled:true,variants:[{id:'active',weight:100,features:{fullReplace:true}}]}}}}};
test('shadow exports no engine, CSS or remote-config code even from a fully active project',()=>{
 const {files,manifest}=buildWooShadow(project,{apiBase:'https://api.example',apiKey:'public-site-key',productIdPrefix:''});
 assert.equal(manifest.mode,'shadow');assert.equal(manifest.engineBytes,0);assert.equal(manifest.features.resultsPage,'off');assert.equal(manifest.analyticsProductIdPrefix,'');
 assert.equal(Object.keys(files).length,6);
 assert.ok(!Object.keys(files).some(p=>/engine|config\.js|\.css$/.test(p)));
 const php=files['semantix-search/semantix-search.php'];
 assert.match(php,/Plugin Name: Semantix Shadow/);assert.match(php,/define\('SEMANTIX_SHADOW_MODE', true\)/);
 assert.match(php,/'shadowMode' => true/);assert.match(php,/assets\/semantix-shadow\.js/);
 assert.doesNotMatch(php,/semantix-config\.js|semantix-engine\.js|fullReplace|abTests|cardTemplate/);
 const js=files['semantix-search/assets/semantix-shadow.js'];new vm.Script(js);new vm.Script(files['semantix-search/assets/semantix-commerce.js']);
 assert.match(js,/post\('\/log-query'/);assert.doesNotMatch(js,/post\('\/(?:search|fast-search|autocomplete|site-config)'/);
 assert.equal(JSON.stringify(project).includes('forced'),true,'export does not modify the source project');
});
