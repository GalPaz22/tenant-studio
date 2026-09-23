import {GoogleGenAI} from '@google/genai';
export const embeddingModel=()=>process.env.STUDIO_EMBEDDING_MODEL||'gemini-embedding-2';
export async function embedText(text,{query=false,model=embeddingModel()}={}) {
  const apiKey=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY;if(!apiKey)throw Error('נדרש מפתח מודל ליצירת וקטורים');
  const old=model.includes('001');
  const contents=old?text:query?'task: search result | query: '+text:'title: Product | text: '+text;
  const result=await new GoogleGenAI({apiKey}).models.embedContent({model,contents,config:{outputDimensionality:768,...(old?{taskType:query?'RETRIEVAL_QUERY':'RETRIEVAL_DOCUMENT'}:{}),httpOptions:{timeout:45000,retryOptions:{attempts:1}}}});
  const vector=result.embeddings?.[0]?.values;if(!Array.isArray(vector)||vector.length!==768||!vector.every(Number.isFinite)||!vector.some(v=>v!==0))throw Error('וקטור לא תקין');return {vector,model};
}
export const documentText=p=>[p.title,p.description,...p.categories,...p.tags,...Object.entries(p.specifications||{}).map(([k,v])=>k+': '+v)].join('\n').slice(0,20000);
export function cosine(a,b){if(a.length!==b.length)throw Error('ממדי וקטור אינם תואמים');let dot=0,aa=0,bb=0;for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}return aa&&bb?dot/Math.sqrt(aa*bb):0;}
export function createVectorRanker(index,embed=embedText){return async(query,eligible)=>{const result=await embed(query,{query:true,model:index.model});return eligible.map(p=>({p,score:index.vectors[p.id]?cosine(result.vector,index.vectors[p.id]):0})).sort((a,b)=>b.score-a.score||a.p.id.localeCompare(b.p.id));};}
