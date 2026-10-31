import { DAY_MS } from '../analytics/events.js';
import { queryFunnel, storeFunnel, suspectedSynthetic, SessionTimeline, WINDOWS } from '../analytics/conversion.js';
import { measuredConversion } from '../analytics/measurement.js';
import { searchBusiness } from '../analytics/search-business.js';

export const SIGNALS = {
  zero_results: { title: 'אפס תוצאות', next: 'בדיקת מלאי, כתיב, מילים נרדפות וכיסוי האינדקס', weight: 1 },
  reformulated: { title: 'ניסוח מחדש', next: 'בדיקת הכוונה ותוצאות החיפוש בשני הניסוחים', weight: 0.8 },
  no_click: { title: 'תוצאות ללא פעולה', next: 'בדיקת רלוונטיות, סדר התוצאות והמידע המוצג', weight: 0.7 },
  click_no_cart: { title: 'קליקים ללא הוספה לעגלה', next: 'בדיקת התאמה, מחיר, מלאי ומידע במוצר', weight: 0.5 },
  cart_no_purchase: { title: 'עגלה ללא רכישה', next: 'בדיקת משלוח ותשלום לצד התאמת המוצרים', weight: 0.3 },
};

// Recorded behavior identifies an investigation, never a proven cause or lost revenue.
export function analyzeGrowth(events, { now = Date.now(), days = 7, limit = 50 } = {}) {
  const from = now - days * DAY_MS;
  const bounded = { ...events, queries: events.queries.filter(e => e.t >= from && e.t < now) };
  const raw = queryFunnel(bounded), synthetic = new Set(suspectedSynthetic(raw, new Set(bounded.queries.map(e => e.s).filter(Boolean)).size));
  const ev = { ...bounded, queries: bounded.queries.filter(e => !synthetic.has(e.q)) };
  // Only search cohorts with a full follow-up window enter conversion analysis.
  const first = new Map();
  for (const e of ev.queries) if (e.s && (!first.has(e.s) || first.get(e.s).t > e.t)) first.set(e.s, { t: e.t, arm: 'search' });
  const mature = new Set([...first].filter(([, a]) => a.t + DAY_MS <= now).map(([s]) => s));
  const cohort = { ...ev, queries: ev.queries.filter(e => mature.has(e.s) && e.t <= first.get(e.s).t + DAY_MS) };
  for (const kind of ['clicks', 'carts', 'checkouts', 'purchases']) cohort[kind] = ev[kind].filter(e => mature.has(e.s) && e.t >= first.get(e.s).t && e.t <= first.get(e.s).t + DAY_MS);
  // Keep quality checks on all original events: dropping missing session ids
  // from a cohort must never make broken tracking appear complete.
  const quality = measuredConversion(ev, storeFunnel(ev), []);
  const measured = measuredConversion(cohort, storeFunnel(cohort), queryFunnel(cohort));
  const reached = { click: 'clicked', cart: 'carted', checkout: 'checkout', purchase: 'purchased' };
  const rates = Object.fromEntries(Object.keys(reached).map(k => [k, quality.funnel.rates[k] === null || !mature.size ? null : measured.funnel.sessions[reached[k]] / mature.size]));
  const business = searchBusiness(ev, first, { now, keys: ['search'] });
  rates.purchase = business.arms[0]?.purchaseRate ?? null;
  const timeline = new SessionTimeline(cohort.queries), stages = new Map();
  const all = { click: new Set(), cart: new Set(), purchase: new Set(), engaged: new Set() };
  for (const [kind, rows] of [['click', cohort.clicks], ['cart', cohort.carts], ['purchase', cohort.purchases]]) for (const e of rows) {
    const q = e.q || timeline.preceding(e.s, e.t, WINDOWS[kind])?.q;
    if (!q || !timeline.searched(e.s, q, e.t, WINDOWS[kind])) continue;
    if (!stages.has(q)) stages.set(q, { click: new Set(), cart: new Set(), purchase: new Set(), engaged: new Set() });
    stages.get(q)[kind].add(e.s); stages.get(q).engaged.add(e.s); all[kind].add(e.s); all.engaged.add(e.s);
  }
  const intersection = (a, b) => [...a].filter(s => b.has(s)).length;
  const refined = new Map(), destinations = new Map();
  for (const [s, list] of new SessionTimeline(ev.queries).bySession) for (let i = 1; i < list.length; i++) {
    const a = list[i - 1], b = list[i];
    if (b.t - a.t <= 120000 && a.q !== b.q && !a.q.startsWith(b.q) && !b.q.startsWith(a.q)) {
      if (!refined.has(a.q)) refined.set(a.q, new Set()); refined.get(a.q).add(s);
      if (!destinations.has(a.q)) destinations.set(a.q, new Map());
      const next = destinations.get(a.q); if (!next.has(b.q)) next.set(b.q, new Set()); next.get(b.q).add(s);
    }
  }
  const matureRows = new Map(measured.rows.map(r => [r.query, r]));
  const opportunities = [];
  const searchComplete = ev.sources.queries?.status === 'ok' && !ev.sources.queries.truncated;
  for (const r of queryFunnel(ev).filter(r => r.searches > 0)) {
    const m = matureRows.get(r.query), signals = [];
    const add = (kind, affected, denominator) => { if (affected > 0) signals.push({ kind, ...SIGNALS[kind], affected, denominator }); };
    if (searchComplete && r.measuredSearches) add('zero_results', r.zeroSearches, r.measuredSearches);
    if (searchComplete) add('reformulated', refined.get(r.query)?.size || 0, r.searchSessions);
    const covered = r.searches && r.missingSession / r.searches <= 0.3;
    const metric = k => covered && quality.funnel.rates[k] !== null && m?.searchSessions ? m[k === 'purchase' ? 'purchaseSessions' : k + 'Sessions'] / m.searchSessions : null;
    const stage = stages.get(r.query) || { click: new Set(), cart: new Set(), purchase: new Set(), engaged: new Set() };
    if (m?.searchSessions >= 5 && metric('click') !== null && metric('cart') !== null && all.engaged.size && stage.engaged.size / m.searchSessions < all.engaged.size / mature.size * 0.5) add('no_click', m.searchSessions - stage.engaged.size, m.searchSessions);
    if (metric('cart') !== null && metric('click') !== null && stage.click.size >= 5 && all.click.size && intersection(stage.click, stage.cart) / stage.click.size < intersection(all.click, all.cart) / all.click.size * 0.5) add('click_no_cart', stage.click.size - intersection(stage.click, stage.cart), stage.click.size);
    if (metric('purchase') !== null && metric('cart') !== null && stage.cart.size >= 5 && all.cart.size && intersection(stage.cart, stage.purchase) / stage.cart.size < intersection(all.cart, all.purchase) / all.cart.size * 0.5) add('cart_no_purchase', stage.cart.size - intersection(stage.cart, stage.purchase), stage.cart.size);
    if (!signals.length) continue;
    const volume = r.searchSessions || r.searches;
    const confidence = !searchComplete || !covered || volume < 5 ? 'low' : volume < 30 ? 'medium' : 'high';
    const priorityScore = Math.round(Math.log2(1 + volume) * Math.max(...signals.map(s => s.weight * s.affected / Math.max(1, s.denominator))) * (confidence === 'high' ? 1 : confidence === 'medium' ? 0.7 : 0.3) * 100);
    opportunities.push({ query: r.query, searches: r.searches, sessions: r.searchSessions, matureSessions: m?.searchSessions || 0, signals, confidence, priorityScore,
      clickRate: metric('click'), cartRate: metric('cart'), purchaseRate: metric('purchase'), delivered: r.delivered,
      refinements: [...(destinations.get(r.query) || [])].map(([query, sessions]) => ({ query, sessions: sessions.size })).sort((a, b) => b.sessions - a.sessions).slice(0, 3),
      next: signals.reduce((a, b) => a.weight * a.affected / a.denominator >= b.weight * b.affected / b.denominator ? a : b).next });
  }
  opportunities.sort((a, b) => b.priorityScore - a.priorityScore || b.searches - a.searches || a.query.localeCompare(b.query));
  return { generatedAt: new Date(now), window: { from: new Date(from), to: new Date(now) }, days, objective: 'revenue_per_search_session',
    summary: { searches: ev.queries.length, sessions: first.size, matureSessions: mature.size, pendingSessions: first.size - mature.size, opportunities: opportunities.length, rates },
    business, opportunities: opportunities.slice(0, limit), totalOpportunities: opportunities.length, excludedSyntheticQueries: synthetic.size,
    coverage: { complete: searchComplete, sources: ev.sources },
    methodology: 'התעדוף משקלל נפח, שיעור כשל ואיכות ראיות; אינו תחזית הכנסה אבודה. ניסוח מחדש הוא סימן לבדיקה. שיעורי המרה כוללים ביקורים עם 24 שעות מעקב בלבד; נתונים חסרים אינם אפס. רמת הביטחון מתארת את היקף התצפיות, ולא ודאות בסיבת הכשל.' };
}
