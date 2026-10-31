import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {createHash} from 'node:crypto';
import {buildWooTakeover} from '../core/takeover-export.mjs';
import {patchTakeoverEngine} from '../core/takeover-engine.mjs';
import {zipFiles} from '../zip.mjs';

const root=resolve(new URL('..',import.meta.url).pathname);
const cdn=process.env.SEMANTIX_CDN_DIR||join(homedir(),'Desktop/semantix-cdn');
const engine=patchTakeoverEngine(await readFile(join(cdn,'semantix-engine.min.js'),'utf8'));
const siteConfig={platform:'woocommerce',queryParams:['s','q'],
 selectors:{resultsGrid:['ul.products'],productCard:['li.product'],noResults:['.woocommerce-no-products-found','.woocommerce-info','.no-results'],searchInput:'input[name="s"]'},
 features:{fullReplace:true,zeroReplace:true,autocomplete:true},
 replace:{scope:'main',root:'main',searchPath:'^/',shell:[{tag:'div',cls:['woocommerce']},{tag:'ul',cls:['products','columns-4']}],loader:{type:'bar'}},
 nativeCard:{useCustomTemplate:true,cardTemplate:'<li class="product"><a class="woocommerce-LoopProduct-link woocommerce-loop-product__link" href="{{url}}"><img src="{{image}}" alt="{{name}}"><h2 class="woocommerce-loop-product__title">{{name}}</h2><span class="price">{{price}} ₪</span></a><button type="button" data-semantix-atc="1" data-semantix-atc-url="{{url}}" data-semantix-atc-id="{{id}}" data-semantix-atc-oos="{{outOfStock}}">הוספה לסל</button></li>'},
 clickTracking:{enabled:true},cartInterceptor:{enabled:false},addToCart:{mode:'engine'}};
const woo=buildWooTakeover({url:'https://your-store.example',takeover:{siteConfig}},{engine,configurable:true});
const wooFolder=join(root,'exports/semantix-woocommerce');
for(const [path,content] of Object.entries(woo.files)){await mkdir(join(wooFolder,path,'..'),{recursive:true});await writeFile(join(wooFolder,path),content);}
await writeFile(join(root,'exports/semantix-woocommerce.zip'),zipFiles(woo.files));

// Keep the client's existing extension UIDs and configuration. This is a source
// package, with no deployment or change to the live app's release metadata.
const app=process.env.SEMANTIX_SHOPIFY_APP_DIR||join(homedir(),'Desktop/shopify-apps/foxhome');
const shopify={};
async function collect(dir,prefix){for(const entry of await readdir(dir,{withFileTypes:true})){
 if(['node_modules','dist','.shopify'].includes(entry.name))continue;
 const path=join(dir,entry.name),rel=prefix+'/'+entry.name;
 if(entry.isDirectory())await collect(path,rel);else shopify[rel]=await readFile(path);
}}
await collect(join(app,'extensions'),'extensions');
const enginePath='extensions/semantix-search/assets/semantix-engine.js';
shopify[enginePath]=patchTakeoverEngine(shopify[enginePath].toString());
shopify['INSTALL.md']=`# Shopify — תיקון החלפת החיפוש\n\nהחבילה כוללת את שתי ההרחבות הקיימות של Foxhome, עם אותם מזהי הרחבה והתצורה הקיימת. הודעת אין-תוצאות מוסתרת אחרי הצגת מוצרים, כולל רינדור מחדש. אם החיפוש נכשל או שאין מוצרים, ההודעה המקורית נשארת זמינה.\n\nהחליפו את extensions בפרויקט האפליקציה הקיים ואז פרסמו באמצעות shopify app deploy. אין להריץ app init או לשנות מזהי הרחבות. החבילה נוצרה מקומית בלבד ולא נפרסה לחנות.\n`;
shopify['manifest.json']=JSON.stringify({platform:'shopify',store:'www.foxhome.co.il',status:'generated-not-deployed',fix:'native-empty-message',engineSha256:createHash('sha256').update(shopify[enginePath]).digest('hex'),packagedAt:new Date().toISOString()},null,2);
await writeFile(join(root,'exports/semantix-shopify-foxhome-fixed.zip'),zipFiles(shopify));
console.log(JSON.stringify({woocommerce:woo.manifest.version,files:Object.keys(woo.files).length,shopifyFiles:Object.keys(shopify).length}));
