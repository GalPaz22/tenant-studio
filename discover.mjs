import https from 'node:https';
import {lookup} from 'node:dns/promises';
export function publicAddress(address) {
 if(address.includes(':'))return false; // IPv4-only fetch boundary for this local release.
 const [a,b]=address.split('.').map(Number);
 return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19));
}
// HTML pages can be heavy (inline scripts/styles); JSON API pages keep the 3 MB default, which drives page-size fallback.
export const PAGE_BYTES=16*1024*1024;
export async function fetchPublic(input, redirects=0,options={}) {
 const maxBytes=options.maxBytes??3*1024*1024;if(!Number.isInteger(maxBytes)||maxBytes<1||maxBytes>256*1024*1024)throw Error('Invalid source size limit');
 const url=new URL(input);
 if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443')throw Error('נדרשת כתובת HTTPS ציבורית');
 const answers=await lookup(url.hostname,{all:true,family:4});
 if(!answers.length||answers.some(x=>!publicAddress(x.address)))throw Error('כתובת רשת פנימית אינה מותרת');
 const {status,headers,body}=await new Promise((resolve,reject)=>{
  const req=https.request(url,{method:options.method||'GET',headers:{'User-Agent':'Semantix-Tenant-Studio/1.0',...(options.headers||{})},lookup:(_h,options,cb)=>options.all?cb(null,[{address:answers[0].address,family:4}]):cb(null,answers[0].address,4)},res=>{
   let size=0;const chunks=[];
   res.on('data',c=>{size+=c.length;if(size>maxBytes)req.destroy(Error(maxBytes===3*1024*1024?'Source exceeds 3 MB':'Source exceeds configured feed limit'));else chunks.push(c)});
   res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString()}));res.on('error',reject);
  });req.setTimeout(15000,()=>req.destroy(Error('Source timeout')));req.on('error',reject);req.end(options.body);
 });
 if(status>=300&&status<400&&headers.location){if(redirects>=3)throw Error('Too many redirects');const next=new URL(headers.location,url);if(Object.keys(options.headers||{}).length&&next.origin!==url.origin)throw Error('Authorized source redirected outside its origin');if(options.method==='POST')throw Error('POST source redirect is not supported');return fetchPublic(next.href,redirects+1,options)}
 if(status!==200)throw Error('Source HTTP '+status);
 return body;
}
const text=s=>String(s??'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(_,code)=>{const n=code[0].toLowerCase()==='x'?parseInt(code.slice(1),16):Number(code);return n>0&&n<=0x10ffff?String.fromCodePoint(n):''}).trim();
function product(raw,platform,origin) {
 if(platform==='shopify')return {id:String(raw.id),name:raw.title,url:origin+'/products/'+raw.handle,image:raw.images?.[0]?.src,price:Number(raw.variants?.[0]?.price),regularPrice:Number(raw.variants?.[0]?.compare_at_price)||null,stockStatus:raw.variants?.some(v=>v.available)?'instock':'outofstock',status:'ACTIVE',categories:[raw.product_type].filter(Boolean),tags:typeof raw.tags==='string'?raw.tags.split(',').map(x=>x.trim()):raw.tags||[]};
 return {id:String(raw.id),name:text(raw.name),url:raw.permalink,image:raw.images?.[0]?.src,price:Number(raw.prices?.price)/10**(raw.prices?.currency_minor_unit??2),regularPrice:Number(raw.prices?.regular_price)/10**(raw.prices?.currency_minor_unit??2),currency:raw.prices?.currency_code,stockStatus:raw.is_in_stock?'instock':'outofstock',status:'ACTIVE',categories:raw.categories?.map(c=>text(c.name))||[],tags:raw.tags?.map(t=>text(t.name))||[]};
}
export async function discover(url,platform,report=()=>{},fetchSource=fetchPublic,{maxProducts=500}={}) {
 if(!Number.isInteger(maxProducts)||maxProducts<1||maxProducts>10000)throw Error('Invalid catalog limit');
 let complete=false;
 const origin=new URL(url).origin;report('קריאת האתר והקטלוג הציבורי');
 const html=await fetchSource(url);const title=text(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||new URL(url).hostname);
 let products=[],warnings=[];
 if(['woocommerce','shopify'].includes(platform)) {
  let pageSize=25,page=1;
  for(let attempt=0;attempt<maxProducts/5+5&&products.length<maxProducts;attempt++){
   try {
    const path=platform==='shopify'?`/products.json?limit=${pageSize}&page=${page}`:`/wp-json/wc/store/v1/products?per_page=${pageSize}&page=${page}&_fields=id,name,permalink,images,prices,is_in_stock,categories,tags`;
    const data=JSON.parse(await fetchSource(origin+path));const rows=platform==='shopify'?data.products:data;
    if(!Array.isArray(rows))throw Error('Feed shape not supported');
    products.push(...rows.map(r=>product(r,platform,origin)));report(`נקראו ${products.length} מוצרים`);
    if(rows.length<pageSize){complete=true;break;}
    page++;
   }catch(error){
    if(error.message==='Source exceeds 3 MB'&&pageSize>5){
     pageSize=pageSize===25?10:5;
     // Changing page size changes offsets. Restart to avoid silently skipping
     // products after a large page, keeping the same bounded sample size.
     products=[];page=1;report(`התגובה גדולה; עוברים למנות של ${pageSize} מוצרים`);continue;
    }
    warnings.push(`קריאת הקטלוג נעצרה: ${error.message}`);break;
   }
  }
  if(products.length>=maxProducts)warnings.push(`הייבוא הגיע למגבלת ${maxProducts} מוצרים; אין הבטחה לכיסוי מלא.`);
 }
 if(!products.length) {
  for(const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
   try {const data=JSON.parse(match[1]);const walk=node=>{if(!node||typeof node!=='object')return;
    if(node['@type']==='Product'&&node.name){const offer=Array.isArray(node.offers)?node.offers[0]:node.offers;products.push({id:String(node.sku||node['@id']||products.length),name:node.name,url:node.url||url,image:Array.isArray(node.image)?node.image[0]:node.image,price:Number(offer?.price)||null,status:'ACTIVE',stockStatus:String(offer?.availability).endsWith('/InStock')?'instock':'unknown',categories:node.category?[String(node.category)]:[],tags:[]})}
    for(const value of Object.values(node))if(value&&typeof value==='object'){if(Array.isArray(value))value.forEach(walk);else walk(value)}
   };walk(data)}catch{}
  }
  warnings.push('נאסף רק מידע מובנה מהעמוד. נדרש פיד או מחבר מורשה לסנכרון מלא.');
 }
 products=[...new Map(products.slice(0,maxProducts).map(p=>[p.id,p])).values()];
 return {title,products,warnings,sourceUrl:url,platform,capturedAt:new Date().toISOString(),sample:!complete,complete};
}
