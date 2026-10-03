import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,readdir,rm,stat} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';

// One Shopify app per client, kept in a local folder (default ~/Desktop/shopify-apps/<slug>): an extension-only app
// whose only content is the takeover extension exported by core/takeover-export.mjs. Publishing runs Shopify CLI
// without prompts: the first time it creates the app in the chosen organization, every time it writes the current
// export into the folder and deploys it as a new app version. The CLI must already be logged in (`shopify auth login`)
// — the studio never handles Shopify credentials. Nothing is installed on a store: that stays the merchant's click.

export const appsDir=()=>resolve(process.env.SHOPIFY_APPS_DIR||join(process.env.HOME||'','Desktop/shopify-apps'));
// App creation without prompts needs Shopify CLI 4 (`app init --organization-id`).
const cli=()=>(process.env.SHOPIFY_CLI||'npx -y @shopify/cli@latest').trim().split(/\s+/);
const EXTENSION='extensions/semantix-search/';
const exists=async path=>{try{await stat(path);return true;}catch{return false;}};
const clean=s=>s.replace(/\u001b\[[0-9;]*[A-Za-z]/g,'').replace(/[│╭╮╰╯─]/g,'').trim();

// Runs the CLI with no terminal attached, so it can never wait on a prompt. Resolves with its exit code and output.
// engine-strict is off for the `npm install` that `app init` runs in its template: the template pins the newest Node,
// and the scaffold's dependencies are not what gets deployed.
export const runCli=(args,opts)=>{const [cmd,...pre]=cli();return runCommand(cmd,[...pre,...args,'--no-color'],opts);};
export function runCommand(cmd,args,{cwd,onLine=()=>{},timeoutMs=10*60000}={}){
 return new Promise((done,fail)=>{
  const child=spawn(cmd,args,{cwd,stdio:['ignore','pipe','pipe'],env:{...process.env,NO_COLOR:'1',FORCE_COLOR:'0',SHOPIFY_CLI_NO_ANALYTICS:'1',npm_config_engine_strict:'false'}});
  let output='',buffer='';const timer=setTimeout(()=>child.kill('SIGTERM'),timeoutMs);
  const take=chunk=>{output+=chunk;buffer+=chunk;let i;while((i=buffer.indexOf('\n'))>=0){const line=clean(buffer.slice(0,i));buffer=buffer.slice(i+1);if(line&&!/EBADENGINE|npm warn/.test(line))onLine(line);}};
  child.stdout.on('data',d=>take(String(d)));child.stderr.on('data',d=>take(String(d)));
  child.on('error',e=>{clearTimeout(timer);fail(Error(cmd+' לא הופעל: '+e.message));});
  child.on('close',code=>{clearTimeout(timer);done({code,output:clean(output)});});
 });
}
const failure=(what,r)=>Error(`${what} נכשל (Shopify CLI):\n${r.output.split('\n').map(clean).filter(l=>l&&!/EBADENGINE|npm warn/.test(l)).slice(-12).join('\n')}`);

export async function organizations({exec=runCli}={}){
 const r=await exec(['organization','list','--json'],{});
 const json=r.output.slice(r.output.indexOf('{'),r.output.lastIndexOf('}')+1);
 try{return JSON.parse(json).organizations.map(o=>({id:String(o.id),name:o.name}));}catch{throw failure('קריאת הארגונים',r);}
}

// What the folder says about a client's app: linked once shopify.app.toml carries a client id.
export async function readApp(slug){
 const dir=join(appsDir(),slug);let toml='';try{toml=await readFile(join(dir,'shopify.app.toml'),'utf8');}catch{}
 let exported=null;try{exported=JSON.parse(await readFile(join(dir,'semantix-export.json'),'utf8'));}catch{}
 return {dir,clientId:/^client_id\s*=\s*"([^"]+)"/m.exec(toml)?.[1]||null,name:/^name\s*=\s*"([^"]+)"/m.exec(toml)?.[1]||null,exported};
}
export async function settings(){try{return JSON.parse(await readFile(join(appsDir(),'config.json'),'utf8'));}catch{return {};}}

// The export's files into the app folder. The CLI writes each extension's uid into its shopify.extension.toml on the
// first deploy; a new export must keep it, or the next deploy would register a second extension.
export async function syncExtension(dir,{files,manifest}){
 for(const [name,text] of Object.entries(files)){
  if(name==='manifest.json')continue;
  const target=join(dir,name);if(!resolve(target).startsWith(resolve(dir)+'/'))throw Error('נתיב קובץ לא תקין');
  let out=text;
  if(/^extensions\/[^/]+\/shopify\.extension\.toml$/.test(name)){
   let uid=null;try{uid=/^uid\s*=\s*"[^"]+"\s*$/m.exec(await readFile(target,'utf8'))?.[0]||null;}catch{}
   // uid is a top-level key: it goes before the first table of the file.
   if(uid){const at=text.search(/^\[/m);out=at<0?text.replace(/\n*$/,'\n')+uid.trim()+'\n':text.slice(0,at).replace(/\n*$/,'\n')+uid.trim()+'\n\n'+text.slice(at);}
  }
  await mkdir(dirname(target),{recursive:true});
  await writeFile(target,out);
 }
 await writeFile(join(dir,'semantix-export.json'),JSON.stringify(manifest,null,2));
}

// The app's whole configuration: no scopes, no server. It only carries the theme extension.
// The app's whole configuration. Without product sync: no scopes, no server — it only carries the theme extension.
// With it (sync = {applicationUrl, redirectUrl, scopes} from core/shopify-feed.mjs): the app asks for read access to
// products and, when the merchant opens it, lands on the studio, which completes the install and keeps the token.
export const appToml=({clientId,name,apiVersion,sync=null})=>`# Semantix Search — the app of one store. Managed by Tenant Studio (core/shopify-apps.mjs); rewritten on every publish.

client_id = "${clientId}"
name = "${name}"
application_url = "${sync?sync.applicationUrl:'https://shopify.dev/apps/default-app-home'}"
embedded = ${sync?'false':'true'}

[build]
include_config_on_deploy = true

[webhooks]
api_version = "${apiVersion}"

[access_scopes]
scopes = "${sync?sync.scopes:''}"

[auth]
redirect_urls = [ "${sync?sync.redirectUrl:'https://shopify.dev/apps/default-app-home/api/auth'}" ]
`;
// Extensions with their own dependencies (the web pixel) are npm workspaces of the app.
const appPackage=slug=>JSON.stringify({name:'semantix-'+slug,version:'1.0.0',private:true,license:'UNLICENSED',workspaces:['extensions/*'],scripts:{shopify:'shopify',deploy:'shopify app deploy',info:'shopify app info'}},null,2)+'\n';
async function createApp(dir,{name,slug,organizationId,exec,onLine}){
 // `app init` is the only way to create an app without prompts. Its template is a sample app (product scopes, sample
 // extensions, metaobjects) that a search extension must not ship, so it is scaffolded in a scratch folder and only
 // the new app's client id is taken from it.
 const scratch=join(appsDir(),'.init-'+Date.now());await mkdir(scratch,{recursive:true});
 try{
  const r=await exec(['app','init','--template','none','--name',name,'--organization-id',organizationId,'--path',scratch,'--package-manager','npm'],{onLine});
  let toml=null;for(const d of await readdir(scratch))try{toml=await readFile(join(scratch,d,'shopify.app.toml'),'utf8');}catch{}
  const clientId=/^client_id\s*=\s*"([a-f0-9]{16,64})"/m.exec(toml||'')?.[1];
  if(r.code!==0||!clientId)throw failure('יצירת האפליקציה',r);
  await mkdir(dir,{recursive:true});
  await writeFile(join(dir,'shopify.app.toml'),appToml({clientId,name,apiVersion:/^api_version\s*=\s*"([\d-]+)"/m.exec(toml)?.[1]||'2026-10'}));
  await writeFile(join(dir,'package.json'),appPackage(slug));
 }finally{await rm(scratch,{recursive:true,force:true});}
}

// built: {manifest,files} from buildShopifyTakeover. Returns the app's client id and the deployed version tag.
export async function publishToShopify(built,{organizationId,appName,sync=null,onLine=()=>{},exec=runCli,npm=(args,opts)=>runCommand('npm',args,opts),now=new Date()}={}){
 const root=appsDir(),slug=built.manifest.slug;
 if(!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug))throw Error('שם תיקייה לא תקין ללקוח');
 if(!await exists(root))throw Error(`תיקיית האפליקציות לא קיימת: ${root} (אפשר להגדיר SHOPIFY_APPS_DIR)`);
 let app=await readApp(slug),created=false;
 if(!app.clientId){
  organizationId=String(organizationId||(await settings()).organizationId||'');
  if(!/^\d{3,20}$/.test(organizationId))throw Error('יש לבחור ארגון Shopify שבו תיווצר האפליקציה');
  const name=String(appName||'semantix-'+slug).trim();
  if(!/^[\p{L}\p{N}][\p{L}\p{N} ._-]{2,29}$/u.test(name))throw Error('שם אפליקציה: 3–30 תווים — אותיות, ספרות, רווח, נקודה או מקף');
  onLine(`יוצר אפליקציה "${name}" בארגון ${organizationId}…`);
  await createApp(app.dir,{name,slug,organizationId,exec,onLine});
  app=await readApp(slug);if(!app.clientId)throw Error('האפליקציה נוצרה אך shopify.app.toml לא קיבל client_id');
  created=true;
  const saved=await settings();if(!saved.organizationId)await writeFile(join(root,'config.json'),JSON.stringify({...saved,organizationId},null,2));
 }
 // The configuration follows the studio's current setup (product sync on or off) on every publish.
 const tomlPath=join(app.dir,'shopify.app.toml'),current=await readFile(tomlPath,'utf8');
 await writeFile(tomlPath,appToml({clientId:app.clientId,name:app.name||'semantix-'+slug,apiVersion:/^api_version\s*=\s*"([\d-]+)"/m.exec(current)?.[1]||'2026-10',sync}));
 await syncExtension(app.dir,built);
 // The web pixel is bundled by the CLI from source and needs its package installed.
 if(Object.keys(built.files).some(n=>n.startsWith('extensions/semantix-pixel/'))){
  await writeFile(join(app.dir,'package.json'),appPackage(slug));
  if(!await exists(join(app.dir,'node_modules/@shopify/web-pixels-extension/package.json'))){
   onLine('מתקין את חבילת ה־Web Pixel (npm install)…');
   const i=await npm(['install','--no-audit','--no-fund','--engine-strict=false'],{cwd:app.dir,onLine});
   if(i.code!==0)throw failure('npm install',i);
  }
 }
 const version=`sx-${built.manifest.version}-${now.toISOString().replace(/\D/g,'').slice(2,12)}`;
 onLine('פורס גרסה '+version+'…');
 const r=await exec(['app','deploy','--path',app.dir,'--allow-updates','--version',version,'--message',`Semantix configuration ${built.manifest.version}`],{onLine});
 if(r.code!==0)throw failure('הפריסה',r);
 return {slug,dir:app.dir,clientId:app.clientId,name:app.name,created,version,productSync:!!sync,configuration:built.manifest.version,siteKey:built.manifest.siteKey,deployedAt:now.toISOString(),
  url:/https:\/\/(?:dev|partners)\.shopify\.com\/\S*\/apps\/[^\s\]]+/.exec(r.output)?.[0]||null};
}
