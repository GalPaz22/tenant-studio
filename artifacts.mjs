import {indexDefinition} from './runtime.mjs';
import {readFileSync} from 'node:fs';
import {hash} from './core/catalog.mjs';
// The browser key below is the existing storefront search key, never an admin token.
export function buildArtifacts(project) {
 const revision=project.revisions.at(-1);if(!revision)throw Error('No revision');
 const widget=`/* Configure a deployed search endpoint and public storefront key. */
export function mountSearch(root,{endpoint,apiKey,autocompleteEndpoint}) {
 const form=document.createElement('form'),input=document.createElement('input'),button=document.createElement('button'),results=document.createElement('div'),more=document.createElement('button'),suggestions=document.createElement('div');
 input.placeholder='חיפוש מוצרים';button.textContent='חפש';more.textContent='טען עוד';more.hidden=true;form.append(input,button);root.append(form,suggestions,results,more);
 let cursor=null,version=0,debounce;
 const safe=value=>{try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:null}catch{return null}};
 async function call(url,body){const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-API-Key':apiKey},body:JSON.stringify(body)});if(!response.ok)throw Error('Search unavailable');return response.json();}
 async function search(append){const request=append?version:++version;button.disabled=true;more.disabled=true;if(!append){cursor=null;more.hidden=true;results.textContent='מחפש…';suggestions.replaceChildren();}
 try{const data=await call(endpoint,append?{cursor,limit:12}:{query:input.value,limit:12});if(request!==version)return;if(!append)results.replaceChildren();
 for(const p of data.products||data.matches||[]){const card=document.createElement('article'),title=document.createElement('a');title.textContent=p.name||p.title;const url=safe(p.url);if(url)title.href=url;card.append(title);const image=safe(p.image);if(image){const img=document.createElement('img');img.src=image;img.alt=p.name||p.title;img.loading='lazy';card.append(img)}if(p.summary){const text=document.createElement('p');text.textContent=p.summary;card.append(text)}for(const badge of p.badges||[]){const label=document.createElement('span');label.textContent=badge.text;card.append(label)}results.append(card)}
 cursor=data.nextCursor||null;more.hidden=!cursor;
 }catch{if(request===version)results.textContent='החיפוש אינו זמין כרגע. נסו שוב.'}finally{if(request===version){button.disabled=false;more.disabled=false;}}}
 form.onsubmit=event=>{event.preventDefault();search(false)};more.onclick=()=>search(true);
 input.oninput=()=>{version++;cursor=null;more.hidden=true;clearTimeout(debounce);suggestions.replaceChildren();if(!autocompleteEndpoint||input.value.trim().length<2)return;const request=version;
 debounce=setTimeout(async()=>{try{const data=await call(autocompleteEndpoint,{query:input.value});if(request!==version)return;for(const item of data.suggestions||data||[]){const b=document.createElement('button');b.textContent=item.label||item.title;b.onclick=()=>{input.value=item.label||item.title;suggestions.replaceChildren();search(false)};suggestions.append(b)}}catch{}},200);};
 return {destroy(){version++;clearTimeout(debounce);root.replaceChildren()}};
}
`;
 const files={
  'profile.json':JSON.stringify(revision.profile,null,2),
  'index.json':JSON.stringify(indexDefinition(revision.profile),null,2),
  'product.schema.json':JSON.stringify({type:'object',required:['id','name','stockStatus'],properties:{id:{type:'string'},name:{type:'string'},price:{type:['number','null']},stockStatus:{enum:['instock','outofstock','unknown']},badges:{type:'array',items:{type:'object',required:['text'],properties:{text:{type:'string'},order:{type:'integer'}}}}}},null,2),
  'search.mjs':`import {createDraftRuntime} from './runtime.mjs';\nimport {readFileSync} from 'node:fs';\nconst read=name=>JSON.parse(readFileSync(new URL(name,import.meta.url),'utf8'));\nexport function createTenant(catalog=read('./catalog.json'),profile=read('./profile.json')){const extras=read('./snapshot.json');return createDraftRuntime({...extras,id:${JSON.stringify(project.id)},platform:${JSON.stringify(project.platform)},url:${JSON.stringify(project.url)},catalog:{products:Array.isArray(catalog)?catalog:catalog.products}},{number:${revision.number},profile});}\n`,
  'widget.mjs':widget,
  'INSTALL.md':`# ${revision.profile.name}\nDraft revision ${revision.number}.\n\nInstall search.mjs and profile.json under tenants/<tenant>/ in dashboard-server. Register this factory behind authenticated tenant routing before connecting widget.mjs. No live tenant binding has been created.\n\nImport mountSearch from widget.mjs and supply the deployed /search URL and existing storefront API key. Never supply an admin or Studio token. This initial widget renders first-page search and badges; autocomplete/load-more and platform sync installation still need integration.\n\nPlatform: ${project.platform}. Catalog: bounded public sample, not a full synced inventory. Mongo/Atlas provisioning in Studio is staging only.\n`
 };
 const shared=['runtime.mjs','discover.mjs','core/core.mjs','core/gemini.mjs','core/semantic.mjs','core/router.mjs','core/spelling.mjs','core/search-index.mjs','core/catalog.mjs','core/connectors.mjs','core/embeddings.mjs','tenants/garmin/index.mjs','core/build.mjs','core/run-store.mjs','core/domains.mjs','core/research.mjs','core/evidence-tagging.mjs','core/sync.mjs','core/merchant-facts.mjs','model.mjs','scraper.mjs','provision.mjs'];
 for(const file of shared)files[file]=readFileSync(new URL(file,import.meta.url),'utf8');
 files['package.json']=JSON.stringify({name:'semantix-tenant-'+project.id,private:true,type:'module',dependencies:{'@google/genai':'^2.17.1',cheerio:'^1.0.0',dotenv:'^16.4.5',mongodb:'^6.8.0'}},null,2);
 files['catalog.json']=JSON.stringify(project.catalog||{products:[]});
 files['snapshot.json']=JSON.stringify({productCards:project.productCards||null,productCardsProfileHash:project.productCardsProfileHash||hash(revision.profile),tagAssignments:project.tagAssignments||{},storeContext:project.storeContext||null,searchIndex:project.searchIndex||null,vectorIndex:project.vectorIndex||null});
 files['learning-tests.json']=JSON.stringify({kind:'deterministic-regression-examples',examples:(project.learning?.examples||[]).filter(e=>e.status==='confirmed')},null,2);
 files['store-context.json']=JSON.stringify(project.storeContext||{},null,2);
 files['tag-assignments.json']=JSON.stringify(project.tagAssignments||{},null,2);
 files['build-report.json']=JSON.stringify(project.buildReport||{},null,2);
 files['INSTALL.md']=`# ${revision.profile.name}\nRevision ${revision.number}.\n\nThe ZIP includes the shared runtime and a catalog snapshot, cards, evidence, tags and store/domain context. Install dependencies, import createTenant from search.mjs, and call tenant.search({query,limit,cursor}) or tenant.autocomplete(query). Core build execution is also included: createRunStore + newBuild + executeBuild, with injected providers supported. Supply GEMINI_API_KEY only on the server for model execution. No credentials are included.\n\nExpose the runtime behind authenticated tenant routing before connecting widget.mjs. The Studio does not publish a service or install into the store. Configure the deployed endpoint and storefront key; never expose a Studio/admin token. Mongo provisioning is staging only.\n\nSource coverage: ${JSON.stringify(project.catalog?.coverage||{scope:'legacy-sample',complete:false})}. This exported snapshot does not keep itself synchronized; configure the connected sync service separately.\n`;
 if(new URL(project.url).hostname.replace(/^www\./,'')==='garmin.co.il'){
  files['processor.mjs']=readFileSync(new URL('./tenants/garmin/index.mjs',import.meta.url),'utf8');
  files['research.json']=JSON.stringify(project.research||{},null,2);
 }
 if(project.platform==='woocommerce')files['semantix-draft.php']=`<?php
/* Plugin Name: Semantix Tenant Search (Draft)
Description: Search mount shortcode; configure a deployed endpoint and storefront key in wp-config.php.
Version: 0.1.0
*/
if (!defined('ABSPATH')) exit;
add_shortcode('semantix_tenant_search', function() {
 if (!defined('SEMANTIX_SEARCH_URL') || !defined('SEMANTIX_STOREFRONT_KEY')) return '<p>Search configuration required.</p>';
 $id = wp_unique_id('semantix-');
 $config = wp_json_encode(array('endpoint'=>SEMANTIX_SEARCH_URL,'apiKey'=>SEMANTIX_STOREFRONT_KEY), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
 $asset = wp_json_encode(plugins_url('widget.mjs', __FILE__));
 return '<div id="'.esc_attr($id).'"></div><script type="module">import {mountSearch} from '.$asset.';mountSearch(document.getElementById('.wp_json_encode($id).'),'.$config.');</script>';
});
`;
 return {revision:revision.number,platform:project.platform,status:'draft-not-deployed',files};
}
