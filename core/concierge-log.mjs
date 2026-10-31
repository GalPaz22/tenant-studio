import {mkdir,appendFile,readFile} from 'node:fs/promises';
// Shopper conversations are kept beside the project, one JSON line per turn, so saving a turn never rewrites the
// (large) project file and concurrent turns cannot overwrite each other.
const ID=/^[a-f0-9-]{36}$/;
export function createConciergeLog(root){
 const path=id=>{if(!ID.test(id))throw Error('Invalid project ID');return `${root}/${id}.jsonl`};
 return {
  path,
  async append(projectId,{conversationId,message,trigger=null,reply=null,products=[],steps=[],error=null}){
   if(!ID.test(String(conversationId)))throw Error('מזהה שיחה לא תקין');
   // Saved in full: a transcript is the record of what the shopper wrote and was shown, so nothing is cut.
   const turn={conversationId,at:new Date().toISOString(),message:String(message||''),reply:reply===null?null:String(reply),
    products:(products||[]).map(p=>({id:p.id,title:p.title,price:p.price??null})),steps:steps||[],
    ...(trigger?{trigger:{reason:trigger.reason||null,query:typeof trigger.query==='string'?trigger.query:null}}:{}),...(error?{error:String(error)}:{})};
   await mkdir(root,{recursive:true});await appendFile(path(projectId),JSON.stringify(turn)+'\n',{mode:0o600});return turn;
  },
  // Newest conversation first; turns inside a conversation in the order they happened.
  async list(projectId,limit=50){
   let raw;try{raw=await readFile(path(projectId),'utf8')}catch(e){if(e.code!=='ENOENT')throw e;return {total:0,conversations:[]};}
   const byId=new Map();
   for(const line of raw.split('\n')){if(!line)continue;let t;try{t=JSON.parse(line)}catch{continue}
    const {conversationId,trigger,...turn}=t;if(!byId.has(conversationId))byId.set(conversationId,{id:conversationId,startedAt:t.at,trigger:trigger||null,turns:[]});
    const c=byId.get(conversationId);c.turns.push(turn);c.updatedAt=t.at;}
   const all=[...byId.values()].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
   return {total:all.length,conversations:all.slice(0,limit)};
  }
 };
}
