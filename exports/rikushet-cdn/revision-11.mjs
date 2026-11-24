// Revision 11 (studio only): for a bare Columbia / קולומביה search, coats and micro-fleece first, hats and shirts last.
const ROOT='/Users/galpaz/Desktop/tenant-studio',ID='5abfb35b-d727-4424-a8b1-ad3dc1940a59';
const {createStore}=await import(ROOT+'/store.mjs');
const store=createStore(ROOT+'/data'),p=await store.read(ID);
if(String(p.revisions.at(-1).note||'').startsWith('קולומביה'))p.revisions.pop();
const prev=p.revisions.at(-1),at=new Date().toISOString();
const profile=structuredClone(prev.profile);
const base=profile.hooks.rerank.code.replace('function rerank(matches, query, ctx) {','function rikushetBeforeColumbia(matches, query, ctx) {');
if(base===profile.hooks.rerank.code)throw new Error('rerank signature not found');
const extra=`
function rerank(matches, query, ctx) {
  const ids = rikushetBeforeColumbia(matches, query, ctx);
  const q = String(query || '').toLowerCase().replace(/[\\u05f3\\u05f4\\u2019\\x27\\x22\\x60]/g, '').replace(/\\s+/g, ' ').trim();
  const rest = q.replace(/columbia|קולומביה/g, ' ').replace(/(^|\\s)(ל?נשים|ל?גברים|לנשים|יוניסקס)(?=$|\\s)/g, ' ').replace(/\\s+/g, ' ').trim();
  if (rest === q || rest) return ids;
  const byId = new Map(matches.map(m => [String(m.id), m]));
  const title = id => String((byId.get(String(id)) || {}).title || (byId.get(String(id)) || {}).name || '');
  const rank = id => {
    const t = title(id);
    if (/מעיל|ג.?קט|פליס|פליז|פוך|סופטשל|סוודר|jacket|fleece|parka|puffer/i.test(t)) return 0;
    if (/כובע|beanie|\\bcap\\b|בלאקלווה|באלקלה|balaclava|חולצ|טי שירט|\\btee\\b|t-shirt|polo|פולו|shirt/i.test(t)) return 2;
    return 1;
  };
  return ids.map((id, i) => [id, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(x => x[0]);
}`;
profile.hooks.rerank={...profile.hooks.rerank,code:base+extra,note:'קולומביה: מעילים ומיקרופליס לפני כובעים וחולצות',updatedAt:at};
p.revisions.push({number:prev.number+1,profile,note:'קולומביה: מעילים ומיקרופליס לפני כובעים וחולצות',changes:[],createdAt:at});
p.events.push({text:`גרסה ${prev.number+1}: קולומביה, מעילים ומיקרופליס לפני כובעים וחולצות`,at});p.events=p.events.slice(-100);p.updatedAt=at;
await store.save(p);console.log('revision',prev.number+1,'saved');
