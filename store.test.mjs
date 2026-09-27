import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,utimes} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createStore} from './store.mjs';

test('list and metas come from sidecar meta files, rebuilt when the project file changes outside save',async()=>{
 const root=await mkdtemp(join(tmpdir(),'store-')),store=createStore(root),id=randomUUID();
 await store.save({id,url:'https://a.co',name:'A',status:'draft',revisions:[{}],productCards:[{},{}],existingClient:{username:'u'},sync:{enabled:true},updatedAt:'2026-01-01'});
 assert.deepEqual(await store.list(),[{id,url:'https://a.co',platform:undefined,name:'A',status:'draft',revision:1,products:2,existing:true,updatedAt:'2026-01-01'}]);
 assert.equal((await store.metas())[0].username,'u');
 // An external edit (older sidecar) is detected via mtime and the sidecar is rebuilt.
 const file=join(root,id+'.json'),p=JSON.parse(await readFile(file,'utf8'));p.name='B';await writeFile(file,JSON.stringify(p));await utimes(file,new Date(),new Date(Date.now()+5000));
 const [a,b]=await Promise.all([store.meta(id),store.meta(id)]);assert.equal(a.name,'B');assert.equal(b.name,'B');
 // Legacy project without a sidecar.
 const legacy=randomUUID();await writeFile(join(root,legacy+'.json'),JSON.stringify({id:legacy,name:'L',revisions:[],updatedAt:'2025-01-01'}));
 assert.deepEqual((await store.list()).map(x=>x.name),['B','L']);
});
