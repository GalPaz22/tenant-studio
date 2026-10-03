// The store's own Shopify app (core/shopify-feed.mjs), once installed, is an authorized read connection too.
let shopifyInstall=()=>null;
export const useShopifyInstalls=lookup=>{shopifyInstall=lookup;};
export function connectorFor(project) {
  let configs;try{configs=JSON.parse(process.env.STUDIO_CONNECTORS||'{}')}catch{throw Error('STUDIO_CONNECTORS אינו JSON תקין');}
  const install=project.platform==='shopify'&&!configs[project.id]?shopifyInstall(project.id):null;
  const config=configs[project.id]||(install&&{host:new URL(project.url).hostname,shop:install.shop,token:install.token});if(!config)return null;
  const host=new URL(project.url).hostname;
  if(config.host!==host)throw Error('החיבור המורשה אינו תואם לדומיין החנות');
  if(project.platform==='woocommerce'&&config.key&&config.secret)return {kind:'woocommerce',headers:{Authorization:'Basic '+Buffer.from(config.key+':'+config.secret).toString('base64')}};
  if(project.platform==='shopify'&&config.token&&config.shop){const shop=new URL('https://'+config.shop);if(!shop.hostname.endsWith('.myshopify.com')||shop.pathname!=='/'||shop.port||shop.username)throw Error('נדרש דומיין myshopify.com לחיבור Shopify');return {kind:'shopify',origin:shop.origin,version:config.apiVersion||'2026-07',headers:{'X-Shopify-Access-Token':config.token,'Content-Type':'application/json'}};}
  if(project.platform==='magento'&&config.token){const stockId=config.stockId??1;if(!Number.isInteger(stockId)||stockId<1||config.storeCode&&!/^[a-zA-Z0-9_]+$/.test(config.storeCode))throw Error('הגדרת stockId/storeCode של Magento לא תקינה');return {kind:'magento',stockId,storeCode:config.storeCode||'default',urlSuffix:config.urlSuffix??'.html',mediaBaseUrl:config.mediaBaseUrl||new URL('/media/catalog/product/',project.url).href,headers:{Authorization:'Bearer '+config.token}};}
  return null;
}
const productFields=`id title descriptionHtml handle vendor productType tags status images(first:20){nodes{url}} variants(first:100){nodes{id title sku price compareAtPrice barcode inventoryQuantity inventoryPolicy inventoryItem{tracked} selectedOptions{name value}} pageInfo{hasNextPage endCursor}}`;
export async function authorizedPage(project,state,fetchSource) {
  const connector=connectorFor(project);if(!connector)throw Error('נדרש חיבור קריאה מורשה ב־STUDIO_CONNECTORS עבור החנות');
  const origin=new URL(project.url).origin;
  if(connector.kind==='woocommerce'){const url=origin+`/wp-json/wc/v3/products?status=publish&per_page=${state.pageSize}&page=${state.page}`;const rows=JSON.parse(await fetchSource(url,{headers:connector.headers}));if(!Array.isArray(rows))throw Error('WooCommerce API לא החזיר מערך מוצרים');return {rows,platform:'woocommerce',sourceUrl:url,complete:rows.length<state.pageSize};}
  if(connector.kind==='magento'){
    const base=origin+'/rest/'+connector.storeCode+'/V1/',read=async path=>JSON.parse(await fetchSource(base+path,{headers:connector.headers}));
    state.categories??=Object.create(null);if(!state.magentoMetaDone){const tree=await read('categories'),walk=n=>{if(n?.id!==undefined)state.categories[n.id]=n.name;for(const child of n?.children_data||[])walk(child)};walk(tree);const currency=await read('directory/currency');state.currency=currency.base_currency_code||null;state.magentoMetaDone=true;}
    const path=`products?searchCriteria[pageSize]=${state.pageSize}&searchCriteria[currentPage]=${state.page}`,url=base+path,data=await read(path);
    if(!Array.isArray(data.items)||!Number.isFinite(data.total_count))throw Error('Magento API לא החזיר קטלוג תקין');
    const available=async r=>{if(typeof r.extension_attributes?.stock_item?.is_in_stock==='boolean')return r.extension_attributes.stock_item.is_in_stock;const value=await read('inventory/is-product-salable/'+encodeURIComponent(r.sku)+'/'+connector.stockId);if(typeof value!=='boolean')throw Error('Magento inventory לא החזיר מצב מכירה תקין');return value;};
    const rows=[];for(const r of data.items){const attrs=Object.fromEntries((r.custom_attributes||[]).map(a=>[a.attribute_code,a.value])),variants=[];
      if(r.type_id==='configurable'){const children=await read('configurable-products/'+encodeURIComponent(r.sku)+'/children');if(!Array.isArray(children))throw Error('Magento configurable variants לא תקינים');for(const child of children)variants.push({id:String(child.id),sku:child.sku,price:child.price,stockStatus:await available(child)?'instock':'outofstock',attributes:child.custom_attributes||[]});}
      const file=attrs.image||(r.media_gallery_entries||[]).find(i=>!i.disabled)?.file;
      rows.push({id:r.id,sku:r.sku,name:r.name,url:origin+'/'+String(attrs.url_key||r.sku)+connector.urlSuffix,price:r.price,currency:state.currency,
        image:file?new URL(file.replace(/^\//,''),connector.mediaBaseUrl).href:null,status:r.status===1?'ACTIVE':'archived',hidden:r.status!==1||r.visibility===1,
        description:attrs.description||attrs.short_description||'',specifications:Object.fromEntries(Object.entries(attrs).filter(([k,v])=>typeof v==='string'&&!['description','short_description','url_key','image','small_image','thumbnail'].includes(k))),
        categories:(attrs.category_ids||[]).map(id=>state.categories[id]).filter(Boolean),tags:[],stockStatus:await available(r)?'instock':'outofstock',variants});
    }
    return {rows,platform:'custom',sourceUrl:url,complete:state.page*state.pageSize>=data.total_count,expected:data.total_count,stockScope:connector.stockId};
  }
  const url=connector.origin+'/admin/api/'+connector.version+'/graphql.json';
  const request=async(query,variables)=>{const data=JSON.parse(await fetchSource(url,{method:'POST',headers:connector.headers,body:JSON.stringify({query,variables})}));if(data.errors?.length)throw Error('Shopify API: '+data.errors.map(e=>e.message).join(' · '));return data.data;};
  const data=await request(`query($cursor:String,$limit:Int!){shop{currencyCode} products(first:$limit,after:$cursor,query:"status:active"){nodes{${productFields}} pageInfo{hasNextPage endCursor}}}`,{cursor:state.apiCursor||null,limit:state.pageSize});
  if(!data?.products?.nodes)throw Error('Shopify API לא החזיר קטלוג תקין');
  const rows=[];for(const p of data.products.nodes){const variants=[...p.variants.nodes];let page=p.variants.pageInfo;
    while(page.hasNextPage){const more=await request(`query($id:ID!,$cursor:String){product(id:$id){variants(first:100,after:$cursor){nodes{id title sku price compareAtPrice barcode inventoryQuantity inventoryPolicy inventoryItem{tracked} selectedOptions{name value}} pageInfo{hasNextPage endCursor}}}}`,{id:p.id,cursor:page.endCursor});const v=more?.product?.variants;if(!v)throw Error('לא הושלמו וריאציות Shopify');variants.push(...v.nodes);page=v.pageInfo;}
    rows.push({id:p.id,title:p.title,currency:data.shop?.currencyCode,body_html:p.descriptionHtml,handle:p.handle,vendor:p.vendor,product_type:p.productType,tags:p.tags,status:p.status,images:p.images.nodes.map(i=>({src:i.url})),variants:variants.map(v=>({id:v.id,title:v.title,sku:v.sku,price:v.price,compare_at_price:v.compareAtPrice,barcode:v.barcode,available:v.inventoryItem?.tracked===false||v.inventoryPolicy==='CONTINUE'||v.inventoryQuantity>0,option1:v.selectedOptions?.[0]?.value,option2:v.selectedOptions?.[1]?.value,option3:v.selectedOptions?.[2]?.value}))});}
  return {rows,platform:'shopify',sourceUrl:url,nextCursor:data.products.pageInfo.endCursor,complete:!data.products.pageInfo.hasNextPage};
}
