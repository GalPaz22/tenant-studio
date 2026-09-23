import {mkdir,readFile,writeFile,rename,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
export function createRunStore(root) {
  const folder=id=>{if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Invalid run ID');return join(root,id)};
  const key=k=>{if(!/^[a-zA-Z0-9_-]+$/.test(k))throw Error('Invalid asset key');return k};
  async function write(file,value){await mkdir(join(file,'..'),{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(value),{mode:0o600});await rename(tmp,file)}
  return {
    async read(id){return JSON.parse(await readFile(join(folder(id),'run.json'),'utf8'))},
    async save(run){run.updatedAt=new Date().toISOString();await write(join(folder(run.id),'run.json'),run);return run},
    async asset(id,name,value){const file=join(folder(id),key(name)+'.json');if(value!==undefined){await write(file,value);return value;}return JSON.parse(await readFile(file,'utf8'));},
    async control(id,value){const file=join(folder(id),'control.json');if(value!==undefined){await write(file,value);return value;}try{return JSON.parse(await readFile(file,'utf8'))}catch(e){if(e.code==='ENOENT')return {action:'run'};throw e;}},
    async cachedSource(url,value){const name=createHash('sha256').update(url).digest('hex'),file=join(root,'_public-sources',name+'.json');if(value!==undefined){await write(file,{url,value,at:Date.now()});return value;}try{const entry=JSON.parse(await readFile(file,'utf8'));return Date.now()-entry.at<86400000?entry.value:null;}catch(e){if(e.code==='ENOENT')return null;throw e;}},
    async list(){await mkdir(root,{recursive:true});const ids=(await readdir(root)).filter(x=>/^[a-f0-9-]{36}$/.test(x));return Promise.all(ids.map(id=>this.read(id)));}
  };
}
