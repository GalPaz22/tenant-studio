// Studio can use the search server's existing Redis connection. The server
// re-reads approved definitions from Mongo; no patch is sent over this bridge.
export async function searchExperimentPublication(apiKey,{publish=false,request=fetch}={}){
 const response=await request(new URL('/experiments/publication',process.env.SEARCH_SERVICE_URL||'https://api.semantix-ai.com'),{method:publish?'POST':'GET',headers:{'x-api-key':apiKey,accept:'application/json'},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw Object.assign(Error('לא ניתן להתחבר לשירות פרסום הניסויים במנוע החיפוש. יש לוודא שנפרסה גרסת dashboard-server העדכנית.'),{status:503});
 const result=await response.json();
 if(result.available!==true||!Array.isArray(result.experimentIds)||result.experimentIds.some(id=>typeof id!=='string'))throw Object.assign(Error('מנוע החיפוש לא אישר את מצב פרסום הניסויים'),{status:503});
 return result;
}
