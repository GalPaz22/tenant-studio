// Revision 8 of Rikushet's profile (studio only), from the first hours of the live split (14.11): rev 7 plus the words shoppers
// typed that the titles lack (מימיה, חבל, סכינים, מצנפת, גז פלפל, לד, lowa, northface), shoe-care after shoes, rope before
// sapper tape, and no travel-bag filler for queries that have nothing to do with travel.
import {createRequire} from 'node:module';
const ROOT='/Users/galpaz/Desktop/tenant-studio',ID='5abfb35b-d727-4424-a8b1-ad3dc1940a59';
const {createStore}=await import(ROOT+'/store.mjs');
const transformProduct=`function transformProduct(product, ctx) {
  const title = product.title || '';
  const tags = Array.isArray(product.tags) ? [...product.tags] : [];
  const add = t => { if (t && !tags.includes(t)) tags.push(t); };
  if (/osprey|velocity|kestrel|aether|atmos|kyte|sirrus|מוצ׳ילה|מוצילה/i.test(title)) { add('מוצילה'); add('מוצ׳ילה'); }
  // The brand as the store prints it on its cards, plus the spellings shoppers type.
  const brand = String(product.brand || '').replace(/[’']/g, '').trim();
  if (brand) {
    add(brand);
    const b = brand.toLowerCase();
    const aliases = [
      [/wolfskin|וולפסקין/, ['jack wolfskin', 'ג׳ק וולפסקין']],
      [/hydroflask|hydro flask/, ['hydro flask', 'hydroflask', 'הידרו פלאסק']],
      [/קסיו|casio/, ['casio', 'קסיו']],
      [/ג.?י שוק|g.?shock/, ['g shock', 'g-shock', 'gshock', 'ג׳י שוק']],
      [/לדרמן|leatherman/, ['leatherman', 'לדרמן']],
      [/בלנדסטון|blundstone/, ['blundstone', 'בלנדסטון']],
      [/טבע נאות|teva/, ['teva', 'טבע נאות']],
      [/columbia/, ['columbia', 'קולומביה']],
      [/north face/, ['the north face', 'north face', 'נורת׳ פייס']],
      [/^outdoor/, ['outdoor', 'outdoor revolution']],
      [/go nature/, ['go nature', 'גו נייצ׳ר']],
      [/redback|רדבק/, ['redback', 'רדבק']],
      [/hoka/, ['hoka', 'הוקה']],
      [/salomon/, ['salomon', 'סלומון']],
      [/osprey/, ['osprey', 'אוספרי']],
      [/deuter/, ['deuter', 'דויטר']],
      [/שרש|source/, ['source', 'שרש']]
    ];
    for (const [rx, names] of aliases) if (rx.test(b)) names.forEach(add);
  }
  // Words shoppers type that the titles do not hold (live queries 14.11).
  const words = [
    [/בקבוק|בקבוקר|שלוקר|מערכת שתי|camelbak|hydro ?flask/i, ['מימיה', 'מימייה', 'מימיות', 'מימיה צבאית']],
    [/מיתר|פרקורד|paracord/i, ['חבל', 'חבלים', 'פרקורד', 'paracord', 'מיתר צניחה']],
    [/סכין|אולר/, ['סכין', 'סכינים']],
    [/כובע גרב|beanie/i, ['מצנפת', 'מצנפות']],
    [/גז פלפל|תרסיס פלפל|משגר פלפל|guardian angel/i, ['גז פלפל', 'ספריי פלפל', 'גז מדמיע']],
    [/\bled\b/i, ['לד']],
    [/לואה|lowa/i, ['lowa', 'לואה']],
    [/north face/i, ['northface', 'the north face', 'נורת׳ פייס']]
  ];
  for (const [rx, names] of words) if (rx.test(title) || rx.test(brand)) names.forEach(add);
  return { ...product, tags };
}`;
const rerank=`function rerank(matches, query, ctx) {
  const q = ctx.normalize(query);
  let order = matches;
  if (q.includes('מוציל')) {
    const isBrandOrMochila = (item) => {
      const t = (item.title || '').toLowerCase();
      return t.includes('osprey') || t.includes('velocity') || t.includes('מוצ׳ילה') || t.includes('מוצילה');
    };
    const isArmy = (item) => {
      const t = (item.title || '');
      return t.includes('צבא') || t.includes('חייל') || t.includes('חיילים') || t.includes('טקטי');
    };
    const brandMochilas = [], others = [], army = [];
    for (const m of matches) {
      if (isBrandOrMochila(m)) brandMochilas.push(m);
      else if (isArmy(m)) army.push(m);
      else others.push(m);
    }
    order = [...brandMochilas, ...others, ...army];
  }
  const after = (test) => { const a = [], b = []; for (const m of order) (test(m) ? b : a).push(m); order = [...a, ...b]; };
  // Shoes before shoe care, unless the shopper asks for the care.
  if (/נעל/.test(q) && !/משח|מברש|שרוכ|ספוג/.test(q)) after(m => /משחת נעל|מברשת נעל|שרוכי נעל|לנעליים/.test(m.title || ''));
  // Rope before sapper tape (חבלה).
  if (/(^|\s)חבל(ים)?(\s|$)/.test(q)) after(m => /חבלה/.test(m.title || ''));
  // With nothing to match, the catalog's first products (travel bags, a luggage scale) came back as filler.
  if (!/נסיע|מזווד|טרולי|צימידן|תיק|משקל|duffel|travel|luggage|טיול|חו.?ל/.test(q)) {
    const filler = new Set(['10101800010', '10101800003', '10101800004', 'LILO121_020', '01800000001', '10101800001']);
    order = order.filter(m => !filler.has(String(m.id)));
  }
  // One card per product: the store's colours and sizes of one product share its title.
  const seen = new Set(), ids = [];
  for (const m of order) {
    const t = String(m.title || '').replace(/\\s+/g, ' ').trim().toLowerCase();
    if (t && seen.has(t)) continue;
    seen.add(t);
    ids.push(m.id);
  }
  return ids;
}`;
// The model's check drops the Guardian Angel launcher for "גז פלפל"; the shoppers' other names keep it.
const rewriteQuery=`function rewriteQuery(query, ctx) {
  const q = String(query || '').trim();
  if (/^(גז|ספריי|ספרי|תרסיס|מרסס) ?פלפל$/.test(q)) return 'ספריי פלפל';
  return query;
}`;
const store=createStore(ROOT+'/data'),p=await store.read(ID);
// Run again, it replaces its own revision instead of adding another.
if(String(p.revisions.at(-1).note||'').startsWith('מילים חסרות'))p.revisions.pop();
const prev=p.revisions.at(-1),at=new Date().toISOString();
const profile=structuredClone(prev.profile);
profile.hooks={...profile.hooks,rewriteQuery:{code:rewriteQuery,note:'גז פלפל → ספריי פלפל',updatedAt:at},transformProduct:{code:transformProduct,note:'מותג כתגית לחיפוש, עם האיותים שגולשים מקלידים, ומילים שחסרות בכותרות (מימיה, חבל, סכינים…)',updatedAt:at},rerank:{code:rerank,note:'מוצ׳ילה קודם; נעליים לפני משחה; חבל לפני חבלה; בלי תיקי נסיעות כמילוי; כרטיס אחד לכל כותרת',updatedAt:at}};
p.revisions.push({number:prev.number+1,profile,note:'מילים חסרות, סדר נעליים/חבל, בלי מילוי תיקי נסיעות (שאילתות הפיצול 14.11)',changes:[],createdAt:at});
p.events.push({text:`גרסה ${prev.number+1}: מילים חסרות, סדר נעליים/חבל, בלי מילוי תיקי נסיעות`,at});p.events=p.events.slice(-100);p.updatedAt=at;
await store.save(p);console.log('revision',prev.number+1,'saved');
