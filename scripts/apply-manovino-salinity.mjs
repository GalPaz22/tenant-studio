// Mano Vino: wines whose tasting notes mention salinity get salinity tags, so "מלוח" / "מליחות" return them.
// Saves a new local revision (backup first). Publishing the module is a separate step.
import {readFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createStore} from '../store.mjs';
import {hash} from '../core/hash.mjs';
import {withSalinity} from './manovino-salinity.mjs';
const root=resolve(new URL('../',import.meta.url).pathname),id='2b3f29d3-1caf-4193-a527-d7da17bbae85',file=resolve(root,'data',id+'.json');
const p=JSON.parse(await readFile(file,'utf8')),base=p.revisions.at(-1),profile=withSalinity(base.profile);
if(hash(profile)===hash(base.profile)){console.log('already applied');process.exit(0);}
await copyFile(file,resolve(root,'data/backups',id+'.before-salinity-r'+base.number+'-'+Date.now()+'.json'));
const at=new Date().toISOString(),number=base.number+1;
p.revisions.push({number,profile,createdAt:at,note:'תיוג מליחות ליינות לפי תיאור הטעימה (מלוח / מליחות)',changes:['hooks']});
p.productCardsProfileHash=hash(profile);p.mongoPolicyDirty=true;p.updatedAt=at;
(p.events??=[]).push({at,text:'יינות עם מליחות בתיאור מקבלים תגיות מלוח/מליחות, כך שחיפוש "מלוח" מחזיר יינות'});
await createStore(resolve(root,'data')).save(p);console.log('saved revision',number);
