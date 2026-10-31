import {test} from 'node:test';import assert from 'node:assert/strict';
import {orderSeries,seriesOf} from './core/series.mjs';
import {retiredRows,feedCategories} from './core/core.mjs';
import {buildSearchIndex,createIndexRetriever} from './core/search-index.mjs';
const book=(id,title,extra={})=>({id,tenantId:'t',title,description:'',categories:[],tags:[],colors:[],finishes:[],stockStatus:'instock',hidden:false,price:80,specifications:{},...extra});
const titles=list=>list.map(p=>p.title);
test('a series comes back in volume order, the first marked, collector editions after',()=>{
 const by={specifications:{author:'קלואי וולש'}},list=[4,1,9,2].map(n=>book('v'+n,`הבחורים של טומן ${n} כותר`,by)).concat(book('c1','מהדורת אספנות הבחורים של טומן 1 כותר',by),book('x','להישאר איתו 4',by));
 const r=orderSeries(list,'הבחורים של טומן');
 assert.deepEqual(r.map(p=>p.id),['v1','v2','v4','v9','c1','x']);assert.equal(r[0].seriesFirst,true);assert.equal(r.filter(p=>p.seriesFirst).length,1);
});
test('a query that names a volume gets it first, also when other titles carry the number',()=>{
 const list=[4,6,5].map(n=>book('v'+n,`הבחורים של טומן ${n} ליפול עם 6`,{specifications:{author:'קלואי וולש'}}));
 assert.equal(orderSeries(list,'הבחורים של טומן 6')[0].id,'v6');
 assert.equal(orderSeries([book('a','רדופה חלק א'),book('b','רדופה חלק ב')],'רדופה חלק ב')[0].id,'b');
});
test('english series tags group by the series, other books do not move, unrelated numbers stay',()=>{
 const list=[book('3','COURT OF WINGS AND RUIN #3 (COURT OF THORNS AND ROSES)'),book('c','COURT (CRAVE #4)'),book('2','COURT OF MIST AND FURY #2 (COURT OF THORNS AND ROSES)'),book('n','בית המשפט')];
 assert.deepEqual(orderSeries(list,'a court').map(p=>p.id),['2','3','c','n']);
 const plain=[book('a','ספר 5 חדש'),book('b','ספר אחר')];assert.equal(orderSeries(plain,'שלום'),plain);
 const models=[book('7','כיסוי לקינדל מסך 7'),book('6','כיסוי לקינדל מסך 6')];assert.equal(orderSeries(models,'קינדל'),models,'a size is not a volume');
 assert.equal(seriesOf('1984'),null);assert.equal(seriesOf('חצר של 4 כפור').volume,4);
});
test('a linked term orders its series; a mixed list starts in the shopper\'s language',()=>{
 const list=[book('en2','COURT OF MIST #2 (COURT OF THORNS AND ROSES)'),book('he2','חצר של ערפל 2',{specifications:{author:'מאס'}}),book('he1','חצר של ורדים 1',{specifications:{author:'מאס'}})];
 const r=orderSeries(list,'acotar',{scoped:true});assert.equal(r[0].id,'he1');assert.equal(r[1].id,'en2');
});
const client={tenantId:'t',domain:'books',productTypes:{},colors:{},finishes:{},tagDefinitions:{},queryAliases:{},version:'1'};
test('the word that tells books apart decides: misspelled name + title word with a prefix',()=>{
 const products=[book('m','איילת מטיילת',{popularity:900}),book('b','אילת נוסעת באוטובוס'),book('blurb','טיול',{description:'אילת אוטובוס'}),book('o','אוטובוס ושמו עדן')];
 const r=createIndexRetriever(products,client,buildSearchIndex(products,'1'))('איילת אוטובוס');
 assert.deepEqual(r.matches.map(p=>p.id),['b']);assert.ok(!r.corrections.some(c=>c.relaxed),'trusted: the title carries both words');
});
test('a word with a prefix in a title is found and ranks above a blurb',()=>{
 const products=[book('blurb','רומן',{description:'זמין בקינדל ובקינדל. קינדל',popularity:900}),book('cover','כיסוי לקינדל'),book('device','קינדל 6')];
 const r=createIndexRetriever(products,client,buildSearchIndex(products,'1'))('קינדל');
 assert.deepEqual(r.matches.map(p=>p.id).sort(),['blurb','cover','device']);assert.equal(r.matches.at(-1).id,'blurb');
});
const row=(id,digital,extra={})=>({id:'online:iw:IL:'+id,price:80,stockStatus:'instock',specialLabel:digital?{digital:{sku:digital}}:undefined,...extra});
test('a linked digital row folds into its printed row; same name without a link stays',()=>{
 const printed=row('011',  '600'),digital=row('600','600'),other=row('012',null,{name:'אותו שם'}),same=row('013',null,{name:'אותו שם'});
 const gone=retiredRows([printed,digital,other,same]);assert.equal(gone(digital),true);assert.equal(gone(printed),false);assert.equal(gone(other),false);assert.equal(gone(same),false);
});
test('when only the digital edition can be bought it stays; a digital row with no printed row stays',()=>{
 const printed=row('011','600',{stockStatus:'outofstock'}),digital=row('600','600');let gone=retiredRows([printed,digital]);assert.equal(gone(digital),false);assert.equal(gone(printed),true);
 const alone=row('601','601');gone=retiredRows([alone]);assert.equal(gone(alone),false);
 const dead=row('014','602',{pageCheck:{status:404}}),left=row('602','602');gone=retiredRows([dead,left]);assert.equal(gone(left),false,'a dead printed row does not take its digital twin with it');
});
test('feed departments become categories',()=>{
 assert.deepEqual(feedCategories({productTypes:['בלשנות ושפות'],customAttributes:[{name:'category 1',value:1104},{name:'category 2',value:'Penguin Readers'}]}),['בלשנות ושפות','Penguin Readers']);
 assert.deepEqual(feedCategories({}),[]);
});
test('a spelling variant is trusted only by the book\'s own name, not its author after a slash, and no other edit is',()=>{
 const products=[book('a','אנשים כמונו / נעה ידלין'),book('b','הטעויות',{specifications:{author:'נועה ידלין'}})];
 const r=createIndexRetriever(products,client,buildSearchIndex(products,'1'))('נועה ידלין');
 assert.ok(!r.matches.some(p=>p.id==='a')||r.corrections?.some(c=>c.relaxed),'not answered as a fix from the author part of a title');
});
