import {test} from 'node:test';
import assert from 'node:assert/strict';
import {diagnoseRepair,prepareRepair,finishRepair} from './core/repair.mjs';
import {describeIssue,buildIssues} from './public/build-issues.js';
const makeRun=()=>({id:'test',stages:['source','collect','normalize','taxonomy','research','enrich','tags','cards','context','index','validate'].map(key=>({key,status:'completed',done:1})),errors:[{stage:'tags',error:'Unterminated JSON'},{stage:'collect',error:'changed membership'},{stage:'enrich',optional:true,error:'timeout'}],checkpoints:{collect:{page:2},tags:{batch:3},verify:{page:9}},status:'partial',validation:{passed:false,checks:[{name:'tagging-completed',passed:false}]}});
test('AI can choose a bounded repair strategy, not an arbitrary action',async()=>{
 const run=makeRun();const plan=await diagnoseRepair(run,'tags','',async prompt=>{assert.match(prompt,/Unterminated JSON/);return {action:'small_batches',explanation:'תשובת הסיווג נחתכה',nextStep:'אחלק את הסיווג לבקשות קטנות ואבדוק מחדש'}});
 assert.equal(plan.action,'small_batches');
 await assert.rejects(()=>diagnoseRepair(run,'tags','',async()=>({action:'execute_code'})));
 await assert.rejects(()=>diagnoseRepair(run,'collect','',async()=>({...plan,action:'small_batches'})));
 await assert.rejects(()=>diagnoseRepair(run,'missing','',async()=>plan));
});
test('repair preserves operator edits and resets dependent verification, leaving earlier failures visible',async()=>{
 const run=makeRun(),profile={name:'edited',tagDefinitions:{}};let written;
 await prepareRepair(run,'index',{revisions:[{profile}]},{asset:async(_id,_key,value)=>value?written=value:{name:'old'}});
 assert.equal(written,profile);assert.equal(run.stages.find(s=>s.key==='tags').status,'pending');assert.equal(run.stages.find(s=>s.key==='collect').status,'completed');assert.equal(run.checkpoints.verify,undefined);assert.equal(run.checkpoints.collect.page,2);assert.deepEqual(run.errors.map(e=>e.stage),['collect','enrich']);assert.equal(run.validation,null);
});
test('a rerun is not reported resolved before verification, nor when its issue remains',()=>{
 const run=makeRun();run.repair={stage:'tags',status:'executing'};finishRepair(run);assert.equal(run.repair.status,'needs_input');
 run.errors=run.errors.filter(e=>e.stage!=='tags');run.validation.checks=[];run.repair.status='executing';run.stages.at(-1).status='pending';finishRepair(run);assert.equal(run.repair.status,'needs_input');
 run.stages.at(-1).status='completed';run.repair.status='executing';finishRepair(run);assert.equal(run.repair.status,'resolved');assert.match(run.repair.result,/נותרו בעיות/);
});
test('plain-language issues distinguish optional missing information from activation blockers',()=>{
 const run=makeRun(),issues=buildIssues(run).map(i=>describeIssue(i,run));assert.equal(issues.find(i=>i.stage==='enrich').blocking,false);assert.equal(issues.find(i=>i.stage==='tags').blocking,true);assert.match(issues.find(i=>i.stage==='tags').impact,/חיפוש/);
});
