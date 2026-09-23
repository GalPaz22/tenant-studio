// Select evidence from the full catalog while keeping the model request bounded.
export function chatCatalog(products,message,context){
 const terms=[...new Set((message+' '+(context?.query||'')).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[])];
 const ranked=products.map((p,index)=>{const name=(p.name||'').toLowerCase(),other=[...(p.categories||[]),...(p.tags||[]),p.description||''].join(' ').toLowerCase();return {p,index,score:terms.reduce((sum,t)=>sum+(name.includes(t)?4:other.includes(t)?1:0),0)}}).sort((a,b)=>b.score-a.score||a.index-b.index);
 return ranked.slice(0,30).map(({p})=>({id:p.id,name:p.name,categories:p.categories,tags:p.tags,description:(p.description||'').slice(0,1600),specifications:p.specifications}));
}
