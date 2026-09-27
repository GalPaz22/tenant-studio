import {demoUrl} from './demo-url.js';
const platforms={
 woocommerce:{name:'WooCommerce',hint:'תוסף להתקנה בוורדפרס',steps:['הורידו את חבילת התוסף.','בוורדפרס: תוספים ← תוסף חדש ← העלאת תוסף.','העלו את ה־ZIP, הפעילו ובדקו חיפוש באתר בדיקות.']},
 shopify:{name:'Shopify',hint:'הרחבה לאפליקציה קיימת · דורש מפתח',steps:['הורידו הרחבת Theme App Extension.','מפתח האתר יחבר את הקבצים לאפליקציית Shopify קיימת ויפרסם אותה.','הפעילו את Semantix Search ב־App embeds של התבנית. זו אינה אפליקציה עצמאית להתקנה.']},
 magento:{name:'Magento 2',hint:'מודול לחנות · דורש מפתח',steps:['הורידו את מודול החנות.','מפתח האתר יעתיק את המודול ויפעיל אותו לפי INSTALL.md.','פרסמו קבצים סטטיים, נקו מטמון ובדקו באתר בדיקות.']},
 custom:{name:'Custom code',hint:'קוד להדבקה באתר קיים',steps:['צרו את קוד ההטמעה והעתיקו אותו.','הדביקו בשדה Custom HTML שמאפשר JavaScript או לפני סגירת body.','שמרו ובדקו חיפוש. אם האתר חוסם קוד פנימי, השתמשו בקובץ שבחבילת ההורדה בעזרת מפתח האתר.']}
};
export function createPluginBuilder({project,el,api,connection,onConnected}){
 let selected=project.clientProfile?.platform?.value||project.platform||'custom',busy=false;
 if(!platforms[selected])selected='custom';
 const status=el('p',{class:'meta',role:'status','aria-live':'polite'}),choices=el('div',{class:'builder-platforms'}),guide=el('div',{class:'builder-guide'});
 const endpoint=el('input',{type:'url',required:true,dir:'ltr',placeholder:'https://api.your-site.com/search','aria-label':'כתובת שירות החיפוש'});
 const key=el('input',{type:'text',dir:'ltr',autocomplete:'off','aria-label':'מפתח חיפוש ציבורי',placeholder:'רק אם שירות החיפוש דורש מפתח'});
 // The search service is Semantix's dashboard server and the key is the store's own site key — both are filled in.
 const service=el('p',{class:'meta'},'טוען את פרטי שירות החיפוש…');
 api('/projects/'+project.id+'/storefront-defaults').then(d=>{
  endpoint.value=d.endpoint;if(d.apiKey)key.value=d.apiKey;
  service.textContent=`מחובר לשרת החיפוש של Semantix (${new URL(d.endpoint).host})`+(d.apiKey?` עם מפתח האתר של ${d.user}.`:'. ללקוח אין עדיין משתמש במסד — חברו אותו קודם, או הזינו מפתח ידנית.');
 }).catch(e=>{service.textContent='לא ניתן היה לטעון את פרטי שירות החיפוש: '+e.message+'. אפשר להזין ידנית.';});
 const code=el('textarea',{readonly:true,dir:'ltr',rows:9,'aria-label':'קוד להטמעה באתר',spellcheck:'false'});
 const result=el('div',{class:'builder-result',hidden:true},el('h4',{},'הקוד שלכם מוכן להעתקה'),code,
  el('button',{type:'button',class:'ghost',onclick:async()=>{try{await navigator.clipboard.writeText(code.value);status.textContent='הקוד הועתק';}catch{code.focus();code.select();status.textContent='בחרו העתקה כדי להעתיק את הקוד המסומן';}}},'העתקת הקוד'));
 const download=()=>run('download'),main=el('button',{type:'submit',class:'primary'}),zip=el('button',{type:'button',class:'ghost',onclick:download},'הורדת חבילה עם הוראות');
 const demo=el('button',{type:'button',class:'ghost',onclick:()=>window.open(demoUrl(project.id,'/','plugin'),'_blank','noopener')},'פתיחת דמו עם התוסף');
 const connect=el('button',{type:'button',class:'ghost',onclick:()=>run('connect')},'יצירה ושמירה כתוסף מחובר');
 const form=el('form',{class:'plugin-builder'},
  el('header',{},el('span',{class:'pill'},'בונה ההטמעות'),el('h3',{},'מחברים את החיפוש לאתר שלכם'),el('p',{class:'meta'},'בחרו את סוג האתר וקבלו קבצים או קוד עם הוראות התקנה. הקבצים כלולים — אין צורך בשירות אחסון נוסף.')),
  el('section',{},el('h4',{},'1. באיזו פלטפורמה האתר בנוי?'),choices),
  el('section',{},el('h4',{},'2. שירות החיפוש'),service,
   el('details',{},el('summary',{},'שינוי ידני'),el('label',{},'כתובת שירות החיפוש',endpoint),el('label',{},'מפתח ציבורי לחיפוש בלבד',key),el('p',{class:'meta'},'המפתח יופיע בקוד האתר. אין להזין סיסמה, מפתח ניהול או מפתח AI.'))),
  el('section',{},el('h4',{},'3. יוצרים ומתקינים'),guide,el('div',{class:'builder-actions'},main,zip,connect,demo),status,result),
  el('p',{class:'builder-notice'},'החבילה החדשה מוסיפה כפתור חיפוש וחלון תוצאות; היא אינה כוללת סנכרון, הוספה לעגלה או קונסיירז׳ מותאם. לשמירת היכולות של פלאגין קיים, השתמשו באזור ״תוסף מחובר״. יצירת חבילה אינה מתקינה או מעדכנת את האתר.'));
 function update(){
  for(const b of choices.children){b.setAttribute('aria-pressed',String(b.dataset.platform===selected));b.disabled=busy;}
  main.textContent=busy?'יוצר את ההטמעה…':selected==='custom'?'יצירת קוד להעתקה':'יצירה והורדת תוסף';
  main.disabled=zip.disabled=busy;connect.disabled=busy||!!project.pluginWorkspace;demo.disabled=busy||!project.url||!project.revisions?.length;
  endpoint.disabled=key.disabled=busy;
  connect.title=project.pluginWorkspace?'כבר מחובר תוסף לפרויקט. ערכו אותו באזור תוסף מחובר.':'';
  zip.hidden=selected!=='custom';
  guide.replaceChildren(el('b',{},'איך מתקינים ב־'+platforms[selected].name+'?'),el('ol',{},platforms[selected].steps.map(s=>el('li',{},s))));
 }
 for(const [value,p] of Object.entries(platforms))choices.append(el('button',{type:'button','data-platform':value,'aria-pressed':'false',onclick:()=>{selected=value;result.hidden=true;status.textContent='';update();}},el('b',{},p.name),el('small',{},p.hint)));
 form.addEventListener('input',()=>{result.hidden=true;status.textContent='';});
 form.onsubmit=e=>{e.preventDefault();run(selected==='custom'?'code':'download');};
 async function run(action){
  if(busy||!form.reportValidity())return;
  const body={platform:selected,endpoint:endpoint.value.trim(),apiKey:key.value.trim()};busy=true;result.hidden=true;status.textContent='';update();
  try{
   if(action==='code'){const data=await api('/projects/'+project.id+'/storefront-code',body);code.value=data.code;result.hidden=false;status.textContent='הקוד נוצר. האתר עדיין לא עודכן.';}
   else if(action==='connect'){await api('/projects/'+project.id+'/plugin/generate',body);status.textContent='התוסף נשמר לפרויקט, ללא שינוי באתר.';await onConnected();}
   else{const blob=await connection.request('/projects/'+project.id+'/storefront-plugin',body,true);const url=URL.createObjectURL(blob);el('a',{href:url,download:'semantix-'+selected+'-plugin.zip'}).click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='החבילה נוצרה וההורדה החלה. הוראות ההתקנה כלולות בקובץ INSTALL.md.';}
  }catch(e){status.textContent=e.message;}finally{busy=false;update();}
 }
 update();return el('div',{class:'export-box builder-panel'},form);
}
