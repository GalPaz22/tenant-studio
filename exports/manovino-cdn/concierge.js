// Mano Vino's concierge beside the search results (built into dist/semantix-manovino.js by build-bundle.mjs).
// manovino.co.il prints its results on the server (/AISearch/?q=…), so this script reads the query and the bottles on
// screen from the page, asks POST /concierge/decide, and opens only on a yes: the bottle searched for is sold out, the
// shop doesn't carry it, it's in stock but not on screen, the search asks for advice, or (asked again) the shopper sat
// on the results for IDLE_MS without opening a bottle. The chat is the server's /concierge/chat, the same one Steimatzky,
// Garmin and Beautics use. A shopper who closes the panel is not interrupted again in that tab; later moments wait
// behind the launcher.
function semantixManoVinoConcierge(S){
var CLOSED='semantix_cx_closed',IDLE_DONE='semantix_cx_idle:',STEP_MS=2200,IDLE_MS=S.idleMs||12000;
var FILLERS=['בודק מה פתוח על המדף…','עוד רגע, בוחר בקבוקים…'];
var INTRO={out_of_stock:'הבקבוק שחיפשת אזל כרגע. הנה מה שהייתי מוזג במקומו.',not_carried:'את זה אין לנו על המדף, אבל יש משהו קרוב.',not_shown:'מצאתי בדיוק את מה שחיפשת.',consultative:'בוא נמצא את הבקבוק הנכון.',idle:'מתלבטים? אני כאן לעזור לבחור.',no_results:'לא מצאתי התאמה מדויקת. בוא ננסה יחד.'};
var CHIPS={consultative:['עד 100 ₪','רק כשר','משהו מפתיע'],idle:['עד 100 ₪','לארוחה','למתנה'],out_of_stock:['משהו זול יותר','מאותו אזור'],not_carried:['משהו זול יותר','מאותו סגנון'],no_results:['יין אדום','יין לבן','מתנה']};
var LOGO='https://media.getmood.io/warehouse/dynamic/311683.svg';
var st={anchor:null,panel:null,launcher:null,thread:null,form:null,input:null,conversation:null,busy:false,pending:null,query:'',reason:'',engaged:false,decided:false};
function api(path,body,key){var h={'Content-Type':'application/json','X-API-Key':key||S.apiKey};return fetch(S.apiBase+path,{method:'POST',headers:h,body:JSON.stringify(body),keepalive:path==='/product-click'});}
function store(k,v){try{if(v===undefined)return sessionStorage.getItem(k);if(v===null)sessionStorage.removeItem(k);else sessionStorage.setItem(k,v);}catch(e){}return null;}
// The visitor id the store's tracking script keeps (manovino_visitor_id, JSON); made here in its format when it isn't there yet.
function visitor(){try{var q=(location.search.match(/[?&]semantix_vid=(vis_[\w-]{4,80})/)||[])[1];if(q){localStorage.setItem('manovino_visitor_id',JSON.stringify(q));return q;}var v=JSON.parse(localStorage.getItem('manovino_visitor_id')||'null');if(v)return v;v='vis_'+Date.now()+'_'+Math.random().toString(36).slice(2);localStorage.setItem('manovino_visitor_id',JSON.stringify(v));return v;}catch(e){return null;}}
function searchQuery(){if(!/^\/aisearch/i.test(location.pathname))return '';try{return String(new URLSearchParams(location.search).get('q')||'').replace(/\s+/g,' ').trim().slice(0,200);}catch(e){return '';}}
function shownIds(){var o=[];document.querySelectorAll('.catalogItemBox[item-id]').forEach(function(b){var id=b.getAttribute('item-id');if(id&&o.indexOf(id)<0&&o.length<24)o.push(id);});return o;}
// The age gate, Flashy's popup and the site's drawers come first: the panel waits while any of them covers the page.
// Flashy's is a modal <dialog> in a shadow root, drawn above every z-index; the others are large fixed layers.
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
// Seconds on the results without opening a bottle, counted only while the tab is in front and nothing covers the page.
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
 // The site's round "up" button sits in the same corner and moves (a cookie bar pushes it up, it appears while scrolling): keep the launcher just above it.
 function lift(){try{var base=window.innerWidth<768?14:22,b=base,u=document.querySelector('.stickyButton img[alt*="למעלה"]');u=u&&u.closest('.stickyButton');if(u){var r=u.getBoundingClientRect(),cs=getComputedStyle(u);if(r.width&&cs.display!=='none'&&cs.visibility!=='hidden'&&parseFloat(cs.opacity||'1')>0.05&&r.right>window.innerWidth-140&&r.bottom>window.innerHeight-360)b=Math.max(base,Math.round(window.innerHeight-r.top+12));}l.style.bottom=b+'px';}catch(e){}}
 lift();setInterval(lift,500);window.addEventListener('resize',lift);
 l.addEventListener('click',function(){store(CLOSED,null);var t=st.pending;if(t)return start(t);showLauncher(false);open();});
 p.querySelector('.sx-mv-close').addEventListener('click',close);
 document.addEventListener('keydown',function(e){if(e.key==='Escape'&&isOpen())close();});
 function submitInput(){var m=st.input.value.trim();if(!m||st.busy)return;st.input.value='';send(m,null);}
st.form.addEventListener('submit',function(e){e.preventDefault();submitInput();});
// Enter sends. The store's own scripts swallow Enter on the page, so this listens first (window, capture) and keeps IME composition (Enter that picks a letter) out of it.
window.addEventListener('keydown',function(e){if(e.target!==st.input||e.key!=='Enter'||e.isComposing||e.shiftKey)return;e.preventDefault();e.stopImmediatePropagation();submitInput();},true);
 st.thread.addEventListener('click',function(e){
  var chip=e.target.closest&&e.target.closest('.sx-mv-chip');if(chip&&!st.busy){var box=chip.parentNode;box.parentNode.removeChild(box);send(chip.textContent,null);return;}
  var card=e.target.closest&&e.target.closest('.sx-mv-card');if(card)clicked(card.getAttribute('data-pid'),card.getAttribute('data-name'));
 });
}
function isOpen(){return !!st.panel&&st.panel.classList.contains('is-open');}
function showLauncher(on,nudge){if(!st.launcher)return;st.launcher.hidden=!on;st.launcher.classList.toggle('is-nudge',!!nudge);}
// From 1100px the page steps aside for the panel instead of lying under it (concierge.css, html.sx-mv-push).
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
// The thread follows a turn only until its start (the shopper's message, or the opening) reaches the top: the answer is
// read from its first word, and the cards under it are a scroll away.
function scroll(){var t=st.thread,max=t.scrollHeight-t.clientHeight,a=st.anchor;t.scrollTop=a&&a.parentNode===t?Math.min(max,a.offsetTop-t.offsetTop-12):max;}
function esc(t){return String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
// Only **bold** from the model becomes markup; everything else stays text.
function write(el,text){el.textContent='';String(text||'').replace(/^[ \t]*\*[ \t]+/gm,'• ').trim().split(/(\*\*[^*\n]+\*\*)/g).forEach(function(part){if(!part)return;if(/^\*\*[^*\n]+\*\*$/.test(part)){var b=document.createElement('strong');b.textContent=part.slice(2,-2);el.appendChild(b);}else el.appendChild(document.createTextNode(part));});}
function bubble(kind,text){var b=document.createElement('div');b.className='sx-mv-message sx-mv-'+kind;write(b,text);st.thread.appendChild(b);scroll();return b;}
// The store prints prices as "49" or "129.90" with a small shekel sign.
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
 if(trigger)body.trigger={reason:trigger.reason,query:trigger.query,product_ids:trigger.product_ids||[],recent:st.recent};
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
// A bottle opened from the panel counts as a click from the search, marked as the concierge's.
function clicked(id,name){
 if(!id)return;st.engaged=true;
 try{api('/product-click',{product_id:String(id),product_name:name||'',search_query:st.query||'direct',search_source:'concierge',session_id:S.session,conversation_id:st.conversation},S.trackingKey).catch(function(){});}catch(e){}
}

/* Start */
st.query=searchQuery();
if(!st.query)return;
// The searches made earlier in this tab (not this one), so a follow-up like "טבעי" after "בורגון" keeps its context.
st.recent=[];try{var rl=JSON.parse(store('semantix_cx_recent')||'[]');if(Array.isArray(rl)){st.recent=rl.filter(function(q){return q&&q!==st.query;}).slice(-3);store('semantix_cx_recent',JSON.stringify(st.recent.concat([st.query]).slice(-4)));}}catch(e){}
S.session=visitor();
// A bottle opened or added from the results: the shopper found something, so no idle moment.
document.addEventListener('click',function(e){var t=e.target;if(t&&t.closest&&t.closest('.catalogItemBox,#addToCartBtn'))st.engaged=true;},true);
function go(){decide(false).then(function(opened){if(!opened)watchIdle();});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go);else go();
}
