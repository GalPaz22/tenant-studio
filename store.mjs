import {mkdir,readFile,writeFile,rename,readdir,stat} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
// Each project also keeps a small <id>.meta.json beside it, so listing and background ticks never parse
// full project files (they can exceed 100MB). The meta records the project file's mtime and is rebuilt when stale.
export function metaOf(p){
 return {id:p.id,url:p.url,platform:p.platform,name:p.name,status:p.status,revision:p.revisions?.length||0,products:p.productCards?.length||0,existing:!!p.existingClient,updatedAt:p.updatedAt,
  username:p.existingClient?.username||null,tagging:!!p.tagging,sync:p.sync||null,feed:p.shopifyFeed||null,pixel:p.shopifyPixel?.settingsHash||null,pendingSyncEvents:p.pendingSyncEvents?.length||0,latestBuildId:p.latestBuildId||null,buildRunId:p.buildRunId||null,crawler:p.crawler||null,siteCrawlPages:p.siteCrawl?.pages||0};
}
const LIST_FIELDS=['id','url','platform','name','status','revision','products','existing','updatedAt'];
export function createStore(root) {
 const path=id=>{if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Invalid project ID');return `${root}/${id}.json`};
 const metaPath=id=>`${root}/${id}.meta.json`;
 async function writeMeta(project,mtimeMs){const file=metaPath(project.id),temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify({...metaOf(project),mtimeMs}),{mode:0o600});await rename(temp,file);}
 const rebuilding=new Map();
 async function meta(id){
  const {mtimeMs}=await stat(path(id));
  try{const m=JSON.parse(await readFile(metaPath(id),'utf8'));if(m.mtimeMs===mtimeMs)return m;}catch{}
  // Concurrent callers share one full parse of the project file.
  const key=id+':'+mtimeMs;
  if(!rebuilding.has(key))rebuilding.set(key,(async()=>{const project=JSON.parse(await readFile(path(id),'utf8'));await writeMeta(project,mtimeMs);return {...metaOf(project),mtimeMs};})().finally(()=>rebuilding.delete(key)));
  return rebuilding.get(key);
 }
 async function metas(){
  await mkdir(root,{recursive:true});
  const ids=(await readdir(root)).map(f=>/^([a-f0-9-]{36})\.json$/.exec(f)?.[1]).filter(Boolean);
  const results=[];for(const id of ids){try{results.push(await meta(id))}catch(e){if(e.code!=='ENOENT')throw e}}
  return results.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
 }
 return {
  async read(id){return JSON.parse(await readFile(path(id),'utf8'))},
  async save(project){await mkdir(root,{recursive:true});const file=path(project.id),temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(project),{mode:0o600});await rename(temp,file);await writeMeta(project,(await stat(file)).mtimeMs);return project},
  async list(){return (await metas()).map(m=>Object.fromEntries(LIST_FIELDS.map(k=>[k,m[k]])))},
  meta,metas
 };
}
