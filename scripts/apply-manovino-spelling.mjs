// Mano Vino: normalize the spelling סוביניון → סובניון in transformProduct so catalog syncs keep it.
// Saves a new local revision (backup first). Publishing the module is a separate step.
import {readFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createStore} from '../store.mjs';
import {hash} from '../core/hash.mjs';
import {withSpelling} from './manovino-spelling.mjs';
const root=resolve(new URL('../',import.meta.url).pathname),id='2b3f29d3-1caf-4193-a527-d7da17bbae85',file=resolve(root,'data',id+'.json');
const p=JSON.parse(await readFile(file,'utf8')),base=p.revisions.at(-1),profile=withSpelling(base.profile);
if(hash(profile)===hash(base.profile)){console.log('already applied');process.exit(0);}
await copyFile(file,resolve(root,'data/backups',id+'.before-spelling-r'+base.number+'-'+Date.now()+'.json'));
const at=new Date().toISOString(),number=base.number+1;
p.revisions.push({number,profile,createdAt:at,note:'כתיב אחיד: סוביניון → סובניון',changes:['hooks']});
p.productCardsProfileHash=hash(profile);p.mongoPolicyDirty=true;p.updatedAt=at;
(p.events??=[]).push({at,text:'נירמול כתיב: "סוביניון" הופך ל"סובניון" בכל המוצרים בכל סנכרון'});
await createStore(resolve(root,'data')).save(p);console.log('saved revision',number);
