const percent = v => v == null ? 'אין מדידה' : (v * 100).toLocaleString('he-IL', { maximumFractionDigits: 1 }) + '%';
const money = (v, currency) => v == null ? 'אין מדידה' : new Intl.NumberFormat('he-IL', { style: 'currency', currency }).format(v);
const date = v => v ? new Date(v).toLocaleString('he-IL') : 'טרם בוצעה';
const status = { pending: 'ממתינה לבדיקה', running: 'ניסוי פעיל', applied: 'שינוי פעיל', stopped: 'נעצרה', completed: 'הניסוי הסתיים', rejected: 'נדחתה', expired: 'פג תוקף' };
const actionNames = { reorder: 'שינוי סדר', demote: 'הנמכה', exclude: 'הסתרה', note: 'מידע מהמוצר', bundle: 'מוצרים משלימים' };

export async function renderSearchGrowth(root, { id, api, el, fill, toast, isCurrent, investigate }) {
  const base = '/projects/' + id + '/growth';
  let poll, revision = 0, expanded = false;
  const active = () => isCurrent() && root.isConnected;
  const schedule = (refresh, delay = 5000) => { clearTimeout(poll); poll = setTimeout(() => { if (active() && !root.closest('[hidden]')) refresh(); }, delay); };
  async function refresh() {
    const current = ++revision;
    let state, review;
    try { [state, review] = await Promise.all([api(base), api(base + '/review')]); }
    catch (e) { if (active()) fill(root, el('h3', {}, 'צמיחה מהחיפוש'), el('p', { class: 'meta' }, e.message), el('button', { type: 'button', onclick: refresh }, 'נסה שוב')); return; }
    if (!active() || current !== revision) return;
    const report = state.report, summary = report?.summary;
    const run = async (button, path, body = {}) => {
      button.disabled = true;
      try { const result = await api(base + path, body); if (result.message) toast(result.message); if (active()) await refresh(); }
      catch (e) { toast(e.message); } finally { if (button.isConnected) button.disabled = false; }
    };
    const button = (label, path, body, disabled = false) => { const b = el('button', { type: 'button', disabled, onclick: () => run(b, path, body) }, label); return b; };
    const proposals = review.proposals || [];
    fill(root,
      el('div', { class: 'growth-heading' }, el('div', {}, el('h3', {}, 'צמיחה מהחיפוש'), el('p', { class: 'meta' }, 'זיהוי הזדמנויות ← אבחון ותיקון ← ניסוי ← מדידת מכירות')),
        el('span', { class: 'growth-badge' }, state.enabled ? 'ניטור שעתי פעיל' : 'ניטור ידני')),
      el('div', { class: 'actions' }, button(state.status === 'scanning' ? 'הסריקה מתבצעת…' : 'סרוק את 7 הימים האחרונים', '/scan', {}, state.status === 'scanning'),
        button(state.enabled ? 'כבה ניטור שעתי' : 'הפעל ניטור שעתי', '/settings', { enabled: !state.enabled }),
        el('button', { type: 'button', onclick: refresh }, 'רענן')),
      el('p', { class: 'meta' }, 'סריקה אחרונה: ' + date(state.lastScannedAt) + (state.enabled ? ' · הבאה: ' + date(state.nextScanAt) : '')),
      state.error ? el('p', { class: 'error', role: 'status' }, state.error) : null,
      report ? el('div', {},
        el('p', { class: 'meta' }, date(report.window.from) + ' – ' + date(report.window.to)),
        el('div', { class: 'growth-kpis' },
          kpi('ביקורי חיפוש', summary.sessions.toLocaleString('he-IL')),
          kpi('המרה לרכישה', percent(summary.rates.purchase)),
          ...businessKpis(report.business?.arms?.[0]),
          ...(report.business?.arms?.[0]?.revenue?.length ? [] : [kpi('הכנסה לביקור חיפוש', 'אין מדידה'), kpi('שווי הזמנה', 'אין מדידה')]),
          kpi('הזדמנויות לבדיקה', summary.opportunities)),
        el('p', { class: 'meta' }, `${summary.matureSessions} ביקורים עם חלון מעקב מלא · ${summary.pendingSessions} ממתינים להשלמת 24 שעות`),
        report.business?.limitations.map(x => el('p', { class: 'meta' }, x)),
        !report.coverage.complete ? el('p', { class: 'error' }, 'נתוני החיפוש חלקיים. אין בסיס מלא לדירוג הזדמנויות.') : null,
        el('h4', {}, 'היכן כדאי לבדוק קודם'),
        el('p', { class: 'meta' }, report.methodology),
        report.opportunities.length ? report.opportunities.slice(0, expanded ? 50 : 5).map(o => el('article', { class: 'growth-opportunity' },
          el('div', { class: 'growth-heading' }, el('strong', {}, o.query), el('span', { class: 'growth-badge' }, 'היקף ראיות: ' + ({ low: 'קטן', medium: 'בינוני', high: 'גדול' }[o.confidence]))),
          el('p', { class: 'meta' }, `${o.searches} חיפושים · ${o.sessions} ביקורים · ציון תעדוף ${o.priorityScore}`),
          el('div', { class: 'growth-signals' }, o.signals.map(s => el('span', {}, `${s.title}: ${s.affected}/${s.denominator}`))),
          el('p', {}, o.next),
          o.refinements?.length ? el('p', { class: 'meta' }, 'ניסוחים שנחפשו בהמשך: ' + o.refinements.map(r => `${r.query} (${r.sessions} ביקורים)`).join(' · ')) : null,
          o.delivered.length ? el('p', { class: 'meta' }, 'תוצאות שנצפו: ' + o.delivered.join(' · ')) : null,
          el('p', { class: 'meta' }, `קליק ${percent(o.clickRate)} · עגלה ${percent(o.cartRate)} · רכישה ${percent(o.purchaseRate)}`),
          el('button', { type: 'button', onclick: () => investigate(o) }, 'העבר לאייג׳נט לאבחון ותיקון בטיוטה')))
          : el('p', { class: 'meta' }, !report.coverage.complete || !summary.searches ? 'אין מספיק נתוני חיפוש מלאים לזיהוי הזדמנויות בחלון הנוכחי.' : 'לא נמצאו סימנים מבוססים לכשל בחלון הנוכחי. אפשר להמשיך לנטר.'),
        report.opportunities.length > 5 ? el('button', { type: 'button', onclick: () => { expanded = !expanded; refresh(); } }, expanded ? 'הצג חמש עדיפויות ראשונות' : `הצג עוד ${report.opportunities.length - 5} הזדמנויות`) : null,
        report.totalOpportunities > Math.min(report.opportunities.length, expanded ? 50 : 5) ? el('p', { class: 'meta' }, `מוצגות ${Math.min(report.opportunities.length, expanded ? 50 : 5)} מתוך ${report.totalOpportunities} הזדמנויות לפי עדיפות.`) : null)
        : el('p', { class: 'meta' }, 'הרץ סריקה ראשונה כדי לראות כשלים והזדמנויות המבוססים על נתוני החנות. הניטור השעתי סורק נתונים ללא קריאות מודל.'),
      el('section', { class: 'growth-proposals' }, el('h4', {}, 'הצעות וניסויים'),
        el('p', { class: 'meta' }, 'הכן עד שלוש הצעות על בסיס חיפושי השבוע. הכנת הצעות אינה מפעילה שינוי בחנות. ניסוי A/B משווה את התיקון לחיפוש הקיים.'),
        button(review.report?.status === 'generating' ? 'ההצעות בהכנה…' : 'הכן הצעות תיקון לשבוע', '/review', {}, !review.canGenerate),
        review.report ? el('p', { class: review.report.status === 'failed' ? 'error' : 'meta' }, review.report.error || review.report.summary || 'מנתח את נתוני השבוע…') : null,
        proposals.map(p => el('article', { class: 'growth-opportunity' }, el('h4', {}, p.title),
          el('p', { class: 'meta' }, (status[p.status] || p.status) + ' · ' + (p.goal === 'basket_value' ? 'הגדלת שווי הזמנה' : 'שיפור המרה')),
          el('p', {}, p.rationale), el('p', {}, 'השערה לבדיקה: ' + p.hypothesis),
          el('p', { class: 'meta' }, 'חיפושים: ' + p.queries.join(' · ')),
          p.actions.map(a => el('p', { class: 'meta' }, (actionNames[a.type] || a.type) + ': ' + a.products.map(x => x.name).join(' · '))),
          p.evidence.map(e => el('p', { class: 'meta' }, `${e.query}: ${e.sessions} ביקורים · ${e.clicks} קליקים · ${e.carts} הוספות · ${e.purchases} רכישות רשומות`)),
          el('div', { class: 'actions' },
            p.status === 'pending' ? [button('הפעל ניסוי A/B בחנות', `/proposals/${p._id}/test`), button('דחה הצעה', `/proposals/${p._id}/reject`)] : null,
            ['running', 'applied'].includes(p.status) ? button('עצור שינוי בחנות', `/proposals/${p._id}/stop`) : null,
            p.experimentId ? monitorButton(p) : null),
          ['running', 'applied'].includes(p.status) && !p.published ? el('p', { class: 'error' }, 'הפרסום למנוע טרם אומת; אין להסיק שהשינוי מוצג ללקוחות.') : null,
          el('div', { 'data-monitor': String(p._id), 'aria-live': 'polite' })))));
    if (state.status === 'scanning' || review.report?.status === 'generating') schedule(refresh);
    else if (state.enabled) schedule(refresh, 60000);
    function kpi(label, value) { return el('div', { class: 'growth-kpi' }, el('span', {}, label), el('strong', {}, value)); }
    function businessKpis(arm) {
      return (arm?.revenue || []).flatMap(r => [kpi('הכנסה לביקור חיפוש · ' + r.currency, money(r.revenuePerSearchSession, r.currency)), kpi('שווי הזמנה · ' + r.currency, money(r.averageOrder, r.currency))]);
    }
    function monitorButton(p) {
      const b = el('button', { type: 'button', onclick: async () => {
        b.disabled = true;
        try {
          const data = await api(base + `/proposals/${p._id}/monitor`);
          if (!active()) return;
          const target = root.querySelector(`[data-monitor="${p._id}"]`);
          if (target) fill(target, [data.current, ...(data.history || [])].filter(Boolean).map(m => el('section', { class: 'growth-monitor' },
            el('h4', {}, m.mode === 'randomized' ? 'תוצאות ניסוי A/B' : 'מעקב לאחר הפעלה · ללא קבוצת ביקורת'),
            el('p', { class: 'meta' }, m.reason),
            m.business?.arms.map(a => el('div', {}, el('strong', {}, a.key === 'control' ? 'קבוצת ביקורת' : 'הגרסה החדשה'),
              el('p', { class: 'meta' }, `${a.sessions} ביקורים שנמדדו · ${a.pending} ממתינים · המרה ${percent(a.purchaseRate)}`), el('div', { class: 'growth-kpis' }, businessKpis(a)))),
            el('p', { class: 'meta' }, m.business?.comparison ? 'שינוי בהכנסה לביקור: ' + money(m.business.comparison.difference, m.business.comparison.currency) + ' · ' + ({ positive: 'אינדיקציה חיובית', negative: 'אינדיקציה שלילית', inconclusive: 'עדיין אין הכרעה' }[m.business.comparison.signal]) : 'עדיין אין השוואה כספית אמינה.'),
            el('p', { class: 'meta' }, 'זמן תגובת החיפוש אינו נמדד במעקב הזה. לפני החלה קבועה יש לבדוק אותו בבקרת המנוע ולוודא שההמרה אינה נפגעת.'),
            m.business?.limitations.map(x => el('p', { class: 'meta' }, x)),
            m.presentationRequired ? el('p', { class: 'meta' }, 'ביקורים שדיווחו תמיכה בתצוגת מוצרים משלימים: ' + m.arms.reduce((n, a) => n + a.presentationConfirmed, 0) + '. דיווח תמיכה אינו הוכחת הצגה.') : null,
            m.mode === 'randomized' && m.business?.comparison?.signal === 'positive' && m.business?.complete && guardrailsPass(m) && p.status === 'running'
              ? button('החל את הגרסה החדשה בחנות', `/proposals/${p._id}/promote`) : null)));
        } catch (e) { toast(e.message); } finally { b.disabled = false; }
      } }, 'הצג מדידת השפעה'); return b;
    }
  }
  await refresh();
}

function guardrailsPass(m) {
  const control = m.business.arms.find(a => a.key === 'control'), variant = m.business.arms.find(a => a.key === 'v1');
  return control?.purchaseRate != null && variant?.purchaseRate != null && variant.purchaseRate >= control.purchaseRate;
}
