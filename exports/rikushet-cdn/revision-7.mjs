// Revision 7 of Rikushet's profile (studio only): the store's brand becomes searchable, and results keep one card per
// product title (the catalog lists every colour/size of a product as its own card with the same title).
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
const store=createStore(ROOT+'/data'),p=await store.read(ID),prev=p.revisions.at(-1),at=new Date().toISOString();
const profile=structuredClone(prev.profile);
profile.hooks={...profile.hooks,transformProduct:{code:transformProduct,note:'מותג כתגית לחיפוש, עם האיותים שגולשים מקלידים',updatedAt:at},rerank:{code:rerank,note:'מוצ׳ילה קודם; כרטיס אחד לכל כותרת',updatedAt:at}};
p.revisions.push({number:prev.number+1,profile,note:'מותג בחיפוש וכרטיס אחד לכל מוצר (בדיקת שאילתות אמיתיות 14.11)',changes:[],createdAt:at});
p.events.push({text:`גרסה ${prev.number+1}: מותג בחיפוש וכרטיס אחד לכל מוצר`,at});p.events=p.events.slice(-100);p.updatedAt=at;
await store.save(p);console.log('revision',prev.number+1,'saved');
