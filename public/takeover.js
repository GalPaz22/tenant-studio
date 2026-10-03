import {demoUrl as mirrorUrl} from './demo-url.js';
// Full search takeover. Two configurations, kept apart:
//   demo       — lives in the studio project; detection writes it, the operator edits it, the demo mirror runs it.
//   production — credentials.siteConfig on the store's users; only "copy demo → production" writes it (hash-checked,
//                backed up, restorable).
const STEP_LABELS={root:'אזור התוכן (בין ההאדר לפוטר)',autocomplete:'הצעות חיפוש מקוריות',platform:'פלטפורמה',searchForm:'טופס חיפוש',resultsGrid:'גריד תוצאות',productCard:'כרטיס מוצר',noResults:'הודעת "אין תוצאות"',page2:'עמוד 2',hide:'אלמנטים להסתרה',cardTemplate:'תבנית כרטיס',cardFill:'מילוי תבנית',addToCart:'הוספה לסל'};
const KIND_LABELS={count:'מונה',sort:'מיון',pager:'עימוד',filters:'מסננים'};
const ATC_MODES={engine:'המנוע מוסיף לסל של החנות',link:'הכפתור פותח את דף המוצר',off:'בלי כפתור הוספה לסל'};
const ATC_SHORT={engine:'מנוע',link:'דף מוצר',off:'כבוי'};
const EVENT_LABELS={autocomplete:"הצעות חיפוש",'preview-cart-add':'הוספה לסל (בדמו — לא נשלחה לחנות)','search':'חיפוש','fast-search':'חיפוש מהיר','load-more':'טעינת עוד','auto-load-more':'טעינת עוד','product-click':'קליק על מוצר','search-to-cart':'עגלה / צ׳קאאוט','zero-search':'חיפוש ללא תוצאות'};
const list=v=>(Array.isArray(v)?v:v==null?[]:[v]).filter(Boolean).join(', ')||null;
// Rows of the demo ↔ production comparison: [label, shown value, compared value].
const ROWS=[
 ['החלפה מלאה',c=>c?.features?.fullReplace===true?'פעילה':'כבויה',c=>c?.features?.fullReplace===true],
 ['היקף בדף החיפוש',c=>c?.replace?.scope==='main'?`כל האזור (${list(c.replace.root)||'main'})`:'הגריד בלבד',c=>c?.replace?.scope==='main'?list(c.replace.root):'grid'],
 ['הצעות חיפוש',c=>c?.features?.autocomplete===true?(c.autocomplete?.mount?'בתוך '+c.autocomplete.mount:'פאנל מתחת לשדה'):'של החנות',c=>c?.features?.autocomplete===true?JSON.stringify(c.autocomplete||{}):false],
 ['פלטפורמה',c=>c?.platform||null],
 ['פרמטר חיפוש',c=>list(c?.queryParams)],
 ['גריד תוצאות',c=>list(c?.selectors?.resultsGrid)],
 ['כרטיס מוצר',c=>list(c?.selectors?.productCard)],
 ['הודעת "אין תוצאות"',c=>list(c?.selectors?.noResults)],
 ['להסתיר',c=>list(c?.replace?.hide)],
 ['תבנית כרטיס',c=>c?.nativeCard?.cardTemplate?`${c.nativeCard.cardTemplate.length.toLocaleString('he-IL')} תווים`:null,c=>c?.nativeCard?.cardTemplate||null],
 ['הוספה לסל',c=>ATC_SHORT[c?.addToCart?.mode]||null,c=>c?.addToCart?.mode||null],
 ['מעקב עגלה',c=>list(c?.cartInterceptor?.atcPatterns)],
 ['מעקב צ׳קאאוט',c=>list(c?.cartInterceptor?.checkoutPatterns)],
 ['מעקב קליקים',c=>c?.clickTracking?.universalLinkSelector||null],
];

export async function renderTakeover({root,project,api,download,streamInto,el,toast,fill,loading}){
 const id=project.id,base='/projects/'+id+'/takeover';
 loading(root);
 let view;try{view=await api(base);}catch(err){fill(root,el('p',{class:'error'},err.message));return;}
 const again=()=>renderTakeover({root,project,api,download,streamInto,el,toast,fill,loading});
 const guarded=fn=>async e=>{const b=e?.currentTarget;if(b)b.disabled=true;try{await fn();}catch(err){toast(err.message);}finally{if(b?.isConnected)b.disabled=false;}};
 const detect=guarded(async()=>{await streamInto(root,base+'/detect',{});again();});
 const t=view.takeover;
 const card=(title,...body)=>el('section',{class:'tk-card'},el('h4',{},title),...body);
 const code=(v,full)=>el('code',{dir:'ltr',title:full||v||''},v||'—');

 const head=el('header',{class:'tk-head'},
  el('div',{},el('h3',{},'החלפת החיפוש באתר'),el('p',{class:'meta'},'הסטודיו קורא את דפי החיפוש של החנות ובונה ממנו תצורה. התצורה נשמרת כאן כ״דמו״, וההדגמה רצה עליה. האתר האמיתי לא משתנה עד שמעתיקים לפרודקשן.')),
  el('div',{class:'tk-actions'},
   t?el('span',{class:'pill '+(t.ready?'ready':'')},t.ready?'מוכן':'זיהוי חלקי'):'',
   el('button',{type:'button',class:t?'ghost':'primary',onclick:detect},t?'זהה מחדש':'זהה אוטומטית'),
   t?el('button',{type:'button',class:'primary',onclick:()=>window.open(demoUrl(t),'_blank','noopener')},'פתח הדגמה'):''));
 if(!t){fill(root,el('div',{class:'tk'},head));return;}
 function demoUrl(t){try{const u=new URL(t.resultsUrl);return mirrorUrl(id,u.pathname+u.search,'engine');}catch{return mirrorUrl(id,'/','engine');}}

 const warnings=[...(project.platform&&t.platform!==project.platform?[`הפלטפורמה שזוהתה באתר היא ${t.platform}, אבל הפרויקט רשום כ־${project.platform}.`]:[]),...t.report.warnings];
 const warnBox=warnings.length?el('ul',{class:'tk-warnings'},...warnings.map(w=>el('li',{},w))):'';

 // What detection found, one row per step.
 const detected=card('מה זוהה',el('table',{class:'tk-table'},el('tbody',{},...t.report.steps.map(s=>el('tr',{class:s.ok?'ok':'bad'},
  el('td',{class:'tk-mark'},s.ok?'✓':'✗'),el('th',{},STEP_LABELS[s.name]||s.name),el('td',{},code(s.detail)))))));

 // Hidden elements: unchecking keeps one visible after replacement.
 const hidden=new Set(t.settings?.hide||t.hidden.map(h=>h.selector));
 const hideCard=card('להסתיר אחרי ההחלפה',el('p',{class:'meta'},'אלמנטים של החיפוש המקורי שלא מתאימים לתוצאות שלנו.'),
  ...(t.hidden.length?t.hidden.map(h=>{
   const box=el('input',{type:'checkbox',checked:hidden.has(h.selector),onchange:guarded(async()=>{box.checked?hidden.add(h.selector):hidden.delete(h.selector);await api(base+'/settings',{hide:[...hidden]});})});
   return el('label',{class:'tk-check'},box,el('span',{},el('b',{},h.kinds.map(k=>KIND_LABELS[k]||k).join(' · ')),' ',code(h.selector),el('small',{class:'meta'},h.text)));
  }):[el('p',{class:'meta'},'לא נמצאו אלמנטים להסתרה.')]));

 // How much of the store's search is replaced. Each part can be switched off; it comes back with the next save.
 const det0=t.detectedConfig||t.siteConfig,ac=det0.autocomplete;
 const mainBox=el('input',{type:'checkbox',checked:t.siteConfig.replace?.scope==='main',disabled:det0.replace?.scope!=='main',onchange:guarded(async()=>{await api(base+'/settings',{scope:mainBox.checked?'main':'grid'});again();})});
 const acBox=el('input',{type:'checkbox',checked:t.siteConfig.features?.autocomplete===true,disabled:!ac,onchange:guarded(async()=>{await api(base+'/settings',{autocomplete:acBox.checked});again();})});
 const scopeCard=card('מה מוחלף',
  el('label',{class:'tk-check'},mainBox,el('span',{},el('b',{},'כל דף החיפוש, בין ההאדר לפוטר'),' ',det0.replace?.scope==='main'?code(det0.replace.root):'',el('small',{class:'meta'},det0.replace?.scope==='main'?'כותרת ותוצאות של Semantix בכרטיסי המוצר המקוריים; כל שאר התוכן המקורי של הדף מוסתר. עובד גם כשלחיפוש המקורי אין תוצאות. כבוי = מוחלפים רק הכרטיסים בגריד.':'לא זוהה אזור תוכן — מוחלפים רק הכרטיסים בגריד.'))),
  el('label',{class:'tk-check'},acBox,el('span',{},el('b',{},'הצעות חיפוש (אוטוקומפליט)'),' ',ac?code(ac.input):'',el('small',{class:'meta'},ac?`הרכיב המקורי מוסר (${ac.hide?.join(', ')||'לא נמצא רכיב מקורי'}) וההצעות שלנו נפתחות ${ac.mount?'בתוך '+ac.mount+', מתחת לשדה':'בפאנל מתחת לשדה'}.`:'לא זוהה שדה חיפוש.'))));

 // Settings are saved as the operator edits; a text field saves when it loses focus.
 // Saves run one after another: the server refuses a second write while one is in progress.
 let queue=Promise.resolve();
 const save=(patch,rerender=false)=>(queue=queue.catch(()=>{}).then(async()=>{await api(base+'/settings',patch);if(rerender)again();else toast('נשמר בדמו');}));
 const field=(label,input)=>el('label',{class:'tk-field'},el('span',{},label),input);
 const textInput=(value,onSave,attrs={})=>{const i=el('input',{value:value??'',maxlength:60,...attrs,onchange:guarded(async()=>onSave(i.value))});return i;};

 const mode=t.siteConfig.addToCart?.mode||'off',atcStep=t.report.steps.find(s=>s.name==='addToCart'),atc=t.siteConfig.addToCart||{};
 const atcSelect=el('select',{'aria-label':'מצב הוספה לסל',disabled:!t.card.addToCart,onchange:guarded(async()=>save({addToCart:atcSelect.value},true))},
  ...Object.entries(ATC_MODES).map(([v,l])=>el('option',{value:v,selected:v===mode},l)));
 const toastBox=el('input',{type:'checkbox',checked:atc.toast!==false,onchange:guarded(async()=>save({atcText:{toast:toastBox.checked}}))});
 const atcCard=card('הוספה לסל',field('מה הכפתור עושה',atcSelect),
  el('p',{class:'meta'},t.card.addToCart?'הכפתור מהכרטיס המקורי נשמר. המנוע מוצא בדף המוצר את המזהה שהחנות צריכה, שולח את הטופס שלה ומרענן את העגלה. מוצר עם אפשרויות לבחירה או שאזל מהמלאי פותח את דף המוצר.':'לכרטיסים המקוריים אין כפתור הוספה לסל, ולכן גם לכרטיס שלנו אין.'),
  mode==='engine'?el('div',{class:'tk-fields'},
   field('בזמן ההוספה',textInput(atc.addingText||'מוסיף…',v=>save({atcText:{addingText:v}}))),
   field('אחרי ההוספה',textInput(atc.addedText||'נוסף לסל ✓',v=>save({atcText:{addedText:v}}))),
   el('label',{class:'tk-check'},toastBox,el('span',{},'הודעת אישור עם קישור לסל')),
   field('טקסט ההודעה',textInput(atc.toastText||'המוצר נוסף לסל',v=>save({atcText:{toastText:v}})))):'',
  atcStep?code(atcStep.detail):'');

 // Loader shown while results load, with a live preview of exactly what shoppers will see.
 const loader={type:'bar',text:'מחפש עבורך…',color:'#16261f',...(t.siteConfig.replace?.loader||{})};
 const preview=el('div',{class:'tk-loader-preview'});
 const drawPreview=()=>{
  preview.replaceChildren();
  if(loader.type==='none'){preview.append(el('p',{class:'meta'},'בלי אנימציה — האזור ריק עד שהתוצאות מגיעות.'));return;}
  if(loader.type==='skeleton'){preview.append(el('div',{class:'tk-skeleton'},el('div',{}),el('span',{}),el('span',{})));return;}
  const bar=el('div',{'data-semantix-bar-loader':'1'},el('div',{class:'sx-track'},el('div',{class:'sx-fill'})),loader.text?el('div',{class:'sx-text'},loader.text):'');
  bar.style.setProperty('--sx-color',loader.color);preview.append(bar);
 };
 drawPreview();
 const loaderType=el('select',{'aria-label':'סוג הטעינה',onchange:guarded(async()=>{loader.type=loaderType.value;drawPreview();await save({loader:{type:loader.type}});})},
  ...[['bar','פס טעינה באמצע'],['skeleton','כרטיס שלד'],['none','בלי']].map(([v,l])=>el('option',{value:v,selected:v===loader.type},l)));
 const loaderText=textInput(loader.text,async v=>{loader.text=v;drawPreview();await save({loader:{text:v}});});
 loaderText.addEventListener('input',()=>{loader.text=loaderText.value;drawPreview();});
 const loaderColor=el('input',{type:'color',value:loader.color,'aria-label':'צבע',oninput:()=>{loader.color=loaderColor.value;drawPreview();},onchange:guarded(async()=>save({loader:{color:loaderColor.value}}))});
 const loaderCard=card('טעינה',el('div',{class:'tk-fields'},field('סוג',loaderType),field('טקסט',loaderText),field('צבע',loaderColor)),preview);

 // Manual fixes: override what detection found. Kept across re-detection until reset.
 const o=t.settings?.overrides||{},det=t.detectedConfig||t.siteConfig;
 const sel=(key,label,detected)=>{const i=el('input',{dir:'ltr',value:o[key]||'',placeholder:detected||'',spellcheck:'false'});return {key,input:i,node:field(label+(o[key]?' · נערך ידנית':''),i)};};
 const sels=[sel('resultsGrid','גריד תוצאות',det.selectors?.resultsGrid?.[0]),sel('productCard','כרטיס מוצר',det.selectors?.productCard?.[0]),sel('noResults','הודעת "אין תוצאות"',det.selectors?.noResults?.[0])];
 const tpl=el('textarea',{dir:'ltr',rows:10,class:'tk-snippet',spellcheck:'false'});tpl.value=o.cardTemplate||t.siteConfig.nativeCard?.cardTemplate||'';
 const manual=el('section',{class:'tk-card tk-wide'},el('h4',{},'תיקון ידני'+(Object.keys(o).length?' · יש שינויים ידניים':'')),
  el('p',{class:'meta'},'שדה ריק = מה שהזיהוי מצא (מוצג באפור). מה שמשנים כאן נשמר גם אחרי זיהוי מחדש, עד שמחזירים לזיהוי האוטומטי. אחרי שמירה פתחו את ההדגמה ובדקו.'),
  el('div',{class:'tk-fields tk-fields-3'},...sels.map(s=>s.node)),
  el('details',{open:!!o.cardTemplate},el('summary',{},'תבנית הכרטיס'+(o.cardTemplate?' · נערכה ידנית':'')),
   el('p',{class:'meta'},'שדות שמתמלאים מכל מוצר: {{url}} {{name}} {{image}} {{price}} {{author}} {{id}} {{outOfStock}}. כפתור עם data-semantix-atc הוא כפתור ההוספה לסל.'),tpl),
  el('div',{class:'row'},
   el('button',{type:'button',class:'primary',onclick:guarded(async()=>{
    const overrides=Object.fromEntries(sels.map(s=>[s.key,s.input.value.trim()||null]));
    const current=o.cardTemplate||t.siteConfig.nativeCard?.cardTemplate||'';
    if(tpl.value.trim()!==current.trim())overrides.cardTemplate=tpl.value;
    await save({overrides},true);toast('התיקונים נשמרו בדמו');
   })},'שמור תיקונים'),
   Object.keys(o).length?el('button',{type:'button',class:'ghost',onclick:guarded(async()=>{if(!confirm('לבטל את כל התיקונים הידניים ולחזור למה שהזיהוי מצא?'))return;await save({reset:true},true);})},'חזור לזיהוי האוטומטי'):''));

 // Demo ↔ production, side by side. Production is read only on request.
 const compare=el('section',{class:'tk-card tk-wide'});
 const drawCompare=live=>{
  const prodCfg=live?.siteConfig;
  const rows=ROWS.map(([label,shown,raw=shown])=>{
   const d=JSON.stringify(raw(t.siteConfig)??null),p=live?JSON.stringify(raw(prodCfg)??null):null;
   const state=!live?'':d===p?'same':p==='null'?'missing':'diff';
   return {label,demo:shown(t.siteConfig),prod:live?shown(prodCfg):null,state};
  });
  const changed=rows.filter(r=>r.state&&r.state!=='same');
  const STATE={same:'זהה',diff:'שונה',missing:'חסר בפרודקשן'};
  const table=el('table',{class:'tk-table tk-compare'},
   el('thead',{},el('tr',{},el('th',{},'הגדרה'),el('th',{},'דמו (בסטודיו)'),el('th',{},'פרודקשן (באתר)'),el('th',{},''))),
   el('tbody',{},...rows.map(r=>el('tr',{class:r.state},el('th',{},r.label),el('td',{},code(r.demo)),el('td',{},live?code(r.prod):el('span',{class:'meta'},'לא נטען')),el('td',{},r.state?el('span',{class:'tk-state '+r.state},STATE[r.state]):'')))));
  const actions=el('div',{class:'row'});
  if(!live)actions.append(el('button',{type:'button',class:'ghost',onclick:guarded(async()=>drawCompare(await api(base+'/production')))},'טען את הפרודקשן להשוואה'));
  else{
   actions.append(el('button',{type:'button',class:'primary',disabled:!t.ready||!changed.length,onclick:guarded(async()=>{
    if(!confirm(`להעתיק מהדמו לפרודקשן של ${project.name}?\n\nישתנו: ${changed.map(r=>r.label).join(', ')}\n\nזה ישפיע מיד על האתר האמיתי (אצל ${live.users.length} משתמשים). התצורה הנוכחית נשמרת בגיבוי.`))return;
    const r=await api(base+'/publish',{expectedHash:live.hash});toast(`הועתק לפרודקשן (${r.result.users} משתמשים). האתר יקבל את התצורה תוך עד 5 דקות.`);again();
   })},changed.length?`העתק מדמו לפרודקשן (${changed.length} שינויים)`:'הפרודקשן זהה לדמו'),
   el('button',{type:'button',class:'ghost',onclick:guarded(async()=>drawCompare(await api(base+'/production')))},'רענן'));
   if(!t.ready)actions.append(el('span',{class:'meta'},'הזיהוי לא הושלם — אי אפשר להעתיק.'));
  }
  const backups=live?.backups?.length?el('details',{},el('summary',{},`שחזור מגיבוי (${live.backups.length})`),...live.backups.map(b=>el('div',{class:'row'},code(b.replace(/^siteconfig-[a-f0-9-]{36}-/,'').replace(/\.json$/,'')),el('button',{type:'button',class:'ghost',onclick:guarded(async()=>{if(!confirm('לשחזר את הפרודקשן לגרסה הזו?'))return;await api(base+'/rollback',{backup:b});toast('הפרודקשן שוחזר');again();})},'שחזר')))):'';
  compare.replaceChildren(el('h4',{},'דמו מול פרודקשן'),
   el('p',{class:'meta'},live?`פרודקשן: ${live.users.join(', ')}${live.consistent?'':' · לא לכל המשתמשים אותה תצורה; כל אחד ימוזג בנפרד'}. הגדרות אחרות שקיימות בפרודקשן (הסכמה, מיתוג, בדיקות A/B) לא משתנות.`:'הדמו הוא מה שרץ בהדגמה. הפרודקשן הוא מה שהאתר האמיתי טוען כרגע.'),
   t.published?el('p',{class:'meta'},`הועתק לאחרונה ב־${new Date(t.published.at).toLocaleString('he-IL')}.`):'',
   table,actions,backups,live?installCard(live):'');
 };
 const installCard=live=>{
  const settings={apiBase:live.apiBase,apiKey:live.apiKey,engineSrc:live.cdnBase+'/semantix-engine.min.js',endpoints:{siteConfig:'/site-config',search:'/search',fastSearch:'/fast-search',productClick:'/product-click',searchToCart:'/search-to-cart',zeroSearch:'/zero-search'}};
  const snippet=`<script>window.SemantixSettings=${JSON.stringify(settings)};</script>\n<script src="${live.cdnBase}/semantix-loader.min.js"></script>`;
  const box=el('textarea',{readonly:true,dir:'ltr',rows:4,class:'tk-snippet','aria-label':'קוד התקנה'});box.value=snippet;
  return el('details',{class:'tk-install'},el('summary',{},'קוד התקנה לאתר'),
   el('p',{class:'meta'},`שרת החיפוש (${new URL(live.apiBase).host}) ומפתח האתר כבר בפנים. להדביק בתחילת ה־<head> — לא דרך GTM, כדי שהגריד המקורי יוסתר לפני שהוא מוצג.`),box,
   el('button',{type:'button',class:'ghost',onclick:guarded(async()=>{await navigator.clipboard.writeText(snippet);toast('הקוד הועתק');})},'העתק'));
 };
 drawCompare(null);

 // Shipping (Shopify app, WooCommerce plugin, daily feed, rollout and measurement) lives in the "תוסף" tab.
 const shipping=el('section',{class:'tk-card tk-wide'},el('h4',{},'התקנה בחנות ושליטה מרחוק'),
  el('p',{class:'meta'},'ייצוא ופריסה של אפליקציית Shopify או תוסף WooCommerce, עדכון הפיד היומי, מדידת הרכישות וחלוקת הגולשים בין Semantix לחיפוש המקורי נמצאים בלשונית ״תוסף״.'),
  el('div',{class:'row'},el('button',{type:'button',class:'primary',onclick:()=>document.querySelector('[data-tab="plugin"]')?.click()},'פתח את לשונית התוסף')));

 // Tracking seen while the demo was used.
 const events=el('div',{class:'tk-events'});
 const drawEvents=items=>{events.replaceChildren(items.length?el('ul',{},...items.slice(-30).reverse().map(e=>el('li',{},el('span',{class:'meta'},e.at.slice(11,19)),' ',el('b',{},EVENT_LABELS[e.kind]||e.kind),e.body?code(JSON.stringify(e.body).slice(0,140),JSON.stringify(e.body)):''))):el('p',{class:'meta'},'עוד לא נרשמו אירועים. פתחו הדגמה, חפשו, לחצו על מוצר והוסיפו לסל.'));};
 drawEvents(view.events);
 const tracking=card('אירועים מההדגמה',
  el('div',{class:'row'},el('button',{type:'button',class:'ghost',onclick:guarded(async()=>drawEvents((await api(base)).events))},'רענן'),el('button',{type:'button',class:'ghost',onclick:guarded(async()=>{await api(base+'/events/clear',{});drawEvents([]);})},'נקה')),events);

 const technical=el('section',{class:'tk-card tk-wide'},el('h4',{},'פרטים טכניים'),
  el('details',{},el('summary',{},`תבנית הכרטיס (מתוך "${t.card.source.title}")`),
   el('p',{class:'meta'},t.card.cleared.length?`נוקו ${t.card.cleared.length} ערכים ששייכים רק למוצר הדוגמה.`:'לא נמצאו ערכים לניקוי.'),el('pre',{dir:'ltr',class:'code'},t.card.html)),
  el('details',{},el('summary',{},'תצורת הדמו המלאה (JSON)'),el('pre',{dir:'ltr',class:'code'},JSON.stringify({...t.siteConfig,nativeCard:{...t.siteConfig.nativeCard,cardTemplate:'…'}},null,2))),
  el('p',{class:'meta'},view.engine==='local'?'ההדגמה טוענת את המנוע מ־semantix-cdn המקומי (כולל שינויים שעוד לא נפרסו).':'ההדגמה טוענת את המנוע מה־CDN המפורסם.'));

 fill(root,el('div',{class:'tk'},head,warnBox,el('div',{class:'tk-grid'},detected,scopeCard,hideCard,loaderCard,atcCard,manual,tracking,shipping,compare,technical)));
}
