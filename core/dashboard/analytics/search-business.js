import { DAY_MS } from './events.js';
import { SessionTimeline, uniquePurchases, WINDOWS, storeFunnel, queryFunnel } from './conversion.js';
import { measuredConversion } from './measurement.js';

const round = n => Math.round(n * 100) / 100;
const validMoney = o => typeof o.total === 'number' && Number.isFinite(o.total) && o.total >= 0 && typeof o.currency === 'string' && /^[A-Z]{3}$/.test(o.currency);

// One assignment per session. Orders belong to one arm and one query, after
// exposure, with equal 24h follow-up. No raw assignments leave this function.
export function searchBusiness(events, assignments, { now = Date.now(), patterns = null, truncated = false, keys = null } = {}) {
  const timeline = new SessionTimeline(events.queries);
  const measured = measuredConversion(events, storeFunnel(events), queryFunnel(events));
  const complete = measured.funnel.rates.purchase !== null && !truncated;
  const orders = uniquePurchases(events.purchases).list;
  const currencies = [...new Set(orders.filter(validMoney).map(o => o.currency))].sort();
  const groups = new Map((keys || [...new Set([...assignments.values()].map(a => a.arm))]).map(key => [key, { key, sessions: 0, pending: 0, buyers: new Set(), orders: [], values: new Map() }]));
  for (const [s, a] of assignments) {
    const g = groups.get(a.arm); if (!g) continue;
    if (a.t + DAY_MS > now) { g.pending++; continue; }
    g.sessions++; g.values.set(s, 0);
  }
  for (const o of orders) {
    const a = assignments.get(o.s), g = a && groups.get(a.arm);
    if (!g?.values.has(o.s) || o.t < a.t || o.t > a.t + DAY_MS) continue;
    const q = o.q || timeline.preceding(o.s, o.t, WINDOWS.purchase)?.q;
    if (!q || patterns && !patterns.has(q) || !timeline.searched(o.s, q, o.t, WINDOWS.purchase)) continue;
    g.buyers.add(o.s); g.orders.push(o);
    if (validMoney(o)) g.values.set(o.s, g.values.get(o.s) + o.total);
  }
  const arms = [...groups.values()].map(g => {
    const missingAmounts = g.orders.filter(o => !validMoney(o)).length;
    const missingOrderIds = g.orders.filter(o => !o.orderId).length;
    const moneyComplete = complete && !missingAmounts && !missingOrderIds;
    const revenue = currencies.map(currency => {
      const rows = g.orders.filter(o => validMoney(o) && o.currency === currency);
      const amount = rows.reduce((sum, o) => sum + o.total, 0);
      return { currency, orders: rows.length, amount: moneyComplete ? round(amount) : null,
        averageOrder: moneyComplete && rows.length ? round(amount / rows.length) : null,
        revenuePerSearchSession: moneyComplete && currencies.length === 1 && g.sessions ? round(amount / g.sessions) : null };
    });
    const values = [...g.values.values()], mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    const variance = values.length > 1 ? values.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (values.length - 1) : null;
    return { key: g.key, sessions: g.sessions, pending: g.pending, orders: complete ? g.orders.length : null,
      purchaseRate: complete && g.sessions ? g.buyers.size / g.sessions : null, revenue, complete: moneyComplete,
      missingAmounts, missingOrderIds, _mean: mean, _variance: variance };
  });
  const control = arms.find(a => a.key === 'control'), variant = arms.find(a => a.key === 'v1');
  let comparison = null;
  if (control && variant && currencies.length === 1 && control.complete && variant.complete && control.sessions && variant.sessions) {
    const difference = variant._mean - control._mean;
    const standardError = control._variance === null || variant._variance === null ? null : Math.sqrt(control._variance / control.sessions + variant._variance / variant.sessions);
    const interval = standardError === null ? null : [difference - 1.984 * standardError, difference + 1.984 * standardError];
    const sufficient = control.sessions >= 100 && variant.sessions >= 100 && control.orders >= 20 && variant.orders >= 20;
    comparison = { currency: currencies[0], difference: round(difference), relativeLift: control._mean ? variant._mean / control._mean - 1 : null,
      interval, sufficient, signal: sufficient && interval?.[0] > 0 ? 'positive' : sufficient && interval?.[1] < 0 ? 'negative' : 'inconclusive',
      method: 'Approximate interval for independent session means, including zero revenue; heavy tails and repeated inspection limit inference. No automatic winner.' };
  }
  return { objective: 'revenue_per_search_session', complete: complete && arms.every(a => a.complete), currencies,
    arms: arms.map(({ _mean, _variance, ...a }) => a), comparison,
    limitations: [...(!complete ? ['אין כיסוי רכישות אמין; מדדים כספיים אינם זמינים.'] : []),
      ...(arms.some(a => a.missingAmounts || a.missingOrderIds) ? ['חסרים סכום, מטבע או מזהה הזמנה; המדדים הכספיים הוסתרו כדי למנוע ספירה חלקית.'] : []),
      ...(currencies.length > 1 ? ['נרשמו מספר מטבעות; מוצג שווי הזמנה לפי מטבע, ללא חיבור מטבעות או הכנסה לביקור.'] : []),
      'סכומי הזמנות כפי שנרשמו, לפני התאמת החזרים; שיוך לחיפוש אינו הוכחה לתוספת הכנסה. חלון המדידה הוא 24 שעות מהחשיפה הראשונה.'] };
}
