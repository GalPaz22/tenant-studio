// Bundled inside an IIFE with a public, per-store config by storefront-plugin.mjs.
// Integrates with the store's own search form and product-grid markup.
function start(){
 if(window.__semantixStorefrontLoaded)return;window.__semantixStorefrontLoaded=true;
 const platform=config.platform||'custom';
 const SEARCH_INPUT='input[type="search"],input[name="s"],input[name="q"],input[name="query"],input[name="search"],input[name="keyword"],[role="search"] input[type="text"],form[action*="search" i] input[type="text"]';
 const GRID_SELECTORS={woocommerce:['ul.products','.products.columns','.products.grid'],shopify:['#product-grid','ul.product-grid','.product-grid'],magento:['.products-grid .product-items','.products.wrapper .product-items'],custom:['[data-product-grid]','.product-grid','ul.products','.products-grid']}[platform];
 const CARD_SELECTORS={woocommerce:['li.product','.product'],shopify:['.grid__item','.product-card-wrapper','.card-wrapper'],magento:['.product-item'],custom:['[data-product-card]','.product-card','li.product','.product-item']}[platform];
 const TITLE_SELECTORS=['.woocommerce-loop-product__title','.card__heading','.product-item-name','.product-title','[data-product-title]','h2','h3'];
 const IMAGE_SELECTORS=['img.wp-post-image','.card__media img','.product-image-photo','[data-product-image]','img'];
 const PRICE_SELECTORS=['.price','.price-box','.product-item-price','[data-product-price]'];
 const OLD_PRICE_SELECTORS=['del','.old-price','.price--compare','.compare-at-price'];
 const first=(root,list)=>list.map(s=>root.querySelector(s)).find(Boolean)||null;
 const all=(root,list)=>{for(const s of list){const found=[...root.querySelectorAll(s)];if(found.length)return found;}return [];};
 const safe=value=>{if(typeof value!=='string'||!value.trim())return null;try{const u=new URL(value,config.storeOrigin);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}};
 const money=(value,currency)=>{if(value==null||value===''||!Number.isFinite(Number(value)))return '';try{return new Intl.NumberFormat(document.documentElement.lang||undefined,{style:'currency',currency:currency||config.currency||'ILS',maximumFractionDigits:2}).format(Number(value));}catch{return String(value);}};
 const queryFromLocation=()=>{const p=new URLSearchParams(location.search);return p.get('s')||p.get('q')||p.get('query')||p.get('search')||p.get('keyword')||'';};
 const resultsUrl=query=>{const u=new URL(location.href),q=String(query||'').trim(),base=new URL(config.storeOrigin),root=base.pathname.replace(/\/$/,'');u.hash='';if(platform==='woocommerce'){u.pathname=root+'/';u.search='';u.searchParams.set('s',q);u.searchParams.set('post_type','product');}else if(platform==='shopify'){u.pathname=root+'/search';u.search='';u.searchParams.set('q',q);u.searchParams.set('type','product');}else if(platform==='magento'){u.pathname=root+'/catalogsearch/result/';u.search='';u.searchParams.set('q',q);}else{u.search='';u.searchParams.set('q',q);}return u.pathname+u.search;};
 let template=null,grid=null,status=null,more=null,cursor=null,controller=null,sequence=0;
 function rememberTemplate(){if(template)return template;const cards=all(document,CARD_SELECTORS);template=cards.find(c=>first(c,TITLE_SELECTORS)&&first(c,IMAGE_SELECTORS))?.cloneNode(true)||null;return template;}
 function findGrid(){return first(document,GRID_SELECTORS);}
 function ensureResults(){
  rememberTemplate();grid=findGrid();
  if(!grid){const main=document.querySelector('main,[role="main"],#main,.main-content')||document.body;grid=document.createElement(platform==='woocommerce'?'ul':'div');grid.className=platform==='woocommerce'?'products columns-4':'semantix-product-grid';grid.setAttribute('data-semantix-results','');main.append(grid);}
  if(!grid.hasAttribute('data-semantix-results'))grid.setAttribute('data-semantix-results','');
  status=document.querySelector('[data-semantix-status]');if(!status){status=document.createElement('div');status.setAttribute('data-semantix-status','');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.style.cssText='margin:1rem 0;font:inherit;color:inherit';grid.parentNode.insertBefore(status,grid);}
  more=document.querySelector('[data-semantix-more]');if(!more){more=document.createElement('button');more.type='button';more.textContent='תוצאות נוספות';more.setAttribute('data-semantix-more','');more.style.cssText='display:block;margin:24px auto;padding:10px 24px;font:inherit;cursor:pointer';grid.after(more);more.onclick=()=>run(queryFromLocation(),true);}
 }
 function fallbackCard(p){
  const wrap=document.createElement(platform==='woocommerce'?'li':'article');wrap.className=platform==='woocommerce'?'product type-product':'semantix-product-card';wrap.style.cssText='list-style:none;min-width:0';
  const a=document.createElement('a');a.style.cssText='color:inherit;text-decoration:none;display:block';wrap.append(a);
  if(p.image){const img=document.createElement('img');img.alt='';img.loading='lazy';img.src=p.image;img.style.cssText='width:100%;aspect-ratio:1;object-fit:contain';a.append(img);}
  const title=document.createElement('h2');title.textContent=p.title||p.name||'';title.className=platform==='woocommerce'?'woocommerce-loop-product__title':'product-title';a.append(title);
  const price=document.createElement('div');price.className='price';price.textContent=money(p.price,p.currency);a.append(price);return wrap;
 }
 function card(p){
  const url=safe(p.url||p.link),image=safe(p.image||p.imageUrl);if(!url)return null;
  const node=rememberTemplate()?.cloneNode(true)||fallbackCard({...p,image});node.removeAttribute('id');node.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
  const links=node.matches('a')?[node]:[...node.querySelectorAll('a')];links.forEach(a=>a.href=url);
  const img=first(node,IMAGE_SELECTORS);if(img){if(image){img.src=image;img.removeAttribute('srcset');img.removeAttribute('sizes');img.alt=p.title||p.name||'';}else img.remove();}
  const title=first(node,TITLE_SELECTORS);if(title)title.textContent=p.title||p.name||'';
  const price=first(node,PRICE_SELECTORS);if(price){price.textContent=money(p.price,p.currency);if(Number(p.regularPrice)>Number(p.price)){const old=document.createElement('del');old.textContent=money(p.regularPrice,p.currency);price.append(' ',old);}}
  else{const target=title?.parentNode||node;const value=document.createElement('div');value.className='price';value.textContent=money(p.price,p.currency);target.append(value);}
  const old=first(node,OLD_PRICE_SELECTORS);if(old&&!(Number(p.regularPrice)>Number(p.price)))old.remove();
  node.querySelectorAll('form,button,input,select,[data-product-id]').forEach(n=>n.remove());return node;
 }
 async function run(query,append=false){
  query=String(query||'').trim();if(!query)return;ensureResults();controller?.abort();controller=new AbortController();const mine=++sequence;
  if(!append){cursor=null;grid.replaceChildren();}more.hidden=true;status.textContent='מחפש…';
  try{
   const response=await fetch(config.endpoint,{method:'POST',credentials:'omit',signal:controller.signal,headers:{'Content-Type':'application/json',...(config.apiKey?{'X-API-Key':config.apiKey}:{})},body:JSON.stringify(append?{cursor,limit:24,modern:true}:{query,limit:24,modern:true})});
   if(!response.ok)throw Error('search');const data=await response.json();if(mine!==sequence)return;const products=data.products||data.matches;if(!Array.isArray(products))throw Error('format');
   const nodes=products.map(card).filter(Boolean);if(append)grid.append(...nodes);else grid.replaceChildren(...nodes);
   cursor=data.nextCursor||data.pagination?.nextCursor||null;more.hidden=!cursor;status.textContent=nodes.length||grid.childElementCount?`${data.total??grid.childElementCount} מוצרים`:'לא נמצאו מוצרים';
  }catch(e){if(e.name!=='AbortError'&&mine===sequence)status.textContent='החיפוש אינו זמין כרגע. נסו שוב.';}
 }
 function connect(){
  rememberTemplate();
  document.addEventListener('submit',event=>{const form=event.target;if(!(form instanceof HTMLFormElement))return;const input=form.querySelector(SEARCH_INPUT);if(!input)return;const query=input.value.trim();if(!query)return;event.preventDefault();event.stopImmediatePropagation();history.pushState({semantix:true},'',resultsUrl(query));run(query);},true);
  document.addEventListener('keydown',event=>{const input=event.target;if(event.key!=='Enter'||!(input instanceof HTMLInputElement)||!input.matches(SEARCH_INPUT)||input.form)return;const query=input.value.trim();if(!query)return;event.preventDefault();event.stopImmediatePropagation();history.pushState({semantix:true},'',resultsUrl(query));run(query);},true);
  addEventListener('popstate',()=>{const q=queryFromLocation();if(q)run(q);});
  const q=queryFromLocation();if(q&&(/search|catalogsearch/i.test(location.pathname)||new URLSearchParams(location.search).has('s')||new URLSearchParams(location.search).has('q')))run(q);
 }
 connect();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
