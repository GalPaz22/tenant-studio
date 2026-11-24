// Revision 14 (studio only): gas-stove phrasings ("כיריים גז", "כירת גז ניידת"...) search the store's own word, גזייה.
// Without it the cold path found no semantic candidates and filled the page with luggage (always-results fallback).
const ROOT='/Users/galpaz/Desktop/tenant-studio',ID='5abfb35b-d727-4424-a8b1-ad3dc1940a59';
const {createStore}=await import(ROOT+'/store.mjs'),{validateHooks,createHookRunner}=await import(ROOT+'/core/tenant-hooks.mjs');
const store=createStore(ROOT+'/data'),p=await store.read(ID);
if(String(p.revisions.at(-1).note||'').startsWith('כירת גז'))p.revisions.pop();
const prev=p.revisions.at(-1),at=new Date().toISOString(),profile=structuredClone(prev.profile);
const old=profile.hooks.rewriteQuery.code;
if(!/return query;\s*}\s*$/.test(old))throw Error('unexpected rewriteQuery shape');
const rule=`  // Gas camping stove: the store calls it גזייה; other phrasings found no candidates and got luggage as filler.
  if (/^(כירת|כירה|כיריים|כירי|כירות)\\s+(ל)?גז(\\s+(ניידת|ניידות|קטנה|קטנות|לקמפינג|קמפינג|לשטח|לטיולים|מתקפלת))*$/.test(q.replace(/\\s+/g, ' ')) || /^(גז|גזית)\\s+(נייד|ניידת|לקמפינג)$/.test(q.replace(/\\s+/g, ' ')) || /^כירה ניידת$/.test(q.replace(/\\s+/g, ' '))) return 'גזייה';
  return query;
}`;
const code=old.replace(/\s*return query;\s*}\s*$/,'\n'+rule);
profile.hooks.rewriteQuery={...profile.hooks.rewriteQuery,code,note:profile.hooks.rewriteQuery.note+'; כירת גז / כיריים גז → גזייה',updatedAt:at};
validateHooks(profile.hooks,profile.hookData);
p.revisions.push({number:prev.number+1,profile,note:'כירת גז: ניסוחי כירת גז מחפשים גזייה (במקום מילוי בתיקים)',changes:['hooks'],createdAt:at});
p.events.push({text:`גרסה ${prev.number+1}: כירת גז → גזייה`,at});p.events=p.events.slice(-100);p.updatedAt=at;
await store.save(p);console.log('revision',prev.number+1,'saved');
const r=createHookRunner(profile.hooks,profile.hookData,{tenant:ID});
try{for(const q of ['כירת גז','כיריים גז','כירת גז ניידת','כירה לגז','כירת  גז','כירת גז קטנה','גז נייד','כירה ניידת','כירה','כיריים','גז פלפל','kiwi','תיק','כירת גז חשמלית','גז'])console.log(JSON.stringify(q),'→',JSON.stringify(await r.rewriteQuery(q)));}finally{r.close();}
