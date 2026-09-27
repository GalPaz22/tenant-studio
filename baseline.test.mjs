import {test} from 'node:test';import assert from 'node:assert/strict';
import {buildBaseline,evaluateBaseline,baselineRegressions} from './core/baseline.mjs';
import {studioAgent} from './core/studio-agent.mjs';import {auditSearches} from './core/search-audit.mjs';
import {existingProject} from './existing-client.mjs';import {createIndexRetriever} from './core/search-index.mjs';import {hash} from './core/catalog.mjs';

const shop=()=>existingProject('shop',{dbName:'shop'},[
 {id:'s:101',name:'הארי פוטר ואבן החכמים',url:'https://s.co/101',stockStatus:'instock'},{id:'s:102',name:'הארי פוטר מארז',url:'https://s.co/102',stockStatus:'instock'},
 {id:'s:201',name:'קרבת דם',author:'הרלן קובן',url:'https://s.co/201',stockStatus:'instock'},{id:'s:301',name:'נעלם',url:'https://s.co/301',stockStatus:'outofstock'},
 {id:'s:401',name:'אליאס משחק קופסה',url:'https://s.co/401',stockStatus:'instock'}]);
const signals={days:30,since:'x',queries:[{_id:'הארי פוטר',searches:100,zero:0,form:'הארי פוטר',delivered:['הארי פוטר ואבן החכמים']},{_id:'harry potter',searches:2,zero:0},{_id:'הרלן קובן',searches:50,zero:10,form:'הרלן קובן'},{_id:'בלה בלה',searches:9,zero:9,form:'בלה בלה'},{_id:'alias',searches:20,zero:0,form:'alias'}],
 clicks:[{_id:{q:'הארי פוטר',u:'https://s.co/101'},n:70,title:'הארי פוטר ואבן החכמים'},{_id:{q:'הארי פוטר',u:'https://s.co/999'},n:1,title:'משהו'},{_id:{q:'הרלן קובן',u:'https://s.co/201'},n:12},{_id:{q:'הרלן קובן',u:'https://s.co/301'},n:30},{_id:{q:'alias',u:'https://s.co/401'},n:8}],
 carts:[{_id:{q:'הארי פוטר',u:'https://s.co/102'},n:3,title:'הארי פוטר מארז'}]};
const lexical=(p,profile)=>query=>{const r=createIndexRetriever(p.productCards,{...profile,tenantId:p.id},p.searchIndex)(query);return {...r,metadata:{phase:'lexical',llmUsed:false}};};
const withBaseline=()=>{const p=shop();p.baseline=buildBaseline(p,signals);const e=evaluateBaseline(p,p.revisions[0].profile);p.baselineEval={...e,profileHash:hash(p.revisions[0].profile),indexVersion:p.searchIndex.version};return p;};

test('production baseline: clicked or carted products are what must be kept; noise and unavailable products are separated',()=>{
 const b=buildBaseline(shop(),signals),q=Object.fromEntries(b.queries.map(x=>[x.query,x]));
 assert.equal(b.queries.some(x=>x.query==='harry potter'),false,'below the search threshold');
 assert.deepEqual(q['הארי פוטר'].targets.map(t=>t.id),['s:102','s:101'],'the cart counts, the single wandering click does not');
 assert.equal(q['הרלן קובן'].production,'works');assert.deepEqual(q['הרלן קובן'].targets.map(t=>t.id),['s:201']);assert.deepEqual(q['הרלן קובן'].unavailable.map(u=>u.title),['נעלם']);
 assert.equal(q['בלה בלה'].production,'fails');
});
test('evaluation: kept, lost (Latin query for a Hebrew title) and production failures; regressions are detected',()=>{
 const p=shop(),b=buildBaseline(p,signals),e=evaluateBaseline(p,p.revisions[0].profile,b),s=Object.fromEntries(e.results.map(r=>[r.query,r.status]));
 assert.deepEqual(s,{'הארי פוטר':'kept','הרלן קובן':'kept','alias':'lost','בלה בלה':'empty'});
 assert.equal(e.summary.keptShare,+(150/170).toFixed(3));
 const broken=structuredClone(p.revisions[0].profile);broken.scopedAliases=[{id:'x',term:'הארי פוטר',mode:'only',productIds:['s:102']}];
 const reg=baselineRegressions(e,evaluateBaseline(p,broken,b));assert.deepEqual(reg.map(r=>[r.query,r.was,r.now]),[['הארי פוטר','kept','partial']]);
});
test('the agent cannot save a change that loses what production shoppers choose',async()=>{
 const p=withBaseline();const prompts=[];
 const model=async prompt=>{prompts.push(prompt);return prompts.length===1?{tools:[{name:'link_term',term:'הארי פוטר',mode:'only',productIds:['s:102']}]}:{message:'צומצם'};};
 await assert.rejects(()=>studioAgent(p,'צמצם את הארי פוטר',{model,services:{createSearch:lexical}}),/פוגעים בחיפושים שעובדים היום: ״הארי פוטר״/);
 assert.match(prompts[2],/drops products that shoppers choose/,'the agent is told once and given a chance to fix it');assert.equal(p.revisions.length,1);
});
test('baseline-driven audit fixes a lost query only when the chosen products come back',async()=>{
 const p=withBaseline();
 const fixer=async prompt=>prompt.includes('TOOL RESULTS []')?{tools:[{name:'link_term',term:'alias',mode:'add',productIds:['s:401']}]}:{message:'קושר',verify:['alias']};
 const judge=async prompt=>{const d=JSON.parse(prompt.slice(prompt.lastIndexOf('DATA ')+5));return {queries:d.results.map(c=>({query:c.query,returned:c.returned.map(x=>({id:x.id,verdict:'wanted'})),missing:[],emptyAcceptable:true})),summary:'ok'};};
 const next=await auditSearches(p,{model:fixer,judge,fix:true,source:'baseline',services:{createSearch:lexical,database:{clicks:async()=>({clicks:0,products:[]})}}});
 const r=next.audit.results.find(r=>r.query==='alias');assert.equal(r.reasons[0],'lost');assert.equal(r.fix.status,'fixed');
 assert.equal(next.baselineEval.results.find(r=>r.query==='alias').status,'kept','the stored comparison is refreshed after fixes');
 // A "fix" the reviewer likes but that does not bring back the chosen products is discarded.
 const wrong=async prompt=>prompt.includes('TOOL RESULTS []')?{tools:[{name:'link_term',term:'alias',mode:'add',productIds:['s:201']}]}:{message:'קושר',verify:['alias']};
 const kept=await auditSearches(withBaseline(),{model:wrong,judge,fix:true,source:'baseline',services:{createSearch:lexical,database:{clicks:async()=>({clicks:0,products:[]})}}});
 assert.equal(kept.audit.results.find(r=>r.query==='alias').fix.status,'not-verified');assert.equal(kept.revisions.length,1);
});
test('a data change is measured, not blamed on the rules; a product that went out of stock is a gap, not a loss',async()=>{
 const p=withBaseline();
 // The crawl finds that the carted box set is out of stock and adds another Harry Potter title.
 const crawlStore={read:async()=>({products:{'102':{sku:'102',name:'הארי פוטר מארז',stockStatus:'outofstock',crawledAt:'t'},'103':{sku:'103',name:'הארי פוטר ספר חדש',url:'https://s.co/103',stockStatus:'instock',crawledAt:'t'}}}),meta:async()=>null};
 const prompts=[];const model=async prompt=>{prompts.push(prompt);return prompts.length===1?{tools:[{name:'merge_crawl'},{name:'add_spelling',from:'הרי פוטר',to:'הארי פוטר'}]}:{message:'מוזג ותוקן'};};
 const next=await studioAgent(p,'מזג ותקן',{model,services:{createSearch:lexical,crawls:crawlStore}});
 assert.equal(next.revisions.length,2,'the rule change is saved');assert.ok(!prompts.some(x=>/drops products/.test(x)));
 const e=evaluateBaseline(next,next.revisions.at(-1).profile);const hp=e.results.find(r=>r.query==='הארי פוטר');assert.equal(hp.status,'kept');assert.equal(hp.unavailableNow,1);
});
test('popularity from production puts what shoppers chose first among equal matches',async()=>{
 const {applyPopularity}=await import('./core/baseline.mjs');const p=shop();
 const r0=createIndexRetriever(p.productCards,{...p.revisions[0].profile,tenantId:p.id},p.searchIndex)('הארי פוטר').matches.map(m=>m.id);assert.deepEqual(r0,['s:101','s:102']);
 applyPopularity(p,{clicks:[{_id:{q:'x',u:'https://s.co/102'},n:5}],carts:[]});
 const r1=createIndexRetriever(p.productCards,{...p.revisions[0].profile,tenantId:p.id},p.searchIndex)('הארי פוטר').matches.map(m=>m.id);assert.deepEqual(r1,['s:102','s:101']);
 assert.equal(p.catalog.products.find(x=>x.id==='s:102').popularity,5,'kept on raw products so a rebuild does not lose it');
});
