import {randomUUID} from 'node:crypto';
import {readSearchSignals} from './fast-track.mjs';
import {studioAgent,createStudioSearch,collectChecks,judgeChecks} from './studio-agent.mjs';
import {buildSearchIndex} from './search-index.mjs';
import {learningState} from './learning.mjs';
import {normalize} from './core.mjs';
import {dbShopperClicks} from '../existing-client.mjs';
import {evaluateBaseline} from './baseline.mjs';
import {hash} from './catalog.mjs';

const REASONS={zero:'החזיר 0 תוצאות לקונים',noClicks:'אף קונה לא לחץ על תוצאה',top:'מהחיפושים המובילים',lost:'עובד בחיפוש הקיים ולא אצלנו',fails:'נכשל בחיפוש הקיים'};

// Picks the queries worth checking: zero results first, then searched-but-never-clicked, then the most searched.
export function auditCandidates(signals,{limit=12}={}){
 const lists=[['zero',signals.failed||[]],['noClicks',signals.noClicks||[]],['top',signals.top||[]]],picked=new Map();
 for(let i=0;picked.size<limit&&lists.some(([,l])=>i<l.length);i++)for(const [reason,list] of lists){
  const g=list[i],key=normalize(g?.query||'');if(!key)continue;
  const entry=picked.get(key);if(entry){if(!entry.reasons.includes(reason))entry.reasons.push(reason);continue;}
  if(picked.size<limit)picked.set(key,{query:g.query,reasons:[reason],searches:g.searches,zeroResults:g.zeroResults,clicks:g.clicks,carts:g.carts});
 }
 return [...picked.values()];
}
const shopperRequest=c=>`בדיקה אוטומטית של חיפוש אמיתי: קונים חיפשו ״${c.query}״ ${c.searches} פעמים (${c.reasons.map(r=>REASONS[r]).join('; ')}). האם התוצאות הנוכחיות הן מה שקונה שמחפש ״${c.query}״ בחנות הזו מצפה לקבל? אם המוצר המבוקש לא קיים בקטלוג, תוצאות ריקות או חלופות קרובות מסומנות ככאלה תקינות.`;
const fixRequest=(c,f)=>`החיפוש ״${c.query}״ לא מחזיר את מה שקונים מחפשים (${c.searches} חיפושים; ${c.reasons.map(r=>REASONS[r]).join('; ')}). ממצאי הבדיקה: ${String(f.problems||'התוצאות לא מתאימות').slice(0,1500)}.${f.targets?.length?` בחיפוש הקיים הקונים בחרו במוצרים האלה, והחיפוש שלנו חייב להחזיר אותם: ${f.targets.map(t=>`${t.title} (${t.id})`).join(', ')}.`:''}${f.clicked?.wantedVisible?.length?` מוצרים זמינים שקונים לחצו עליהם בחיפוש הזה: ${f.clicked.wantedVisible.map(x=>`${x.title} (${x.id})`).join(', ')}.`:''} תקן כך שקונה שמחפש ״${c.query}״ יקבל את המוצרים הנכונים מהקטלוג, ואם הם לא קיימים — אל תמציא התאמה.`;

function searchContext(p,services={}){
 if(!p.searchIndex)p.searchIndex=buildSearchIndex(p.productCards,'audit-'+Date.now());
 const profile=p.revisions.at(-1).profile,run=(services.createSearch||createStudioSearch)(p,profile);
 return {p,profile,search:(query,limit)=>run(query,limit)};
}

// Checks real shopper queries against the current rules; with fix=true each finding goes to the studio agent,
// and a fix is kept only when its own verification passed (unverified attempts are discarded, never saved).
export async function auditSearches(project,{model,judge=model,fix=false,limit=12,fixLimit=5,signals=readSearchSignals,source='signals',services={},onEvent=async()=>{}}={}){
 if(!project.productCards?.length)throw Error('נדרש קטלוג שמור');
 if(!Number.isInteger(limit)||limit<1||limit>30||!Number.isInteger(fixLimit)||fixLimit<0||fixLimit>10)throw Error('מגבלות בדיקה לא תקינות');
 await onEvent({type:'note',text:source==='baseline'?'משווה לחיפוש הקיים':'קורא את החיפושים האמיתיים של הקונים'});
 const fromBaseline=source==='baseline'?baselineCandidates(project,{limit}):null;
 const analytics=fromBaseline?{from:project.baseline.since,to:project.baseline.builtAt,sampledSearches:project.baseline.totalSearches,clickTracking:true}:await signals(project),candidates=fromBaseline?fromBaseline.judged:auditCandidates(analytics,{limit});
 if(!candidates.length&&!fromBaseline?.measured.length)throw Error(fromBaseline?'אין בבסיס חיפושים שאבדו או שנכשלים — אין מה לתקן':'אין עדיין נתוני חיפוש של קונים לבדיקה');
 let p=structuredClone(project);
 const ctx=searchContext(p,services),results=[];
 await onEvent({type:'note',text:`בודק ${candidates.length} חיפושים מול הכללים הנוכחיים`});
 // Searches run one by one (the search service limits concurrent model stages); reviews run in parallel.
 const checked=[];for(const c of candidates){const id=randomUUID();await onEvent({type:'tool',id,name:'audit_query',args:{query:c.query}});checked.push({c,id,checks:await collectChecks(ctx,[c.query])});}
 const verdicts=[];for(let i=0;i<checked.length;i+=4)verdicts.push(...await Promise.all(checked.slice(i,i+4).map(x=>judgeChecks(x.checks,shopperRequest(x.c),[],judge))));
 for(const [i,{c,id,checks}] of checked.entries()){
  const v=verdicts[i],q=v.queries?.[0],status=v.error?'unreviewed':q.satisfied?'ok':'problem';
  const r={...c,status,total:checks[0].total,problems:v.error||q.problems,unwantedIds:q?.unwantedIds||[],missingIds:q?.missingIds||[],before:checks[0].products.slice(0,12).map(x=>({id:x.id,title:x.title}))};results.push(r);
  await onEvent({type:'tool_done',id,name:'audit_query',ok:status==='ok',text:`״${c.query}״ (${c.searches} חיפושים${c.clicks?`, ${c.clicks} קליקים`:''}) — ${r.total} תוצאות — ${status==='ok'?'תקין':status==='problem'?'בעיה':'לא נבדק'}`,search:{query:c.query,total:r.total},products:checks[0].products.slice(0,6).map(x=>{const card=p.productCards.find(y=>y.id===x.id);return {id:x.id,title:x.title,image:card?.image,price:card?.price};})});
 }
 // Real clicks separate catalog gaps (wanted products missing or out of stock) from search problems a rule can fix.
 const clicksOf=services.database?.clicks||dbShopperClicks;
 for(const r of results.filter(r=>r.status==='problem')){
  let c;try{c=await clicksOf(p,{query:r.query});}catch{continue;}
  if(!c.clicks)continue;
  const hidden=c.products.filter(x=>!x.visible),share=hidden.reduce((n,x)=>n+x.clicks,0)/Math.max(1,c.products.reduce((n,x)=>n+x.clicks,0));
  r.clicked={clicks:c.clicks,wantedVisible:c.products.filter(x=>x.visible).slice(0,8).map(x=>({id:x.id,title:x.title,clicks:x.clicks})),missing:c.products.filter(x=>!x.inCatalog).slice(0,8).map(x=>x.title),outOfStock:c.products.filter(x=>x.inCatalog&&!x.visible).slice(0,8).map(x=>x.title)};
  if(share>=0.6){r.status='data-gap';r.problems=`רוב הקליקים של הקונים (${Math.round(share*100)}%) הם על מוצרים שלא ניתן להציג: ${r.clicked.missing.length?`חסרים בקטלוג: ${r.clicked.missing.map(t=>`״${t}״`).join(', ')}`:''}${r.clicked.missing.length&&r.clicked.outOfStock.length?'; ':''}${r.clicked.outOfStock.length?`אזלו: ${r.clicked.outOfStock.map(t=>`״${t}״`).join(', ')}`:''}. זה פער בפיד המוצרים, לא בעיית חיפוש.`;}
 }
 // Most-searched problems are fixed first.
 // Measured against production (lost queries) need no reviewer to be a problem.
 if(fromBaseline)for(const m of fromBaseline.measured){results.push(m);const id=randomUUID();await onEvent({type:'tool',id,name:'audit_query',args:{query:m.query}});await onEvent({type:'tool_done',id,name:'audit_query',ok:false,text:`״${m.query}״ (${m.searches} חיפושים) — עובד בחיפוש הקיים, אצלנו חסרים ${m.missingTargets.length} מוצרים`,search:{query:m.query}});}
 const problems=results.filter(r=>r.status==='problem').sort((a,b)=>(b.searches||0)-(a.searches||0));
 // A stop ends fixing; fixes already verified and saved are kept.
 let stopped=null;
 if(fix)for(const r of problems.slice(0,fixLimit)){
  const id=randomUUID();await onEvent({type:'tool',id,name:'audit_fix',args:{query:r.query}});
  await onEvent({type:'note',text:`מתקן את ״${r.query}״`});
  let next=null,error=null;
  try{next=await studioAgent(p,fixRequest(r,r),{model,judge,services,verifyQueries:[r.query],onEvent:async e=>{if(e.type==='note')await onEvent(e);}});}catch(e){if(e?.stopped){stopped=e;break;}error=e.message;}
  const reply=next?.messages.at(-1);let verified=reply?.verification?.satisfied===true;
  // A query lost against production is fixed only when the products shoppers chose come back.
  if(verified&&r.targets?.length){const e=evaluateBaseline(next,next.revisions.at(-1).profile,next.baseline,{only:new Set([r.query])});const status=e?.results[0]?.status;if(!['kept','partial'].includes(status)){verified=false;error=null;r.baselineAfter=status;}}
  r.fix={status:error?'failed':verified?'fixed':'not-verified',...(r.baselineAfter&&{note:'המוצרים שהקונים בחרו עדיין לא חוזרים'}),message:error||reply?.text?.slice(0,1500),changes:reply?.changes||[],version:verified?reply.version:null};
  if(verified){p=next;const after=await collectChecks(searchContext(p,services),[r.query]),wanted=after[0].products.filter(x=>!r.unwantedIds.includes(x.id)).slice(0,20).map(x=>x.id);
   if(wanted.length){const state=learningState(p);if(!state.examples.some(e=>normalize(e.query)===normalize(r.query))&&state.examples.length<100)state.examples.push({id:randomUUID(),query:r.query,includeIds:wanted,excludeIds:r.unwantedIds.filter(x=>!wanted.includes(x)).slice(0,20),status:'pending',source:'search-audit',createdAt:new Date().toISOString()});}}
  await onEvent({type:'tool_done',id,name:'audit_fix',ok:verified,text:`תיקון ״${r.query}״ — ${verified?`אומת ונשמר${r.fix.version?` כגרסה ${r.fix.version}`:''}`:error?`נכשל: ${error}`:'לא אומת, השינויים לא נשמרו'}`,search:{query:r.query}});
 }
 // A later fix may break an earlier one: recheck everything that was fixed against the final rules.
 const fixed=results.filter(r=>r.fix?.status==='fixed');
 if(fixed.length>1&&!stopped){const final=searchContext(p,services);for(const r of fixed){const v=await judgeChecks(await collectChecks(final,[r.query]),shopperRequest(r),[],judge);if(!v.error&&!v.satisfied){r.fix.status='regressed';r.fix.message=v.queries[0].problems;}}}
 const count=s=>results.filter(r=>r.status===s).length,fixCount=s=>results.filter(r=>r.fix?.status===s).length;
 const gaps=results.filter(r=>r.status==='data-gap');
 const lines=[`**נבדקו ${results.length} חיפושים אמיתיים:** ${count('ok')} תקינים, ${problems.length} עם בעיה בחיפוש${gaps.length?`, ${gaps.length} עם פער בקטלוג`:''}${count('unreviewed')?`, ${count('unreviewed')} לא נבדקו`:''}.`];
 if(fix&&problems.length)lines.push(`**תיקון אוטומטי:** ${fixCount('fixed')} תוקנו ואומתו, ${fixCount('not-verified')+fixCount('failed')} לא אומתו ולא נשמרו${fixCount('regressed')?`, ${fixCount('regressed')} נפגעו מתיקון מאוחר יותר`:''}${problems.length>fixLimit?`, ${problems.length-fixLimit} ממתינים לסבב הבא`:''}.`);
 for(const r of problems)lines.push(`* ״${r.query}״ (${r.searches} חיפושים) — ${r.fix?{fixed:'✅ תוקן',regressed:'⚠️ נפגע מתיקון אחר','not-verified':'❌ לא אומת',failed:'❌ נכשל'}[r.fix.status]+': ':''}${r.fix?.status==='fixed'?r.fix.changes.join(', '):r.problems}`);
 if(gaps.length)lines.push('**פערים בקטלוג (לא ניתנים לתיקון בכללי חיפוש — יש להשלים את פיד המוצרים או המלאי):**',...gaps.map(r=>`* ״${r.query}״ (${r.searches} חיפושים) — ${r.problems}`));
 if(stopped)lines.push('**נעצר לבקשתך** — חיפושים שעוד לא טופלו לא תוקנו.');
 if(fix&&fixCount('fixed'))lines.push('החיפושים שתוקנו נשמרו כדוגמאות לבדיקה קבועה שממתינות לאישורך.');
 const message=lines.join('\n'),at=new Date().toISOString();
 p.audit={at,fix,analyticsWindow:{from:analytics.from,to:analytics.to,searches:analytics.sampledSearches,clickTracking:analytics.clickTracking},results:results.map(({before,...r})=>r)};
 p.messages.push({role:'user',text:fix?'בדיקה ותיקון אוטומטי של החיפושים המובילים':'בדיקה אוטומטית של החיפושים המובילים',at},{role:'assistant',text:message,steps:[],changes:fixed.flatMap(r=>r.fix.changes),version:fixed.length?p.revisions.length:null,audit:true,at});p.messages=p.messages.slice(-80);
 p.productCardsProfileHash=hash(p.revisions.at(-1).profile);
 if(fixed.length&&p.baseline){await onEvent({type:'note',text:'מעדכן את ההשוואה לחיפוש הקיים'});p.baselineEval={...evaluateBaseline(p,p.revisions.at(-1).profile),profileHash:hash(p.revisions.at(-1).profile),indexVersion:p.searchIndex?.version};}
 await onEvent({type:'message',text:message,changes:fixed.flatMap(r=>r.fix.changes),version:fixed.length?p.revisions.length:null});
 return p;
}

// From the production baseline: lost queries are measured problems (known targets); production failures go to the reviewer.
export function baselineCandidates(p,{limit=12}={}){
 if(!p.baseline||!p.baselineEval)throw Error('יש לבנות קודם השוואה לחיפוש הקיים');
 const byQuery=new Map(p.baseline.queries.map(q=>[q.query,q])),ev=p.baselineEval.results;
 const measured=ev.filter(r=>r.status==='lost'||r.status==='partial').sort((a,b)=>b.searches-a.searches).slice(0,limit).map(r=>{const b=byQuery.get(r.query);
  return {query:r.query,reasons:['lost'],searches:r.searches,clicks:b.clicks,carts:b.carts,status:'problem',total:r.total,targets:b.targets,missingTargets:r.missing,unwantedIds:[],missingIds:r.missing.map(m=>m.id),
   problems:`בחיפוש הקיים קונים בוחרים ב: ${b.targets.map(t=>`״${t.title}״`).join(', ')}; החיפוש שלנו לא מחזיר ${r.missing.map(m=>`״${m.title}״`).join(', ')}.`};});
 const judged=ev.filter(r=>r.production==='fails').sort((a,b)=>b.searches-a.searches).slice(0,Math.max(0,limit-measured.length)).map(r=>({query:r.query,reasons:['fails'],searches:r.searches,zeroResults:null,clicks:0,carts:0}));
 return {measured,judged};
}
