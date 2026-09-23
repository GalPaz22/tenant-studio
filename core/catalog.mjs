import {load} from 'cheerio';
import {createHash} from 'node:crypto';
import {fetchPublic} from '../discover.mjs';
import {authorizedPage} from './connectors.mjs';

export const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function clean(value) {
  const $=load(String(value??''));$('script,style,noscript').remove();
  return $.root().text().replace(/\s+/g,' ').trim();
}
const strings=v=>Array.isArray(v)?v.map(x=>clean(typeof x==='object'?x.name:x)).filter(Boolean):typeof v==='string'?v.split(',').map(x=>x.trim()).filter(Boolean):[];
const amount=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
export function normalizeRecord(raw,platform,origin,sourceUrl,at=new Date().toISOString()) {
  let p;
  if(platform==='woocommerce') {
    const unit=10**(raw.prices?.currency_minor_unit??2);
    p={id:String(raw.id??''),name:clean(raw.name),url:raw.permalink,sku:raw.sku||'',
      image:raw.images?.[0]?.src,images:(raw.images||[]).map(i=>i.src),
      price:raw.prices?(amount(raw.prices.price)===null?null:amount(raw.prices.price)/unit):amount(raw.price),
      regularPrice:raw.prices?(amount(raw.prices.regular_price)===null?null:amount(raw.prices.regular_price)/unit):amount(raw.regular_price),
      currency:raw.prices?.currency_code||raw.currency||null,stockStatus:typeof raw.is_in_stock==='boolean'?(raw.is_in_stock?'instock':'outofstock'):raw.stock_status||'unknown',
      categories:strings(raw.categories),tags:strings(raw.tags),description:clean(raw.description||raw.short_description),
      sourceAttributes:raw.attributes||[],variants:raw.variantDetails||(raw.variations||[]).map(v=>typeof v==='object'?{...v,detailStatus:'partial'}:{id:String(v),detailStatus:'not-provided'}),brand:strings(raw.brands)[0]||raw.brand||'',
      specifications:raw.specifications||{}};
  } else if(platform==='shopify') {
    const variants=(raw.variants||[]).map(v=>({id:String(v.id),sku:v.sku||'',title:v.title,price:amount(v.price),regularPrice:amount(v.compare_at_price),stockStatus:typeof v.available==='boolean'?(v.available?'instock':'outofstock'):'unknown',options:[v.option1,v.option2,v.option3].filter(Boolean),gtin:v.barcode||''}));
    const priced=variants.filter(v=>v.stockStatus==='instock'&&v.price!==null).sort((a,b)=>a.price-b.price),selected=priced[0]||variants[0];
    p={id:String(raw.id??''),name:clean(raw.title),url:origin+'/products/'+raw.handle,sku:raw.sku||'',image:raw.images?.[0]?.src,
      images:(raw.images||[]).map(i=>i.src),price:selected?.price??null,regularPrice:selected?.regularPrice??null,priceRange:priced.length?{min:priced[0].price,max:priced.at(-1).price}:null,currency:raw.currency||null,
      stockStatus:variants.some(v=>v.stockStatus==='instock')?'instock':variants.every(v=>v.stockStatus==='outofstock')&&variants.length?'outofstock':'unknown',
      categories:strings(raw.product_type),tags:strings(raw.tags),description:clean(raw.body_html),brand:raw.vendor||'',variants,specifications:{}};
  } else {
    const offer=Array.isArray(raw.offers)?raw.offers[0]:raw.offers;
    p={...raw,id:String(raw.id??raw.productID??raw.sku??raw['@id']??''),name:clean(raw.name||raw.title),
      url:raw.url||sourceUrl,sku:raw.sku||'',image:Array.isArray(raw.image)?raw.image[0]:raw.image,
      images:raw.images||[],price:amount(raw.price??offer?.price),regularPrice:amount(raw.regularPrice),currency:raw.currency||offer?.priceCurrency||null,
      stockStatus:raw.stockStatus||(/\/InStock$/.test(offer?.availability||'')?'instock':/\/OutOfStock$/.test(offer?.availability||'')?'outofstock':'unknown'),
      categories:strings(raw.categories||raw.category),tags:strings(raw.tags),description:clean(raw.description),
      brand:typeof raw.brand==='object'?raw.brand.name:raw.brand||'',variants:raw.variants||[],specifications:raw.specifications||{}};
  }
  if(!p.id.trim()||!p.name)throw Error('רשומת מוצר ללא מזהה יציב או שם');
  try {p.url=new URL(p.url,origin).href;if(!['https:','http:'].includes(new URL(p.url).protocol))throw Error();}catch{throw Error('כתובת מוצר לא תקינה: '+p.id)}
  if(typeof p.specifications==='string'){try{p.specifications=JSON.parse(p.specifications)}catch{throw Error('מפרטים לא תקינים: '+p.id)}}
  if(!p.specifications||typeof p.specifications!=='object'||Array.isArray(p.specifications))throw Error('מפרטים לא תקינים: '+p.id);
  const specs=Object.assign(Object.create(null),p.specifications),$=load(raw.description||raw.body_html||'');
  $('tr').each((_,tr)=>{const cells=$(tr).find('th,td').toArray().map(c=>clean($(c).html()));if(cells.length===2&&cells[0]&&cells[1])specs[cells[0]]=cells[1]});
  for(const a of raw.attributes||[]){if(a.name){const values=strings(a.terms||a.options||a.values||[a.value].filter(Boolean));if(values.length)specs[clean(a.name)]=values.join(' · ')}}
  for(const a of raw.additionalProperty||[])if(a.name&&a.value!==undefined)specs[clean(a.name)]=clean(a.value);
  for(const key of Object.keys(specs))if(['__proto__','constructor','prototype'].includes(key))delete specs[key];
  if(typeof p.variants==='string'){try{p.variants=JSON.parse(p.variants)}catch{throw Error('וריאציות לא תקינות: '+p.id)}}
  if(!Array.isArray(p.variants))throw Error('וריאציות לא תקינות: '+p.id);
  p.variants=p.variants.map(v=>{if(!v||typeof v!=='object'||v.id===undefined)throw Error('וריאציה ללא מזהה: '+p.id);return {...v,id:String(v.id)};});
  p.description=p.description.slice(0,18000);p.specifications=specs;p.model=String(raw.model||specs.Model||specs['דגם']||'');p.mpn=String(raw.mpn||'');p.gtin=String(raw.gtin||raw.gtin13||raw.gtin14||'');
  p.status=raw.status||'ACTIVE';p.fetchedAt=at;p.sourceUrl=sourceUrl;
  p.contentHash=hash({...p,fetchedAt:undefined,contentHash:undefined});
  p.evidence=[{id:hash([p.id,sourceUrl,p.contentHash]).slice(0,24),sourceUrl,kind:'merchant',observedAt:at,
    fields:['name','description','specifications','categories','tags','price','stockStatus'],quote:[p.name,p.description,...Object.entries(specs).map(([k,v])=>k+': '+v)].join('\n')}];
  return p;
}
export function jsonProducts(html) {
  const $=load(html),products=[];
  const walk=n=>{if(!n||typeof n!=='object')return;if(n['@type']==='Product'||Array.isArray(n['@type'])&&n['@type'].includes('Product'))products.push(n);for(const v of Object.values(n))if(v&&typeof v==='object'){if(Array.isArray(v))v.forEach(walk);else walk(v)}};
  $('script[type="application/ld+json"]').each((_,el)=>{try{walk(JSON.parse($(el).html()))}catch{}});return products;
}
export function parseCsv(text) {
  const rows=[];let row=[],cell='',quoted=false;
  const delimiter=text.split('\n')[0].includes('\t')?'\t':',';
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){row.push(cell);cell='';}else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=c;}
  if(quoted)throw Error('פיד CSV לא תקין');if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row)}
  const headers=rows.shift()?.map(h=>h.trim().replace(/^\uFEFF/,''))||[];
  return rows.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));
}

// Checkpoints contain only pointers; raw pages live in the run's durable assets.
export async function collectCatalog(project,options,state,{fetchSource=fetchPublic,asset,checkpoint,control,report}) {
  const origin=new URL(project.url).origin;
  state.page??=1;state.pageSize??=25;state.pages??=[];state.errors??=[];state.urls??=[];
  const mode=options.sourceType;
  if(mode==='authorized'){
    while(!state.complete){await control();const result=await authorizedPage(project,state,fetchSource);const pageHash=hash(result.rows.map(r=>r.id));if(result.rows.length&&state.lastPageHash===pageHash)throw Error('המחבר המורשה החזיר עמוד חוזר');
      const key='catalog-authorized-'+state.page;await asset(key,result);state.pages.push(key);state.count=(state.count||0)+result.rows.length;state.lastPageHash=pageHash;state.apiCursor=result.nextCursor;state.complete=result.complete;state.page++;await checkpoint();await report(`נקראו ${state.count} מוצרים מהמחבר המורשה`);}
    return {...state,scope:'authorized-'+project.platform+'-catalog',coverage:'authoritative'};
  }
  if(mode==='feed') {
    state.feedUrl??=options.feedUrl;state.seenFeedUrls??=[];
    while(!state.complete){await control();if(state.seenFeedUrls.includes(state.feedUrl))throw Error('פיד מחזיר קישור לעמוד חוזר');const text=await fetchSource(state.feedUrl,{maxBytes:64*1024*1024});let rows,next;
      try{const data=JSON.parse(text);rows=Array.isArray(data)?data:data.products;next=Array.isArray(data)?null:data.nextUrl;}catch{rows=parseCsv(text)}
      if(!Array.isArray(rows))throw Error('הפיד צריך להכיל מערך מוצרים או products');
      const key='catalog-feed-'+state.page;await asset(key,{rows,platform:'custom',sourceUrl:state.feedUrl});state.pages.push(key);state.seenFeedUrls.push(state.feedUrl);state.complete=!next;state.count=(state.count||0)+rows.length;state.page++;
      if(next)state.feedUrl=new URL(next,state.feedUrl).href;await checkpoint();await report(`נקראו ${state.count} מוצרים מהפיד`);}
    return {...state,scope:'provided-feed',coverage:options.authoritative?'authoritative':'source-only'};
  }
  if(mode==='sitemap') {
    state.sitemaps??=[options.sitemapUrl];state.seenSitemaps??=[];
    while(state.sitemaps.length){await control();const url=state.sitemaps[0];const xml=await fetchSource(url),$=load(xml,{xmlMode:true});
      const nested=$('sitemap > loc').toArray().map(n=>$(n).text().trim());
      const urls=$('url > loc').toArray().map(n=>$(n).text().trim()).filter(u=>{try{return new URL(u).origin===origin}catch{return false}});
      state.urls=[...new Set([...state.urls,...urls])];state.seenSitemaps.push(url);state.sitemaps.shift();
      for(const child of nested)if(new URL(child).origin===origin&&!state.seenSitemaps.includes(child)&&!state.sitemaps.includes(child))state.sitemaps.push(child);
      await checkpoint();await report(`התגלו ${state.urls.length} עמודים במפת האתר`);
    }
    state.urlCursor??=0;
    while(state.urlCursor<state.urls.length){await control();const url=state.urls[state.urlCursor];
      try{const html=await fetchSource(url);const rows=jsonProducts(html);if(rows.length){const key='catalog-url-'+state.urlCursor;await asset(key,{rows,platform:'custom',sourceUrl:url});state.pages.push(key);state.count=(state.count||0)+rows.length;}}
      catch(e){if(e.status)throw e;state.errors.push({url,error:e.message});}
      state.urlCursor++;await checkpoint();await report(`נקראו ${state.urlCursor} מתוך ${state.urls.length} עמודים`);
    }
    state.complete=state.errors.length===0;return {...state,scope:'sitemap-public-products',coverage:'source-only'};
  }
  if(!['woocommerce','shopify'].includes(project.platform))throw Error('לסריקה מלאה של חנות זו יש לחבר פיד או sitemap');
  while(!state.complete) {
    await control();
    const path=project.platform==='woocommerce'?`/wp-json/wc/store/v1/products?per_page=${state.pageSize}&page=${state.page}`:`/products.json?limit=${state.pageSize}&page=${state.page}`;
    const url=origin+path;let rows;
    try{const data=JSON.parse(await fetchSource(url));rows=project.platform==='shopify'?data.products:data;if(!Array.isArray(rows))throw Error('מבנה קטלוג לא נתמך');}
    catch(e){if(e.message==='Source exceeds 3 MB'&&state.pageSize>5){state.pageSize=state.pageSize===25?10:5;state.page=1;state.pages=[];state.count=0;await checkpoint();continue;}throw e;}
    const key='catalog-'+state.pageSize+'-'+state.page;
    // A repeated page signals a broken public endpoint, never successful exhaustion.
    const pageHash=hash(rows.map(r=>r.id));
    if(rows.length&&state.lastPageHash===pageHash)throw Error('המקור החזיר עמוד חוזר; לא ניתן להוכיח השלמת קטלוג');
    await asset(key,{rows,platform:project.platform,sourceUrl:url});state.pages.push(key);state.lastPageHash=pageHash;
    state.count=(state.count||0)+rows.length;state.page++;state.complete=rows.length<state.pageSize;
    await checkpoint();await report(`נקראו ${state.count} מוצרים מהמקור`);
  }
  return {...state,scope:'public-platform-endpoint',coverage:'source-only'};
}
