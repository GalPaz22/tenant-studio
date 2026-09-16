import {createApi} from './api.js';
import {createViewState} from './view-state.js';
let storage;try{storage=window.localStorage}catch{}
const viewState=createViewState(storage);
let openRequest=0;
function selectTenant(id){viewState.select(id);const url=new URL(location.href);if(id)url.searchParams.set('tenant',id);else url.searchParams.delete('tenant');history.replaceState(null,'',url);}
function saveDraft(){if(project)viewState.saveDraft(project.id,{message:$('message').value,query:$('query').value});}
const connection=createApi();
const $=id=>document.getElementById(id);let project,poll,cursor,artifact;
const node=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n};
const api=(path,body)=>connection.request(path,body);
function error(e){$('error').textContent=e.message;$('error').hidden=false}
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
  saveDraft();
  const draft=viewState.draft(id);$('message').value=draft.message;$('query').value=draft.query;
  cursor=null;$('more').hidden=true;$('results').replaceChildren(node('div','תוצאות אמיתיות מהקטלוג יופיעו כאן.','empty'));$('searchnote').textContent='';
 }
 project=next;selectTenant(id);
 renderScan(project.badgeScan);$('scanpanel').open=Boolean(project.badgeScan);
 $('research').hidden=new URL(project.url).hostname.replace(/^www\./,'')!=='garmin.co.il';
 $('researchpanel').hidden=!project.research;
 $('researchreport').textContent=project.research?JSON.stringify(project.research,null,2):'';
 render();
 if(['discovering','designing'].includes(project.status)||project.tagging)poll=setTimeout(()=>open(id).catch(error),1500);
}
$('message').addEventListener('input',saveDraft);
$('query').addEventListener('input',saveDraft);

function render(){const p=project;$('welcome').hidden=true;$('workspace').hidden=false;$('name').textContent=p.name;$('source').textContent=p.url;$('source').href=p.url;$('status').textContent=({created:'מוכן להתחלה',discovering:'חוקר אתר',designing:'בונה מודול',draft:'גרסה לבדיקה',failed:'נדרש טיפול'})[p.status]+(p.tagging?' · מתייג קטלוג…':'');$('events').replaceChildren(...p.events.slice(-8).map(e=>node('div',e.text)));$('warnings').textContent=[...(p.catalog?.warnings||[]),p.provisioning?.message].filter(Boolean).join(' · ');$('count').textContent=(p.catalog?.count||0)+' מוצרים במדגם';$('version').textContent='גרסה '+p.revisions.length;$('profile').textContent=JSON.stringify(p.revisions.at(-1)||{},null,2);$('revisions').replaceChildren(...p.revisions.map(r=>{const o=node('option','גרסה '+r.number+' · '+r.note.slice(0,25));o.value=r.number;return o}));$('messages').replaceChildren(...p.messages.map(m=>{const b=node('div',m.text,'bubble '+m.role);if(m.changes?.length)b.append(node('div','שדות שהשתנו: '+m.changes.join(', '),'changes'));return b}));if(!p.messages.length)$('messages').append(node('div','כאן נבנה יחד את שפת החנות ואת כללי החיפוש.','empty'));$('chat').querySelector('button').disabled=!p.revisions.length;$('search').querySelector('button').disabled=!p.revisions.length}
$('new').onclick=()=>{clearTimeout(poll);++openRequest;saveDraft();selectTenant(null);project=null;$('workspace').hidden=true;$('welcome').hidden=false};
$('create').onsubmit=e=>{e.preventDefault();action(e.submitter,async()=>{const p=await api('/projects',{url:$('url').value,platform:$('platform').value});await api('/projects/'+p.id+'/build',{});await list();await open(p.id)})};
$('build').onclick=e=>action(e.target,async()=>{await api('/projects/'+project.id+'/build',{});await open(project.id)});
$('chat').onsubmit=e=>{e.preventDefault();const id=project.id;action(e.submitter,async()=>{const p=await api('/projects/'+id+'/chat',{message:$('message').value});if(project?.id===id){project=p;$('message').value='';saveDraft();render();$('searchnote').textContent='נוצרה גרסה חדשה — הרץ שוב כדי לבדוק את השינוי';cursor=null;$('more').hidden=true}await list()})};
$('rollback').onclick=e=>action(e.target,async()=>{project=await api('/projects/'+project.id+'/rollback',{revision:Number($('revisions').value)});cursor=null;$('more').hidden=true;render()});
function cards(products,append){if(!append)$('results').replaceChildren();for(const p of products){const c=node('article','','card');const image=safeUrl(p.image);if(image){const img=document.createElement('img');img.src=image;img.loading='lazy';img.alt=p.title;c.append(img)}const a=node('a',p.title);const url=safeUrl(p.url);if(url){a.href=url;a.target='_blank';a.rel='noreferrer'}const h=document.createElement('h3');h.append(a);c.append(h);for(const b of p.badges||[])c.append(node('span',b.text,'badge'));if(p.matchQuality==='alternative')c.append(node('span','חלופה','badge'));c.append(node('p',p.price===null?'':String(p.price)+' '+(p.currency||'')));$('results').append(c)}}
async function search(append){const id=project.id;const r=await api('/projects/'+id+'/search',append?{cursor,limit:6}:{query:$('query').value,limit:6});if(project?.id!==id)return;cards(r.matches,append);cursor=r.nextCursor;$('more').hidden=!cursor;$('searchnote').textContent=[r.message,r.metadata?.phase,r.metadata?.llmUsed?'LLM הופעל':'חיפוש מקומי',r.total+' תוצאות'].filter(Boolean).join(' · ')}
$('search').onsubmit=e=>{e.preventDefault();action(e.submitter,()=>search(false))};$('more').onclick=e=>action(e.target,()=>search(true));
$('artifacts').onclick=e=>action(e.target,async()=>{artifact=await api('/projects/'+project.id+'/artifacts');$('artifact').textContent=JSON.stringify(artifact,null,2);$('dialog').showModal()});$('close').onclick=()=>$('dialog').close();$('download').onclick=e=>action(e.target,async()=>{const blob=await connection.request('/projects/'+project.id+'/download',undefined,true);const url=URL.createObjectURL(blob);const a=node('a','');a.href=url;a.download='tenant-module.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
$('provision').onclick=e=>action(e.target,async()=>{const r=await api('/projects/'+project.id+'/provision',{});$('events').append(node('div',r.message));});
try{await list();const id=new URL(location.href).searchParams.get('tenant')||viewState.selected();if(id&&/^[a-f0-9-]{36}$/.test(id))await open(id)}catch(e){error(e)}
