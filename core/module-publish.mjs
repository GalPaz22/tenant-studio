import {MongoClient} from 'mongodb';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {storeDbName} from './production-control.mjs';

// The data half of a tenant module lives in the merchant's own database, not in git:
//   <dbName>.semantix_module → {_id:"<slug>:head", revision, digest, parts, …}      one small pointer document
//                              {_id:"<slug>:<digest>:<i>", kind:"part", data:<gzip>} the edition, in ≤8 MB parts
// An edition is the approved revision's profile (rules, ranking, functions, pipeline) plus the enriched product cards,
// tags, store context and vectors. Parts are written first and the head is switched last, so a server always reads a
// complete edition; the previous edition is kept until the next publish. dashboard-server checks the head (one _id
// lookup) every 30 s and downloads an edition only when its digest changes.
export const MODULE_COLLECTION='semantix_module';
const PART_BYTES=8*1024*1024;
const uri=()=>process.env.STUDIO_DASHBOARD_MONGODB_URI||process.env.MONGODB_URI;
async function withModule(project,fn,{client}={}){
 const dbName=storeDbName(project);
 if(client)return fn(client.db(dbName).collection(MODULE_COLLECTION),dbName);
 if(!uri())throw Error('פרסום המודול דורש MONGODB_URI של השרת הראשי');
 const c=new MongoClient(uri(),{serverSelectionTimeoutMS:8000});
 try{await c.connect();return await fn(c.db(dbName).collection(MODULE_COLLECTION),dbName);}finally{await c.close();}
}
export function moduleEdition(project){
 const revision=project.revisions.at(-1);if(!revision)throw Error('ללקוח אין עדיין גרסה');
 if(!project.productCards?.length)throw Error('ללקוח אין כרטיסי מוצר');
 return {revision:revision.number,profile:revision.profile,snapshot:{productCards:project.productCards,storeContext:project.storeContext||null,tagAssignments:project.tagAssignments||{},studioVectors:project.studioVectors||null}};
}
// Cheap fingerprint of what an edition depends on, so a save that changed nothing relevant publishes nothing.
export const editionKey=p=>`${p.revisions?.length||0}:${p.productCardsProfileHash||''}:${p.productCards?.length||0}:${Object.keys(p.tagAssignments||{}).length}`;

export function publishModule(project,slug,{by='tenant-studio',now=()=>new Date(),...opts}={}){
 const edition=moduleEdition(project),raw=Buffer.from(JSON.stringify(edition)),gz=gzipSync(raw,{level:6});
 const digest=createHash('sha256').update(gz).digest('hex').slice(0,24),parts=Math.ceil(gz.length/PART_BYTES);
 return withModule(project,async(col,dbName)=>{
  const head=await col.findOne({_id:slug+':head'});
  if(head?.digest===digest)return {slug,dbName,revision:edition.revision,digest,unchanged:true,bytes:gz.length};
  for(let i=0;i<parts;i++)await col.replaceOne({_id:`${slug}:${digest}:${i}`},{kind:'part',slug,digest,part:i,data:gz.subarray(i*PART_BYTES,(i+1)*PART_BYTES)},{upsert:true});
  const next={kind:'head',slug,revision:edition.revision,digest,parts,bytes:gz.length,rawBytes:raw.length,products:edition.snapshot.productCards.length,previous:head?.digest||null,publishedAt:now().toISOString(),publishedBy:by};
  await col.replaceOne({_id:slug+':head'},next,{upsert:true});
  await col.deleteMany({kind:'part',slug,digest:{$nin:[digest,head?.digest].filter(Boolean)}});
  return {slug,dbName,...next,unchanged:false};
 },opts);
}
export const readPublished=(project,slug,opts)=>withModule(project,col=>col.findOne({_id:slug+':head'},{projection:{_id:0,revision:1,digest:1,bytes:1,products:1,publishedAt:1,publishedBy:1}}),opts);
