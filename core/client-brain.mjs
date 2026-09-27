import {readDashboardUser} from './workspace-context.mjs';
const platform=v=>({woo:'woocommerce',woocommerce:'woocommerce',wordpress:'woocommerce',shopify:'shopify',magento:'magento',magento2:'magento',custom:'custom'}[String(v||'').toLowerCase()]||null);
function storeUrl(p,user){
 const valid=value=>{try{const u=new URL(value);return u.protocol==='https:'?u.href:null;}catch{return null;}};
 const dashboard=valid(user?.site);if(dashboard)return {value:dashboard,source:'dashboard'};
 const counts=new Map();for(const card of p.productCards||[]){const value=valid(card.url);if(!value)continue;const u=new URL(value),key=u.hostname.replace(/^www\./,'');const row=counts.get(key)||{count:0,origin:u.origin};row.count++;counts.set(key,row);}
 const best=[...counts.values()].sort((a,b)=>b.count-a.count)[0];
 if(best&&best.count>=Math.max(3,Math.ceil((p.productCards?.length||0)*.6)))return {value:best.origin+'/',source:'catalog-majority'};
 const project=valid(p.url);return project?{value:project,source:'project'}:{value:null,source:null};
}
export function resolveClientProfile(p,user=null){
 const signals=[];const add=(value,source)=>{const v=platform(value);if(v)signals.push({value:v,source});};
 add(user?.platform,'dashboard');add(p.onboarding?.platform,'onboarding');add(p.platform,'project');
 // Legacy imported clients were labelled custom without actually detecting a platform.
 const specific=signals.filter(s=>s.value!=='custom'),conflict=new Set(specific.map(s=>s.value)).size>1;
 const selected=specific[0]||signals.find(s=>s.value==='custom'&&s.source!=='project')||(!p.existingClient?signals[0]:null);
 const site=storeUrl(p,user);
 return {id:p.id,name:user?.name||p.name,url:site.value,urlSource:site.source,platform:{value:conflict?null:selected?.value||null,source:conflict?null:selected?.source||null,signals,status:conflict?'conflict':selected?'known':'unknown'},
  database:p.existingClient?{name:p.existingClient.dbName,collection:p.existingClient.collection||'products'}:null,
  module:p.dashboardExport?{slug:p.dashboardExport.slug,revision:p.dashboardExport.revision}:null,
  production:user?.productionModule||null,context:user?.storeContext||p.storeContext||null,at:new Date().toISOString()};
}
export async function refreshClientProfile(p,{readUser=readDashboardUser}={}){
 let user=null,error=null;if(p.existingClient)try{user=await readUser(p);}catch{error='לא ניתן לרענן את פרטי החנות מהדאשבורד';}
 const profile=resolveClientProfile(p,user);if(error)profile.warning=error;p.clientProfile=profile;if(profile.platform.status==='known')p.platform=profile.platform.value;if(profile.url&&profile.urlSource!=='project')p.url=profile.url;return profile;
}
