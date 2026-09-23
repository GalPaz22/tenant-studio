import {MongoClient} from 'mongodb';
import {createDraftRuntime,indexDefinition} from './runtime.mjs';
export async function provision(project,buildId=null) {
 if(!process.env.MONGODB_URI)throw Error('נדרש MONGODB_URI');
 if(!project.catalog?.products?.length)throw Error('אין קטלוג לייבוא');
 const mongo=new MongoClient(process.env.MONGODB_URI,{maxPoolSize:2,serverSelectionTimeoutMS:10000});
 const dbName='studio_'+project.id.replaceAll('-','');
 try {
  await mongo.connect();const db=mongo.db(dbName),collection=db.collection(buildId?'products_'+buildId.replaceAll('-',''):'products');
  await collection.createIndex({tenantId:1,id:1},{unique:true});
  await collection.createIndex({stockStatus:1,price:1});
  const normalized=project.productCards||createDraftRuntime(project,project.revisions.at(-1)).products;
  for(let start=0;start<normalized.length;start+=100){
   const writes=normalized.slice(start,start+100).map(p=>({updateOne:{filter:{id:p.id},update:{$set:{...p,name:p.title,studioProject:project.id,...(project.vectorIndex?.vectors[p.id]?{embedding:project.vectorIndex.vectors[p.id]}:{})}},upsert:true}}));await collection.bulkWrite(writes,{ordered:false});
  }
  let atlas='not-created';
  let error=null,searchChecks=[],vectorStatus=project.vectorIndex?'pending':'not-requested';
  try {const definition=indexDefinition(project.revisions.at(-1).profile);const existing=await collection.listSearchIndexes(definition.name).toArray();if(!existing.length)await collection.createSearchIndex(definition);else if(JSON.stringify(existing[0].latestDefinition)!==JSON.stringify(definition.definition))await collection.updateSearchIndex(definition.name,definition.definition);
   atlas='requested-check-atlas-readiness';
   if(buildId){const deadline=Date.now()+45000;while(Date.now()<deadline){const [status]=await collection.listSearchIndexes(definition.name).toArray();if(status?.queryable&&status.status==='READY'){atlas='ready';break;}await new Promise(r=>setTimeout(r,1500));}
    if(atlas==='ready')for(const p of normalized.slice(0,5)){const hits=await collection.aggregate([{$search:{index:definition.name,equals:{path:'id',value:p.id}}},{$match:{tenantId:project.id}},{$limit:5}],{maxTimeMS:10000}).toArray();searchChecks.push({id:p.id,passed:hits.some(h=>h.id===p.id)});}
    if(searchChecks.some(c=>!c.passed))atlas='validation-failed';
    if(project.vectorIndex){const name='tenant_vectors_v1',definition={fields:[{type:'vector',path:'embedding',numDimensions:project.vectorIndex.dimensions,similarity:'cosine'},{type:'filter',path:'tenantId'}]};const [existingVector]=await collection.listSearchIndexes(name).toArray();if(!existingVector)await collection.createSearchIndex({name,type:'vectorSearch',definition});
     const deadline=Date.now()+15000;while(Date.now()<deadline){const [status]=await collection.listSearchIndexes(name).toArray();if(status?.queryable&&status.status==='READY'){const p=normalized[0],hits=await collection.aggregate([{$vectorSearch:{index:name,path:'embedding',queryVector:project.vectorIndex.vectors[p.id],numCandidates:10,limit:5,filter:{tenantId:project.id}}},{$project:{id:1}}],{maxTimeMS:10000}).toArray();vectorStatus=hits.some(h=>h.id===p.id)?'ready':'validation-failed';break;}await new Promise(r=>setTimeout(r,1000));}}
   }
  }catch(e){atlas='requires-atlas-search-permission-or-supported-cluster';error=e.message;}
  return {dbName,collection:collection.collectionName,indexName:'tenant_products_v1',products:normalized.length,atlas,vectorStatus,error,searchChecks,message:`סביבת בדיקה ${dbName}, עם ${normalized.length} מוצרים. סטטוס Atlas: ${atlas}.`};
 }finally{await mongo.close()}
}
