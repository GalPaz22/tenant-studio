import {createFastTrackView} from './fast-track-view.js';
import {createLearningView} from './learning-view.js';
import {createApi} from './api.js';
import {createViewState} from './view-state.js';
import {createBuildView} from './build-view.js';
let storage;try{storage=window.localStorage}catch{}
const viewState=createViewState(storage);
let openRequest=0;
const pendingChats=new Set();
const pendingMessages=new Map(),chatFailures=new Map();
let repairContext=null;
function goStudio(handoff){if(handoff)sessionStorage.setItem('studio-handoff',JSON.stringify(handoff));location.href='/?tenant='+project.id;}
function openRepair(context=null){if(project?.catalog?.count&&project.revisions?.length)return goStudio(context?{label:context.label,query:context.query,message:$('message')?.value||''}:undefined);repairContext=context;$('chat-context').textContent=context?'מטפלים ב: '+context.label:'קונטקסט מלא של סביבת הלקוח: קטלוג, שדות, שאילתות, עיבוד ואינדקס';if(!$('chat-dialog').open)$('chat-dialog').showModal();$('message').focus();render();$('messages').scrollTop=$('messages').scrollHeight;}
function selectTenant(id){viewState.select(id);const url=new URL(location.href);if(id)url.searchParams.set('tenant',id);else url.searchParams.delete('tenant');history.replaceState(null,'',url);}
function saveDraft(){if(project)viewState.saveDraft(project.id,{message:$('message').value,query:$('query').value,catalogQuery:$('catalog-query').value});}
const connection=createApi();
const $=id=>document.getElementById(id);let project,poll,cursor,artifact;
const node=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n};
const api=(path,body)=>connection.request(path,body);
$('workspace-agent').onclick=()=>openRepair();
$('open-chat').onclick=()=>openRepair();$('report-search').onclick=()=>openRepair({label:'תוצאות החיפוש: '+$('query').value,query:$('query').value,results:$('results').innerText.slice(0,3000)});$('close-chat').onclick=()=>$('chat-dialog').close();for(const button of document.querySelectorAll('[data-chat-example]'))button.onclick=()=>{$('message').value=button.dataset.chatExample;saveDraft();$('message').focus()};
async function loadAgentLogs(){const id=project?.id;if(!id)return;const root=$('agent-log-content');root.textContent='טוען לוגים…';try{const data=await api('/projects/'+id+'/agent-logs');if(project?.id!==id)return;root.replaceChildren();if(!data.runs.length)root.append(node('p','אין לוגים שמורים. בקשות שנכשלו לפני הוספת התיעוד אינן ניתנות לשחזור.'));for(const run of data.runs){const block=node('details','');block.open=true;block.append(node('summary',new Date(run.startedAt).toLocaleString('he-IL')+' · '+({running:'בפעולה',completed:'הושלם',failed:'נכשל'}[run.status]||run.status)),node('p',run.request));if(run.error)block.append(node('p',run.error,'failure'));for(const event of run.events){const item=node('details','');item.append(node('summary',event.type+' · '+new Date(event.at).toLocaleTimeString('he-IL')),node('pre',event.raw||JSON.stringify(event,null,2)));block.append(item);}root.append(block);}}catch(e){root.textContent=e.message;}}
$('agent-log-refresh').onclick=loadAgentLogs;
function error(e){$('error').textContent=e.message;$('error').hidden=false}
const fastTrackView=createFastTrackView({api,getProject:()=>project,update:p=>{project=p;render()},error,openProposal:(proposal,discuss=false)=>{openRepair({label:proposal.title,proposal});$('message').value=proposal.allIssues?'טפל בכל ההצעות והחוסרים בדוח הניתוח העדכני של הלקוח. התייחס לדוח כהצעות לבדיקה, אמת את הצורך בכל תיקון מול הנתונים ופעל לפי סדר עדיפות. בצע בעותק העבודה את התיקונים שהכלים הקיימים מאפשרים, שמור על שדות המקור ובנה מחדש את האינדקס לאחר שינויים. אל תסרוק או תסנכרן את החנות ואל תפרסם לפרודקשן. אל תמציא נתונים חסרים. בסיום פרט מה בוצע, מה לא ניתן לבצע ומה נותר לטיפול בגלל מגבלות היקף או מידע חסר.':discuss?'הסבר את ההצעה ״'+proposal.title+'״ ומה נדרש לביצוע. אל תשנה נתונים.':'טפל בהצעה ״'+proposal.title+'״ בעותק העבודה. בדוק את שדות המקור, בצע את העיבוד המתאים ובנה את האינדקס מחדש. אם חסר מידע, הסבר מה חסר. התמקד רק בהצעה הזו.';saveDraft();$('message').focus();}});
const learningView=createLearningView({api,getProject:()=>project,update:p=>{project=p;render()},error});
const buildView=createBuildView({api,getProject:()=>project,refresh:async()=>{if(project)await open(project.id)},error,openRepair});
$('research').onclick=e=>action(e.target,async()=>{const id=project.id;$('researchpanel').hidden=false;$('researchpanel').open=true;$('researchreport').textContent='מייבא קטלוג מלא ומכין מעבד ייעודי. הפעולה עשויה לקחת מספר דקות.';const p=await api('/projects/'+id+'/research',{});if(project?.id!==id)return;project=p;render();$('researchreport').textContent=JSON.stringify(p.research,null,2);await list();});
function renderScan(scan){
 $('scanfindings').replaceChildren();
 $('scanreport').textContent=scan?JSON.stringify(scan,null,2):'';
 if(!scan){$('scanstatus').textContent='טרם בוצעה סריקה.';return;}
 const observations=scan.observations||[],badges=observations.reduce((n,o)=>n+o.badges.length,0),tags=observations.reduce((n,o)=>n+o.tags.length,0);
 $('scanstatus').textContent=`סריקה אחרונה: ${new Date(scan.scannedAt).toLocaleString('he-IL')} · ${scan.pages} עמודים · ${observations.length} מוצרים שזוהו · ${badges} באדג׳ים · ${tags} תגיות · ${scan.errors.length} שגיאות`;
 $('scanfindings').append(node('p','זהו מדגם של עד 6 עמודים. מידע שמופיע רק לאחר הרצת JavaScript עשוי לא להיקלט.','hint'));
 if(!badges&&!tags)$('scanfindings').append(node('p','לא זוהו תגיות או באדג׳ים בעמודים שנסרקו. אין בכך קביעה שאין כאלה באתר.'));
 for(const o of observations){
  if(!o.badges.length&&!o.tags.length)continue;
  const card=node('article','','card'),link=node('a','מוצר '+o.id),url=safeUrl(o.url);
  if(url){link.href=url;link.target='_blank';link.rel='noreferrer';}
  card.append(link);
  for(const badge of o.badges)card.append(node('span',badge.text,'badge'));
  if(o.tags.length)card.append(node('p','תגיות: '+o.tags.join(' · ')));
  const source=node('a','עמוד המקור'),sourceUrl=safeUrl(o.sourceUrl);
  if(sourceUrl){source.href=sourceUrl;source.target='_blank';source.rel='noreferrer';card.append(source);}
  $('scanfindings').append(card);
 }
 for(const failure of scan.errors)$('scanfindings').append(node('p',failure.url+' — '+failure.error));
}
$('scrape').onclick=e=>action(e.target,async()=>{
 const id=project.id;
 $('scanpanel').open=true;$('scanstatus').textContent='סורק את כל הקטלוג. הפעולה עשויה לקחת כמה דקות…';
 $('scanpanel').scrollIntoView({behavior:'smooth',block:'nearest'});
 try{
  const p=await api('/projects/'+id+'/scrape',{});if(project?.id!==id)return;
  project=p;render();renderScan(p.badgeScan);
  $('searchnote').textContent='הסריקה הסתיימה. הרץ שוב חיפוש להצגת הבאדג׳ים.';cursor=null;$('more').hidden=true;
 }catch(e){if(project?.id===id)$('scanstatus').textContent='הסריקה נכשלה: '+e.message;throw e;}
});
function safeUrl(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:null}catch{return null}}
async function action(button,fn){button.disabled=true;$('error').hidden=true;try{await fn()}catch(e){error(e)}finally{button.disabled=false}}
async function list(){const p=await api('/projects');$('projects').replaceChildren(...p.map(p=>{const b=node('button',p.name);b.onclick=()=>open(p.id).catch(error);return b}))}
async function open(id){
 clearTimeout(poll);
 const request=++openRequest;
 const next=await api('/projects/'+id);
 if(request!==openRequest)return;
 if(project?.id!==id){
  saveDraft();repairContext=null;$('chat-context').textContent='';$('chat-status').textContent='';$('chat-dialog').close();
  const draft=viewState.draft(id);$('message').value=draft.message;$('query').value=draft.query;$('catalog-query').value=draft.catalogQuery||'';
  cursor=null;$('more').hidden=true;$('results').replaceChildren(node('div','תוצאות אמיתיות מהקטלוג יופיעו כאן.','empty'));$('searchnote').textContent='';
 }
 project=next;selectTenant(id);
 renderScan(project.badgeScan);$('scanpanel').open=Boolean(project.badgeScan);
 $('research').hidden=true;
 $('researchpanel').hidden=!project.research;
 $('researchreport').textContent=project.research?JSON.stringify(project.research,null,2):'';
 render();
 if(['discovering','designing','building'].includes(project.status)&&!['paused','partial','failed','cancelled'].includes(project.buildRun?.status)||['queued','running'].includes(project.buildRun?.status)||project.tagging||['analyzing','executing'].includes(project.buildRun?.repair?.status))poll=setTimeout(()=>open(id).catch(error),1500);
}
$('message').addEventListener('input',saveDraft);
$('repair-request').onsubmit=e=>{e.preventDefault();$('message').value=$('repair-message').value;saveDraft();openRepair();$('chat').requestSubmit();};
$('query').addEventListener('input',saveDraft);
$('catalog-query').addEventListener('input',saveDraft);

function render(){const p=project;const messages=$('messages'),follow=messages.scrollHeight-messages.scrollTop-messages.clientHeight<60;$('welcome').hidden=true;$('workspace').hidden=false;$('name').textContent=p.name;$('source').textContent=p.url;$('source').href=p.url;$('status').textContent=(['queued','running'].includes(p.buildRun?.status)?'בונה את החנות':(({created:'מוכן להתחלה',discovering:'חוקר אתר',designing:'בונה מודול',draft:'גרסה לבדיקה',failed:'נדרש טיפול',building:'בונה את החנות',paused:'הבנייה נעצרה',partial:'כיסוי חלקי',cancelled:'הריצה בוטלה'})[p.status]||p.status))+(p.tagging?' · מתייג קטלוג…':'');$('events').replaceChildren(...(p.buildRun?.events||p.events).slice(-8).map(e=>node('div',e.text)));$('warnings').textContent=[...(p.buildRun?.warnings||p.catalog?.warnings||[]),p.provisioning?.message].filter(Boolean).join(' · ');$('count').textContent=(p.buildRun?.metrics?.products||p.catalog?.count||0)+(p.buildRun?.metrics?.products?' מוצרים שנקראו מהמקור':p.catalog?.sample?' מוצרים במקור חלקי':' מוצרים במקור המחובר');$('version').textContent='גרסה '+p.revisions.length;$('chat-model').textContent=p.chatModel||'';$('profile').textContent=JSON.stringify(p.revisions.at(-1)||{},null,2);$('revisions').replaceChildren(...p.revisions.map(r=>{const o=node('option','גרסה '+r.number+' · '+r.note.slice(0,25));o.value=r.number;return o}));$('messages').replaceChildren(...p.messages.map(m=>{const b=node('div','','bubble '+m.role);b.append(node('strong',m.role==='user'?'אתה':'האייג׳נט'),node('div',m.text,'message-text'));if(m.changes?.length)b.append(node('div','שדות שהשתנו: '+m.changes.join(', '),'changes'));if(m.trace?.length){const details=node('details','');details.append(node('summary','מה העוזר בדק'));m.trace.forEach(t=>details.append(node('p',t)));b.append(details)}if(m.affectedProducts)b.append(node('p',m.affectedProducts+' מוצרים נכללו בכלל החיפוש הממוקד. ללא סיווג מחדש.','changes'));for(const c of m.checks||[]){if(c.before.unavailable||c.after.unavailable){b.append(node('p','בדיקת ״'+c.query+'״ אינה זמינה: עדיין אין אינדקס מקומי לבדיקה.','hint'));continue;}b.append(node('p','בדיקת כללים: ״'+c.query+'״ — '+c.before.total+' לפני, '+c.after.total+' אחרי.','changes'));if(c.after.products?.length)b.append(node('p',c.after.products.map(p=>p.title).join(' · '),'hint'));}return b}));if(pendingMessages.has(p.id)){const own=node('div',pendingMessages.get(p.id),'bubble user');own.prepend(node('strong','אתה'));const waiting=node('div','האייג׳נט עובד על הבקשה…','bubble assistant working');$('messages').append(own,waiting);}if(chatFailures.has(p.id))$('messages').append(node('div',chatFailures.get(p.id),'bubble assistant failure'));
 if(!p.messages.length&&!pendingMessages.has(p.id))$('messages').append(node('div','כאן נבנה יחד את שפת החנות ואת כללי החיפוש.','empty'));$('chat').querySelector('button').disabled=pendingChats.has(p.id)||(!p.revisions.length&&!p.previewSearchAvailable)||['queued','running'].includes(p.buildRun?.status)||['analyzing','executing'].includes(p.buildRun?.repair?.status);$('chat').querySelector('button').textContent='שלח לאייג׳נט';$('search').querySelector('button').disabled=!p.revisions.length&&!p.previewSearchAvailable;$('repair-submit').disabled=$('chat').querySelector('button').disabled;buildView.render(p);learningView.render(p);fastTrackView.render(p);const existing=$('existing-info');existing.hidden=!p.existingClient;existing.replaceChildren();if(p.existingClient){existing.append(node('h2','לקוח קיים: '+p.existingClient.username),node('p','עותק עבודה מהנתונים השמורים · '+new Date(p.existingClient.loadedAt).toLocaleString('he-IL')),node('p',p.existingClient.categories.length+' קטגוריות · '+p.existingClient.tags.length+' תגיות שמורות'));const labels=node('details','');labels.append(node('summary','הצג קטגוריות ותגיות'),node('p',p.existingClient.categories.join(' · ')),node('p',p.existingClient.tags.join(' · ')));existing.append(labels);}if(follow)messages.scrollTop=messages.scrollHeight;if(p.previewSearchAvailable)$('searchnote').textContent='אפשר לבדוק את הבנייה החלקית. סיווגים ואימות קטלוג עדיין דורשים טיפול.'}
$('new').onclick=()=>{clearTimeout(poll);++openRequest;saveDraft();selectTenant(null);project=null;$('workspace').hidden=true;$('welcome').hidden=false};
$('existing-client').onsubmit=e=>{e.preventDefault();action(e.submitter,async()=>{const p=await api('/existing-client',{username:$('existing-username').value.trim()});await list();await open(p.id)})};
$('create').onsubmit=e=>{e.preventDefault();action(e.submitter,async()=>{const p=await api('/projects',{url:$('url').value,platform:$('platform').value});await api('/projects/'+p.id+'/build',{options:buildView.options(p)});await list();await open(p.id)})};
$('build').onclick=e=>action(e.target,async()=>{await api('/projects/'+project.id+'/build',{options:buildView.options(project)});await open(project.id)});
$('chat').onsubmit=async e=>{
 e.preventDefault();const id=project.id,message=$('message').value.trim();if(!message||pendingChats.has(id))return;
 pendingChats.add(id);pendingMessages.set(id,message);chatFailures.delete(id);$('agent-log-panel').open=false;render();$('messages').scrollTop=$('messages').scrollHeight;$('chat-status').textContent=project.tagging?'הבקשה ממתינה לסיום סיווג התגיות הקודם. התיאור נשמר…':'בודק את הבעיה ומכין תיקון…';
 try{const p=await api('/projects/'+id+(project.revisions.length?'/agent':'/chat'),{message,context:repairContext});
  if(project?.id!==id)return;
  pendingMessages.delete(id);project=p;$('search-active').checked=false;
  if($('message').value.trim()===message)$('message').value='';saveDraft();render();$('messages').scrollTop=$('messages').scrollHeight;
  const changed=p.messages.at(-1)?.changes?.length;
  $('chat-status').textContent=changed?(p.tagging?'כללי החיפוש נשמרו. סיווג המוצרים עדיין מתבצע…':'התיקון נשמר בגרסת העבודה. אפשר להריץ שוב את החיפוש ולבדוק.'): 'האייג׳נט סיים. פירוט הפעולות והמגבלות מופיע בתשובה למעלה.';
  cursor=null;$('more').hidden=true;if(changed)$('searchnote').textContent='כללי החיפוש השתנו — הרץ שוב כדי לבדוק את התוצאה.';
  await list();
 }catch(e){if(project?.id===id){$('chat-status').textContent='התיקון לא הושלם. התיאור נשמר לניסיון נוסף: '+e.message;chatFailures.set(id,'הבקשה לא הושלמה: '+e.message+'\nהטקסט נשמר. אפשר לערוך ולשלוח שוב, או לפתוח את הלוגים למטה.');await loadAgentLogs();}}
 finally{pendingChats.delete(id);pendingMessages.delete(id);if(project?.id===id){render();$('messages').scrollTop=$('messages').scrollHeight;}}
};
$('rollback').onclick=e=>action(e.target,async()=>{project=await api('/projects/'+project.id+'/rollback',{revision:Number($('revisions').value)});cursor=null;$('more').hidden=true;render()});
function cards(products,append){if(!append)$('results').replaceChildren();for(const p of products){const c=node('article','','card');const image=safeUrl(p.image);if(image){const img=document.createElement('img');img.src=image;img.loading='lazy';img.alt=p.title;c.append(img)}const a=node('a',p.title);const url=safeUrl(p.url);if(url){a.href=url;a.target='_blank';a.rel='noreferrer'}const h=document.createElement('h3');h.append(a);c.append(h);for(const b of p.badges||[])c.append(node('span',b.text,'badge'));if(p.matchQuality==='alternative'){c.append(node('span','חלופה — לא התאמה מלאה','badge'));if(p.alternativeReason)c.append(node('p',p.alternativeReason));if(p.missingRequirements?.length)c.append(node('p','חסר או לא אומת: '+p.missingRequirements.join(' · '),'hint'));}c.append(node('p',p.price===null?'':String(p.price)+' '+(p.currency||'')));$('results').append(c)}}
async function search(append){const id=project.id;const r=await api('/projects/'+id+($('search-active').checked?'/active/search':'/search'),{...(append?{cursor,limit:6}:{query:$('query').value,limit:6}),...(!$('search-active').checked&&project.previewSearchAvailable?{runId:project.buildRun.id}:{})});if(project?.id!==id)return;cards(r.matches,append);if(!append&&!r.matches.length)$('results').append(node('div',r.message||'לא נמצאו מוצרים מתאימים.','empty'));cursor=r.nextCursor;$('more').hidden=!cursor;$('searchnote').textContent=[r.message,r.metadata?.phase,r.metadata?.llmUsed?(r.metadata?.models?.join(', ')||'LLM הופעל'):(r.metadata?.indexKind==='atlas'?'Atlas':'אינדקס מקומי'),r.total+' תוצאות'].filter(Boolean).join(' · ')}
$('search').onsubmit=e=>{e.preventDefault();action(e.submitter,()=>search(false))};$('more').onclick=e=>action(e.target,()=>search(true));
$('artifacts').onclick=e=>action(e.target,async()=>{artifact=await api('/projects/'+project.id+'/artifacts');$('artifact').textContent=JSON.stringify(artifact,null,2);$('dialog').showModal()});$('close').onclick=()=>$('dialog').close();$('download').onclick=e=>action(e.target,async()=>{const blob=await connection.request('/projects/'+project.id+'/download',undefined,true);const url=URL.createObjectURL(blob);const a=node('a','');a.href=url;a.download='tenant-module.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
$('provision').onclick=e=>action(e.target,async()=>{const r=await api('/projects/'+project.id+'/provision',{});$('events').append(node('div',r.message));});
try{await list();const id=new URL(location.href).searchParams.get('tenant')||viewState.selected();if(id&&/^[a-f0-9-]{36}$/.test(id))await open(id)}catch(e){error(e)}
