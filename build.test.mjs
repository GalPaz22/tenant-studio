import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {newBuild,executeBuild,validateBuildOptions} from './core/build.mjs';
import {createRunStore} from './core/run-store.mjs';
import {collectCatalog,normalizeRecord,hash} from './core/catalog.mjs';
import {createDraftRuntime} from './runtime.mjs';
import {classifyEvidence} from './core/evidence-tagging.mjs';
import {enrichFromSources} from './core/research.mjs';
const profile={name:'Test watches',domain:'watches',productTypes:{watch:{categories:['שעונים'],queryAliases:['שעון']}},colors:{},finishes:{},queryAliases:{},semanticAliases:{},tagDefinitions:{'מסך מרובע':{definition:'Explicit square screen in product specifications.',queryAliases:['שעונים מרובעים']}},badgeCandidates:{categories:[],tags:[]},badgeRules:[],pipeline:{maxCandidates:20,lightweightRouter:false}};
const project=()=>({id:randomUUID(),url:'https://example.com/',platform:'woocommerce',revisions:[],messages:[],events:[]});
const rows=Array.from({length:37},(_,i)=>({id:i+1,name:'Watch '+(i+1),permalink:'https://example.com/product/'+(i+1),description:'Watch specification: square screen',is_in_stock:true,prices:{price:'10000',currency_minor_unit:2,currency_code:'ILS'},categories:[{name:'שעונים'}],tags:[],attributes:[]}));
const fetchSource=async url=>{const u=new URL(url);if(u.pathname==='/')return '<title>Watch shop</title><main>Watch shop</main>';const size=Number(u.searchParams.get('per_page')),page=Number(u.searchParams.get('page'));return JSON.stringify(rows.slice((page-1)*size,page*size));};
const agent=async prompt=>prompt.startsWith('Return JSON {summary:')?{summary:'Watch shop',vocabulary:[],shoppingQuestions:[],businessFacts:[],policies:[]}:{profile,message:'ok'};
const model=async({prompt,stage})=>{const data=JSON.parse(prompt.split('\nDATA ')[1]);if(stage==='merchant-facts')return {data:{products:data.map(p=>({id:p.id,facts:[{field:'screen',value:'square',quote:'square screen'}]}))}};return {data:{decisions:data.tags.flatMap(t=>data.products.map(p=>({id:p.id,tag:t.tag,status:'matched',field:'description',quote:'square screen'})))}};};

test('full build persists cards, context and an index used by runtime with tag evidence',async()=>{const root=await mkdtemp(tmpdir()+'/core-build-');try{
  const repo=createRunStore(root),p=project(),run=newBuild(p,validateBuildOptions({research:false,scanPages:false},p.platform));await repo.save(run);
  const result=await executeBuild(p,run,repo,{fetchSource,agent,model});assert.equal(result.run.status,'ready',JSON.stringify(result.run.errors));
  assert.equal(result.bundle.productCards.length,37);assert.equal(result.run.coverage.sourceComplete,true);assert.equal(result.run.coverage.storeCompleteness,'unproven');
  const loaded=await createRunStore(root).asset(run.id,'bundle');const runtime=createDraftRuntime({...p,...loaded,id:p.id,productCardsProfileHash:hash(loaded.profile)},{number:1,profile:loaded.profile});
  const response=await runtime.search({query:'שעונים מרובעים',limit:6});assert.equal(response.total,37);assert.equal(response.metadata.indexKind,'local-inverted');assert.ok(response.matches[0].tagDecisions[0].quote);
  assert.ok(response.nextCursor);assert.equal((await runtime.search({cursor:response.nextCursor,limit:6})).matches.length,6);
}finally{await rm(root,{recursive:true,force:true});}});

test('budget pause survives reload and resumes without skipping catalog pages',async()=>{const root=await mkdtemp(tmpdir()+'/core-resume-');try{
  let repo=createRunStore(root),p=project(),run=newBuild(p,validateBuildOptions({research:false,scanPages:false,maxFetches:2},p.platform));await repo.save(run);
  let result=await executeBuild(p,run,repo,{fetchSource,agent,model});assert.equal(result.run.status,'paused');assert.equal(result.run.checkpoints.collect.page,2);
  repo=createRunStore(root);run=await repo.read(run.id);run.options.maxFetches=10;await repo.control(run.id,{action:'run'});
  result=await executeBuild(p,run,repo,{fetchSource,agent,model});assert.equal(result.run.status,'ready',JSON.stringify(result.run.errors));assert.equal(result.bundle.productCards.length,37);assert.equal(new Set(result.bundle.productCards.map(p=>p.id)).size,37);
}finally{await rm(root,{recursive:true,force:true});}});

test('collector exhausts a source beyond the former 10000 product ceiling',async()=>{const state={},assets=new Map();const result=await collectCatalog(project(),{sourceType:'platform'},state,{fetchSource:async url=>{const u=new URL(url),size=Number(u.searchParams.get('per_page')),start=(Number(u.searchParams.get('page'))-1)*size;return JSON.stringify(Array.from({length:Math.max(0,Math.min(size,10007-start))},(_,i)=>({id:start+i})))},asset:async(k,v)=>assets.set(k,v),checkpoint:async()=>{},control:async()=>{},report:async()=>{}});
  assert.equal(result.count,10007);assert.equal(result.complete,true);
});

test('failed tagging prevents activation readiness and is distinct from a negative classification',async()=>{const root=await mkdtemp(tmpdir()+'/core-fail-');try{const repo=createRunStore(root),p=project(),run=newBuild(p,validateBuildOptions({research:false,scanPages:false},p.platform));await repo.save(run);
  const result=await executeBuild(p,run,repo,{fetchSource,agent,model:async()=>{throw Error('provider down')}});assert.equal(result.run.status,'partial');assert.equal(result.run.metrics.tagDecisions.failed,37);assert.equal(result.bundle.tagAssignments['מסך מרובע'].matchedIds.length,0);
}finally{await rm(root,{recursive:true,force:true});}});

test('classification rejects invented quotes and memory-only positives',async()=>{const p=normalizeRecord(rows[0],'woocommerce','https://example.com','https://example.com/api');
  const decisions=await classifyEvidence([p],'tag',{definition:'has music'},async()=>({data:{decisions:[{id:p.id,status:'matched',field:'description',quote:'music storage'}]}}));assert.equal(decisions[0].status,'unknown');
});

test('external facts require exact model identity and literal evidence, and preserve contradictions',async()=>{
  const p={id:'1',name:'Watch A',model:'AX-100',specifications:{screen:'round'}};const source={url:'https://manufacturer.example/ax100',text:'Model AX-100. screen: square. Music storage: yes.',observedAt:new Date().toISOString()};
  const result=await enrichFromSources(p,[source],async()=>({data:{facts:[{field:'screen',value:'square',quote:'screen: square',identityQuote:'Model AX-100',sourceIndex:0},{field:'waterproof',value:'100 meters',quote:'screen: square',identityQuote:'Model AX-100',sourceIndex:0}]}}));
  assert.equal(result.facts.length,1);assert.equal(result.facts[0].status,'conflict');assert.equal(p.specifications.screen,'round');
  const noMatch=await enrichFromSources({...p,model:'AX-200'},[source],()=>{throw Error('must not call model')});assert.equal(noMatch.status,'unknown');
  const prefix=await enrichFromSources(p,[{...source,text:'AX-1000. screen: square.'}],()=>{throw Error('must not match a model prefix')});assert.equal(prefix.status,'unknown');
});

test('incremental rebuild reuses unchanged enrichment/tag evidence and reclassifies only a changed product',async()=>{const root=await mkdtemp(tmpdir()+'/core-incremental-');try{
  const repo=createRunStore(root),p=project(),first=newBuild(p,validateBuildOptions({research:false,scanPages:false},p.platform));await repo.save(first);const initial=await executeBuild(p,first,repo,{fetchSource,agent,model});assert.equal(initial.run.status,'ready');
  p.latestBuildId=first.id;p.catalog=initial.bundle.catalog;p.revisions=[{number:1,profile}];
  const changed=rows.map((r,i)=>i===0?{...r,description:'Changed watch specification: square screen'}:r);let classified=[];
  const second=newBuild(p,first.options);await repo.save(second);const result=await executeBuild(p,second,repo,{agent,fetchSource:async url=>{const u=new URL(url);if(u.pathname==='/')return '<main>Watch shop</main>';const size=Number(u.searchParams.get('per_page')),page=Number(u.searchParams.get('page'));return JSON.stringify(changed.slice((page-1)*size,page*size));},model:async args=>{if(args.stage==='classify')classified.push(...JSON.parse(args.prompt.split('\nDATA ')[1]).products.map(p=>p.id));return model(args);}});
  assert.equal(result.run.status,'ready',JSON.stringify(result.run.errors));assert.equal(result.run.metrics.reusedProducts,36);assert.equal(result.run.metrics.updated,1);assert.deepEqual(classified,['1']);assert.equal(result.bundle.productCards.length,37);
}finally{await rm(root,{recursive:true,force:true});}});

import {prepareRepair,finishRepair} from './core/repair.mjs';
test('AI small-batch repair retains successful classifications and verifies the failed items',async()=>{const root=await mkdtemp(tmpdir()+'/repair-build-');try{
 const repo=createRunStore(root),p=project(),run=newBuild(p,validateBuildOptions({research:false,scanPages:false},p.platform));await repo.save(run);
 await executeBuild(p,run,repo,{fetchSource,agent,model:async args=>{if(args.stage==='classify'&&JSON.parse(args.prompt.split('\nDATA ')[1]).products.some(p=>p.id==='1'))throw Error('Unterminated JSON');return model(args);}});
 assert.equal(run.status,'partial');assert.equal(run.metrics.tagDecisions.failed,5);
 run.repair={stage:'tags',status:'executing'};run.repairStrategy='small_batches';await prepareRepair(run,'tags',p,repo);const classified=[];
 await executeBuild(p,run,repo,{fetchSource,agent,model:async args=>{if(args.stage==='classify'){const data=JSON.parse(args.prompt.split('\nDATA ')[1]);assert.ok(data.products.length<=2);assert.ok(data.tags.length<=2);classified.push(...data.products.map(p=>p.id));}return model(args);}});
 finishRepair(run);assert.equal(run.status,'ready');assert.equal(run.repair.status,'resolved');assert.deepEqual(classified,['1','2','3','4','5']);assert.equal(run.metrics.tagDecisions.failed,undefined);
}finally{await rm(root,{recursive:true,force:true});}});

test('skipped enrichment and tagging still build a ready catalog without model calls for them',async()=>{const root=await mkdtemp(tmpdir()+'/core-skip-');try{
  const repo=createRunStore(root),p=project(),run=newBuild(p,validateBuildOptions({research:false,scanPages:false,skipStages:['enrich','tags']},p.platform));await repo.save(run);const stages=[];
  const result=await executeBuild(p,run,repo,{fetchSource,agent,model:async args=>{stages.push(args.stage);return model(args);}});
  assert.equal(result.run.status,'ready',JSON.stringify(result.run.errors));assert.deepEqual(stages,[]);
  assert.deepEqual(result.run.stages.filter(s=>s.status==='skipped').map(s=>s.key),['enrich','tags']);
  assert.equal(result.bundle.productCards.length,37);assert.ok(result.bundle.productCards.every(c=>c.enrichmentStatus==='skipped'));
  assert.deepEqual(result.bundle.tagAssignments['מסך מרובע'].matchedIds,[]);assert.ok(result.run.warnings.some(w=>w.includes('העשרת מוצרים')));
  assert.throws(()=>validateBuildOptions({skipStages:['collect']}),/ניתן לדלג/);
}finally{await rm(root,{recursive:true,force:true});}});

test('a skip requested mid-stage stops enrichment and keeps the products already enriched',async()=>{const root=await mkdtemp(tmpdir()+'/core-skip-live-');try{
  const repo=createRunStore(root),p=project(),run=newBuild(p,validateBuildOptions({research:false,merchantFacts:false},p.platform));await repo.save(run);let calls=0;
  const pages=async(url,...rest)=>{if(!new URL(url).pathname.startsWith('/product/'))return fetchSource(url,...rest);if(++calls===3)await repo.control(run.id,{action:'run',skip:['enrich']});return '<main>Watch</main>';};
  const result=await executeBuild(p,run,repo,{fetchSource:pages,agent,model});
  assert.equal(result.run.status,'ready',JSON.stringify(result.run.errors));assert.equal(result.run.stages.find(s=>s.key==='enrich').status,'skipped');
  assert.ok(calls<10);assert.ok(result.run.options.skipStages.includes('enrich'));
  const cards=result.bundle.productCards;assert.ok(cards.some(c=>c.enrichmentStatus==='skipped'));assert.ok(cards.some(c=>c.enrichmentStatus!=='skipped'));
  assert.equal(result.run.stages.find(s=>s.key==='tags').status,'completed');
}finally{await rm(root,{recursive:true,force:true});}});

test('skipping enrichment on a rebuild keeps the previous build enrichment and tags',async()=>{const root=await mkdtemp(tmpdir()+'/core-skip-rebuild-');try{
  const repo=createRunStore(root),p=project(),first=newBuild(p,validateBuildOptions({research:false,scanPages:false},p.platform));await repo.save(first);const initial=await executeBuild(p,first,repo,{fetchSource,agent,model});
  p.latestBuildId=first.id;p.revisions=[{number:1,profile}];
  const second=newBuild(p,validateBuildOptions({research:false,scanPages:false,skipStages:['enrich','tags']},p.platform));await repo.save(second);
  const result=await executeBuild(p,second,repo,{fetchSource,agent,model:async()=>{throw Error('no model calls expected')}});
  assert.equal(result.run.status,'ready',JSON.stringify(result.run.errors));assert.equal(result.run.metrics.reusedProducts,37);
  assert.ok(result.bundle.productCards.every(c=>c.extractedFacts?.length));assert.equal(result.bundle.tagAssignments['מסך מרובע'].matchedIds.length,initial.bundle.tagAssignments['מסך מרובע'].matchedIds.length);
}finally{await rm(root,{recursive:true,force:true});}});

test('JSON-LD availability is read with or without the schema.org prefix (Magento emits bare "InStock")',()=>{
  const at=availability=>normalizeRecord({'@type':'Product',name:'תרמיל',sku:'A1',offers:{price:'10',availability}},'magento','https://example.com','https://example.com/a1').stockStatus;
  assert.equal(at('InStock'),'instock');assert.equal(at('https://schema.org/InStock'),'instock');assert.equal(at('http://schema.org/OutOfStock'),'outofstock');assert.equal(at('OutOfStock'),'outofstock');assert.equal(at(''),'unknown');
});

test('a product listed under several sitemap paths is one product, not a duplicate that blocks readiness',async()=>{const root=await mkdtemp(tmpdir()+'/core-alias-');try{
  const page=(name,sku)=>`<html><head><title>${name}</title><script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'Product',name,sku,description:name,offers:{price:'99.90',priceCurrency:'ILS',availability:'InStock'}})}</script></head><body>${name}</body></html>`;
  const pages={'/A1':page('תרמיל 60 ליטר','A1'),'/outlett/A1':page('תרמיל 60 ליטר','A1'),'/B2':page('מזוודה קשיחה','B2')};
  const fetchPages=async url=>{const u=new URL(url);if(u.pathname==='/sitemap.xml')return `<urlset>${Object.keys(pages).map(p=>`<url><loc>https://example.com${p}</loc></url>`).join('')}</urlset>`;if(u.pathname==='/')return '<title>Gear</title><main>Gear</main>';if(pages[u.pathname])return pages[u.pathname];throw Error('Source HTTP 404');};
  const repo=createRunStore(root),p={...project(),platform:'magento'},run=newBuild(p,validateBuildOptions({sourceType:'sitemap',sitemapUrl:'https://example.com/sitemap.xml',research:false,scanPages:false,skipStages:['enrich','tags']},p.platform));await repo.save(run);
  const result=await executeBuild(p,run,repo,{fetchSource:fetchPages,agent,model});
  assert.equal(result.run.coverage.duplicateIds,0);assert.equal(result.run.coverage.aliasUrls,1);
  assert.ok(result.run.validation.checks.find(c=>c.name==='no-duplicate-product-ids').passed);
  assert.deepEqual(result.bundle.productCards.map(c=>c.url).sort(),['https://example.com/A1','https://example.com/B2']);
  assert.ok(!result.run.warnings.some(w=>w.includes('מוצר השתנה')));
}finally{await rm(root,{recursive:true,force:true});}});

test('sitemap: a 404 page does not leave the source unfinished, and a collect repair rereads only the failed pages',async()=>{const root=await mkdtemp(tmpdir()+'/core-sitemap-repair-');try{
  const page=(name,sku)=>`<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'Product',name,sku,description:name,offers:{price:'50',priceCurrency:'ILS',availability:'InStock'}})}</script>`;
  const pages={'/A1':page('תרמיל','A1'),'/B2':page('מזוודה','B2'),'/C3':page('שק שינה','C3')};let online=false;const read=[];
  const fetchPages=async url=>{const u=new URL(url);if(u.pathname==='/sitemap.xml')return `<urlset>${['/A1','/gone','/B2','/C3'].map(p=>`<url><loc>https://example.com${p}</loc></url>`).join('')}</urlset>`;if(u.pathname==='/')return '<title>Gear</title>';
    read.push(u.pathname);if(u.pathname==='/gone')throw Error('Source HTTP 404');if(u.pathname==='/C3'&&!online)throw Error('getaddrinfo ENOTFOUND example.com');return pages[u.pathname];};
  const repo=createRunStore(root),p={...project(),platform:'magento'},run=newBuild(p,validateBuildOptions({sourceType:'sitemap',sitemapUrl:'https://example.com/sitemap.xml',research:false,scanPages:false,verifySource:false,skipStages:['enrich','tags']},p.platform));await repo.save(run);
  const first=await executeBuild(p,run,repo,{fetchSource:fetchPages,agent,model});
  assert.equal(first.run.status,'partial');assert.equal(first.bundle.productCards.length,2);assert.ok(first.run.errors.some(e=>/ENOTFOUND/.test(e.error)));assert.ok(!first.run.errors.some(e=>/404/.test(e.error)));
  online=true;read.length=0;await prepareRepair(first.run,'collect',p,repo);await repo.save(first.run);
  const second=await executeBuild(p,first.run,repo,{fetchSource:fetchPages,agent,model});
  assert.equal(second.run.status,'ready',JSON.stringify(second.run.errors));assert.deepEqual(read,['/C3']);
  assert.deepEqual(second.bundle.productCards.map(c=>c.id).sort(),['A1','B2','C3']);assert.ok(second.bundle.productCards.every(c=>c.stockStatus==='instock'));
}finally{await rm(root,{recursive:true,force:true});}});
