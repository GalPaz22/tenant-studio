import {createApi} from './api.js';
import {pluginWorkspacePanel} from './plugin-workspace.js';
import {createPluginBuilder} from './plugin-builder.js';
import {renderTakeover as takeoverPanel} from './takeover.js';
import {demoUrl} from './demo-url.js';

const connection=createApi(),api=(path,body)=>connection.request(path,body);
const $=id=>document.getElementById(id);
let project=null,busy=false,attached=null;
// While the agent works, the send button becomes "עצור": it aborts the stream and the server stops the agent at its next step.
let running=null;
function startRun(){running=new AbortController();const b=$('send');b.textContent='עצור';b.classList.add('stop');b.disabled=false;b.title='עצור את האייג׳נט';return running.signal;}
function endRun(){running=null;const b=$('send');b.textContent='שלח';b.classList.remove('stop');b.disabled=false;b.title='';}
const aborted=err=>err?.name==='AbortError';
const welcome=$('welcome');

function el(tag,attrs={},...children){
 const n=document.createElement(tag);
 for(const [k,v] of Object.entries(attrs)){if(v==null||v===false)continue;if(k==='class')n.className=v;else if(k.startsWith('on'))n.addEventListener(k.slice(2),v);else n.setAttribute(k,v===true?'':v);}
 for(const c of children.flat())if(c!=null&&c!==false)n.append(c instanceof Node?c:String(c));
 return n;
}
// replaceChildren prints null/false as text; tabs build optional parts, so drop them.
const fill=(root,...parts)=>root.replaceChildren(...parts.flat().filter(x=>x!=null&&x!==false&&x!==''));
const loading=(root,text='טוען…')=>{if(!root.children.length||root.dataset.for!==project?.id){root.dataset.for=project?.id||'';root.replaceChildren(el('p',{class:'working'},text));}};
function toast(message){const t=$('toast');t.textContent=message;t.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>{t.hidden=true;},7000);}
const safeUrl=v=>{try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)?u.href:null;}catch{return null;}};

// Minimal Markdown: headings, bullet/numbered lists, paragraphs, **bold**, `code`. Text only, no HTML.
function inline(text){const out=[];for(const part of String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g)){if(!part)continue;if(part.startsWith('**')&&part.endsWith('**'))out.push(el('strong',{},part.slice(2,-2)));else if(part.startsWith('`')&&part.endsWith('`'))out.push(el('code',{},part.slice(1,-1)));else out.push(part);}return out;}
function markdown(text){
 const root=el('div',{class:'md'});let list=null;
 for(const raw of String(text||'').split('\n')){
  const line=raw.trimEnd(),item=line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/),heading=line.match(/^#{1,4}\s+(.*)$/);
  if(item){const ordered=/^\s*\d/.test(line);if(!list||list.ordered!==ordered){list=el(ordered?'ol':'ul');list.ordered=ordered;root.append(list);}list.append(el('li',{},inline(item[1])));continue;}
  list=null;if(!line.trim())continue;
  root.append(heading?el('h4',{},inline(heading[1])):el('p',{},inline(line)));
 }
 return root;
}

// ---------- clients ----------
async function loadClients(){
 const list=await api('/projects'),nav=$('client-list');nav.replaceChildren();
 for(const c of list)nav.append(el('button',{class:'client'+(project?.id===c.id?' active':''),onclick:()=>openClient(c.id)},el('b',{},c.name),el('small',{},c.products?`${c.products.toLocaleString('he-IL')} מוצרים · גרסה ${c.revision}`:c.status==='building'?'בבנייה…':'ללא קטלוג שמור')));
 if(!list.length)nav.append(el('p',{class:'meta'},'אין עדיין לקוחות. פתח לקוח קיים לפי שם משתמש, או קלוט לקוח חדש מכתובת האתר.'));
 return list;
}
async function openClient(id){
 if(busy)return toast('האייג׳נט עדיין עובד על הבקשה הקודמת');
 project=await api('/projects/'+id);const url=new URL(location.href);url.searchParams.set('tenant',id);history.replaceState(null,'',url);localStorage.setItem('studio-tenant',id);
 attached=null;renderAttached();renderClient();loadClients();
}
// Opening an existing client: when the name matches several users, the operator picks one from the list.
async function openExisting(username,userId){
 const picker=$('client-picker');
 try{project=await api('/existing-client',userId?{username,userId}:{username});$('client-username').value='';picker.replaceChildren();picker.hidden=true;renderClient();await loadClients();}
 catch(err){
  if(err.code!=='AMBIGUOUS'||!err.candidates?.length){toast(err.message);return;}
  picker.hidden=false;
  picker.replaceChildren(el('p',{},`נמצאו ${err.candidates.length} לקוחות בשם "${username}". איזה מהם?`),
   ...err.candidates.map(c=>el('button',{type:'button',class:'picker-option',onclick:async e=>{e.currentTarget.disabled=true;await openExisting(username,c.userId);}},
    el('b',{},c.username||c.name||'ללא שם'),el('small',{dir:'ltr'},[c.dbName&&'db: '+c.dbName,c.platform,c.name&&c.name!==c.username&&c.name].filter(Boolean).join(' · ')))),
   el('button',{type:'button',class:'link',onclick:()=>{picker.replaceChildren();picker.hidden=true;}},'ביטול'));
 }
}
$('open-client').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{await openExisting($('client-username').value.trim());}finally{button.disabled=false;}};

// ---------- new client from a URL ----------
$('new-client').onsubmit=async e=>{e.preventDefault();const button=e.submitter,input=$('client-url'),url=input.value.trim();if(!url||busy)return;
 busy=true;button.disabled=true;const signal=startRun();
 // The previous client's version, demo and audit controls must not linger while a new one is being onboarded.
 clearTimeout(refreshBuild.timer);project=null;$('client-version').hidden=true;setAuditButtons();
 const thread=$('thread');thread.replaceChildren();$('suggestions').hidden=true;$('client-name').textContent=url;$('client-meta').textContent='קליטת לקוח חדש';
 thread.append(userBubble('קליטת לקוח חדש: '+url));const box=assistantBubble(),steps=box.querySelector('.steps'),bodyEl=box.querySelector('.body'),status=el('p',{class:'working'},'בודק את האתר…');
 bodyEl.append(status);thread.append(box);steps.hidden=false;
 const step=(text,ok=true)=>{const last=steps.lastElementChild;if(last?.classList.contains('running'))last.className='step ok';steps.append(el('li',{class:'step '+(ok===null?'running':ok?'ok':'fail')},el('span',{class:'label'},text)));};
 let opened=null;
 try{
  const result=await connection.stream('/onboard',{url},ev=>{
   if(ev.type==='note'){status.textContent=ev.text;step(ev.text,null);}
   else if(ev.type==='detected'){for(const n of ev.detection.notes)step(n);}
   else if(ev.type==='scraper')step(`סורק ייעודי: שם ${Math.round(ev.fill.name*100)}% · מחיר ${Math.round(ev.fill.price*100)}% · מזהה ${Math.round(ev.fill.key*100)}% (${ev.fields.join(', ')})`,ev.fill.price>=0.8);
   else if(ev.type==='done')opened=ev.project;
   else if(ev.type==='error'||ev.type==='stopped'){status.remove();bodyEl.append(el('p',{class:ev.type==='stopped'?'meta':'error'},ev.message));if(ev.projectId)opened={id:ev.projectId};}
  },signal);
  if(result?.existing){toast('הלקוח כבר קיים — נפתח');opened=result.project;}
  if(opened){input.value='';busy=false;await openClient(opened.id);}
 }catch(err){status.remove();if(aborted(err)){bodyEl.append(el('p',{class:'meta'},'הקליטה נעצרה. לא התחילה בנייה.'));loadClients();}else bodyEl.append(el('p',{class:'error'},err.message));}
 finally{endRun();status.remove();busy=false;button.disabled=false;const last=steps.lastElementChild;if(last?.classList.contains('running'))last.className='step ok';}
};

// Build progress for a client whose catalog is being built (onboarding or a rebuild); polls while it runs.
const LIVE=['queued','running'];
function buildCard(){
 const run=project?.buildRun;if(!run||project.revisions?.length&&!LIVE.includes(run.status))return null;
 const labels={queued:'בתור',running:'בונה',paused:'מושהה',failed:'נכשל',partial:'הסתיים עם חוסרים',cancelled:'בוטל',ready:'מוכן'};
 const card=el('div',{class:'build-card',id:'build-card'},el('h3',{},`בניית הלקוח — ${labels[run.status]||run.status}`),el('p',{class:'meta'},run.message||''),
  el('ul',{class:'stages'},run.stages.map(s=>el('li',{class:s.status},el('span',{},s.label),el('small',{},s.status==='completed'||s.status==='running'?(s.total?`${(s.done||0).toLocaleString('he-IL')} / ${s.total.toLocaleString('he-IL')}`:s.done?s.done.toLocaleString('he-IL'):''):''))) ));
 if(['paused','failed','partial','cancelled'].includes(run.status)){
  const o=run.options||{},more={maxFetches:Math.min((o.maxFetches||10000)*2,1000000),maxModelCalls:Math.min((o.maxModelCalls||750)*2,100000),maxMinutes:Math.min((o.maxMinutes||120)*2,10080)};
  card.append(el('div',{class:'actions'},el('button',{type:'button',class:'primary',onclick:async()=>{try{await api('/projects/'+project.id+'/build/control',{action:'resume',limits:/מגבלת/.test(run.message||'')?more:undefined});await refreshBuild();}catch(err){toast(err.message);}}},'המשך בנייה'),
   el('a',{class:'button ghost',href:'/index.html?tenant='+project.id},'פתח בממשק המתקדם')));
 }
 return card;
}
async function refreshBuild(){
 clearTimeout(refreshBuild.timer);if(!project)return;const id=project.id;
 const next=await api('/projects/'+id).catch(()=>null);if(!next||project?.id!==id)return;
 const finished=project.buildRun&&LIVE.includes(project.buildRun.status)&&!LIVE.includes(next.buildRun?.status);
 project=next;
 if(finished){renderClient();loadClients();if(project.revisions?.length)toast('הלקוח מוכן להדגמה');return;}
 const old=$('build-card'),card=buildCard();if(old&&card)old.replaceWith(card);else if(card)$('thread').append(card);
 if(LIVE.includes(project.buildRun?.status))refreshBuild.timer=setTimeout(refreshBuild,4000);
}

function renderClient(){
 const ready=!!(project?.revisions?.length&&project?.catalog?.count);
 $('client-name').textContent=project?.name||'בחר לקוח';
 $('client-meta').textContent=project?[project.catalog?.count?`${project.catalog.count.toLocaleString('he-IL')} מוצרים`:'אין קטלוג שמור',project.existingClient?`מסד ${project.existingClient.dbName}`:project.url].filter(Boolean).join(' · '):'';
 $('client-version').hidden=!project?.revisions?.length;$('client-version').textContent='גרסה '+(project?.revisions?.length||0);
 $('model').textContent=project?.studioModel?'מודל: '+project.studioModel:'';
 $('message').disabled=false;$('send').disabled=false;$('query').disabled=false;$('live-search').querySelector('button').disabled=false;
 if(!document.querySelector('[data-pane="performance"]').hidden)renderPerformance();renderThread();renderVersions();renderConcierge();setAuditButtons();if(!document.querySelector('[data-pane="crawler"]').hidden)renderCrawler();if(!document.querySelector('[data-pane="baseline"]').hidden)renderBaseline();if(!document.querySelector('[data-pane="processing"]').hidden)renderProcessing();if(!document.querySelector('[data-pane="takeover"]').hidden)renderTakeover();
 const card=buildCard();if(card){$('thread').append(card);if(LIVE.includes(project.buildRun.status)){clearTimeout(refreshBuild.timer);refreshBuild.timer=setTimeout(refreshBuild,4000);}}
 else if(project&&!ready)$('thread').append(el('div',{class:'notice'},['needs_source','failed','stopped'].includes(project.onboarding?.status)?['הקליטה האוטומטית לא הושלמה',project.onboarding.error?': '+project.onboarding.error:'','. ',el('button',{type:'button',class:'link',onclick:async()=>{try{await api('/projects/'+project.id+'/onboard/build',{});await refreshBuild();}catch(err){toast(err.message);}}},'נסה לבנות שוב'),' או חבר פיד ב',el('a',{href:'/index.html?tenant='+project.id},'ממשק המתקדם'),'.']:['ללקוח הזה עדיין אין קטלוג ואינדקס שמורים. בנה אותו ב',el('a',{href:'/index.html?tenant='+project.id},'ממשק המתקדם'),' ואז חזור לכאן.']));
}

// ---------- thread ----------
const SUGGESTIONS=['הכר את הלקוח: קטלוג, כללים וחיפושים אמיתיים, והצע מה הכי חשוב לתקן','הפעל קונסיירז׳ לחנות ובדוק מתי הוא נפתח ללקוח','אילו חיפושים מחזירים אפס תוצאות? אבחן ותקן','אילו שדות במסד עדיין לא נכנסו לחיפוש?'];
function renderThread(){
 const thread=$('thread');thread.replaceChildren();
 const messages=project?.messages||[];
 if(!project)thread.append(welcome);
 for(const m of messages)thread.append(m.role==='user'?userBubble(m.text):assistantBubble(m));
 const s=$('suggestions');s.replaceChildren();s.hidden=!project||messages.length>0||!project.catalog?.count;
 for(const text of SUGGESTIONS)s.append(el('button',{type:'button',onclick:()=>{$('message').value=text;$('message').focus();}},text));
 thread.scrollTop=thread.scrollHeight;
}
function userBubble(text){return el('div',{class:'msg user'},el('div',{class:'bubble'},text));}
function assistantBubble(m={}){
 const steps=el('ol',{class:'steps'}),body=el('div',{class:'body'}),box=el('div',{class:'msg assistant'},steps,body);
 for(const s of m.steps||[])steps.append(stepItem(s));
 if(!m.steps?.length&&m.trace?.length)for(const t of m.trace)steps.append(el('li',{class:'step ok'},String(t)));
 steps.hidden=!steps.children.length;
 if(m.text)body.append(markdown(m.text));
 if(m.changes?.length)body.append(changeList(m.changes,m.version));
 return box;
}
function stepItem(s){
 const li=el('li',{class:'step '+(s.ok===false?'fail':s.ok?'ok':'running'),'data-id':s.id},el('span',{class:'label'},s.text||s.name));
 if(s.products?.length)li.append(el('div',{class:'chips'},s.products.map(productChip)));
 if(s.search)li.append(el('button',{type:'button',class:'link',onclick:()=>runSearch(s.search.query)},'פתח בחיפוש החי'));
 return li;
}
function productChip(p){return el('button',{type:'button',class:'chip',title:p.title,onclick:()=>showProduct(p.id)},p.image&&safeUrl(p.image)?el('img',{src:safeUrl(p.image),alt:'',loading:'lazy'}):null,el('span',{},p.title||p.id));}
function changeList(changes,version){return el('div',{class:'changes'},el('b',{},version?`נשמר כגרסה ${version}`:'נשמר'),el('ul',{},changes.map(c=>el('li',{},c))),version>1?el('button',{type:'button',class:'link',onclick:()=>rollback(version-1)},'חזור לכללים שלפני השינוי'):null);}

// Runs a streaming request (chat or audit) into a new assistant bubble under the user's line.
async function streamTurn(label,path,body){
 busy=true;const signal=startRun();setAuditButtons();
 const thread=$('thread');$('suggestions').hidden=true;
 thread.append(userBubble(label));const box=assistantBubble(),steps=box.querySelector('.steps'),bodyEl=box.querySelector('.body');
 const status=el('p',{class:'working'},'חושב…');bodyEl.append(status);thread.append(box);thread.scrollTop=thread.scrollHeight;
 const follow=()=>{if(thread.scrollHeight-thread.scrollTop-thread.clientHeight<200)thread.scrollTop=thread.scrollHeight;};
 const id=project.id;
 try{
  await connection.stream(path,body,e=>{
   if(e.type==='note'){status.textContent=e.text;}
   else if(e.type==='tool'){steps.hidden=false;steps.append(stepItem({id:e.id,name:e.name,text:toolLabel(e)}));}
   else if(e.type==='tool_done'){const old=steps.querySelector(`[data-id="${e.id}"]`),item=stepItem(e);old?old.replaceWith(item):steps.append(item);}
   else if(e.type==='message'){status.remove();bodyEl.append(markdown(e.text));if(e.changes?.length)bodyEl.append(changeList(e.changes,e.version));}
   else if(e.type==='done'){if(project?.id===id){project=e.project;renderVersions();renderConcierge();$('client-version').textContent='גרסה '+project.revisions.length;}loadClients();}
   else if(e.type==='error'){status.remove();bodyEl.append(el('p',{class:'error'},e.message));}
   else if(e.type==='stopped'){status.remove();bodyEl.append(el('p',{class:'meta'},e.message));}
   follow();
  },signal);
 }catch(err){status.remove();
  if(aborted(err)){bodyEl.append(el('p',{class:'meta'},path.endsWith('/audit')?'נעצר. תיקונים שכבר נשמרו כגרסה נשארים.':'נעצר. לא נשמרו שינויים מהבקשה הזו.'));
   // A stopped audit may have saved fixes before the stop: reload the client's rules and versions.
   if(project?.id===id)api('/projects/'+id).then(p=>{if(project?.id===id){project=p;renderVersions();$('client-version').textContent='גרסה '+project.revisions.length;}}).catch(()=>{});}
  else bodyEl.append(el('p',{class:'error'},err.message));}
 finally{endRun();status.remove();busy=false;setAuditButtons();$('message').focus();}
}
function setDemoButton(){const b=$('demo-site');b.disabled=!project?.url||!project?.revisions?.length;b.title=b.disabled?'דורש לקוח עם כתובת אתר ומודול חיפוש':'פותח את האתר של הלקוח כמו שהוא, עם החיפוש שלנו במקום החיפוש שלהם';}
// With a takeover config, the demo is the store as it is plus the real storefront script (loader + engine).
$('demo-site').onclick=()=>{if(project)window.open(demoUrl(project.id,'/',project.takeoverReady?'engine':null),'_blank','noopener');};
function setAuditButtons(){setDemoButton();$('delete-client').hidden=!project;$('delete-client').disabled=busy;const ok=!busy&&!!project?.catalog?.count&&!!project?.existingClient;for(const b of ['audit-check','audit-fix'])$(b).disabled=!ok;$('audit-check').title=project&&!project.existingClient?'דורש לקוח קיים עם נתוני חיפוש במסד':'בודק את החיפושים המובילים, שהחזירו 0 תוצאות או שלא נלחצו, מול הכללים הנוכחיים';}
$('delete-client').onclick=async()=>{
 if(busy||!project)return;const name=project.name;
 const typed=prompt(`מחיקת הלקוח ״${name}״ מהסטודיו: הקטלוג המקומי, הכללים, הגרסאות, הבניות ולוג האייג׳נט יועברו לתיקיית האשפה של השרת. המסד של הלקוח עצמו לא נפגע.\n\nלאישור, הקלד את שם הלקוח:`);
 if(typed===null)return;if(typed.trim()!==String(name).trim())return toast('השם לא תואם — הלקוח לא נמחק');
 try{await api('/projects/'+project.id+'/delete',{name:typed});
  clearTimeout(refreshBuild.timer);if(localStorage.getItem('studio-tenant')===project.id)localStorage.removeItem('studio-tenant');
  const url=new URL(location.href);url.searchParams.delete('tenant');history.replaceState(null,'',url);
  project=null;renderClient();setAuditButtons();await loadClients();toast(`הלקוח ״${name}״ נמחק`);
 }catch(err){toast(err.message);}
};
$('audit-check').onclick=()=>{if(!busy&&project)streamTurn('בדיקה אוטומטית של החיפושים המובילים','/projects/'+project.id+'/audit',{fix:false});};
$('audit-fix').onclick=()=>{if(!busy&&project&&confirm('לבדוק את החיפושים המובילים ולתקן אוטומטית עד 5 ממצאים? נשמרים רק תיקונים שעברו אימות, כל אחד כגרסה שאפשר לשחזר.'))streamTurn('בדיקה ותיקון אוטומטי של החיפושים המובילים','/projects/'+project.id+'/audit',{fix:true});};

async function send(message){
 if(busy)return;
 if(!project){
  const list=await api('/projects');
  const pick=list.find(c=>c.products>0)||list[0];
  if(pick)await openClient(pick.id);
  else return toast('יש לבחור לקוח תחילה מהרשימה');
 }
 if(!project)return;
 $('message').value='';const context=attached;attached=null;renderAttached();
 await streamTurn(message,'/projects/'+project.id+'/studio',{message,context});
}
const TOOL_NAMES={overview:'סוקר את הקטלוג',analyze:'מכיר את הלקוח',search_performance:'מנתח ביצועי חיפוש',customer_analytics:'קורא את משפך הלקוחות',shopper_activity:'קורא פעילות לקוחות',find_products:'מאתר מוצרים',get_product:'פותח מוצר',categories:'בודק קטגוריות',fields:'בודק שדות',field_values:'קורא ערכי שדה',facet:'בודק אילו סוגי מוצרים חוזרים',audit_query:'בודק חיפוש',shopper_clicks:'בודק על מה קונים לחצו',crawl_status:'בודק את הסורק',merge_crawl:'ממזג את סריקת האתר',audit_fix:'מתקן',verify:'מאמת את התיקון בחיפוש חוזר',search:'מריץ חיפוש',inspect_query:'מאבחן חיפוש',search_analytics:'קורא נתוני חיפושים',list_rules:'קורא כללי חיפוש',add_spelling:'מוסיף תיקון כתיב',add_synonyms:'מוסיף מילים נרדפות',link_term:'מקשר מונח למוצרים',remove_rule:'מסיר כלל',configure_search:'משנה הגדרות',configure_concierge:'מגדיר קונסיירז׳',preview_concierge:'בודק מתי הקונסיירז׳ נפתח',db_fields:'קורא שדות מהמסד',db_search:'מחפש במסד',db_import_field:'מייבא שדה מהמסד',refresh_source_fields:'מרענן שדות מקור',process_field:'מעבד שדה',undo_processing:'מבטל עיבוד',add_example:'שומר בדיקה קבועה',check_examples:'מריץ בדיקות קבועות',list_versions:'קורא גרסאות',rollback:'משחזר גרסה'};
function toolLabel(e){const hint=e.args?.queries?.join(' · ')||e.args?.query||e.args?.contains||e.args?.field||e.args?.from||e.args?.term||'';return (TOOL_NAMES[e.name]||e.name)+(hint?` ״${hint}״`:'')+'…';}
$('composer').onsubmit=e=>{e.preventDefault();if(running){running.abort();return;}const m=$('message').value.trim();if(m)send(m);};
$('message').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();if(!running)$('composer').requestSubmit();}};

// ---------- side panel ----------
function showPanel(name){
 document.body.dataset.show=name;
 for(const b of document.querySelectorAll('.panel-switch button'))b.classList.toggle('on',b.dataset.show===name);
}
for(const b of document.querySelectorAll('.panel-switch button'))b.onclick=()=>showPanel(b.dataset.show);
function renderTakeover(){const root=$('takeover');if(root&&project)takeoverPanel({root,project,api,streamInto,el,toast,fill,loading});}
// Wide side panel: the chat narrows so panels like the takeover get room. The takeover opens wide unless the operator
// narrowed it before; the choice is remembered per browser.
const wideKey='studio-side-wide';
const setWide=on=>{document.body.classList.toggle('side-wide',on);const b=document.querySelector('.side-toggle');if(b)b.textContent=on?'צמצם פאנל':'הרחב פאנל';};
{const t=document.querySelector('.tabs');if(t){t.append(el('button',{type:'button',class:'side-toggle',onclick:()=>{const on=!document.body.classList.contains('side-wide');setWide(on);try{localStorage.setItem(wideKey,on?'1':'0');}catch{}}},'הרחב פאנל'));try{if(localStorage.getItem(wideKey)==='1')setWide(true);}catch{}}}
function tab(name){if(name==='takeover'){let pref=null;try{pref=localStorage.getItem(wideKey);}catch{}if(pref!=='0')setWide(true);setTimeout(renderTakeover);}if(name==='performance')setTimeout(renderPerformance);if(name==='crawler')setTimeout(renderCrawler);if(name==='processing')setTimeout(renderProcessing);if(name==='baseline')setTimeout(renderBaseline);if(matchMedia('(max-width: 1100px)').matches)showPanel('side');for(const b of document.querySelectorAll('[data-tab]'))b.setAttribute('aria-selected',String(b.dataset.tab===name));for(const p of document.querySelectorAll('[data-pane]'))p.hidden=p.dataset.pane!==name;}
for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>tab(b.dataset.tab);

let lastSearch=null;
async function runSearch(query){
 if(!project)return;tab('search');$('query').value=query;$('search-meta').textContent='מחפש…';$('results').replaceChildren();$('report').hidden=true;
 const id=project.id;
 try{const r=await api('/projects/'+id+'/search',{query,limit:24});if(project?.id!==id)return;lastSearch={query,r};
  const m=r.metadata||{},plan=r.plan||{},corr=plan.corrections?.map(c=>`${c.term}→${(c.to||[]).slice(0,2).join('/')}`).join(', ')||(m.correction?.to?`${m.correction.from}→${m.correction.to}`:'');
  const hits=plan.termHits?.map(t=>`${t.term} ${t.exact}`).join(' · '),why={'missing-terms':'מילה חסרה באינדקס','no-intersection':'המילים קיימות בנפרד, לא יחד','scoped-only':'כלל מקושר צמצם למוצרים ספציפיים',filtered:'סונן לפי מלאי/תגית/מחיר'}[plan.why?.kind];
  $('search-meta').textContent=[`${r.total??r.matches.length} תוצאות`,{lexical:'התאמה מילולית',spelling:'אחרי תיקון כתיב','router-lexical':'נתב','deep-llm':'הרחבה במודל','closest-alternatives':'חלופות קרובות'}[m.phase]||m.phase,m.llmUsed?'עם LLM':'בלי LLM',corr?'תיקון: '+corr:null,hits?'מילים: '+hits:null,why,r.message].filter(Boolean).join(' · ');
  $('results').replaceChildren(...r.matches.map(p=>el('button',{type:'button',class:'result',onclick:()=>showProduct(p.id)},p.image&&safeUrl(p.image)?el('img',{src:safeUrl(p.image),alt:'',loading:'lazy'}):el('div',{class:'noimg'}),el('b',{},p.title),el('small',{},[p.specifications?.author,p.price!=null?'₪'+p.price:null].filter(Boolean).join(' · ')))));
  if(!r.matches.length)$('results').append(el('p',{class:'meta'},'אין תוצאות.'));
  $('report').hidden=false;
  showConciergeTrigger(r.concierge,r.oos);
 }catch(err){$('search-meta').textContent=err.message;}
}
$('live-search').onsubmit=e=>{e.preventDefault();const q=$('query').value.trim();if(q)runSearch(q);};
$('report').onclick=()=>{if(!lastSearch)return;const {query,r}=lastSearch;attached={query,total:r.total,phase:r.metadata?.phase,results:r.matches.slice(0,12).map(p=>({id:p.id,title:p.title}))};renderAttached();$('message').value=`החיפוש ״${query}״ לא מחזיר את מה שצריך. `;$('message').focus();};
function renderAttached(){const a=$('attached');a.hidden=!attached;a.replaceChildren();if(attached)a.append(attached.product?`מצורף: ״${attached.product.title}״`:`מצורף: תוצאות ״${attached.query}״`,el('button',{type:'button',class:'link',onclick:()=>{attached=null;renderAttached();}},'הסר'));}

const REASONS={no_results:'אין תוצאות',out_of_stock:'המוצר אזל',non_literal:'החיפוש לא נפתר מילולית'};
let shopperHistory=[],shopperTrigger=null;
function triggerCard(trigger,oos){return [el('p',{},el('b',{},'הקונסיירז׳ היה נפתח ללקוח'),` · ${REASONS[trigger.reason]||trigger.reason}`),el('p',{class:'meta'},trigger.opener),oos?.length?el('p',{class:'meta'},'אזל: '+oos.map(p=>p.title).join(' · ')):null,el('button',{type:'button',class:'primary',onclick:()=>openShopperPreview(trigger)},'פתח תצוגת לקוח')];}
function showConciergeTrigger(trigger,oos){
 shopperTrigger=trigger||null;
 for(const id of ['search-concierge','concierge-trigger']){const box=$(id);if(!box)continue;box.hidden=!trigger;box.replaceChildren(...(trigger?triggerCard(trigger,oos):[]));}
}
function renderConcierge(){
 const root=$('concierge-settings');if(!root||!project)return;
 const c=project.concierge||{},on=c.enabled===true;
 root.replaceChildren(
  el('h3',{},'יועץ ללקוח בחנות'),
  el('p',{class:'meta'},'נפתח אחרי חיפוש שנכשל — אותם רגעים כמו ב־dashboard: אין תוצאות, אזל מהמלאי, או שהגריד הוא ניחוש לא מילולי. מדבר רק עם הקטלוג והכללים של הלקוח הזה.'),
  el('p',{},el('b',{},on?'פעיל':'כבוי'),on?(c.autoOpen===false?' · כפתור הזמנה':' · נפתח לבד'):''),
  c.context?el('p',{class:'description'},c.context):el('p',{class:'meta'},'אין עדיין הנחיות קול. בקש מהאייג׳נט להפעיל ולכתוב את הקשר החנות.'),
  el('button',{type:'button',class:'ghost',onclick:()=>{$('message').value=on?'כבה את הקונסיירז׳':'הפעל קונסיירז׳ לחנות הזו. כתוב הקשר קצר בסגנון המוכר, לפי הקטלוג, ובדוק מתי הוא נפתח.';$('message').focus();}},on?'בקש מהאייג׳נט לשנות':'בקש מהאייג׳נט להפעיל')
 );
 $('concierge-chat').hidden=!on;
}
function openShopperPreview(trigger){
 tab('concierge');shopperHistory=[];shopperTrigger=trigger;
 const thread=$('concierge-thread');thread.replaceChildren(el('div',{class:'msg assistant'},el('div',{class:'body'},el('p',{},trigger.opener))));
 $('concierge-message').value='';$('concierge-message').focus();
}
$('concierge-chat').onsubmit=async e=>{
 e.preventDefault();if(!project?.concierge?.enabled)return toast('הקונסיירז׳ כבוי');
 const message=$('concierge-message').value.trim();if(!message)return;$('concierge-message').value='';
 const thread=$('concierge-thread');thread.append(el('div',{class:'msg user'},el('div',{class:'bubble'},message)));
 const wait=el('p',{class:'working'},'היועץ עונה…');thread.append(wait);
 try{
  const r=await api('/projects/'+project.id+'/concierge',{message,trigger:shopperTrigger,history:shopperHistory});
  wait.remove();shopperHistory.push({role:'user',text:message},{role:'assistant',text:r.reply});
  const body=el('div',{class:'body'});body.append(markdown(r.reply));
  if(r.products?.length)body.append(el('div',{class:'chips'},r.products.map(productChip)));
  thread.append(el('div',{class:'msg assistant'},body));
 }catch(err){wait.remove();thread.append(el('p',{class:'error'},err.message));}
 thread.scrollTop=thread.scrollHeight;
};
async function showProduct(productId){
 tab('product');const root=$('product');root.replaceChildren(el('p',{class:'meta'},'טוען…'));
 try{const c=await api('/projects/'+project.id+'/products/'+encodeURIComponent(productId));const url=safeUrl(c.url);
  root.replaceChildren(
   c.image&&safeUrl(c.image)?el('img',{src:safeUrl(c.image),alt:''}):null,
   el('h3',{},c.title||c.name),
   el('p',{class:'meta'},[c.id,c.sku,c.price!=null?'₪'+c.price:null,c.stockStatus==='instock'?'במלאי':c.stockStatus,c.hidden?'מוסתר':null].filter(Boolean).join(' · ')),
   url?el('a',{href:url,target:'_blank',rel:'noreferrer'},'עמוד המוצר'):null,
   el('table',{class:'specs'},Object.entries(c.specifications||{}).map(([k,v])=>el('tr',{},el('th',{},k),el('td',{},String(v))))),
   c.categories?.length?el('p',{},el('b',{},'קטגוריות: '),c.categories.join(' · ')):null,
   c.tags?.length?el('p',{},el('b',{},'תגיות: '),c.tags.join(' · ')):null,
   c.description?el('p',{class:'description'},c.description):null,
   el('button',{type:'button',class:'ghost',onclick:()=>{attached={product:{id:c.id,title:c.title}};renderAttached();$('message').focus();}},'שאל את האייג׳נט על המוצר'));
 }catch(err){root.replaceChildren(el('p',{class:'error'},err.message));}
}

// ---------- production baseline: what the current search does, what we must keep and where we must deliver ----------
async function renderBaseline(){
 const root=$('baseline');if(!root||!project)return;loading(root);const id=project.id;
 let b;try{b=await api('/projects/'+id+'/baseline');}catch(err){fill(root,el('p',{class:'error'},err.message));return;}
 if(project?.id!==id)return;
 const run=async(path,label)=>{root.prepend(el('p',{class:'working'},label));try{await api('/projects/'+id+'/baseline/'+path,{});}catch(err){toast(err.message);}renderBaseline();};
 const intro=el('p',{class:'meta'},'המטרה להחליף את החיפוש הקיים: לשמור כל מה שעובד בו (חיפושים שקונים לחצו או הוסיפו לסל) ולשפר איפה שהוא נכשל. כל שינוי כללים נחסם אם הוא מאבד חיפוש שנשמר.');
 if(b.status==='none'){fill(root,el('h3',{},'השוואה לחיפוש הקיים'),intro,el('button',{type:'button',class:'primary',onclick:()=>run('build','בונה השוואה מ־30 ימי חיפוש…')},'בנה השוואה (30 ימים)'));return;}
 const s=b.summary||{},num=v=>(v??0).toLocaleString('he-IL'),pct=v=>v==null?'—':Math.round(v*100)+'%';
 const row=(r,extra)=>el('div',{class:'row'},el('div',{class:'q'},el('b',{},r.query),el('small',{},`${num(r.searches)} חיפושים`)),extra,el('div',{class:'actions'},
  el('button',{type:'button',class:'link',onclick:()=>runSearch(r.query)},'פתח בחיפוש החי'),
  el('button',{type:'button',class:'link',onclick:()=>{$('message').value=`החיפוש ״${r.query}״ ${r.status==='lost'||r.status==='partial'?`עובד בחיפוש הקיים ולא אצלנו. קונים בוחרים ב: ${(r.targets||[]).map(t=>t.title).join(', ')}. תקן בלי לפגוע בחיפושים אחרים.`:'נכשל בחיפוש הקיים. בדוק מה קונים מחפשים ותקן.'}`;$('message').focus();}},'שלח לאייג׳נט')));
 const list=(title,rows,render,open=false)=>rows?.length?el('details',{open},el('summary',{},`${title} (${rows.length})`),rows.map(render)):null;
 fill(root,
  el('h3',{},'השוואה לחיפוש הקיים'),intro,
  el('p',{},el('span',{class:'score'},pct(s.keptShare)),' מהחיפושים שעובדים היום נשמרים אצלנו (משוקלל לפי מספר חיפושים)'),
  el('div',{class:'tiles'},
   el('div',{class:'tile'},el('b',{},num(s.kept)),el('small',{},'נשמרים')),el('div',{class:'tile'},el('b',{},num(s.partial)),el('small',{},'חלקית')),el('div',{class:'tile'},el('b',{},num(s.lost)),el('small',{},'אבודים — לתקן')),
   el('div',{class:'tile'},el('b',{},num(s.gaps)),el('small',{},'פער בקטלוג')),el('div',{class:'tile'},el('b',{},num(s.productionFails)),el('small',{},'נכשלים בקיים')),el('div',{class:'tile'},el('b',{},num(s.failsWeAnswer)),el('small',{},'מהם אנחנו עונים'))),
  el('p',{class:'meta'},`${num(b.tracked)} החיפושים הנפוצים מתוך ${num(b.totalQueries)} (${num(b.totalSearches)} חיפושים ב־${b.days} ימים) · נבנה ${new Date(b.builtAt).toLocaleString('he-IL')}`,b.stale?el('span',{class:'stale'},' · הכללים או הקטלוג השתנו מאז ההערכה'):null),
  el('div',{class:'actions'},
   el('button',{type:'button',class:'primary',disabled:!(s.lost||s.partial),onclick:()=>{if(confirm('לתקן אוטומטית עד 5 חיפושים שעובדים בקיים ולא אצלנו? נשמר רק תיקון שמחזיר את המוצרים שהקונים בחרו ולא פוגע בחיפושים אחרים.'))streamTurn('תיקון אוטומטי מול החיפוש הקיים','/projects/'+id+'/audit',{fix:true,source:'baseline'}).then(renderBaseline);}},'תקן אבודים'),
   el('button',{type:'button',class:'ghost',onclick:()=>run('evaluate','מעריך מחדש…')},'הערך מחדש'),
   el('button',{type:'button',class:'ghost',onclick:()=>run('build','בונה מחדש מנתוני החיפוש…')},'בנה מחדש מהנתונים')),
  list('אבודים — עובד בקיים, לא אצלנו',b.lost,r=>row(r,el('small',{},'חסרים: '+r.missing.map(m=>m.title).join(' · '))),true),
  list('חלקית',b.partial,r=>row(r,el('small',{},'חסרים: '+r.missing.map(m=>m.title).join(' · ')))),
  list('נכשלים בחיפוש הקיים',b.fails,r=>row(r,el('small',{},r.status==='answers'?`אצלנו ${num(r.total)} תוצאות — כדאי לבדוק שהן נכונות`:'גם אצלנו אין תוצאות'))),
  list('פער בקטלוג — מה שקונים בוחרים חסר או אזל',b.gaps,r=>row(r,el('small',{},(r.unavailable||[]).map(u=>`${u.title} (${u.inCatalog?'אזל':'חסר בקטלוג'})`).join(' · ')))));
}

// Shared client identity and evidence-based search performance review.
async function renderPerformance(){
 const root=$('performance');if(!root||!project)return;const id=project.id;loading(root);
 let data;try{data=await api('/projects/'+id+'/performance');}catch(e){fill(root,el('p',{class:'error'},e.message));return;}if(project?.id!==id)return;
 const r=data.report,days=el('select',{'aria-label':'טווח בקרה'},[7,30,90].map(n=>el('option',{value:n,selected:n===(r?.days||30)},`${n} ימים`)));
 const run=async()=>{await streamInto(root,'/projects/'+id+'/performance/review',{days:Number(days.value)});if(project?.id===id)renderPerformance();};
 const identity=data.profile;
 fill(root,el('h3',{},'מוח הלקוח · בקרת חיפוש'),el('p',{class:'meta'},identity?`${identity.name} · ${identity.platform.value||'פלטפורמה לא ודאית'} · מקור: ${identity.platform.source||'נדרש בירור'}`:'פרופיל החנות יתעדכן אוטומטית בתחילת הבקרה.'),
 el('p',{class:'meta'},'מודל התכנון החזק מנתח נתוני שימוש, בודק עד 6 חיפושים ומציע דירוג, עיבוד, אינדקסים ופונקציות. המדידות הן על הטיוטה המקומית. ההרצה צורכת קריאות מודל ואינה משנה כללי חיפוש.'),
 el('div',{class:'actions'},days,el('button',{class:'primary',type:'button',disabled:busy,onclick:run},'נתח ביצועים והצע שיפורים')),
 r?el('div',{},el('p',{class:'meta'},`${new Date(r.at).toLocaleString('he-IL')} · ${r.model} · גרסה ${r.revision}`),el('p',{class:'meta'},'מסקנות המודל והצעות לבדיקה — טרם בוצעו או אומתו כשיפור.'),markdown(r.summary),
 el('p',{class:'meta'},`נבדקו ${r.evidence.checks.length} חיפושים · זמן חציוני במדגם: ${r.evidence.latency.medianMs==null?'לא נמדד':(r.evidence.latency.medianMs/1000).toFixed(2)+' שניות'}`),
 r.limitations.length?el('details',{open:true},el('summary',{},'מגבלות הנתונים'),el('ul',{},r.limitations.map(x=>el('li',{},x)))):null,
 r.proposals.map(p=>el('section',{class:'plan'},el('h3',{},p.title),el('p',{},p.evidence),el('p',{},p.change),el('p',{class:'meta'},'השפעה צפויה (השערה): '+p.expectedImpact),el('p',{class:'meta'},'מדד הצלחה: '+p.metric),el('p',{class:'meta'},'בדיקה וחזרה לאחור: '+p.validation),el('p',{class:'meta'},'סיכון: '+p.risk),
 el('button',{type:'button',class:'ghost',onclick:async()=>{try{const a=await api('/projects/'+id+'/performance/'+p.id+'/prepare',{});if(project?.id!==id)return;$('message').value=a.message;$('message').focus();toast('ההצעה הועברה לשיחה לבדיקה וביצוע. שלח כדי להתחיל.');}catch(e){toast(e.message);}}},'העבר לאייג׳נט לבדיקה וביצוע'))),
 !r.proposals.length?el('p',{class:'meta'},'לא נמצאו שינויים מוצדקים לפי הראיות.'):null):null);
}

// ---------- processing lab: research by a strong model → sample trial → run measured against production ----------
const PLAN_STATUS={proposed:'הוצע',tried:'נוסה על דוגמה',done:'בוצע',reverted:'בוטל — פגע בחיפושים שעובדים',empty:'לא נמצאו ערכים',undone:'בוטל ידנית',idea:'רעיון — דורש מימוש'};
const PLAN_KIND={import_db_field:'ייבוא שדה מהמסד',derive_field:'שדה נגזר במודל (תרגום, תעתיק, נרמול)',extract_pattern:'חילוץ לפי תבנית',enrich_products:'העשרת מוצרים במודל',classify_tag:'תיוג לפי הגדרה',embeddings:'וקטורים סמנטיים',idea:'רעיון'};
async function streamInto(root,path,body){const ctrl=new AbortController(),text=el('span',{},'מתחיל…'),status=el('p',{class:'working'},text,' ',el('button',{type:'button',class:'link',onclick:()=>ctrl.abort()},'עצור'));if(root.classList.contains('plan'))root.append(status);else root.prepend(status);status.scrollIntoView({block:'nearest'});let last=null;
 try{await connection.stream(path,body,e=>{if(e.type==='note')text.textContent=e.text;else if(e.type==='error'||e.type==='stopped')toast(e.message);else if(e.type==='done')last=e;},ctrl.signal);}catch(err){toast(aborted(err)?'הפעולה נעצרה; לא נשמרו שינויים ממנה':err.message);}status.remove();return last;}
async function renderProcessing(){
 const root=$('processing');if(!root||!project)return;loading(root);const id=project.id;
 let lab;try{lab=await api('/projects/'+id+'/processing');}catch(err){fill(root,el('p',{class:'error'},err.message));return;}
 if(project?.id!==id)return;
 const research=async()=>{await streamInto(root,'/projects/'+id+'/processing/research',{});renderProcessing();};
 const head=[el('h3',{},'עיבוד ייעודי ללקוח'),el('p',{class:'meta'},'מודל חזק חוקר את הלקוח — מה עובד בחיפוש הקיים ואצלנו לא, אילו שדות חסרים, מה יש במסד ובסריקה — ומציע עיבודים עם החיפושים שכל אחד אמור לתקן. כל עיבוד נוסה קודם על דוגמה, ואחרי הרצה נמדד מול החיפוש הקיים; אם הוא פוגע בחיפוש שעובד, הוא מבוטל אוטומטית.'),
  el('button',{type:'button',class:lab.plans?'ghost':'primary',onclick:research},lab.plans?'חקור מחדש':'חקור והצע עיבודים')];
 if(!lab.plans){fill(root,...head);return;}
 const pct=v=>v==null?'—':Math.round(v*100)+'%';
 fill(root,...head,el('p',{class:'meta'},`מחקר מ־${new Date(lab.at).toLocaleString('he-IL')}`),el('div',{class:'md'},markdown(lab.summary)),
  lab.rejectedPlans?.length?el('details',{},el('summary',{},`הצעות שנפסלו (${lab.rejectedPlans.length})`),el('ul',{},lab.rejectedPlans.map(x=>el('li',{},`${x.title} — ${x.reason}`)))):null,
  ...(lab.plans.length?lab.plans.map(plan=>el('div',{class:'plan'},
   el('b',{},plan.title),el('div',{class:'kind'},`${PLAN_KIND[plan.kind]||plan.kind}${plan.kind==='classify_tag'?` · תגית ״${plan.tag}״`:plan.target?` · ${plan.source?plan.source+' → ':''}specifications.${plan.target}`:''}${plan.scope&&Object.keys(plan.scope).length?' · היקף: '+JSON.stringify(plan.scope):''}`),
   plan.definition?el('p',{class:'meta'},'הגדרה: '+plan.definition):null,plan.implementation?el('p',{class:'meta'},'מה נדרש כדי לממש: '+plan.implementation):null,
   el('p',{},plan.why),plan.instruction?el('p',{class:'meta'},'הנחיה: '+plan.instruction):null,plan.pattern?el('p',{class:'meta',dir:'ltr'},plan.pattern):null,
   plan.expectedQueries?.length?el('div',{class:'chips-inline'},el('small',{},`אמור לתקן (${(plan.searches||0).toLocaleString('he-IL')} חיפושים):`),plan.expectedQueries.map(q=>el('span',{},q))):null,
   plan.risk?el('p',{class:'meta'},'סיכון: '+plan.risk):null,
   el('p',{},el('b',{},PLAN_STATUS[plan.status]||plan.status)),
   plan.trial?el('details',{open:plan.status==='tried'},el('summary',{},`דוגמה (${plan.trial.rows.length})`),el('table',{},el('tr',{},el('th',{},plan.kind==='embeddings'?'חיפוש':'מוצר'),el('th',{},plan.kind==='classify_tag'?'ראיה':plan.kind==='embeddings'?'':'לפני'),el('th',{},plan.kind==='embeddings'?'הכי קרובים סמנטית':'אחרי')),plan.trial.rows.map(r=>el('tr',{},el('td',{},r.title),el('td',{},r.before??''),el('td',{},r.after||'—'))))):null,
   plan.trial?.estimate?el('p',{class:'meta'},`הרצה מלאה: ${plan.trial.estimate.products.toLocaleString('he-IL')} מוצרים${plan.trial.estimate.modelCalls?` · ${plan.trial.estimate.distinct.toLocaleString('he-IL')} ערכים שונים · כ־${plan.trial.estimate.modelCalls.toLocaleString('he-IL')} קריאות למודל`:''}${plan.trial.estimate.tooLarge?' · גדול מדי, צריך לצמצם היקף':''}`):null,
   plan.result?.fullSearch?el('p',{},`וקטורים: ${plan.result.vectors.toLocaleString('he-IL')} מוצרים · בחיפוש המלא על ${plan.result.fullSearch.queries.length} חיפושים שנכשלים: `,plan.result.fullSearch.before&&plan.result.fullSearch.after?`${plan.result.fullSearch.before.found}/${plan.result.fullSearch.before.total} → ${plan.result.fullSearch.after.found}/${plan.result.fullSearch.after.total} מוצרים שהקונים בוחרים נמצאו`:'אין מוצרי יעד למדידה'):null,
   plan.result?.delta?el('p',{},`שמירה מול הקיים: ${pct(plan.result.delta.keptBefore)} → ${pct(plan.result.delta.keptAfter)} · ${plan.result.updated.toLocaleString('he-IL')} מוצרים עודכנו`,plan.result.delta.newlyKept?.length?el('small',{},' · חזרו לעבוד: '+plan.result.delta.newlyKept.join(', ')):null,plan.result.delta.lost?.length?el('small',{class:'stale'},' · נפגעו: '+plan.result.delta.lost.join(', ')):null):null,
   plan.status==='done'?el('div',{class:'actions'},el('button',{type:'button',class:'ghost',onclick:async()=>{if(!confirm(`לבטל את "${plan.title}"? מה שנוסף יוסר והמדידה מול הקיים תתעדכן.`))return;try{await api('/projects/'+id+'/processing/'+plan.id+'/undo',{});project=await api('/projects/'+id);}catch(err){toast(err.message);}renderProcessing();}},'בטל עיבוד')):null,
   ['proposed','tried'].includes(plan.status)?el('div',{class:'actions'},
    el('button',{type:'button',class:'ghost',onclick:async e=>{e.target.disabled=true;e.target.textContent='מנסה על דוגמה… (עד דקה)';try{await api('/projects/'+id+'/processing/'+plan.id+'/trial',{});}catch(err){toast(err.message);}renderProcessing();}},'נסה על דוגמה'),
    el('button',{type:'button',class:'primary',disabled:plan.status!=='tried',title:plan.status!=='tried'?'נסה קודם על דוגמה':'',onclick:async e=>{const est=plan.trial?.estimate;if(!confirm(`להריץ "${plan.title}"${est?` על ${est.products.toLocaleString('he-IL')} מוצרים${est.modelCalls?` (כ־${est.modelCalls.toLocaleString('he-IL')} קריאות למודל)`:''}`:''}? התוצאה תימדד מול החיפוש הקיים ותבוטל אם תפגע בחיפוש שעובד.`))return;const r=await streamInto(e.target.closest('.plan'),'/projects/'+id+'/processing/'+plan.id+'/run',{});if(r?.result?.reverted)toast('העיבוד בוטל: הוא פגע בחיפושים שעובדים בקיים');else if(r?.result)toast(`עודכנו ${r.result.updated} מוצרים`);project=await api('/projects/'+id);renderProcessing();}},'הרץ ומדוד')):null)):[el('p',{class:'meta'},'המחקר לא מצא עיבוד שמוצדק לפי הראיות.')]));
}

// ---------- site crawler (per tenant) ----------
const CRAWL_STATUS={none:'לא הופעל',ready:'מוכן',running:'רץ',waiting:'מתחיל…',paused:'מושהה',stopped:'נעצר',done:'הסתיים',blocked:'נחסם על ידי האתר',interrupted:'נקטע — ה־worker הפסיק לדווח'};
let crawlTimer=null;
// Dedicated scraper: the planner model writes extraction rules from sample pages; validated, then activated by the operator.
function scraperSection(sc,id){
 const pct=v=>v==null?'—':Math.round(v*100)+'%',v=sc.validation;
 const build=async e=>{e.target.disabled=true;await streamInto($('crawler'),'/projects/'+id+'/scraper/build',{});renderCrawler();};
 const toggle=async action=>{try{await api('/projects/'+id+'/scraper/'+action,{});toast(action==='activate'?'הסורק הייעודי פעיל. לחץ ״רענן רשימת דפים״ כדי לבנות את התור לפי הכללים שלו.':'חזרה לסורק הכללי');}catch(err){toast(err.message);}renderCrawler();};
 return el('fieldset',{},el('legend',{},'סורק ייעודי ללקוח'),
  el('p',{class:'meta'},'מודל חזק לומד כמה דפי מוצר מהאתר וכותב כללי חילוץ ייעודיים (איזה כתובת היא דף מוצר, איפה השם, המחיר, המלאי ושדות נוספים). הכללים נבדקים על דפים נוספים ומול הקטלוג לפני שמפעילים אותם.'),
  sc.status==='none'?el('p',{},'עכשיו: סורק כללי (נתוני JSON-LD).'):el('p',{},el('b',{},sc.status==='active'?'פעיל':'טיוטה — לא פעיל'),sc.recommended===false?el('span',{class:'stale'},' · הבדיקה לא עברה את הסף — מומלץ לבנות מחדש'):sc.recommended?' · עבר את הבדיקה':'',` · נבנה ${new Date(sc.builtAt).toLocaleString('he-IL')}`),
  v?el('dl',{class:'stats'},el('dt',{},'דפים שנבדקו'),el('dd',{},String(v.pages)),el('dt',{},'שם / מחיר / מלאי'),el('dd',{},`${pct(v.fill.name)} / ${pct(v.fill.price)} / ${pct(v.fill.stock)}`),el('dt',{},'מזהה מוצר'),el('dd',{},pct(v.fill.key)),el('dt',{},'התאמה לקטלוג'),el('dd',{},pct(v.catalogAgreement))):null,
  v?el('details',{},el('summary',{},'דוגמאות וכללים'),el('ul',{},v.rows.map(r=>el('li',{},`${r.name||'—'} · ${r.price??'—'} · ${r.stockStatus||'—'}${r.author?' · '+r.author:''}`))),el('pre',{dir:'ltr'},JSON.stringify(sc.spec,null,1))):null,
  el('div',{class:'actions'},el('button',{type:'button',class:'ghost',onclick:build},sc.status==='none'?'בנה סורק ייעודי':'בנה מחדש'),
   sc.status==='draft'?el('button',{type:'button',class:'primary',onclick:()=>toggle('activate')},'הפעל'):null,sc.status==='active'?el('button',{type:'button',class:'ghost',onclick:()=>toggle('deactivate')},'חזור לסורק הכללי'):null));
}
async function renderCrawler(){
 const root=$('crawler');if(!root||!project)return;loading(root);clearTimeout(crawlTimer);const id=project.id;
 let c,sc;try{[c,sc]=await Promise.all([api('/projects/'+id+'/crawl'),api('/projects/'+id+'/scraper')]);}catch(err){fill(root,el('p',{class:'error'},err.message));return;}
 if(project?.id!==id)return;
 const act=async(path,body,label)=>{try{const r=await api('/projects/'+id+'/crawl/'+path,body);if(r.added!==undefined)toast(`מוזגו ${r.pages} דפים: ${r.added} מוצרים נוספו, ${r.updated} עודכנו, ${r.authorsFilled} מחברים הושלמו${r.impact?` · מול הקיים: ${Math.round(r.impact.keptBefore*100)}% → ${Math.round(r.impact.keptAfter*100)}%${r.impact.lost.length?` · נפגעו: ${r.impact.lost.map(x=>x.query).join(', ')}`:''}`:''}`);if(path==='merge')project=await api('/projects/'+id);}catch(err){toast(err.message);}renderCrawler();};
 const s=c.settings,pct=c.total?Math.round(c.done/c.total*100):0,num=v=>(v??0).toLocaleString('he-IL');
 const rate=el('input',{type:'number',min:'0.5',max:'60',step:'0.5',value:String(s.rateMs/1000)}),auto=el('input',{type:'checkbox',checked:s.autoMerge}),src=Object.fromEntries(['clicks','sitemap','catalog'].map(k=>[k,el('input',{type:'checkbox',checked:s.sources[k]})]));
 fill(root,
  el('h3',{},'סורק האתר'),
  el('p',{class:'meta'},`סורק את דפי המוצר הציבוריים של ${project.url||'האתר'}: שם, מחבר, הוצאה, מחיר ומלאי. מזדהה בשמו ומכבד robots.txt. ההתקדמות נשמרת במסד, ${c.workerMode==='studio'?'הסטודיו מריץ את הסריקה בעצמו, במקביל ללקוחות אחרים, וממשיך מאותה נקודה אחרי הפעלה מחדש.':`והעבודה נעשית ב־worker ${c.workerMode==='local'?'שרץ במחשב הזה':'בענן (Render)'} — ממשיך גם כשהסטודיו סגור.`}`),
  el('p',{},el('b',{class:'status-'+c.status},CRAWL_STATUS[c.status]||c.status),c.worker?` · worker: ${c.worker}`:'',c.running&&c.etaMinutes!=null?` · נותרו כ־${c.etaMinutes>90?Math.round(c.etaMinutes/60)+' שעות':c.etaMinutes+' דקות'}`:'',c.pagesPerMinute?` · ${c.pagesPerMinute} דפים לדקה`:''),
  c.blockedReason?el('p',{class:'error'},'סיבה: '+c.blockedReason):null,
  c.status==='waiting'?el('p',{class:'meta'},c.workerMode==='studio'?'הסטודיו מתחיל את הסריקה בעצמו תוך רגע (אם סורק קודם עוד מחזיק בה, עד 3 דקות).':c.workerMode==='local'?'ה־worker המקומי אמור להתחיל תוך כמה שניות.':'אף worker לא לקח את העבודה עדיין. ודא שה־Background Worker ב־Render פעיל; אם worker אחר נעצר, הוא ישוחרר תוך 3 דקות.'):null,
  c.total?el('div',{class:'progress'},el('span',{style:`width:${pct}%`})):null,
  c.total?el('dl',{class:'stats'},el('dt',{},'דפים'),el('dd',{},`${num(c.done)} / ${num(c.total)} (${pct}%)`),el('dt',{},'מוצרים שנאספו'),el('dd',{},num(c.products)),el('dt',{},'ממתינים למיזוג'),el('dd',{},num(c.unmerged)),el('dt',{},'שגיאות'),el('dd',{},num(c.errors)),
   el('dt',{},'מקורות בתור'),el('dd',{},c.sources?`${num(c.sources.clicks)} מקליקים · ${num(c.sources.sitemap)} ממפת האתר · ${num(c.sources.catalog)} מהקטלוג`:'—'),el('dt',{},'מיזוג אחרון'),el('dd',{},c.lastMerge?`${new Date(c.lastMerge.mergedAt).toLocaleString('he-IL')} · ${num(c.lastMerge.added)} נוספו`:'עוד לא')):null,
  el('div',{class:'actions'},
   c.running||c.desired==='running'?el('button',{type:'button',class:'ghost',onclick:()=>act('stop',{})},'עצור'):el('button',{type:'button',class:'primary',onclick:()=>act('start',{})},c.status==='none'?'התחל סריקה':c.status==='done'?'סרוק שוב דפים חדשים':'המשך סריקה'),
   el('button',{type:'button',class:'ghost',disabled:!c.unmerged,onclick:()=>act('merge',{})},`מזג לקטלוג${c.unmerged?` (${num(c.unmerged)})`:''}`),
   !c.running&&c.desired!=='running'&&c.status!=='none'?el('button',{type:'button',class:'ghost',title:'בונה מחדש את רשימת הדפים (קליקים, מפת אתר, קטלוג) ושומר את מה שכבר נאסף',onclick:()=>act('start',{reseed:true})},'רענן רשימת דפים'):null),
  el('fieldset',{},el('legend',{},'הגדרות'),
   el('label',{},'שניות בין דפים',rate),
   el('label',{},auto,'מיזוג אוטומטי לקטלוג כל 10 דקות'),
   el('label',{},src.clicks,'מוצרים שקונים לחצו עליהם (ראשונים)'),el('label',{},src.sitemap,'מפת האתר'),el('label',{},src.catalog,'מוצרים שכבר בקטלוג (רענון מחיר ומלאי)'),
   el('button',{type:'button',class:'ghost',onclick:()=>act('settings',{rateMs:Math.round(Number(rate.value)*1000),autoMerge:auto.checked,sources:Object.fromEntries(Object.entries(src).map(([k,v])=>[k,v.checked]))})},'שמור הגדרות'),
   el('p',{class:'meta'},'שינוי קצב ומקורות חל בהפעלה הבאה של הסורק; שינוי מקורות דורש ״רענן רשימת דפים״.')),
  scraperSection(sc,id),
  c.recentErrors?.length?el('details',{},el('summary',{},'שגיאות אחרונות'),el('ul',{},c.recentErrors.map(e=>el('li',{},`${e.url} — ${e.error}`)))):null);
 if((c.running||c.desired==='running')&&!document.querySelector('[data-pane="crawler"]').hidden)crawlTimer=setTimeout(renderCrawler,5000);
}
function renderVersions(){
 const rules=$('rules'),versions=$('versions');rules.replaceChildren();versions.replaceChildren();if(!project?.revisions?.length)return;
 const pr=project.revisions.at(-1).profile||{};
 const section=(title,items)=>el('details',{open:items.length<=8},el('summary',{},`${title} (${items.length})`),items.length?el('ul',{},items):el('p',{class:'meta'},'אין'));
 rules.append(el('h3',{},'כללי החיפוש הפעילים'),
  section('תיקוני כתיב',Object.entries(pr.queryAliases||{}).map(([f,t])=>el('li',{},`${f} ← ${t}`))),
  section('מילים נרדפות',Object.entries(pr.semanticAliases||{}).map(([f,t])=>el('li',{},`${f} → ${t.join(', ')}`))),
  section('פונקציות לקוח (קוד)',Object.entries(pr.hooks||{}).map(([name,h])=>el('li',{},el('b',{},name),h.note?` — ${h.note}`:'',el('details',{},el('summary',{},'הצג קוד'),el('pre',{class:'code',dir:'ltr'},h.code))))),
  section('כללי דירוג',(pr.rankingRules||[]).map(r=>el('li',{},`${r.name}: ${r.action==='bury'?'הורדת':'קידום'} ${r.values.join(', ')}${r.terms?.length?` בחיפושים כמו ${r.terms.slice(0,5).join(', ')}`:' בכל חיפוש'}`))),
  section('מונחים מקושרים למוצרים',(pr.scopedAliases||[]).map(r=>el('li',{},`${r.term} → ${r.productIds.length} מוצרים`))),
  section('תגיות',Object.entries(pr.tagDefinitions||{}).map(([k,v])=>el('li',{},`${k}${v.queryAliases?.length?' ('+v.queryAliases.join(', ')+')':''}`))));
 versions.append(el('div',{class:'export-box'},el('b',{},'מיני־שרת ל־dashboard-server'),el('p',{class:'meta'},'חבילת tenants/<לקוח> עם מנוע החיפוש, הכללים וכרטיסי המוצר, שמתחברת לשרת הראשי ומופעלת דרך כפתור ההפעלה בסטודיו. הוראות התקנה בתוך הקובץ.'),
  el('button',{type:'button',class:'ghost',onclick:async e=>{const b=e.target;b.disabled=true;try{const blob=await connection.request('/projects/'+project.id+'/mini-server',undefined,true);const url=URL.createObjectURL(blob),a=el('a',{href:url,download:`semantix-${project.id.slice(0,8)}.zip`});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(err){toast(err.message);}finally{b.disabled=false;}}},'הורד מיני־שרת'),
  el('button',{type:'button',class:'primary',onclick:async e=>{const b=e.target;b.disabled=true;try{const r=await api('/projects/'+project.id+'/dashboard-export',{});
   toast(`יוצא ל־${r.path} (גרסה ${r.manifest.revision})${r.verified&&!r.verified.ok?' — בדיקת הטעינה נכשלה: '+r.verified.error:''}${r.wired?'':' — server.js עדיין לא מחובר'}. להפעלה: ${r.enable}`);
   project=await api('/projects/'+project.id);renderVersions();}catch(err){toast(err.message);}finally{b.disabled=false;}}},'ייצא לדאשבורד סרבר המקומי'),
  el('div',{id:'dashboard-connect',class:'production'}),
  el('div',{id:'production-control',class:'production'}),
  project.dashboardExport?el('p',{class:'meta'},`ייצוא אחרון: גרסה ${project.dashboardExport.revision} · ${new Date(project.dashboardExport.at).toLocaleString('he-IL')}${project.dashboardExport.revision!==project.revisions.length?' · יש גרסה חדשה יותר שלא יוצאה':''}`):null));
 renderDashboardConnect();renderProduction();
 versions.append(pluginWorkspacePanel({id:project.id,api,connection,el,toast}));
 versions.append(pluginBuilder());
 versions.append(el('h3',{},'גרסאות'));
 for(const r of [...project.revisions].reverse().slice(0,30))versions.append(el('div',{class:'version'+(r.number===project.revisions.length?' current':'')},
  el('b',{},'גרסה '+r.number),el('small',{},r.createdAt?new Date(r.createdAt).toLocaleString('he-IL'):''),r.note?el('p',{},r.note):null,
  r.changes?.length?el('ul',{},r.changes.slice(0,6).map(c=>el('li',{},typeof c==='string'?c:String(c)))):null,
  r.number!==project.revisions.length?el('button',{type:'button',class:'link',onclick:()=>rollback(r.number)},'חזור לגרסה הזו'):el('span',{class:'pill'},'נוכחית')));
}
function pluginBuilder(){
 return createPluginBuilder({project,el,api,connection,onConnected:async()=>{project=await api('/projects/'+project.id);renderVersions();}});
}
// Production switch (users.users → semantix: on/off, share of shoppers) and the module data published to the store's Mongo.
// A store onboarded from its URL has no dashboard client yet: create one (user + products) in the existing schema.
async function renderDashboardConnect(){
 const root=$('dashboard-connect');if(!root||!project)return;const id=project.id;
 let s;try{s=await api('/projects/'+id+'/dashboard-connect');}catch(err){root.replaceChildren(el('p',{class:'error'},err.message));return;}if(project?.id!==id)return;
 if(s.connected){root.replaceChildren(el('b',{},'חיבור לדאשבורד'),el('p',{class:'meta'},`משתמש ${s.connected.username} · מסד ${s.connected.dbName}`),
  s.connected.createdByStudio?el('button',{type:'button',class:'ghost',onclick:async e=>{const b=e.target;b.disabled=true;try{const r=await api('/projects/'+id+'/dashboard-sync',{});toast(`סונכרנו ${r.products} מוצרים${r.notInStudio?` · ${r.notInStudio} מוצרים במסד כבר לא בסטודיו`:''}`);}catch(err){toast(err.message);}finally{b.disabled=false;}}},'סנכרן מוצרים למסד'):null);return;}
 const username=el('input',{value:s.suggestion.username,'aria-label':'שם משתמש',dir:'ltr'}),dbName=el('input',{value:s.suggestion.dbName,'aria-label':'שם מסד',dir:'ltr'}),email=el('input',{type:'email',placeholder:'מייל הלקוח (לא חובה)','aria-label':'מייל',dir:'ltr'});
 const go=async e=>{const b=e.target;if(!confirm(`ליצור לקוח ${username.value} במסד ${dbName.value}? נוצרים משתמש ב־users.users ומוצרים ב־${dbName.value}.products (לא דורס לקוח קיים).`))return;b.disabled=true;
  try{const r=await api('/projects/'+id+'/dashboard-connect',{username:username.value,dbName:dbName.value,email:email.value});project=await api('/projects/'+id);
   root.replaceChildren(el('b',{},'הלקוח חובר לדאשבורד'),el('p',{class:'meta'},`${r.products} מוצרים במסד ${r.dbName}. מפתח ה־API של החנות (לתוסף, מוצג פעם אחת):`),el('pre',{class:'code',dir:'ltr'},r.apiKey),el('p',{class:'meta'},'עכשיו אפשר לייצא את המודול ולהפעיל אותו בפרודקשן.'));renderProduction();}
  catch(err){toast(err.message);b.disabled=false;}};
 root.replaceChildren(el('b',{},'חיבור לדאשבורד'),el('p',{class:'meta'},'הלקוח נקלט מכתובת האתר ועדיין אין לו משתמש ומסד בדאשבורד. החיבור יוצר אותם בסכמה הקיימת, כדי שאפשר יהיה לייצא, להפעיל בפרודקשן ולחבר תוסף. החיפוש שלו יהיה המודול מהסטודיו (למוצרים אין embeddings של החיפוש הישן).'),
  el('div',{class:'row'},el('label',{},'שם משתמש ',username),el('label',{},'מסד ',dbName),email,el('button',{type:'button',class:'primary',onclick:go},'צור לקוח בדאשבורד')));
}
async function renderProduction(){
 const root=$('production-control');if(!root||!project)return;const id=project.id;root.replaceChildren(el('p',{class:'meta'},'בודק מצב בפרודקשן…'));
 let s;try{s=await api('/projects/'+id+'/production');}catch(err){root.replaceChildren(el('p',{class:'error'},err.message));return;}if(project?.id!==id)return;
 const c=s.control,percent=el('input',{type:'number',min:'0',max:'100',value:String(c?.percent??100),class:'percent','aria-label':'אחוז קונים'});
 const set=async enabled=>{const verb=enabled?`להפעיל את המודול בפרודקשן ל־${percent.value}% מהקונים`:'לכבות את המודול ולהחזיר את החיפוש הקיים';if(!confirm(`${verb}? השינוי נכתב למשתמש ${s.user?.username||s.user?.dbName||''} ב־users.users ונקלט בשרת תוך עד 5 דקות.`))return;
  try{await api('/projects/'+id+'/production',{enabled,percent:Number(percent.value)});toast(enabled?'המודול הופעל':'המודול כובה');renderProduction();}catch(err){toast(err.message);}};
 root.replaceChildren(el('b',{},'שליטה בפרודקשן'),
  el('p',{class:'meta'},s.error?`לא ניתן לקרוא את המשתמש: ${s.error}`:`משתמש ${s.user?.username||s.user?.dbName} · `+(c&&!s.otherModule?`${c.enabled?`פעיל ל־${c.percent}% מהקונים`:'כבוי'} · עודכן ${new Date(c.updatedAt).toLocaleString('he-IL')}${c.revision?` · גרסת מודול ${c.revision}`:''}`:s.otherModule?`המשתמש מחובר למודול אחר (${c.module}) — הפעלה תחליף אותו ב־${s.slug}`:'כבוי (אין שדה semantix במשתמש)')+(s.consistent===false?' · ⚠️ המתג לא אחיד בין משתמשי החנות — הפעלה או כיבוי ייישרו את כולם':'')),
  s.exported?el('p',{class:'meta'},(s.published?.revision?`נתוני המודול ב־Mongo: גרסה ${s.published.revision} מתוך ${s.revision} · פורסם ${new Date(s.published.publishedAt).toLocaleString('he-IL')} · כל גרסה מאושרת מתפרסמת אוטומטית ונקלטת בשרת תוך 30 שניות`:`נתוני המודול עוד לא פורסמו ל־Mongo${s.published?.error?` (${s.published.error})`:''} — ייצא את המודול כדי לפרסם`)+(s.published?.lastAttempt?.error?` · ⚠️ הפרסום האחרון נכשל: ${s.published.lastAttempt.error}`:'')):null,
  s.code?el('p',{class:s.code.action?'error':'meta'},{export:'⚠️ קוד המנוע השתנה מאז הייצוא — לחצו "ייצא לדאשבורד סרבר", ואז commit + push ומיזוג ל־main',commit:'⚠️ יש שינויי קוד במודול שלא נכנסו ל־git — צריך commit + push ומיזוג ל־main',push:'⚠️ יש קומיט של המודול שלא נדחף — צריך push ומיזוג ל־main'}[s.code.action]||'✓ הקוד בפרודקשן מעודכן — אין צורך בקומיט; שינויים בסטודיו מתפרסמים לבד'):null,
  s.error?null:el('div',{class:'row'},percent,el('span',{class:'meta'},'% מהקונים'),el('button',{type:'button',class:'primary',onclick:()=>set(true)},c?.enabled?'עדכן':'הפעל'),el('button',{type:'button',class:'ghost danger',onclick:()=>set(false)},'כבה')));
}
async function rollback(number){
 if(busy||!project||!number)return;if(!confirm(`לחזור לכללי גרסה ${number}? הפעולה נשמרת כגרסה חדשה.`))return;
 try{await api('/projects/'+project.id+'/rollback',{revision:number});project=await api('/projects/'+project.id);renderClient();toast('שוחזרה גרסה '+number);}catch(err){toast(err.message);}
}

// ---------- start ----------
(async()=>{
 try{
  const list=await loadClients();
  const wanted=new URL(location.href).searchParams.get('tenant')||localStorage.getItem('studio-tenant');
  const best=list.find(c=>c.id===wanted&&c.products>0)||list.find(c=>c.name==='steimatzky'&&c.products>0)||list.find(c=>c.products>0)||list.find(c=>c.id===wanted)||list[0];
  if(best)await openClient(best.id);else renderClient();
  const msgInput=$('message');
  if(msgInput){msgInput.disabled=false;msgInput.focus();}
  try{const raw=sessionStorage.getItem('studio-handoff');if(raw&&project){sessionStorage.removeItem('studio-handoff');const h=JSON.parse(raw);if(h.query){attached={query:h.query,total:h.total,results:h.results};renderAttached();runSearch(h.query);}if(h.message)$('message').value=h.message;$('message').focus();}}catch{}}
 catch(err){toast(err.message);}
})();
