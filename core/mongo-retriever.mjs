import {MongoClient} from 'mongodb';
import {planQuery,normalize} from './core.mjs';
let mongo;
export async function createMongoRetriever(products,profile,connection) {
  if(!process.env.MONGODB_URI)throw Error('נדרש MONGODB_URI');
  mongo??=new MongoClient(process.env.MONGODB_URI,{maxPoolSize:4,serverSelectionTimeoutMS:10000});await mongo.connect();
  const collection=mongo.db(connection.dbName).collection(connection.collection),byId=new Map(products.map(p=>[p.id,p]));
  return async query=>{
    const plan=planQuery(query,profile),base=[{equals:{path:'tenantId',value:profile.tenantId}}];
    const identity=await collection.aggregate([{$search:{index:connection.indexName,compound:{filter:base,should:['id','sku','mpn','gtin','variants.id','variants.sku','variants.mpn','variants.gtin'].map(path=>({equals:{path,value:query}})),minimumShouldMatch:1}}},{$match:{hidden:{$ne:true},stockStatus:'instock'}},{$project:{id:1}}],{maxTimeMS:10000}).toArray();
    let hits=identity;
    if(!hits.length){const filter=[...base,{equals:{path:'stockStatus',value:'instock'}},{equals:{path:'hidden',value:false}}];
      if(plan.productType)filter.push({equals:{path:'productType',value:plan.productType}});
      for(const [path,values] of [['colors',plan.colors],['finishes',plan.finishes],['tags',plan.tags]])for(const value of values)filter.push({equals:{path,value}});
      if(plan.maxPrice!==null)filter.push({range:{path:'price',lte:plan.maxPrice}});
      const run=fuzzy=>collection.aggregate([{$search:{index:connection.indexName,compound:{filter,...(plan.terms.length?{must:plan.terms.map(term=>({text:{query:term,path:['name','description',{wildcard:'specifications.*'}],...(fuzzy&&term.length>=4&&!/\d/.test(term)&&{fuzzy:{maxEdits:term.length>=8?2:1,maxExpansions:50}})}}))}:{})}}},{$project:{id:1}}],{maxTimeMS:10000}).toArray();
      hits=await run(false);
      if(!hits.length&&plan.terms.some(t=>t.length>=4&&!/\d/.test(t))){hits=await run(true);if(hits.length)plan.corrections=[{kind:'atlas-fuzzy'}];}
    }
    const matches=hits.map(h=>byId.get(h.id)).filter(Boolean).map(p=>{if(!identity.length)return p;const variant=(p.variants||[]).find(v=>[v.id,v.sku,v.mpn,v.gtin].filter(Boolean).some(id=>normalize(id)===normalize(query)));return variant?variant.stockStatus==='outofstock'?null:{...p,matchedVariant:variant}:p;}).filter(Boolean);
    return {status:matches.length?'matched':'empty',plan:identity.length?{strategy:'identifier'}:plan,matches,total:matches.length,nextCursor:null,indexKind:'atlas'};
  };
}
