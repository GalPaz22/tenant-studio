import 'dotenv/config';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {engineSource} from '../core/takeover-preview.mjs';
import {buildWooTakeover} from '../core/takeover-export.mjs';
import {buildWooShadow} from '../core/woo-shadow.mjs';
import {storefrontDefaults} from '../core/takeover-control.mjs';
import {zipFiles} from '../zip.mjs';

const project=JSON.parse(await readFile(process.env.SHIPI_PROJECT_FILE||new URL('../data/a6e8f510-d27c-4776-95e6-3f7c5d3db2dc.json',import.meta.url),'utf8'));
if(new URL(project.url).hostname!=='shipi.co.il'||project.takeover?.siteConfig?.platform!=='woocommerce')throw Error('Expected the Shipi WooCommerce project');
const config=project.takeover.siteConfig;
if(!config.nativeCard?.cardTemplate?.includes('product-col')||!config.selectors?.resultsGrid?.includes('div.products-row'))throw Error('Shipi requires its Matat card and product grid configuration');
config.selectors.noResults=['div.woocommerce-no-products-found','div.woocommerce-info'];
const defaults=await storefrontDefaults(project);
if(!defaults.apiKey)throw Error('Shipi site key unavailable; no package was produced');
const shadow=process.argv.includes('--shadow');
const noAutocomplete=process.argv.includes('--no-autocomplete');
if(noAutocomplete)config.features={...config.features,autocomplete:false};
const options={apiKey:defaults.apiKey,apiBase:new URL(defaults.endpoint).origin,productIdPrefix:''};
const {files,manifest}=shadow?buildWooShadow(project,options):buildWooTakeover(project,{...options,engine:(await engineSource('engine.js')).code});
if(!shadow)files['semantix-search/INSTALL.md']+='\n## שיפי — תבנית Matat\nזו חבילה מותאמת לחנות shipi.co.il, עם כרטיסי product-col/product-item וגריד products-row של Matat. היא מחליפה את החבילה הגנרית shipi.zip, ששמה המקורי semantix-woocommerce.zip. החבילה הגנרית אינה כוללת את מבנה הכרטיסים של Matat. קובצי ה־CSS המקוריים של Matat ושל Matat Child צריכים להיטען בסביבת הפיתוח ובפרודקשן. מעבר לפרודקשן לבדו אינו מתקן חבילה עם תבנית כרטיס לא מתאימה. אין צורך בשרת חדש.\n';
const name=shadow?'shipi-shadow':noAutocomplete?'shipi-no-autocomplete':'shipi-fixed';
const dir=new URL('../exports/'+name+'/',import.meta.url);
for(const [path,content] of Object.entries(files)){const target=join(dir.pathname,path);await mkdir(join(target,'..'),{recursive:true});await writeFile(target,content);}
await writeFile(new URL('../exports/'+name+'.zip',import.meta.url),zipFiles(files));
console.log(JSON.stringify({store:manifest.store,mode:manifest.mode||'active',version:manifest.version,files:Object.keys(files).length,siteKey:manifest.siteKey,resultsGrid:config.selectors.resultsGrid}));
