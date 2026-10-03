import {load} from 'cheerio';
import {platformSignals} from './onboard.mjs';
import {catalogLookup} from './native-search.mjs';

// Full search takeover: everything the semantix-cdn engine needs to replace a store's own search results page
// (features.fullReplace), read from the live store's own pages. Three searches are fetched — one that cannot match,
// one that matches many catalog products, and its second page. The results grid is located from links to known catalog
// products (not theme guesses), and every selector is checked against the fetched pages before it is proposed.
// Nothing here writes to production; the result is a proposal the operator reviews and publishes explicitly.

export const ZERO_QUERY='xqzk91731semantix';
const QUERY_PARAMS=['q','s','query','search','term','keyword','search_query'];
const NO_RESULTS=/לא נמצאו|לא נמצא|אין תוצאות|אין מוצרים|לא הצלחנו למצוא|no (?:products|results)|nothing (?:was )?found|0 results|did not match|didn['’]t match/i;
// No \b: in JS it only sees ASCII word characters, so it never matches after a Hebrew word.
const COUNT=/\d[\d,]*\s*(?:פריטים|מוצרים|תוצאות|ספרים|items?|products?|results?)(?![\p{L}])|(?:פריטים|מוצרים|תוצאות)\s*\d/iu;
const SORT=/מיון|מיין לפי|סדר לפי|sort\s*by|order\s*by/i;
const PAGER=/טען עוד|הצג עוד|טעינת עוד|עוד תוצאות|העמוד הבא|load more|show more|next page/i;
const STOP_WORDS=new Set(['של','עם','את','על','לא','כל','גם','או','אם','זה','זו','בין','עד','the','and','for','with','set','new']);
const PLATFORM_SEARCH={
 magento:{path:'/catalogsearch/result/',param:'q'},
 woocommerce:{path:'/',param:'s',extra:{post_type:'product'}},
 shopify:{path:'/search',param:'q',extra:{type:'product'}},
};
// Engine cart interceptor patterns per platform, pinned so a misdetected platform cannot drop events. Checkout patterns
// are the order-placement requests (Magento REST payment-information, Woo wc-ajax=checkout / Store API checkout, Shopify
// checkout submit) — not every request under /checkout/, which in Magento includes mini-cart edits.
const CART={
 magento:{atcPatterns:['/checkout/cart/add'],checkoutPatterns:['/payment-information','/checkout/onepage/saveOrder'],productIdField:'product',quantityField:'qty'},
 woocommerce:{atcPatterns:['wc-ajax=add_to_cart','?add-to-cart=','/wc/store/v1/cart/add-item'],checkoutPatterns:['wc-ajax=checkout','/wc/store/v1/checkout'],productIdField:'product_id',quantityField:'quantity'},
 shopify:{atcPatterns:['/cart/add.js','/cart/add.json','/cart/add'],checkoutPatterns:['/checkout','/checkouts/'],productIdField:'id',quantityField:'quantity'},
};

// ---------- selectors ----------
const UNSTABLE=/\d{3,}|^(?:active|selected|current|open|hover|focus|loaded|lazy|is-|has-|js-|swiper-slide-)|^[a-z]+-[a-z0-9]*\d[a-z0-9]{4,}$|[A-Z]{2,}_/;
export const stableClasses=el=>String(el?.attribs?.class||'').split(/\s+/).filter(c=>c&&c.length<=40&&/^[a-zA-Z_-][\w-]*$/.test(c)&&!UNSTABLE.test(c));
const stableId=el=>{const id=el?.attribs?.id;return id&&/^[a-zA-Z][\w-]*$/.test(id)&&!/\d{2,}/.test(id)?id:null;};
const cssEsc=s=>s.replace(/([^\w-])/g,'\\$1');
function candidates(el){
 const tag=el.tagName,cls=stableClasses(el),out=[];
 const id=stableId(el);if(id)out.push('#'+cssEsc(id));
 for(const c of cls)out.push(tag+'.'+c);
 for(let i=0;i<cls.length;i++)for(let j=i+1;j<cls.length;j++)out.push(tag+'.'+cls[i]+'.'+cls[j]);
 if(cls.length>2)out.push(tag+'.'+cls.join('.'));
 return out;
}
const outsideChrome=($,el)=>!$(el).closest('header,footer,nav').length;
// Shortest selector that matches exactly this element on the page (header/footer copies ignored), qualified by a
// stable ancestor when the element alone is ambiguous.
// Selectors end up in CSS (the loader's pre-paint hide rule), so one that matches only this element in the whole
// document is preferred; one that is unique only outside header/footer/nav is the fallback. prefer(sel) picks among
// equally good ones (e.g. one that does not also match on another page).
export function uniqueSelector($,el,{chrome=false,prefer=null}={}){
 const all=sel=>{try{return $(sel).toArray();}catch{return [];}};
 const own=candidates(el),strict=[],loose=[];
 const take=sel=>{const h=all(sel),body=chrome?h:h.filter(x=>outsideChrome($,x));
  if(h.length===1&&h[0]===el){strict.push(sel);return !prefer||prefer(sel);}
  if(body.length===1&&body[0]===el)loose.push(sel);return false;};
 for(const sel of own)if(take(sel))return sel;
 for(let a=el.parent,depth=0;a&&a.type==='tag'&&depth<6;a=a.parent,depth++){
  for(const up of candidates(a))for(const sel of own)if(take(up+' '+sel))return up+' '+sel;
  if(strict.length&&!prefer)break;
 }
 return strict[0]||loose[0]||null;
}
// Card selector relative to the grid: classes every card shares, matching the cards and nothing else in the grid.
export function cardSelector($,grid,cards){
 const shared=stableClasses(cards[0]).filter(c=>cards.every(x=>stableClasses(x).includes(c))),tag=cards[0].tagName;
 const opts=[...shared.map(c=>tag+'.'+c),...shared.map(c=>'.'+c),...(cards.every(x=>x.tagName===tag)?[tag]:[])];
 for(const sel of opts){const found=$(grid).find(sel).toArray().filter(x=>!cards.some(c=>c!==x&&$(c).find(x).length));if(found.length===cards.length&&cards.every(c=>found.includes(c)))return sel;}
 return null;
}

// ---------- results grid from catalog links ----------
// The largest group of sibling elements that each link to exactly one catalog product.
export function findGrid($,lookup){
 const owners=new Map(),links=[];
 for(const a of $('a[href]').toArray()){
  if(!outsideChrome($,a))continue;const p=lookup($(a).attr('href'));if(!p)continue;links.push([a,p]);
  for(let n=a;n&&n.type==='tag';n=n.parent){let s=owners.get(n);if(!s)owners.set(n,s=new Set());s.add(p.id);}
 }
 const cards=new Map();
 for(const [a,p] of links){
  let card=a;
  for(let n=a.parent;n&&n.type==='tag'&&!['body','html','main','ul','ol','table','tbody'].includes(n.tagName);n=n.parent){if(owners.get(n).size>1)break;card=n;}
  if(!cards.has(card))cards.set(card,p);
 }
 const groups=new Map();
 for(const [el,p] of cards){const g=groups.get(el.parent)||[];g.push({el,product:p});groups.set(el.parent,g);}
 const best=[...groups].sort((a,b)=>b[1].length-a[1].length)[0];
 return best&&best[1].length>=2?{grid:best[0],cards:best[1]}:null;
}

// ---------- no-results message ----------
export function findNoResults($zero,$results){
 const main=$zero('main').first().length?$zero('main').first():$zero('body');
 const hits=main.find('*').toArray().filter(el=>!['script','style','noscript','template','option'].includes(el.tagName)&&outsideChrome($zero,el)&&NO_RESULTS.test($zero(el).text())&&$zero(el).text().trim().length<400);
 // Innermost message elements, then their closest selector-worthy container.
 const inner=hits.filter(el=>!hits.some(o=>o!==el&&$zero(el).find(o).length));
 const found=[];
 for(const el of inner)for(let n=el;n&&n.type==='tag'&&n.tagName!=='body';n=n.parent){
  const sel=uniqueSelector($zero,n,{prefer:$results?s=>{try{return $results(s).length===0;}catch{return false;}}:null});if(!sel)continue;
  found.push({selector:sel,text:$zero(n).text().replace(/\s+/g,' ').trim().slice(0,120),onResultsPage:$results?$results(sel).length>0:false});break;
 }
 // A message that also exists on a page with results is a hidden template; prefer one that is unique to the zero page.
 return found.sort((a,b)=>a.onResultsPage-b.onResultsPage)[0]||null;
}

// ---------- native elements that stop making sense after replacement ----------
// Text with a space between nodes: cheerio's text() glues <span>12 פריטים</span><label>מיון</label> into one word.
const spacedText=el=>{const out=[];const w=n=>{for(const c of n.children||[]){if(c.type==='text')out.push(c.data);else if(c.type==='tag'&&!['script','style','noscript','template'].includes(c.tagName))w(c);}};w(el);return out.join(' ').replace(/\s+/g,' ').trim();};
export function findHidden($,grid){
 const inGridBranch=el=>el===grid||$(el).find(grid).length>0||$(grid).find(el).length>0;
 let region=grid;for(let i=0;i<4&&region.parent&&region.parent.type==='tag'&&!['body','main'].includes(region.parent.tagName);i++)region=region.parent;
 const kinds=[];
 const classify=el=>{
  const t=spacedText(el),out=[];
  if(COUNT.test(t)&&t.length<300)out.push('count');
  if($(el).find('select').length||el.tagName==='select'||SORT.test(t))out.push('sort');
  if(PAGER.test(t)||$(el).find('a[href*="p=2"],a[href*="page=2"],a[href*="/page/2"],a[rel="next"]').length)out.push('pager');
  if($(el).find('input[type="checkbox"],[class*="filter"],[class*="facet"],[class*="layered"]').length||/filter|facet|layered/i.test(el.attribs?.class||''))out.push('filters');
  return out;
 };
 // Top-level blocks next to the grid's branch inside the results region.
 const blocks=[];const walk=n=>{for(const c of $(n).children().toArray()){if(['script','style','noscript','template','link','input'].includes(c.tagName))continue;if(inGridBranch(c)){if(c!==grid)walk(c);}else blocks.push(c);}};
 walk(region);
 for(const el of blocks){const k=classify(el);if(!k.length)continue;const sel=uniqueSelector($,el);if(sel)kinds.push({selector:sel,kinds:k,text:$(el).text().replace(/\s+/g,' ').trim().slice(0,120)});}
 return kinds;
}

// ---------- the whole results area (replace.scope "main") ----------
// The content element between the site header and footer that holds the grid: the page's own landmark when it has one,
// otherwise the highest ancestor of the grid with no footer and no search field inside it.
const LANDMARKS=['main','[role="main"]','#main','#MainContent','#maincontent','#content'];
export function findRoot($,grid){
 for(const sel of LANDMARKS){const m=$(grid).closest(sel)[0];if(m&&m!==grid)return m;}
 let root=null;
 for(let n=grid.parent;n&&n.type==='tag'&&!['body','html'].includes(n.tagName);n=n.parent){if($(n).find('footer,[role="contentinfo"],[role="banner"],input[type="search"]').length)break;root=n;}
 return root;
}
// The levels from below the root down to the grid, as the engine rebuilds them on a page with no native grid.
export const shellOf=(root,grid)=>{const out=[];for(let n=grid;n&&n!==root;n=n.parent)out.unshift({tag:n.tagName,cls:stableClasses(n)});return out;};

// ---------- the store's own search suggestions ----------
// Walking up from the search field, a sibling of the field's branch that is (or wraps) a suggestions element is the
// store's component. One that is itself the suggestions list is hidden and ours opens as a panel under the field; one
// that only wraps it (the body of a search drawer or modal) keeps its place — its content is hidden and ours mounts there.
const AC_MARK=/predictive|suggest|autocomplete|search[-_]{1,2}results|quick[-_]?search|live[-_]?search/i;
const acMark=el=>AC_MARK.test([el.tagName,el.attribs?.class||'',el.attribs?.id||'',Object.keys(el.attribs||{}).join(' ')].join(' '));
export function findAutocomplete($,input){
 const hide=[];let mount=null;
 for(let n=input,depth=0;n?.parent?.type==='tag'&&!['body','html'].includes(n.parent.tagName)&&depth<8;n=n.parent,depth++){
  for(const sib of $(n.parent).children().toArray()){
   if(sib===n||['script','style','template','svg','button','label','input','noscript'].includes(sib.tagName)||$(sib).find('input:not([type="hidden"])').length)continue;
   if(acMark(sib)){const sel=uniqueSelector($,sib,{chrome:true});if(sel)hide.push(sel);continue;}
   if(mount||!$(sib).find('*').toArray().some(acMark))continue;
   const sel=uniqueSelector($,sib,{chrome:true});if(!sel)continue;
   const inner=$(sib).children().toArray().filter(c=>!['script','style','template'].includes(c.tagName)).map(c=>uniqueSelector($,c,{chrome:true}));
   if(inner.length&&inner.every(Boolean)){mount=sel;hide.push(...inner);}
  }
  if(hide.length||['header','form'].includes(n.parent.tagName)&&depth>3)break;
 }
 return {hide:[...new Set(hide)],mount};
}

// ---------- card template ----------
const decode=s=>{try{return decodeURI(s);}catch{return s;}};
const sameUrl=(a,b,base)=>{try{const x=new URL(a,base),y=new URL(b,base);return x.hostname.replace(/^www\./,'')===y.hostname.replace(/^www\./,'')&&decode(x.pathname).replace(/\/+$/,'')===decode(y.pathname).replace(/\/+$/,'');}catch{return false;}};
const priceForms=n=>{if(!Number.isFinite(n))return [];const f=n.toFixed(2);return [...new Set([f,f.replace(/\.00$/,''),String(n),Number(n).toLocaleString('en-US',{minimumFractionDigits:2}),Number(n).toLocaleString('en-US')])].sort((a,b)=>b.length-a.length);};
// The card's own add-to-cart control is kept and handed to the engine (data-semantix-atc); other store actions go.
const ATC_BUTTON='button.tocart,.action.tocart,a.add_to_cart_button,button.add_to_cart_button,button[name="add"],button.single_add_to_cart_button,[data-role="tocart-form"] button[type="submit"],form[action*="cart/add"] button[type="submit"],form[action*="/cart"] button[type="submit"]';
const ATC_TEXT=/הוספה לסל|הוסף לסל|הוספה לעגלה|הוסף לעגלה|לסל הקניות|add to (?:cart|bag|basket)/i;
// Mirrors the engine's ATC_FORMS / ATC_OPTIONS so detection checks exactly what the engine will replay.
const ATC_FORMS={magento:"#product_addtocart_form, form[data-role='tocart-form'], form[action*='checkout/cart/add']",woocommerce:"form.cart, form[action*='add-to-cart']",custom:"form[action*='cart/add'], form[action*='add-to-cart'], form[action*='/cart']"};
const ATC_OPTIONS="select[name^='super_attribute'], [name^='options['][required], select[name^='attribute_'], .variations select, input[name^='super_attribute'][type='radio']";
// Merchandising labels ("New", "30% off", "Sold out") belong to the sample product even when every sampled card happens
// to carry the same one; the engine has no token for them, so they are dropped rather than shown on every result.
const LABELS='[class*="badge"],[class*="label-list"],[class*="product-label"],[class*="product-badge"],[class*="ribbon"],.label,.onsale,.sale-flash,[class*="sale-badge"],[class*="new-badge"]';
const REMOVE=['script','noscript','style','template','input[name="form_key"]','[data-role="tocart-form"] button','button[type="submit"]','.tocart','.action.tocart','.add_to_cart_button','[name="add"]','.towishlist','.tocompare','.mylist_action','.wishlist','.compare','.quickview','[class*="quick-view"]','[class*="quickview"]','.product-item-actions','.actions-secondary'];
const DROP_ATTRS=/^(srcset|data-srcset|sizes|data-sizes|data-mage-init|data-bind|onclick|onload|onerror|onmouseover|x-data|x-init|data-gtm.*|data-ga.*|data-track.*|data-unique-selector-key)$/i;

function textNodes(el,out=[]){for(const c of el.children||[]){if(c.type==='text'&&c.data.trim())out.push(c);else if(c.type==='tag')textNodes(c,out);}return out;}
const pathOf=(node,root)=>{const p=[];for(let n=node;n&&n!==root;n=n.parent){const sib=(n.parent?.children||[]).filter(c=>c.type===n.type&&(c.type!=='tag'||c.tagName===n.tagName));p.unshift((n.type==='tag'?n.tagName:'#t')+sib.indexOf(n));}return p.join('/');};
const tokens=v=>String(v||'').split(/\s+/).filter(Boolean);
const isOut=p=>/out|sold|unavailable/i.test(String(p?.stockStatus||''));
function nodeAt(root,path){
 let n=root;if(!path)return n;for(const step of path.split('/')){const [,kind,i]=/^(#t|[a-z0-9-]+?)(\d+)$/i.exec(step)||[];if(!kind)return null;const sib=(n.children||[]).filter(c=>kind==='#t'?c.type==='text':c.type==='tag'&&c.tagName===kind);n=sib[Number(i)];if(!n)return null;}
 return n;
}
const allTags=root=>{const out=[root];const w=n=>{for(const c of n.children||[])if(c.type==='tag'){out.push(c);w(c);}};w(root);return out;};

// One real card turned into an engine template: identity fields become tokens; per-product text and attributes the
// tokens cannot express (native ids, badges, author links, price attributes) are cleared by comparing the card with its
// siblings at the same position; actions that would post to the store (add to cart, wishlist) and hidden form inputs
// are removed until the addToCart mode exists.
export function buildCardTemplate($,cards,base){
 const ranked=[...cards].sort((a,b)=>(a.product.stockStatus==='instock'?0:1)-(b.product.stockStatus==='instock'?0:1)||(a.product.regularPrice>a.product.price?1:0)-(b.product.regularPrice>b.product.price?1:0));
 const pick=ranked[0],$c=load($.html(pick.el),null,false),root=$c.root().children().first()[0],p=pick.product;
 const otherCards=cards.filter(c=>c!==pick).slice(0,6),others=otherCards.map(c=>c.el);
 const cleared=[];
 // Variability is measured on the untouched clone, whose paths mirror the source card, before anything is removed.
 const variableText=new Set(),variableAttrs=new Map(),stockAttrs=new Map();
 for(const t of textNodes(root)){const path=pathOf(t,root),vals=others.map(o=>nodeAt(o,path)).filter(n=>n?.type==='text').map(n=>n.data.trim());if(vals.length&&vals.some(v=>v!==t.data.trim()))variableText.add(t);}
 for(const el of allTags(root)){const path=pathOf(el,root),twins=others.map(o=>nodeAt(o,path)).filter(n=>n?.type==='tag'&&n.tagName===el.tagName);if(!twins.length)continue;
  const vary=new Map();for(const [k,v] of Object.entries(el.attribs||{}))if(twins.some(t=>t.attribs?.[k]!==v))vary.set(k,twins.map(t=>t.attribs?.[k]));if(vary.size)variableAttrs.set(el,vary);
  // Stock state carried by a boolean attribute (product_outofstock="true"): by its name, or by how it follows stock.
  for(const [k,v] of Object.entries(el.attribs||{})){
   if(!/^(true|false)$/i.test(v))continue;
   const pairs=[[v,isOut(p)],...others.map((o,i)=>[nodeAt(o,path)?.attribs?.[k],isOut(otherCards[i].product)]).filter(([x])=>x!==undefined)];
   const byName=/out.?of.?stock|sold.?out|unavailable/i.test(k)?'{{outOfStock}}':/in.?stock|available/i.test(k)?'{{inStock}}':null;
   const outs=new Set(pairs.filter(x=>x[1]).map(x=>x[0].toLowerCase())),ins=new Set(pairs.filter(x=>!x[1]).map(x=>x[0].toLowerCase()));
   const byStock=outs.size===1&&ins.size===1&&[...outs][0]!==[...ins][0]?([...outs][0]==='true'?'{{outOfStock}}':'{{inStock}}'):null;
   if(byName||byStock)stockAttrs.set(el,{...(stockAttrs.get(el)||{}),[k]:byName||byStock});
  }
 }
 const atc=$c(ATC_BUTTON).first()[0]||$c('button,a').toArray().find(b=>ATC_TEXT.test($c(b).text())&&!$c(b).find('img').length)||null;
 if(atc)atc.attribs['data-semantix-atc']='1';
 for(const sel of [...REMOVE,'input[type="hidden"]'])$c(sel).each((_,el)=>{if(el!==atc&&!(atc&&$c(el).find(atc).length))$c(el).remove();});
 // Labels go unless they hold our fields (a price block styled as a label keeps its {{price}} later).
 $c(LABELS).each((_,el)=>{const t=$c(el).text().trim();if(el===atc||(atc&&$c(el).find(atc).length)||$c(el).find('a[href],img').length||/price/i.test(el.attribs?.class||''))return;if(t.length<=40){cleared.push('label:'+t.slice(0,20));$c(el).remove();}});
 if(atc){
  for(const k of Object.keys(atc.attribs))if(!['class','data-semantix-atc','title','aria-label','style'].includes(k))delete atc.attribs[k];
  if(atc.tagName==='button')atc.attribs.type='button';else atc.attribs.href='{{url}}';
  Object.assign(atc.attribs,{'data-semantix-atc-url':'{{url}}','data-semantix-atc-id':'{{id}}','data-semantix-atc-oos':'{{outOfStock}}'});
 }
 $c('form').each((_,f)=>{f.tagName='div';f.name='div';for(const k of ['action','method','data-role','product_id','data-product-sku','data-product-type','data-initial-id'])delete f.attribs[k];});
 for(const [el,attrs] of stockAttrs)for(const [k,token] of Object.entries(attrs))if(el.attribs&&k in el.attribs)el.attribs[k]=token;
 const title=String(p.title||'').trim(),price=priceForms(Number(p.price)),author=String(p.specifications?.author||'').trim();
 const all=[root,...$c(root).find('*').toArray()];
 for(const el of all){
  for(const [k,v] of Object.entries(el.attribs||{})){
   if(DROP_ATTRS.test(k)){delete el.attribs[k];continue;}
   if(k==='id'&&/\d/.test(v)){delete el.attribs[k];continue;}
   if(['href','data-href','data-url'].includes(k)&&sameUrl(v,p.url,base)){el.attribs[k]='{{url}}';continue;}
   if(title&&v.includes(title))el.attribs[k]=v.split(title).join('{{name}}');
  }
 }
 const imgs=$c('img').toArray(),main=imgs.find(i=>$c(i).closest('a[href="{{url}}"]').length)||imgs[0];
 if(main){main.attribs.src='{{image}}';main.attribs.alt='{{name}}';for(const k of ['data-src','data-original','data-lazy-src'])if(main.attribs[k])main.attribs[k]='{{image}}';}
 for(const img of imgs)if(img!==main&&img.attribs.alt==='{{name}}')img.attribs.src='{{image}}';
 let priced=false,named=false,decimals=null,regulared=false;
 const COMPARE=/compare|old|regular|was|original|strike/i;
 // The catalog price does not always match what the card shows (rounding, a sale computed by the theme). Without an
 // exact match, the first number inside a price element (a sale/current price first) is the price.
 const priceClass=n=>{for(let x=n.parent;x&&x!==root.parent;x=x.parent)if(/price/i.test(x.attribs?.class||''))return x.attribs.class;return null;};
 const nodes=textNodes(root),exact=nodes.some(t=>price.some(f=>new RegExp('(^|[^\\d.,])'+f.replace(/[.,]/g,'\\$&')+'($|[^\\d])').test(t.data.trim())));
 const fallback=exact?null:(()=>{const c=nodes.filter(t=>/\d/.test(t.data)&&priceClass(t));return c.find(t=>/highlight|sale|current|final|special/i.test(priceClass(t)))||c.find(t=>!/compare|old|regular|was|original/i.test(priceClass(t)))||c[0]||null;})();
 for(const t of nodes){
  if(t===fallback&&!priced){const m=/\d[\d,.]*/.exec(t.data);if(m){t.data=t.data.replace(m[0],'{{price}}');priced=true;decimals=/[.,]\d{2}$/.test(m[0])?2:0;continue;}}
  const s=t.data.trim(),path=pathOf(t,root);
  if(title&&s===title){t.data=t.data.replace(title,'{{name}}');named=true;continue;}
  if(author&&s===author){t.data=t.data.replace(author,'{{author}}');continue;}
  // The price before a discount: shown only for discounted products (data-semantix-if), so its element goes with it.
  if(!regulared&&/\d/.test(s)&&COMPARE.test(priceClass(t)||'')){
   const m=/\d[\d,.]*/.exec(t.data);t.data=t.data.replace(m[0],'{{regularPrice}}');regulared=true;
   for(let x=t.parent;x&&x!==root;x=x.parent)if(COMPARE.test(x.attribs?.class||'')){x.attribs['data-semantix-if']='onSale';break;}
   continue;
  }
  const pf=price.find(f=>new RegExp('(^|[^\\d.,])'+f.replace(/[.,]/g,'\\$&')+'($|[^\\d])').test(s));
  if(pf&&!priced){t.data=t.data.replace(pf,'{{price}}');priced=true;decimals=/[.,]\d{2}$/.test(pf)?2:0;continue;}
  if(variableText.has(t)){cleared.push(s.slice(0,60));t.data='';}
 }
 // Attributes that change from card to card and did not become a token belong to the sample product. Classes keep
 // the tokens every card shares; other attributes are dropped (a per-product link keeps its text but loses its target).
 // An element left empty whose per-product style went with them (a colour swatch) has nothing to show and goes too,
 // with the wrappers that held only it — even ones that carry a token in an attribute.
 const unstyled=[];
 for(const [el,vary] of variableAttrs)for(const [k,twins] of vary){
  const v=el.attribs?.[k];if(v===undefined||v.includes('{{'))continue;
  if(k==='class')el.attribs.class=tokens(v).filter(c=>twins.every(t=>tokens(t).includes(c))).join(' ');
  else{delete el.attribs[k];if(k!=='href')cleared.push('@'+k);
   if(k==='style'&&el!==root&&!['img','input','br','hr','source','video','iframe','picture','a','button'].includes(el.tagName))unstyled.push(el);}
 }
 // Empty wrappers left by removed badges are dropped so they do not keep their spacing.
 const prune=()=>{let changed=true;while(changed){changed=false;$c(root).find('span,div,p,em,strong,b,i,small').each((_,el)=>{if(!$c(el).children().length&&!$c(el).text().trim()&&!/\{\{/.test($c.html(el))){$c(el).remove();changed=true;}});}};
 const bare=el=>!$c(el).children().length&&!$c(el).text().trim();
 for(const el of unstyled){if(!bare(el))continue;let up=el.parent;$c(el).remove();while(up&&up!==root&&up.type==='tag'&&bare(up)){const next=up.parent;$c(up).remove();up=next;}}
 prune();
 const html=$c.html(root).replace(/\s{2,}/g,' ').trim();
 return {html,priceDecimals:decimals,stockTokens:[...stockAttrs.values()].flatMap(a=>Object.keys(a)),source:{productId:p.id,title,url:p.url},checks:{name:named,price:priced,image:!!main,url:html.includes('{{url}}')},addToCart:!!atc&&html.includes('data-semantix-atc'),cleared};
}

// Fills a template the way the engine does, for verification and preview.
export function fillTemplate(template,p){
 const out=isOut(p)?'true':'false';
 const vals={outOfStock:out,inStock:out==='true'?'false':'true',url:p.url||'',link:p.url||'',name:p.title||p.name||'',title:p.title||p.name||'',image:p.image||'',img:p.image||'',price:Number.isFinite(Number(p.price))?Number(p.price).toLocaleString('he-IL'):'',regularPrice:Number(p.regularPrice)>Number(p.price)?Number(p.regularPrice).toLocaleString('he-IL'):'',id:String(p.id??''),product_id:String(p.id??''),sku:p.sku||'',author:p.specifications?.author||''};
 return template.replace(/\{\{([A-Za-z_]+)\}\}/g,(m,k)=>k in vals?vals[k]:m);
}

// ---------- search page discovery ----------
export function searchForm($,base,platform){
 const form=$('form[role="search"],form[action*="search"],form:has(input[type="search"])').first(),input=form.find('input[type="search"],'+QUERY_PARAMS.map(q=>`input[name="${q}"]`).join(',')).first();
 if(form.length&&input.attr('name')){const action=new URL(form.attr('action')||'/',base);const extra={};form.find('input[type="hidden"][name]').each((_,h)=>{const n=$(h).attr('name');if(n!=='form_key')extra[n]=$(h).attr('value')||'';});return {path:action.pathname,param:input.attr('name'),extra,from:'form',inputSelector:uniqueSelector($,input[0],{chrome:true})};}
 const known=PLATFORM_SEARCH[platform];return known?{...known,extra:known.extra||{},from:'platform'}:null;
}
export function searchUrl(origin,search,query,page=1){
 const u=new URL(search.path,origin);for(const [k,v] of Object.entries(search.extra||{}))u.searchParams.set(k,v);u.searchParams.set(search.param,query);if(page>1)u.searchParams.set('p',String(page));return u.href;
}
// Queries likely to return a full native results page: the most frequent meaningful title words and pairs.
export function sampleQueries(products,n=6){
 const words=new Map(),pairs=new Map();
 for(const p of products.slice(0,20000)){
  const w=String(p.title||'').toLowerCase().split(/[^\p{L}\p{N}'"׳״-]+/u).filter(x=>x.length>=3&&!STOP_WORDS.has(x)&&!/^\d+$/.test(x));
  for(const x of new Set(w))words.set(x,(words.get(x)||0)+1);
  for(let i=0;i+1<w.length;i++){const k=w[i]+' '+w[i+1];pairs.set(k,(pairs.get(k)||0)+1);}
 }
 const top=m=>[...m].filter(([,c])=>c>=8&&c<=400).sort((a,b)=>b[1]-a[1]).map(([k])=>k);
 return [...new Set([...top(pairs).slice(0,3),...top(words).slice(0,n)])].slice(0,n);
}

// ---------- the whole detection ----------
// fetchPage(url) → {status,text}|null. products: catalog cards with url/title/price/image/stockStatus.
export async function detectTakeover({url,products,fetchPage,onEvent=async()=>{}}){
 const origin=new URL(url).origin,lookup=catalogLookup(products,origin),report={steps:[],warnings:[]};
 const step=async(name,ok,detail)=>{report.steps.push({name,ok,detail});await onEvent({type:'step',name,ok,detail});};
 const home=await fetchPage(origin+'/');if(!home?.text)throw Error('דף הבית של האתר לא נטען');
 const signals=platformSignals(home.text),platform=['shopify','magento','woocommerce'].find(s=>signals.includes(s))||'custom';
 await step('platform',true,platform);
 const $home=load(home.text),search=searchForm($home,origin,platform);
 if(!search)throw Error('לא נמצא טופס חיפוש באתר');
 await step('searchForm',true,`${search.path}?${search.param}=`);

 let results=null,query=null;
 for(const q of sampleQueries(products)){
  const r=await fetchPage(searchUrl(origin,search,q));if(!r?.text)continue;
  const $r=load(r.text),found=findGrid($r,lookup);
  await onEvent({type:'note',text:`חיפוש "${q}": ${found?found.cards.length+' כרטיסים מהקטלוג':'לא נמצא גריד'}`});
  if(found&&(!results||found.cards.length>results.found.cards.length)){results={$:$r,found,url:r.url||searchUrl(origin,search,q)};query=q;}
  if(found?.cards.length>=8)break;
 }
 if(!results)throw Error('לא נמצא דף תוצאות עם מוצרים מהקטלוג — ייתכן שהחיפוש נטען ב־JavaScript בלבד');
 const {$:$r,found}=results,gridSel=uniqueSelector($r,found.grid),cardSel=cardSelector($r,found.grid,found.cards.map(c=>c.el));
 await step('resultsGrid',!!gridSel,gridSel||'לא נמצא סלקטור יציב לגריד');
 await step('productCard',!!cardSel,cardSel||'לא נמצא סלקטור משותף לכרטיסים');
 if(!gridSel||!cardSel)throw Error('לא ניתן היה לבנות סלקטורים יציבים לגריד ולכרטיס');

 const zero=await fetchPage(searchUrl(origin,search,ZERO_QUERY));const $z=zero?.text?load(zero.text):null;
 const noResults=$z?findNoResults($z,$r):null;
 await step('noResults',!!noResults,noResults?`${noResults.selector} — "${noResults.text}"`:'לא נמצאה הודעת "אין תוצאות"');
 if($z&&$z(gridSel).find(cardSel).length)report.warnings.push('דף ללא תוצאות מציג כרטיסים בגריד — ייתכן שהאתר מציג המלצות במקום הודעה');

 const page2=await fetchPage(searchUrl(origin,search,query,2));
 if(page2?.text){const $2=load(page2.text),n=$2(gridSel).find(cardSel).length;await step('page2',n>0,`${n} כרטיסים בעמוד 2`);}

 const hidden=findHidden($r,found.grid);
 await step('hide',true,hidden.map(h=>`${h.selector} (${h.kinds.join('/')})`).join(', ')||'אין');
 if(hidden.some(h=>h.kinds.includes('filters')))report.warnings.push('מסננים מקוריים מוסתרים: הם מסננים את תוצאות האתר ולא את התוצאות שלנו');

 const card=buildCardTemplate($r,found.cards,origin);
 const tokensOk=card.checks.name&&card.checks.url&&card.checks.image;
 await step('cardTemplate',tokensOk,Object.entries(card.checks).map(([k,v])=>`${k}:${v?'✓':'✗'}`).join(' '));
 if(!card.checks.price)report.warnings.push('המחיר בכרטיס לא זוהה — הכרטיס יוצג בלי מחיר');
 // Verification: the template filled with other products must show their title and link, like their native cards.
 const verify=found.cards.filter(c=>c.product.id!==card.source.productId).slice(0,5).map(c=>{
  const filled=load(fillTemplate(card.html,c.product),null,false),text=filled.root().text().replace(/\s+/g,' ');
  return {id:c.product.id,title:c.product.title,name:text.includes(String(c.product.title).trim()),link:filled('a').toArray().some(a=>sameUrl(filled(a).attr('href'),c.product.url,origin))};
 });
 await step('cardFill',verify.every(v=>v.name&&v.link),`${verify.filter(v=>v.name&&v.link).length}/${verify.length} כרטיסים מולאו נכון`);

 // Add to cart: the card must offer it, and a real product page must carry a form the engine can replay (Shopify
 // adds through /cart/add.js with the variant from /products/<handle>.js, so only the card button matters there).
 let addToCart={mode:'off'};
 if(!card.addToCart)await step('addToCart',true,'אין כפתור הוספה לסל בכרטיסים המקוריים — הכרטיס יוצג בלי כפתור');
 else if(platform==='shopify'){
  const sections=[...new Set($home('[id^="shopify-section-"]').toArray().map(el=>el.attribs.id.slice('shopify-section-'.length)).filter(id=>/cart/i.test(id)))];
  addToCart={mode:'engine',sections};await step('addToCart',true,`cart/add.js · sections: ${sections.join(', ')||'—'}`);
 }else{
  const sample=found.cards.find(c=>!isOut(c.product))||found.cards[0],pageR=await fetchPage(sample.product.url),$p=pageR?.text?load(pageR.text):null;
  const form=$p?$p(ATC_FORMS[platform]||ATC_FORMS.custom).first():null;
  if(!form?.length){addToCart={mode:'link'};await step('addToCart',false,'לא נמצא טופס הוספה לסל בדף המוצר — הכפתור יפתח את דף המוצר');}
  else{
   const needsChoice=form.find(ATC_OPTIONS).toArray().some(el=>!$p(el).val());
   addToCart={mode:'engine'};
   await step('addToCart',true,`${uniqueSelector($p,form[0],{chrome:true})||form[0].tagName} · ${form.attr('action')?new URL(form.attr('action'),origin).pathname.replace(/\d+/g,'#'):'—'}${needsChoice?' · דורש בחירת אפשרויות (יפתח את דף המוצר)':''}${form.find('input[name="form_key"]').length?' · form_key':''}`);
  }
 }
 // Whole results area: the root must be the same element on a page with no results, where the grid is rebuilt in it.
 const rootEl=findRoot($r,found.grid),rootSel=rootEl?uniqueSelector($r,rootEl,{chrome:true}):null;
 const rootOk=!!rootSel&&(!$z||$z(rootSel).length===1);
 await step('root',rootOk,rootSel?rootSel+(rootOk?'':' — לא קיים בדף ללא תוצאות'):'לא נמצא אזור תוכן בין ההאדר לפוטר');
 const scope=rootOk?{scope:'main',root:rootSel,shell:shellOf(rootEl,found.grid),titleClass:stableClasses($r(rootEl).find('h1').first()[0]).join(' ')}:{scope:'grid'};
 // The store's own suggestions, from the page every visitor starts on.
 const inputEl=search.inputSelector?$home(search.inputSelector).first()[0]:null,ac=inputEl?findAutocomplete($home,inputEl):null;
 if(inputEl)await step('autocomplete',true,ac.hide.length?`להסיר: ${ac.hide.join(', ')}${ac.mount?' · להציג בתוך '+ac.mount:' · פאנל מתחת לשדה'}`:'לא נמצא רכיב הצעות מקורי — פאנל מתחת לשדה');
 else await step('autocomplete',false,'לא נמצא שדה חיפוש בדף הבית');
 const autocomplete=ac?{input:search.inputSelector,hide:ac.hide,mount:ac.mount}:null;
 const searchPath=search.path.replace(/\/+$/,'')||'/';
 // Cart events carry the platform's own product id; when the card shows one that is not the catalog id, attribution
 // must map it (by product URL/name, which the events also carry).
 const nativeId=Object.entries(found.cards[0].el.attribs||{}).find(([k,v])=>/^(data-)?(product[-_]?id|data-id|productid)$/i.test(k)&&/^\d+$/.test(v))?.[1];
 const catalogTail=String(found.cards[0].product.id).split(':').pop();
 if(nativeId&&nativeId!==catalogTail)report.warnings.push(`אירועי עגלה יגיעו עם מזהה ${platform} פנימי (${nativeId}) ולא עם מזהה הקטלוג (${catalogTail}); השיוך בשרת צריך להתבסס על כתובת/שם המוצר שנשלחים באירוע`);
 const siteConfig={
  platform,
  queryParams:[search.param],
  selectors:{resultsGrid:[gridSel],productCard:[cardSel],noResults:noResults?[noResults.selector]:undefined,searchInput:search.inputSelector||undefined},
  nativeCard:{cardTemplate:card.html,useCustomTemplate:true,...(card.priceDecimals!=null&&{priceDecimals:card.priceDecimals})},
  features:{fullReplace:true,zeroReplace:true,autocomplete:!!autocomplete},
  replace:{searchPath:searchPath==='/'?null:'^'+searchPath.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),hide:hidden.map(h=>h.selector),...scope},
  ...(autocomplete&&{autocomplete}),
  cartInterceptor:CART[platform]?{enabled:true,...CART[platform]}:{enabled:true},
  // Product clicks: any link inside a product card, on search and category pages alike.
  clickTracking:{enabled:true,universalMode:true,universalLinkSelector:`${cardSel} a[href]`},
  addToCart,
 };
 return {platform,signals,search,query,resultsUrl:results.url,siteConfig,hidden,noResults,card:{...card,verify},autocomplete,report,detectedAt:new Date().toISOString()};
}

// Existing siteConfig keys the takeover never touches (consent, branding, A/B tests, domains…) are kept; the takeover
// keys are replaced as a unit so a stale selector from an earlier config cannot linger.
export function mergeSiteConfig(current,proposal){
 const cur=current&&typeof current==='object'?current:{};
 const out={...cur,platform:proposal.platform,queryParams:proposal.queryParams,clickTracking:{...(cur.clickTracking||{}),...proposal.clickTracking},selectors:{...(cur.selectors||{}),...Object.fromEntries(Object.entries(proposal.selectors).filter(([,v])=>v!==undefined))},
  nativeCard:{...(cur.nativeCard||{}),...proposal.nativeCard},features:{...(cur.features||{}),...proposal.features},replace:proposal.replace,
  cartInterceptor:{...(cur.cartInterceptor||{}),...proposal.cartInterceptor},addToCart:{...(cur.addToCart||{}),...(proposal.addToCart||{})},
  ...(proposal.autocomplete&&{autocomplete:proposal.autocomplete})};
 return out;
}

// ---------- operator settings over detection ----------
// Detection produces a base config (t.detectedConfig); everything the operator changes in the studio lives in
// t.settings and is re-applied on top of every new detection, so re-detecting never erases a manual fix.
const LOADERS=['bar','skeleton','none'],ATC=['engine','link','off'];
const text=(v,max=80)=>typeof v==='string'?v.replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,max):undefined;
export function validSelector(sel){
 if(typeof sel!=='string'||!sel.trim()||sel.length>300||/[<{}]/.test(sel))return false;
 try{load('<p></p>')(sel);return true;}catch{return false;}
}
export function cleanTemplate(html){
 if(typeof html!=='string'||html.length>30000)throw Error('תבנית הכרטיס ארוכה מדי');
 const out=html.replace(/<script[\s\S]*?<\/script\s*>/gi,'').replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,'').replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi,'$1=$2#$2').trim();
 if(!out.includes('{{url}}')||!out.includes('{{name}}'))throw Error('תבנית הכרטיס חייבת לכלול {{url}} ו־{{name}}');
 if(!/^<[a-z]/i.test(out))throw Error('תבנית הכרטיס צריכה להתחיל באלמנט HTML');
 return out;
}
export function applySettings(t,patch={}){
 if(!t.detectedConfig)t.detectedConfig=structuredClone(t.siteConfig);
 const prev=t.settings||{},next={...prev};
 if(Array.isArray(patch.hide))next.hide=patch.hide.filter(s=>typeof s==='string');
 if(ATC.includes(patch.addToCart))next.addToCart=patch.addToCart;
 if(['grid','main'].includes(patch.scope))next.scope=patch.scope;
 if(typeof patch.autocomplete==='boolean')next.autocomplete=patch.autocomplete;
 if(patch.loader&&typeof patch.loader==='object'){
  const l={...(prev.loader||{})};
  if(LOADERS.includes(patch.loader.type))l.type=patch.loader.type;
  if(patch.loader.text!==undefined)l.text=text(patch.loader.text,60);
  if(patch.loader.color!==undefined){if(!/^#[0-9a-f]{6}$/i.test(patch.loader.color))throw Error('צבע לא תקין');l.color=patch.loader.color;}
  next.loader=l;
 }
 if(patch.atcText&&typeof patch.atcText==='object'){
  const a={...(prev.atcText||{})};
  for(const k of ['addingText','addedText','toastText','cartText'])if(patch.atcText[k]!==undefined)a[k]=text(patch.atcText[k],60);
  if(typeof patch.atcText.toast==='boolean')a.toast=patch.atcText.toast;
  next.atcText=a;
 }
 if(patch.reset===true)delete next.overrides;
 if(patch.overrides&&typeof patch.overrides==='object'){
  const o={...(prev.overrides||{})};
  for(const k of ['resultsGrid','productCard','noResults']){
   if(!(k in patch.overrides))continue;const v=patch.overrides[k];
   if(v===null||v==='')delete o[k];else if(validSelector(v))o[k]=v.trim();else throw Error(`סלקטור לא תקין: ${String(v).slice(0,60)}`);
  }
  if('cardTemplate' in patch.overrides){const v=patch.overrides.cardTemplate;if(v===null||v==='')delete o.cardTemplate;else o.cardTemplate=cleanTemplate(v);}
  next.overrides=o;
 }
 t.settings=next;
 // Rebuild the demo config from the detection base + settings.
 const cfg=structuredClone(t.detectedConfig),hide=new Set(next.hide||t.hidden.map(h=>h.selector));
 cfg.replace={...cfg.replace,hide:t.hidden.map(h=>h.selector).filter(s=>hide.has(s))};
 if(next.loader)cfg.replace.loader={...next.loader};
 // The whole-area takeover and our suggestions can be switched off, never on without what detection found for them.
 if(next.scope==='grid')cfg.replace.scope='grid';
 if(next.autocomplete===false&&cfg.features)cfg.features.autocomplete=false;
 if(cfg.addToCart){
  if(next.addToCart&&(next.addToCart==='off'||t.card?.addToCart))cfg.addToCart.mode=next.addToCart;
  if(next.atcText)cfg.addToCart={...cfg.addToCart,...next.atcText};
 }
 const o=next.overrides||{};
 cfg.selectors={...cfg.selectors,...(o.resultsGrid&&{resultsGrid:[o.resultsGrid]}),...(o.productCard&&{productCard:[o.productCard]}),...(o.noResults&&{noResults:[o.noResults]})};
 if(o.productCard)cfg.clickTracking={...cfg.clickTracking,universalLinkSelector:`${o.productCard} a[href]`};
 if(o.cardTemplate)cfg.nativeCard={...cfg.nativeCard,cardTemplate:o.cardTemplate};
 t.siteConfig=cfg;
 return t;
}
