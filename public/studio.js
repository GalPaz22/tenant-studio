import {createApi} from './api.js';

const connection=createApi(),api=(path,body)=>connection.request(path,body);
const $=id=>document.getElementById(id);
let project=null,busy=false,attached=null;
const welcome=$('welcome');

function el(tag,attrs={},...children){
 const n=document.createElement(tag);
 for(const [k,v] of Object.entries(attrs)){if(v==null||v===false)continue;if(k==='class')n.className=v;else if(k.startsWith('on'))n.addEventListener(k.slice(2),v);else n.setAttribute(k,v===true?'':v);}
 for(const c of children.flat())if(c!=null&&c!==false)n.append(c instanceof Node?c:String(c));
 return n;
}
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
 for(const c of list)nav.append(el('button',{class:'client'+(project?.id===c.id?' active':''),onclick:()=>openClient(c.id)},el('b',{},c.name),el('small',{},c.products?`${c.products.toLocaleString('he-IL')} מוצרים · גרסה ${c.revision}`:'ללא קטלוג שמור')));
 if(!list.length)nav.append(el('p',{class:'meta'},'אין עדיין לקוחות. פתח לקוח קיים לפי שם משתמש.'));
 return list;
}
async function openClient(id){
 if(busy)return toast('האייג׳נט עדיין עובד על הבקשה הקודמת');
 project=await api('/projects/'+id);const url=new URL(location.href);url.searchParams.set('tenant',id);history.replaceState(null,'',url);localStorage.setItem('studio-tenant',id);
 attached=null;renderAttached();renderClient();loadClients();
}
$('open-client').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{project=await api('/existing-client',{username:$('client-username').value});$('client-username').value='';renderClient();await loadClients();}catch(err){toast(err.message);}finally{button.disabled=false;}};

function renderClient(){
 const ready=!!(project?.revisions?.length&&project?.catalog?.count);
 $('client-name').textContent=project?.name||'בחר לקוח';
 $('client-meta').textContent=project?[project.catalog?.count?`${project.catalog.count.toLocaleString('he-IL')} מוצרים`:'אין קטלוג שמור',project.existingClient?`מסד ${project.existingClient.dbName}`:project.url].filter(Boolean).join(' · '):'';
 $('client-version').hidden=!project?.revisions?.length;$('client-version').textContent='גרסה '+(project?.revisions?.length||0);
 $('model').textContent=project?.studioModel?'מודל: '+project.studioModel:'';
 $('message').disabled=false;$('send').disabled=false;$('query').disabled=false;$('live-search').querySelector('button').disabled=false;
 renderThread();renderVersions();renderConcierge();setAuditButtons();if(!document.querySelector('[data-pane="crawler"]').hidden)renderCrawler();
 if(project&&!ready)$('thread').append(el('div',{class:'notice'},'ללקוח הזה עדיין אין קטלוג ואינדקס שמורים. בנה אותו ב',el('a',{href:'/index.html?tenant='+project.id},'ממשק המתקדם'),' ואז חזור לכאן.'));
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
 busy=true;$('send').disabled=true;setAuditButtons();
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
   follow();
  });
 }catch(err){status.remove();bodyEl.append(el('p',{class:'error'},err.message));}
 finally{status.remove();busy=false;$('send').disabled=false;setAuditButtons();$('message').focus();}
}
function setAuditButtons(){const ok=!busy&&!!project?.catalog?.count&&!!project?.existingClient;for(const b of ['audit-check','audit-fix'])$(b).disabled=!ok;$('audit-check').title=project&&!project.existingClient?'דורש לקוח קיים עם נתוני חיפוש במסד':'בודק את החיפושים המובילים, שהחזירו 0 תוצאות או שלא נלחצו, מול הכללים הנוכחיים';}
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
const TOOL_NAMES={overview:'סוקר את הקטלוג',analyze:'מכיר את הלקוח',find_products:'מאתר מוצרים',get_product:'פותח מוצר',categories:'בודק קטגוריות',fields:'בודק שדות',field_values:'קורא ערכי שדה',facet:'בודק אילו סוגי מוצרים חוזרים',audit_query:'בודק חיפוש',shopper_clicks:'בודק על מה קונים לחצו',crawl_status:'בודק את הסורק',merge_crawl:'ממזג את סריקת האתר',audit_fix:'מתקן',verify:'מאמת את התיקון בחיפוש חוזר',search:'מריץ חיפוש',inspect_query:'מאבחן חיפוש',search_analytics:'קורא נתוני חיפושים',list_rules:'קורא כללי חיפוש',add_spelling:'מוסיף תיקון כתיב',add_synonyms:'מוסיף מילים נרדפות',link_term:'מקשר מונח למוצרים',remove_rule:'מסיר כלל',configure_search:'משנה הגדרות',configure_concierge:'מגדיר קונסיירז׳',preview_concierge:'בודק מתי הקונסיירז׳ נפתח',db_fields:'קורא שדות מהמסד',db_search:'מחפש במסד',db_import_field:'מייבא שדה מהמסד',refresh_source_fields:'מרענן שדות מקור',process_field:'מעבד שדה',undo_processing:'מבטל עיבוד',add_example:'שומר בדיקה קבועה',check_examples:'מריץ בדיקות קבועות',list_versions:'קורא גרסאות',rollback:'משחזר גרסה'};
function toolLabel(e){const hint=e.args?.queries?.join(' · ')||e.args?.query||e.args?.contains||e.args?.field||e.args?.from||e.args?.term||'';return (TOOL_NAMES[e.name]||e.name)+(hint?` ״${hint}״`:'')+'…';}
$('composer').onsubmit=e=>{e.preventDefault();const m=$('message').value.trim();if(m)send(m);};
$('message').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('composer').requestSubmit();}};

// ---------- side panel ----------
function showPanel(name){
 document.body.dataset.show=name;
 for(const b of document.querySelectorAll('.panel-switch button'))b.classList.toggle('on',b.dataset.show===name);
}
for(const b of document.querySelectorAll('.panel-switch button'))b.onclick=()=>showPanel(b.dataset.show);
function tab(name){if(name==='crawler')setTimeout(renderCrawler);if(matchMedia('(max-width: 1100px)').matches)showPanel('side');for(const b of document.querySelectorAll('[data-tab]'))b.setAttribute('aria-selected',String(b.dataset.tab===name));for(const p of document.querySelectorAll('[data-pane]'))p.hidden=p.dataset.pane!==name;}
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

// ---------- site crawler (per tenant) ----------
const CRAWL_STATUS={none:'לא הופעל',ready:'מוכן',running:'רץ',waiting:'ממתין ל־worker',paused:'מושהה',stopped:'נעצר',done:'הסתיים',blocked:'נחסם על ידי האתר',interrupted:'נקטע — ה־worker הפסיק לדווח'};
let crawlTimer=null;
async function renderCrawler(){
 const root=$('crawler');if(!root||!project)return;clearTimeout(crawlTimer);const id=project.id;
 let c;try{c=await api('/projects/'+id+'/crawl');}catch(err){root.replaceChildren(el('p',{class:'error'},err.message));return;}
 if(project?.id!==id)return;
 const act=async(path,body,label)=>{try{const r=await api('/projects/'+id+'/crawl/'+path,body);if(r.added!==undefined)toast(`מוזגו ${r.pages} דפים: ${r.added} מוצרים נוספו, ${r.updated} עודכנו, ${r.authorsFilled} מחברים הושלמו`);if(path==='merge')project=await api('/projects/'+id);}catch(err){toast(err.message);}renderCrawler();};
 const s=c.settings,pct=c.total?Math.round(c.done/c.total*100):0,num=v=>(v??0).toLocaleString('he-IL');
 const rate=el('input',{type:'number',min:'0.5',max:'60',step:'0.5',value:String(s.rateMs/1000)}),auto=el('input',{type:'checkbox',checked:s.autoMerge}),src=Object.fromEntries(['clicks','sitemap','catalog'].map(k=>[k,el('input',{type:'checkbox',checked:s.sources[k]})]));
 root.replaceChildren(
  el('h3',{},'סורק האתר'),
  el('p',{class:'meta'},`סורק את דפי המוצר הציבוריים של ${project.url||'האתר'}: שם, מחבר, הוצאה, מחיר ומלאי. מזדהה בשמו ומכבד robots.txt. ההתקדמות נשמרת במסד, והעבודה נעשית ב־worker ${c.workerMode==='local'?'שרץ במחשב הזה':'בענן (Render)'} — ממשיך גם כשהסטודיו סגור.`),
  el('p',{},el('b',{class:'status-'+c.status},CRAWL_STATUS[c.status]||c.status),c.worker?` · worker: ${c.worker}`:'',c.running&&c.etaMinutes!=null?` · נותרו כ־${c.etaMinutes>90?Math.round(c.etaMinutes/60)+' שעות':c.etaMinutes+' דקות'}`:'',c.pagesPerMinute?` · ${c.pagesPerMinute} דפים לדקה`:''),
  c.blockedReason?el('p',{class:'error'},'סיבה: '+c.blockedReason):null,
  c.status==='waiting'?el('p',{class:'meta'},c.workerMode==='local'?'ה־worker המקומי אמור להתחיל תוך כמה שניות.':'אף worker לא לקח את העבודה עדיין. ודא שה־Background Worker ב־Render פעיל; אם worker אחר נעצר, הוא ישוחרר תוך 3 דקות.'):null,
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
  section('מונחים מקושרים למוצרים',(pr.scopedAliases||[]).map(r=>el('li',{},`${r.term} → ${r.productIds.length} מוצרים`))),
  section('תגיות',Object.entries(pr.tagDefinitions||{}).map(([k,v])=>el('li',{},`${k}${v.queryAliases?.length?' ('+v.queryAliases.join(', ')+')':''}`))));
 versions.append(el('h3',{},'גרסאות'));
 for(const r of [...project.revisions].reverse().slice(0,30))versions.append(el('div',{class:'version'+(r.number===project.revisions.length?' current':'')},
  el('b',{},'גרסה '+r.number),el('small',{},r.createdAt?new Date(r.createdAt).toLocaleString('he-IL'):''),r.note?el('p',{},r.note):null,
  r.changes?.length?el('ul',{},r.changes.slice(0,6).map(c=>el('li',{},typeof c==='string'?c:String(c)))):null,
  r.number!==project.revisions.length?el('button',{type:'button',class:'link',onclick:()=>rollback(r.number)},'חזור לגרסה הזו'):el('span',{class:'pill'},'נוכחית')));
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
