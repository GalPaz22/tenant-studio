import {mkdir,writeFile,rename,readFile,stat,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {homedir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {buildMiniServer,slugOf,moduleCode} from '../mini-server.mjs';
import {publishModule} from './module-publish.mjs';

// Writes a tenant's mini server straight into the local dashboard-server checkout (tenants/<slug>/ + the registry).
// Nothing is committed or pushed; the module answers only when the merchant's user document switches it on
// (users.users → semantix:{module:<slug>, enabled:true}), which the studio's production panel writes.
// Only code goes to disk: the module's data (approved profile + enriched cards) is published to the store's database
// (semantix_module), which is also where every later approved revision goes — see core/module-publish.mjs.
// A folder the studio did not create (no semantix.module.json, e.g. tenants/garmin) is never overwritten; the previous
// module version is moved to the studio's backups before the new one takes its place.
export const REGISTRY_MARK='Mounts every tenants/<slug>/ folder that has a semantix.module.json';
export function dashboardDir(){const dir=resolve(process.env.STUDIO_DASHBOARD_DIR||join(homedir(),'Desktop','dashboard-server'));return dir;}
export async function dashboardStatus(dir=dashboardDir()){
 if(!existsSync(join(dir,'server.js'))||!existsSync(join(dir,'tenants')))return {dir,found:false};
 const server=await readFile(join(dir,'server.js'),'utf8');
 return {dir,found:true,wired:server.includes("semantix-registry.mjs")&&server.includes('semantixTenants.search')&&server.includes('semantixTenants.loadMore'),userField:/semantix:\s*userDoc\.semantix/.test(server)};
}
const run=(cmd,args,opts)=>new Promise(res=>execFile(cmd,args,{timeout:60000,maxBuffer:4e6,...opts},(error,stdout,stderr)=>res({ok:!error,out:String(stdout),err:String(stderr||error?.message||'')})));

export async function exportToDashboard(project,{dir=dashboardDir(),backups,check=true,publish=publishModule}={}){
 const status=await dashboardStatus(dir);if(!status.found)throw Error(`לא נמצא dashboard-server ב־${dir} (הגדירו STUDIO_DASHBOARD_DIR)`);
 // A hand-written tenant folder with the same name (e.g. tenants/garmin) is never touched: the studio's module takes
 // "<slug>-semantix" instead — stable across exports, so tokens, sessions and the production switch keep their name.
 const tenants=join(dir,'tenants'),foreign=s=>existsSync(join(tenants,s))&&!existsSync(join(tenants,s,'semantix.module.json'));
 let slug=project.dashboardExport?.slug||slugOf(project);if(foreign(slug))slug=slugOf(project)+'-semantix';
 if(foreign(slug))throw Error(`התיקיות tenants/${slugOf(project)} ו־tenants/${slug} קיימות ולא נוצרו בסטודיו — לא דורס אותן`);
 const {manifest,files}=buildMiniServer(project,{slug}),target=join(tenants,manifest.slug);
 const registry=join(tenants,'semantix-registry.mjs');
 if(existsSync(registry)&&!(await readFile(registry,'utf8')).includes(REGISTRY_MARK))throw Error('tenants/semantix-registry.mjs קיים ולא נוצר בסטודיו — לא דורס אותו');
 // Stage the new folder beside the old one, then swap, so the server never sees a half-written module.
 const published=await publish(project,manifest.slug);
 const staging=join(tenants,`.semantix-${manifest.slug}-${randomUUID().slice(0,8)}`);
 try{
  for(const [name,content] of Object.entries(files)){if(name==='tenants/semantix-registry.mjs'||/\/(snapshot|profile)\.json$/.test(name))continue;const rel=name.slice(`tenants/${manifest.slug}/`.length),file=join(staging,rel);await mkdir(dirname(file),{recursive:true});await writeFile(file,content);}
  let backup=null;
  if(existsSync(target)){backup=join(backups,`${manifest.slug}-${new Date().toISOString().replace(/[:.]/g,'-')}`);await mkdir(backups,{recursive:true});await rename(target,backup);}
  await rename(staging,target);
  await writeFile(registry,files['tenants/semantix-registry.mjs']);
  let verified=null;
  if(check){const r=await run(process.execPath,['--input-type=module','-e',`const m=await import(${JSON.stringify('file://'+join(target,'index.mjs'))});const routes=m.createTenantRoutes({getDb:async()=>{throw Error('no db in check')}});console.log(JSON.stringify(routes.manifest));`],{cwd:dir});
   verified={ok:r.ok,error:r.ok?null:r.err.split('\n').filter(Boolean).slice(-3).join(' | ')};}
  return {slug:manifest.slug,path:target,manifest,published,backup,wired:status.wired,verified,enable:`users.users → semantix:{module:"${manifest.slug}",enabled:true}`};
 }finally{await rm(staging,{recursive:true,force:true});}
}

// Does production need a commit? Only when module code changed: the studio's engine differs from what was exported
// (re-export), or the exported folder/registry is not committed or not pushed in the dashboard-server checkout.
export async function codeStatus(project,{dir=dashboardDir()}={}){
 const slug=project.dashboardExport?.slug;if(!slug)return null;
 const folder=join(dir,'tenants',slug),code=moduleCode(),differs=[];
 for(const [name,content] of Object.entries(code)){let disk=null;try{disk=await readFile(join(folder,name),'utf8');}catch{}if(disk!==content)differs.push(name.replace('../',''));}
 const engineChanged=differs.length>0,paths=[`tenants/${slug}`,'tenants/semantix-registry.mjs'];
 const status=await run('git',['status','--porcelain','--',...paths],{cwd:dir}),ahead=await run('git',['log','--oneline','@{u}..HEAD','--',...paths],{cwd:dir});
 const uncommitted=status.ok&&status.out.trim()!=='',unpushed=ahead.ok&&ahead.out.trim()!=='';
 return {engineChanged,changedFiles:differs.slice(0,10),uncommitted,unpushed,git:status.ok,action:engineChanged?'export':uncommitted?'commit':unpushed?'push':null};
}
