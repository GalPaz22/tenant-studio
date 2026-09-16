import {processProduct,autocomplete} from './core/core.mjs';
import {createSearchService} from './core/semantic.mjs';
import {generate} from './core/gemini.mjs';
import {processGarmin} from './tenants/garmin/index.mjs';
export function createDraftRuntime(project,revision) {
 const profile={...revision.profile,tenantId:project.id,platform:project.platform,sourceUrl:project.url,version:`studio-${revision.number}`,publishedStatuses:['ACTIVE','publish'],indexPlan:{text:['title'],filter:['productType','colors','finishes','price','stockStatus'],exact:['id','sku']}};
 const classifiedTags=new Map();
 for(const [tag,assignment] of Object.entries(project.tagAssignments||{}))
  for(const id of assignment.matchedIds||[]){if(!classifiedTags.has(id))classifiedTags.set(id,[]);classifiedTags.get(id).push(tag)}
 const products=project.catalog.products.map(raw=>{
  if(new URL(project.url).hostname.replace(/^www\./,'')==='garmin.co.il')raw=processGarmin(raw);
  raw={...raw,tags:[...new Set([...(raw.tags||[]),...(raw.siteTags||[]),...(classifiedTags.get(String(raw.id))||[])])]};
  const p=processProduct(raw,profile);p.badges=Array.isArray(raw.badges)?raw.badges.map(b=>({...b})):[];
  if(raw.garmin){p.finishes=raw.garmin.finishes||[];p.garmin=raw.garmin;if(raw.garmin.accessory)p.productType=profile.productTypes.band?.categories.some(c=>p.categories.includes(c))?'band':null;}
  for(const r of profile.badgeRules)if((raw[r.field]||[]).includes(r.value)&&!p.badges.some(b=>b.text===r.text))p.badges.push({text:r.text,kind:'merchant',order:r.order,source:'tenant-rule'});
  p.badges.sort((a,b)=>(a.order||0)-(b.order||0));return p;
 });
 return {search:createSearchService(products,profile,generate,{...profile.pipeline,maxEntries:10}),autocomplete:query=>autocomplete(products,profile,query),products,profile};
}
export function indexDefinition(profile={}) {
 const fields={name:[{type:'string'},{type:'autocomplete'}],id:{type:'token'},categories:{type:'token'},tags:{type:'token'},colors:{type:'token'},finishes:{type:'token'},productType:{type:'token'},price:{type:'number'},stockStatus:{type:'token'},hidden:{type:'boolean'}};
 const selected=[...new Set(['name','id',...(profile.indexFields||Object.keys(fields))])];
 return {name:'tenant_products_v1',definition:{mappings:{dynamic:false,fields:Object.fromEntries(selected.map(k=>[k,fields[k]]))}}};
}
