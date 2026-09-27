// Injected into mirrored storefront pages (/demo/:id/...). Keeps navigation inside the mirror. Runs before the site's scripts.
// Native mode (default): the site's own autocomplete/results run untouched; the mirror server swaps in semantix products.
// Overlay mode: the site's search is intercepted and semantix results open in a separate panel.
(()=>{
 const cfg=window.__SEMANTIX_DEMO__;if(!cfg||window.__semantixDemoLoaded)return;window.__semantixDemoLoaded=true;
 const {prefix,hosts}=cfg,endpoint=prefix+'/__semantix/search';
 // ---------- keep the site inside the mirror ----------
 const inside=u=>{
  if(typeof u!=='string')return u;
  if(u.startsWith('/')&&!u.startsWith('//')&&!u.startsWith(prefix+'/')&&u!==prefix)return prefix+u;
  try{const x=new URL(u,location.href);if(hosts.includes(x.hostname.toLowerCase()))return prefix+x.pathname+x.search+x.hash;}catch{}
  return u;
 };
 try{if(navigator.serviceWorker)navigator.serviceWorker.register=()=>Promise.reject(Error('service workers are disabled in the demo mirror'));}catch{}
 // Demo traffic must not reach the client's analytics.
 try{navigator.sendBeacon=()=>true;}catch{}
 const f=window.fetch;window.fetch=function(input,init){if(typeof input==='string')input=inside(input);else if(input instanceof URL)input=inside(input.href);return f.call(this,input,init);};
 const open=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u,...rest){return open.call(this,m,typeof u==='string'?inside(u):u instanceof URL?inside(u.href):u,...rest);};
 for(const k of ['pushState','replaceState']){const o=history[k];history[k]=function(s,t,u){return o.call(this,s,t,u==null?u:inside(String(u)));};}

 // ---------- search overlay ----------
 const SEARCH_INPUT='input[type=search],input[name=s],input[name=q],input[name=query],input[name=search],input[name=keyword],input[name=keywords],input[name=term],input[name*=search i],input[id*=search i],input[class*=search i],input[placeholder*=חיפוש],input[placeholder*=חפש],input[placeholder*=search i],[role=search] input[type=text],form[action*=search i] input[type=text]';
 const isSearchInput=n=>n instanceof HTMLInputElement&&!['hidden','checkbox','radio','submit','button','email','password','number'].includes(n.type)&&!n.closest('[data-semantix-demo]')&&n.matches(SEARCH_INPUT);
 const rtl=(document.documentElement.dir||getComputedStyle(document.documentElement).direction)==='rtl'||/^(he|ar)/i.test(document.documentElement.lang||'he');
 const t=rtl?{placeholder:'מה תרצו למצוא?',results:n=>`${n} תוצאות`,none:'לא נמצאו מוצרים',more:'עוד תוצאות',close:'סגור',error:'החיפוש נכשל, נסו שוב',searching:'מחפש…',badge:'חיפוש Semantix · הדגמה'}:{placeholder:'What are you looking for?',results:n=>`${n} results`,none:'No products found',more:'More results',close:'Close',error:'Search failed, try again',searching:'Searching…',badge:'Semantix search · demo'};
 let host,root,input,list,meta,moreBtn,seq=0,cursor=null,timer=null;
 const css=`:host{all:initial}*{box-sizing:border-box;font-family:inherit}
 .shade{position:fixed;inset:0;background:rgba(15,18,25,.45);z-index:2147483646;display:flex;justify-content:center;align-items:flex-start;padding:4vh 16px;backdrop-filter:blur(2px)}
 .panel{background:#fff;color:#1b1f24;width:min(1180px,100%);max-height:92vh;border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.28);display:flex;flex-direction:column;overflow:hidden}
 .bar{display:flex;gap:10px;align-items:center;padding:16px 18px;border-bottom:1px solid #eceef1}
 .bar input{flex:1;font:inherit;font-size:18px;border:1px solid #d7dbe0;border-radius:10px;padding:12px 14px;outline:none;color:inherit;background:#fff}
 .bar input:focus{border-color:#1b1f24}
 .x{border:0;background:#f1f3f5;border-radius:10px;width:44px;height:44px;font-size:20px;cursor:pointer;color:#1b1f24}
 .meta{padding:10px 18px;font-size:13px;color:#5d6570;display:flex;justify-content:space-between;gap:12px}
 .meta .tag{color:#7a4dff;font-weight:600}
 .list{overflow:auto;padding:4px 18px 18px;display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px}
 a.card{display:flex;flex-direction:column;gap:6px;text-decoration:none;color:inherit;border:1px solid #eceef1;border-radius:12px;padding:10px;transition:box-shadow .15s,transform .15s;background:#fff}
 a.card:hover{box-shadow:0 8px 24px rgba(0,0,0,.08);transform:translateY(-2px)}
 .img{aspect-ratio:1;background:#f6f7f9;border-radius:8px;overflow:hidden;display:flex;align-items:center;justify-content:center}
 .img img{width:100%;height:100%;object-fit:contain}
 .title{font-size:14px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
 .price{font-weight:700;font-size:15px}.price s{color:#8a929c;font-weight:400;margin-inline-start:6px;font-size:13px}
 .oos{font-size:12px;color:#b3261e}
 .empty{grid-column:1/-1;text-align:center;padding:40px 0;color:#5d6570}
 .more{margin:0 18px 18px;padding:12px;border:1px solid #d7dbe0;border-radius:10px;background:#fff;font:inherit;cursor:pointer;color:inherit}
 .ribbon{position:fixed;bottom:14px;inset-inline-start:14px;z-index:2147483645;background:#1b1f24;color:#fff;font-size:12px;padding:7px 12px;border-radius:999px;opacity:.85;pointer-events:none}
 @media (max-width:600px){.shade{padding:0}.panel{max-height:100vh;height:100vh;border-radius:0}.list{grid-template-columns:repeat(2,1fr);gap:10px}}`;
 const h=(tag,attrs={},...kids)=>{const n=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(v==null||v===false)continue;if(k.startsWith('on'))n.addEventListener(k.slice(2),v);else n.setAttribute(k,v);}for(const k of kids.flat())if(k!=null)n.append(k);return n;};
 function mount(){
  if(host)return;
  host=h('div',{'data-semantix-demo':''});root=host.attachShadow({mode:'open'});
  root.append(h('style',{},css),h('div',{class:'ribbon'},t.badge));
  (document.body||document.documentElement).append(host);
 }
 function money(p){if(p==null||!Number.isFinite(Number(p)))return null;try{return new Intl.NumberFormat(rtl?'he-IL':undefined,{style:'currency',currency:'ILS',maximumFractionDigits:2}).format(p)}catch{return String(p)}}
 function card(p){
  const reg=Number(p.regularPrice)>Number(p.price)?money(p.regularPrice):null;
  return h('a',{class:'card',href:p.url?inside(p.url):'#'},
   h('div',{class:'img'},p.image?h('img',{src:p.image,alt:'',loading:'lazy'}):null),
   h('div',{class:'title'},p.title||p.name||''),
   h('div',{class:'price'},money(p.price),reg?h('s',{},reg):null),
   p.stockStatus==='outofstock'?h('div',{class:'oos'},rtl?'אזל מהמלאי':'Out of stock'):null);
 }
 function openOverlay(query){
  mount();
  if(!root.querySelector('.shade')){
   input=h('input',{type:'search',placeholder:t.placeholder,autocomplete:'off',dir:'auto'});
   list=h('div',{class:'list'});meta=h('div',{class:'meta'});moreBtn=h('button',{class:'more',hidden:''},t.more);
   const shade=h('div',{class:'shade',onclick:e=>{if(e.target===shade)close();}},h('div',{class:'panel',dir:rtl?'rtl':'ltr',role:'dialog','aria-modal':'true'},h('div',{class:'bar'},input,h('button',{class:'x','aria-label':t.close,onclick:close},'×')),meta,list,moreBtn));
   root.append(shade);
   input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>search(input.value),280);});
   input.addEventListener('keydown',e=>{if(e.key==='Enter'){clearTimeout(timer);search(input.value);}if(e.key==='Escape')close();});
   moreBtn.addEventListener('click',()=>search(input.value,cursor));
   document.documentElement.style.overflow='hidden';
  }
  input.value=query||'';input.focus();if(query)search(query);
 }
 function close(){root?.querySelector('.shade')?.remove();document.documentElement.style.overflow='';}
 async function search(q,next=null){
  q=String(q||'').trim();if(!q){list.replaceChildren();meta.replaceChildren();moreBtn.hidden=true;return;}
  const mine=++seq;if(!next){meta.replaceChildren(t.searching);}
  try{
   const r=await f(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(next?{cursor:next}:{query:q,limit:24})}).then(async x=>{const d=await x.json();if(!x.ok)throw Error(d.error||t.error);return d;});
   if(mine!==seq)return;
   cursor=r.nextCursor||null;moreBtn.hidden=!cursor;
   const cards=(r.matches||[]).map(card);
   if(next)list.append(...cards);else list.replaceChildren(...(cards.length?cards:[h('div',{class:'empty'},r.message||t.none)]));
   if(!next)meta.replaceChildren(h('span',{},t.results(r.total??r.matches?.length??0)),h('span',{class:'tag'},'semantix'));
  }catch(e){if(mine===seq)meta.replaceChildren(e.message||t.error);}
 }
 if(cfg.mode!=='overlay'){const ready=()=>mount();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();return;}
 // Capture on window runs before the site's own listeners on the input/form, so its autocomplete never fires.
 const own=e=>isSearchInput(e.target);
 window.addEventListener('keydown',e=>{if(own(e)&&e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();openOverlay(e.target.value.trim());}},true);
 for(const type of ['input','keyup','keypress','change'])window.addEventListener(type,e=>{if(own(e)){e.stopImmediatePropagation();if(type==='input'&&e.target.value.trim().length>=2)openOverlay(e.target.value.trim());}},true);
 window.addEventListener('submit',e=>{const i=[...e.target.elements||[]].find(isSearchInput);if(i){e.preventDefault();e.stopImmediatePropagation();openOverlay(i.value.trim());}},true);
 // Landing directly on the site's search results URL (e.g. /?s=, /search?q=) opens semantix results.
 const params=new URLSearchParams(location.search),q=params.get('s')||params.get('q')||params.get('query')||params.get('search')||params.get('keyword');
 const ready=()=>{mount();if(q&&(/search|חיפוש/i.test(location.pathname)||params.has('s')||params.has('q')))openOverlay(q);};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();
})();
