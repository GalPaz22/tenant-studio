export function createApi(fetcher=fetch) {
 let token,refreshing;
 async function read(response){
  const text=await response.text();let data;
  try{data=JSON.parse(text)}catch{throw Error(response.ok?'השרת החזיר תשובה לא תקינה':`הבקשה נכשלה (${response.status}). רעננו את החיבור ל־Studio.`)}
  if(!response.ok)throw Object.assign(Error(data.error||'הבקשה נכשלה'),{code:data.code});
  return data;
 }
 async function session(){
  if(!refreshing)refreshing=(async()=>{const data=await read(await fetcher('/api/session'));if(typeof data.token!=='string')throw Error('לא התקבל חיבור תקין');token=data.token;})().finally(()=>{refreshing=null});
  return refreshing;
 }
 async function request(path,body,blob=false){
  if(!token)await session();
  for(let attempt=0;attempt<2;attempt++){
   const sentToken=token;
   const response=await fetcher('/api'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Studio-Token':sentToken},body:body===undefined?undefined:JSON.stringify(body)});
   if(blob&&response.ok)return response.blob();
   try{return await read(response)}catch(error){
    // Retry only an explicit pre-handler auth rejection, never a failed write.
    if(error.code!=='SESSION_EXPIRED'||attempt===1)throw error;
    if(token===sentToken)await session();
   }
  }
 }
 return {request};
}
