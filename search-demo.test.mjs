import test from 'node:test';import assert from 'node:assert/strict';import {ObjectId} from 'mongodb';
import {checkedLayout,saveSearchLayout,readSearchLayout} from './core/dashboard/merchandising/search-layout.js';import {configureDashboardStorage} from './core/dashboard/core/db.js';
const id=n=>n.toString(16).padStart(24,'0'),body=()=>({query:'  סרום  לפנים ',productIds:[id(1)],excludedProductIds:[id(2)],revision:null,by:'owner'});
test('query layout requires canonical identities, disjoint lists and explicit optimistic revision',()=>{
 assert.equal(checkedLayout(body()).query,'סרום לפנים');
 for(const delta of [{revision:undefined},{productIds:['foreign']},{excludedProductIds:[id(1)]},{productIds:Array(51).fill(id(1))},{query:''}])assert.throws(()=>checkedLayout({...body(),...delta}));
});
function fixture(){
 const rules=[],audits=[],rows=[1,2,3].map(n=>({_id:new ObjectId(id(n)),id:n,name:'Product '+n,stockStatus:'instock'}));let failAudit=false;
 const client={startSession:()=>({async withTransaction(fn){const before=rules.map(x=>({...x})),oldAudit=audits.length;try{await fn();}catch(e){rules.splice(0,rules.length,...before);audits.splice(oldAudit);throw e;}},async endSession(){}}),db(name){return {collection(collection){
  if(name==='own'&&collection==='products')return {find(q){const selected=q._id?.$in?rows.filter(p=>q._id.$in.some(x=>String(x)===String(p._id))):rows;return {async toArray(){return selected;}};}};
  if(collection==='catalog_change_audits')return {async insertOne(row){if(failAudit)throw Error('Audit down');audits.push(row);}};
  if(collection==='rules')return {async createIndex(){},async findOne(q){return rules.find(x=>x.dbName===q.dbName&&x.merchantQuery===q.merchantQuery)||null;},async insertOne(row){rules.push({...row,_id:new ObjectId()});},async updateOne(q,update){const n=rules.findIndex(x=>String(x._id)===String(q._id)&&x.updatedAt===q.updatedAt);if(n<0)return {matchedCount:0};rules[n]={...rules[n],...update.$set};return {matchedCount:1};}};
  throw Error('Unexpected tenant/collection: '+name+'.'+collection);
 }};}};
 return {client,rules,rows,audits,failAudit(){failAudit=true;}};
}
test('save scopes products to store, rejects stale edits and atomically records query-only removals',async()=>{
 const f=fixture();configureDashboardStorage({mongo:f.client,redis:null});try{
  const first=await saveSearchLayout({dbName:'own',apiKey:'fixture'},body());assert.equal(first.saved,true);assert.equal(first.published,false);assert.deepEqual(f.rules[0].patch.excludedProductIds,[id(2)]);assert.equal(f.rules[0].condition.matchType,'exact');assert.equal(f.audits.length,1);
  await assert.rejects(()=>saveSearchLayout({dbName:'own',apiKey:'fixture'},body()),{status:409});
  await assert.rejects(()=>saveSearchLayout({dbName:'own',apiKey:'fixture'},{...body(),revision:first.revision,productIds:[id(999)]}),/אינו שייך/);
  const snapshot=await readSearchLayout({dbName:'own'},'סרום לפנים',[{id:'tenant:1'},{id:3}]);assert.deepEqual(snapshot.products.map(p=>p._id),[id(1),id(3)]);assert.equal(snapshot.excludedProducts[0]._id,id(2));
  f.failAudit();await assert.rejects(()=>saveSearchLayout({dbName:'own',apiKey:'fixture'},{...body(),revision:first.revision,productIds:[],excludedProductIds:[]}),/Audit down/);assert.equal(f.rules[0].status,'active');
 }finally{configureDashboardStorage(null);}
});
