import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveClientProfile} from './core/client-brain.mjs';
import {reviewSearchPerformance,proposalRequest} from './core/search-performance.mjs';
const fixture=()=>({id:'one',name:'Store',url:'https://store.example',platform:'custom',existingClient:{dbName:'one'},productCards:[{id:'1',title:'watch',stockStatus:'instock'}],revisions:[{number:1,profile:{}}]});
const activity={queries:[{query:'watch',searches:50,purchaseRate:null}],warnings:['tracking missing'],unavailable:'sample'};
const proposal={kind:'ranking',title:'Order',evidence:'Observed watch query',queries:['watch'],change:'Boost relevant category',metric:'No lost relevant products',validation:'Compare baseline; rollback on loss',risk:'Overboost',priority:1};
const services={analytics:async()=>activity,clientProfile:async p=>resolveClientProfile(p,{platform:'woocommerce'}),search:async()=>({total:1,matches:[{id:'1',title:'watch'}],metadata:{phase:'lexical',llmUsed:false}}),planner:async()=>({summary:'Report',proposals:[proposal],limitations:[]}),model:'test-pro'};
test('shared profile prefers known dashboard platform over legacy custom, refuses conflicts',()=>{
 assert.equal(resolveClientProfile(fixture(),{platform:'WooCommerce'}).platform.value,'woocommerce');
 assert.equal(resolveClientProfile(fixture()).platform.status,'unknown');
 assert.equal(resolveClientProfile({...fixture(),platform:'shopify'},{platform:'woocommerce'}).platform.status,'conflict');
});
test('shared profile uses the dominant catalog storefront when a legacy project URL points elsewhere',()=>{
 const p={...fixture(),url:'https://staging.example',productCards:[{url:'https://shop.example/p/1'},{url:'https://www.shop.example/p/2'},{url:'https://shop.example/p/3'}]};
 const profile=resolveClientProfile(p,{platform:'woocommerce'});assert.equal(profile.url,'https://shop.example/');assert.equal(profile.urlSource,'catalog-majority');
});
test('performance review records evidence and proposals without modifying rules; stale execution blocked',async()=>{
 const p=fixture(),rules=JSON.stringify(p.revisions);const r=await reviewSearchPerformance(p,services);
 assert.equal(r.model,'test-pro');assert.equal(r.evidence.checks.length,1);assert.equal(JSON.stringify(p.revisions),rules);assert.ok(r.limitations.includes('tracking missing'));
 assert.match(proposalRequest(p,r.proposals[0].id),/Boost relevant category/);
 p.productCards[0].title='changed';assert.throws(()=>proposalRequest(p,r.proposals[0].id),/השתנו/);
});
test('fabricated query evidence or malformed plans are rejected and previous report survives',async()=>{
 const p=fixture();p.performanceReport={id:'old'};
 await assert.rejects(reviewSearchPerformance(p,{...services,planner:async()=>({summary:'x',proposals:[{...proposal,queries:['invented']} ]})}),/ביסוס/);
 assert.equal(p.performanceReport.id,'old');
});
test('absent analytics or failing search stay explicit; strong model can recommend no change',async()=>{
 const p=fixture();const r=await reviewSearchPerformance(p,{...services,analytics:async()=>{throw Error('private connection secret');},planner:async prompt=>{assert.ok(!prompt.includes('private connection secret'));return {summary:'Need data',proposals:[],limitations:['not enough data']};}});
 assert.equal(r.evidence.checks.length,0);assert.ok(r.limitations.length);assert.equal(r.evidence.latency.medianMs,null);
});
