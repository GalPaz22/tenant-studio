import {buildIssues,describeIssue} from './build-issues.js';
const $=id=>document.getElementById(id);
const n=(tag,text,cls)=>{const el=document.createElement(tag);el.textContent=text??'';if(cls)el.className=cls;return el};
const link=(label,url)=>{const el=n('a',label);try{const u=new URL(url);if(['https:','http:'].includes(u.protocol)){el.href=u.href;el.target='_blank';el.rel='noreferrer';}}catch{}return el;};
const state={queued:'ממתינה לביצוע',running:'בבנייה',paused:'נעצרה — ההתקדמות נשמרה',partial:'נדרש טיפול בחוסרים',failed:'הבנייה נכשלה',ready:'מוכנה לבדיקה',activated:'גרסה פעילה מקומית',cancelled:'בוטלה'};
const decision={matched:'מתאים',not_matched:'אינו מתאים',unknown:'אין מספיק מידע',conflict:'סתירה בין מקורות',failed:'הסיווג נכשל'};
const labels={products:'מוצרים',variants:'וריאציות',withSpecs:'עם מפרטים',withDescription:'עם תיאור',externalFacts:'עובדות חיצוניות מאומתות',taggedProducts:'מוצרים שתויגו',cards:'כרטיסים',indexed:'באינדקס',vectors:'וקטורים',added:'חדשים',updated:'עודכנו',reusedProducts:'העשרה מהמטמון',absentFromSource:'אינם במקור החדש'};
export function createBuildView({api,getProject,refresh,error,openRepair}) {
  const pendingRepairs=new Set();
  let selectedId,settingsRun,catalogBuild,catalogOffset=null,request=0,catalogRunId=null;
  const action=async(button,fn)=>{button.disabled=true;try{await fn()}catch(e){error(e)}finally{button.disabled=false;}};
  function limits(){return {maxFetches:Number($('build-fetch-budget').value),maxModelCalls:Number($('build-model-budget').value),maxMinutes:Number($('build-time-budget').value)};}
  function options(project){if(selectedId!==project.id)return {sourceType:['woocommerce','shopify'].includes(project.platform)?'platform':'sitemap',sitemapUrl:new URL('/sitemap.xml',project.url).href};const sourceType=$('build-source').value;return {sourceType,...limits(),feedUrl:sourceType==='feed'?$('build-source-url').value:'',sitemapUrl:sourceType==='sitemap'?$('build-source-url').value||new URL('/sitemap.xml',project.url).href:'',sourceUrls:$('build-sources').value.split('\n').map(u=>u.trim()).filter(Boolean),research:$('build-research').checked,productResearch:$('build-product-research').checked,scanPages:$('build-scan').checked,authoritative:$('build-authoritative').checked,merchantFacts:$('build-merchant-facts').checked,vectors:$('build-vectors').checked,indexTarget:$('build-index').value};}
  async function control(actionName,stage){const p=getProject();await api('/projects/'+p.id+'/build/control',{action:actionName,stage,limits:limits()});await refresh();}
  $('pause-build').onclick=e=>action(e.target,()=>control('pause'));
  $('cancel-build').onclick=e=>action(e.target,()=>control('cancel'));
  $('resume-build').onclick=e=>action(e.target,()=>control('resume'));
  $('activate-build').onclick=e=>action(e.target,async()=>{const p=getProject();await api('/projects/'+p.id+'/activate',{runId:p.latestBuildId});await refresh();});
  $('previous-build').onclick=e=>action(e.target,async()=>{const p=getProject();await api('/projects/'+p.id+'/activate',{runId:p.previousActiveBuildId});await refresh();});
  $('save-sync').onclick=e=>action(e.target,async()=>{const p=getProject();await api('/projects/'+p.id+'/sync',{enabled:$('sync-enabled').checked,autoActivate:$('sync-activate').checked,intervalMinutes:Number($('sync-interval').value)});await refresh();});
  $('product-close').onclick=()=>$('product-dialog').close();
  async function detail(id){const projectId=getProject().id,p=await api('/projects/'+projectId+'/products/'+encodeURIComponent(id)+(catalogRunId?'?runId='+catalogRunId:''));if(getProject()?.id!==projectId)return;
    const root=$('product-detail');root.replaceChildren(n('h2',p.title),link('עמוד המוצר',p.url),n('p',p.summary));if(p.enrichmentStatus==='pending')root.append(n('p','מידע מיובא מהמקור. שלבי ההעשרה והסיווג עדיין לא הושלמו.','hint'));
    const stock={instock:'במלאי',outofstock:'אזל המלאי',unknown:'מצב מלאי לא התקבל'};
    const meta=n('p',`מזהה ${p.id} · SKU ${p.sku||'—'} · דגם ${p.model||'לא זוהה'} · ${stock[p.stockStatus]||'מצב מלאי לא התקבל'} · ${p.price??'—'} ${p.currency||''}`);root.append(meta);
    root.append(n('h3','מפרטים'));const table=n('table','','spec-table');for(const [key,value] of Object.entries(p.specifications||{})){const row=n('tr');row.append(n('th',key),n('td',String(value)));table.append(row);}root.append(table);
    if(p.variants?.length){const section=n('details');section.append(n('summary',p.variants.length+' וריאציות'));const table=n('table','','spec-table');for(const v of p.variants){const row=n('tr');row.append(n('td',v.title||v.sku||v.id),n('td',String(v.price??'לא התקבל מחיר')),n('td',v.stockStatus==='instock'?'במלאי':v.stockStatus==='outofstock'?'אזל':'המלאי לא התקבל'),n('td',v.detailStatus?'פרטים חלקיים מהמקור':''));table.append(row);}section.append(table);root.append(section);}
    if(p.issues?.length){root.append(n('h3','מידע המחייב בדיקה'));const issueLabels={'source-sale-conflict':'באדג׳ המבצע אינו תואם למחיר שהתקבל','source-stock-conflict':'באדג׳ המלאי אינו תואם למלאי שהתקבל','ambiguous-product-type':'המוצר תואם לכמה סוגי מוצרים; הסוג טרם הוכרע'};for(const issue of p.issues)root.append(n('p',issueLabels[issue]||issue,'failure'));}
    root.append(n('h3','תגיות והסיבה לסיווג'));for(const d of p.tagDecisions||[]){const block=n('article','','evidence');block.append(n('strong',d.tag+' · '+(decision[d.status]||d.status)),n('p',d.quote||d.error||'אין ראיה מספקת'),link('מקור הסיווג',d.sourceUrl));root.append(block);}
    if(!p.tagDecisions?.length)root.append(n('p',getProject().buildRun?.stages.find(s=>s.key==='tags')?.status!=='completed'?'סיווג התגיות טרם הושלם.':'לא הוגדרו תגיות לסיווג.'));
    if(p.extractedFacts?.length){root.append(n('h3','מאפיינים שחולצו מתיאור המוצר'));for(const f of p.extractedFacts){const block=n('article','','evidence');block.append(n('strong',f.field+': '+f.value+(f.status==='conflict'?' · סתירה':'')),n('blockquote',f.quote),link('תיאור המקור',f.sourceUrl));if(f.conflictsWith)block.append(n('p','ערך סותר: '+f.conflictsWith));root.append(block);}}
    root.append(n('h3','עובדות ממקורות חיצוניים'));for(const f of p.externalFacts||[]){const block=n('article','','evidence');block.append(n('strong',f.field+': '+f.value+(f.status==='conflict'?' · סתירה':'')),n('blockquote',f.quote),link('מקור חיצוני',f.sourceUrl));if(f.conflictsWith)block.append(n('p','בקטלוג החנות: '+f.conflictsWith));root.append(block);}
    if(!p.externalFacts?.length)root.append(n('p','אין עובדות חיצוניות מאומתות עבור הדגם הזה.'));
    root.append(n('h3','מקורות שנאספו'));for(const ev of p.evidence||[]){const section=n('details');section.append(n('summary',ev.kind+' · '+new Date(ev.observedAt).toLocaleString('he-IL')),link('פתח מקור',ev.sourceUrl),n('blockquote',ev.quote));root.append(section);}
    $('product-dialog').showModal();
  }
  async function catalog(append=false){const p=getProject();if(!p)return;const id=p.id,seq=++request;const offset=append?catalogOffset||0:0;
    catalogRunId=p.existingClient||p.draftBuildId===p.buildRun?.id?null:p.buildRun?.id||null;const response=await api('/projects/'+id+'/products?q='+encodeURIComponent($('catalog-query').value)+'&offset='+offset+'&limit=12'+(catalogRunId?'&runId='+catalogRunId:''));if(getProject()?.id!==id||seq!==request)return;
    $('catalog-total').textContent=response.total+' מוצרים';if(!append)$('catalog-cards').replaceChildren();
    for(const p of response.products){const card=n('article','','card');if(p.image){const img=document.createElement('img');try{const u=new URL(p.image);if(['https:','http:'].includes(u.protocol))img.src=u.href;}catch{}img.alt=p.title;img.loading='lazy';card.append(img);}
      card.append(n('h3',p.title),n('p',p.price===null?'מחיר לא זמין':p.price+' '+(p.currency||'')),n('p',p.summary,'product-summary'));if(p.enrichmentStatus==='pending')card.append(n('p','מיובא · ממתין להשלמת העשרה','hint'));
      for(const d of p.tagDecisions||[])if(d.status==='matched')card.append(n('span',d.tag,'search-tag'));for(const badge of p.badges||[])card.append(n('span',badge.text,'badge'));const button=n('button','כרטיס, מפרטים ומקורות');button.onclick=()=>detail(p.id).catch(error);card.append(button);$('catalog-cards').append(card);}
    if(!response.products.length&&!append)$('catalog-cards').append(n('p','כרטיסי המוצרים יופיעו כאן לאחר שהבנייה תעבור את בדיקות המוכנות.','empty'));
    catalogOffset=response.nextOffset;$('catalog-more').hidden=catalogOffset===null;
  }
  $('catalog-filter').onsubmit=e=>{e.preventDefault();action(e.submitter,()=>catalog());};$('catalog-more').onclick=e=>action(e.target,()=>catalog(true));
  function context(c){const root=$('store-context');root.replaceChildren();if(!c){root.append(n('p','קונטקסט החנות ייבנה כחלק מהריצה.'));return;}
    root.append(n('h3',c.name+' · '+c.domain),n('p',c.summary));
    root.append(n('h3','קטגוריות ומותגים'));root.append(n('p',Object.entries(c.categories||{}).map(([k,v])=>k+' ('+v+')').join(' · ')),n('p',Object.keys(c.brands||{}).join(' · ')));
    if(c.vocabulary?.length){root.append(n('h3','מילון לבחירת מוצרים'));for(const v of c.vocabulary)root.append(n('p',v.term+' — '+v.meaning));}
    root.append(n('p','המילון ושאלות הקנייה הם הנחיות שנגזרו מהמידע; אינם מפרט של מוצר.','hint'));
    if(c.shoppingQuestions?.length){const ul=n('ul');c.shoppingQuestions.forEach(q=>ul.append(n('li',q)));root.append(n('h3','שאלות קנייה'),ul);}
    root.append(n('h3','מידע עסקי ומדיניות עם מקורות'));for(const f of [...(c.businessFacts||[]),...(c.policies||[])])root.append(n('p',(f.field||f.name)+': '+(f.value||f.text)),n('blockquote',f.quote),link('מקור בחנות',f.sourceUrl));
    if(!c.businessFacts?.length&&!c.policies?.length)root.append(n('p','לא נמצאה בעמוד שנקרא ראיה מספקת למדיניות החנות.'));
    const domain=c.domainContext||{};root.append(n('h3','מחקר התחום'));if(domain.claims?.length){for(const claim of domain.claims){root.append(n('p',claim.text));for(const sourceId of claim.sourceIds||[]){const source=(domain.sources||[]).find(s=>s.id===sourceId);if(source)root.append(link(source.title||'מקור',source.url));}}}
    else root.append(n('p',domain.text?'מחקר ללא קישורי ראיות לטענות — אינו מאומת.':'לא בוצע מחקר חיצוני או שלא התקבל מידע מאומת.'));
    if(domain.text){const full=n('details');full.append(n('summary','תוצאת המחקר המלאה'),n('p',domain.text));root.append(full);}
    for(const source of domain.sources||[])root.append(link(source.title||source.url,source.url),n('br'));
  }
  function render(p){const run=p.buildRun;
    if(selectedId!==p.id){selectedId=p.id;settingsRun=null;catalogBuild=null;$('search-active').checked=false;request++;}
    if(settingsRun!==run?.id){settingsRun=run?.id;const o=run?.options||{};$('build-source').value=o.sourceType||(['woocommerce','shopify'].includes(p.platform)?'platform':'sitemap');$('build-source-url').value=o.feedUrl||o.sitemapUrl||'';$('build-sources').value=(o.sourceUrls||[]).join('\n');$('build-index').value=o.indexTarget||'local';$('build-research').checked=o.research!==false;$('build-product-research').checked=!!o.productResearch;$('build-scan').checked=o.scanPages!==false;$('build-vectors').checked=!!o.vectors;$('build-merchant-facts').checked=o.merchantFacts!==false;$('build-authoritative').checked=!!o.authoritative;for(const [id,key,def] of [['build-fetch-budget','maxFetches',10000],['build-model-budget','maxModelCalls',750],['build-time-budget','maxMinutes',120]])$(id).value=o[key]||def;}
    $('build-state').textContent=state[run?.status]||'טרם נבנתה';$('build-message').textContent=run?.message||'סריקה מלאה של המקור, העשרה, תגיות, כרטיסי מוצר וקונטקסט — בריצה אחת.';
    $('build-stages').replaceChildren(...(run?.stages||[]).map((s,i)=>{if(s.key==='validate'&&run.validation?.passed===false||s.key==='tags'&&run.errors?.some(e=>e.stage==='tags'))s={...s,status:'failed'};const item=n('div','','build-stage '+s.status);item.append(n('span',s.status==='completed'?'✓':String(i+1).padStart(2,'0')),n('strong',s.label),n('small',s.total===null?s.done?String(s.done):'':s.done+' / '+s.total));if(s.total){const progress=document.createElement('progress');progress.max=s.total;progress.value=s.done;item.append(progress);}return item;}));
    $('build-metrics').replaceChildren(...Object.entries(run?.metrics||{}).filter(([key])=>labels[key]).map(([key,value])=>{const el=n('div');el.append(n('strong',value),n('span',labels[key]));return el;}));
    const busy=['queued','running'].includes(run?.status);$('build').disabled=busy;$('pause-build').hidden=!busy;$('cancel-build').hidden=!['queued','running','paused'].includes(run?.status);$('resume-build').hidden=!['paused','failed','partial','cancelled'].includes(run?.status);
    $('activate-build').hidden=!p.latestBuildId||p.latestBuildId===p.activeBuildId;$('previous-build').hidden=!p.previousActiveBuildId;$('search-active').disabled=!p.activeBuildId;
    const authorized=$('build-source').querySelector('[value=authorized]');authorized.disabled=!p.connectorAvailable;authorized.textContent=p.connectorAvailable?'חיבור API מורשה — זמין':'חיבור API מורשה — טרם הוגדר';
    $('sync-enabled').checked=!!p.sync?.enabled;$('sync-activate').checked=!!p.sync?.autoActivate;if(document.activeElement!==$('sync-interval'))$('sync-interval').value=p.sync?.intervalMinutes||1440;
    $('sync-status').textContent=p.sync?.enabled?'עדכון הבא: '+new Date(p.sync.nextAt).toLocaleString('he-IL')+' · פועל כל עוד השרת המקומי פעיל.':'עדכונים אוטומטיים כבויים. ניתן להפעיל לאחר בנייה ראשונית; השירות פועל כל עוד השרת המקומי פעיל.';
    $('build-history').replaceChildren(...(p.buildHistory||[]).map(b=>{const el=n('p',new Date(b.at).toLocaleString('he-IL')+' · '+b.products+' מוצרים'+(b.id===p.activeBuildId?' · פעילה':''));if(b.id!==p.activeBuildId){const btn=n('button','הפעל גרסה זו');btn.onclick=()=>action(btn,async()=>{await api('/projects/'+p.id+'/activate',{runId:b.id});await refresh();});el.append(btn);}return el;}));
    const issues=$('build-issues');const expanded=new Set([...issues.querySelectorAll('details[open]')].map(el=>el.dataset.stage));issues.replaceChildren();
    const groups=buildIssues(run).map(i=>describeIssue(i,run)).sort((a,b)=>Number(b.blocking)-Number(a.blocking));
    const repair=run?.repair,repairBusy=pendingRepairs.has(p.id)||['analyzing','executing'].includes(repair?.status);
    $('repair-count').textContent=groups.length?groups.length+' נושאים לטיפול':'אין תקלות מדווחות';
    const progress=$('repair-progress');progress.replaceChildren();progress.hidden=true;
    if(!groups.length)issues.append(n('p',busy?'החנות נבדקת כעת. בעיות שיתגלו יופיעו כאן.':run?.validation?.passed?'בדיקות המוכנות עברו. אם תוצאת חיפוש עדיין אינה נכונה, תאר אותה למטה.':'עדיין אין דוח תקלות מלא. אפשר לתאר למטה בעיה בחיפוש.','repair-empty'));
    if(p.tagging)issues.append(n('p','סיווג מוצרים מתבצע עכשיו. טיפול נוסף יהיה זמין בסיומו.','hint'));
    for(const group of groups){const card=n('article','','issue-card');card.append(n('span',group.blocking?'דורש טיפול לפני הפעלה':'מידע שכדאי להשלים','issue-priority'),n('h3',group.title),n('p',group.impact,'issue-impact'));if(group.amount)card.append(n('p',group.amount,'hint'));card.append(n('p','אפשר לבדוק מוצרים וקטגוריות הקשורים לבעיה ולתקן את כללי החיפוש שלהם. פעולה זו אינה משלימה אוטומטית את דוח הבנייה.','issue-plan'));
      const fix=n('button','טפל בחיפוש באופן ממוקד','primary');fix.disabled=repairBusy||p.tagging||busy;
      fix.onclick=()=>openRepair({label:group.title,stage:group.stage,details:group.details.slice(0,5).map(t=>t.slice(0,600)),mode:'focused-only'});
      const explain=n('button','הוסף הסבר לעוזר','secondary');explain.onclick=()=>openRepair({label:group.title,stage:group.stage,details:group.details.slice(0,5).map(t=>t.slice(0,600))});card.append(fix);
      const details=n('details');details.dataset.stage=group.stage;details.open=expanded.has(group.stage);details.append(n('summary','פרטים טכניים'));for(const text of group.details)details.append(n('p',text,'failure'));card.append(details);issues.append(card);
    }
    const findings=$('build-findings');findings.replaceChildren();if(run?.coverage) findings.append(n('p',`מקור: ${run.coverage.scope} · סיום קריאת המקור: ${run.coverage.sourceComplete?'כן':'טרם הושלם'} · שלמות קטלוג החנות: ${run.coverage.storeCompleteness==='operator-declared'?'הוצהרה על ידי המפעיל':run.coverage.storeCompleteness==='authorized-scope'?'בתחום החיבור המורשה':'לא מוכחת'}`));
    if(run?.usage)findings.append(n('p',`${run.usage.fetches} קריאות מקור · ${run.usage.modelCalls} קריאות מודל · ${Math.ceil(run.usage.elapsedMs/60000)} דקות ביצוע`));
    for(const warning of new Set(run?.warnings||[]))findings.append(n('p',warning,'hint'));for(const failure of (run?.errors||[]).slice(-30))findings.append(n('p',[failure.stage,failure.productId,failure.url,failure.error].filter(Boolean).join(' · '),'failure'));
    $('build-report').textContent=run?JSON.stringify({index:run.index,validation:run.validation,tagDecisions:run.metrics?.tagDecisions},null,2):'';
    context(p.storeContext);const key=p.id+':'+run?.id+':'+p.updatedAt+':'+run?.stages.find(s=>s.key==='normalize')?.status+':'+run?.stages.find(s=>s.key==='cards')?.status;if(catalogBuild!==key){catalogBuild=key;catalog().catch(error);}
  }
  return {options,render};
}
