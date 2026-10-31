// Injected into mirrored storefront pages (/demo/:id/...). Keeps navigation inside the mirror. Runs before the site's scripts.
// Native mode (default): the site's own autocomplete/results run untouched; the mirror server swaps in semantix products.
// Overlay mode: the site's search is intercepted and semantix results open in a separate panel.
(()=>{
 const cfg=window.__SEMANTIX_DEMO__;if(!cfg||window.__semantixDemoLoaded)return;window.__semantixDemoLoaded=true;
 // cfg.api: where the page's semantix endpoints live (a harness that serves the store itself sets its own).
 const {prefix,hosts}=cfg,api=cfg.api||prefix+'/__semantix',endpoint=api+'/search';
 // ---------- keep the site inside the mirror ----------
 const inside=u=>{
  if(typeof u!=='string')return u;
  if(u.startsWith('/')&&!u.startsWith('//')&&!u.startsWith(prefix+'/')&&u!==prefix)return prefix+u;
  try{const x=new URL(u,location.href);if(hosts.includes(x.hostname.toLowerCase()))return prefix+x.pathname+x.search+x.hash;}catch{}
  return u;
 };
 // A page that is not a mirror (no store hosts to keep inside) is left as it is.
 if(hosts.length){
 try{if(navigator.serviceWorker)navigator.serviceWorker.register=()=>Promise.reject(Error('service workers are disabled in the demo mirror'));}catch{}
 // Demo traffic must not reach the client's analytics.
 try{navigator.sendBeacon=()=>true;}catch{}
 }
 const f=window.fetch;if(hosts.length)window.fetch=function(input,init){if(typeof input==='string')input=inside(input);else if(input instanceof URL)input=inside(input.href);return f.call(this,input,init);};
 const open=XMLHttpRequest.prototype.open;if(hosts.length)XMLHttpRequest.prototype.open=function(m,u,...rest){return open.call(this,m,typeof u==='string'?inside(u):u instanceof URL?inside(u.href):u,...rest);};
 for(const k of ['pushState','replaceState']){const o=history[k];history[k]=function(s,t,u){const r=o.call(this,s,t,u==null?u:inside(String(u)));setTimeout(()=>advisor.check(searched()));return r;};}
 window.addEventListener('popstate',()=>advisor.check(searched()));
 // The query of the site's own results URL (e.g. /?s=, /search?q=), or null on any other page.
 const searched=()=>{const p=new URLSearchParams(location.search),q=p.get('s')||p.get('q')||p.get('query')||p.get('search')||p.get('keyword');return q&&(/search|חיפוש/i.test(location.pathname)||p.has('s')||p.has('q'))?q:null;};

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
 // ---------- concierge: an advisory search opens the shop's advisor in place of the results grid ----------
 // The results page of an undecided search arrives at once, without its grid (cfg.search). The page shows a loader where
 // the results would be and asks the server: advisor (the query asks for advice, nothing was found, or it is out of
 // stock) or plain results (the page reloads into them). The question leaves before the DOM is ready, and the first
 // turn right after its answer. The conversation is kept for the tab (sessionStorage): coming back from a recommended
 // product returns to it.
 const advisor=(()=>{
  if(!cfg.concierge||cfg.mode==='overlay')return {check(){},ready(){}};
  const base=api+'/concierge',key='semantixDemoConcierge:'+cfg.id,fresh=(query,trigger)=>({query,trigger,conversationId:null,history:[],items:[]});
  let state=fresh(null,null),host,shadow,view,thread,field,sendBtn,concealed=[],run=0,early=null;
  try{state={...state,...JSON.parse(sessionStorage.getItem(key)||'{}')};}catch{}
  const save=()=>{try{sessionStorage.setItem(key,JSON.stringify(state));}catch{}};
  const post=(path,body)=>f(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const ask=message=>post('/stream',{message,trigger:state.trigger,history:state.history.slice(-8),conversationId:state.conversationId||undefined});
  const answered=()=>state.items.some(m=>m.role==='assistant');
  const asked=cfg.search?.query,resumed=!!asked&&state.query===asked&&answered();
  const decide=q=>post('/decide',{query:q}).then(r=>r.json()).catch(()=>({open:false}));
  // Resolves to the first turn's response, or null when the search is a plain one.
  if(asked&&!resumed)early=decide(asked).then(d=>{if(!d.open||!d.trigger)return null;state=fresh(asked,d.trigger);save();return ask(asked);});
  const style=`:host{display:block;direction:rtl;text-align:start;color:#111;line-height:1.6;margin:8px 0 48px}*{box-sizing:border-box;font-family:inherit}
  .view{max-width:1180px;margin:0 auto;padding:8px 16px;animation:in .35s ease-out}@keyframes in{from{opacity:0;transform:translateY(10px)}}
  .head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;padding-bottom:18px;border-bottom:1px solid #e6e6e6}
  .kicker{display:block;font-size:11px;letter-spacing:.22em;color:#8a8a8a;text-transform:uppercase;direction:ltr;text-align:right}
  h2{margin:4px 0 0;font-size:30px;font-weight:500;line-height:1.25;color:#111}
  .link{flex:none;background:none;border:0;border-bottom:1px solid #111;padding:0 0 3px;font:inherit;font-size:14px;color:#111;cursor:pointer}.link:hover{opacity:.6}
  .thread{display:flex;flex-direction:column;gap:16px;padding:26px 0;min-height:34vh}
  .intro{display:flex;gap:10px;align-items:center;color:#6b6b6b;font-size:15px}.intro span{color:#111}
  .msg{max-width:min(760px,92%);font-size:16px;white-space:pre-wrap;overflow-wrap:anywhere}
  .msg.user{align-self:flex-start;background:#111;color:#fff;padding:10px 16px;border-radius:18px 18px 4px 18px}
  .msg.agent{align-self:flex-start;padding:2px 14px 2px 0;border-right:2px solid #111;font-size:17px}
  .msg.err{color:#b3261e;border-color:#b3261e}
  .thinking,.wait{display:flex;align-items:center;gap:5px;color:#6b6b6b;font-size:14px}.wait{justify-content:center;min-height:34vh;font-size:15px}.thinking i,.wait i{width:6px;height:6px;border-radius:50%;background:#111;animation:dot 1s infinite}.thinking i:nth-child(2),.wait i:nth-child(2){animation-delay:.12s}.thinking i:nth-child(3),.wait i:nth-child(3){animation-delay:.24s;margin-left:6px}
  @keyframes dot{50%{opacity:.15;transform:translateY(-3px)}}
  .catalog{display:flex;flex-direction:column;gap:12px}.bar{display:flex;justify-content:space-between;align-items:baseline;gap:12px}.bar strong{font-size:15px;font-weight:600}.bar span{font-size:12px;color:#8a8a8a}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:18px}
  a.card{display:flex;flex-direction:column;gap:8px;text-decoration:none;color:#111;animation:in .3s ease-out}
  .card .img{aspect-ratio:4/5;background:#f6f5f3;display:flex;align-items:center;justify-content:center;overflow:hidden}.card img{width:100%;height:100%;object-fit:contain;transition:transform .25s}.card:hover img{transform:scale(1.04)}
  .card .title{font-size:14px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.card .price{font-size:15px;font-weight:700}
  .compose{display:flex;gap:12px;align-items:center;padding-top:16px;border-top:1px solid #e6e6e6}
  .compose input{flex:1;min-width:0;font:inherit;font-size:16px;border:0;border-bottom:1px solid #bbb;border-radius:0;padding:10px 2px;outline:none;background:transparent;color:#111}.compose input:focus{border-bottom-color:#111}
  .compose button{flex:none;width:44px;height:44px;border-radius:50%;border:1px solid #111;background:#fff;color:#111;font-size:18px;line-height:1;cursor:pointer;transition:background .15s,color .15s}.compose button:hover{background:#111;color:#fff}.compose button:disabled{opacity:.4;cursor:default}
  @media (max-width:600px){h2{font-size:22px}.head{flex-wrap:wrap}.grid{grid-template-columns:repeat(2,1fr);gap:12px}.msg{max-width:100%;font-size:15px}}`;
  const rich=text=>String(text).split(/\*\*([^*\n]+)\*\*/g).map((s,i)=>i%2?h('b',{},s):s);
  const card=p=>h('a',{class:'card',href:p.url||'#'},h('div',{class:'img'},p.image?h('img',{src:p.image,alt:'',loading:'lazy',onerror:e=>e.target.remove()}):null),h('div',{class:'title'},p.title||''),h('div',{class:'price'},money(p.price)));
  const catalog=(products,final)=>h('div',{class:'catalog'},final?h('div',{class:'bar'},h('strong',{},products.length+' תוצאות מתאימות'),h('span',{},'אפשר ללחוץ על מוצר לפרטים')):null,h('div',{class:'grid'},products.map(card)));
  const bubble=m=>m.role==='user'?[h('div',{class:'msg user'},m.text)]:[h('div',{class:'msg agent'},rich(m.text)),m.products?.length?catalog(m.products,true):null];
  // The results region: whatever follows the page heading inside the main content (or, without one, beside it). It is
  // hidden, not removed, and the advisor takes its place.
  function place(host){
   const h1=document.querySelector('main h1,[role=main] h1')||document.querySelector('h1'),real=n=>!['SCRIPT','STYLE','LINK','NOSCRIPT','TEMPLATE'].includes(n.tagName)&&!n.hasAttribute('data-semantix-demo');
   const hide=list=>{for(const x of list){x.style.setProperty('display','none','important');concealed.push(x);}};
   const main=(h1||document).closest?.('main,[role=main]')||(!h1&&document.querySelector('main,[role=main],#main,#content'));
   if(!h1){if(!main)return false;hide([...main.children].filter(real));main.prepend(host);return true;}
   const rest=n=>{const out=[];for(let x=n.nextElementSibling;x;x=x.nextElementSibling)if(real(x)&&x.tagName!=='FOOTER')out.push(x);return out;};
   let block=h1;
   if(main)for(;;block=block.parentElement){hide(rest(block));if(block.parentElement===main)break;}
   else{while(!rest(block).length&&block.parentElement&&block.parentElement!==document.body)block=block.parentElement;if(block.parentElement!==document.body)hide(rest(block));}
   block.after(host);return true;
  }
  const here=results=>{const u=new URL(location.href);if(results)u.searchParams.set('__semantix_results','1');else u.searchParams.delete('__semantix_results');return u.pathname+u.search;};
  // Plain results on a store that refuses the mirror its own results page: the semantix results, in the same place.
  async function results(q,next=null,grid=null){
   try{
    const r=await f(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(next?{cursor:next}:{query:q,limit:24})}).then(x=>x.json());
    const more=r.nextCursor?h('button',{class:'link',type:'button',style:'align-self:center',onclick:()=>{more.remove();results(q,r.nextCursor,grid);}},t.more):null;
    if(grid){grid.append(...(r.matches||[]).map(card));if(more)grid.parentNode.append(more);return;}
    grid=h('div',{class:'grid'},(r.matches||[]).map(card));
    shadow.querySelector('.wait')?.replaceWith(h('section',{class:'view'},h('div',{class:'catalog'},h('div',{class:'bar'},h('strong',{},(r.matches||[]).length?t.results(r.total??r.matches.length):r.message||t.none),state.query===q&&answered()?h('button',{class:'link',type:'button',onclick:()=>{shadow.querySelector('.view').remove();open();}},'→ חזרה ליועץ'):h('span',{},'semantix')),grid,more)));
   }catch{shadow.querySelector('.wait span').textContent=t.error;}
  }
  const waiting=()=>h('div',{class:'wait'},h('i'),h('i'),h('i'),h('span',{},t.searching));
  // "All results": the store's results page, or (where the store refuses it) the semantix results in place.
  function all(){
   // Beside the takeover engine the results are already on the page, under the advisor.
   if(cfg.search?.engine){host.remove();host=view=null;for(const x of concealed)x.style.removeProperty('display');concealed=[];return;}
   if(!cfg.search?.frame){location.href=here(true);return;}
   view.replaceWith(waiting());view=null;results(state.query);
  }
  // The advisor's place on the page, holding a loader until the view is built.
  function mountHost(){
   if(host)return true;
   host=h('div',{'data-semantix-demo':'advisor'});if(!place(host)){host=null;return false;}
   shadow=host.attachShadow({mode:'open'});shadow.append(h('style',{},style),waiting());return true;
  }
  function open(){
   if(view)return true;if(!mountHost())return false;
   thread=h('div',{class:'thread','aria-live':'polite'},h('div',{class:'intro'},h('span',{},'✦'),state.trigger?.opener||'בודק בשבילך את הקטלוג ומתאים המלצה.'),state.items.flatMap(bubble));
   field=h('input',{type:'text',maxlength:'1000',autocomplete:'off',placeholder:'אפשר לדייק אותי כאן…','aria-label':'הודעה ליועץ'});sendBtn=h('button',{'aria-label':'שליחה'},'←');
   view=h('section',{class:'view','aria-label':'יועץ החיפוש'},
    h('header',{class:'head'},h('div',{},h('span',{class:'kicker'},(cfg.name||'Shop')+' Concierge'),h('h2',{},'בוא נמצא את מה שבאמת מתאים לך')),h('button',{class:'link',type:'button',onclick:all},'לכל התוצאות ←')),
    thread,h('form',{class:'compose',onsubmit:e=>{e.preventDefault();const m=field.value.trim();if(m&&!sendBtn.disabled){field.value='';turn(m);}}},field,sendBtn));
   shadow.querySelector('.wait')?.remove();shadow.append(view);return true;
  }
  async function turn(message,response=ask(message)){
   const mine=++run,live=()=>mine===run,note=h('span',{},'בודק את הקטלוג בשבילך'),thinking=h('div',{class:'thinking'},h('i'),h('i'),h('i'),note),found=h('div',{class:'grid'}),seen=new Set();
   const user={role:'user',text:message};state.items.push(user);thread.append(...bubble(user),thinking,found);sendBtn.disabled=true;
   const on=e=>{
    if(e.type==='thinking'||e.type==='step')note.textContent=e.text;
    else if(e.type==='products'){for(const p of e.products)if(!seen.has(p.id)&&seen.size<12){seen.add(p.id);found.append(card(p));}}
    else if(e.type==='done'){
     const answer={role:'assistant',text:e.reply,products:e.products||[]},nodes=bubble(answer).filter(Boolean);
     state.conversationId=e.conversationId||state.conversationId;state.history.push({role:'user',text:message},{role:'assistant',text:e.reply});state.items.push(answer);save();
     thinking.remove();found.replaceWith(...nodes);
    }
    else if(e.type==='error')throw Error(e.message);
   };
   try{
    const r=await response;
    if(!r.ok||!r.body)throw Error((await r.json().catch(()=>({}))).error||'היועץ לא זמין כרגע');
    const reader=r.body.getReader(),decoder=new TextDecoder();let buffer='';
    for(;;){
     const {done,value}=await reader.read();if(done)break;if(!live())return reader.cancel();
     buffer+=decoder.decode(value,{stream:true});
     for(let i;(i=buffer.indexOf('\n'))>=0;buffer=buffer.slice(i+1)){const line=buffer.slice(0,i).trim();if(line)on(JSON.parse(line));}
    }
   }catch(e){if(live()){state.items.pop();thinking.remove();found.replaceWith(h('div',{class:'msg agent err'},e.message||'היועץ לא זמין כרגע'));}}
   if(live())sendBtn.disabled=false;
  }
  return {
   // Storefronts that search without a page load (pushState) ask the same question from the page they are on.
   async check(q){
    q=String(q||'').trim();if(q.length<2||q===state.query||q===asked)return;
    const d=await decide(q);if(!d.open||!d.trigger||searched()!==q)return;
    host?.remove();host=view=null;for(const x of concealed)x.style.removeProperty('display');concealed=[];
    state=fresh(q,d.trigger);save();if(open())turn(q);
   },
   async ready(){
    if(resumed)return void open();
    if(asked){
     // Beside the takeover engine (which draws the results itself) the advisor only steps in on a decision to open.
     if(!cfg.search.engine)mountHost();
     const response=await early;early=null;
     if(response){if(open())turn(asked,response);return;}
     if(cfg.search.engine)return;
     if(cfg.search.frame)return void results(asked);
     // A plain search: the server now knows, and the same address answers with the results. Should it send the shell
     // again (its decision was lost), the results are asked for by name.
     const mark='semantixDemoPlain:'+cfg.id;let again=true;try{again=sessionStorage.getItem(mark)===asked;sessionStorage.setItem(mark,asked);}catch{}
     if(again)location.replace(here(true));else location.reload();
     return;
    }
    // Regular results of an advisory query: one step back to the conversation.
    if(new URLSearchParams(location.search).has('__semantix_results')&&state.query===searched()&&answered()){
     const h1=document.querySelector('h1');if(h1)h1.after(h('div',{'data-semantix-demo':'back'},h('button',{type:'button',style:'margin:10px 0;background:none;border:0;border-bottom:1px solid currentColor;padding:0 0 3px;font:inherit;font-size:14px;color:inherit;cursor:pointer',onclick:()=>{location.href=here(false);}},'→ חזרה ליועץ')));
    }
   }
  };
 })();
 if(cfg.mode!=='overlay'){const ready=()=>{mount();advisor.ready();};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();return;}
 // Capture on window runs before the site's own listeners on the input/form, so its autocomplete never fires.
 const own=e=>isSearchInput(e.target);
 window.addEventListener('keydown',e=>{if(own(e)&&e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();openOverlay(e.target.value.trim());}},true);
 for(const type of ['input','keyup','keypress','change'])window.addEventListener(type,e=>{if(own(e)){e.stopImmediatePropagation();if(type==='input'&&e.target.value.trim().length>=2)openOverlay(e.target.value.trim());}},true);
 window.addEventListener('submit',e=>{const i=[...e.target.elements||[]].find(isSearchInput);if(i){e.preventDefault();e.stopImmediatePropagation();openOverlay(i.value.trim());}},true);
 // Landing directly on the site's search results URL (e.g. /?s=, /search?q=) opens semantix results.
 const ready=()=>{mount();const q=searched();if(q)openOverlay(q);};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();
})();
