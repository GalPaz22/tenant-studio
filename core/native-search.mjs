// Native search for the demo mirror: the site's own search responses (autocomplete JSON/HTML, results pages)
// keep their exact markup, but the product cards inside them become semantix results, in semantix order.
// Each card is harvested from the site itself by searching that product's SKU/key at the same endpoint,
// so price, stock, author and badges are the site's live values. Only the card region is spliced;
// every other byte of the response is left as the origin sent it.
import {parseDocument} from 'htmlparser2';

const PARAMS=['q','s','query','search','term','keyword','keywords','search_query','text'];
const COUNT_WORDS='פריטים|מוצרים|תוצאות|ספרים|results|items|products';
const ASSET=/\.(js|css|png|jpe?g|gif|webp|avif|svg|woff2?|ttf|ico|map|mp4)$/i;

export function searchParam(href){
 const u=new URL(href);if(ASSET.test(u.pathname))return null;
 const searchy=/search|suggest|autocomplete|find/i.test(u.pathname)||u.searchParams.has('s')&&(u.pathname==='/'||u.searchParams.get('post_type')==='product');
 if(!searchy)return null;
 for(const name of PARAMS){const value=u.searchParams.get(name);if(value&&value.trim())return {name,value:value.trim()};}
 return null;
}
const pageOf=u=>{const n=Number(u.searchParams.get('p')||u.searchParams.get('page'));return Number.isInteger(n)&&n>1&&n<500?n:1;};

export function pathKey(href,origin){
 if(typeof href!=='string'||!href||href.length>2000||/^(javascript|mailto|tel|data):/i.test(href))return null;
 try{
  const u=new URL(href.replace(/\\\//g,'/'),origin),o=new URL(origin);
  if(u.hostname.replace(/^www\./,'')!==o.hostname.replace(/^www\./,''))return null;
  let path=decodeURIComponent(u.pathname).replace(/\/+$/,'').toLowerCase();
  const i=path.indexOf('/products/');if(i>0)path=path.slice(i); // Shopify /collections/x/products/y
  return path||null;
 }catch{return null}
}
export function catalogLookup(products,origin){
 const map=new Map();for(const p of products){const k=pathKey(p.url,origin);if(k&&!map.has(k))map.set(k,p);}
 return href=>{const k=pathKey(href,origin);return k&&map.get(k)||null;};
}
// Keys the site's own search is likely to resolve to exactly this product.
export function productKeys(p){
 const tail=s=>String(s||'').split(/[:/]/).filter(Boolean).at(-1)||'';
 let slug='';try{slug=decodeURIComponent(new URL(p.url).pathname.split('/').filter(Boolean).at(-1)||'');}catch{}
 return [...new Set([p.sku,slug.length>=4?slug:'',tail(p.id).length>=4&&/\d/.test(tail(p.id))?tail(p.id):'',p.title].map(x=>String(x||'').trim()).filter(Boolean))];
}

// ---------- HTML ----------
const sigOf=n=>n&&n.type==='tag'?n.name+'.'+String(n.attribs?.class||'').trim().split(/\s+/).filter(Boolean).sort().join('.'):'#root';
function htmlCards(text,lookup,learned={}){
 const doc=parseDocument(text,{withStartIndices:true,withEndIndices:true}),refs=new Map(),links=[];
 const walk=n=>{if(n.type==='tag'&&n.name==='a'){const p=lookup(n.attribs?.href);if(p){links.push([n,p]);for(let x=n;x;x=x.parent){let s=refs.get(x);if(!s)refs.set(x,s=new Set());s.add(p.id);}}}for(const c of n.children||[])walk(c);};
 walk(doc);
 const cards=new Map();
 for(const [a,p] of links){
  let card=a,hit=null;
  // A card never spans a list element itself (a one-result page would otherwise grow the card to the whole <ul>).
  for(let n=a.parent;n&&n.type!=='root'&&!['body','html','head','main','ul','ol','table','tbody'].includes(n.name);n=n.parent){if(refs.get(n).size>1)break;card=n;if(learned.card&&sigOf(n)===learned.card){hit=n;break;}}
  if(learned.card&&!hit)continue; // known card shape: ignore stray links (menus, banners)
  cards.set(hit||card,p);
 }
 const groups=new Map();
 for(const [el,product] of cards){if(!groups.has(el.parent))groups.set(el.parent,[]);groups.get(el.parent).push({el,product,html:text.slice(el.startIndex,el.endIndex+1)});}
 return [...groups].map(([parent,cards])=>({kind:'html',parent,cards,sig:sigOf(parent)+'>'+sigOf(cards[0].el),card:sigOf(cards[0].el),start:Math.min(...cards.map(c=>c.el.startIndex)),end:Math.max(...cards.map(c=>c.el.endIndex))}));
}

// ---------- JSON ----------
function jsonCards(root,lookup,learned={}){
 const groups=[],htmlRefs=s=>new Set(htmlCards(s,lookup).flatMap(g=>g.cards.map(c=>c.product)));
 const refs=v=>{const out=new Set();const walk=x=>{if(typeof x==='string'){if(x.includes('<'))for(const p of htmlRefs(x))out.add(p);else{const p=lookup(x);if(p)out.add(p);}}else if(x&&typeof x==='object')for(const y of Object.values(x))walk(y);};walk(v);return out;};
 const visit=(node,path,parent,parentKey)=>{
  if(!node||typeof node!=='object')return;
  const entries=Array.isArray(node)?node.map((v,i)=>[i,v]):Object.entries(node),cards=[];
  for(const [key,value] of entries){if(!(value&&typeof value==='object')&&!(typeof value==='string'&&value.includes('<')))continue;const r=refs(value);if(r.size===1)cards.push({key,value,product:[...r][0]});}
  const sig='json:'+path.replace(/\/\d+/g,'/#');
  if(cards.length&&(!learned.sig||learned.sig===sig))groups.push({kind:'json',node,parent,parentKey,cards,sig,card:sig});
  for(const [key,value] of entries)visit(value,path+'/'+key,node,key);
 };
 visit(root,'',null,null);return groups;
}

function analyze(text,type,lookup,learned){
 if(/json/i.test(type)||/^\s*[[{]/.test(text)&&!/html/i.test(type)){try{return {kind:'json',root:JSON.parse(text),groups:null};}catch{}}
 return {kind:'html',text,groups:htmlCards(text,lookup,learned)};
}
function groupsOf(a,lookup,learned){if(!a.groups)a.groups=a.kind==='json'?jsonCards(a.root,lookup,learned):htmlCards(a.text,lookup,learned);return a.groups;}
// The results list: the learned shape if known, otherwise the largest repeating group.
function pick(groups,learned){const pool=learned.sig?groups.filter(g=>g.sig===learned.sig):groups;return [...(pool.length?pool:groups)].sort((a,b)=>b.cards.length-a.cards.length||a.start-b.start)[0]||null;}

// ---------- text edits outside the card region ----------
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const reEsc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const variants=s=>[s,esc(s),esc(s).replace(/'/g,'&#039;'),encodeURIComponent(s),encodeURIComponent(s).replace(/%20/g,'+'),JSON.stringify(s).slice(1,-1)];
// One pass over every encoding of each pair, so a replacement is never itself replaced again.
export function swapAll(text,pairs){
 const map=new Map();
 for(const [from,to] of pairs){if(!from||to==null||from===to)continue;const f=variants(String(from)),t=variants(String(to));f.forEach((v,i)=>{if(v&&!map.has(v))map.set(v,t[i]);});}
 if(!map.size)return text;
 const re=new RegExp([...map.keys()].sort((a,b)=>b.length-a.length).map(reEsc).join('|'),'g');
 return text.replace(re,m=>map.get(m));
}
export const replaceEcho=(text,from,to)=>swapAll(text,[[from,to]]);
// "54 מוצרים" / <span>54</span><span>פריטים</span>: the most repeated such number (ties: largest) is the original total,
// one equal to the cards shown is the page count; anything else ("60 ספרים" in a menu, a mini-cart) is left alone.
export function replaceCounts(texts,{total,shown,originalShown}){
 const words=`(?:${COUNT_WORDS})`,patterns=[new RegExp(`((?:>|\\s|^)\\s*\\(?)(\\d[\\d,]*)(\\)?\\s*${words})`,'gi'),new RegExp(`(>\\s*\\(?)(\\d[\\d,]*)(\\)?\\s*</(?:span|b|strong|em)>\\s*(?:<[^>]{0,120}>\\s*)?${words})`,'gi')];
 const num=n=>Number(String(n).replace(/,/g,'')),seen=texts.flatMap(t=>patterns.flatMap(re=>[...t.matchAll(re)].map(m=>num(m[2]))));
 // A total can never be below the number of cards the page showed (rules out "0 מוצרים" in a mini-cart).
 const freq=new Map();for(const n of seen)if(n>=(originalShown||0))freq.set(n,(freq.get(n)||0)+1);
 const originalTotal=[...freq].sort((a,b)=>b[1]-a[1]||b[0]-a[0])[0]?.[0]??originalShown??null;
 const fix=n=>{const v=num(n);return v===originalTotal?String(total):v===originalShown?String(shown):n;};
 return texts.map(t=>patterns.reduce((s,re)=>s.replace(re,(_,a,n,b)=>a+fix(n)+b),t));
}

// Fallback when the site's own search cannot surface a product: reuse another card, swapping identity fields.
function transplant(html,from,to){
 let out=swapAll(html,[[from.url,to.url],[from.title,to.title],[from.image,to.image]]);
 // An unknown price must not show the template product's price.
 out=out.replace(/(<[^>]+class="[^"]*price[^"]*"[^>]*>)([^<]*\d[^<]*)(<)/gi,(_,o,v,c)=>o+(Number.isFinite(to.price)?v.replace(/\d[\d,]*(?:\.\d+)?/,to.price.toFixed(2)):'')+c);
 return out.replace(/<img\b([^>]*?)\ssrc="[^"]*"/i,(_,a)=>`<img${a} src="${esc(to.image||'')}"`);
}

// Sites rate-limit search. Harvest requests are budgeted per project (default 12/min); past that, cards are
// transplanted locally. Every card seen in any response is remembered, so the site is asked only for new ones.
export function createNativeSearch({concurrency=2,perMinute=12,now=Date.now}={}){
 const memory=new Map(); // per project+endpoint: learned card/group shape and page size
 const seen=new Map(); // per project+endpoint: product id → native card
 const spent=new Map(); // per project: harvest request timestamps (last minute)
 const allow=id=>{const t=now(),list=(spent.get(id)||[]).filter(x=>t-x<60000);if(list.length>=perMinute){spent.set(id,list);return false;}list.push(t);spent.set(id,list);return true;};
 const remember=(store,groups)=>{for(const g of groups)for(const c of g.cards)if(!store.has(c.product.id))store.set(c.product.id,{card:c,group:g});};
 async function pool(items,fn){const out=new Array(items.length);let i=0;await Promise.all(Array.from({length:Math.min(concurrency,items.length)},async()=>{while(i<items.length){const j=i++;out[j]=await fn(items[j]).catch(()=>null);}}));return out;}
 const withQuery=(url,param,value)=>{const u=new URL(url);u.searchParams.set(param,value);u.searchParams.delete('p');u.searchParams.delete('page');return u.href;};

 // Returns the response text to serve, or null to serve the original untouched.
 // fetchText(url) → {text,type}|null from the origin (cached); search(query,limit) → {matches,total} from semantix.
 async function render({project,url,text,type,lookup,fetchText,search}){
  const target=new URL(url),param=searchParam(url);if(!param)return null;
  // Shopify themes also search articles/pages; those responses carry no products and are left alone.
  const kinds=target.searchParams.get('type');if(kinds&&!/product/i.test(kinds))return null;
  // Theme sections (Shopify section_id) render different card markup on the same path.
  const key=project.id+':'+target.pathname+':'+(target.searchParams.get('section_id')||''),learned=memory.get(key)||{};
  if(!seen.has(key))seen.set(key,new Map());const cardsSeen=seen.get(key);
  const learn=g=>{if(!g||g.cards.length<2)return false;learned.sig=g.sig;learned.card=g.card;if(g.cards.length>=5)learned.pageSize=Math.max(learned.pageSize||0,g.cards.length);memory.set(key,learned);return true;};
  let original=analyze(text,type,lookup,learned),og=pick(groupsOf(original,lookup,learned),learned);
  learn(og);
  // A fragment/JSON answer with no product cards (e.g. a suggestions-only section) is not ours to fill.
  if(!og&&!(original.kind==='html'&&/<html[\s>]/i.test(text)))return null;
  // A sparse original (2 hits) says nothing about page size: use what this endpoint showed before, or a default.
  const fallback=original.kind==='html'&&/<html[\s>]/i.test(text)?24:6;
  const pageSize=learned.pageSize||(og&&og.cards.length>=fallback?og.cards.length:fallback),page=pageOf(target),offset=(page-1)*pageSize;
  const res=await search(param.value,Math.min(offset+pageSize,240));
  const results=(res.matches||[]).slice(offset,offset+pageSize),total=res.total??res.matches?.length??0;
  // Card shape unknown and the original too sparse to show it: probe the site with queries likely to list several products.
  if(!learned.card&&results.length){
   const first=String(results[0].title||''),probes=[first,first.split(/\s+/).find(w=>w.length>=3)].filter(Boolean);
   for(const k of [...new Set(probes)]){if(!allow(project.id))break;const t=await fetchText(withQuery(url,param.name,k)).catch(()=>null);if(t&&learn(pick(groupsOf(analyze(t.text,t.type,lookup,{}),lookup,{}),{})))break;}
   if(learned.card){original=analyze(text,type,lookup,learned);og=pick(groupsOf(original,lookup,learned),learned);}
  }

  if(og)remember(cardsSeen,groupsOf(original,lookup,learned).filter(g=>!learned.sig||g.sig===learned.sig));
  // Each result's native card: already seen on this endpoint, else harvested from it (within the request budget).
  const harvest=async p=>{
   if(cardsSeen.has(p.id))return cardsSeen.get(p.id);
   for(const k of productKeys(p).slice(0,2)){
    if(!allow(project.id))return null;
    const t=await fetchText(withQuery(url,param.name,k));if(!t)continue;
    const a=analyze(t.text,t.type,lookup,learned),groups=groupsOf(a,lookup,learned);
    remember(cardsSeen,groups.filter(g=>!learned.sig||g.sig===learned.sig));
    for(const g of groups){const c=g.cards.find(c=>c.product.id===p.id);if(c)return {card:c,group:g,analysis:a,query:k};}
   }
   return null;
  };
  const harvested=await pool(results,harvest);
  const good=harvested.filter(Boolean),fetched=good.filter(h=>h.analysis); // fetched ones carry a whole response usable as structure
  if(!og&&fetched.length&&!learned.sig){learned.sig=fetched[0].group.sig;learned.card=fetched[0].group.card;memory.set(key,learned);}

  // Structure: the original response, or (no original results) the response of our first harvested card.
  let base=original,group=og,echo=null;
  if(!group||learned.sig&&group.sig!==learned.sig){const h=fetched[0];if(!h)return results.length?null:text;base=h.analysis;group=h.group;echo=h.query;}
  const template=good[0]?.card||group.cards[0];
  const cards=results.map((p,i)=>harvested[i]?.card||(template&&{key:p.id,product:p,value:typeof template.value==='string'?transplant(template.value,template.product,p):template.value,html:template.html&&transplant(template.html,template.product,p)})).filter(Boolean);
  const counts={total,shown:cards.length,originalShown:group.cards.length};

  if(base.kind==='json'){
   const {node,parent}=group,keys=cards.map(c=>c.key);
   if(Array.isArray(node))node.splice(0,node.length,...cards.map(c=>c.value));
   else{for(const c of group.cards)delete node[c.key];for(const c of cards)node[c.key]=c.value;}
   if(parent&&!Array.isArray(parent))for(const [k,v] of Object.entries(parent)){
    if(Array.isArray(v)&&v!==node&&v.length&&v.every(x=>group.cards.some(c=>String(c.key)===String(x))))parent[k]=keys.map(x=>typeof v[0]==='number'&&/^\d+$/.test(x)?Number(x):x);
    else if(typeof v==='number'&&/^(size|count|total|total_count|totalCount)$/i.test(k))parent[k]=total;
   }
   let out=JSON.stringify(base.root);if(echo)out=replaceEcho(out,echo,param.value);return out;
  }
  let before=base.text.slice(0,group.start),after=base.text.slice(group.end+1);
  if(echo){before=replaceEcho(before,echo,param.value);after=replaceEcho(after,echo,param.value);}
  [before,after]=replaceCounts([before,after],counts);
  return before+cards.map(c=>c.html).join('\n')+after;
 }
 return {render};
}
