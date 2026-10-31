import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createCustomerProjectRecovery,encodeCustomerProject,decodeCustomerProject,loadCustomerCatalog} from './core/customer-project.mjs';
import {customerProjectId} from './core/customer-chat.mjs';
const project=(dbName='beautics')=>({id:randomUUID(),existingClient:{dbName},productCards:[{id:'123',title:'סרום'}],revisions:[{number:1,profile:{}}],messages:[{role:'user',text:'PRIVATE OPERATOR CHAT'}],events:[],pluginWorkspace:{secret:'private'},takeover:{token:'secret'}});
const memory=()=>{const rows=new Map();return {rows,async metas(){return [...rows.values()].map(p=>({id:p.id,dbName:p.existingClient.dbName}));},async save(p){rows.set(p.id,p);},async read(id){return rows.get(id);}};};
function database(snapshot=null){return {snapshot,writes:0,dbs:[],db(name){this.dbs.push(name);return {collection:()=>({findOne:async()=>this.snapshot,updateOne:async(_q,op)=>{this.writes++;this.snapshot??=op.$setOnInsert;}})};}};}
test('checkpoint keeps the actual catalog/rules and excludes private operator state; rejects foreign snapshots',()=>{
 const p=project(),encoded=encodeCustomerProject(p),decoded=decodeCustomerProject(encoded,'beautics');
 assert.deepEqual(decoded.productCards,p.productCards);assert.deepEqual(decoded.revisions,p.revisions);assert.deepEqual(decoded.messages,[]);assert.equal(decoded.pluginWorkspace,undefined);assert.equal(decoded.takeover,undefined);
 assert.throws(()=>decodeCustomerProject(encoded,'foreign'));assert.throws(()=>decodeCustomerProject({...encoded,projectId:randomUUID()},'beautics'));
});
test('fresh production disk restores saved Beautics project once without importing or publishing',async()=>{
 const p=project(),db=database(encodeCustomerProject(p)),store=memory();let loads=0;
 const recover=createCustomerProjectRecovery(store,{mongo:async()=>db,load:async()=>{loads++;}});
 const ids=await Promise.all([recover('beautics'),recover('beautics')]);assert.deepEqual(ids,[p.id,p.id]);assert.equal(loads,0);assert.equal(store.rows.size,1);assert.equal(db.writes,0);assert.deepEqual(db.dbs,['beautics']);
 assert.equal(await recover('beautics'),p.id);assert.equal(db.dbs.length,1);
});
test('new customer imports real tenant catalog once, checkpoints it and can recover after a restart',async()=>{
 const p=project(),db=database(),store=memory();let loads=0;
 const recover=createCustomerProjectRecovery(store,{mongo:async()=>db,load:async name=>{assert.equal(name,'beautics');loads++;return p;}});
 assert.equal(await customerProjectId(store,'beautics',{},recover),p.id);assert.equal(loads,1);assert.equal(db.writes,1);
 const fresh=memory(),restore=createCustomerProjectRecovery(fresh,{mongo:async()=>db,load:async()=>assert.fail('should restore')});
 assert.equal(await restore('beautics'),p.id);
});
test('ambiguity and explicit mapping never trigger automatic provisioning',async()=>{
 const store=memory();await store.save(project());await store.save(project());
 await assert.rejects(()=>customerProjectId(store,'beautics',{},()=>assert.fail('ambiguous')),{status:409});
 assert.equal(await customerProjectId(store,'other',{STUDIO_CUSTOMER_PROJECTS:JSON.stringify({other:'configured'})},()=>assert.fail('configured')),'configured');
});
test('failed/foreign import leaves no checkpoint or local project and can be retried',async()=>{
 const db=database(),store=memory();let fail=true;
 const recover=createCustomerProjectRecovery(store,{mongo:async()=>db,load:async()=>{if(fail)throw Error('temporary DB failure');return project('foreign');}});
 await assert.rejects(()=>recover('beautics'),/temporary/);fail=false;await assert.rejects(()=>recover('beautics'),/אינו שייך/);assert.equal(store.rows.size,0);assert.equal(db.writes,0);
});
test('catalog import scopes products to verified store and closes cursor on empty catalog',async()=>{
 const dbs=[];let closed=0;const cursor={batchSize(){return this;},limit(){return this;},async *[Symbol.asyncIterator](){},async close(){closed++;}};
 const mongo=async()=>({db(name){dbs.push(name);return {collection(){return {findOne:async q=>{assert.deepEqual(q,{dbName:'beautics'});return {dbName:'beautics',name:'ביוטיקס'};},find:()=>cursor};}};}});
 await assert.rejects(()=>loadCustomerCatalog('beautics',{mongo}),/לא נמצאו/);assert.deepEqual(dbs,['users','beautics']);assert.equal(closed,1);
});
