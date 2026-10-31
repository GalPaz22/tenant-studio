// Read-only analysis. Writes aggregate results only; no raw visitor/order IDs or messages.
// Run: node --env-file=.env scripts/beautics-concierge-analysis.mjs
import { MongoClient } from 'mongodb';
import { writeFile } from 'node:fs/promises';
import { parseTime, isPurchase, orderTotal } from '../core/dashboard/analytics/events.js';

const DAY = 86400000, GAP = 30 * 60000, now = Date.now();
const stamp = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(now);
const path = `reports/beautics-concierge-${stamp}.json`;
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 12000 });
const sid = r => String(r.session_id || r.sessionId || r.orderData?.session_id || '').trim();
const time = r => parseTime(r.timestamp) ?? parseTime(r.created_at) ?? parseTime(r.received_at) ?? r._id?.getTimestamp?.().getTime();
const pid = x => String(x ?? '').replace(/^woo_product_/, '');
const pct = (n, d) => d ? +(100 * n / d).toFixed(2) : null;
const date = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(t);
const counts = (rows, key) => [...Map.groupBy(rows, key)].map(([key, a]) => ({ key, n: a.length }));

try {
  await client.connect();
  const db = client.db('woo-beautics-shop-co-il');
  const common = { _id: 1, timestamp: 1, created_at: 1, received_at: 1, session_id: 1, sessionId: 1, source: 1, product_id: 1, event_type: 1 };
  // Explicit small projections exclude contact data, user agents, IPs and message contents.
  const [rawConvos, queries, clicks, carts, checkouts] = await Promise.all([
    db.collection('concierge_conversations').aggregate([{ $project: {
      _id: 1, conversation_id: 1, session_id: 1, created_at: 1, updated_at: 1, turns: 1, reason: 1,
      estimated_cost_usd: 1, feedback: 1,
      transcript: { $map: { input: { $ifNull: ['$transcript', []] }, as: 't', in: {
        at: '$$t.at', finished_at: '$$t.finished_at', opening: '$$t.opening', error: '$$t.error', stopped: '$$t.stopped',
        hasMessage: { $gt: [{ $strLenCP: { $ifNull: ['$$t.message', ''] } }, 0] },
        products: { $map: { input: { $ifNull: ['$$t.products', []] }, as: 'p', in: '$$p.product_id' } },
      } } },
    } }], { maxTimeMS: 30000 }).toArray(),
    db.collection('queries').find({}, { projection: { ...common, query: 1, zero_results: 1, isComplex: 1 } }).maxTimeMS(45000).toArray(),
    db.collection('product_clicks').find({}, { projection: common }).maxTimeMS(45000).toArray(),
    db.collection('cart').find({}, { projection: common }).maxTimeMS(45000).toArray(),
    db.collection('checkout_events').find({}, { projection: { ...common, order_id: 1, order_total: 1, cart_total: 1, total_price: 1, total: 1, currency: 1, status: 1, financial_status: 1, 'shopify_data.financial_status': 1, 'orderData.session_id': 1, 'orderData.total_price': 1, 'orderData.total': 1, 'orderData.currency': 1, 'items.product_id': 1, 'cart_items.product_id': 1, 'line_items.product_id': 1, 'products.product_id': 1 } }).maxTimeMS(45000).toArray(),
  ]);
  const convos = rawConvos.filter(r => /^vis-/.test(sid(r))).map(r => ({
    ...r, s: sid(r), t: time(r), engaged: (r.turns || 0) > 1 || r.transcript.some(t => t.hasMessage),
  })).filter(r => r.t <= now);
  const excluded = rawConvos.filter(r => !/^vis-/.test(sid(r)));
  const events = [], coverage = {};
  function add(rows, kind, filter = () => true) {
    const eligible = rows.filter(filter).filter(r => time(r) <= now);
    coverage[kind] = { records: eligible.length, withVisitorId: eligible.filter(r => /^vis-/.test(sid(r))).length };
    for (const r of eligible) {
      const s = sid(r), t = time(r);
      if (!/^vis-/.test(s) || !Number.isFinite(t)) continue;
      events.push({ kind, s, t, source: r.source, pid: pid(r.product_id), raw: r });
    }
  }
  add(queries, 'search'); add(clicks, 'click');
  // Successful server Woo hooks are used for cart conversion; browser intent is separate.
  add(carts, 'cart', r => (!r.event_type || r.event_type === 'add_to_cart') && r.source === 'woocommerce_add_to_cart');
  add(checkouts, 'checkout', r => r.event_type === 'checkout_initiated');
  const allPurchases = checkouts.filter(isPurchase).filter(r => time(r) <= now);
  const orderMap = new Map(), withoutOrderId = [];
  for (const r of allPurchases.sort((a, b) => time(a) - time(b))) {
    if (!r.order_id) { withoutOrderId.push(r); continue; }
    // Prefer a record with browser attribution when a duplicate lacks it.
    const k = String(r.order_id), old = orderMap.get(k);
    if (!old || (!sid(old) && sid(r))) orderMap.set(k, r);
  }
  const orders = [...orderMap.values()];
  add(orders, 'purchase');
  for (const c of convos) {
    events.push({ kind: 'concierge', s: c.s, t: c.t, c });
    for (const turn of c.transcript) {
      const t = parseTime(turn.at);
      if (t && t > c.t && t < now) events.push({ kind: 'turn', s: c.s, t, c });
    }
  }
  const byVisitor = Map.groupBy(events, e => e.s);
  for (const ev of byVisitor.values()) ev.sort((a, b) => a.t - b.t);
  function buildSessions(gap) {
    const sessions = [];
    for (const [s, ev] of byVisitor) {
      let current;
      for (const e of ev) {
        if (!current || e.t - current.last > gap) {
          current = { s, first: e.t, last: e.t, events: [] }; sessions.push(current);
        }
        current.events.push(e); current.last = e.t;
      }
    }
    return sessions;
  }
  const sessions = buildSessions(GAP);
  function summarize(selected, horizon = null) {
    const result = { visits: selected.length, visitors: new Set(selected.map(v => v.s)).size, conversations: 0, engagedVisits: 0,
      clickVisits: 0, cartVisits: 0, checkoutVisits: 0, purchaseVisits: 0, orders: 0, recordedGrossILS: 0,
      recommendationClickVisits: 0, recommendationCartVisits: 0, recommendationPurchaseVisits: 0 };
    const seenOrders = new Set();
    for (const v of selected) {
      const cx = v.events.filter(e => e.kind === 'concierge');
      const anchor = cx.length ? Math.min(...cx.map(e => e.t)) : v.events.find(e => e.kind === 'search')?.t;
      if (anchor == null) throw Error('Missing cohort anchor');
      result.conversations += cx.length;
      if (cx.some(e => e.c.engaged)) result.engagedVisits++;
      const post = (horizon ? byVisitor.get(v.s) : v.events).filter(e => e.t >= anchor && (!horizon || e.t - anchor <= horizon));
      const shownBefore = e => cx.flatMap(x => x.c.transcript.flatMap(t =>
        (parseTime(t.finished_at) ?? parseTime(t.at) ?? x.t) <= e.t ? t.products.map(pid) : []));
      for (const kind of ['click', 'cart', 'checkout', 'purchase']) {
        const reached = post.filter(e => e.kind === kind);
        if (reached.length) result[`${kind}Visits`]++;
        if (['click', 'cart', 'purchase'].includes(kind)) {
          const hit = reached.some(e => {
            const recommended = new Set(shownBefore(e));
            const products = kind === 'purchase' ? (e.raw.items ?? e.raw.cart_items ?? e.raw.line_items ?? e.raw.products ?? []).map(i => pid(i.product_id)) : [e.pid];
            return products.some(p => p && recommended.has(p));
          });
          if (hit) result[`recommendation${kind[0].toUpperCase()}${kind.slice(1)}Visits`]++;
        }
      }
      for (const e of post.filter(e => e.kind === 'purchase')) {
        const id = String(e.raw.order_id);
        if (seenOrders.has(id)) continue; seenOrders.add(id); result.orders++;
        if (e.raw.currency === 'ILS' && orderTotal(e.raw) != null) result.recordedGrossILS += orderTotal(e.raw);
      }
    }
    result.recordedGrossILS = +result.recordedGrossILS.toFixed(2);
    for (const kind of ['click', 'cart', 'checkout', 'purchase']) result[`${kind}RatePct`] = pct(result[`${kind}Visits`], result.visits);
    return result;
  }
  const firstCx = v => v.events.find(e => e.kind === 'concierge');
  const firstSearch = v => v.events.find(e => e.kind === 'search');
  const windows = [];
  for (const days of [7, 28, 30, null]) {
    const from = days ? now - days * DAY : Math.min(...convos.map(c => c.t));
    const cx = sessions.filter(v => firstCx(v)?.t >= from);
    const mature = cx.filter(v => v.events.find(e => e.kind === 'concierge').t <= now - DAY);
    const searchWithout = sessions.filter(v => !v.events.some(e => e.kind === 'concierge' || e.kind === 'turn') && firstSearch(v)?.t >= from);
    const sameWindowOrders = orders.filter(r => time(r) >= from);
    const filteredConvos = convos.filter(c => c.t >= from);
    const visitorAnchors = [...Map.groupBy(cx, v => v.s).values()].map(a => a.sort((a, b) => a.first - b.first)[0]);
    windows.push({ days, from: new Date(from), to: new Date(now), conversations: filteredConvos.length,
      conversationsWithTranscript: filteredConvos.filter(c => c.transcript.length).length,
      withConcierge: summarize(cx), mature24hWithConcierge: summarize(mature, DAY), pending24h: cx.length - mature.length,
      uniqueVisitors24h: summarize(visitorAnchors.filter(v => v.events.find(e => e.kind === 'concierge').t <= now - DAY), DAY),
      searchesWithoutConcierge: summarize(searchWithout),
      mature24hSearchesWithoutConcierge: summarize(searchWithout.filter(v => firstSearch(v).t <= now - DAY), DAY),
      preExistingCommerce: {
        visitsWithCartBeforeConcierge: cx.filter(v => v.events.some(e => e.kind === 'cart' && e.t < firstCx(v).t)).length,
        visitsWithCheckoutBeforeConcierge: cx.filter(v => v.events.some(e => e.kind === 'checkout' && e.t < firstCx(v).t)).length,
        convertedVisitsWithCartBeforeConcierge: cx.filter(v => v.events.some(e => e.kind === 'purchase' && e.t >= firstCx(v).t) && v.events.some(e => e.kind === 'cart' && e.t < firstCx(v).t)).length,
        convertedVisitsWithCheckoutBeforeConcierge: cx.filter(v => v.events.some(e => e.kind === 'purchase' && e.t >= firstCx(v).t) && v.events.some(e => e.kind === 'checkout' && e.t < firstCx(v).t)).length,
      },
      matchedPurchaseSources: counts(cx.flatMap(v => v.events.filter(e => e.kind === 'purchase' && e.t >= firstCx(v).t)), e => e.source),
      byReason: [...Map.groupBy(filteredConvos, c => c.reason || 'unknown')].map(([reason, cc]) => {
        return { reason, conversations: cc.length, sameVisit: summarize(cx.filter(v => (firstCx(v).c.reason || 'unknown') === reason)) };
      }),
      engaged: summarize(cx.filter(v => v.events.some(e => e.kind === 'concierge' && e.c.engaged))),
      autoOnly: summarize(cx.filter(v => !v.events.some(e => e.kind === 'concierge' && e.c.engaged))),
      measurement: { purchases: sameWindowOrders.length, purchasesWithVisitor: sameWindowOrders.filter(r => /^vis-/.test(sid(r))).length,
        serverPaidPurchases: sameWindowOrders.filter(r => r.source === 'woocommerce_order_completed').length,
        cartEvents: carts.filter(r => time(r) >= from).length,
        successfulServerCartEvents: carts.filter(r => time(r) >= from && r.source === 'woocommerce_add_to_cart').length,
        purchasesWithoutOrderId: withoutOrderId.filter(r => time(r) >= from).length,
        searchVisitorIdPct: pct(queries.filter(r => time(r) >= from && /^vis-/.test(sid(r))).length, queries.filter(r => time(r) >= from).length),
      },
    });
  }
  const daily = [...Map.groupBy(convos, c => date(c.t))].map(([day, cc]) => {
    const ids = new Set(cc.map(c => c.conversation_id));
    return { day, conversations: cc.length, ...summarize(sessions.filter(v => v.events.some(e => e.kind === 'concierge' && ids.has(e.c.conversation_id)))) };
  });
  // Sanity checks on the exported aggregate calculations.
  for (const w of windows) for (const r of [w.withConcierge, w.mature24hWithConcierge, w.searchesWithoutConcierge]) {
    for (const k of ['click', 'cart', 'checkout', 'purchase']) if (r[`${k}Visits`] > r.visits) throw Error('Invalid numerator');
  }
  for (const w of windows) {
    if (w.engaged.visits + w.autoOnly.visits !== w.withConcierge.visits) throw Error('Engagement partition mismatch');
    if (w.byReason.reduce((n, r) => n + r.sameVisit.visits, 0) !== w.withConcierge.visits) throw Error('Reason partition mismatch');
  }
  const sensitivity30days = [15, 30, 60].map(minutes => {
    const selected = buildSessions(minutes * 60000).filter(v => firstCx(v)?.t >= now - 30 * DAY);
    return { inactivityMinutes: minutes, ...summarize(selected) };
  });
  const result = { generatedAt: new Date(now), timezone: 'Asia/Jerusalem', dbName: db.databaseName,
    methodology: { identity: 'session_id is a persistent browser/visitor identifier, not a 30-minute session.',
      sessions: 'Reconstructed visits split at gaps >30 minutes in observed search/click/cart/checkout/purchase/conversation/recorded-turn events. No pageview stream, so these are approximate sessions.',
      conversion: 'Distinct reconstructed concierge visits with a later stage event / concierge visits. Stage events must occur at/after first concierge creation. Stages are measured independently, not a required sequential path.',
      mature24h: 'Only concierge visits at least 24h old; later commerce events from same browser within 24h. Returning visits included. Overlapping 24h windows can credit one buyer to more than one concierge visit; order revenue deduplicated within each summary.',
      carts: 'Only source=woocommerce_add_to_cart used for successful cart conversion; earlier periods lack this hook.',
      purchases: 'Completed recorded events with order_id, deduplicated by order_id; missing browser IDs unmatchable. Old thank-you-page events are not independently verified paid; since 2026-09-26 server hook uses is_paid().',
      engagement: 'turns>1 or transcript contains a shopper message; first auto-triggered response is not proof of active dialogue.',
      recommendation: 'Exact normalized product ID shown in a recorded transcript before a click/cart/order line; only recorded transcripts can support this.',
      baseline: 'Observed search visits with no concierge event; descriptive comparison subject to selection and incomplete tracking, not causal lift. Reasons stratified by the first concierge trigger per visit, so visit counts are mutually exclusive.',
      exclusions: 'Non-vis identities excluded as legacy, synthetic or unmatchable; vis-prefixed internal testing cannot be identified with certainty.',
      privacy: 'Aggregate output only. No customer contacts, raw browser IDs, order IDs or conversation text.' },
    inventory: { rawConversations: rawConvos.length, retainedConversations: convos.length, excludedConversations: excluded.length,
      exclusionsByPrefix: counts(excluded, r => sid(r).split('-')[0]),
      withTranscript: convos.filter(c => c.transcript.length).length,
      withFeedback: convos.filter(c => c.feedback?.length).length,
      uniqueVisitorIds: new Set(convos.map(c => c.s)).size,
      repeatVisitorIds: [...Map.groupBy(convos, c => c.s).values()].filter(a => a.length > 1).length,
      purchases: allPurchases.length, distinctOrdersWithId: orders.length, purchaseEventsWithoutOrderId: withoutOrderId.length,
      duplicateOrderEvents: allPurchases.length - withoutOrderId.length - orders.length, coverage },
    sensitivity30days, windows, daily };
  await writeFile(path, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ path, inventory: result.inventory, windows }, null, 2));
} finally { await client.close(); }
