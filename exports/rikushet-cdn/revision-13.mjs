// Revision 13 (studio only): Kiwi (shoe polish brand the store does not carry) searches show the store's shoe polish.
const ROOT='/Users/galpaz/Desktop/tenant-studio',ID='5abfb35b-d727-4424-a8b1-ad3dc1940a59';
const {createStore}=await import(ROOT+'/store.mjs'),{validateHooks}=await import(ROOT+'/core/tenant-hooks.mjs');
const store=createStore(ROOT+'/data'),p=await store.read(ID);
if(String(p.revisions.at(-1).note||'').startsWith('קיווי'))p.revisions.pop();
const prev=p.revisions.at(-1),at=new Date().toISOString(),profile=structuredClone(prev.profile);
const rewriteQuery=`function rewriteQuery(query, ctx) {
  const q = String(query || '').trim();
  if (/^(גז|ספריי|ספרי|תרסיס|מרסס) ?פלפל$/.test(q)) return 'ספריי פלפל';
  // Kiwi / קיווי is shoe polish; the store has polish under its own and Zavris brands.
  if (/^(kiwi|קיווי|קיוי)(\\s|$)/i.test(q)) {
    const rest = q.replace(/^(kiwi|קיווי|קיוי)/i, '').trim();
    return rest ? 'משחת נעליים ' + rest : 'משחת נעליים';
  }
  return query;
}`;
profile.hooks.rewriteQuery={...profile.hooks.rewriteQuery,code:rewriteQuery,note:'גז פלפל → ספריי פלפל; kiwi / קיווי → משחת נעליים',updatedAt:at};
validateHooks(profile.hooks,profile.hookData);
p.revisions.push({number:prev.number+1,profile,note:'קיווי: חיפוש מותג שאינו בחנות מציג משחת נעליים',changes:['hooks'],createdAt:at});
p.events.push({text:`גרסה ${prev.number+1}: קיווי → משחת נעליים`,at});p.events=p.events.slice(-100);p.updatedAt=at;
await store.save(p);console.log('revision',prev.number+1,'saved');
const {createHookRunner}=await import(ROOT+'/core/tenant-hooks.mjs');const r=createHookRunner(profile.hooks,profile.hookData,{tenant:ID});
try{for(const q of ['kiwi','Kiwi שחור','קיווי','kiwifruit','גז פלפל','תיק'])console.log(q,'→',await r.rewriteQuery(q));}finally{r.close();}
