import {discover,fetchPublic} from './discover.mjs';
import {load} from 'cheerio';
import {applyObservations} from './scraper.mjs';
import {processGarmin,garminProfile} from './tenants/garmin/index.mjs';
export async function enrichGarmin(products,report=()=>{}){
 const byId=new Map(products.map(p=>[p.id,p]));
 for(let page=1;page<=Math.ceil(products.length/10);page++){
  const rows=JSON.parse(await fetchPublic(`https://www.garmin.co.il/wp-json/wc/store/v1/products?per_page=10&page=${page}&_fields=id,description,short_description,attributes`));
  for(const row of rows){const p=byId.get(String(row.id));if(!p)continue;const $=load(row.description||'');$('script,style').remove();const specs={};$('tr').each((_,tr)=>{const cells=$(tr).find('th,td').toArray().map(c=>$(c).text().replace(/\s+/g,' ').trim());if(cells.length===2)specs[cells[0]]=cells[1]});p.description=$.root().text().replace(/\s+/g,' ').trim().slice(0,18000);p.specifications=specs;p.sourceAttributes=row.attributes||[];}
  report(`הועשרו ${Math.min(page*10,products.length)} מוצרים בתיאורים ומפרטים`);
 }
 return products.map(processGarmin);
}
export async function researchGarmin(project,report=()=>{}){
 if(new URL(project.url).hostname.replace(/^www\./,'')!=='garmin.co.il')throw Error('Garmin research requires garmin.co.il');
 const catalog=await discover(project.url,project.platform,report,undefined,{maxProducts:10000});
 if(!catalog.complete)throw Error('Full catalog import did not complete: '+catalog.warnings.join(' · '));
 catalog.products=await enrichGarmin(applyObservations(catalog.products,project.badgeScan||{observations:[]}),report);
 const profile=garminProfile(project.revisions.at(-1).profile,catalog.products);
 const counts={};for(const p of catalog.products)for(const e of p.garmin.evidence)counts[e.tag]=(counts[e.tag]||0)+1;
 return {catalog,profile,report:{at:new Date().toISOString(),products:catalog.products.length,complete:catalog.complete,attributeCounts:counts,badges:catalog.products.filter(p=>p.badges?.length).length,unknownAttributes:'Unknown attributes remain unset; phone music controls are not classified as on-watch music storage.',sources:['https://www.garmin.co.il/wp-json/wc/store/v1/products','https://www.garmin.co.il/product/שעון-ספורט-חכם-venu-sq-2/'],modules:['tenants/garmin/index.mjs']}};
}
