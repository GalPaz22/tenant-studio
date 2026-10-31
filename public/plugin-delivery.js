// The "תוסף" tab's delivery section: everything about getting the search takeover onto the store and running it there —
// the client's Shopify app (create, deploy, install state, daily product feed, purchase pixel), the WooCommerce plugin
// export, and the server-side rollout (share of visitors who get Semantix) with its measured result.
// What is replaced on the storefront and how it looks is configured in the "החלפת חיפוש" tab; this section ships it.
export async function renderDelivery({root,project,api,download,streamInto,el,toast}){
 const id=project.id,base='/projects/'+id+'/takeover';
 const again=()=>renderDelivery({root,project,api,download,streamInto,el,toast});
 root.replaceChildren(el('p',{class:'meta'},'טוען…'));
 let view,defaults=null;try{view=await api(base);}catch(err){root.replaceChildren(el('p',{class:'error'},err.message));return;}
 try{defaults=await api('/projects/'+id+'/storefront-defaults');}catch{}
 const guarded=fn=>async e=>{const b=e?.currentTarget;if(b)b.disabled=true;try{await fn();}catch(err){toast(err.message);}finally{if(b?.isConnected)b.disabled=false;}};
 const code=(v,full)=>el('code',{dir:'ltr',title:full||v||''},v||'—');
 const field=(label,input)=>el('label',{class:'tk-field'},el('span',{},label),input);
 const t=view.takeover;
 // Where the store stands, top to bottom in the order things have to happen.
 const step=(ok,text)=>el('li',{class:ok?'ok':'bad'},(ok?'✓ ':'✗ ')+text);
 const f=t?.siteConfig?.features||{},r=t?.siteConfig?.replace||{};
 const overview=el('section',{class:'tk-card tk-wide'},el('h4',{},'מצב החנות'),
  el('p',{class:'meta'},`${new URL(project.url).hostname} · ${t?.platform||project.platform||'פלטפורמה לא ידועה'}`),
  el('ul',{class:'tk-warnings'},
   step(!!t?.ready,t?.ready?`החלפת החיפוש זוהתה: ${r.scope==='main'?'כל דף החיפוש':'גריד התוצאות'}${f.autocomplete?' + הצעות חיפוש':''}`:t?'זיהוי החלפת החיפוש חלקי — השלימו אותו בלשונית ״החלפת חיפוש״':'עוד לא זוהתה החלפת חיפוש — הריצו ״זהה אוטומטית״ בלשונית ״החלפת חיפוש״'),
   step(!!defaults?.apiKey,defaults?.apiKey?`לחנות יש מפתח אתר (${defaults.user||'משתמש בדאשבורד'})`:'לחנות אין מפתח אתר — ״חיבור לדאשבורד״ בלשונית ״גרסאות וכללים״')),
  el('div',{class:'row'},el('button',{type:'button',class:'ghost',onclick:again},'רענן')));
 if(!t){root.replaceChildren(el('div',{class:'tk'},el('div',{class:'tk-grid'},overview)));return;}

 // Rollout: the share of visitors who get Semantix, set on the server and read by every storefront within minutes.
 const rolloutCard=el('section',{class:'tk-card tk-wide'});
 const drawRollout=async()=>{
  let r=null,error=null;try{r=await api(base+'/rollout');}catch(err){error=err.message;}
  const current=r?.percent,start=current??100;
  const slider=el('input',{type:'range',dir:'ltr',min:0,max:100,step:1,value:start,'aria-label':'אחוז הגולשים שמקבלים את Semantix',disabled:!!error});
  const number=el('input',{type:'number',min:0,max:100,step:1,value:start,class:'percent',style:'width:5em','aria-label':'אחוז',disabled:!!error});
  slider.addEventListener('input',()=>{number.value=slider.value;});
  number.addEventListener('input',()=>{const v=Math.max(0,Math.min(100,Math.round(Number(number.value)||0)));slider.value=v;});
  // Pinned visitors: these browsers get the chosen search whatever the percentage — the operator's own session.
  const pinRows=el('div',{class:'tk-pins'});
  const pinRow=(vid='',variant='semantix')=>{
   const idIn=el('input',{dir:'ltr',value:vid,placeholder:'vis-…',spellcheck:'false',autocomplete:'off',style:'width:22em','aria-label':'מזהה גולש'});
   const pick=el('select',{'aria-label':'קבוצה'},el('option',{value:'semantix',selected:variant==='semantix'},'Semantix'),el('option',{value:'native',selected:variant==='native'},'חיפוש מקורי'));
   const link=el('a',{target:'_blank',rel:'noopener',dir:'ltr',class:'meta'});
   const sync=()=>{const v=idIn.value.trim();link.textContent=v?'פתח באתר עם המזהה הזה':'';link.href=v?new URL('/?semantix_vid='+encodeURIComponent(v),project.url).href:'#';};
   idIn.addEventListener('input',sync);sync();
   const row=el('div',{class:'row'},idIn,pick,el('button',{type:'button',class:'ghost',onclick:()=>row.remove()},'הסר'),link);
   row.read=()=>[idIn.value.trim(),pick.value];return row;
  };
  for(const [vid,variant] of Object.entries(r?.pins||{}))pinRows.append(pinRow(vid,variant));
  const readPins=()=>{const out={};for(const row of pinRows.children){const [vid,variant]=row.read();if(vid)out[vid]=variant;}return out;};
  const newTestId=()=>'vis-test-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
  const apply=(percent,pins=readPins())=>guarded(async()=>{
   const n=Object.keys(pins).length,list=Object.entries(pins).map(([v,g])=>`  ${v} → ${g==='semantix'?'Semantix':'חיפוש מקורי'}`).join('\n');
   const text=percent===null?'להסיר את חלוקת ה־A/B (כולל הגולשים הקבועים)? כל הגולשים יקבלו את מה שהתצורה הבנויה קובעת — בקובץ שנבנה עם חלוקה מובנית (כמו סטימצקי) זה Semantix לכולם.'
    :percent===0?`להחזיר את כל הגולשים לחיפוש המקורי של החנות? Semantix ימשיך רק למדוד.${n?`\nחוץ מ־${n} גולשים קבועים:\n${list}`:''}`
    :`לתת את Semantix ל־${percent}% מהגולשים ואת החיפוש המקורי ל־${100-percent}%?${n?`\nגולשים קבועים:\n${list}`:''}`;
   if(!confirm(text+'\n\nהשינוי נכתב לפרודקשן ומגיע לאתר תוך עד 5 דקות (מעמוד הצפייה הבא).'))return;
   const done=await api(base+'/rollout',percent===null?{percent}:{percent,pins});
   // The server answers with what it wrote; pins sent but not written = a server that does not know them (restart it).
   if(percent!==null&&JSON.stringify(Object.entries(done.pins||{}).sort())!==JSON.stringify(Object.entries(pins).sort())){toast('האחוז נשמר, אבל הגולשים הקבועים לא נשמרו בפרודקשן — יש להפעיל מחדש את הסטודיו ולשמור שוב');drawRollout();return;}
   toast(`נשמר בפרודקשן${done.percent===null?'':`: ${done.percent}%${Object.keys(done.pins||{}).length?` + ${Object.keys(done.pins).length} קבועים`:''}`}`);drawRollout();
  });
  const pinned=Object.entries(r?.pins||{}),onlyPinned=current===0&&pinned.some(([,g])=>g==='semantix');
  const status=error?el('p',{class:'error'},error):el('p',{class:'meta'},current===null?'כרגע בפרודקשן: אין חלוקה — כל הגולשים מקבלים את מה שהתצורה הבנויה קובעת.'
   :`כרגע בפרודקשן: ${onlyPinned?'מצב בדיקה — רק הגולשים הקבועים מקבלים Semantix':`${current}% Semantix · ${100-current}% חיפוש מקורי`}${pinned.length?` · ${pinned.length} גולשים קבועים`:''}${r.updatedAt?' · עודכן '+new Date(r.updatedAt).toLocaleString('he-IL'):''}${r.consistent?'':' · לא לכל המשתמשים אותה חלוקה'}`);
  rolloutCard.replaceChildren(el('h4',{},'שליטה מרחוק: Semantix מול החיפוש המקורי (A/B)'),
   el('p',{class:'meta'},'קובע מהשרת איזה חלק מהגולשים מקבל את החיפוש של Semantix ואיזה חלק את החיפוש של החנות — בלי התקנה או פריסה מחדש. החלוקה לפי מזהה הגולש: גולש נשאר באותה קבוצה, והעלאת האחוז רק מוסיפה גולשים ל־Semantix. גם בקבוצת החיפוש המקורי החיפושים, הקליקים וההוספות לסל נמדדים, כדי שאפשר יהיה להשוות.'),
   status,
   el('div',{class:'tk-fields'},field('Semantix לגולשים',el('span',{},slider,' ',number,' %'))),
   el('h5',{},'גולשים קבועים (בדיקה)'),
   el('p',{class:'meta'},'מזהה גולש שמופיע כאן מקבל תמיד את הקבוצה שנבחרה, בלי קשר לאחוז — כך אפשר לבדוק את Semantix באתר החי כשכל השאר על החיפוש המקורי. המזהה של הדפדפן שלך: באתר, בקונסול, localStorage.semantix_visitor_id. או צרו מזהה בדיקה ופתחו את הקישור שלידו — הדפדפן יאמץ אותו. הגולשים הקבועים לא נספרים במדידה.'),
   pinRows,
   el('div',{class:'row'},
    el('button',{type:'button',class:'ghost',disabled:!!error||pinRows.children.length>=20,onclick:()=>pinRows.append(pinRow())},'+ הוסף מזהה'),
    el('button',{type:'button',class:'ghost',disabled:!!error,onclick:()=>pinRows.append(pinRow(newTestId()))},'+ צור מזהה בדיקה')),
   el('div',{class:'row'},
    el('button',{type:'button',class:'primary',disabled:!!error,onclick:e=>apply(Number(slider.value))(e)},'החל בפרודקשן'),
    el('button',{type:'button',class:'ghost',disabled:!!error,onclick:e=>{const pins=readPins();if(!Object.values(pins).includes('semantix')){toast('הוסיפו קודם מזהה גולש עם Semantix');return;}apply(0,pins)(e);}},'רק לגולשים הקבועים (0% + בדיקה)'),
    el('button',{type:'button',class:'ghost',disabled:!!error,onclick:e=>apply(0)(e)},'הכל לחיפוש המקורי (0%)'),
    el('button',{type:'button',class:'ghost',disabled:!!error,onclick:e=>apply(100)(e)},'הכל ל־Semantix (100%)'),
    current!==null&&!error?el('button',{type:'button',class:'ghost',onclick:apply(null)},'הסר חלוקה'):''),
   reportBox);
 };
 // The measured result of the split: one column per group, the rates that matter and whether the gap is beyond noise.
 const reportResult=el('div',{}),reportBox=el('div',{class:'tk-report'});
 const drawReport=async days=>{
  reportResult.replaceChildren(el('p',{class:'meta'},'טוען מדידה…'));
  let r;try{r=await api(base+'/rollout/report?days='+days);}catch(err){reportResult.replaceChildren(el('p',{class:'error'},err.message));return;}
  const n=v=>v==null?'—':Number(v).toLocaleString('he-IL'),pct=v=>v==null?'—':(v*100).toFixed(2)+'%',money=v=>v==null?'—':Number(v).toLocaleString('he-IL',{maximumFractionDigits:0})+(r.currency?' '+r.currency:'');
  const lift=l=>!l||l.lift==null?'—':`${l.lift>=0?'+':''}${(l.lift*100).toFixed(1)}% · ${l.significant?'מובהק':'עדיין לא מובהק'}`;
  const rows=[
   ['גולשים בקבוצה',n(r.semantix.visitors),n(r.native.visitors),''],
   ['גולשים שחיפשו',n(r.semantix.searchers),n(r.native.searchers),''],
   ['חיפושים',n(r.semantix.searches),n(r.native.searches),''],
   ['מחפשים שלחצו על מוצר',pct(r.semantix.searchClickRate),pct(r.native.searchClickRate),lift(r.lift.searchClickRate)],
   ['מחפשים שהוסיפו לסל',pct(r.semantix.searchCartRate),pct(r.native.searchCartRate),lift(r.lift.searchCartRate)],
   ['הוספה לסל שאושרה על ידי החנות',pct(r.semantix.searchConfirmedCartRate),pct(r.native.searchConfirmedCartRate),lift(r.lift.searchConfirmedCartRate)],
   ['מחפשים שרכשו (המרה מחיפוש)',pct(r.semantix.searchConversion),pct(r.native.searchConversion),lift(r.lift.searchConversion)],
   ['כל הגולשים שרכשו',pct(r.semantix.conversion),pct(r.native.conversion),lift(r.lift.conversion)],
   ['הזמנות',n(r.semantix.orders),n(r.native.orders),''],
   ['הזמנות שמקורן בחיפוש (לפי מזהה חיפוש)',n(r.semantix.attributedOrders),n(r.native.attributedOrders),''],
   ['הכנסות',money(r.semantix.revenue),money(r.native.revenue),''],
   ['הכנסה לגולש',money(r.semantix.revenuePerVisitor),money(r.native.revenuePerVisitor),''],
   ['הזמנה ממוצעת',money(r.semantix.averageOrder),money(r.native.averageOrder),'']];
  const missing=Object.entries(r.sources||{}).filter(([,v])=>v.status!=='ok').map(([k])=>k);
  const WHY={'no-verified-orders':'אין עדיין הזמנות מאומתות','split-mismatch':`החלוקה בפועל (${pct(r.quality?.split?.share)}) לא תואמת את ההגדרה (${pct(r.quality?.split?.expectedShare)})`,'split-changed-in-window':'החלוקה השתנתה בתוך התקופה','group-conflicts':`${n(r.quality?.conflicts)} גולשים נראו בשתי הקבוצות`};
  const caution=r.quality&&!r.quality.attributable?el('p',{class:'error'},'אי אפשר עדיין לייחס הבדל בהמרה לחיפוש: '+r.quality.reasons.map(x=>WHY[x]||x).join(' · ')):null;
  reportResult.replaceChildren(
   ...(caution?[caution]:[]),
   el('table',{class:'tk-table tk-compare'},el('thead',{},el('tr',{},el('th',{},`${r.days} הימים האחרונים`),el('th',{},'Semantix'),el('th',{},'חיפוש מקורי'),el('th',{},'הפרש'))),
    el('tbody',{},...rows.map(([label,a,b,d])=>el('tr',{},el('th',{},label),el('td',{},a),el('td',{},b),el('td',{},d))))),
   el('p',{class:'meta'},`מחוץ לקבוצות (גולשים בלי שיוך): ${n(r.unknown.searches)} חיפושים${r.unknown.noSession?` (מתוכם ${n(r.unknown.noSession)} בלי מזהה גולש)`:''} · ${n(r.unknown.orders)} הזמנות · ${money(r.unknown.revenue)}.${missing.length?' מקורות שלא נקראו: '+missing.join(', ')+'.':''} "מובהק" = הפער גדול ממה שמקרה מסביר (95%).`));
 };
 reportBox.append(el('div',{class:'row'},...[7,14,30].map(d=>el('button',{type:'button',class:'ghost',onclick:guarded(()=>drawReport(d))},`מדידה: ${d} ימים`))),reportResult);
 drawRollout();

 // The demo configuration as an installable Shopify extension (no CDN release or production configuration involved).
 const keyInput=el('input',{dir:'ltr',placeholder:'ריק = המפתח של החנות מהדאשבורד',spellcheck:'false',autocomplete:'off'});
 const exportCard=t.platform==='shopify'?el('section',{class:'tk-card tk-wide'},el('h4',{},'ייצוא ל־Shopify'),
  el('p',{class:'meta'},'Theme App Extension (App embed) עם תצורת הדמו והמנוע בפנים: הצעות החיפוש ודף התוצאות כפי שהם בהדגמה. מעתיקים את התיקייה לפרויקט אפליקציית Shopify ומריצים shopify app deploy. שינוי בתצורה = ייצוא מחדש. מפתח האתר נלקח מהמשתמש של החנות בדאשבורד; אם החנות עוד לא מחוברת, מזינים אותו בהגדרות ה־App embed.'),
  el('div',{class:'tk-fields'},field('מפתח אתר',keyInput)),
  el('div',{class:'row'},el('button',{type:'button',class:'primary',disabled:!t.ready,onclick:guarded(async()=>{
   const blob=await download(base+'/shopify-extension',{apiKey:keyInput.value.trim()}),url=URL.createObjectURL(blob);
   el('a',{href:url,download:`semantix-shopify-${new URL(project.url).hostname.replace(/^www\./,'')}.zip`}).click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  })},'הורד ZIP'),t.ready?'':el('span',{class:'meta'},'הזיהוי לא הושלם — אי אפשר לייצא.')),
  el('div',{id:'tk-shopify-app'}))
  :t.platform==='woocommerce'?el('section',{class:'tk-card tk-wide'},el('h4',{},'ייצוא ל־WooCommerce'),
  el('p',{class:'meta'},'תוסף WordPress עם תצורת הדמו והמנוע בפנים: מעלים את ה־ZIP בוורדפרס ומפעילים. שינויים בתצורה וחלוקת A/B מגיעים לאתר מהשרת, בלי ZIP חדש. מפתח האתר נלקח מהמשתמש של החנות בדאשבורד.'),
  el('div',{class:'tk-fields'},field('מפתח אתר',keyInput)),
  el('div',{class:'row'},el('button',{type:'button',class:'primary',disabled:!t.ready,onclick:guarded(async()=>{
   const blob=await download(base+'/woo-plugin',{apiKey:keyInput.value.trim()}),url=URL.createObjectURL(blob);
   el('a',{href:url,download:`semantix-woocommerce-${new URL(project.url).hostname.replace(/^www\./,'')}.zip`}).click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  })},'הורד תוסף WordPress'))):'';
 // The client's own Shopify app: one click writes the export into the apps folder, creates the app the first time
 // (in the chosen organization) and deploys a new version. Installing on the store stays the merchant's click.
 const drawApp=async()=>{
  const box=exportCard&&exportCard.querySelector('#tk-shopify-app');if(!box)return;
  let st;try{st=await api(base+'/shopify-app');}catch(err){box.replaceChildren(el('p',{class:'error'},err.message));return;}
  const linked=!!st.app.clientId,last=st.published;
  const name=el('input',{value:st.app.name||'semantix-'+st.app.dir.split('/').pop(),maxlength:30,disabled:linked,'aria-label':'שם האפליקציה'});
  const org=el('select',{'aria-label':'ארגון Shopify',disabled:linked},el('option',{value:st.organizationId||''},st.organizationId?'ארגון '+st.organizationId:'טוען ארגונים…'));
  if(!linked)api('/shopify/organizations').then(r=>org.replaceChildren(...r.organizations.map(o=>el('option',{value:o.id,selected:o.id===st.organizationId||(!st.organizationId&&o.name==='Semantix')},`${o.name} (${o.id})`)))).catch(err=>org.replaceChildren(el('option',{value:''},'שגיאה: '+err.message.slice(0,80))));
  const go=el('button',{type:'button',class:'primary',disabled:!t.ready,onclick:guarded(async()=>{
   if(!linked&&!confirm(`ליצור אפליקציית Shopify חדשה "${name.value}" בארגון ${org.selectedOptions[0]?.textContent||''} ולפרוס אליה את ההרחבה?`))return;
   const done=await streamInto(box,base+'/shopify-publish',{organizationId:org.value,appName:name.value,apiKey:keyInput.value.trim()});
   if(done?.result)toast(`נפרסה גרסה ${done.result.version}`);drawApp();
  })},linked?'פרוס גרסה חדשה ל־Shopify':'צור אפליקציה ופרוס ל־Shopify');
  box.replaceChildren(el('h4',{},'אפליקציית Shopify של הלקוח'),
   el('p',{class:'meta'},linked?`מקושרת: ${st.app.name||''} · client_id ${st.app.clientId} · `:'עוד לא נוצרה. ',code(st.app.dir)),
   last?el('p',{class:'meta'},`פריסה אחרונה: ${last.version} · ${new Date(last.deployedAt).toLocaleString('he-IL')} · מפתח אתר: ${last.siteKey==='included'?'בפנים':'להזין ב־App embed'}`):'',
   linked?'':el('div',{class:'tk-fields'},field('שם האפליקציה',name),field('ארגון',org)),
   el('div',{class:'row'},go,el('span',{class:'meta'},'דורש Shopify CLI מחובר במחשב הזה (shopify auth login). ההתקנה בחנות: Partners ← Distribution ← קישור התקנה.')),
   el('div',{id:'tk-shopify-feed'}));
  drawFeed(box.querySelector('#tk-shopify-feed'),st);
 };
 // Daily product feed through the client's app: needs a public studio (STUDIO_PUBLIC_URL), the app's credentials on
 // that studio (STUDIO_SHOPIFY_APPS) and the merchant opening the app once.
 const drawFeed=async(box,app)=>{
  let f;try{f=await api('/projects/'+id+'/shopify-feed');}catch(err){box.replaceChildren(el('p',{class:'error'},err.message));return;}
  const step=(ok,text)=>el('li',{class:ok?'ok':'bad'},(ok?'✓ ':'✗ ')+text);
  const last=f.feed?.last,when=v=>new Date(v).toLocaleString('he-IL');
  const toggle=el('input',{type:'checkbox',checked:f.feed?.enabled===true,disabled:!f.install,onchange:guarded(async()=>{await api('/projects/'+id+'/shopify-feed',{enabled:toggle.checked});drawFeed(box,app);})});
  box.replaceChildren(el('h4',{},'עדכון פיד יומי מ־Shopify'),
   el('p',{class:'meta'},'מחירים, מחיר לפני הנחה, מלאי, תמונות, מוצרים חדשים ומוצרים שירדו — בלי עיבוד מחדש ובלי גרסת חיפוש חדשה. העדכון עובר למודול החיפוש ולמסד המוצרים של החנות.'),
   el('ul',{class:'tk-warnings'},
    step(!!f.publicUrl,f.publicUrl?'כתובת ציבורית של הסטודיו: '+f.publicUrl:'לא הוגדרה כתובת ציבורית לסטודיו (STUDIO_PUBLIC_URL) — Shopify לא יכול להגיע אליו'),
    step(app.published?.productSync===true,app.published?.productSync?'האפליקציה נפרסה עם הרשאת קריאת מוצרים':'האפליקציה עוד לא נפרסה עם הרשאת קריאת מוצרים — פרסו גרסה חדשה אחרי הגדרת הכתובת'),
    step(f.credentials||!!f.install,f.credentials||f.install?'פרטי האפליקציה מוגדרים בסטודיו הציבורי':'פרטי האפליקציה (client id + secret) צריכים להיות מוגדרים בסטודיו הציבורי (STUDIO_SHOPIFY_APPS ב־Render) — אי אפשר לבדוק את זה מכאן'),
    step(!!f.install,f.install?`מותקנת בחנות ${f.install.shop} מאז ${when(f.install.installedAt)}`:'הסוחר עוד לא פתח את האפליקציה אחרי ההתקנה')),
   f.install?el('p',{class:'meta'},f.pixel?`מדידת רכישות (Web Pixel) פעילה מאז ${when(f.pixel.at)}.`:'מדידת רכישות (Web Pixel) עוד לא פעילה בחנות — מופעלת אוטומטית כשיש לחנות מפתח אתר והתקנה עם הרשאת פיקסל. ',
    f.pixel?'':el('button',{type:'button',class:'link',onclick:guarded(async()=>{await api('/projects/'+id+'/shopify-pixel',{});toast('מדידת הרכישות הופעלה');drawFeed(box,app);})},'הפעל עכשיו')):'',
   f.install?el('label',{class:'tk-check'},toggle,el('span',{},el('b',{},'עדכון אוטומטי פעם ביום'),f.feed?.enabled&&f.feed.nextAt?el('small',{class:'meta'},'העדכון הבא: '+when(f.feed.nextAt)):'')):'',
   last?el('p',{class:'meta'},last.error?`ניסיון אחרון (${when(last.at)}) נכשל: ${last.error}`:`עדכון אחרון ${when(last.at)}: ${last.fetched} מוצרים נקראו · ${last.updated} עודכנו · ${last.added} חדשים · ${last.removed} ירדו${last.dashboardError?' · מסד המוצרים לא עודכן: '+last.dashboardError:''}`):'',
   f.install?el('div',{class:'row'},el('button',{type:'button',class:'ghost',onclick:guarded(async()=>{const done=await streamInto(box,'/projects/'+id+'/shopify-feed/run',{});if(done?.result)toast(`הפיד עודכן: ${done.result.updated} עודכנו, ${done.result.added} חדשים`);drawFeed(box,app);})},'עדכן עכשיו')):'');
 };

 drawApp();
 root.replaceChildren(el('div',{class:'tk'},el('div',{class:'tk-grid'},overview,exportCard,rolloutCard)));
}
