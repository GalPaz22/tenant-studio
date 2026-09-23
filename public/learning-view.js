const $=id=>document.getElementById(id);
const n=(tag,text,cls)=>{const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el};
export function createLearningView({api,getProject,update,error}){
 const pending=new Set();let selected;
 async function act(action,id,status,extra={}){
  const p=getProject();if(!p||pending.has(p.id))return;pending.add(p.id);render(p);$('learning-status').textContent=action==='propose'?'העוזר בודק דוגמאות ומציע שיפורים ממוקדים…':'בודק ושומר…';
  try{const next=await api('/projects/'+p.id+'/learning',{action,id,status,...extra});if(getProject()?.id!==p.id)return;update(next);$('learning-status').textContent=action==='propose'?'הבדיקה הסתיימה. ההצעות מפורטות למטה; טרם הוחלו שינויים.':action==='apply'?'הכלל הוחל בגרסת העבודה ועבר את הבדיקות המאושרות.':'נשמר. הבדיקה עודכנה.';}
  catch(e){if(getProject()?.id===p.id){$('learning-status').textContent=e.message;error(e)}}finally{pending.delete(p.id);if(getProject()?.id===p.id)render(getProject());}
 }
 $('learning-import').onclick=()=>act('import');$('learning-propose').onclick=()=>act('propose');$('learning-check').onclick=()=>act('check');
 function render(p){
  if(selected!==p.id){selected=p.id;$('learning-status').textContent='';}
  const state=p.learning||{examples:[],proposals:[]},busy=pending.has(p.id)||p.tagging||['queued','running'].includes(p.buildRun?.status),ready=!!p.revisions.length;
  const confirmed=state.examples.filter(e=>e.status==='confirmed');$('learning-count').textContent=confirmed.length+' דוגמאות מאושרות · '+state.proposals.filter(s=>s.status==='pending').length+' הצעות לבדיקה';
  for(const id of ['learning-import','learning-propose','learning-check'])$(id).disabled=busy||!ready;
  const button=(label,action,id,status)=>{const b=n('button',label);b.disabled=busy;b.onclick=()=>act(action,id,status);return b};
  const examples=$('learning-examples');examples.replaceChildren();
  for(const e of state.examples.filter(e=>e.status!=='dismissed')){
   const card=n('article','','learning-card');card.append(n('h3','״'+e.query+'״'),n('span',e.status==='confirmed'?'אישרת כדוגמה ללמידה':'דוגמה מוצעת מהיסטוריית התיקונים — טרם אושרה','hint'));
   card.append(n('p','צריך להופיע: '+(e.include||[]).map(p=>p.title).join(' · ')));
   card.append(n('p',e.exclude?.length?'לא צריך להופיע: '+e.exclude.map(p=>p.title).join(' · '):'טרם הוגדרו מוצרים שאסור להחזיר בדוגמה הזו.','hint'));
   if(e.status!=='confirmed')card.append(button('הדוגמה נכונה — למד ממנה','review',e.id,'confirmed'));
   else card.append(button('בטל אישור','review',e.id,'pending'));
   const edit=n('details','');edit.append(n('summary','הוסף מוצר רצוי או לא רצוי לדוגמה'));const form=n('form',''),input=n('input',''),find=n('button','חפש מוצר');input.placeholder='שם מוצר או מזהה';input.required=true;input.setAttribute('aria-label','חפש מוצר עבור '+e.query);form.append(input,find);const options=n('div','');
   form.onsubmit=async event=>{event.preventDefault();const id=p.id;find.disabled=true;try{const response=await api('/projects/'+id+'/products?q='+encodeURIComponent(input.value)+'&limit=8');if(getProject()?.id!==id)return;options.replaceChildren();for(const product of response.products){const row=n('p',product.title+' ');for(const [kind,label] of [['include','צריך להופיע'],['exclude','לא צריך להופיע']]){const b=n('button',label);b.type='button';b.onclick=()=>act('review',e.id,'pending',{includeIds:kind==='include'?[...new Set([...e.includeIds,product.id])]:e.includeIds.filter(x=>x!==product.id),excludeIds:kind==='exclude'?[...new Set([...e.excludeIds,product.id])]:e.excludeIds.filter(x=>x!==product.id)});row.append(b)}options.append(row)}if(!response.products.length)options.append(n('p','לא נמצאו מוצרים.'));}catch(err){error(err)}finally{find.disabled=false;}};
   edit.append(form,options);card.append(edit);
   card.append(button('הסר מהלמידה','review',e.id,'dismissed'));examples.append(card);
  }
  if(!examples.children.length)examples.append(n('p','טען תיקונים קודמים כדי ליצור דוגמאות לבדיקה. תיקונים חדשים יתווספו כאן אוטומטית.','hint'));
  const proposals=$('learning-proposals');proposals.replaceChildren();
  for(const s of state.proposals.filter(s=>s.status!=='dismissed')){
   const seed=state.examples.find(e=>e.id===s.exampleId),card=n('article','','learning-card');card.append(n('h3','״'+s.query+'״'),n('p','מבוסס על: ״'+(seed?.query||'')+'״'),n('p',s.reason));
   if(s.evaluation){const e=s.evaluation;card.append(n('p',`בדיקת הכלל: ${e.before.missing.length} מוצרים צפויים חסרים לפני, ${e.after.missing.length} אחרי. ${e.regression.passed} מתוך ${e.regression.tested} דוגמאות מאושרות עברו.`));card.append(n('p','המוצרים שיוחזרו לדוגמה: '+e.after.products.map(p=>p.title).join(' · '),'hint'));}
   const labels={pending:'ממתינה לאישור; מעבר בדיקות אינו מוכיח שהביטוי החדש שקול למקור',applied:'הוחלה בגרסת העבודה',blocked:'נחסמה בבדיקה',no_gain:'לא נמצא שיפור בבדיקה'};card.append(n('p',s.error||labels[s.status],'hint'));
   if(s.status!=='applied'){const apply=button('הביטוי מתאים — החל את הכלל','apply',s.id);apply.disabled=busy||s.status!=='pending'||seed?.status!=='confirmed';card.append(apply,button('בדוק מחדש','refresh',s.id),button('דחה הצעה','dismiss',s.id));if(seed?.status!=='confirmed')card.append(n('p','יש לאשר קודם את דוגמת המקור למעלה.','hint'));}proposals.append(card);
  }
  if(!proposals.children.length)proposals.append(n('p','לחץ ״מצא שיפורים מהדוגמאות״. העוזר יבדוק עד שש דוגמאות בכל ניסיון.','hint'));
  const report=$('learning-report');report.replaceChildren();if(state.lastCheck){const results=state.lastCheck.results||[];report.append(n('p','בדיקה אחרונה: '+new Date(state.lastCheck.at).toLocaleString('he-IL')));report.append(n('p',results.filter(r=>r.passed).length+' מתוך '+results.length+' בדיקות כללים עברו'));for(const r of results.filter(r=>!r.passed))report.append(n('p','״'+r.query+'״: '+r.missing.length+' מוצרים צפויים חסרים, '+r.unwanted.length+' מוצרים לא רצויים'+(r.unavailable.length?' · חלק מהמוצרים אינם זמינים בקטלוג הנוכחי':''),'failure'));}
 }
 return {render};
}
