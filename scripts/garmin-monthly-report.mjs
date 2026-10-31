// Client-facing business and marketing edition. Internal diagnostics stay out of this report.
import fs from 'node:fs/promises';
const dir='reports/garmin-monthly-2026-09';
const r=JSON.parse(await fs.readFile(`${dir}/metrics.json`)),m=JSON.parse(await fs.readFile(`${dir}/marketing-metrics.json`));
const z=m.summary,s=r.september,a=r.august,am=new Map(a.queries.map(x=>[x.query,x])),qm=new Map(m.queries.map(x=>[x.query,x]));
const num=x=>Number(x).toLocaleString('en-US',{maximumFractionDigits:1}),f=x=>Number(x).toFixed(1),sign=x=>`<span class="up" dir="ltr">${x>0?'+':''}${f(x)}%</span>`,esc=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const change=(x,y)=>100*(x/y-1),p=x=>`<p>${x}</p>`,h=x=>`<h3>${x}</h3>`,note=x=>`<p class="note">${x}</p>`,box=(title,text)=>`<aside><strong>${title}</strong><p>${text}</p></aside>`;
const table=(heads,rows)=>`<table><thead><tr>${heads.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const stat=(v,label,sub='')=>`<div class="stat"><b dir="ltr">${v}</b><span>${label}</span><small>${sub}</small></div>`;
const pages=[];const page=(title,kicker,content)=>pages.push({title,kicker,content});
const scoreRows=[['חיפושים באתר',z.searchAug,z.searchSep,z.searchChange],['ממוצע חיפושים ליום',z.dailyAug,z.dailySep,z.dailyChange],['נוסחי חיפוש שונים',z.uniqueAug,z.uniqueSep,z.uniqueChange],['קליקים על תוצאות Semantix',z.injectAug,z.injectSep,z.injectChange]];
const queryRows=terms=>terms.map(t=>{const q=qm.get(t);return[esc(t),num(q.august),num(q.september),sign(q.change),`<span dir="ltr">×${q.relativeInterest.toFixed(2)}</span>`]});
const horizontal=(rows)=>`<div class="bars">${rows.map(x=>`<div class="barrow"><label>${esc(x.label)}</label><div class="track"><i style="width:${x.september/Math.max(...rows.map(y=>y.september))*100}%"></i></div><b>${num(x.september)}</b><em dir="ltr">+${f(x.change)}%</em></div>`).join('')}</div>`;
page('החיפוש בגארמין','ספטמבר 2026 | תובנות עסקיות ושיווקיות',
`<div class="hero">יותר ביקוש.<br>יותר אינטראקציות.<br>הזדמנויות חדשות לשיווק.</div><div class="stats">${stat('+43.6%','חיפושים באתר','8,754 לעומת 6,094 באוגוסט')}${stat('+28.1%','קליקים על תוצאות Semantix','4,931 לעומת 3,848 באוגוסט')}${stat('+366.7%','עניין בחיפוש Venu 3S','112 לעומת 24 בנוסח המדויק')}${stat('99.82%','מהחיפושים החזירו תוצאות','לעומת 99.03% באוגוסט')}</div>`+
box('הסיפור של החודש','העניין באתר התרחב, ובתוכו בלטו Venu, חיפושי דגם מדויקים ותוכן סביב בחירת שעון. שלושת כיווני העבודה המומלצים: Venu ו־Venu 3S, השוואות בין דגמי Forerunner ותוכן לבחירת שעון לפי צורך.')+
h('מה לקחת לפגישת השיווק הקרובה')+
p('<b>Venu הוא עוגן מרכזי:</b> המשפחה צמחה ב־68.1%, ו־Venu 3S המדויק הגדיל פי 3.25 את חלקו בחיפושים. זו הזדמנות לתוכן ולמסרים נפרדים לפי דגם.')+
p('<b>חיפושים מדויקים מתחזקים:</b> Fenix 8 עלה ב־86.5%; 265 עלה ב־76.0%. כדאי לחבר מודעה, דף נחיתה ותוכן לאותו דגם שהגולש מבקש.')+
p('<b>ביקוש נוסף שכדאי לפתח:</b> ״נשים״ עלה ב־114.3% ו״רצועת דופק״ ב־92.5%. אלה כיוונים לתוכן ולבחירת מוצרים לקידום.')+
`<div class="scope">השוואה: 1–30.9.2026 מול 1–31.8.2026, שעון ישראל. הוכן ב־24.10.2026. נתוני החיפוש והקליקים באתר Garmin.</div>`);
page('ספטמבר מול אוגוסט','01 | התוצאות במספרים',
table(['מדד','אוגוסט','ספטמבר','שינוי'],scoreRows.map(([l,aa,ss,d])=>[l,num(aa),num(ss),sign(d)]))+
`<div class="stats three">${stat('+2,660','אירועי חיפוש נוספים')}${stat('+1,083','קליקים נוספים על תוצאות Semantix')}${stat('+543','נוסחי חיפוש נוספים')}</div>`+
h('הצמיחה חזקה גם אחרי התאמה לאורך החודש')+
p('ספטמבר קצר מאוגוסט ביום אחד. הממוצע היומי עלה מ־196.6 ל־291.8 חיפושים, צמיחה של 48.4%. כלומר, העלייה אינה מוסברת בחודש ארוך יותר: הפעילות היומית הייתה גבוהה יותר.')+
h('יותר חיפושים מקבלים תוצאות')+
table(['מדד','אוגוסט','ספטמבר'],[['חיפושים שהחזירו תוצאות','99.03%','99.82%'],['אירועים ללא תוצאות','59','16'],['שיעור ללא תוצאות','0.97%','0.18%']])+
p('מספר החיפושים ללא תוצאות ירד ב־72.9% במקביל לעלייה בהיקף החיפושים. המדד מתאר החזרת תוצאות ברישום החיפוש, ומשלים את תמונת הגידול בפעילות.')+
box('המשמעות העסקית','יש יותר הזדמנויות לפגוש כוונת קנייה בתוך האתר, ויותר אינטראקציות עם התוצאות. ההמלצה היא לרכז את הפעילות השיווקית בנושאים שצמחו גם בנפח וגם בחלקם היחסי בחיפושים.')+
note('הספירות הן אירועים ונוסחים, לא אנשים ייחודיים. קליקים על תוצאות Semantix מתייחסים לכרטיסים שנוספו לתוצאות על ידי Semantix; אין מדובר בשיעור רכישה.'));
page('אילו חיפושים התחזקו במיוחד','02 | עלייה בכמות, וגם בחלק היחסי בביקוש',
table(['חיפוש מדויק','אוגוסט','ספטמבר','צמיחה','עניין יחסי'],queryRows(['venu 3s','נשים','רצועת דופק','fenix 8','265','venu 4','lily','965','forerunner 265']))+
note('״עניין יחסי״ = חלק החיפוש מתוך כלל חיפושי ספטמבר, חלקי חלקו באוגוסט. ערך מעל ×1 מציין צמיחה מעבר לגידול הכללי באתר. ההשוואה כאן היא לנוסחים המדויקים לאחר איחוד אותיות גדולות ורווחים.')+
h('Venu 3S: ההאצה הבולטת בין החיפושים המובילים')+
p('החיפוש עלה מ־24 ל־112, תוספת של 88 אירועים. חלקו מכלל החיפושים עלה מ־0.39% ל־1.28%, פי 3.25. זו עלייה מעבר לצמיחת האתר, ולכן זהו מועמד מעניין לפעילות ייעודית. יחד עם הכתיב venu3s נרשמו 117 חיפושים בספטמבר לעומת 29 באוגוסט.')+
h('Fenix 8 ו־265: עניין ממוקד שאפשר לפגוש במסר מדויק')+
p('Fenix 8 המדויק עלה מ־96 ל־179 וחלקו היחסי גדל פי 1.30. החיפוש 265 עלה מ־104 ל־183 וחלקו גדל פי 1.22. כדאי לבחון תוכן ודפי נחיתה שמתחילים בדגם המבוקש ומציעים לאחר מכן השוואה רלוונטית.')+
box('תובנה לתכנון קידום','לא להסתפק ב״כולם גדלו״. Venu 3S, בחירת שעון לנשים, רצועות דופק ו־Forerunner 265 מציגים גם התחזקות יחסית. הם מועמדים ראשונים לבדיקת קריאייטיב ותוכן ממוקדים.'));
page('שלוש משפחות שמרכזות את הביקוש','03 | איפה כדאי למקד את ההשקעה בתוכן ובמסחר',
horizontal(m.categories.filter(x=>['Forerunner / מספר דגם','Fenix','Venu','Vivo','Lily','חיישנים ורצועות דופק'].includes(x.label)))+
table(['משפחה / כוונה','אוגוסט','ספטמבר','חלק בספטמבר'],m.categories.filter(x=>['Forerunner / מספר דגם','Fenix','Venu','Vivo','Lily','חיישנים ורצועות דופק'].includes(x.label)).map(x=>[esc(x.label),num(x.august),num(x.september),`${f(x.shareSep)}%`]))+
p('<b>Forerunner / מספרי דגם, Fenix ו־Venu מרכזים יחד 39.4% מהחיפושים בספטמבר.</b> שלוש הקבוצות תרמו 1,209 מתוך 2,660 החיפושים שנוספו לעומת אוגוסט, כ־45.5% מהגידול הכולל.')+
h('Venu בולט גם בין המשפחות הגדולות')+
p('המשפחה עלתה מ־517 ל־869 חיפושים, צמיחה של 68.1%. חלקה בביקוש עלה מ־8.48% ל־9.93%, תוספת של 1.45 נקודות אחוז. מומלץ לפצל את תוכן Venu לבחירה במשפחה, בחירה בדגם והשוואה בין דגמים.')+
h('יש מקום גם לנושאים ממוקדים יותר')+
p('חיישנים ורצועות דופק עלו מ־99 ל־169 חיפושים. Lily עלתה מ־146 ל־239. נושאים אלה מתאימים לדפי הסבר ולתוכן שעוזר לבחור, לצד קידום של משפחות השעונים הגדולות.')+
note('המשפחות מסווגות לפי מילים בנוסח החיפוש, בקבוצות נפרדות. מספרים קצרים ללא שם משפחה כלולים בקבוצת ״Forerunner / מספר דגם״. הסיווג משמש למיפוי כוונות, ולא לאפיון אישי של הגולשים.'));
page('מה הוביל ליותר קליקים','04 | האינטראקציות עם תוצאות Semantix',
`<div class="stats three">${stat('4,931','קליקים בספטמבר','3,848 באוגוסט')}${stat('+28.1%','גידול במספר הקליקים','1,083 אירועים נוספים')}${stat('9.60%','מכלל קליקי המוצר באתר','7.01% באוגוסט')}</div>`+
table(['החיפוש שקושר לקליק','אוגוסט','ספטמבר','שינוי'],['venu 4','venu','fenix 8','lily','cirqa','265','965','marq'].map(t=>{const x=qm.get(t);return[esc(t),x.clicksAug.inject,x.clicksSep.inject,sign(change(x.clicksSep.inject,x.clicksAug.inject))]}))+
h('Venu 4: גם היקף חיפוש גבוה וגם פעילות בתוצאות')+
p('Venu 4 המדויק הגיע ל־214 חיפושים ול־218 קליקים על תוצאות Semantix, לעומת 129 חיפושים ו־155 קליקים באוגוסט. אלה ספירות אירועים: אפשר ללחוץ על יותר ממוצר אחד אחרי חיפוש, ולכן אין לחלק אותן כ״שיעור הקלקה״.')+
h('מוקדים מעניינים מעבר לראש הטבלה')+
p('Lily עלתה מ־65 ל־106 קליקים; 965 מ־24 ל־57; MARQ מ־26 ל־77. שני האחרונים הם מוקדים ממוקדים יותר מבחינת היקף החיפוש, ולכן מתאימים לבדיקת תוכן ייעודית לפני הרחבה משמעותית.')+
box('מה כדאי להמשיך','לשמור נראות ברורה לדגמים ולמשפחות שמשלבים ביקוש וקליקים: Venu, Fenix 8, Forerunner ו־Lily. לצד אלה, לבחון תוכן מקצועי וממוקד סביב 965 ו־MARQ.')+
note('הקליקים הם אירועים ממקור inject ברישומי האתר. השיוך בטבלה הוא לנוסח החיפוש שנרשם עם הקליק. חלק הקליקים בכלל האתר הוא תמהיל אינטראקציות, ולא CTR.'));
page('הזדמנויות לתוכן ולקהלים','05 | מה יכול להיות מעניין לחודש הבא',
table(['כיוון','אותות ביקוש','הצעת תוכן'],[
['בחירת שעון לנשים','נשים: 42 באוגוסט, 90 בספטמבר; שעון לנשים: 7 באוגוסט, 23 בספטמבר','מדריך בחירה לפי שימוש, גודל מועדף, עיצוב ותקציב'],
['השוואת דגמי ריצה','קבוצת 265 / 265S: מ־160 ל־285','265 לעומת 165 ולעומת 970 — למי מתאים כל דגם'],
['רצועות דופק','רצועת דופק: מ־53 ל־102','מתי לבחור רצועת דופק וכיצד לבדוק התאמה'],
['שעונים וצמידים לשגרה','Lily כמשפחה: מ־146 ל־239; צמיד: מ־32 ל־67','בחירה בין שעון לצמיד לפי צרכים'],
['תוכן לקהל ממוקד','MARQ המדויק: מ־19 ל־44; inreach: מ־7 ל־24','מדריך ייעודי או דיוור תוכן קטן לבדיקת עניין']])+
h('אותות מקבילים סביב Venu 3S ובחירת שעון לנשים')+
p('שלושת הנוסחים ״נשים״, ״שעון לנשים״ ו״שעון נשים״ עלו יחד מ־58 ל־123. במקביל, קבוצת Venu 3S עלתה מ־29 ל־117. שני האותות מצדיקים בדיקת תוכן לבחירת שעון; הם אינם מזהים את מגדר המחפשים או מוכיחים ששתי הקבוצות הן אותם גולשים.')+
h('הזדמנות לתוכן שמקרב להחלטה')+
p('285 חיפושים בנוסחי 265 / 265S, לצד 129 בנוסחי 165 ו־156 בנוסחי 970, מצביעים על בסיס עניין לכמה דגמים. מדריך השוואה יכול לתת לכל דגם מקום ברור ולעזור לגולש להתקדם מהתעניינות לבחירה.')+
box('רעיון שאפשר להוציא לפועל מהר','סדרת שלושה פריטי תוכן: ״איך בוחרים Venu?״, ״איזה Forerunner מתאים לכם?״ ו״מה כדאי לדעת לפני בחירת רצועת דופק?״. בכל פריט: הבדלים מאומתים, דגמים זמינים וקישור ישיר לבחירה.')+
note('ההשוואות בטבלה הן מספטמבר מול אוגוסט. קבוצות דגם מחברות רק נוסחים מוגדרים, ולא את כל החיפושים שעשויים להיות קשורים למוצר. עלייה מבסיס קטן היא אות לבדיקה, לא המלצה להרחבה אוטומטית.'));
page('ארבעה בריפים לשיווק','06 | מהנתון למסר, לערוץ ולדף הנחיתה',
`<div class="brief"><div class="tag">01 · VENU</div><h3>״איזה Venu מתאים לשגרה שלכם?״</h3><p><b>הנתון:</b> 869 חיפושים במשפחה, עלייה של 68.1%. קבוצת Venu 3S עלתה מ־29 ל־117.</p><p><b>הצעה:</b> לבדוק מודעות לדגם לצד תוכן בחירה במשפחה. להפריד מסר של Venu 3S ממסר של Venu 4, ולהפנות להשוואה או לדגמים המתאימים במלאי. קריאה לפעולה: ״בחרו את ה־Venu שלכם״.</p></div>`+
`<div class="brief"><div class="tag">02 · FORERUNNER</div><h3>״265, 165 או 970 — מתחילים במה שחשוב לכם״</h3><p><b>הנתון:</b> קבוצות הנוסחים של שלושת הדגמים הגיעו יחד ל־570 חיפושים, לעומת 341 באוגוסט.</p><p><b>הצעה:</b> סרטון השוואה קצר, מדריך באתר ודיוור תוכן. להתחיל בצורך ובפערים בין הדגמים לפי מפרט מאומת. קריאה לפעולה: ״להשוואת הדגמים״.</p></div>`+
`<div class="brief"><div class="tag">03 · בחירת שעון</div><h3>״השעון שמתאים לדרך שלכם״</h3><p><b>הנתון:</b> 123 חיפושים בקבוצת ״נשים / שעון לנשים / שעון נשים״, לעומת 58.</p><p><b>הצעה:</b> קריאייטיב ותוכן המדגישים אפשרויות בחירה לפי שימוש, נוחות, עיצוב ותקציב. להציג כמה אפשרויות ולהימנע מהנחת דגם אחת לכל הקהל. קריאה לפעולה: ״מצאו את ההתאמה שלכם״.</p></div>`+
`<div class="brief"><div class="tag">04 · רצועות דופק</div><h3>״רוצים להכיר את האפשרויות לאימון?״</h3><p><b>הנתון:</b> החיפוש ״רצועת דופק״ כמעט הוכפל: 53 ל־102.</p><p><b>הצעה:</b> מדריך שימוש והתאמה לדגם, עם קישור למוצרים רלוונטיים. אפשר לבדוק תוכן משלים לצד בחירת שעון, לפי תאימות מאומתת. קריאה לפעולה: ״למדריך רצועות הדופק״.</p></div>`+
note('המסרים הם הצעות לבדיקה, ולא תיאור של קמפיינים שכבר רצו. החיפוש באתר הוא בסיס לבריף; התאמת מילות מפתח לפרסום תיבחן גם בדוח מונחי החיפוש של Google Ads [1].'));
page('מה עוד מלמד החודש','07 | תזמון, שינוי בתמהיל ונושאים למעקב',
`<div class="stats three">${stat('3,006','חיפושים בעשרת הימים האחרונים','2,372 בעשרת הימים האחרונים באוגוסט')}${stat('+26.7%','גידול בסיום החודש','השוואת עשרה ימים מול עשרה ימים')}${stat('774','חיפושים ביום השיא','11 בספטמבר')}</div>`+
h('העניין נמשך גם לקראת סוף החודש')+
p('הממוצע בעשרת הימים האחרונים של ספטמבר היה 300.6 חיפושים ליום. גם ללא יום השיא, הממוצע ביתר החודש עומד על 275.2, כ־40% מעל ממוצע אוגוסט. כדאי לשמר נוכחות תוכן לאורך החודש, ולא להסתמך רק על פעילות ביום בודד.')+
h('בתוך Fenix: עניין גובר בדגם מסוים')+
table(['נוסח','אוגוסט','ספטמבר','שינוי'],[
['fenix — חיפוש כללי',146,110,'−24.7%'],['fenix 8',96,179,sign(change(179,96))],['כל משפחת Fenix בסיווג',720,1071,sign(change(1071,720))]])+
p('המשפחה גדלה, ובתוכה Fenix 8 התחזק בעוד הנוסח הכללי פחת. זהו נימוק לבדוק מודעות וכותרות שמזכירות את הדגם, לצד עמוד משפחה רחב למי שעדיין מתלבט.')+
h('להשאיר מקום לנושאים שעדיין מתגבשים')+
p('MARQ כמשפחה עלתה מ־24 ל־50 ו־Enduro מ־28 ל־55. אלה היקפים קטנים ביחס ל־Venu ול־Forerunner, ולכן מומלץ להתחיל מתוכן מקצועי או שילוב בדיוור. ב־Instinct 3 המדויק נרשמה ירידה מ־110 ל־99: כדאי לרענן את הבדיקה המסחרית לפי דגם, ולא להניח שצמיחת האתר מתחלקת שווה בין כולם.')+
box('בדיקה מול לוח השיווק','להצליב את 11.9 ואת סיום החודש עם תכנים, דיוורים ופעילויות קיימות. ההתאמה תעזור לייצר השערות להמשך; הדו״ח אינו מייחס את השיא לערוץ או לקמפיין מסוים.'));
page('סדר הפעולות המומלץ','08 | תוכנית שיווק ומסחר לחודש הקרוב',
table(['עדיפות','פעולה','למה עכשיו','איך לבחון'],[
['1','עמוד בחירה ומסר ייעודי ל־Venu','869 חיפושים; 68.1% צמיחה','בחירת דגם, קליקים למוצר ונתוני קמפיין'],
['1','תוכן נפרד ל־Venu 3S','117 חיפושים בקבוצת הנוסחים, לעומת 29','פעילות בדף ובמוצרים שמוצגים בו'],
['2','מדריך השוואה ל־265 / 165 / 970','570 חיפושים משותפים בנוסחים שנבחרו','קריאת ההשוואה והתקדמות לדגם'],
['2','תוכן לבחירת שעון לנשים','123 חיפושים, לעומת 58','תגובה למסרים שונים ובחירת מוצרים'],
['3','מדריך רצועות דופק','102 בחיפוש המדויק, לעומת 53','קריאת התוכן ובחירת אביזר תואם'],
['מעקב','MARQ, Enduro ו־inReach','צמיחה מנושאים בעלי נפח קטן יותר','בדיקת עניין בתוכן לפני הרחבה']])+
h('הצעד הראשון לפגישת העבודה')+
p('לבחור שני נושאים להתחלה: Venu ו־השוואת Forerunner. לכל אחד להכין מסר אחד, עמוד יעד ותוצר תוכן קצר. לאחר מכן להשוות בין המסרים ובין קהלי הפעילות לפי המדדים הקיימים בערוץ, ולצרף לדו״ח החודש הבא את התוצאות.')+
box('המלצת המיקוד','לחבר את מה שהגולש מבקש למסלול קנייה ברור: שם הדגם במסר, הסבר קצר של ההבדלים ודגמים זמינים לבחירה. המטרה היא לנצל את הביקוש שגדל, בלי לפזר מאמץ על יותר מדי נושאים בו־זמנית.')+
`<div class="methods"><h3>מקורות והגדרות</h3><p>מקור המספרים: נתוני החיפוש והקליקים באתר Garmin, אוגוסט וספטמבר 2026. החודשים מוגדרים לפי שעון ישראל. הטבלאות משוות אירועים, ולא אנשים או רכישות. ״החזירו תוצאות״ מבוסס על רשומת החיפוש; קבוצות כוונה מסווגות לפי מילים. בקבוצות הדגם נכללו נוסחי הדגם המספרי והכתיבים המוגדרים בעברית ובאנגלית. שיעור שינוי מחושב מול אוגוסט; ״עניין יחסי״ משווה חלק מכלל חיפושי כל חודש.</p><p>[1] <a href="https://support.google.com/google-ads/answer/2472708?hl=en">Google Ads — דוח מונחי החיפוש</a>: בסיס לבדיקה מול פעילות הפרסום בפועל. [2] <a href="https://www.garmin.co.il/product-category/garmin-venu/">קטגוריית Venu באתר Garmin ישראל</a>: נקודת פתיחה לבחירת עמודי יעד ודגמים זמינים, לפי מצב האתר בעת הקמפיין. נבדקו ב־24.10.2026.</p></div>`);
const css=`@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#e8eef2;color:#163043;font-family:Arial,sans-serif;font-size:11.2pt;line-height:1.55}a{color:#00758b}p{margin:9px 0}h1{font-size:26pt;line-height:1.18;color:#092d40;margin:16px 0 6px}h3{font-size:13.2pt;color:#007b8f;margin:17px 0 5px}.page{background:#fff;position:relative;width:210mm;min-height:297mm;margin:14px auto;padding:16mm 17mm 19mm;break-after:page}.page:last-child{break-after:auto}.running{display:flex;justify-content:space-between;border-bottom:2px solid #00a0b2;padding-bottom:9px;font-size:8.7pt;font-weight:bold;color:#68818f;letter-spacing:.5px}.kicker{font-size:10pt;color:#708592;margin-bottom:19px}.hero{font-size:30pt;line-height:1.3;font-weight:700;margin:24px 0 19px}.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:11px;margin:17px 0}.three{grid-template-columns:repeat(3,1fr)}.stat{background:#eff7f7;border-top:3px solid #009caa;padding:12px 13px}.stat b{display:block;font-size:27pt;line-height:1.15;text-align:right;color:#0c354a}.stat span{display:block;font-size:10pt;margin-top:6px;font-weight:bold}.stat small{display:block;font-size:8.3pt;color:#617d8b;margin-top:5px;line-height:1.4}.three .stat b{font-size:24pt}.three .stat span{font-size:9.3pt}aside{background:#eaf7f5;border-right:4px solid #008c9b;padding:12px 15px;margin:16px 0}aside p{margin:5px 0 0}table{width:100%;border-collapse:collapse;font-size:10pt;line-height:1.4;margin:14px 0 16px}th{background:#0e3a4e;color:#fff;text-align:right;padding:9px 8px}td{border-bottom:1px solid #dce7eb;padding:9px 8px;vertical-align:top}td:first-child{font-weight:bold}tr:nth-child(even)td{background:#f2f7f9}tr{break-inside:avoid}.up{color:#007a66;font-weight:bold;white-space:nowrap}.note{font-size:8.6pt;line-height:1.45;color:#647d8a}.scope{font-size:9pt;border-top:1px solid #d9e4e9;padding-top:12px;margin-top:17px;color:#657f8e}.bars{margin:20px 0}.barrow{display:grid;grid-template-columns:145px 1fr 48px 64px;gap:10px;align-items:center;margin:13px 0;font-size:10pt}.barrow label{font-weight:bold}.track{height:16px;background:#e8eef1}.track i{height:100%;background:#078f9f;display:block}.barrow b{direction:ltr;text-align:left}.barrow em{font-style:normal;color:#00816d;font-size:9.5pt}.brief{border-bottom:1px solid #dce6eb;padding:9px 0 12px;break-inside:avoid}.brief:last-of-type{border-bottom:none}.brief h3{margin-top:4px}.brief p{margin:6px 0;font-size:10.6pt}.tag{font-size:8pt;font-weight:bold;color:#8396a0}.methods{font-size:8.2pt;line-height:1.45;color:#6c818b;margin-top:15px}.methods h3{font-size:10pt}.methods p{margin:6px 0}footer{position:absolute;bottom:9mm;right:17mm;left:17mm;display:flex;justify-content:space-between;border-top:1px solid #d8e4e9;padding-top:6px;font-size:8pt;color:#768c97}@media print{body{background:#fff}.page{margin:0}}`;
const html=`<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>Garmin | תובנות עסקיות ושיווקיות | ספטמבר 2026</title><style>${css}</style></head><body>${pages.map((x,i)=>`<section class="page"><header class="running"><span dir="ltr">GARMIN × SEMANTIX</span><span>תובנות עסקיות ושיווקיות | ספטמבר 2026</span></header><h1>${x.title}</h1><div class="kicker">${x.kicker}</div><main>${x.content}</main><footer><span>ספטמבר מול אוגוסט 2026</span><span dir="ltr">${i+1} / ${pages.length}</span></footer></section>`).join('')}</body></html>`;
await fs.writeFile(`${dir}/garmin-search-monthly-2026-09.html`,html);
console.log(JSON.stringify({pages:pages.length,edition:'business-marketing',html:`${dir}/garmin-search-monthly-2026-09.html`}));
