import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildIssues} from './public/build-issues.js';
test('readiness failures expose actionable stages even without recorded errors',()=>{
 const issues=buildIssues({stages:[{key:'collect',label:'סריקת קטלוג'},{key:'tags',label:'סיווג תגיות'}],errors:[{stage:'tags',productId:'42',error:'timeout'}],validation:{checks:[{name:'source-exhausted',passed:false},{name:'source-membership-stable',passed:false},{name:'tagging-completed',passed:false},{name:'valid-cards',passed:true}]}});
 assert.equal(issues.length,2);assert.equal(issues[0].stage,'tags');assert.match(issues[0].details[0],/42/);assert.equal(issues[1].stage,'collect');assert.equal(issues[1].details.length,2);
 assert.deepEqual(buildIssues(null),[]);
});

import {chatCatalog} from './core/chat-context.mjs';
test('chat receives relevant products beyond the first catalog page',()=>{
 const products=Array.from({length:40},(_,id)=>({id:String(id),name:'צלחת',categories:[]}));
 products.push({id:'mug',name:'מאג מקרמיקה',description:'כוס מקרמיקה לשתייה חמה',categories:['ספלים']});
 const selected=chatCatalog(products,'לא עובד',{query:'כוס מקרמיקה'});
 assert.equal(selected[0].id,'mug');assert.equal(selected.length,30);
});
