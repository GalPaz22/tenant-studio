import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildWooTakeover} from './takeover-export.mjs';

// Reuse the validated connection and tested Woo server hooks. This package does
// not ship/load a search engine, fetch remote siteConfig, or write storefront UI.
export function buildWooShadow(project, options = {}) {
 const base = buildWooTakeover(project, {...options, engine: 'window.SemantixSettings;'});
 const manifest = {...base.manifest, mode: 'shadow', engineBytes: 0, features: {searchMeasurement: true, clicks: true, serverCarts: true, serverPurchases: true, sessionIdleMinutes: 30, autocomplete: false, resultsPage: 'off', addToCart: 'native'}};
 const config = project.takeover.siteConfig;
 const browser = readFileSync(new URL('./woo-shadow-browser.js', import.meta.url), 'utf8');
 const selectors = {queryParams: config.queryParams || ['s'], productCardSelectors: config.selectors?.productCard || [],
  searchSelectors: {...config.selectors, root: config.replace?.root || 'main'}};
 const json = JSON.stringify(selectors).replace(/</g, '\\u003c');
 const version = createHash('sha256').update(base.manifest.version).update(browser).update(json).update('shadow-v1').digest('hex').slice(0,12);
 manifest.version = version;
 // Same plugin path as the active version: WordPress replaces it rather than
 // activating two copies of the hooks. A different version requires reinstall.
 let php = base.files['semantix-search/semantix-search.php'];
 php = php.replace('Plugin Name: Semantix Search', 'Plugin Name: Semantix Shadow — ' + manifest.slug)
  .replace('Description: Search takeover and session analytics for WooCommerce: clicks, successful carts and paid orders.', 'Description: Measurement only: native searches, clicks, successful carts and paid orders. Does not replace search or autocomplete.')
  .replace('Version: 1.1.', 'Version: 1.2.')
  .replace("require_once __DIR__ . '/commerce.php';", "define('SEMANTIX_SHADOW_MODE', true);\nrequire_once __DIR__ . '/commerce.php';")
  .replace("'serverCartTracking' => true,", "'shadowMode' => true, 'serverCartTracking' => true,")
  .replace("    echo '<script>window.SemantixWooTracking='", "    $tracking = array_merge($tracking, json_decode('" + json.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "', true));\n    echo '<script>window.SemantixWooTracking='")
  .replaceAll(base.manifest.version, version)
  .replace('assets/semantix-config.js', 'assets/semantix-shadow.js');
 const install = `# Semantix Shadow — ${manifest.store}

גרסת מדידה בלבד לשיפי. מפתח האתר והחיבור ל־dashboard-server הקיים כלולים.

## התקנה
בוורדפרס: תוספים ← תוסף חדש ← העלאת תוסף ← העלו את ה־ZIP הזה. אם Semantix Search כבר מותקן, בחרו החלפת התוסף הקיים. הפעילו את Semantix Shadow. אין להפעיל במקביל גרסת Semantix שמחליפה חיפוש. החיפוש המקורי ותוסף החיפוש המקורי של החנות נשארים פעילים. נקו מטמון דפים ו־CDN אחרי ההחלפה, כדי שלא ייטען קוד החיפוש מהגרסה הקודמת.

## מה נמדד
חיפושים שהגיעו לדף התוצאות המקורי דרך /log-query, קליקים על כרטיסי מוצר דרך /product-click, הוספות מוצלחות לעגלה ורכישות ששולמו דרך /search-to-cart. אותו מזהה סשן נשמר לאורך הביקור ומתחלף אחרי 30 דקות ללא פעילות. נשמרים החיפוש האחרון ומזהי המוצרים המקוריים של שיפי. דף ללא תוצאות נמדד גם ב־/zero-search, בלי לבצע ניסיון התאוששות. דפדוף ומיון אינם נספרים כחיפוש חדש. אין רישום כל הקלדה בפאנל ההצעות.

## החיפוש המקורי נשאר פעיל
אין מנוע Semantix בחבילה, אין קובצי CSS, אין בקשות /search או /fast-search או /autocomplete או /site-config, ואין הוספת כרטיסים, הודעות או מסכי טעינה. תצורה מהשרת אינה יכולה להפוך את החבילה לגרסת חיפוש פעילה. הפעלת החיפוש בעתיד דורשת החלפה לחבילת החיפוש.

## מסחר ושליחה חוזרת
ההוספות לעגלה נמדדות בשרת רק אחרי הצלחה. השיוך נשמר על ההזמנה ב־checkout רגיל וב־Blocks. רכישה נשלחת גם לאחר חזרה משער תשלום או callback, ורק כאשר WooCommerce מסמן את ההזמנה כששולמה. Action Scheduler או WP-Cron שולחים אירועי מסחר עם עד 8 ניסיונות; הזמנה מסומנת כמדווחת רק לאחר 2xx. אירועי דפדפן דורשים JavaScript וחיבור ל־API. זוהי מדידה של ביצועי החיפוש המקורי, לא מדידת שיפור שנגרם מ־Semantix.

## חיבור
ה־API הקיים הוא ${manifest.apiBase}. לא נדרש שרת חדש. שלושת נתיבי הרישום הראשיים נבדקו מול השרת הקיים בבקשות לא תקינות שנדחו לפני רישום אירועים. הגדרות ← Semantix Shadow מאפשרות לשנות מפתח אתר וכתובת API בלבד. אם יש דחיית JavaScript בתוסף מטמון, החריגו את semantix-commerce.js ו־semantix-shadow.js.

החבילה הוכנה ונבדקה מקומית; לא הותקנה בחנות. לצמצום כפילויות בניסיונות חוזרים ולשמירת הוספות נפרדות של אותו מוצר, עדכון event_id שהוכן מיועד לשירות dashboard-server הקיים; אינו שרת נפרד. מדידת חיפושים, קליקים ורכישות משתמשת בנתיבים הקיימים.
`;
 const files = {
  'semantix-search/semantix-search.php': php,
  'semantix-search/commerce.php': base.files['semantix-search/commerce.php'],
  'semantix-search/assets/semantix-commerce.js': base.files['semantix-search/assets/semantix-commerce.js'],
  'semantix-search/assets/semantix-shadow.js': browser,
  'semantix-search/INSTALL.md': install,
  'semantix-search/manifest.json': JSON.stringify(manifest, null, 2),
 };
 return {manifest, files};
}
