// Rikushet card skin (built into dist/semantix-rikushet.js ahead of the engine by build-bundle.mjs).
// The engine's card template has no fields for the brand, the sale bar, the store's black tag or the colour dots, so the
// bundle keeps the products Semantix returns (/search, /fast-search, /autocomplete) by id and fills those slots of every
// card with the store's own markup, which the store's CSS styles. Nothing is requested here.
(function(){
var D=Object.create(null),API=/\/(search|fast-search|autocomplete)(\?|$)/;
function keep(o,depth){
 if(!o||typeof o!=='object'||depth>5)return;
 if(Array.isArray(o)){for(var i=0;i<o.length;i++)keep(o[i],depth+1);return;}
 if((o.id!=null||o.sku)&&(o.title||o.name)){if(o.id!=null)D[String(o.id)]=o;if(o.sku)D[String(o.sku)]=o;}
 for(var k in o)if(o[k]&&typeof o[k]==='object')keep(o[k],depth+1);
}
var of=window.fetch;
if(of)window.fetch=function(u){
 var p=of.apply(this,arguments),url=typeof u==='string'?u:(u&&u.url)||'';
 if(API.test(url.split('#')[0].replace(/^https?:\/\/[^\/]+/,'').replace(/^\/__sx/,'')))p.then(function(r){try{r.clone().json().then(function(j){keep(j,0);schedule();}).catch(function(){});}catch(e){}}).catch(function(){});
 return p;
};
function esc(t){return String(t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function stamp(el,text,bg){
 if(!text){el.textContent='';return;}
 el.innerHTML='<span class="value dark hasbg" dir="rtl" style="background:'+bg+';--bg-color:'+bg+'">'+esc(text)+'</span>';
}
function fill(li){
 var p=D[li.getAttribute('data-semantix-pid')];if(!p)return false;
 var q=function(s){return li.querySelector('[data-sx-slot="'+s+'"]')};
 var b=Array.isArray(p.badges)?p.badges:[],of=function(k){return b.filter(function(x){return x&&x.kind===k})};
 var brand=q('brand'),br=of('rk-brand')[0];if(brand)brand.textContent=br?br.text:'';
 var sale=q('sale'),sl=of('rk-sale')[0];if(sale)stamp(sale,sl&&sl.text,'#011231');
 var st=q('stamp'),sp=of('rk-stamp')[0];if(st)stamp(st,sp&&sp.text,'#000000');
 var sw=q('swatches'),c=of('rk-swatch');
 if(sw){
  sw.innerHTML=c.length?'<div class="swatch-attribute color"><div class="swatch-attribute-options clearfix">'+c.map(function(x){
   var bg=x.color?'background:'+esc(x.color)+' no-repeat center;background-size:initial':'background:url('+esc(x.image)+') center/cover no-repeat';
   return '<div class="swatch-option color" title="'+esc(x.text||'')+'" style="'+bg+'"></div>';}).join('')+'</div></div>':'';
 }
 li.setAttribute('data-sx-skin','1');return true;
}
var queued=false;
function run(){queued=false;var l=document.querySelectorAll('li.semantix-product-card:not([data-sx-skin])');for(var i=0;i<l.length;i++)fill(l[i]);}
function schedule(){if(!queued){queued=true;requestAnimationFrame(run);}}
function start(){new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});schedule();}
if(document.documentElement)start();else document.addEventListener('DOMContentLoaded',start);
// A card whose product arrived late is filled when it does; give up quietly after a while.
var n=0,t=setInterval(function(){schedule();if(++n>600)clearInterval(t);},1000);
})();
