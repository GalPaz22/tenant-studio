// Prospect workspace: stores found, their search audits, and where each lead stands.
const STAGES={new:'חדש',todo:'לפנות',contacted:'נשלחה פנייה',replied:'ענה',demo:'דמו',won:'לקוח',lost:'לא רלוונטי'};
const KIND={head:'מחלקה',product:'מוצר',brand:'מותג',typo:'שגיאת הקלדה',layout:'מקלדת באנגלית',prefix:'תחילית',translit:'תעתיק',synonym:'מילה נרדפת',natural:'שפה חופשית'};
const STATUS={unmeasurable:'לא נמדד',blocked:'חסום',unreachable:'לא זמין',error:'שגיאה',client:'לקוח קיים'};
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=async(path,opts={})=>{const r=await fetch(path,{headers:{'Content-Type':'application/json'},...opts,body:opts.body&&JSON.stringify(opts.body)});const d=await r.json();if(!r.ok)throw Error(d.error||r.status);return d;};
const pref=(k,v)=>{try{if(v===undefined)return localStorage.getItem('prospects.'+k);localStorage.setItem('prospects.'+k,v);}catch{return null;}};

let stores=[],selected=null,sort={key:'rank',dir:1},lastFinished=null;

function scoreBadge(a){
 if(!a)return '<span class="score s-none">לא נבדק</span>';
 if(a.status!=='audited')return `<span class="score s-none" title="${esc(a.note)}">${STATUS[a.status]||a.status}</span>`;
 const cls=a.confidence==='low'?'s-none':a.score>=80?'s-good':a.score>=60?'s-mid':'s-bad';
 return `<span class="score ${cls}" title="${a.confidence==='low'?'ביטחון נמוך: כנראה הדף לא נקרא נכון':''}">${a.score}${a.confidence==='low'?'?':''}</span>${a.lead?'<span class="lead">ליד</span>':''}`;
}
function filtered(){
 const q=$('q').value.trim().toLowerCase(),src=$('source').value,st=$('status').value,stage=$('stageFilter').value,plat=$('platform').value;
 return stores.filter(s=>{
  if(!$('showExcluded').checked&&s.excluded)return false;
  if(q&&!`${s.host} ${s.title||''} ${s.platform||''} ${s.providers.join(' ')}`.toLowerCase().includes(q))return false;
  if(src&&s.source!==src)return false;
  if(stage&&s.stage!==stage)return false;
  if(plat&&s.platform!==plat)return false;
  if($('hideVendor').checked&&s.providers.length)return false;
  const a=s.audit;
  if(st==='none'&&a)return false;
  if(st==='lead'&&!a?.lead)return false;
  if(st==='scored'&&a?.status!=='audited')return false;
  if(st==='unmeasured'&&(!a||a.status==='audited'))return false;
  return true;
 }).sort((x,y)=>{
  const v=s=>sort.key==='score'?(s.audit?.status==='audited'?s.audit.score:999):(s.rank||1e9);
  return (v(x)-v(y))*sort.dir||(x.productUrls?-x.productUrls:0)-(y.productUrls?-y.productUrls:0);
 });
}
function render(){
 const list=filtered();
 $('rows').innerHTML=list.map(s=>`<tr class="row${s.host===selected?' active':''}${s.excluded?' excluded':''}" data-host="${esc(s.host)}">
  <td class="num">${s.rank?s.rank.toLocaleString('he-IL'):s.productUrls?`<span title="דפי מוצר באינדקס">${s.productUrls} דפים</span>`:'—'}</td>
  <td class="name"><b>${esc(s.title||s.host)}</b><span>${esc(s.host)}</span></td>
  <td>${s.platform?`<span class="tag">${esc(s.platform)}</span>`:''}${s.providers.map(p=>`<span class="tag vendor">${esc(p)}</span>`).join('')}</td>
  <td>${s.state==='running'?'<span class="state">בודק…</span>':s.state==='queued'?'<span class="state">בתור</span>':scoreBadge(s.audit)}</td>
  <td><select class="stage" data-stage="${esc(s.host)}">${Object.entries(STAGES).map(([k,v])=>`<option value="${k}"${s.stage===k?' selected':''}>${v}</option>`).join('')}</select></td>
  <td><button class="btn small" data-audit="${esc(s.host)}"${s.state?' disabled':''}>${s.audit?'בדוק שוב':'בדוק'}</button></td>
 </tr>`).join('');
 $('empty').hidden=list.length>0;
 const audited=stores.filter(s=>s.audit?.status==='audited');
 $('stats').innerHTML=[['חנויות',stores.filter(s=>!s.excluded).length],['נבדקו',stores.filter(s=>s.audit).length],['נמדדו',audited.length],['לידים',stores.filter(s=>s.audit?.lead&&!s.excluded).length],['בתהליך',stores.filter(s=>['contacted','replied','demo'].includes(s.stage)).length],['בתצוגה',list.length]]
  .map(([k,v])=>`<span class="stat">${k} <b>${v.toLocaleString('he-IL')}</b></span>`).join('');
 document.querySelectorAll('th.sort').forEach(th=>th.textContent=th.textContent.replace(/ [▲▼]$/,'')+(th.dataset.sort===sort.key?(sort.dir>0?' ▲':' ▼'):''));
}

async function load(){
 const d=await api('/api/stores');stores=d.stores;
 const plats=[...new Set(stores.map(s=>s.platform).filter(Boolean))].sort();
 const cur=$('platform').value;$('platform').innerHTML='<option value="">כל הפלטפורמות</option>'+plats.map(p=>`<option${p===cur?' selected':''}>${esc(p)}</option>`).join('');
 render();if(selected)openPanel(selected,false);
}
async function pollQueue(){
 try{
  const q=await api('/api/queue'),busy=q.running.length+q.queued.length;
  $('queue').innerHTML=busy?`<span class="dot"></span> בודק ${q.running.length} · בתור ${q.queued.length} <button class="btn small" id="stopQueue">עצור תור</button>`:'';
  if(lastFinished!==null&&q.finished!==lastFinished)await load();
  else{const states=new Map([...q.running.map(h=>[h,'running']),...q.queued.map(h=>[h,'queued'])]);let changed=false;for(const s of stores){const n=states.get(s.host)||null;if(s.state!==n){s.state=n;changed=true;}}if(changed)render();}
  lastFinished=q.finished;setTimeout(pollQueue,busy?3000:8000);
 }catch{setTimeout(pollQueue,8000);}
}
async function enqueue(hosts){if(!hosts.length)return;await api('/api/queue',{method:'POST',body:{hosts}});for(const s of stores)if(hosts.includes(s.host))s.state='queued';render();}

async function openPanel(host,scroll=true){
 selected=host;render();
 const s=stores.find(x=>x.host===host);if(!s)return;
 $('main').classList.add('open');
 let a=null;if(s.audit)try{a=await api('/api/audit/'+encodeURIComponent(host));}catch{}
 const link=q=>(a?.shopperUrl||a?.searchUrl||'').replace('{q}',encodeURIComponent(q));
 const c=a?.contacts;
 $('panel').innerHTML=`<button class="close" id="closePanel" aria-label="סגור">×</button>
 <h2>${esc(s.title||host)}</h2>
 <div class="meta"><a href="https://${esc(host)}" target="_blank" rel="noopener">${esc(host)} ↗</a>${s.rank?`· דירוג תנועה ${s.rank.toLocaleString('he-IL')}`:''}${s.platform?`· ${esc(s.platform)}`:''}${s.providers.length?`· ספק חיפוש: ${esc(s.providers.join(', '))}`:''}</div>
 <div class="row-actions">
  <button class="btn primary" data-audit="${esc(host)}"${s.state?' disabled':''}>${s.state==='running'?'בודק…':s.state==='queued'?'בתור':s.audit?'בדוק שוב':'הרץ בדיקת חיפוש'}</button>
  <button class="btn" id="toggleExclude">${s.excluded?'החזר לרשימה':'לא חנות / להחריג'}</button>
 </div>
 <h3>מעקב</h3>
 <select class="stage" data-stage="${esc(host)}">${Object.entries(STAGES).map(([k,v])=>`<option value="${k}"${s.stage===k?' selected':''}>${v}</option>`).join('')}</select><span class="saved" id="saved"></span>
 <textarea id="notes" placeholder="הערות: עם מי דיברת, מה סוכם, מתי לחזור">${esc(s.notes)}</textarea>
 ${a?auditHtml(a,link,c):'<h3>בדיקת חיפוש</h3><p class="meta">עוד לא נבדק. הבדיקה מריצה כ־20 חיפושים באתר (כדקה וחצי).</p>'}`;
 $('closePanel').onclick=()=>{selected=null;$('main').classList.remove('open');render();};
 $('toggleExclude').onclick=async()=>{await savePipeline(host,{excluded:!s.excluded});openPanel(host,false);};
 $('notes').onblur=e=>{if(e.target.value!==s.notes)savePipeline(host,{notes:e.target.value});};
 if(scroll)$('panel').scrollTop=0;
}
function auditHtml(a,link,c){
 const when=new Date(a.auditedAt).toLocaleString('he-IL',{dateStyle:'short',timeStyle:'short'});
 if(a.status!=='audited')return `<h3>בדיקת חיפוש · ${when}</h3><div class="note">${esc(STATUS[a.status]||a.status)}: ${esc(a.note)}</div>`;
 const contacts=c?[...(c.emails||[]).map(e=>`<a href="mailto:${esc(e)}">${esc(e)}</a>`),...(c.phones||[]).map(p=>`<a href="tel:${esc(p)}">${esc(p)}</a>`),...(c.whatsapp||[]).map(w=>`<a href="https://wa.me/${esc(w.replace(/^0/,'972').replace(/\D/g,''))}" target="_blank" rel="noopener">וואטסאפ ${esc(w)}</a>`),...Object.entries(c.social||{}).map(([k,v])=>`<a href="${esc(v)}" target="_blank" rel="noopener">${k}</a>`),c.companyId?`<span class="tag">ח.פ. ${esc(c.companyId)}</span>`:''].filter(Boolean).join(''):'';
 return `<h3>בדיקת חיפוש · ${when}</h3>
 <div class="meta">${scoreBadge({...a})}&nbsp; ${a.zeroRate}% מהחיפושים בלי תוצאות · נמדד דרך ${a.measuredVia==='api'?'ה־API של החנות':'דף התוצאות'}</div>
 ${a.confidence==='low'?'<div class="note" style="margin-top:8px">ביטחון נמוך: כל החיפושים החזירו 0 או שהאתר משתמש בספק חיפוש חיצוני. כדאי לבדוק ידנית לפני פנייה.</div>':''}
 ${contacts?`<h3>פרטי קשר (מהאתר)</h3><div class="contacts">${contacts}</div>`:a.lead?'<h3>פרטי קשר</h3><p class="meta">לא נמצאו באתר</p>':''}
 ${a.fixes?.length?`<h3>מה לתקן</h3>${a.fixes.map(f=>`<div class="fix"><b>${esc(f.label)}</b>${esc(f.fix)}<div class="ex">לדוגמה: ${f.examples.map(q=>`<a href="${esc(link(q))}" target="_blank" rel="noopener">"${esc(q)}"</a>`).join(', ')}</div></div>`).join('')}`:''}
 <h3>החיפושים שנבדקו (${a.results.length})</h3>
 ${a.results.map(r=>`<div class="q"><span class="mark ${r.pass===null?'na':r.pass?'ok':'no'}">${r.pass===null?'–':r.pass?'✓':'✗'}</span>
  <div><a href="${esc(link(r.q))}" target="_blank" rel="noopener">${esc(r.q)}</a> <small>${KIND[r.kind]||r.kind}${r.of?` · במקום "${esc(r.of)}"`:''}${r.pass===false&&r.reason?` · ${esc(r.reason)}`:''}</small></div>
  <span class="num">${r.measurable?r.count:'—'}</span>
  ${r.titles?.length?`<div class="res">${esc(r.titles.slice(0,3).join(' · '))}</div>`:''}</div>`).join('')}`;
}
async function savePipeline(host,patch){
 const p=await api('/api/pipeline/'+encodeURIComponent(host),{method:'PATCH',body:patch});
 const s=stores.find(x=>x.host===host);if(s)Object.assign(s,{stage:p.stage||'new',notes:p.notes||'',excluded:!!p.excluded});
 render();const el=$('saved');if(el){el.textContent='נשמר';setTimeout(()=>{if($('saved'))$('saved').textContent='';},1500);}
}
function exportCsv(){
 const cell=v=>{const s=String(v??'');return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
 const rows=[['host','title','traffic_rank','platform','search_vendor','score','lead','stage','notes']].concat(filtered().map(s=>[s.host,s.title,s.rank,s.platform,s.providers.join(' '),s.audit?.status==='audited'?s.audit.score:s.audit?.status||'',s.audit?.lead?'yes':'',STAGES[s.stage],s.notes]));
 const url=URL.createObjectURL(new Blob(['﻿'+rows.map(r=>r.map(cell).join(',')).join('\n')],{type:'text/csv'}));
 const a=document.createElement('a');a.href=url;a.download='leads.csv';a.click();URL.revokeObjectURL(url);
}

// ---------- wiring ----------
$('stageFilter').innerHTML+=Object.entries(STAGES).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');
for(const id of ['q','source','status','stageFilter','platform','hideVendor','showExcluded']){
 const el=$(id),saved=pref(id);if(saved!==null){if(el.type==='checkbox')el.checked=saved==='1';else el.value=saved;}
 el.addEventListener(el.type==='search'?'input':'change',()=>{pref(id,el.type==='checkbox'?(el.checked?'1':'0'):el.value);render();});
}
document.addEventListener('click',e=>{
 const t=e.target;
 if(t.id==='stopQueue'){api('/api/queue',{method:'DELETE'}).then(load);return;}
 if(t.dataset.audit){e.stopPropagation();enqueue([t.dataset.audit]);if(selected===t.dataset.audit)setTimeout(()=>openPanel(selected,false),50);return;}
 if(t.closest('select'))return;
 const th=t.closest('th.sort');if(th){sort=sort.key===th.dataset.sort?{key:sort.key,dir:-sort.dir}:{key:th.dataset.sort,dir:1};render();return;}
 const row=t.closest('tr.row');if(row)openPanel(row.dataset.host);
});
document.addEventListener('change',e=>{if(e.target.dataset.stage)savePipeline(e.target.dataset.stage,{stage:e.target.value});});
$('auditNext').onclick=()=>enqueue(filtered().filter(s=>!s.audit&&!s.state&&!s.excluded).slice(0,20).map(s=>s.host));
$('export').onclick=exportCsv;
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&selected){selected=null;$('main').classList.remove('open');render();}});
load().then(pollQueue);
