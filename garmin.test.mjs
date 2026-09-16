import test from 'node:test';
import assert from 'node:assert/strict';
import {processGarmin,garminProfile} from './tenants/garmin/index.mjs';
import {createDraftRuntime} from './runtime.mjs';
import {search} from './core/core.mjs';
const base={name:'Garmin',domain:'garmin.co.il',productTypes:{},colors:{},finishes:{},queryAliases:{},badgeRules:[],badgeCandidates:{},pipeline:{maxCandidates:100,lightweightRouter:true}};
test('square screens filter watches and exclude straps without generating badges',()=>{
 const products=[{id:'1',name:'Venu® Sq 2 Music Black',categories:['שעונים חכמים']},{id:'2',name:'Venu Sq watch band',categories:['רצועות לשעוני GARMIN']},{id:'3',name:'fēnix® 8 AMOLED',categories:['שעונים חכמים']}].map(p=>({...p,status:'ACTIVE',stockStatus:'instock',url:'https://www.garmin.co.il/product/'+p.id}));
 const project={id:'garmin',url:'https://www.garmin.co.il',platform:'woocommerce',catalog:{products}};
 const runtime=createDraftRuntime(project,{number:1,profile:garminProfile(base,products)});
 const result=search(runtime.products,runtime.profile,{query:'שעון מסך מרובע'});
 assert.deepEqual(result.matches.map(p=>p.id),['1']);assert.deepEqual(result.matches[0].badges,[]);
 assert.equal(search(runtime.products,runtime.profile,{query:'fenix'}).matches[0].id,'3');
 assert.equal(search(runtime.products,runtime.profile,{query:'שעון מוזיקה ללא טלפון'}).matches[0].id,'1');
});
test('music storage remains unknown for models with no explicit Music suffix',()=>{
 assert.ok(!processGarmin({name:'Venu Sq 2',categories:[]}).tags.includes('music:storage'));
 assert.ok(!processGarmin({name:'תוכנית טיפולים – fēnix 8 Solar',categories:['Neurobrave']}).tags.includes('series:fenix'));
});
