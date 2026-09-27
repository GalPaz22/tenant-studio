import {demoUrl} from './demo-url.js';
// Connected source workspace. Files stay on the Studio server; downloads do not deploy.
export function pluginWorkspacePanel({id,api,connection,el,toast}){
 const root=el('section',{class:'export-box plugin-workspace'});
 let state=null;
 const endpoint='/projects/'+id+'/plugin';
 const download=async()=>{const blob=await connection.request(endpoint+'/release',{expectedRevision:state.revision},true),url=URL.createObjectURL(blob);el('a',{href:url,download:`semantix-${state.platform}-r${state.revision}.zip`}).click();setTimeout(()=>URL.revokeObjectURL(url),1000);await refresh();};
 async function guarded(fn){try{await fn();}catch(e){toast(e.message);}}
 async function refresh(){state=await api(endpoint);render();}
 async function openFile(path){
  const f=await api(endpoint+'/file?path='+encodeURIComponent(path)),revision=state.revision;
  const dialog=el('dialog',{class:'plugin-editor'}),body=el('textarea',{dir:'ltr','aria-label':path,spellcheck:'false'});
  body.value=f.encoding==='utf8'?f.content:'קובץ בינארי — נשמר ללא שינוי בחבילה';body.readOnly=f.encoding!=='utf8';
  const status=el('p',{class:'meta'}),save=el('button',{type:'button',class:'primary',disabled:body.readOnly,onclick:()=>guarded(async()=>{
   save.disabled=true;try{state=await api(endpoint+'/edit',{expectedRevision:revision,note:'עריכה ידנית: '+path,edits:[{path,expectedHash:f.hash,content:body.value}]});dialog.close();dialog.remove();render();}finally{save.disabled=false;}
  })},'שמור כגרסה חדשה');
  dialog.append(el('h3',{},path),body,status,el('div',{class:'row'},save,el('button',{type:'button',onclick:()=>{dialog.close();dialog.remove();}},'סגור')));
  document.body.append(dialog);dialog.addEventListener('cancel',()=>dialog.remove());dialog.showModal();
 }
 function render(){
  root.replaceChildren(el('h3',{},'תוסף מחובר לסטודיו'),el('p',{class:'meta'},'מחברים את קוד התוסף הקיים, עובדים עליו בצ׳אט או בעורך, ושומרים גרסאות הניתנות להורדה ושחזור. הקבצים המקוריים והנכסים נשמרים בחבילה.'));
  const name=el('input',{value:state?.name||'',required:true,placeholder:'שם התוסף','aria-label':'שם התוסף'}),platform=el('select',{'aria-label':'פלטפורמת התוסף'});
  for(const [value,label] of [['woocommerce','WooCommerce'],['shopify','Shopify'],['magento','Magento'],['custom','Custom']])platform.append(el('option',{value,selected:state?.platform===value},label));
  if(state)platform.disabled=true;
  const folder=el('input',{type:'file',webkitdirectory:true,multiple:true,'aria-label':'תיקיית התוסף'}),info=el('p',{class:'meta'},'בחרו תיקיית תוסף (אם יש ZIP, חלצו אותו קודם). עד 500 קבצים ו־8MB. קבצי .env, Git ו־node_modules אינם מיובאים.'),importButton=el('button',{type:'button',class:'primary',onclick:()=>guarded(async()=>{
   const selected=[...folder.files].filter(f=>!f.webkitRelativePath.split('/').some(s=>['.git','node_modules','.env','.ssh','.DS_Store'].includes(s)||s.startsWith('.env.')));
   if(!selected.length)throw Error('בחרו תיקיית תוסף');
   if(selected.length>500||selected.reduce((n,f)=>n+f.size,0)>8*1024*1024)throw Error('החבילה חורגת ממגבלת הגודל');
   importButton.disabled=true;
   try{
    const files=[];
    for(const f of selected){const data=new Uint8Array(await f.arrayBuffer()),path=f.webkitRelativePath||f.name;let content,encoding;
     if(/\.(php|js|mjs|cjs|css|json|html|liquid|xml|toml|md|txt|yaml|yml|svg|phtml|htaccess)$/i.test(path)){content=new TextDecoder('utf-8',{fatal:true}).decode(data);encoding='utf8';}
     else{let raw='';for(let i=0;i<data.length;i+=8192)raw+=String.fromCharCode(...data.subarray(i,i+8192));content=btoa(raw);encoding='base64';}
     files.push({path,content,encoding});
    }
    state=await api(endpoint+'/import',{name:name.value.trim()||selected[0].webkitRelativePath.split('/')[0],platform:platform.value,expectedRevision:state?.revision,files});render();toast('התוסף מחובר. אפשר לבקש מהאייג׳נט לבדוק ולעדכן את הקוד שלו.');
   }finally{importButton.disabled=false;}
  })},state?'ייבא עדכון לתוסף':'חבר תוסף קיים');
  root.append(el('details',{},el('summary',{},state?'ייבוא עדכון מקבצים':'הוספת תוסף קיים'),name,platform,folder,info,importButton));
  if(!state){root.append(el('p',{class:'meta'},'עדיין אין תוסף מחובר. אפשר גם ליצור תוסף חדש בטופס למטה ולשמור אותו לפרויקט.'));return;}
  root.append(el('p',{},`${state.name} · ${state.platform} · גרסת תוסף ${state.revision} · ${state.files.length} קבצים`),
   el('p',{class:state.validation.ok?'meta':'error'},state.validation.ok?'בדיקות מבנה ותחביר בסיסיות עברו. נדרשת בדיקה בחנות לפני התקנה.':state.validation.errors.join(' · ')),
   el('div',{class:'row'},el('button',{type:'button',class:'primary',disabled:!state.validation.ok,onclick:()=>guarded(download)},'הפק והורד עדכון'),el('button',{type:'button',onclick:()=>guarded(refresh)},'רענן מצב'),el('button',{type:'button',class:'ghost',onclick:()=>window.open(demoUrl(id,'/','plugin'),'_blank','noopener')},'דמו רכיב החיפוש')),
   el('p',{class:'meta'},'ההורדה כוללת את הקבצים של הגרסה הנוכחית. התקנה בחנות או פרסום הרחבת Shopify מתבצעים בנפרד; הסטודיו אינו מתקין אוטומטית קוד בחנות.'));
  root.append(el('details',{},el('summary',{},'קבצי התוסף — צפייה ועריכה'),el('ul',{},state.files.map(f=>el('li',{},el('button',{type:'button',class:'link',dir:'ltr',onclick:()=>guarded(()=>openFile(f.path))},f.path),` · ${f.size} bytes`)))));
  root.append(el('details',{},el('summary',{},'היסטוריית התוסף'),...state.history.slice().reverse().map(r=>el('div',{class:'version'},el('b',{},'גרסה '+r.number),el('p',{},r.note),el('small',{},new Date(r.createdAt).toLocaleString('he-IL')),r.number!==state.revision?el('button',{type:'button',onclick:()=>guarded(async()=>{state=await api(endpoint+'/rollback',{expectedRevision:state.revision,revision:r.number});render();})},'שחזר כגרסה חדשה'):el('span',{},'נוכחית')))));
 }
 root.append(el('p',{},'טוען חיבור תוסף…'));guarded(refresh);return root;
}
