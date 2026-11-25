// Mano Vino: fix the spelling סוביניון → סובניון in the project's own catalog (a hook cannot change a title), then rebuild the
// product cards and the search index from it. Backup first; publishing is a separate step (scripts/publish-manovino.mjs).
import {readFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createStore} from '../store.mjs';
import {hash} from '../core/hash.mjs';
import {createDraftRuntime} from '../runtime.mjs';
const root=resolve(new URL('../',import.meta.url).pathname),id='2b3f29d3-1caf-4193-a527-d7da17bbae85',file=resolve(root,'data',id+'.json');
const p=JSON.parse(await readFile(file,'utf8')),rev=p.revisions.at(-1),count=s=>(s.match(/סוביניון/g)||[]).length;
const fix=v=>typeof v==='string'?v.replace(/סוביניון/g,'סובניון'):Array.isArray(v)?v.map(fix):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,fix(x)])):v;
const before=count(JSON.stringify(p.catalog.products))+count(JSON.stringify(p.productCards||[]));
const catalog=fix(p.catalog);
const rt=createDraftRuntime({...p,catalog,productCards:null,searchIndex:null,productCardsProfileHash:null},rev);
const after=count(JSON.stringify(catalog.products))+count(JSON.stringify(rt.products));
console.log('cards',rt.products.length,'old spelling before',before,'after',after);
if(process.argv.includes('--dry')||after>=before)process.exit(0);
await copyFile(file,resolve(root,'data/backups',id+'.before-cards-r'+rev.number+'-'+Date.now()+'.json'));
p.catalog=catalog;p.productCards=rt.products;p.searchIndex=rt.index;p.productCardsProfileHash=hash(rev.profile);p.updatedAt=new Date().toISOString();
await createStore(resolve(root,'data')).save(p);console.log('saved');
