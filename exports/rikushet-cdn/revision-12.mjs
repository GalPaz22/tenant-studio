// Revision 12 (studio only): Rikushet never shows 0 results. Same opt-in Fox Home uses (catalogSearchRules.alwaysResults + llmOnEmpty):
// when nothing matches, the model picks the closest sellable products and the page labels them as alternatives.
const ROOT='/Users/galpaz/Desktop/tenant-studio',ID='5abfb35b-d727-4424-a8b1-ad3dc1940a59';
const {createStore}=await import(ROOT+'/store.mjs');
const store=createStore(ROOT+'/data'),p=await store.read(ID);
if(String(p.revisions.at(-1).note||'').startsWith('תמיד תוצאות'))p.revisions.pop();
const prev=p.revisions.at(-1),at=new Date().toISOString();
const profile=structuredClone(prev.profile);
profile.hookData={...profile.hookData,
 rikushetSearchRules:{...profile.hookData?.rikushetSearchRules,strictAlternatives:false,version:'2026-11-22'},
 catalogSearchRules:{...profile.hookData?.catalogSearchRules,alwaysResults:true,llmOnEmpty:true}};
p.revisions.push({number:prev.number+1,profile,note:'תמיד תוצאות: חלופות קרובות במקום 0 תוצאות (kiwi)',changes:[],createdAt:at});
p.events.push({text:`גרסה ${prev.number+1}: תמיד תוצאות, חלופות קרובות במקום 0 תוצאות`,at});p.events=p.events.slice(-100);p.updatedAt=at;
await store.save(p);console.log('revision',prev.number+1,'saved');
