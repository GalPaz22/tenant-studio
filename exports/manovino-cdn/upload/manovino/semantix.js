/*! Semantix concierge · manovino.co.il · 6274cacdced5 · built 2026-11-09T11:55:55.549Z */
(function(){
if(window.__semantix_mv_concierge)return;window.__semantix_mv_concierge=true;
var me=document.currentScript;
var S={apiBase:((me&&me.getAttribute('data-api'))||'https://api.semantix-ai.com').replace(/\/+$/,''),apiKey:(me&&me.getAttribute('data-key'))||"semantix_688736e523c0352ad78525fe_1753691812345",trackingKey:"16d045a947580156564aaaa46e127d8b",idleMs:Number(me&&me.getAttribute('data-idle-ms'))||12000,version:"6274cacdced5"};
try{var th=document.createElement('style');th.id='semantix-manovino-concierge';th.textContent=".sx-mv-panel,.sx-mv-launcher{--mv-ink:#0e0f0f;--mv-wine:#910347;--mv-wine-dark:#6e0235;--mv-cream:#f1e8d4;--mv-cream-soft:#f8f3e8;--mv-line:#e4ddcd;--mv-grey:#6d6a64;--mv-bottle:#e3e3f4;--mv-bold:'NarkisBlock-Bold','narkisblock-regular_mfw',Arial,sans-serif;--mv-text:'narkisblock-regular_mfw',Arial,sans-serif;font-family:var(--mv-text)}.sx-mv-panel{position:fixed;top:0;right:0;bottom:0;z-index:2147483647;display:flex;flex-direction:column;box-sizing:border-box;width:440px;max-width:100vw;background:#fff;color:var(--mv-ink);border-left:1px solid var(--mv-ink);box-shadow:-24px 0 48px rgba(14,15,15,.12);transform:translateX(calc(100% + 60px));visibility:hidden;transition:transform .5s cubic-bezier(.16,1,.3,1),visibility 0s linear .5s;text-align:start;font-size:17px;line-height:1.55;letter-spacing:normal}.sx-mv-panel.is-open{transform:none;visibility:visible;transition:transform .5s cubic-bezier(.16,1,.3,1),visibility 0s}.sx-mv-panel *,.sx-mv-panel *::before,.sx-mv-panel *::after{box-sizing:border-box}.sx-mv-head{position:relative;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 22px 16px;background:#fff;border-bottom:1px solid var(--mv-ink)}.sx-mv-head::before{content:'';position:absolute;inset:0 0 auto;height:4px;background:var(--mv-wine)}.sx-mv-brand{display:flex;flex-direction:column;align-items:flex-start;gap:6px;min-width:0}.sx-mv-brand img{display:block;width:120px;height:auto;max-width:none;margin:0}.sx-mv-brand span{color:var(--mv-wine);font-family:var(--mv-bold);font-size:14px;line-height:1;letter-spacing:.02em}.sx-mv-panel .sx-mv-close{flex:none;display:grid!important;place-items:center;width:40px!important;height:40px!important;min-width:0!important;min-height:0!important;margin:0!important;padding:0!important;border:1px solid var(--mv-ink)!important;border-radius:50%!important;background:#fff!important;color:var(--mv-ink)!important;box-shadow:none!important;cursor:pointer;transition:background .2s ease,color .2s ease}.sx-mv-panel .sx-mv-close:hover,.sx-mv-panel .sx-mv-close:focus-visible{background:var(--mv-ink)!important;color:#fff!important}.sx-mv-close svg{display:block;width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}.sx-mv-thread{display:flex;flex:1;flex-direction:column;gap:16px;min-height:0;overflow-y:auto;overflow-x:hidden;padding:22px;background:#fff;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:var(--mv-line) transparent}.sx-mv-intro{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;margin:0 0 2px;padding:14px 16px;background:var(--mv-cream);animation:sx-mv-rise .5s cubic-bezier(.16,1,.3,1) both}.sx-mv-intro-label{color:var(--mv-grey);font-size:14px}.sx-mv-intro-query{color:var(--mv-ink);font-family:var(--mv-bold);font-size:19px;line-height:1.3}.sx-mv-intro p{flex-basis:100%;margin:2px 0 0!important;padding:0;color:var(--mv-ink);font-size:16px;line-height:1.5}.sx-mv-message{max-width:94%;font-size:17px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere;animation:sx-mv-rise .35s ease both}.sx-mv-message strong{font-family:var(--mv-bold);font-weight:400}@keyframes sx-mv-rise{from{opacity:0;transform:translateY(8px)}}.sx-mv-agent{align-self:flex-start;padding:0 14px 0 0;border-right:2px solid var(--mv-wine);color:var(--mv-ink)}.sx-mv-user{align-self:flex-end;padding:10px 14px;background:var(--mv-ink);color:#fff}.sx-mv-error{align-self:flex-start;padding:10px 14px;background:#fbefef;color:#8a1f17;font-size:15px}.sx-mv-thinking{display:flex;align-items:center;gap:5px;align-self:flex-start;color:var(--mv-grey);font-size:14px;padding:4px 0}.sx-mv-thinking i{display:block;width:7px;height:7px;border-radius:50%;background:var(--mv-wine);animation:sx-mv-dot 1.1s ease-in-out infinite}.sx-mv-thinking i:nth-child(2){animation-delay:.14s}.sx-mv-thinking i:nth-child(3){animation-delay:.28s;margin-inline-end:6px}@keyframes sx-mv-dot{0%,60%,100%{opacity:.25;transform:none}30%{opacity:1;transform:translateY(-3px)}}.sx-mv-skeleton{display:flex;flex-direction:column;gap:10px;width:100%}.sx-mv-skeleton div{height:112px;background:linear-gradient(100deg,var(--mv-cream-soft) 30%,var(--mv-cream) 50%,var(--mv-cream-soft) 70%) 0 0/300% 100%;animation:sx-mv-shimmer 1.4s linear infinite}@keyframes sx-mv-shimmer{to{background-position:-150% 0}}.sx-mv-cards{display:flex;flex-direction:column;gap:10px;width:100%}.sx-mv-panel a.sx-mv-card{position:relative;display:flex;align-items:stretch;gap:16px;padding:0;border:1px solid var(--mv-line);background:#fff;color:var(--mv-ink)!important;text-decoration:none!important;transition:border-color .2s ease,transform .2s ease;animation:sx-mv-rise .45s cubic-bezier(.16,1,.3,1) both;animation-delay:calc(var(--i,0)*70ms)}.sx-mv-panel a.sx-mv-card:hover,.sx-mv-panel a.sx-mv-card:focus-visible{border-color:var(--mv-ink);color:var(--mv-ink)!important;text-decoration:none!important}.sx-mv-card-media{flex:0 0 96px;align-self:stretch;min-height:120px;display:grid;place-items:center;overflow:hidden;background:var(--mv-bottle)}.sx-mv-card-media img{display:block;width:100%;height:100%;max-width:none;object-fit:cover;transition:transform .5s cubic-bezier(.16,1,.3,1)}.sx-mv-card:hover .sx-mv-card-media img{transform:scale(1.05)}.sx-mv-card-body{display:flex;flex:1;flex-direction:column;justify-content:center;gap:6px;min-width:0;padding:12px 0}.sx-mv-card-name{font-size:17px;line-height:1.3}.sx-mv-note{color:var(--mv-grey);font-size:14px;line-height:1.4}.sx-mv-card-price{display:flex;align-items:baseline;gap:10px;margin-top:2px;color:var(--mv-ink)}.sx-mv-card-price b{font-family:var(--mv-text);font-size:24px;font-weight:400;line-height:1}.sx-mv-card-price small{margin-inline-start:2px;font-size:14px}.sx-mv-card-price del{color:#9c978d;text-decoration:line-through}.sx-mv-card-price del b{font-size:17px}.sx-mv-card-price ins{color:var(--mv-wine);text-decoration:none;background:none}.sx-mv-card-price del+ins{color:var(--mv-wine)}.sx-mv-card-price ins:only-child{color:var(--mv-ink)}.sx-mv-card-go{flex:none;display:grid;place-items:center;width:44px;color:var(--mv-ink);opacity:.35;transition:opacity .2s ease,transform .2s ease}.sx-mv-card:hover .sx-mv-card-go{opacity:1;transform:translateX(-3px)}.sx-mv-card-go svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}.sx-mv-chips{display:flex;flex-wrap:wrap;gap:8px;animation:sx-mv-rise .4s ease both}.sx-mv-panel .sx-mv-chip{display:inline-flex!important;align-items:center;height:36px!important;min-width:0!important;margin:0!important;padding:3px 16px 0!important;border:1px solid var(--mv-ink)!important;border-radius:0!important;background:#fff!important;color:var(--mv-ink)!important;font-family:var(--mv-text)!important;font-size:15px!important;line-height:1!important;box-shadow:none!important;cursor:pointer;transition:background .2s ease,color .2s ease}.sx-mv-panel .sx-mv-chip:hover,.sx-mv-panel .sx-mv-chip:focus-visible{background:var(--mv-ink)!important;color:#fff!important}.sx-mv-compose{display:flex;align-items:flex-end;gap:12px;margin:0;padding:14px 22px 18px;border-top:1px solid var(--mv-line);background:#fff}.sx-mv-panel .sx-mv-compose input{flex:1;min-width:0;height:46px!important;margin:0!important;padding:0 2px!important;border:0!important;border-bottom:1px solid var(--mv-ink)!important;border-radius:0!important;background:transparent!important;color:var(--mv-ink)!important;font-family:var(--mv-text)!important;font-size:17px!important;box-shadow:none!important;outline:none}.sx-mv-panel .sx-mv-compose input:focus{border-bottom:2px solid var(--mv-wine)!important}.sx-mv-panel .sx-mv-compose input::placeholder{color:#9c978d;opacity:1}.sx-mv-panel .sx-mv-compose button{flex:none;display:grid!important;place-items:center;width:46px!important;height:46px!important;min-width:0!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:var(--mv-wine)!important;color:#fff!important;box-shadow:none!important;cursor:pointer;transition:background .2s ease}.sx-mv-panel .sx-mv-compose button:hover{background:var(--mv-wine-dark)!important}.sx-mv-panel .sx-mv-compose button:disabled{opacity:.4;cursor:default}.sx-mv-compose svg{display:block;width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.sx-mv-launcher{position:fixed;right:22px;bottom:22px;z-index:2147483646;display:inline-flex!important;align-items:center;gap:8px;height:50px!important;margin:0!important;padding:3px 20px 0 18px!important;border:0!important;border-radius:25px!important;background:var(--mv-wine)!important;color:#fff!important;font-family:var(--mv-bold)!important;font-size:17px!important;line-height:1!important;box-shadow:0 10px 28px rgba(110,2,53,.32)!important;cursor:pointer;animation:sx-mv-launch .6s cubic-bezier(.16,1,.3,1) both}.sx-mv-launcher[hidden]{display:none!important}.sx-mv-launcher svg{width:20px;height:20px;margin-top:-3px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}.sx-mv-launcher.is-nudge{animation:sx-mv-launch .6s cubic-bezier(.16,1,.3,1) both,sx-mv-pulse 2.4s ease-out .8s 3}@keyframes sx-mv-launch{from{opacity:0;transform:translateY(24px)}}@keyframes sx-mv-pulse{0%{box-shadow:0 0 0 0 rgba(145,3,71,.45),0 10px 28px rgba(110,2,53,.32)}100%{box-shadow:0 0 0 18px rgba(145,3,71,0),0 10px 28px rgba(110,2,53,.32)}}html.sx-mv-push body{width:auto!important;min-width:0!important;margin-right:440px!important;overflow-x:hidden}html.sx-mv-push body>* header:not(.sx-mv-head),html.sx-mv-push .loader-wrapper,html.sx-mv-push #headerShopSideBG,html.sx-mv-push .modal{left:0!important;right:440px!important;width:auto!important}html.sx-mv-push .navQuickAlert{right:440px!important}html.sx-mv-push .cookies-disclaimer{right:450px!important}html.sx-mv-push body>.stickyButton{right:455px!important}html.sx-mv-push .headerShop,html.sx-mv-push .headerShopLogin{left:calc(50% - 220px)!important}html.sx-mv-pushing body{width:auto!important;min-width:0!important}html.sx-mv-pushing body>* header:not(.sx-mv-head){left:0!important;width:auto!important}html.sx-mv-pushing body,html.sx-mv-pushing body>* header:not(.sx-mv-head),html.sx-mv-pushing .cookies-disclaimer,html.sx-mv-pushing body>.stickyButton{transition:margin-right .5s cubic-bezier(.16,1,.3,1),right .5s cubic-bezier(.16,1,.3,1)!important}html.sx-mv-push .sx-mv-panel{box-shadow:none}@media (max-width:767px){.sx-mv-panel{top:auto;left:0;width:100%;height:84vh;height:84dvh;border-left:0;border-top:1px solid var(--mv-ink);box-shadow:0 -18px 40px rgba(14,15,15,.18);transform:translateY(calc(100% + 60px))}.sx-mv-head{padding:16px 16px 12px}.sx-mv-head::after{content:'';position:absolute;top:9px;left:50%;width:40px;height:3px;margin-left:-20px;background:var(--mv-line)}.sx-mv-brand img{width:104px}.sx-mv-thread{padding:16px}.sx-mv-message{max-width:98%;font-size:16px}.sx-mv-card-media{flex-basis:84px;min-height:108px}.sx-mv-compose{padding:10px 16px calc(12px + env(safe-area-inset-bottom,0px))}.sx-mv-launcher{right:14px;bottom:14px;height:46px!important;font-size:16px!important}}@media (prefers-reduced-motion:reduce){.sx-mv-panel,.sx-mv-panel *,.sx-mv-launcher{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}";document.head.appendChild(th);}catch(e){}
function semantixManoVinoConcierge(S){
var CLOSED='semantix_cx_closed',IDLE_DONE='semantix_cx_idle:',STEP_MS=2200,IDLE_MS=S.idleMs||12000;
var FILLERS=['בודק מה פתוח על המדף…','עוד רגע, בוחר בקבוקים…'];
var INTRO={out_of_stock:'הבקבוק שחיפשת אזל כרגע. הנה מה שהייתי מוזג במקומו.',not_carried:'את זה אין לנו על המדף, אבל יש משהו קרוב.',not_shown:'מצאתי בדיוק את מה שחיפשת.',consultative:'בוא נמצא את הבקבוק הנכון.',idle:'מתלבטים? אני כאן לעזור לבחור.',no_results:'לא מצאתי התאמה מדויקת. בוא ננסה יחד.'};
var CHIPS={consultative:['עד 100 ₪','רק כשר','משהו מפתיע'],idle:['עד 100 ₪','לארוחה','למתנה'],out_of_stock:['משהו זול יותר','מאותו אזור'],not_carried:['משהו זול יותר','מאותו סגנון'],no_results:['יין אדום','יין לבן','מתנה']};
var LOGO='https://media.getmood.io/warehouse/dynamic/311683.svg';
var st={anchor:null,panel:null,launcher:null,thread:null,form:null,input:null,conversation:null,busy:false,pending:null,query:'',reason:'',engaged:false,decided:false};
function api(path,body,key){var h={'Content-Type':'application/json','X-API-Key':key||S.apiKey};return fetch(S.apiBase+path,{method:'POST',headers:h,body:JSON.stringify(body),keepalive:path==='/product-click'});}
function store(k,v){try{if(v===undefined)return sessionStorage.getItem(k);if(v===null)sessionStorage.removeItem(k);else sessionStorage.setItem(k,v);}catch(e){}return null;}
function visitor(){try{var v=JSON.parse(localStorage.getItem('manovino_visitor_id')||'null');if(v)return v;v='vis_'+Date.now()+'_'+Math.random().toString(36).slice(2);localStorage.setItem('manovino_visitor_id',JSON.stringify(v));return v;}catch(e){return null;}}
function searchQuery(){if(!/^\/aisearch/i.test(location.pathname))return '';try{return String(new URLSearchParams(location.search).get('q')||'').replace(/\s+/g,' ').trim().slice(0,200);}catch(e){return '';}}
function shownIds(){var o=[];document.querySelectorAll('.catalogItemBox[item-id]').forEach(function(b){var id=b.getAttribute('item-id');if(id&&o.indexOf(id)<0&&o.length<24)o.push(id);});return o;}
function openDialog(root){return !!(root&&root.querySelector&&root.querySelector('dialog[open]'));}
function blocked(){
 if(document.visibilityState==='hidden'||openDialog(document))return true;
 var hosts=document.querySelectorAll('flashy-popup');for(var i=0;i<hosts.length;i++)if(openDialog(hosts[i].shadowRoot))return true;
 for(var e=document.elementFromPoint(innerWidth/2,innerHeight/2);e&&e!==document.body&&e!==document.documentElement;e=e.parentElement){
  if(openDialog(e.shadowRoot))return true;
  if(e.closest('.sx-mv-panel,.sx-mv-launcher'))return false;
  if(getComputedStyle(e).position==='fixed'&&e.offsetWidth*e.offsetHeight>=innerWidth*innerHeight*.25)return true;
 }
 return false;
}
function whenFree(fn){(function wait(){if(blocked())return setTimeout(wait,500);fn();})();}

/* The moments */
function decide(idle){
 return api('/concierge/decide',{query:st.query,session_id:S.session,shown:shownIds(),idle:!!idle}).then(function(r){return r.ok?r.json():null;}).then(function(d){
  if(!d||!d.open||!d.trigger||st.conversation)return false;
  whenFree(function(){if(!st.conversation&&!st.busy)start(d.trigger);});return true;
 }).catch(function(){return false;});
}
function watchIdle(){
 if(store(IDLE_DONE+st.query))return;
 var left=IDLE_MS,last=Date.now(),timer=setInterval(function(){
  var now=Date.now(),step=now-last;last=now;
  if(st.engaged||st.conversation){clearInterval(timer);return;}
  if(blocked())return;left-=step;
  if(left<=0){clearInterval(timer);store(IDLE_DONE+st.query,'1');decide(true);}
 },500);
}
function start(trigger){
 build();st.reason=trigger.reason;
 if(store(CLOSED)==='1'){st.pending=trigger;showLauncher(true,true);return;}
 st.pending=null;showLauncher(false);st.thread.textContent='';st.conversation=null;
 var intro=document.createElement('div');intro.className='sx-mv-intro';
 intro.innerHTML='<span class="sx-mv-intro-label">חיפשת</span><span class="sx-mv-intro-query"></span><p></p>';
 intro.querySelector('.sx-mv-intro-query').textContent=trigger.query||st.query;
 intro.querySelector('p').textContent=INTRO[trigger.reason]||'';
 st.thread.appendChild(intro);
 open();send(null,trigger);
}

/* The panel */
var CLOSE='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',SEND='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6"/></svg>',GLASS='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10l-.6 5.2A4.4 4.4 0 0 1 12 12.2a4.4 4.4 0 0 1-4.4-4L7 3Zm5 9.2V20m-3.5 0h7"/></svg>';
function build(){
 if(st.panel)return;
 var p=document.createElement('aside');p.className='sx-mv-panel';p.dir='rtl';p.setAttribute('role','dialog');p.setAttribute('aria-label','הסומלייה של מנו וינו');
 p.innerHTML='<header class="sx-mv-head"><div class="sx-mv-brand"><img src="'+LOGO+'" alt="MANO VINO" width="120" height="28"><span>הסומלייה שלנו · AI</span></div><button type="button" class="sx-mv-close" aria-label="סגירה">'+CLOSE+'</button></header><div class="sx-mv-thread" aria-live="polite"></div><form class="sx-mv-compose"><input type="text" maxlength="1000" autocomplete="off" placeholder="ספרו לי מה מגישים, למי ובאיזה תקציב…" aria-label="הודעה לסומלייה"><button type="submit" aria-label="שליחה">'+SEND+'</button></form>';
 document.body.appendChild(p);
 st.panel=p;st.thread=p.querySelector('.sx-mv-thread');st.form=p.querySelector('form');st.input=p.querySelector('input');
 var l=document.createElement('button');l.type='button';l.className='sx-mv-launcher';l.dir='rtl';l.hidden=true;l.innerHTML=GLASS+'<span>הסומלייה</span>';document.body.appendChild(l);st.launcher=l;
 l.addEventListener('click',function(){store(CLOSED,null);var t=st.pending;if(t)return start(t);showLauncher(false);open();});
 p.querySelector('.sx-mv-close').addEventListener('click',close);
 document.addEventListener('keydown',function(e){if(e.key==='Escape'&&isOpen())close();});
 st.form.addEventListener('submit',function(e){e.preventDefault();var m=st.input.value.trim();if(!m||st.busy)return;st.input.value='';send(m,null);});
 st.thread.addEventListener('click',function(e){
  var chip=e.target.closest&&e.target.closest('.sx-mv-chip');if(chip&&!st.busy){var box=chip.parentNode;box.parentNode.removeChild(box);send(chip.textContent,null);return;}
  var card=e.target.closest&&e.target.closest('.sx-mv-card');if(card)clicked(card.getAttribute('data-pid'),card.getAttribute('data-name'));
 });
}
function isOpen(){return !!st.panel&&st.panel.classList.contains('is-open');}
function showLauncher(on,nudge){if(!st.launcher)return;st.launcher.hidden=!on;st.launcher.classList.toggle('is-nudge',!!nudge);}
var PUSH_MIN=1100,pushTimer=null;
function push(){var root=document.documentElement,on=isOpen()&&window.innerWidth>=PUSH_MIN;if(on===root.classList.contains('sx-mv-push'))return;
 function done(e){if(e&&(e.target!==document.body||e.propertyName!=='margin-right'))return;clearTimeout(pushTimer);document.body.removeEventListener('transitionend',done);root.classList.remove('sx-mv-pushing');}
 root.classList.add('sx-mv-pushing');root.classList.toggle('sx-mv-push',on);clearTimeout(pushTimer);
 document.body.addEventListener('transitionend',done);pushTimer=setTimeout(done,1000);}
window.addEventListener('resize',function(){if(st.panel)push();});
function open(){st.panel.classList.add('is-open');document.documentElement.classList.add('sx-mv-open');push();
 // On a phone focus would raise the keyboard over the answer.
 if(window.innerWidth>=768)setTimeout(function(){if(isOpen()&&!st.busy)st.input.focus();},450);}
function close(){st.panel.classList.remove('is-open');document.documentElement.classList.remove('sx-mv-open');push();store(CLOSED,'1');showLauncher(true);}
function scroll(){var t=st.thread,max=t.scrollHeight-t.clientHeight,a=st.anchor;t.scrollTop=a&&a.parentNode===t?Math.min(max,a.offsetTop-t.offsetTop-12):max;}
function esc(t){return String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function write(el,text){el.textContent='';String(text||'').replace(/^[ \t]*\*[ \t]+/gm,'• ').trim().split(/(\*\*[^*\n]+\*\*)/g).forEach(function(part){if(!part)return;if(/^\*\*[^*\n]+\*\*$/.test(part)){var b=document.createElement('strong');b.textContent=part.slice(2,-2);el.appendChild(b);}else el.appendChild(document.createTextNode(part));});}
function bubble(kind,text){var b=document.createElement('div');b.className='sx-mv-message sx-mv-'+kind;write(b,text);st.thread.appendChild(b);scroll();return b;}
function price(v){var n=Number(v);if(isNaN(n))return esc(v);var s=n%1?n.toFixed(2):String(n);return '<b>'+s+'</b><small>₪</small>';}
function safeUrl(u){return /^(https?:)?\//.test(String(u||''))?u:'#';}
function cards(products){
 var seen={},list=(products||[]).filter(function(p){var id=p&&p.product_id;if(!id||seen[id]||p.in_stock===false)return false;return seen[id]=true;});
 if(!list.length)return null;
 var box=document.createElement('div');box.className='sx-mv-cards';
 box.innerHTML=list.map(function(p,i){return '<a class="sx-mv-card" style="--i:'+i+'" data-pid="'+esc(p.product_id)+'" data-name="'+esc(p.name)+'" href="'+esc(safeUrl(p.url))+'"><span class="sx-mv-card-media">'+(p.image?'<img src="'+esc(p.image)+'" alt="" loading="lazy">':'')+'</span><span class="sx-mv-card-body"><span class="sx-mv-card-name">'+esc(p.name)+'</span>'+(p.match_reason?'<span class="sx-mv-note">'+esc(p.match_reason)+'</span>':'')+(p.price!=null?'<span class="sx-mv-card-price">'+(p.regular_price?'<del>'+price(p.regular_price)+'</del>':'')+'<ins>'+price(p.price)+'</ins></span>':'')+'</span><span class="sx-mv-card-go" aria-hidden="true">'+SEND+'</span></a>';}).join('');
 return box;
}
function chips(){var list=CHIPS[st.reason];if(!list)return;var box=document.createElement('div');box.className='sx-mv-chips';box.innerHTML=list.map(function(c){return '<button type="button" class="sx-mv-chip">'+esc(c)+'</button>';}).join('');st.thread.appendChild(box);}
function searching(q){q=String(q||'').replace(/\s+/g,' ').trim();return q?'מחפש "'+(q.length>40?q.slice(0,40)+'…':q)+'" על המדף…':'רגע, בודק…';}
function send(message,trigger){
 if(st.busy)return;st.busy=true;st.input.disabled=true;st.form.querySelector('button').disabled=true;
 var old=st.thread.querySelector('.sx-mv-chips');if(old)old.remove();
 st.anchor=message?bubble('user',message):st.thread.firstChild;
 var think=document.createElement('div');think.className='sx-mv-thinking';think.setAttribute('role','status');think.innerHTML='<i></i><i></i><i></i><span></span>';st.thread.appendChild(think);
 var skeleton=document.createElement('div');skeleton.className='sx-mv-skeleton';skeleton.setAttribute('aria-hidden','true');skeleton.innerHTML='<div></div><div></div>';st.thread.appendChild(skeleton);scroll();
 var timer=null,answer=null,text='',products=[],box=null,failed=false;
 function status(t,i){clearTimeout(timer);if(!think)return;think.querySelector('span').textContent=t;i=i||0;if(i<FILLERS.length)timer=setTimeout(function(){status(FILLERS[i],i+1);},STEP_MS);}
 function stopThink(){clearTimeout(timer);if(think){think.remove();think=null;}}
 function stopSkeleton(){if(skeleton){skeleton.remove();skeleton=null;}}
 function above(el){var at=box||skeleton;if(at)st.thread.insertBefore(el,at);}
 function showCards(){if(box)return;box=cards(products);if(!box)return;if(skeleton)st.thread.insertBefore(box,skeleton);else st.thread.appendChild(box);stopSkeleton();}
 function say(chunk){stopThink();if(!answer){answer=bubble('agent','');above(answer);}text+=chunk||'';write(answer,text);if(!box)scroll();}
 function fail(m){failed=true;stopThink();stopSkeleton();bubble('error',m||'משהו השתבש. אפשר לנסות שוב.');}
 function onEvent(name,d){
  if(name==='meta')st.conversation=d.conversation_id||st.conversation;
  if(name==='tool_start'){if(d.tool==='search_catalog'&&d.query)status(searching(d.query));else if(d.tool==='get_product')status('קורא את התווית…');else if(d.tool==='find_alternatives')status('מחפש בקבוק דומה במלאי…');else if(d.tool==='present_products')status('בוחר את הבקבוקים בשבילך…');}
  if(name==='tool_end'&&d.tool==='search_catalog'&&d.count>0)status('מצאתי '+d.count+' בקבוקים, משווה ביניהם…');
  if(name==='tool_end'&&d.tool==='present_products'){(d.products||[]).forEach(function(p){products.push(p);});status('מסכם המלצה…');showCards();}
  if(name==='text')say(d.text);
  if(name==='text_reset'){text='';if(answer){answer.remove();answer=null;}}
  if(name==='error')fail(d.message);
 }
 status(searching(message||(trigger&&trigger.query)));
 var body={session_id:S.session};if(st.conversation)body.conversation_id=st.conversation;if(message)body.message=message;
 if(trigger)body.trigger={reason:trigger.reason,query:trigger.query,product_ids:trigger.product_ids||[]};
 api('/concierge/chat',body).then(function(r){
  if(!r.ok)throw Error('HTTP '+r.status);
  if((r.headers.get('content-type')||'').indexOf('text/event-stream')<0)return r.json().then(function(d){st.conversation=d.conversation_id||st.conversation;if(d.error)fail(d.error);else say(d.reply);(d.products||[]).forEach(function(p){products.push(p);});});
  var reader=r.body.getReader(),decoder=new TextDecoder(),buffer='';
  function read(){return reader.read().then(function(c){if(c.done)return;buffer+=decoder.decode(c.value,{stream:true});var frames=buffer.split('\n\n');buffer=frames.pop();frames.forEach(function(f){var e=f.match(/^event: (.+)$/m),d=f.match(/^data: (.*)$/m);if(!e||!d)return;var v;try{v=JSON.parse(d[1]);}catch(x){return;}onEvent(e[1],v);});return read();});}
  return read();
 }).catch(function(){fail('לא הצלחתי להתחבר כרגע. אפשר לנסות שוב.');}).then(function(){
  stopThink();showCards();stopSkeleton();st.busy=false;st.input.disabled=false;st.form.querySelector('button').disabled=false;
  if(trigger&&!failed)chips();scroll();
  if(isOpen()&&window.innerWidth>=768)st.input.focus();
 });
}
function clicked(id,name){
 if(!id)return;st.engaged=true;
 try{api('/product-click',{product_id:String(id),product_name:name||'',search_query:st.query||'direct',search_source:'concierge',session_id:S.session,conversation_id:st.conversation},S.trackingKey).catch(function(){});}catch(e){}
}

/* Start */
st.query=searchQuery();
if(!st.query)return;
S.session=visitor();
document.addEventListener('click',function(e){var t=e.target;if(t&&t.closest&&t.closest('.catalogItemBox,#addToCartBtn'))st.engaged=true;},true);
function go(){decide(false).then(function(opened){if(!opened)watchIdle();});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go);else go();
}
try{semantixManoVinoConcierge(S);}catch(e){}
})();
