const checks={
 'document-count':['index','מספר המוצרים באינדקס אינו תואם לקטלוג'],
 'valid-cards':['cards','יש כרטיסי מוצר עם פרטים חסרים'],
 'source-exhausted':['collect','קריאת מקור הקטלוג לא הושלמה'],
 'normalization-errors':['normalize','חלק מהמוצרים לא נקלטו כראוי'],
 'tagging-completed':['tags','סיווג התגיות לא הושלם'],
 'source-membership-stable':['collect','רשימת המוצרים השתנתה בזמן הבנייה'],
 'no-duplicate-product-ids':['collect','נמצאו מזהי מוצר כפולים במקור']
};
export function buildIssues(run){
 if(!run)return [];
 const groups=new Map();
 const add=(stage,text)=>{if(!groups.has(stage))groups.set(stage,{stage,label:run.stages.find(s=>s.key===stage)?.label||stage,details:[]});const g=groups.get(stage);if(!g.details.includes(text))g.details.push(text)};
 for(const e of run.errors||[])add(e.stage,[e.productId||e.id,e.url,e.error].filter(Boolean).join(' · '));
 if(run.status==='paused'&&run.stage)add(run.stage,'השלב נעצר לפני השלמה: '+(run.message||''));
 for(const s of run.stages||[])if(s.status==='failed')add(s.key,run.message||'השלב נכשל');
 for(const c of run.validation?.checks||[])if(!c.passed){const [stage,text]=checks[c.name]||['index','בדיקת חיפוש נכשלה: '+(c.query||c.name||'')];add(stage,text)}
 return [...groups.values()];
}

const descriptions={
 source:['לא הצלחנו להתחבר לחנות','בלי גישה למקור אי אפשר לעדכן את המוצרים.','ה־AI יבדוק אם ניתן לחדש את החיבור או אם חסרה הרשאה.'],
 collect:['רשימת המוצרים אינה מעודכנת או מלאה','מוצרים חדשים או שינויים בחנות עלולים לא להופיע בחיפוש.','ה־AI יבדוק את הסריקה וינסה לעדכן את הקטלוג ולאמת אותו מחדש.'],
 normalize:['חלק מפרטי המוצרים לא נקלטו','ייתכן שמוצרים חסרים בחיפוש או שמוצגים בלי פרטים חשובים.','ה־AI יזהה את השדות הבעייתיים ויבדוק אם אפשר לקלוט אותם מחדש.'],
 taxonomy:['כללי החיפוש דורשים תיקון','סוגי מוצרים ומונחי חיפוש עלולים לא להתאים לקטלוג.','ה־AI יבדוק את התקלה וינסה לבנות מחדש את הכללים תוך שמירת העריכות שלך.'],
 research:['חסר מידע על החנות והתחום','חלק מהמידע המסייע להבנת בקשות קנייה אינו זמין.','ה־AI יבדוק את המקורות וינסה להשלים את המידע הזמין.'],
 enrich:['לא הושלמו פרטים על חלק מהמוצרים','חיפוש לפי חומר, תכונה או מפרט עלול לפספס מוצרים.','ה־AI יבדוק את הסיבה וינסה להשלים מידע מהמקורות. מידע שאין לו מקור יישאר חסר.'],
 tags:['חלק מהמוצרים לא סווגו לתכונות','חיפוש כמו ״כוס מקרמיקה״ עלול לפספס מוצרים מתאימים.','ה־AI יבדוק את הכשלים, יתאים את גודל בקשות הסיווג לפי הצורך וינסה שוב.'],
 cards:['חלק מכרטיסי המוצרים אינם תקינים','מידע חסר בכרטיסים עלול לפגוע בהצגת התוצאות.','ה־AI יבדוק את הנתונים וינסה לבנות מחדש את הכרטיסים.'],
 context:['המידע המסכם על החנות אינו שלם','החיפוש עשוי להבין פחות טוב את תחום החנות.','ה־AI יבדוק את התקלה וינסה לעדכן את המידע על החנות.'],
 index:['בדיקות החיפוש לא עברו','מוצר שקיים בקטלוג עלול לא להופיע בתוצאות.','ה־AI יבדוק את התקלה וינסה לעדכן את החיפוש ולהריץ בדיקה חוזרת.'],
 validate:['עדיין לא ניתן לאשר שהחיפוש תקין','הגרסה אינה מוכנה להפעלה עד לסיום הבדיקות.','ה־AI יבדוק מה מונע אישור וינסה להשלים את הבדיקות.']
};
export function describeIssue(issue,run){
 const [title,impact,plan]=descriptions[issue.stage]||['נמצאה תקלה שדורשת בדיקה','ייתכן שחלק מהמידע אינו זמין לחיפוש.','ה־AI יבדוק את פרטי התקלה.'];
 const failures=(run.errors||[]).filter(e=>e.stage===issue.stage);
 const blocking=(run.validation?.checks||[]).some(c=>!c.passed&&(checks[c.name]?.[0]||'index')===issue.stage)||failures.some(e=>!e.optional)||(run.stages||[]).some(s=>s.key===issue.stage&&s.status==='failed');
 const failed=issue.stage==='tags'?run.metrics?.tagDecisions?.failed:null;
 return {...issue,title,impact,plan,blocking,amount:failed?`${failed} סיווגי מוצר דורשים בדיקה`:null};
}
