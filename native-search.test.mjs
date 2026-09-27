import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeSearch,catalogLookup,searchParam,replaceCounts,replaceEcho,productKeys} from './core/native-search.mjs';

const origin='https://www.shop.co.il';
const catalog=['a','b','c','d'].map((x,i)=>({id:'id-'+x,sku:'SKU'+x.toUpperCase(),title:'Book '+x,url:`${origin}/${x}0000`,image:`${origin}/img/${x}.jpg`,price:10+i}));
const lookup=catalogLookup(catalog,origin);
const card=(x,price)=>`<li class="product-item"><a href="${origin}/${x}0000"><img src="/cache/${x}.jpg" alt="Book ${x}"></a><a href="${origin}/${x}0000" class="name">Book ${x}</a><span class="author">Author ${x}</span><span class="price">${price} ₪</span></li>`;
const page=(q,xs,total=xs.length)=>`<html><head><title>נמצאו ${total} תוצאות עבור '${q}'</title></head><body><nav><a href="${origin}/d0000">Bestseller</a> 0 מוצרים בסל · 60 ספרים</nav><div class="count"><span>${total}</span> <span>פריטים</span></div><div>${total} מוצרים</div><ul class="products">${xs.map(x=>card(x,'9'+x.charCodeAt(0))).join('\n')}</ul><footer>q=${q}</footer></body></html>`;
// The site's own search: SKU queries return that product's native card; anything else returns the given list.
const site=(list)=>async href=>{const q=new URL(href).searchParams.get('q');const sku=catalog.find(p=>p.sku===q);return {type:'text/html',text:sku?page(q,[sku.url.slice(-5,-4)]):page(q,list(q))};};

test('search requests are recognised; assets and ordinary pages are not',()=>{
 assert.deepEqual(searchParam(origin+'/catalogsearch/result/?q=abc'),{name:'q',value:'abc'});
 assert.deepEqual(searchParam(origin+'/?s=abc&post_type=product'),{name:'s',value:'abc'});
 assert.equal(searchParam(origin+'/search/app.js?q=1'),null);
 assert.equal(searchParam(origin+'/category/?q=abc'),null);
 assert.deepEqual(productKeys({sku:'',id:'online:iw:IL:011374197',url:origin+'/011374197',title:'T'}),['011374197','T']);
});

test('results page: original cards are replaced by native cards of semantix results, in semantix order; the rest is untouched',async()=>{
 const native=createNativeSearch(),q='wizard';
 const text=page(q,['a','b'],2);
 const out=await native.render({project:{id:'p'},url:origin+'/catalogsearch/result/?q='+q,text,type:'text/html',lookup,fetchText:site(()=>['a','b']),search:async()=>({matches:[catalog[2],catalog[0],catalog[3]],total:3})});
 const names=[...out.matchAll(/class="name">([^<]+)/g)].map(m=>m[1]);
 assert.deepEqual(names,['Book c','Book a','Book d']);
 assert.match(out,/<span class="price">999 ₪<\/span>/,'harvested card keeps the site\'s own price for c');
 assert.match(out,/<span>3<\/span> <span>פריטים<\/span>/);assert.match(out,/>3 מוצרים/);
 assert.match(out,/0 מוצרים בסל · 60 ספרים/,'unrelated counts untouched');assert.match(out,/<title>נמצאו 3 תוצאות/);
 assert.ok(out.includes(text.slice(text.indexOf('</title>'),text.indexOf('<div class="count">'))),'bytes between the counts are unchanged');
 assert.ok(out.endsWith(text.slice(text.lastIndexOf('</li>')+5)),'bytes after the list are unchanged');
});

test('original has no results: structure comes from a harvested page, with the query echo restored',async()=>{
 const native=createNativeSearch(),q='magic school';
 const empty=`<html><head><title>Results for '${q}'</title></head><body><p>No results</p></body></html>`;
 const out=await native.render({project:{id:'p2'},url:origin+'/catalogsearch/result/?q='+encodeURIComponent(q),text:empty,type:'text/html',lookup,fetchText:site(()=>[]),search:async()=>({matches:[catalog[1],catalog[2]],total:2})});
 assert.deepEqual([...out.matchAll(/class="name">([^<]+)/g)].map(m=>m[1]),['Book b','Book c']);
 assert.equal(out.match(/<ul/g).length,1,'one list, cards not wrapped in their own <ul>');
 assert.match(out,/<title>נמצאו 2 תוצאות עבור 'magic school'<\/title>/);assert.ok(!out.includes('SKUB')||!/Results for 'SKUB'/.test(out));
});

test('autocomplete JSON: card map, order and size follow semantix; cards are the site\'s own',async()=>{
 const native=createNativeSearch();
 const json=xs=>JSON.stringify({success:true,data:[{code:'product',size:40,order:xs.map((_,i)=>100+i),data:Object.fromEntries(xs.map((x,i)=>[String(100+i),card(x,'5'+x.charCodeAt(0))]))},{code:'category',data:{}}]});
 const fetchText=async href=>{const q=new URL(href).searchParams.get('q');const p=catalog.find(p=>p.sku===q);return {type:'application/json',text:p?JSON.stringify({success:true,data:[{code:'product',size:1,order:[200+catalog.indexOf(p)],data:{[200+catalog.indexOf(p)]:card(p.url.slice(-5,-4),'7'+catalog.indexOf(p))}}]}):json([])};};
 const out=JSON.parse(await native.render({project:{id:'p3'},url:origin+'/search/ajax/autocomplete?q=x',text:json(['a','b','c']),type:'application/json',lookup,fetchText,search:async()=>({matches:[catalog[3],catalog[1]],total:9})}));
 const g=out.data[0];
 // b was already in the original answer (key 101): its card is reused rather than fetched again.
 assert.deepEqual(g.order,[203,101]);assert.equal(g.size,9);
 assert.deepEqual(Object.keys(g.data).sort(),['101','203']);assert.match(g.data[203],/Book d/);assert.match(g.data[203],/73 ₪/);
});

test('a product the site cannot find is transplanted into another card without its price',async()=>{
 const native=createNativeSearch(),stray={id:'id-z',sku:'',title:'Book z',url:origin+'/z0000',image:origin+'/img/z.jpg',price:null};
 const look=catalogLookup([...catalog,stray],origin);
 const out=await native.render({project:{id:'p4'},url:origin+'/search?q=w',text:page('w',['a','b']),type:'text/html',lookup:look,fetchText:site(()=>['a','b']),search:async()=>({matches:[catalog[0],stray],total:2})});
 assert.match(out,/href="https:\/\/www\.shop\.co\.il\/z0000"/);assert.match(out,/class="name">Book z</);
 assert.equal([...out.matchAll(/class="price">([^<]*)</g)].map(m=>m[1])[1],'');
});

test('counts and echo helpers',()=>{
 assert.deepEqual(replaceCounts(['<b>54</b> <i>פריטים</i> <span>20</span> פריטים נצפו <a>60 ספרים</a> <x>54 מוצרים</x>'],{total:13,shown:13,originalShown:20}),['<b>13</b> <i>פריטים</i> <span>13</span> פריטים נצפו <a>60 ספרים</a> <x>13 מוצרים</x>']);
 assert.equal(replaceEcho("t='011' u=?q=011",'011','הרי פוטר'),"t='הרי פוטר' u=?q=הרי פוטר");
});

test('harvesting is budgeted per minute and never repeats a card already seen',async()=>{
 let t=0,calls=0;const native=createNativeSearch({perMinute:2,now:()=>t});
 const fetchText=async href=>{calls++;return site(()=>['a'])(href);};
 const run=q=>native.render({project:{id:'p5'},url:origin+'/catalogsearch/result/?q='+q,text:page(q,['a','b']),type:'text/html',lookup,fetchText,search:async()=>({matches:[catalog[2],catalog[3],catalog[0]],total:3})});
 const first=await run('x');
 assert.equal(calls,2,'only two harvest requests allowed this minute');
 assert.deepEqual([...first.matchAll(/class="name">([^<]+)/g)].map(m=>m[1]),['Book c','Book d','Book a'],'over-budget product still shown (transplanted)');
 await run('y');assert.equal(calls,2,'budget spent: no more requests; c and d already seen');
 t+=61000;await run('z');assert.equal(calls,2,'nothing new to fetch');
});

test('responses without product cards (articles, suggestion-only sections) are left alone',async()=>{
 const native=createNativeSearch(),args={project:{id:'p6'},lookup,fetchText:async()=>{throw Error('should not fetch')},search:async()=>({matches:[catalog[0]],total:1})};
 assert.equal(await native.render({...args,url:origin+'/search?q=a&type=article',text:page('a',['a']),type:'text/html'}),null);
 assert.equal(await native.render({...args,url:origin+'/search/suggest?q=a&section_id=predictive',text:'<div><a href="/pages/about">About</a></div>',type:'text/html'}),null);
});
