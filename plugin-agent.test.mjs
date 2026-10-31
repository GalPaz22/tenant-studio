import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preparePluginUpdate,PLUGIN_REQUEST_PREFIX} from './public/plugin-agent.js';
const id='test-project',done={type:'done',project:{id,pluginWorkspace:{revision:2}}};
function setup({events=[{type:'message',text:'updated'},done],state={revision:2,validation:{ok:true}},abort=false}={}){
 const calls=[],controller=new AbortController();
 const connection={stream:async(path,body,onEvent)=>{calls.push({path,body});for(const e of events)onEvent(e);if(abort)controller.abort();},request:async(path,body,blob)=>{calls.push({path,body,blob});return new Blob(['full zip']);}};
 return {calls,args:{id,message:'שפר את המובייל',revision:1,connection,api:async()=>state,signal:controller.signal}};
}
test('plugin agent packages only completed saved newer source with validation, using the exact revision',async()=>{
 const {calls,args}=setup();let project;
 const r=await preparePluginUpdate({...args,onProject:p=>{project=p;}});
 assert.equal(await r.blob.text(),'full zip');assert.equal(project.id,id);assert.match(calls[0].body.message,new RegExp(PLUGIN_REQUEST_PREFIX));assert.match(calls[0].body.context.instructions,/אל תיצור תוסף גנרי/);
 assert.equal(calls[0].body.context.surface,'plugin');assert.equal(calls[0].body.context.pluginRevision,1);assert.equal(calls[1].path,'/projects/'+id+'/plugin/release');assert.equal(calls[1].body.expectedRevision,2);assert.equal(calls[1].blob,true);
});
test('no download on errors, stopped/aborted streams, missing completion, stale source, unchanged source or validation failure',async()=>{
 for(const config of [{events:[{type:'error',message:'failed'},done]},{events:[{type:'stopped',message:'stopped'}]},{abort:true},{events:[{type:'message',text:'looks done'}]},{events:[{...done,project:{id:'other'}}]},{state:{revision:3,validation:{ok:true}}},{events:[{...done,project:{id,pluginWorkspace:{revision:1}}}],state:{revision:1,validation:{ok:true}}},{state:{revision:2,validation:{ok:false,errors:['syntax']}}}]){
  const {calls,args}=setup(config);await assert.rejects(preparePluginUpdate(args));assert.equal(calls.filter(c=>c.blob).length,0,JSON.stringify(config));
 }
});
test('missing source and invalid instructions do not dispatch the agent',async()=>{
 for(const patch of [{revision:undefined},{message:''},{message:'x'.repeat(2201)}]){const {calls,args}=setup();await assert.rejects(preparePluginUpdate({...args,...patch}));assert.equal(calls.length,0);}
});
test('a revision conflict during packaging propagates without claiming a successful release',async()=>{
 const {args}=setup();args.connection.request=async()=>{throw Error('התוסף השתנה');};await assert.rejects(preparePluginUpdate(args),/התוסף השתנה/);
});
