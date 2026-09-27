import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
import {zipFiles} from '../zip.mjs';

export const PLUGIN_PLATFORMS=['woocommerce','shopify','magento','custom'];
const MAX_BYTES=8*1024*1024,MAX_FILES=500,MAX_HISTORY=12;
const sha=value=>createHash('sha256').update(value).digest('hex');
const bytes=f=>Buffer.from(f.content,f.encoding==='base64'?'base64':'utf8');
const forbidden=new Set(['.git','node_modules','.env','.ssh','.DS_Store']);
function safePath(path){
 if(typeof path!=='string'||path.length>240||!/^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(path)||path.split('/').some(s=>s==='.'||s==='..'||forbidden.has(s)||s.startsWith('.env.')))throw Error('נתיב קובץ לא מותר: '+String(path).slice(0,100));
 return path;
}
function normalize(files){
 if(!Array.isArray(files)||!files.length||files.length>MAX_FILES)throw Error('נדרשים 1–500 קבצים');
 let size=0;const seen=new Set();
 return files.map(f=>{
  const path=safePath(f.path),fold=path.toLowerCase();if(seen.has(fold))throw Error('נתיב כפול: '+path);seen.add(fold);
  if(!['utf8','base64'].includes(f.encoding)||typeof f.content!=='string')throw Error('תוכן קובץ לא תקין');
  if(f.content.length>MAX_BYTES*1.4)throw Error('קובץ גדול מדי');
  if(f.encoding==='base64'&&!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(f.content))throw Error('Base64 לא תקין');
  const buffer=bytes(f);size+=buffer.length;if(size>MAX_BYTES)throw Error('החבילה גדולה מ־8MB');
  return {path,encoding:f.encoding,content:f.content,size:buffer.length,hash:sha(buffer)};
 }).sort((a,b)=>a.path.localeCompare(b.path));
}
export function pluginHead(p){return p.pluginWorkspace?.revisions?.at(-1)||null;}
export function pluginSummary(p){
 const w=p.pluginWorkspace,h=pluginHead(p);if(!h)return null;
 return {name:w.name,platform:w.platform,revision:h.number,hash:h.hash,status:'draft',source:w.source,
  files:h.files.map(({content,...f})=>f),history:w.revisions.map(({files,...r})=>r),releases:w.releases||[],validation:validatePlugin(p)};
}
function revision(files,number,note,searchRevision){
 return {number,createdAt:new Date().toISOString(),note:String(note||'עדכון תוסף').slice(0,300),searchRevision,
  hash:sha(JSON.stringify(files.map(f=>[f.path,f.hash]))),files};
}
export function attachPlugin(p,{name,platform,files,expectedRevision,source='imported'}){
 if(!PLUGIN_PLATFORMS.includes(platform))throw Error('פלטפורמה לא נתמכת');
 if(typeof name!=='string'||!name.trim()||name.length>100)throw Error('שם תוסף לא תקין');
 const old=pluginHead(p);if(old&&expectedRevision!==old.number)throw Error('התוסף השתנה; רעננו לפני החלפה');
 if(old&&p.pluginWorkspace.platform!==platform)throw Error('אי אפשר לשנות פלטפורמה של תוסף מחובר');
 const normalized=normalize(files),r=revision(normalized,(old?.number||0)+1,old?'ייבוא עדכון לתוסף קיים':'חיבור תוסף',p.revisions?.at(-1)?.number||null);
 const previous=p.pluginWorkspace;
 p.pluginWorkspace={name:name.trim(),platform,source:previous?.source||source,revisions:[...(previous?.revisions||[]),r].slice(-MAX_HISTORY),releases:previous?.releases||[]};
 return pluginSummary(p);
}
export function readPluginFile(p,path){
 const file=pluginHead(p)?.files.find(f=>f.path===safePath(path));if(!file)throw Error('הקובץ לא נמצא');
 return {...file};
}
export function updatePlugin(p,{expectedRevision,edits,note}){
 const head=pluginHead(p);if(!head)throw Error('יש לחבר תוסף קודם');
 if(expectedRevision!==head.number)throw Error('התוסף השתנה; קראו את הגרסה הנוכחית לפני עריכה');
 if(!Array.isArray(edits)||!edits.length||edits.length>20)throw Error('נדרשים 1–20 שינויים');
 const files=new Map(head.files.map(f=>[f.path,f])),seen=new Set();
 for(const e of edits){
  const path=safePath(e.path);if(seen.has(path))throw Error('עריכה כפולה');seen.add(path);
  const current=files.get(path);
  if((current?.hash||null)!==e.expectedHash)throw Error('הקובץ השתנה או לא נקרא: '+path);
  if(e.remove===true){if(!current)throw Error('הקובץ לא נמצא');files.delete(path);}
  else{if(typeof e.content!=='string'||current?.encoding==='base64')throw Error('עריכת טקסט בלבד; קובץ בינארי מעדכנים בייבוא');files.set(path,{path,encoding:'utf8',content:e.content});}
 }
 const normalized=normalize([...files.values()]),next=revision(normalized,head.number+1,note,p.revisions?.at(-1)?.number||null);
 if(next.hash===head.hash)throw Error('אין שינוי בקבצים');
 p.pluginWorkspace.revisions=[...p.pluginWorkspace.revisions,next].slice(-MAX_HISTORY);
 return pluginSummary(p);
}
export function rollbackPlugin(p,{revision:target,expectedRevision}){
 const head=pluginHead(p);if(!head||head.number!==expectedRevision)throw Error('התוסף השתנה; רעננו');
 const old=p.pluginWorkspace.revisions.find(r=>r.number===target);if(!old)throw Error('הגרסה אינה בהיסטוריה השמורה');
 p.pluginWorkspace.revisions.push(revision(old.files,head.number+1,'שחזור גרסת תוסף '+target,p.revisions?.at(-1)?.number||null));
 p.pluginWorkspace.revisions=p.pluginWorkspace.revisions.slice(-MAX_HISTORY);return pluginSummary(p);
}
export function validatePlugin(p){
 const head=pluginHead(p);if(!head)return {ok:false,errors:['אין תוסף מחובר'],checks:[]};
 const errors=[],checks=[],paths=head.files.map(f=>f.path),platform=p.pluginWorkspace.platform;
 if(platform==='woocommerce'&&!head.files.some(f=>/\.php$/.test(f.path)&&f.encoding==='utf8'&&/Plugin Name\s*:/i.test(f.content)))errors.push('חסר קובץ PHP עם כותרת Plugin Name');
 if(platform==='shopify'&&!paths.some(x=>/\.liquid$/.test(x)))errors.push('חסר קובץ Liquid של ההטמעה');
 if(platform==='magento'&&!paths.some(x=>/(^|\/)registration.php$/.test(x)))errors.push('חסר registration.php של מודול Magento');
 for(const f of head.files.filter(f=>f.encoding==='utf8')){
  try{
   if(/\.json$/.test(f.path)){JSON.parse(f.content);checks.push(f.path+': JSON');}
   if(/\.(?:js|cjs)$/.test(f.path)&&!/^\s*(?:import\s|export\s)/m.test(f.content)){new Script(f.content,{filename:f.path});checks.push(f.path+': JavaScript syntax');}
  }catch(e){errors.push(f.path+': '+e.message);}
 }
 return {ok:!errors.length,errors,checks,limitations:['בדיקת מבנה ותחביר בלבד; PHP, Liquid, XML, JavaScript modules ותהליך רכישה דורשים בדיקות בסביבת הפלטפורמה.']};
}
export function releasePlugin(p,{expectedRevision,note}){
 const head=pluginHead(p);if(!head||head.number!==expectedRevision)throw Error('התוסף השתנה; רעננו לפני הפקת חבילה');
 const validation=validatePlugin(p);if(!validation.ok)throw Error(validation.errors.join('\n'));
 const release={revision:head.number,hash:head.hash,platform:p.pluginWorkspace.platform,searchRevision:p.revisions?.at(-1)?.number||null,createdAt:new Date().toISOString(),note:String(note||'').slice(0,300),status:'packaged-not-deployed',validation};
 const zip=zipFiles(Object.fromEntries(head.files.map(f=>[f.path,bytes(f)])));
 p.pluginWorkspace.releases=[...(p.pluginWorkspace.releases||[]),release].slice(-20);
 return {release,zip};
}
