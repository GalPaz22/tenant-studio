import {test} from 'node:test';import assert from 'node:assert/strict';
import {researchProcessing,trialPlan,runPlan} from './core/processing-lab.mjs';
import {buildBaseline,evaluateBaseline} from './core/baseline.mjs';import {existingProject} from './existing-client.mjs';import {hash} from './core/catalog.mjs';

const shop=()=>{const p=existingProject('shop',{dbName:'shop'},[
 {id:'s:1',name:'Harry Potter and the Stone',url:'https://s.co/1',stockStatus:'instock'},{id:'s:2',name:'הארי פוטר ואבן החכמים',url:'https://s.co/2',stockStatus:'instock'},
 {id:'s:3',name:'אבק כוכבים',author:'ניל גיימן',url:'https://s.co/3',stockStatus:'instock'},{id:'s:4',name:'אוקיינוס בקצה הדרך',author:'ניל גיימן',url:'https://s.co/4',stockStatus:'instock'}]);
 p.baseline=buildBaseline(p,{days:30,since:'x',queries:[{_id:'neil gaiman',searches:40,zero:30,form:'neil gaiman'},{_id:'הארי פוטר',searches:90,zero:0,form:'הארי פוטר'}],clicks:[{_id:{q:'neil gaiman',u:'https://s.co/3'},n:9},{_id:{q:'הארי פוטר',u:'https://s.co/2'},n:50}],carts:[]});
 p.baselineEval={...evaluateBaseline(p,p.revisions[0].profile),profileHash:hash(p.revisions[0].profile),indexVersion:p.searchIndex.version};return p;};
const planner=async prompt=>{assert.match(prompt,/neil gaiman/);return {summary:'שמות סופרים באנגלית לא נמצאים',plans:[
 {title:'תעתיק שם סופר לאנגלית',why:'חיפושים באנגלית לשמות סופרים',kind:'derive_field',source:'specifications.author',target:'author_en',instruction:'Transliterate to the English name',expectedQueries:['neil gaiman'],searches:40},
 {title:'כפול',kind:'derive_field',source:'specifications.author',target:'author',instruction:'x'},{title:'לא נתמך',kind:'run_code',source:'title',target:'x'}]};};
const worker=async prompt=>{const data=JSON.parse(prompt.slice(prompt.lastIndexOf('DATA ')+5));return {values:data.map(x=>({id:x.id,text:x.text==='ניל גיימן'?'Neil Gaiman':''}))};};

test('research keeps only supported, new plans with the queries they should fix',async()=>{
 const p=shop(),lab=await researchProcessing(p,{planner});
 assert.equal(lab.plans.length,1);assert.equal(lab.rejected,2);assert.deepEqual(lab.plans[0].expectedQueries,['neil gaiman']);assert.equal(lab.plans[0].status,'proposed');
});
test('a trial shows before/after on a sample and changes nothing; the run is measured against production',async()=>{
 const p=shop();await researchProcessing(p,{planner});const id=p.processingLab.plans[0].id,before=JSON.stringify(p.productCards);
 const tried=await trialPlan(p,id,{worker});assert.equal(tried.status,'tried');assert.ok(tried.trial.rows.some(r=>r.before==='ניל גיימן'&&r.after==='Neil Gaiman'));assert.equal(JSON.stringify(p.productCards),before);
 assert.equal(p.baselineEval.results.find(r=>r.query==='neil gaiman').status,'lost');
 const r=await runPlan(p,id,{worker});assert.equal(r.updated,2);assert.equal(r.plan.status,'done');assert.deepEqual(r.delta.newlyKept,['neil gaiman']);assert.ok(r.delta.keptAfter>r.delta.keptBefore);
 assert.equal(p.productCards.find(c=>c.id==='s:3').specifications.author_en,'Neil Gaiman');assert.equal(p.catalog.products.find(x=>x.id==='s:3').specifications.author_en,'Neil Gaiman');
 assert.equal(p.baselineEval.results.find(r=>r.query==='neil gaiman').status,'kept');assert.equal(p.processingHistory.at(-1).target,'author_en');
});
test('processing that loses a query that works in production is rolled back',async()=>{
 // "קוסמ" reaches the chosen book "קוסם" only through typo tolerance; a field that adds the exact word to other
 // products makes the search stop approximating, and the chosen book disappears.
 const p=existingProject('shop',{dbName:'shop'},[{id:'s:5',name:'קוסם',url:'https://s.co/5',stockStatus:'instock'},...Array.from({length:5},(_,i)=>({id:'n:'+i,name:'ספר '+i,url:'https://s.co/n'+i,stockStatus:'instock'}))]);
 p.baseline=buildBaseline(p,{days:30,since:'x',queries:[{_id:'קוסמ',searches:20,zero:0,form:'קוסמ'}],clicks:[{_id:{q:'קוסמ',u:'https://s.co/5'},n:9}],carts:[]});
 p.baselineEval={...evaluateBaseline(p,p.revisions[0].profile),profileHash:hash(p.revisions[0].profile),indexVersion:p.searchIndex.version};
 assert.equal(p.baselineEval.results[0].status,'kept');
 p.processingLab={plans:[{id:'x',title:'משבש',kind:'derive_field',source:'title',target:'noise',instruction:'x',scope:{titleContains:'ספר'},status:'tried'}]};
 const noisy=async prompt=>{const data=JSON.parse(prompt.slice(prompt.lastIndexOf('DATA ')+5));return {values:data.map(x=>({id:x.id,text:'קוסמ'}))};};
 const r=await runPlan(p,'x',{worker:noisy});
 assert.equal(r.reverted,true);assert.equal(r.plan.status,'reverted');assert.deepEqual(r.delta.lost,['קוסמ']);
 assert.ok(p.productCards.every(c=>!('noise' in c.specifications)),'cards restored');assert.ok(p.catalog.products.every(x=>!('noise' in (x.specifications||{}))));
 assert.equal(evaluateBaseline(p,p.revisions[0].profile).results[0].status,'kept','search works again');
});
import {undoPlan} from './core/processing-lab.mjs';
import {unpackVectors} from './core/embeddings.mjs';
const games=()=>{const p=existingProject('shop',{dbName:'shop'},[
 {id:'g:1',name:'קוד הצבע',description:'משחק קופסה משפחתי של רמזים ומילים',url:'https://s.co/g1',stockStatus:'instock'},{id:'g:2',name:'טאבו',description:'משחק מילים לקבוצות',url:'https://s.co/g2',stockStatus:'instock'},
 {id:'b:1',name:'שם הוורד',description:'רומן היסטורי',url:'https://s.co/b1',stockStatus:'instock'}]);
 p.baseline=buildBaseline(p,{days:30,since:'x',queries:[{_id:'משחק חברה',searches:30,zero:30,form:'משחק חברה'},{_id:'שם הוורד',searches:20,zero:0,form:'שם הוורד'}],clicks:[{_id:{q:'שם הוורד',u:'https://s.co/b1'},n:9},{_id:{q:'משחק חברה',u:'https://s.co/g1'},n:5}],carts:[]});
 p.baselineEval={...evaluateBaseline(p,p.revisions[0].profile),profileHash:hash(p.revisions[0].profile),indexVersion:p.searchIndex.version};return p;};

test('research knows the practice, can propose any kind including ideas, and still rejects what cannot run',async()=>{
 const p=games();let prompt='';
 const lab=await researchProcessing(p,{planner:async x=>{prompt=x;return {summary:'s',plans:[
  {title:'מילות קונים',kind:'enrich_products',target:'shopper_terms',instruction:'words shoppers use',expectedQueries:['משחק חברה']},
  {title:'משחקי חברה',kind:'classify_tag',tag:'משחק חברה',definition:'A board, card or party game played by several people'},
  {title:'וקטורים',kind:'embeddings',scope:{}},{title:'השלמת מלאי מהספק',kind:'idea',implementation:'Connect the supplier feed API'},
  {title:'רעיון ריק',kind:'idea'},{title:'תגית בלי הגדרה',kind:'classify_tag',tag:'x'}]};}});
 assert.match(prompt,/doc2query/);assert.match(prompt,/Dense embeddings/);
 assert.deepEqual(lab.plans.map(x=>[x.kind,x.status]),[['enrich_products','proposed'],['classify_tag','proposed'],['embeddings','proposed'],['idea','idea']]);assert.equal(lab.rejected,2);
});
test('enrichment and evidence-based tagging make failing descriptive queries findable, and undo removes them',async()=>{
 const p=games();p.processingLab={plans:[
  {id:'e',kind:'enrich_products',target:'shopper_terms',instruction:'x',scope:{},status:'tried',title:'e'},
  {id:'t',kind:'classify_tag',tag:'משחק חברה',definition:'board or party game',scope:{},status:'tried',title:'t'}]};
 const enrichWorker=async prompt=>{const d=JSON.parse(prompt.slice(prompt.lastIndexOf('DATA ')+5));return {values:d.map(x=>({id:x.id,text:x.id.startsWith('g')?'משחק חברה · משחק קופסה':''}))};};
 const r=await runPlan(p,'e',{worker:enrichWorker});assert.equal(r.updated,2);assert.deepEqual(r.delta.newlyKept,['משחק חברה']);
 // The tagger must quote the product; an unsupported "matched" becomes unknown.
 const tagWorker=async prompt=>{const d=JSON.parse(prompt.slice(prompt.indexOf('\nDATA ')+6,prompt.lastIndexOf('\nReturn JSON')));return {decisions:d.map(x=>x.id==='g:1'?{id:x.id,status:'matched',field:'description',quote:'משחק קופסה משפחתי'}:x.id==='g:2'?{id:x.id,status:'matched',field:'description',quote:'invented quote'}:{id:x.id,status:'not_matched',field:'description',quote:'רומן היסטורי'})};};
 const t=await runPlan(p,'t',{worker:tagWorker});assert.equal(t.updated,1);assert.deepEqual(p.productCards.find(c=>c.id==='g:1').tags.includes('משחק חברה'),true);assert.equal(p.productCards.find(c=>c.id==='g:2').tags.includes('משחק חברה'),false);
 undoPlan(p,'e');assert.ok(p.productCards.every(c=>!c.specifications.shopper_terms));assert.equal(p.processingLab.plans[0].status,'undone');
 undoPlan(p,'t');assert.ok(p.productCards.every(c=>!(c.tags||[]).includes('משחק חברה')));assert.equal(p.baselineEval.results.find(r=>r.query==='משחק חברה').status,'lost');
});
test('embeddings are stored compactly, used by the runtime, measured with the full search and removable',async()=>{
 const p=games();p.processingLab={plans:[{id:'v',kind:'embeddings',scope:{},status:'tried',title:'v',expectedQueries:['משחק חברה']}]};
 const embed=async(texts)=>texts.map(t=>/משחק/.test(t)?[1,0,...new Array(254).fill(0)]:[0,1,...new Array(254).fill(0)]);
 let searches=0;const search=q=>async()=>{searches++;return {matches:q.studioVectors?[{id:'g:1'}]:[]};};
 const r=await runPlan(p,'v',{embed,search});
 assert.equal(r.updated,3);assert.equal(p.studioVectors.dimensions,256);assert.equal(unpackVectors(p.studioVectors).get('g:1')[0],1);
 assert.deepEqual(r.fullSearch.before,{found:0,total:1});assert.deepEqual(r.fullSearch.after,{found:1,total:1});
 const again=await runPlan(p,'v',{embed,search});assert.equal(again.updated,0,'unchanged products are not embedded again');
 const {createDraftRuntime}=await import('./runtime.mjs');assert.ok(createDraftRuntime({...p,productCardsProfileHash:hash(p.revisions[0].profile)},p.revisions[0]).search);
 undoPlan(p,'v');assert.equal(p.studioVectors,undefined);
});
