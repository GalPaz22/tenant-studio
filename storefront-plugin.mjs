import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildBundledPlugin} from './storefront-bundled.mjs';
const platforms=['woocommerce','shopify','magento','custom'];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function buildWidgetCode(config){
 const widget=readFileSync(new URL('./public/storefront-widget.js',import.meta.url),'utf8');
 return `(()=>{const config=${JSON.stringify(config).replace(/</g,'\\u003c')};\n${widget}\n})();\n`;
}
function https(value,label){
 let u;try{u=new URL(value);}catch{throw Error(`${label}: נדרשת כתובת HTTPS מלאה`);}
 if(u.protocol!=='https:'||u.username||u.password||u.hash||u.search||u.hostname==='localhost'||u.hostname.endsWith('.localhost')||u.hostname==='127.0.0.1'||u.hostname==='[::1]')throw Error(`${label}: נדרשת כתובת HTTPS ציבורית ללא סיסמה או פרמטרים`);
 return u.href;
}
export function buildStorefrontPlugin(project,options={}){
 const platform=options.platform||project.platform;
 if(!platforms.includes(platform))throw Error('פלטפורמה לא נתמכת');
 if(!project.revisions?.length)throw Error('נדרשת גרסה שמורה');
 const endpoint=https(options.endpoint,'שרת החיפוש'),cdn=options.cdnUrl?https(options.cdnUrl,'CDN').replace(/\/$/,''):'',apiKey=String(options.apiKey||'');
 if(apiKey.length>512||/[\r\n]/.test(apiKey))throw Error('מפתח אתר לא תקין');
 const config={endpoint,apiKey,storeOrigin:new URL(project.url).origin,platform,currency:project.currency||'ILS'};
 const code=buildWidgetCode(config);
 const version=createHash('sha256').update(code).digest('hex').slice(0,12),asset=`semantix-${version}.js`,assetUrl=`${cdn}/${asset}`;
 if(!cdn)return buildBundledPlugin({project,platform,endpoint,code,version,asset});
 const script=`<script defer src="${escape(assetUrl)}"></script>`;
 const files={
  [`cdn/public/${asset}`]:code,
  'cdn/public/_headers':`/${asset}\n  Cache-Control: public, max-age=31536000, immutable\n  Access-Control-Allow-Origin: *\n  X-Content-Type-Options: nosniff\n`,
  'cdn/wrangler.json':JSON.stringify({name:'semantix-storefront',compatibility_date:'2026-09-01',assets:{directory:'./public'}},null,2),
  'custom/embed.html':script,
 };
 let install='העתיקו את custom/embed.html לתבנית האתר לפני תג הסגירה של body.';
 if(platform==='woocommerce'){
 files['semantix-search/semantix-search.php']=`<?php\n/**\n * Plugin Name: Semantix Storefront Search\n * Description: Adds a Semantix search button connected to your search server.\n * Version: 1.0.0\n * Requires Plugins: woocommerce\n */\nif (!defined('ABSPATH')) exit;\nadd_action('wp_enqueue_scripts', function () {\n wp_enqueue_script('semantix-storefront', '${assetUrl.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}', array(), null, true);\n});\n`;
 install='כווצו את תיקיית semantix-search בלבד לקובץ ZIP. בוורדפרס: תוספים → תוסף חדש → העלאת תוסף, ואז הפעילו אותו. להסרה: השביתו את התוסף.';
 }else if(platform==='shopify'){
 files['shopify/extensions/semantix-search/shopify.extension.toml']='name = "Semantix Search"\ntype = "theme"\n';
 files['shopify/extensions/semantix-search/blocks/search.liquid']=`${script}\n{% schema %}\n{"name":"Semantix Search","target":"body","settings":[]}\n{% endschema %}\n`;
 install='זוהי Theme App Extension, לא אפליקציית Shopify עצמאית. בפרויקט אפליקציית Shopify קיים צרו Theme App Extension עם Shopify CLI, העתיקו אליו את blocks/search.liquid, שמרו את מזהי ההרחבה שיצר ה־CLI ופרסמו באמצעות shopify app deploy. התקינו את האפליקציה בחנות, ואז בעורך התבנית הפעילו את Semantix Search תחת App embeds. להסרה: כבו את ה־App embed.';
 }else if(platform==='magento'){
 const base='magento/app/code/Semantix/Search/';
 files[base+'registration.php']="<?php\n\\Magento\\Framework\\Component\\ComponentRegistrar::register(\\Magento\\Framework\\Component\\ComponentRegistrar::MODULE, 'Semantix_Search', __DIR__);\n";
 files[base+'etc/module.xml']='<?xml version="1.0"?><config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="urn:magento:framework:Module/etc/module.xsd"><module name="Semantix_Search"/></config>';
 files[base+'view/frontend/layout/default.xml']=`<?xml version="1.0"?><page xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="urn:magento:framework:View/Layout/etc/page_configuration.xsd"><head><script src="${escape(assetUrl)}" src_type="url" defer="defer"/></head></page>`;
 files[base+'etc/csp_whitelist.xml']=`<?xml version="1.0"?><csp_whitelist xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="urn:magento:module:Magento_Csp:etc/csp_whitelist.xsd"><policies><policy id="script-src"><values><value id="semantix-cdn" type="host">${escape(new URL(cdn).origin)}</value></values></policy><policy id="connect-src"><values><value id="semantix-api" type="host">${escape(new URL(endpoint).origin)}</value></values></policy></policies></csp_whitelist>`;
 install='העתיקו את magento/app/code/Semantix/Search אל app/code/Semantix/Search בחנות Magento 2. הריצו bin/magento module:enable Semantix_Search ואז bin/magento setup:upgrade ו־bin/magento cache:flush; בפרודקשן בצעו גם את שלבי הקומפילציה ופריסת התוכן הסטטי הרגילים שלכם. להסרה: bin/magento module:disable Semantix_Search וניקוי מטמון.';
 }
 const manifest={platform,version,assetUrl,endpoint,status:'generated-not-deployed',revision:project.revisions.at(-1).number};
 files['manifest.json']=JSON.stringify(manifest,null,2);
 files['INSTALL.md']=`# Semantix — ${platform}\n\n## 1. שרת חיפוש\nנדרש שרת חיפוש פעיל בכתובת ${endpoint}. החבילה מוסיפה כפתור חיפוש וחלון תוצאות נפרד; היא אינה מחליפה אוטומטית את החיפוש המקורי ואינה מסנכרנת קטלוג. פרסמו בנפרד את המיני־שרת מהסטודיו.\n\nהדפדפן שולח POST עם {query, limit:12, modern:true} ו־X-API-Key אם הוגדר מפתח ציבורי. לדפדוף נשלח {cursor, limit:12, modern:true}. נדרשת תשובה {products:[], nextCursor} או {matches:[], pagination:{nextCursor}}. השרת חייב לזהות את החנות דרך מפתח אתר ציבורי, לא דרך tenantId מהדפדפן. הגדירו CORS עבור ${config.storeOrigin}, POST/OPTIONS ו־Content-Type/X-API-Key, הגבלת קצב והרשאות חיפוש בלבד. אין להזין מפתח ניהול, Studio או ספק AI — כל תוכן CDN ציבורי.\n\n## 2. העלאת CDN\nמומלץ Cloudflare Workers Static Assets. בתיקיית cdn הריצו npx wrangler login ואז npx wrangler deploy. ודאו שהכתובת שהתקבלה תואמת ל־${cdn}; אם לא, צרו מחדש את החבילה עם הכתובת הנכונה. ניתן גם להעלות את תוכן cdn/public לכל שירות אחסון סטטי בכתובת שהגדרתם. _headers מיועד ל־Cloudflare; בספק אחר הגדירו את הכותרות בנפרד. שמרו קבצים ישנים בעת עדכון כדי שהתקנות קודמות ימשיכו לעבוד.\n\n## 3. התקנה\n${install}\n\n## 4. בדיקה\nפתחו את ${assetUrl} ואמתו שחוזר JavaScript. בחנות בדקו פתיחה וסגירה במקלדת ובנייד, חיפוש, מעבר למוצר ודפדוף, וגם הודעת שגיאה כשהשרת אינו זמין. ב־CSP התירו script-src לכתובת CDN ו־connect-src לשרת החיפוש; עיצוב הווידג׳ט משתמש ב־style פנימי ב־Shadow DOM, ויש להתאימו למדיניות CSP קשיחה.\n\nהחבילה נוצרה בלבד — לא הועלתה ולא הותקנה.\n`;
 return {manifest,files};
}
