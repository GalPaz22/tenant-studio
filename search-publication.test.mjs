import test from 'node:test';
import assert from 'node:assert/strict';
import {searchExperimentPublication} from './core/dashboard/engine/search-publication.js';
import {publishActiveExperiments,experimentPublicationStatus} from './core/dashboard/engine/publisher.js';
import {configureDashboardStorage} from './core/dashboard/core/db.js';
test('search publication bridge is authenticated server-to-server and rejects redirects and malformed acknowledgements',async()=>{
 const seen=[];const request=async(url,init)=>{seen.push({url,init});return Response.json({available:true,published:true,experimentIds:['1234567890abcdef12345678']});};
 const result=await searchExperimentPublication('fixture-key',{publish:true,request});assert.equal(result.available,true);assert.equal(seen[0].url.pathname,'/experiments/publication');assert.equal(seen[0].init.headers['x-api-key'],'fixture-key');assert.equal(seen[0].init.method,'POST');assert.equal(seen[0].init.body,undefined);assert.equal(seen[0].init.redirect,'error');
 await assert.rejects(searchExperimentPublication('fixture',{request:async()=>new Response('',{status:401})}),e=>e.status===503);
 await assert.rejects(searchExperimentPublication('fixture',{request:async()=>Response.json({available:true,experimentIds:'fake'})}),e=>e.status===503);
});
test('missing or failing Studio Redis falls back to engine publication, while status checks never activate anything',async()=>{
 const original=globalThis.fetch,seen=[];globalThis.fetch=async(url,init)=>{seen.push({url,init});return Response.json({available:true,published:true,mode:'search-engine',experimentIds:[]});};
 try{configureDashboardStorage({redis:null});const published=await publishActiveExperiments('fixture');assert.equal(published.mode,'search-engine');assert.equal(seen[0].init.method,'POST');await experimentPublicationStatus('fixture');assert.equal(seen[1].init.method,'GET');
 configureDashboardStorage({redis:{get:async()=>{throw Error('offline');}}});await experimentPublicationStatus('fixture');assert.equal(seen[2].init.method,'GET');
 }finally{globalThis.fetch=original;configureDashboardStorage(null);}
});
