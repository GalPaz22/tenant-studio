import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {randomUUID} from 'node:crypto';
import {createStore} from './store.mjs';import {publicAddress} from './discover.mjs';import {validateProfile} from './model.mjs';import {createDraftRuntime} from './runtime.mjs';
const profile={name:'Store',domain:'books',productTypes:{},colors:{},finishes:{},queryAliases:{ביס:'בייס'},badgeCandidates:{categories:[],tags:[]},badgeRules:[],pipeline:{maxCandidates:20,lightweightRouter:true}};
test('discovery blocks internal networks',()=>{for(const ip of ['127.0.0.1','10.1.2.3','169.254.169.254','172.20.0.2','192.168.0.5','100.64.0.1','::1'])assert.equal(publicAddress(ip),false);assert.equal(publicAddress('8.8.8.8'),true)});
test('profile cannot request unbounded candidate work or malformed rules',()=>{assert.equal(validateProfile(profile),profile);assert.throws(()=>validateProfile({...profile,pipeline:{maxCandidates:10000,lightweightRouter:true}}));assert.throws(()=>validateProfile({...profile,badgeRules:[{field:'arbitrary',text:'hi'}]}))});
test('versioned projects survive reload and cannot escape store',async()=>{const root=await mkdtemp(tmpdir()+'/studio-');try{const store=createStore(root),p={id:randomUUID(),name:'A',revisions:[{number:1}],updatedAt:new Date().toISOString()};await store.save(p);assert.deepEqual(await createStore(root).read(p.id),p);assert.equal((await store.list()).length,1);await assert.rejects(store.read('../secret'))}finally{await rm(root,{recursive:true})}});
test('chat policy revisions change actual runtime results, badges require explicit rule',async()=>{const project={id:'tenant',platform:'custom',url:'https://example.com',catalog:{products:[{id:'1',name:'בייס שקוף',status:'ACTIVE',stockStatus:'instock',categories:['קמפיין'],tags:[],price:20}]}};const draft=createDraftRuntime(project,{number:2,profile:{...profile,badgeRules:[{field:'categories',value:'קמפיין',text:'חדש',order:10}]}});const result=await draft.search({query:'ביס'});assert.equal(result.matches[0].title,'בייס שקוף');assert.equal(result.matches[0].badges[0].text,'חדש');assert.equal(result.metadata.llmUsed,false);assert.equal(draft.profile.domain,'books')});
test('spelling alias plus scoped alias on the corrected phrase keeps all literal matches',async()=>{const project={id:'tenant',platform:'custom',url:'https://example.com',catalog:{products:[{id:'box',name:'מאיר שלו מארז',status:'ACTIVE',stockStatus:'instock',categories:[],tags:[],price:20},{id:'2',name:'אבא עושה בושות',description:'מאת מאיר שלו',status:'ACTIVE',stockStatus:'instock',categories:[],tags:[],price:20}]}};const draft=createDraftRuntime(project,{number:5,profile:{...profile,queryAliases:{'מאיר שליו':'מאיר שלו'},scopedAliases:[{id:'a',term:'מאיר שלו',productIds:['box']},{id:'b',term:'מאיר שליו',productIds:['box']}]}});const result=await draft.search({query:'מאיר שליו'});assert.deepEqual(result.matches.map(m=>m.id).sort(),['2','box']);assert.equal(result.metadata.llmUsed,false);});
test('tenant semantic aliases turn an operator rule into retrieval behavior',async()=>{const project={id:'tenant',platform:'custom',url:'https://example.com',catalog:{products:[{id:'1',name:'Square display watch',status:'ACTIVE',stockStatus:'instock',categories:['שעונים'],tags:[],price:20}]}};const draft=createDraftRuntime(project,{number:3,profile:{...profile,semanticAliases:{'שעון מסך מרובע':['square','display']}}});const result=await draft.search({query:'שעון מסך מרובע'});assert.equal(result.matches[0].title,'Square display watch')});
test('tag definitions cannot escape the same bounds as other profile fields',()=>{
 const withTags={...profile,tagDefinitions:{'מסך מרובע':{definition:'Products with a square or rectangular screen.',queryAliases:['שעון מרובע','square face']}}};
 assert.equal(validateProfile(withTags),withTags);
 assert.throws(()=>validateProfile({...profile,tagDefinitions:{'מסך מרובע':{definition:'',queryAliases:[]}}}));
 assert.throws(()=>validateProfile({...profile,tagDefinitions:{'__proto__':{definition:'x',queryAliases:[]}}}));
});
test('a classified tag is retrievable by its alias even with zero title overlap, unlike semanticAliases',async()=>{
 const project={id:'tenant',platform:'custom',url:'https://example.com',
  catalog:{products:[{id:'1',name:'Garmin Instinct 2X Solar',status:'ACTIVE',stockStatus:'instock',categories:['שעונים'],tags:[],price:900}]},
  tagAssignments:{'מסך מרובע':{matchedIds:['1'],productsScanned:1,failedBatches:0}}};
 const draft=createDraftRuntime(project,{number:4,profile:{...profile,tagDefinitions:{'מסך מרובע':{definition:'Square screen watches.',queryAliases:['שעונים מרובעים','square screen']}}}});
 const result=await draft.search({query:'שעונים מרובעים'});
 assert.equal(result.matches[0].title,'Garmin Instinct 2X Solar');
 assert.equal(result.matches[0].tags.includes('מסך מרובע'),true);
});
import {buildArtifacts} from './artifacts.mjs';import {zipFiles} from './zip.mjs';
test('export includes installable WooCommerce wrapper and a nonempty ZIP',()=>{
 const artifact=buildArtifacts({id:'abc',url:'https://example.com',platform:'woocommerce',learning:{examples:[{id:'yes',status:'confirmed'},{id:'no',status:'pending'}]},revisions:[{number:1,profile}]});
 assert.deepEqual(JSON.parse(artifact.files['learning-tests.json']).examples.map(e=>e.id),['yes']);
 assert.match(artifact.files['semantix-draft.php'],/Plugin Name/);assert.match(artifact.files['search.mjs'],/createDraftRuntime/);
 const zip=zipFiles(artifact.files);assert.equal(zip.readUInt32LE(0),0x04034b50);assert.equal(zip.readUInt32LE(zip.length-22),0x06054b50);
 assert.throws(()=>zipFiles({'../secret':'bad'}));
});
