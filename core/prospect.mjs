import {load} from 'cheerio';
import {platformSignals,storeHome,productEvidence} from './onboard.mjs';
import {robotsRules,robotsAllows} from './site-crawler.mjs';
import {fetchOrigin,isChallenge} from './site-mirror.mjs';

// Prospecting: find Israeli stores, search their own site the way a shopper would, score the search and list what to fix.
// Stores whose search scores badly become leads with the business contact details they publish on their own site.
// Volume per store is human-scale (one home page, a catalog sample, ~20 searches spaced over half a minute).

// ---------- discovery (Common Crawl URL index) ----------
const PRODUCT_PATH=/\/(products|product|items|product-page)\/[^/?#]+/i;
const HINT={products:'shopify',product:'woocommerce',items:'konimbo','product-page':'wix'};
export const bareHost=h=>String(h).toLowerCase().replace(/^www\./,'');
// One CDX page (JSON lines of {url}) → per-host product URL counts and the platform its URL shape suggests.
export function storesFromIndex(text,into=new Map()){
 for(const line of String(text).split('\n')){
  let url;try{url=new URL(JSON.parse(line).url);}catch{continue;}
  const m=PRODUCT_PATH.exec(url.pathname);if(!m)continue;
  const host=bareHost(url.hostname),s=into.get(host)||{host,productUrls:0,hints:{}};
  s.productUrls++;const hint=HINT[m[1].toLowerCase()];s.hints[hint]=(s.hints[hint]||0)+1;into.set(host,s);
 }
 return into;
}
export const platformHint=s=>Object.entries(s.hints||{}).sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
export const indexPageUrl=(api,domain,page)=>`${api}?url=${encodeURIComponent(domain)}&matchType=domain&page=${page}&fl=url&output=json&filter=${encodeURIComponent('~url:.*/(products|product|items|product-page)/.*')}`;

// ---------- fetching ----------
// Browser-like GET that follows a few same-site redirects and reports where it landed.
export function pageFetcher(fetcher=fetchOrigin,{timeoutMs=25000}={}){
 return async function get(url,{json=false}={}){
  let current=url;
  for(let hop=0;hop<5;hop++){
   // The fetcher's timeout is for an idle socket; a site that trickles bytes needs a hard deadline too.
   let timer;const r=await Promise.race([fetcher(current,{accept:json?'application/json':'text/html,application/xhtml+xml,*/*;q=0.8',ajax:json}),new Promise((_,fail)=>{timer=setTimeout(()=>fail(Error('תם הזמן לטעינת הדף')),timeoutMs);})]).finally(()=>clearTimeout(timer));
   if(r.status>=300&&r.status<400&&r.headers.location){
    const next=new URL(r.headers.location,current);if(next.protocol==='http:')next.protocol='https:';
    if(bareHost(next.hostname)!==bareHost(new URL(url).hostname))return {status:r.status,url:next.href,text:'',offsite:true};
    current=next.href;continue;
   }
   return {status:r.status,url:current,text:r.body.toString('utf8'),blocked:isChallenge(r)};
  }
  throw Error('יותר מדי הפניות');
 };
}

// ---------- the store's search ----------
export const PROVIDERS={
 Algolia:/algolia(net)?\.(com|net)|instantsearch\.js|algoliasearch/i,Klevu:/klevu/i,Doofinder:/doofinder/i,Searchanise:/searchanise/i,
 'Boost Commerce':/boost-pfs|boostcommerce|bc-sf-filter/i,'Fast Simon':/fastsimon|instantsearchplus/i,FiboSearch:/dgwt-wcas/i,
 Searchspring:/searchspring/i,'Constructor.io':/cnstrc\.com/i,Bloomreach:/bloomreach|brsearch/i,Findify:/findify/i,Clerk:/clerk\.io/i,
 "Luigi's Box":/luigisbox/i,Nosto:/nosto/i,Semantix:/semantix/i,
};
export const searchProviders=html=>Object.entries(PROVIDERS).filter(([,re])=>re.test(html)).map(([name])=>name);
export function searchForm(html,origin){
 const $=load(html),form=$('form[role="search"],form[action*="search" i],form:has(input[type="search"])').first();
 const input=form.find('input[type="search"],input[name="q"],input[name="s"],input[name="query"],input[name="search"],input[name*="search" i]').first();
 if(!form.length||!input.attr('name'))return null;
 const hidden={};form.find('input[type="hidden"][name]').each((_,el)=>{hidden[$(el).attr('name')]=$(el).attr('value')||'';});
 let action;try{action=new URL(form.attr('action')||'/',origin);}catch{return null;}
 if(bareHost(action.hostname)!==bareHost(new URL(origin).hostname))return null;
 return {action:action.origin+action.pathname,param:input.attr('name'),hidden};
}
// Where a shopper's query goes: the platform's own search, else the site's search form, else common paths.
export function searchPlan(platform,form,origin,providers=[]){
 const o=origin.replace(/\/$/,''),q=encodeURIComponent,plans=[];
 if(platform==='shopify')plans.push({kind:'json',url:t=>`${o}/search/suggest.json?q=${q(t)}&resources[type]=product&resources[limit]=10`});
 if(form)plans.push({kind:'html',url:t=>{const u=new URL(form.action);for(const [k,v] of Object.entries(form.hidden))u.searchParams.set(k,v);u.searchParams.set(form.param,t);return u.href;}});
 if(platform==='shopify')plans.push({kind:'html',url:t=>`${o}/search?q=${q(t)}&type=product`});
 if(platform==='woocommerce')plans.push({kind:'html',url:t=>`${o}/?s=${q(t)}&post_type=product`});
 if(platform==='magento')plans.push({kind:'html',url:t=>`${o}/catalogsearch/result/?q=${q(t)}`});
 plans.push({kind:'html',url:t=>`${o}/search?q=${q(t)}`},{kind:'html',url:t=>`${o}/?s=${q(t)}`});
 // WooCommerce's Store API runs the same WordPress product search as the storefront, unless a search plugin replaced it.
 if(platform==='woocommerce'&&!providers.length)plans.push({kind:'wc',url:t=>`${o}/wp-json/wc/store/v1/products?per_page=10&search=${q(t)}`});
 const seen=new Set();return plans.filter(p=>{const k=p.url('x');if(seen.has(k))return false;seen.add(k);return true;});
}

const NO_RESULTS=/לא נמצאו|לא נמצא (מוצר|פריט)|אין תוצאות|לא מצאנו|\b0 תוצאות|תוצאות\s*:\s*0(?!\d)|נמצאו 0(?!\d)|results\s*:\s*0(?!\d)|אין מוצרים התואמים|no (products|results)( were)? found|did not match any|nothing (was )?found|0 results/i;
const CARD='li.product,.products .product,.product-item,.product-card,.productCard,.product-grid-item,.grid-product,.card-wrapper,[class*="product-card"],[class*="product-item"],[class*="ProductItem"],[class*="productItem"],[data-product-id]';
const OUTSIDE='header,nav,footer,aside,[class*="related"],[class*="recommend"],[class*="upsell"],[class*="cross-sell"],[class*="recently"],[class*="mini-cart"],[class*="minicart"]';
const TITLE='.woocommerce-loop-product__title,.product-item-link,.product-title,.product-name,.card__heading,[class*="title"],[class*="name"],h2,h3,h4';
const clean=s=>String(s||'').replace(/\s+/g,' ').trim().slice(0,140);
const echoes=(text,query)=>{const t=norm(text),q=norm(query);return !q||t.includes(q)||t.includes(norm(encodeURIComponent(query)));};
// Result count and titles on a search results page. `measurable:false` when the page is not a results page for this query
// (no echo of the query), which is what a client-rendered search or a missed endpoint looks like.
// Results are found by their product links (one card per distinct product URL); theme card classes are only a fallback.
export function parseResults(html,query,pageUrl){
 const $=load(html),page=new URL(pageUrl);
 if(PRODUCT_PATH.test(page.pathname)&&productEvidence(html))return {measurable:true,count:1,titles:[clean($('h1').first().text())],redirect:true};
 $(OUTSIDE+',script,style,noscript,template,svg').remove();
 if(!echoes($('title').text()+' '+$('input').map((_,e)=>$(e).attr('value')||'').get().join(' ')+' '+$('body').text(),query))return {measurable:false,count:0,titles:[]};
 const empty=NO_RESULTS.test($('body').text());
 const keyOf=a=>{let u;try{u=new URL(($(a).attr('href')||'').trim(),pageUrl);}catch{return null;}return PRODUCT_PATH.test(u.pathname)&&bareHost(u.hostname)===bareHost(page.hostname)?u.pathname.replace(/\/+$/,''):null;};
 const byKey=new Map();for(const a of $('a[href]').toArray()){const k=keyOf(a);if(k)(byKey.get(k)||byKey.set(k,[]).get(k)).push(a);}
 let titles=[...byKey].map(([key,links])=>{
  let card=$(links[0]);
  for(let p=card.parent();p.length&&!['body','html'].includes(p[0].name);p=p.parent()){if(new Set(p.find('a[href]').toArray().map(keyOf).filter(Boolean)).size>1)break;card=p;}
  const slug=()=>{try{return decodeURIComponent(key.split('/').pop()).replace(/^\d+-+/,'').replace(/[-_]+/g,' ');}catch{return '';}};
  return clean(card.find(TITLE).first().text()||links.map(a=>$(a).attr('title')||$(a).text()).find(t=>clean(t))||card.find('img[alt]').attr('alt')||slug())||'(ללא שם)';
 });
 if(!titles.length){
  let cards=$(CARD).toArray().filter(el=>$(el).find('a[href]').length);
  cards=cards.filter(el=>!cards.some(o=>o!==el&&$(o).find(el).length));
  titles=cards.map(el=>{const c=$(el);return clean(c.find(TITLE).first().text()||c.find('a[title]').attr('title')||c.find('img[alt]').attr('alt')||c.find('a').first().text());}).filter(Boolean);
 }
 // An empty page without a "no results" message is what client-rendered results look like: unknown, not zero.
 if(!titles.length&&!empty)return {measurable:false,count:0,titles:[],silent:true};
 return {measurable:true,count:empty?0:titles.length,titles:empty?[]:titles.slice(0,10),emptyMessage:empty};
}
export function parseStoreApi(text){
 const d=JSON.parse(text);if(!Array.isArray(d))throw Error('Store API בלי מוצרים');
 return {measurable:true,count:d.length,titles:d.map(p=>clean(load(p.name||'').text())).slice(0,10)};
}
export function parseSuggest(text){
 const d=JSON.parse(text),products=d?.resources?.results?.products;if(!Array.isArray(products))throw Error('suggest.json בלי מוצרים');
 return {measurable:true,count:products.length,titles:products.map(p=>clean(p.title)).slice(0,10)};
}

// ---------- test queries ----------
const FINALS={'ך':'כ','ם':'מ','ן':'נ','ף':'פ','ץ':'צ'};
export const norm=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[֑-ׇ̀-ͯ]/g,'').replace(/[ךםןףץ]/g,c=>FINALS[c]).replace(/["'׳״`]/g,'').replace(/[^\p{L}\p{N}%+]+/gu,' ').trim();
const HEB_KEYS={'ק':'e','ר':'r','א':'t','ט':'y','ו':'u','ן':'i','ם':'o','פ':'p','ש':'a','ד':'s','ג':'d','כ':'f','ע':'g','י':'h','ח':'j','ל':'k','ך':'l','ף':';','ז':'z','ס':'x','ב':'c','ה':'v','נ':'b','מ':'n','צ':'m','ת':',','ץ':'.'};
const hebrew=s=>/[א-ת]/.test(s);
// "שמלה" typed with the keyboard left on English → "ankv".
export const englishLayout=s=>[...s].map(c=>HEB_KEYS[c]??c).join('');
// Two adjacent letters swapped in the middle of the longest word — the most common real typo.
export function typo(s){
 const words=s.split(' '),i=words.reduce((b,w,k)=>w.length>words[b].length?k:b,0),w=words[i];if(w.length<4)return null;
 const m=Math.floor(w.length/2)-1;if(w[m]===w[m+1])return null;
 words[i]=w.slice(0,m)+w[m+1]+w[m]+w.slice(m+2);return words.join(' ');
}
export const prefixed=s=>hebrew(s)&&!/^[הוב]/.test(s)&&!s.includes(' ')?'ה'+s:null;

// Menu words are what the store itself calls its popular departments.
export function navTerms(html){
 const $=load(html),out=new Set();
 $('nav a,header a,[class*="menu"] a,[role="navigation"] a').each((_,a)=>{const t=clean($(a).text());if(t.length>=2&&t.length<=24&&t.split(' ').length<=3&&!/(צור קשר|אודות|בלוג|מבצע|תקנון|החשבון|התחבר|הרשמ|סל|עגלה|דף הבית|כל המוצרים|חדש|contact|about|blog|sale|login|account|cart|home|shop all|faq|שאלות|משלוח|החזר|מועדון|גיפט|gift card|כרטיס)/i.test(t))out.add(t);});
 return [...out].slice(0,40);
}
export async function catalogSample(origin,platform,get){
 const o=origin.replace(/\/$/,'');
 try{
  if(platform==='shopify'){const d=JSON.parse((await get(o+'/products.json?limit=250',{json:true})).text);return (d.products||[]).map(p=>({title:clean(p.title),type:p.product_type||'',brand:p.vendor||''}));}
  if(platform==='woocommerce'){const d=JSON.parse((await get(o+'/wp-json/wc/store/v1/products?per_page=100',{json:true})).text);return (Array.isArray(d)?d:[]).map(p=>({title:clean(load(p.name||'').text()),type:(p.categories||[]).map(c=>c.name).join(', '),brand:''}));}
 }catch{}
 return [];
}
const LLM_KINDS=['head','product','brand','translit','synonym','natural'];
export async function planQueries({title,nav,products},{ask,limit=14}={}){
 let base=[];
 if(ask){
  const prompt=`You write test searches for the on-site search of an Israeli online store, the way its real shoppers type them.
Store: ${title}
Menu: ${nav.join(' | ')}
Sample products (title · type · brand): ${products.slice(0,60).map(p=>[p.title,p.type,p.brand].filter(Boolean).join(' · ')).join('\n')}
Return JSON {"queries":[{"q":"...","kind":"head|product|brand|translit|synonym|natural","intent":"what a good result is, in Hebrew"}]} with ${limit} queries, mostly Hebrew, all answerable by products this store sells:
- head (4): the most popular product types / departments, 1-2 words as shoppers type them (not necessarily the menu wording)
- product (2): a specific product the store sells, by model or short name
- brand (2): brands the store carries
- translit (2): a brand or product word written in the other script (e.g. "נייקי" for Nike, "airpods" → "איירפודס")
- synonym (2): a word shoppers use that differs from the catalog's wording
Use only brands and product words that appear in the sample above; never the store's own name.
- natural (2): a short descriptive need ("מתנה לאבא", "נעלי ריצה לנשים עד 300")`;
  try{base=(await ask(prompt)).queries||[];}catch{base=[];}
  base=base.filter(x=>x&&typeof x.q==='string'&&LLM_KINDS.includes(x.kind)).map(x=>({q:clean(x.q).slice(0,60),kind:x.kind,intent:clean(x.intent)}));
 }
 if(!base.length){
  const brands=[...new Set(products.map(p=>p.brand).filter(Boolean))].slice(0,2),types=[...new Set(products.flatMap(p=>p.type.split(', ')).filter(Boolean))];
  base=[...[...new Set([...nav,...types])].slice(0,5).map(q=>({q,kind:'head'})),...products.slice(0,40).filter((_,i)=>i%13===0).slice(0,2).map(p=>({q:p.title.split(' ').slice(0,4).join(' '),kind:'product'})),...brands.map(q=>({q,kind:'brand'}))];
 }
 // Department, product and brand searches must name something the store shows; otherwise a zero says nothing about its search.
 const known=[...nav,...products.map(p=>[p.title,p.type,p.brand].join(' '))].join(' | ');
 if(products.length||nav.length)base=base.filter(x=>!['head','product','brand'].includes(x.kind)||titleMatches(x.q,known));
 const seen=new Set(),queries=base.filter(x=>x.q&&!seen.has(norm(x.q))&&seen.add(norm(x.q)));
 // Robustness variants of queries the store should answer: the shopper means the same thing, so results should overlap.
 const roots=queries.filter(x=>['head','product','brand'].includes(x.kind)),add=(q,kind,of)=>{if(q&&!seen.has(norm(q))){seen.add(norm(q));queries.push({q,kind,of:of.q});}};
 for(const r of roots.filter(r=>hebrew(r.q)).slice(0,3))add(typo(r.q),'typo',r);
 for(const r of roots.filter(r=>hebrew(r.q)).slice(0,2))add(englishLayout(r.q),'layout',r);
 for(const r of roots.filter(r=>prefixed(r.q)).slice(0,2))add(prefixed(r.q),'prefix',r);
 return queries;
}

// ---------- judging and scoring ----------
// Crude Hebrew matching on normalized text (final letters folded): a query word also counts without a ה/ו/ב/ל prefix
// or a plural ending (הפולדרים ~ פולדר). Titles are matched as they are.
const variants=w=>{const out=[w];let x=w;if(x.length>3&&/^[הובל]/.test(x))out.push(x=x.slice(1));if(x.length>4){const y=x.replace(/(ימ|ות|ה)$/,'');if(y!==x)out.push(y);}return out;};
export const titleMatches=(q,title)=>{const t=norm(title);return norm(q).split(' ').filter(w=>w.length>=2).some(w=>variants(w).some(v=>v.length>=2&&t.includes(v)));};
export const CHECKS={
 head:{weight:25,label:'חיפושי המחלקות הפופולריות',fix:'חיפוש של סוג מוצר או מחלקה לא מחזיר את המוצרים שלה. צריך לאנדקס קטגוריות, תגיות וסוג מוצר, לא רק את שם המוצר.'},
 product:{weight:10,label:'חיפוש מוצר ספציפי',fix:'חיפוש לפי שם או דגם לא מביא את המוצר. צריך לדרג התאמה מלאה של שם או דגם לפני התאמות חלקיות.'},
 brand:{weight:10,label:'חיפוש לפי מותג',fix:'חיפוש מותג לא מחזיר את מוצרי המותג. צריך לאנדקס את שדה המותג/היצרן.'},
 typo:{weight:15,label:'שגיאות הקלדה',fix:'אין סבילות לשגיאות כתיב. צריך התאמה עמומה (fuzzy) ותמיכה בכתיב מלא וחסר.'},
 layout:{weight:10,label:'מקלדת באנגלית',fix:'חיפוש שהוקלד כשהמקלדת על אנגלית (למשל ankv במקום שמלה) לא מזוהה. צריך המרה אוטומטית של פריסת המקלדת.'},
 prefix:{weight:5,label:'תחיליות בעברית',fix:'תחיליות (ה, ו, ב, ל) שוברות את החיפוש. צריך ניתוח מורפולוגי או הסרת תחיליות.'},
 translit:{weight:8,label:'תעתיק עברית/אנגלית',fix:'מותג שנכתב בעברית כשהוא באנגלית בקטלוג (או להפך) לא נמצא. צריך מילון תעתיק.'},
 synonym:{weight:9,label:'מילים נרדפות',fix:'לא מזהה את המילים שהלקוחות משתמשים בהן. צריך מילון נרדפות או חיפוש סמנטי.'},
 natural:{weight:8,label:'שפה חופשית',fix:'שאילתות תיאוריות (מתנה, תקציב, שימוש) לא מובנות. צריך חיפוש סמנטי.'},
};
export async function judge(results,{ask}={}){
 const byQ=new Map(results.map(r=>[r.q,r]));
 let verdicts=new Map();
 const shown=results.filter(r=>r.measurable&&r.count>0);
 if(ask&&shown.length){
  const prompt=`Judge an online store's search results. For each query, count how many of the listed top results (max 5) a shopper who typed it would consider relevant. Typos, wrong keyboard layout (Hebrew typed on an English layout) and Hebrew prefixes mean the shopper wants the same as the intended query.
${JSON.stringify(shown.map((r,i)=>({i,q:r.q,means:r.of||undefined,intent:r.intent||undefined,results:r.titles.slice(0,5)})))}
Return JSON {"verdicts":[{"i":0,"relevant":0-5,"note":"short Hebrew reason when few are relevant"}]}`;
  try{for(const v of (await ask(prompt)).verdicts||[]){const r=shown[v.i];if(r&&Number.isFinite(v.relevant))verdicts.set(r.q,{relevant:Math.max(0,Math.min(5,v.relevant)),note:clean(v.note)});}}catch{verdicts=new Map();}
 }
 return results.map(r=>{
  if(!r.measurable)return {...r,pass:null};
  if(!r.count)return {...r,pass:false,reason:'0 תוצאות'};
  const base=r.of&&byQ.get(r.of),overlap=base?.titles?.length?r.titles.some(t=>base.titles.slice(0,5).includes(t)):false;
  const v=verdicts.get(r.q),shownN=Math.min(5,r.titles.length);
  const relevant=v?v.relevant/shownN>=0.6:r.of?overlap||r.titles.some(t=>titleMatches(r.of,t)):r.titles.slice(0,5).some(t=>titleMatches(r.q,t));
  const pass=relevant||overlap;
  return {...r,pass,...(v&&{relevant:v.relevant}),reason:pass?null:v?.note||'התוצאות לא קשורות לחיפוש'};
 });
}
export function scoreSearch(judged){
 const byKind={};for(const r of judged)if(r.pass!==null&&CHECKS[r.kind])(byKind[r.kind]||=[]).push(r);
 const checks=Object.entries(byKind).map(([kind,rs])=>({kind,label:CHECKS[kind].label,weight:CHECKS[kind].weight,passed:rs.filter(r=>r.pass).length,total:rs.length,failed:rs.filter(r=>!r.pass).map(r=>({q:r.q,reason:r.reason,...(r.of&&{of:r.of})}))}));
 const weight=checks.reduce((s,c)=>s+c.weight,0);
 const score=weight?Math.round(checks.reduce((s,c)=>s+c.weight*c.passed/c.total,0)/weight*100):null;
 const zero=judged.filter(r=>r.pass!==null),zeroRate=zero.length?Math.round(zero.filter(r=>!r.count).length/zero.length*100):null;
 const fixes=checks.filter(c=>c.passed<c.total).sort((a,b)=>b.weight*(1-b.passed/b.total)-a.weight*(1-a.passed/a.total)).map(c=>({kind:c.kind,label:c.label,fix:CHECKS[c.kind].fix,examples:c.failed.slice(0,3).map(f=>f.q)}));
 return {score,grade:score===null?null:score>=80?'טוב':score>=60?'בינוני':'גרוע',zeroRate,checks,fixes};
}

// ---------- contacts (published by the business on its own site) ----------
const PHONE=/(?:\+972[-\s]?|\b0)(?:[23489]|5\d|7\d)[-\s]?\d{3}[-\s]?\d{4}\b|\*\d{4}\b/g;
const EMAIL=/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const JUNK_EMAIL=/\.(png|jpe?g|gif|webp|svg)$|sentry|wixpress|example\.|domain\.|@2x|yourmail|email@/i;
const phoneKey=p=>p.startsWith('*')?p:p.replace(/[^\d+]/g,'').replace(/^\+972/,'0');
export function extractContacts(html,into={emails:[],phones:[],whatsapp:[],social:{},companyId:null}){
 const $=load(html),text=$('body').text(),add=(list,v)=>{if(v&&!list.includes(v))list.push(v);};
 $('a[href^="mailto:"]').each((_,a)=>add(into.emails,decodeURIComponent($(a).attr('href').slice(7).split('?')[0]).trim().toLowerCase()));
 for(const m of text.match(EMAIL)||[])add(into.emails,m.toLowerCase());
 $('a[href^="tel:"]').each((_,a)=>add(into.phones,phoneKey($(a).attr('href').slice(4))));
 for(const m of text.match(PHONE)||[])add(into.phones,phoneKey(m));
 $('a[href*="wa.me/"],a[href*="whatsapp.com/send"]').each((_,a)=>{const h=$(a).attr('href'),n=/wa\.me\/(\+?\d+)/.exec(h)?.[1]||/phone=(\+?\d+)/.exec(h)?.[1];add(into.whatsapp,n);});
 $('a[href]').each((_,a)=>{const h=$(a).attr('href');for(const [k,re] of Object.entries({facebook:/facebook\.com\/(?!sharer)/i,instagram:/instagram\.com\//i,linkedin:/linkedin\.com\/(company|in)\//i,tiktok:/tiktok\.com\/@/i}))if(re.test(h)&&!into.social[k])into.social[k]=h;});
 into.companyId||=/(?:ח\.?\s?פ\.?|ע\.?\s?מ\.?|עוסק מורשה|מספר חברה)\s*[:\-]?\s*(\d{8,9})/.exec(text)?.[1]||null;
 into.emails=into.emails.filter(e=>!JUNK_EMAIL.test(e));into.phones=into.phones.filter(p=>p.startsWith('*')||p.length>=9);
 return into;
}
export function contactPages(html,origin){
 const $=load(html),out=[];
 $('a[href]').each((_,a)=>{const el=$(a),t=clean(el.text())+' '+el.attr('href');if(!/צור.?קשר|contact|אודות|about|תקנון|terms|policy|מדיניות/i.test(t))return;let u;try{u=new URL(el.attr('href'),origin);}catch{return;}if(bareHost(u.hostname)===bareHost(new URL(origin).hostname)&&!out.includes(u.href))out.push(u.href);});
 return out.sort((a,b)=>/contact|צור/i.test(b)-/contact|צור/i.test(a)).slice(0,3);
}

// ---------- one store ----------
const wait=ms=>new Promise(r=>setTimeout(r,ms));
export async function auditStore(input,options={}){
 const {get=pageFetcher(),ask=null,delayMs=1500,threshold=70,maxQueries=22,onEvent=()=>{},movedFrom=null}=options;
 const origin=storeHome(input),host=bareHost(new URL(origin).hostname),audit={host,origin,...(movedFrom&&{movedFrom}),auditedAt:new Date().toISOString()};
 const home=await get(origin).catch(e=>({error:e.message}));
 // A store that moved to a new domain is audited there.
 if(home.offsite&&!movedFrom)return auditStore(home.url,{...options,movedFrom:host});
 if(home.error||home.offsite||home.blocked||home.status!==200)return {...audit,status:'unreachable',note:home.error||(home.blocked?'הגנת בוטים':home.offsite?'מפנה לאתר אחר: '+home.url:'HTTP '+home.status)};
 const html=home.text,$=load(html),signals=platformSignals(html);
 audit.title=clean($('meta[property="og:site_name"]').attr('content')||$('title').first().text()||host);
 audit.platform=['shopify','woocommerce','magento','wix','bigcommerce','prestashop'].find(p=>signals.includes(p))||(/konimbo/i.test(html)?'konimbo':'custom');
 audit.providers=searchProviders(html);
 if(audit.providers.includes('Semantix'))return {...audit,status:'client',note:'כבר עובד עם Semantix'};
 const robots=robotsRules((await get(origin+'robots.txt').catch(()=>({text:''}))).text);
 const form=searchForm(html,origin),products=await catalogSample(origin,audit.platform,get),nav=navTerms(html);
 audit.catalogSample=products.length;
 const queries=(await planQueries({title:audit.title,nav,products},{ask})).slice(0,maxQueries);
 onEvent({type:'queries',host,count:queries.length});
 // A nonsense control query shows whether the page parser counts real results or page furniture.
 const run=async(plan,q)=>{const r=await get(plan.url(q),{json:plan.kind!=='html'});if(r.blocked)throw Object.assign(Error('הגנת בוטים'),{blocked:true});if(r.status!==200)throw Error('HTTP '+r.status);return {url:plan.url(q),...(plan.kind==='json'?parseSuggest(r.text):plan.kind==='wc'?parseStoreApi(r.text):parseResults(r.text,q,r.url))};};
 let plan=null,control=null;
 for(const p of searchPlan(audit.platform,form,origin,audit.providers)){
  try{const probe=await run(p,queries[0]?.q||'a');await wait(delayMs);const c=await run(p,'zqxjv');await wait(delayMs);if(probe.measurable&&c.measurable){plan=p;control=c;break;}}
  catch(e){if(e.blocked)return {...audit,status:'blocked',note:'הגנת בוטים בזמן חיפוש'};}
 }
 if(!plan)return {...audit,status:'unmeasurable',note:audit.providers.length?`החיפוש נטען בדפדפן (${audit.providers.join(', ')})`:'לא נמצא דף תוצאות שאפשר לקרוא בלי דפדפן'};
 audit.searchUrl=plan.url('{q}');audit.measuredVia=plan.kind==='html'?'results-page':'api';audit.shopperUrl=plan.kind==='html'?audit.searchUrl:origin+(audit.platform==='shopify'?'search?q={q}':'?s={q}&post_type=product');audit.robotsAllowsSearch=robotsAllows(robots,plan.url('x'));
 if(control.count>2)return {...audit,status:'unmeasurable',note:'דף התוצאות מציג מוצרים גם לחיפוש חסר משמעות — אי אפשר לספור תוצאות בצורה אמינה'};
 const results=[];
 for(const x of queries){
  try{results.push({...x,...await run(plan,x.q)});}catch(e){if(e.blocked)break;results.push({...x,measurable:false,count:0,titles:[],error:e.message});}
  onEvent({type:'search',host,q:x.q,count:results.at(-1).count});await wait(delayMs);
 }
 const measured=results.filter(r=>r.measurable).length;
 if(measured<Math.max(3,results.length*0.6))return {...audit,status:'unmeasurable',note:`רק ${measured} מתוך ${results.length} חיפושים נקראו (דף תוצאות ריק בלי הודעה — כנראה נטען בדפדפן)`,results};
 // A site that ignores the query shows the same list for every search: that is not a score, it is a page we cannot read.
 const lists=results.filter(r=>r.measurable&&r.count>0).map(r=>r.titles.slice(0,5).join('|')),top=Math.max(0,...Object.values(lists.reduce((m,k)=>(m[k]=(m[k]||0)+1,m),{})));
 if(lists.length>=4&&top/lists.length>0.5)return {...audit,status:'unmeasurable',note:'רוב החיפושים מחזירים אותה רשימת מוצרים — ייתכן שהאתר מתעלם מהחיפוש או שהדף לא נקרא נכון',results};
 const judged=await judge(results,{ask});
 Object.assign(audit,{status:'audited',results:judged,...scoreSearch(judged)});
 // Everything at zero usually means the page was read wrong, not that the search is that broken: flag it for a human look.
 if(judged.filter(r=>r.pass!==null).every(r=>!r.count))audit.confidence='low';
 if(audit.providers.length&&plan.kind==='json')audit.confidence='low'; // storefront uses a vendor; we measured the platform's engine
 audit.lead=audit.score!==null&&audit.score<threshold&&audit.confidence!=='low';
 if(audit.lead){
  const contacts=extractContacts(html);
  for(const url of contactPages(html,origin)){await wait(delayMs);try{const p=await get(url);if(p.status===200)extractContacts(p.text,contacts);}catch{}}
  audit.contacts=contacts;
 }
 return audit;
}
