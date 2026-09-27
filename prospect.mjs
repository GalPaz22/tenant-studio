import 'dotenv/config';
import {mkdir,readFile,writeFile,readdir,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {storesFromIndex,indexPageUrl,auditStore,pageFetcher,bareHost} from './core/prospect.mjs';
import {askProcessing} from './model.mjs';

// Lead finder for Israeli stores with weak on-site search.
//   node prospect.mjs discover [--pages 40] [--crawl CC-MAIN-2026-34] [--domain co.il]   find stores (resumable)
//   node prospect.mjs audit [--limit 20] [--min-products 20] [--threshold 70] [--no-ai] [--force] [domain ...]
//   node prospect.mjs report [--threshold 70]                                              → report.html + leads.csv
// Everything lands in data/prospects/ (git-ignored: it holds business contact details).

const DIR=resolve(process.env.PROSPECT_DIR||'data/prospects'),AUDITS=DIR+'/audits',STORES=DIR+'/stores.json';
const argv=process.argv.slice(2),cmd=argv[0],flags={},rest=[];
for(let i=1;i<argv.length;i++){if(argv[i].startsWith('--')){const k=argv[i].slice(2);flags[k]=argv[i+1]&&!argv[i+1].startsWith('--')?argv[++i]:true;}else rest.push(argv[i]);}
const num=(k,d)=>flags[k]===undefined?d:Number(flags[k]);
const readJson=async(f,d)=>{try{return JSON.parse(await readFile(f,'utf8'));}catch{return d;}};
const saveJson=async(f,v)=>{const t=f+'.tmp';await writeFile(t,JSON.stringify(v,null,1),{mode:0o600});await rename(t,f);};
const safeName=h=>h.replace(/[^a-z0-9.-]/gi,'_');

async function discover(){
 await mkdir(DIR,{recursive:true});
 const state=await readJson(STORES,{index:null,domain:null,pages:null,done:[],stores:{}});
 const domain=flags.domain||state.domain||'co.il';
 let index=flags.crawl||state.index;
 if(!index){const list=await (await fetch('https://index.commoncrawl.org/collinfo.json')).json();index=list[1]?.id||list[0].id;} // the newest one is often still filling
 if(state.index&&state.index!==index||state.domain&&state.domain!==domain){state.done=[];state.pages=null;}
 const api=`https://index.commoncrawl.org/${index}-index`;
 if(!state.pages)state.pages=(await (await fetch(`${api}?url=${domain}&matchType=domain&showNumPages=true`)).json()).pages;
 Object.assign(state,{index,domain});
 const map=new Map(Object.entries(state.stores)),todo=[...Array(state.pages).keys()].filter(p=>!state.done.includes(p)).slice(0,num('pages',state.pages));
 console.log(`${index} · ${domain}: ${state.pages} עמודי אינדקס, ${state.done.length} כבר נסרקו, סורק עכשיו ${todo.length}`);
 for(const page of todo){
  let text=null;
  for(let attempt=0;attempt<3&&text===null;attempt++){
   try{const r=await fetch(indexPageUrl(api,domain,page),{signal:AbortSignal.timeout(120000)});if(r.status===404){text='';break;}if(!r.ok)throw Error('HTTP '+r.status);text=await r.text();}
   catch(e){console.log(`  עמוד ${page}: ${e.message}, מנסה שוב`);await new Promise(r=>setTimeout(r,5000*(attempt+1)));}
  }
  if(text===null)continue;
  storesFromIndex(text,map);state.done.push(page);state.stores=Object.fromEntries(map);await saveJson(STORES,state);
  console.log(`  עמוד ${page+1}/${state.pages}: ${map.size} חנויות עד כה`);
  await new Promise(r=>setTimeout(r,1000));
 }
 const big=[...map.values()].filter(s=>s.productUrls>=20).length;
 console.log(`נמצאו ${map.size} אתרים עם דפי מוצר (${big} עם 20+ דפי מוצר באינדקס). הצעד הבא: node prospect.mjs audit`);
}

async function audit(){
 await mkdir(AUDITS,{recursive:true});
 const done=new Set((await readdir(AUDITS)).map(f=>f.replace(/\.json$/,'')));
 let hosts=rest.map(d=>bareHost(new URL(/^https?:/.test(d)?d:'https://'+d).hostname));
 if(!hosts.length){
  const state=await readJson(STORES,null);if(!state)throw Error('אין רשימת חנויות. הריצו קודם: node prospect.mjs discover');
  hosts=Object.values(state.stores).filter(s=>s.productUrls>=num('min-products',20)&&(flags.force||!done.has(safeName(s.host)))).sort((a,b)=>b.productUrls-a.productUrls).map(s=>s.host);
  hosts=hosts.slice(0,num('limit',20));
 }
 const ask=flags['no-ai']?null:(process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY)?askProcessing:null;
 if(!ask)console.log('בלי מודל: שאילתות מהתפריט ומהקטלוג ושיפוט לפי התאמת מילים (פחות מדויק)');
 const get=pageFetcher(),threshold=num('threshold',70),queue=[...hosts];let n=0;
 const worker=async()=>{for(let host;(host=queue.shift());){
  const started=Date.now();let a;
  let timer;
  try{a=await Promise.race([auditStore(host,{get,ask,threshold,delayMs:num('delay',1500)}),new Promise((_,fail)=>{timer=setTimeout(()=>fail(Error('הבדיקה חרגה מ־6 דקות')),num('store-minutes',6)*60000);})]).finally(()=>clearTimeout(timer));}catch(e){a={host,status:'error',note:e.message,auditedAt:new Date().toISOString()};}
  await saveJson(`${AUDITS}/${safeName(a.host||host)}.json`,a);
  const line=a.status==='audited'?`ציון ${a.score} (${a.grade})${a.confidence==='low'?' · ביטחון נמוך':''}${a.lead?' · ליד':''}${a.providers?.length?' · '+a.providers.join(','):''}`:`${a.status}: ${a.note||''}`;
  console.log(`[${++n}/${hosts.length}] ${host} · ${a.platform||''} · ${line} · ${Math.round((Date.now()-started)/1000)}s`);
 }};
 await Promise.all(Array.from({length:Math.min(num('parallel',3),hosts.length)},worker));
 console.log('הצעד הבא: node prospect.mjs report');
}

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const csvCell=v=>{const s=String(v??'');return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
async function report(){
 const threshold=num('threshold',70),files=(await readdir(AUDITS).catch(()=>[])).filter(f=>f.endsWith('.json'));
 const audits=(await Promise.all(files.map(f=>readJson(`${AUDITS}/${f}`,null)))).filter(Boolean);
 for(const a of audits)if(a.status==='audited')a.lead=a.score<threshold&&a.confidence!=='low';
 const scored=audits.filter(a=>a.status==='audited').sort((a,b)=>b.lead-a.lead||a.score-b.score),other=audits.filter(a=>a.status!=='audited');
 const leads=scored.filter(a=>a.lead);
 const rows=[['host','title','platform','search_vendor','score','grade','zero_results_%','top_fixes','emails','phones','whatsapp','company_id','facebook','instagram','linkedin','audited_at']];
 for(const a of leads){const c=a.contacts||{};rows.push([a.host,a.title,a.platform,(a.providers||[]).join(' '),a.score,a.grade,a.zeroRate,a.fixes.slice(0,3).map(f=>f.label).join(' | '),(c.emails||[]).join(' '),(c.phones||[]).join(' '),(c.whatsapp||[]).join(' '),c.companyId,c.social?.facebook,c.social?.instagram,c.social?.linkedin,a.auditedAt]);}
 await writeFile(DIR+'/leads.csv','﻿'+rows.map(r=>r.map(csvCell).join(',')).join('\n'),{mode:0o600});
 const contact=c=>!c?'':[...(c.emails||[]).map(e=>`<a href="mailto:${esc(e)}">${esc(e)}</a>`),...(c.phones||[]).map(p=>`<a href="tel:${esc(p)}">${esc(p)}</a>`),...(c.whatsapp||[]).map(w=>`<a href="https://wa.me/${esc(w.replace(/^0/,'972').replace(/\D/g,''))}">וואטסאפ ${esc(w)}</a>`),...Object.entries(c.social||{}).map(([k,v])=>`<a href="${esc(v)}">${k}</a>`),c.companyId?`ח.פ. ${esc(c.companyId)}`:''].filter(Boolean).join(' · ');
 const detail=a=>`<details><summary><span class="score s${a.grade==='טוב'?'g':a.grade==='בינוני'?'m':'b'}">${a.score}</span><b>${esc(a.title)}</b> <a href="${esc(a.origin)}">${esc(a.host)}</a> <span class="muted">${esc(a.platform)}${a.providers?.length?' · '+esc(a.providers.join(', ')):''} · ${a.zeroRate}% בלי תוצאות${a.confidence==='low'?' · ביטחון נמוך':''}</span>${a.lead?'<span class="lead">ליד</span>':''}</summary>
${a.lead?`<p class="contacts">${contact(a.contacts)||'<span class="muted">לא נמצאו פרטי קשר באתר</span>'}</p>`:''}
${a.fixes.length?`<h4>מה לתקן</h4><ol>${a.fixes.map(f=>`<li><b>${esc(f.label)}</b> — ${esc(f.fix)} <span class="muted">לדוגמה: ${f.examples.map(q=>'"'+esc(q)+'"').join(', ')}</span></li>`).join('')}</ol>`:''}
<h4>החיפושים שנבדקו</h4><table><tr><th>חיפוש</th><th>סוג</th><th>תוצאות</th><th></th><th>תוצאות ראשונות</th></tr>${a.results.map(r=>`<tr class="${r.pass===false?'fail':''}"><td><a href="${esc((a.shopperUrl||a.searchUrl)?.replace('{q}',encodeURIComponent(r.q)))}">${esc(r.q)}</a>${r.of?`<div class="muted">במקום "${esc(r.of)}"</div>`:''}</td><td>${esc(r.kind)}</td><td>${r.measurable?r.count:'—'}</td><td>${r.pass===null?'—':r.pass?'✓':'✗ '+esc(r.reason||'')}</td><td class="muted">${esc(r.titles.slice(0,3).join(' · '))}</td></tr>`).join('')}</table></details>`;
 const html=`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Search Prospects</title><style>
:root{--bg:#f7f7f5;--card:#fff;--ink:#1c1d1f;--muted:#6b6f76;--line:#e6e6e2;--good:#1f7a4d;--mid:#a86b00;--bad:#b3261e;--accent:#4b3fd6}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#141518;--card:#1c1e22;--ink:#ececec;--muted:#9aa0a8;--line:#2c2f35;--good:#5cc98f;--mid:#e0a84a;--bad:#f07a72;--accent:#9d95ff}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Arial,sans-serif}main{max-width:1100px;margin:0 auto;padding:24px 16px}
h1{margin:0 0 4px;font-size:24px}.muted{color:var(--muted);font-size:13px}a{color:var(--accent)}
.kpis{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0 24px}.kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 16px;min-width:120px}.kpi b{display:block;font-size:22px}
details{background:var(--card);border:1px solid var(--line);border-radius:12px;margin:8px 0;padding:10px 14px}summary{cursor:pointer;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.score{font-weight:700;min-width:36px;text-align:center;border-radius:8px;padding:2px 6px;color:#fff}.sg{background:var(--good)}.sm{background:var(--mid)}.sb{background:var(--bad)}
.lead{background:var(--accent);color:#fff;border-radius:999px;padding:1px 10px;font-size:12px}.contacts{font-size:14px}
table{width:100%;border-collapse:collapse;font-size:13px;display:block;overflow-x:auto}td,th{border-bottom:1px solid var(--line);padding:6px;text-align:right;vertical-align:top}tr.fail td:first-child{border-right:3px solid var(--bad)}
h2{font-size:18px;margin-top:28px}li{margin:4px 0}
</style></head><body><main><h1>איכות חיפוש בחנויות אונליין</h1><div class="muted">נוצר ${new Date().toLocaleString('he-IL')} · ליד = ציון מתחת ל־${threshold}</div>
<div class="kpis"><div class="kpi"><b>${audits.length}</b>אתרים נבדקו</div><div class="kpi"><b>${scored.length}</b>עם ציון</div><div class="kpi"><b>${leads.length}</b>לידים</div><div class="kpi"><b>${scored.length?Math.round(scored.reduce((s,a)=>s+a.score,0)/scored.length):'—'}</b>ציון ממוצע</div></div>
<h2>לידים</h2>${leads.map(detail).join('')||'<p class="muted">אין עדיין</p>'}
<h2>שאר האתרים שנבדקו</h2>${scored.filter(a=>!a.lead).map(detail).join('')||'<p class="muted">אין</p>'}
<h2>לא נמדדו</h2><table><tr><th>אתר</th><th>מצב</th><th>פירוט</th></tr>${other.map(a=>`<tr><td><a href="https://${esc(a.host)}">${esc(a.host)}</a></td><td>${esc(a.status)}</td><td class="muted">${esc(a.note)}</td></tr>`).join('')}</table>
</main></body></html>`;
 await writeFile(DIR+'/report.html',html,{mode:0o600});
 console.log(`${leads.length} לידים מתוך ${scored.length} אתרים עם ציון (${other.length} לא נמדדו)\n${DIR}/report.html\n${DIR}/leads.csv`);
}

const commands={discover,audit,report};
if(!commands[cmd]){console.log('שימוש: node prospect.mjs discover|audit|report  (פרטים בראש הקובץ)');process.exit(1);}
await commands[cmd]();
