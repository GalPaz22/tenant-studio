import {pluginWorkspacePanel} from './plugin-workspace.js';
import {createPluginBuilder} from './plugin-builder.js';

export const PLUGIN_REQUEST_PREFIX='בקשת עדכון לתוסף:';
const guidance='עבוד על התוסף המחובר הקיים בלבד. קרא את הקבצים לפני עריכה, שמור את יתר היכולות והנכסים, בצע את השינויים ובדוק עם plugin_validate. אל תיצור תוסף גנרי חלופי ואל תפרסם לאתר. בסיום סכם מה השתנה ומה נבדק. הממשק יפיק ZIP מלא רק אחרי שמירת גרסה חדשה ואימות החבילה.';

// Packaging follows a completed, persisted agent turn, never an interim message.
export async function preparePluginUpdate({id,message,revision,connection,api,signal,onEvent=()=>{},onProject=()=>{}}){
 if(typeof message!=='string'||!message.trim()||message.length>2200)throw Error('כתבו הוראות לתוסף, עד 2,200 תווים');
 if(!Number.isInteger(revision))throw Error('חברו תוסף קיים לפני בקשת עדכון');
 let completed=null,error=null;
 await connection.stream('/projects/'+id+'/studio',{message:`${PLUGIN_REQUEST_PREFIX}\n${message.trim()}`,context:{surface:'plugin',pluginRevision:revision,instructions:guidance}},event=>{
  onEvent(event);
  if(event.type==='done')completed=event.project;
  if(event.type==='error'||event.type==='stopped')error=event.message||'העבודה על התוסף לא הושלמה';
 },signal);
 if(signal?.aborted)throw Error('העבודה נעצרה; לא הופקה חבילה');
 if(error)throw Error(error);
 if(!completed||completed.id!==id)throw Error('לא התקבל אישור שהשינויים נשמרו; לא הופקה חבילה');
 await onProject(completed);
 const state=await api('/projects/'+id+'/plugin');
 if(state.revision!==completed.pluginWorkspace?.revision)throw Error('התוסף השתנה אחרי עבודת האייג׳נט; רעננו לפני הפקת חבילה');
 if(state.revision<=revision)throw Error('לא נשמרה גרסת תוסף חדשה. אפשר להוריד את הגרסה הקיימת באזור החבילה.');
 if(!state.validation?.ok)throw Error('בדיקות התוסף נכשלו; לא הופקה חבילה: '+(state.validation?.errors||[]).join(' · '));
 if(signal?.aborted)throw Error('העבודה נעצרה; לא הופקה חבילה');
 const blob=await connection.request('/projects/'+id+'/plugin/release',{expectedRevision:state.revision,note:'עדכון תוסף לפי הוראות האייג׳נט'},true);
 return {blob,state};
}

export function pluginAgentPanel({project,el,api,connection,toast,beginRun,endRun,onProject}){
 const id=project.id,root=el('section',{class:'plugin-center'}),status=el('p',{class:'meta',role:'status','aria-live':'polite'});
 const history=el('div',{class:'plugin-agent-history',role:'log','aria-label':'שיחת התוסף'});
 // Requests carry a stable marker, so this panel can restore its own conversation.
 for(let i=0;i<(project.messages||[]).length;i++){
  const m=project.messages[i];if(m.role!=='user'||!m.text.startsWith(PLUGIN_REQUEST_PREFIX))continue;
  const text=m.text.slice(PLUGIN_REQUEST_PREFIX.length).split('\n\n'+guidance)[0].trim();
  history.append(el('p',{class:'plugin-request'},text));
  const answer=project.messages[i+1];if(answer?.role==='assistant')history.append(el('p',{class:'plugin-answer'},answer.text));
 }
 const prompt=el('textarea',{id:'plugin-instructions',rows:4,maxlength:2200,placeholder:'למשל: שפר את צ׳אט הקונסיירז׳ במובייל, שמור על החיפוש, העגלה והמעקב, והכן תוסף מלא להורדה.'});
 try{prompt.value=sessionStorage.getItem('plugin-draft:'+id)||'';}catch{}
 prompt.addEventListener('input',()=>{try{sessionStorage.setItem('plugin-draft:'+id,prompt.value);}catch{}});
 const submit=el('button',{type:'submit',class:'primary'},'עדכן עם האייג׳נט והורד תוסף');
 const stop=el('button',{type:'button',class:'ghost',hidden:true},'עצור');
 let active=false,controller=null;
 const workspace=el('div'),builder=el('details',{},el('summary',{},'יצירת תוסף חדש'));
 function refreshWorkspace(){workspace.replaceChildren(pluginWorkspacePanel({id,api,connection,el,toast}));}
 builder.append(createPluginBuilder({project,el,api,connection,onConnected:async()=>{const next=await api('/projects/'+id);await onProject(next);refreshWorkspace();}}));
 const form=el('form',{class:'plugin-agent-form',onsubmit:async e=>{
  e.preventDefault();if(active)return;if(!prompt.value.trim())return toast('כתבו מה תרצו לשנות בתוסף');
  try{controller=beginRun();}catch(err){return toast(err.message);}
  active=true;submit.disabled=true;prompt.disabled=true;stop.hidden=false;stop.onclick=()=>controller.abort();workspace.inert=true;builder.inert=true;
  const request=prompt.value;history.append(el('p',{class:'plugin-request'},request));status.textContent='האייג׳נט בודק את התוסף…';
  try{
   const before=await api('/projects/'+id+'/plugin');
   const result=await preparePluginUpdate({id,message:request,revision:before?.revision,connection,api,signal:controller.signal,onProject,onEvent:event=>{
    if(event.type==='note')status.textContent=event.text;
    if(event.type==='tool_done')status.textContent=event.text||'מעדכן ובודק את התוסף…';
    if(event.type==='message')history.append(el('p',{class:'plugin-answer'},event.text));
   }});
   const url=URL.createObjectURL(result.blob);el('a',{href:url,download:`${result.state.name}-r${result.state.revision}.zip`}).click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   status.textContent=`גרסת תוסף ${result.state.revision} נבדקה ונארזה. הורדת התוסף המלא החלה.`;
   prompt.value='';try{sessionStorage.removeItem('plugin-draft:'+id);}catch{}
  }catch(err){status.textContent=err.name==='AbortError'?'העבודה נעצרה; לא הופקה חבילה.':err.message;}
  finally{active=false;submit.disabled=false;prompt.disabled=false;stop.hidden=true;workspace.inert=false;builder.inert=false;endRun();refreshWorkspace();}
 }},el('label',{for:'plugin-instructions'},'מה תרצו שהאייג׳נט ישנה בתוסף?'),prompt,el('div',{class:'plugin-agent-actions'},submit,stop),status);
 root.append(el('h3',{},'התוסף של החנות'),el('p',{class:'meta'},'כאן נותנים הוראות, עוקבים אחרי העבודה ומקבלים חבילת תוסף מלאה. הקבצים והגרסאות נמצאים בהמשך.'),history,form,el('p',{class:'meta'},'החבילה עוברת בדיקות מבנה ותחביר. בדיקת WooCommerce והתקנה באתר מתבצעות בנפרד.'),workspace,builder);
 refreshWorkspace();return root;
}
