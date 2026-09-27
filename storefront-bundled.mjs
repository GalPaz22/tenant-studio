const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function buildBundledPlugin({project,platform,endpoint,code,version,asset}){
 const files={},manifest={platform,version,endpoint,delivery:'bundled',status:'generated-not-deployed',revision:project.revisions.at(-1).number};
 let instructions;
 if(platform==='woocommerce'){
  files['semantix-search/assets/'+asset]=code;
  files['semantix-search/semantix-search.php']=`<?php\n/**\n * Plugin Name: Semantix Storefront Search\n * Description: Storefront search connected to Semantix.\n * Version: 1.0.0\n */\nif (!defined('ABSPATH')) exit;\nadd_action('wp_enqueue_scripts', function () {\n wp_enqueue_script('semantix-storefront', plugin_dir_url(__FILE__) . 'assets/${asset}', array(), '${version}', true);\n});\n`;
  instructions='בוורדפרס פתחו תוספים ← תוסף חדש ← העלאת תוסף. העלו את ה־ZIP שהורדתם והפעילו את Semantix Storefront Search. קובץ החיפוש כלול בתוסף. להסרה: השביתו את התוסף.';
 }else if(platform==='shopify'){
  const base='extensions/semantix-search/';
  files[base+'assets/'+asset]=code;
  files[base+'shopify.extension.toml']='name = "Semantix Search"\ntype = "theme"\n';
  files[base+'blocks/search.liquid']=`<script src="{{ '${asset}' | asset_url }}" defer></script>\n{% schema %}\n{"name":"Semantix Search","target":"body","settings":[]}\n{% endschema %}\n`;
  instructions='זו הרחבת Theme App Extension, לא אפליקציה עצמאית. בפרויקט אפליקציית Shopify שלכם צרו הרחבת theme עם Shopify CLI והעתיקו את assets ו־blocks אליה. שמרו את מזהי ההרחבה שנוצרו. פרסמו באמצעות shopify app deploy, התקינו את האפליקציה בחנות והפעילו Semantix Search תחת App embeds בעורך התבנית. Shopify מארחת את הקבצים. להסרה: כבו את ה־App embed.';
 }else if(platform==='magento'){
  const base='app/code/Semantix/Search/';
  files[base+'registration.php']="<?php\n\\Magento\\Framework\\Component\\ComponentRegistrar::register(\\Magento\\Framework\\Component\\ComponentRegistrar::MODULE, 'Semantix_Search', __DIR__);\n";
  files[base+'etc/module.xml']='<?xml version="1.0"?><config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="urn:magento:framework:Module/etc/module.xsd"><module name="Semantix_Search"/></config>';
  files[base+'view/frontend/web/js/'+asset]=code;
  files[base+'view/frontend/layout/default.xml']=`<?xml version="1.0"?><page xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="urn:magento:framework:View/Layout/etc/page_configuration.xsd"><head><script src="Semantix_Search::js/${asset}"/></head></page>`;
  files[base+'etc/csp_whitelist.xml']=`<?xml version="1.0"?><csp_whitelist xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="urn:magento:module:Magento_Csp:etc/csp_whitelist.xsd"><policies><policy id="connect-src"><values><value id="semantix-api" type="host">${xml(new URL(endpoint).origin)}</value></values></policy></policies></csp_whitelist>`;
  instructions='העתיקו את app/code/Semantix/Search אל החנות. הריצו bin/magento module:enable Semantix_Search, ואז bin/magento setup:upgrade ו־bin/magento cache:flush. בצעו קומפילציה ופריסת קבצים סטטיים לפי תהליך הפרסום שלכם. להסרה: השביתו את המודול ונקו מטמון.';
 }else{
  files['embed.html']=`<!-- Semantix Search: paste before </body> -->\n<script>\n${code.replace(/<\/script/gi,'<\\/script')}\n</script>\n`;
  files[asset]=code;
  instructions='העתיקו את כל תוכן embed.html לשדה Custom HTML / Custom Code או לפני תג הסגירה של body בתבנית האתר. אין צורך להעלות קובץ נוסף. אם האתר חוסם JavaScript בתוך HTML, העלו את קובץ ה־JS הכלול לאתר וטענו אותו באמצעות script src לפי הנתיב שבחרתם. ודאו שפלטפורמת האתר מאפשרת script בשדה ההטמעה.';
 }
 const notes=`# התקנת Semantix — ${platform}\n\n${instructions}\n\n## חיבור החיפוש\nנדרש endpoint פעיל: ${endpoint}\nהדפדפן שולח POST עם query או cursor, limit ו־modern:true. השרת צריך להחזיר products או matches ו־nextCursor, ולהתיר CORS עבור ${new URL(project.url).origin}. מפתח החיפוש, אם הוזן, ציבורי; השתמשו במפתח מוגבל לחיפוש בלבד.\n\n## מה החבילה עושה\nמוסיפה כפתור חיפוש וחלון תוצאות. אינה מחליפה תוסף קיים, מסנכרנת מוצרים או כוללת את הקונסיירז׳ המותאם של Beautics. כדי לשמר תוסף קיים, חברו אותו דרך ״תוסף מחובר״.\n\n## בדיקה\nבדקו חיפוש, מעבר למוצר, דפדוף תוצאות, נייד ומקלדת. נדרשת התאמת CSP באתר אם הוא חוסם scripts, סגנונות פנימיים או בקשות לשרת החיפוש. החבילה נוצרה בלבד ולא הותקנה בחנות.\n`;
 const docs=platform==='woocommerce'?'semantix-search/':'';
 files[docs+'INSTALL.md']=notes;files[docs+'manifest.json']=JSON.stringify(manifest,null,2);
 return {manifest,files};
}
