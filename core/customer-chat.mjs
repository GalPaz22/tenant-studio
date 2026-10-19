import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import {getMongo} from './dashboard/core/db.js';
import {studioAgent,tools} from './studio-agent.mjs';

const fail=(message,status=400)=>Object.assign(Error(message),{status});
const fingerprint=p=>createHash('sha256').update(JSON.stringify(p)).digest('hex');
const names=['overview','find_products','facet','get_product','categories','fields','field_values','suggest','search','measure_search','read_engine','inspect_query','shopper_clicks','customer_analytics','shopper_activity','search_analytics','list_rules','add_spelling','add_synonyms','link_term','remove_rule','rank_rule','tag_products','configure_search','db_fields','db_search','add_example','check_examples','list_versions','fetch_store_page'];
const text=(v,max=200)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;

export async function customerTenant(apiKey){
 if(!text(apiKey,300))throw fail('נדרשת חנות מחוברת',401);
 const client=await getMongo();
 const user=await client.db('users').collection('users').findOne({apiKey},{projection:{dbName:1}});
 if(!user?.dbName)throw fail('החנות אינה מחוברת',404);return {dbName:user.dbName};
}
export async function customerProject(store,dbName,env=process.env){
 const project=await store.read(await customerProjectId(store,dbName,env));
 return validateCustomerProject(project,dbName);
}
export async function customerProjectId(store,dbName,env=process.env,recover=null){
 let configured={};try{configured=JSON.parse(env.STUDIO_CUSTOMER_PROJECTS||'{}');}catch{throw fail('מיפוי החנויות בסטודיו אינו תקין',503);}
 const candidates=configured[dbName]?[{id:configured[dbName]}]:(await store.metas()).filter(p=>p.dbName===dbName);
 if(!candidates.length&&!configured[dbName]&&recover)return recover(dbName);
 if(candidates.length!==1)throw fail(candidates.length?'יש להשלים מיפוי חד־משמעי לחנות בסטודיו':'לחנות עדיין אין פרויקט מחובר בסטודיו',409);
 return candidates[0].id;
}
function validateCustomerProject(project,dbName){
 if(project.existingClient?.dbName!==dbName)throw fail('פרויקט הסטודיו אינו שייך לחנות',403);
 if(!project.revisions?.length||!project.productCards?.length)throw fail('יש להשלים את קטלוג החנות בסטודיו',409);
 return project;
}
export function customerTools(project,actions,analytics){
 const allowed=Object.fromEntries(names.filter(name=>tools[name]).map(name=>[name,tools[name]]));
 const push=action=>{if(actions.length>=6)throw Error('עד שש הצעות בכל הודעה');if(!actions.some(a=>JSON.stringify(a)===JSON.stringify(action)))actions.push(action);return {pending:true,message:'השינוי מוכן לבדיקה בדאשבורד וטרם הופעל'};};
 allowed.dashboard_analytics={doc:'{} the dashboard’s measured conversion report, with window, source coverage and unavailable rates. Use first for performance questions about this window. Null is unmeasured, never reconstruct a suppressed rate.',run:()=>analytics,say:()=> 'נקראו נתוני הדאשבורד של החנות'};
 allowed.promote_products={doc:'{term:string,level:0..3,limit?:1..100} prepare product promotion by product-name words, level 0 resets. Applies through the dashboard only after approval. Prefer this over rank_rule for a direct request to promote named products.',run:(_ctx,a)=>{if(!text(a.term,80)||a.term.trim().length<2||!Number.isInteger(a.level)||a.level<0||a.level>3||a.limit!==undefined&&(!Number.isInteger(a.limit)||a.limit<1||a.limit>100))throw Error('קידום מוצר לא תקין');return push({kind:'productBoost',term:a.term.trim(),level:a.level,limit:a.limit||40});},say:()=> 'הוכנה הצעת קידום לאישור'};
 allowed.hide_products={doc:'{term:string,hidden:boolean,limit?:1..100} prepare hiding or restoring named products in the live catalog. Requires approval in the dashboard.',run:(_ctx,a)=>{if(!text(a.term,80)||a.term.trim().length<2||typeof a.hidden!=='boolean'||a.limit!==undefined&&(!Number.isInteger(a.limit)||a.limit<1||a.limit>100))throw Error('הסתרת מוצר לא תקינה');return push({kind:'productVisibility',term:a.term.trim(),hidden:a.hidden,limit:a.limit||40});},say:()=> 'הוכנה הצעת נראות לאישור'};
 allowed.pin_products={doc:'{query:string,productIds:string[]} prepare ordered pins for one exact search query using ids returned by find_products/get_product. At most 20 visible, in-stock products. Requires approval; does not narrow organic results.',run:(_ctx,a)=>{const ids=a.productIds;if(!text(a.query)||!Array.isArray(ids)||!ids.length||ids.length>20||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!project.productCards.some(p=>p.id===id&&!p.hidden&&p.stockStatus==='instock')))throw Error('יש לבחור מוצרים זמינים מהקטלוג של החנות');return push({kind:'pin',query:a.query.trim(),productIds:ids});},say:()=> 'הוכנה הצעת נעיצה לאישור'};
 return allowed;
}
const POLICY=`This is the authenticated CUSTOMER dashboard, using the real Tenant Studio agent and this store's existing project. Questions are read-only. Tools may prepare reversible drafts only; NOTHING is live until the merchant approves the proposal in the dashboard. Never say a draft is applied or published. Prefer promote_products/hide_products/pin_products for explicit product merchandising so it stays consistent with the dashboard's manual controls. Use dashboard_analytics first for its measured window; missing rates are unavailable, not zero. Rates use identified sessions with a preceding search, not individual search events; sessions.all is measured sessions, not total store visits. No plugin editing, crawling, deployment, switching tenants or exposing credentials. Answer briefly in Hebrew, explaining any proposed changes and their verification. The caller supplies this conversation's history; other Studio conversations are private.`;

export function installCustomerChat(app,{store,drafts,persist,locked,publish,model,judge,resolveTenant=customerTenant,recoverProject=null,services=()=>({}),agent=studioAgent}){
 const operations={};
 const register=(operation,fn)=>{operations[operation]=fn;app.post('/api/customer-chat/'+operation,route(fn));};
 const route=fn=>async(req,res,next)=>{try{await fn(req,res);}catch(error){if(res.headersSent){res.write(JSON.stringify({type:'error',message:error.message})+'\n');res.end();}else if(error.status)res.status(error.status).json({error:error.message});else next(error);}};
 app.use('/api/customer-chat',(req,res,next)=>{
  const secret=process.env.STUDIO_CUSTOMER_API_TOKEN||'',provided=req.get('X-Studio-Customer-Token')||'';
  if(!secret||!provided||!timingSafeEqual(createHash('sha256').update(secret).digest(),createHash('sha256').update(provided).digest()))return res.status(401).json({error:'Unauthorized'});
  next();
 });
 register('turn',async(req,res)=>{
  const {apiKey,message,history=[],analytics=null}=req.body||{};
  if(!text(message,3000)||!Array.isArray(history)||history.length>16||history.some(m=>!['user','assistant'].includes(m.role)||typeof m.text!=='string'||m.text.length>8000))throw fail('הודעה או היסטוריה לא תקינה');
  const {dbName}=await resolveTenant(apiKey),projectId=await customerProjectId(store,dbName,process.env,recoverProject);
  await locked(projectId,async()=>{
   const current=validateCustomerProject(await store.read(projectId),dbName);
   const base=fingerprint(current),working={...current,messages:history.map(m=>({role:m.role,text:m.text}))},actions=[];
   let stopped=false;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10*60*1000);
   res.on('close',()=>{if(!res.writableEnded){stopped=true;controller.abort();}});
   let calls=0;const usage=[];
   const guard=fn=>async prompt=>{
    if(stopped||controller.signal.aborted)throw Object.assign(Error('הריצה נעצרה'),{stopped:true});
    if(++calls>24)throw Error('הגעת למגבלת קריאות המודל להודעה');
    // A cancelled HTTP request must not save a draft even if a provider finishes later.
    let cancel;const aborted=new Promise((_,reject)=>{cancel=()=>reject(Object.assign(Error('הריצה נעצרה'),{stopped:true}));controller.signal.addEventListener('abort',cancel,{once:true});});
    try{const result=await Promise.race([fn(prompt),aborted]);if(controller.signal.aborted)throw Object.assign(Error('הריצה נעצרה'),{stopped:true});if(result?.usage)usage.push(result.usage);return result;}
    finally{controller.signal.removeEventListener('abort',cancel);}
   };
   res.status(200).set({'Content-Type':'application/x-ndjson; charset=utf-8','X-Accel-Buffering':'no'});res.flushHeaders();
   const send=event=>{if(!stopped&&!res.writableEnded)res.write(JSON.stringify(event)+'\n');};
   try{
    const next=await agent(working,message,{model:guard(model()),judge:guard(judge()),toolset:customerTools(current,actions,analytics),instructions:POLICY,services:services(),onEvent:async event=>{if(['note','tool','tool_done'].includes(event.type))send({type:event.type,id:event.id,name:event.name,text:event.text,ok:event.ok});}});
    if(stopped||controller.signal.aborted)return;
    const answer=next.messages.at(-1),changes=answer?.changes||[];let draft=null;
    if(changes.length){
     const id=randomUUID();await drafts.save({id,dbName,projectId:current.id,base,status:'pending',createdAt:new Date().toISOString(),changes,next:{...next,messages:current.messages},request:message});
     draft={id,projectId:current.id,changes,version:next.revisions.at(-1)?.number};
    }
    send({type:'done',summary:String(answer?.text||''),actions,draft,usage,modelCalls:calls,engine:'tenant-studio'});
   }catch(error){send({type:'error',message:error.stopped?'הריצה נעצרה':error.message});}
   finally{clearTimeout(timer);if(!res.writableEnded)res.end();}
  });
 });
 register('approve',async(req,res)=>{
  const {apiKey,draftId}=req.body||{};if(typeof draftId!=='string'||!/^[a-f0-9-]{36}$/.test(draftId))throw fail('טיוטה לא תקינה');
  const {dbName}=await resolveTenant(apiKey);let draft;try{draft=await drafts.read(draftId);}catch(error){if(error.code==='ENOENT')throw fail('הטיוטה לא נמצאה',404);throw error;}
  if(draft.dbName!==dbName)throw fail('הטיוטה לא נמצאה בחנות',404);
  await locked(draft.projectId,async()=>{
   const current=await store.read(draft.projectId);
   if(current.existingClient?.dbName!==dbName)throw fail('הפרויקט אינו שייך לחנות',403);
   if(draft.status!=='approved'&&current.lastCustomerChatApproval!==draftId){
    if(fingerprint(current)!==draft.base)throw fail('הפרויקט עודכן מאז יצירת ההצעה. יש לבקש הצעה חדשה כדי לשמור על השינויים האחרונים.',409);
    const next={...draft.next,lastCustomerChatApproval:draftId,messages:[...current.messages,{role:'user',text:draft.request,at:new Date().toISOString()},{role:'assistant',text:'אושרה הצעת הדאשבורד: '+draft.changes.join(' · '),at:new Date().toISOString()}].slice(-80)};
    await persist(next);draft.status='approved';await drafts.save(draft);
   }
   const approved=await store.read(draft.projectId);let published=false;
   if(approved.lastCustomerChatApproval!==draftId)throw fail('הטיוטה כבר נבדקה ולא ניתן להחיל אותה שוב',409);
   try{if(approved.dashboardExport?.slug){await publish(approved,approved.dashboardExport.slug);published=true;}}catch{ /* A saved revision is not falsely reported as published. */ }
   res.json({saved:true,published,version:approved.revisions.at(-1)?.number});
  });
 });
 // Keep unknown customer routes behind this authentication boundary.
 app.use('/api/customer-chat',(_req,res)=>res.status(404).json({error:'Not found'}));
 return operations;
}
