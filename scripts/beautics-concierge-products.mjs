// Read-only product-level reconciliation; exports no browser or order identifiers.
// Run: node --env-file=.env scripts/beautics-concierge-products.mjs
import { MongoClient } from 'mongodb';
import { writeFile } from 'node:fs/promises';
import { parseTime, isPurchase, orderTotal } from '../core/dashboard/analytics/events.js';

const NOW = Date.now(), DAY = 86400000, GAP = 1800000;
const stamp = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(NOW);
const stem = `reports/beautics-concierge-products-${stamp}`;
const sid = r => String(r.session_id || r.sessionId || '').trim();
const pid = v => String(v ?? '').replace(/^woo_product_/, '');
const time = r => parseTime(r.timestamp) ?? parseTime(r.created_at) ?? r._id?.getTimestamp?.().getTime();
const esc = s => String(s ?? '').replaceAll('|', '\\|').replace(/[\r\n]/g, ' ');
const dt = t => new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'short' }).format(new Date(t));
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 12000 });
try {
  await client.connect();
  const db = client.db('woo-beautics-shop-co-il');
  const conversations = await db.collection('concierge_conversations').find({ session_id: /^vis-/, 'transcript.0': { $exists: true } }, {
    projection: { session_id: 1, conversation_id: 1, created_at: 1, reason: 1, 'transcript.at': 1, 'transcript.finished_at': 1, 'transcript.products.product_id': 1, 'transcript.products.name': 1, 'transcript.products.url': 1 },
  }).sort({ created_at: 1 }).maxTimeMS(30000).toArray();
  const cc = conversations.filter(c => c.transcript.some(t => t.products?.length));
  const ids = [...new Set(cc.map(sid))];
  const common = { _id: 1, session_id: 1, sessionId: 1, timestamp: 1, created_at: 1, product_id: 1, product_name: 1, source: 1, event_type: 1 };
  const filter = { $or: [{ session_id: { $in: ids } }, { sessionId: { $in: ids } }] };
  const sources = [
    ['queries', { ...common }, 'search'],
    ['product_clicks', { ...common }, 'click'],
    ['cart', { ...common }, 'cart'],
    ['checkout_events', { ...common, order_id: 1, order_total: 1, currency: 1, 'items.product_id': 1, 'items.product_name': 1, 'items.quantity': 1, 'items.price': 1, 'cart_items.product_id': 1, 'cart_items.product_name': 1, 'line_items.product_id': 1, 'line_items.name': 1 }, 'commerce'],
  ];
  const loaded = await Promise.all(sources.map(async ([collection, projection, kind]) => ({ collection, kind,
    rows: await db.collection(collection).find(filter, { projection }).maxTimeMS(30000).toArray(),
  })));
  const events = [], seenOrders = new Set();
  for (const { rows, kind } of loaded) for (const r of rows.sort((a, b) => time(a) - time(b))) {
    let k = kind;
    if (kind === 'cart' && r.source !== 'woocommerce_add_to_cart') continue;
    if (kind === 'commerce') {
      if (isPurchase(r) && r.order_id) {
        if (seenOrders.has(String(r.order_id))) continue;
        seenOrders.add(String(r.order_id)); k = 'purchase';
      } else if (r.event_type === 'checkout_initiated') k = 'checkout';
      else continue;
    }
    if (time(r) > NOW) continue;
    events.push({ kind: k, s: sid(r), t: time(r), pid: pid(r.product_id), name: r.product_name || null, source: r.source, raw: r });
  }
  for (const c of conversations) {
    events.push({ kind: 'conversation', s: sid(c), t: time(c) });
    for (const t of c.transcript) {
      const at = parseTime(t.finished_at) ?? parseTime(t.at) ?? time(c);
      if (at <= NOW) events.push({ kind: 'recommendation', s: sid(c), t: at, c, products: t.products || [] });
    }
  }
  const byVisitor = Map.groupBy(events, e => e.s);
  for (const ev of byVisitor.values()) {
    ev.sort((a, b) => a.t - b.t);
    let last = -Infinity, session = 0;
    for (const e of ev) { if (e.t - last > GAP) session++; e.visit = session; last = e.t; }
  }
  const productGroups = new Map();
  const orderLabels = new Map(events.filter(e => e.kind === 'purchase').sort((a, b) => a.t - b.t).map((e, i) => [String(e.raw.order_id), `O${String(i + 1).padStart(2, '0')}`]));
  const reportRows = cc.map((c, i) => {
    const ev = byVisitor.get(sid(c));
    const recommendations = ev.filter(e => e.kind === 'recommendation' && e.c === c && e.products.length);
    const anchor = recommendations[0].t, firstVisit = recommendations[0].visit;
    const recProducts = new Map();
    for (const e of recommendations) for (const p of e.products) {
      const id = pid(p.product_id);
      if (!id) continue;
      if (!recProducts.has(id)) recProducts.set(id, { id, name: p.name || null, shownAt: e.t, visit: e.visit });
    }
    const after24h = ev.filter(e => e.t >= anchor && e.t < anchor + DAY && e.t <= NOW);
    const sameVisit = after24h.filter(e => e.visit === firstVisit);
    const products = [...recProducts.values()].map(p => {
      const later = after24h.filter(e => e.t >= p.shownAt);
      const click = later.filter(e => e.kind === 'click' && e.pid === p.id);
      const cart = later.filter(e => e.kind === 'cart' && e.pid === p.id);
      const purchased = later.filter(e => e.kind === 'purchase' && (e.raw.items ?? e.raw.cart_items ?? e.raw.line_items ?? []).some(item => pid(item.product_id) === p.id));
      const result = { productId: p.id, name: p.name, shownAt: new Date(p.shownAt), clickCount24h: click.length,
        successfulCartCount24h: cart.length, purchasedOrders24h: purchased.length,
        sameVisitClickCount: click.filter(e => e.visit === p.visit).length,
        sameVisitCartCount: cart.filter(e => e.visit === p.visit).length,
        sameVisitPurchasedOrders: purchased.filter(e => e.visit === p.visit).length,
        clickedAt: click.map(e => new Date(e.t)), cartedAt: cart.map(e => new Date(e.t)),
        alreadyInCartBeforeRecommendation24h: ev.some(e => e.kind === 'cart' && e.pid === p.id && e.t < p.shownAt && e.t > p.shownAt - DAY),
        clickSources: [...new Set(click.map(e => e.source))],
      };
      const g = productGroups.get(p.id) || { productId: p.id, name: p.name, recommendedConversations: 0, clickedConversations24h: 0, cartedConversations24h: 0, purchasedConversations24h: 0 };
      g.recommendedConversations++; if (click.length) g.clickedConversations24h++; if (cart.length) g.cartedConversations24h++; if (purchased.length) g.purchasedConversations24h++;
      productGroups.set(p.id, g);
      return result;
    });
    const purchases = after24h.filter(e => e.kind === 'purchase').map(e => ({ orderLabel: orderLabels.get(String(e.raw.order_id)), at: new Date(e.t), sameVisit: e.visit === firstVisit,
      orderGross: orderTotal(e.raw), currency: e.raw.currency,
      items: (e.raw.items ?? e.raw.cart_items ?? e.raw.line_items ?? []).map(item => ({ productId: pid(item.product_id), name: item.product_name || item.name || null, quantity: item.quantity ?? null,
        recommendedBeforePurchase: recProducts.has(pid(item.product_id)) && recProducts.get(pid(item.product_id)).shownAt <= e.t })),
    }));
    return { label: `C${String(i + 1).padStart(2, '0')}`, createdAt: c.created_at, firstRecommendationAt: new Date(anchor),
      reason: c.reason, mature24h: anchor <= NOW - DAY, availableFollowupHours: +Math.min(24, (NOW - anchor) / 3600000).toFixed(2),
      products, sameVisitAnyProduct: { click: sameVisit.some(e => e.kind === 'click'), cart: sameVisit.some(e => e.kind === 'cart'), purchase: sameVisit.some(e => e.kind === 'purchase') }, purchases24h: purchases };
  });
  const matchedRows = reportRows.filter(r => r.products.some(p => p.clickCount24h || p.successfulCartCount24h || p.purchasedOrders24h));
  const summary = { transcriptConversations: conversations.length, conversationsWithRecordedProducts: cc.length,
    matureProductConversations24h: reportRows.filter(r => r.mature24h).length,
    uniqueRecommendedProducts: productGroups.size,
    conversationsWithRecommendedProductClick24h: reportRows.filter(r => r.products.some(p => p.clickCount24h)).length,
    conversationsWithRecommendedProductCart24h: reportRows.filter(r => r.products.some(p => p.successfulCartCount24h)).length,
    conversationsWithRecommendedProductPurchase24h: reportRows.filter(r => r.products.some(p => p.purchasedOrders24h)).length,
    conversationsWithAnyPurchase24h: reportRows.filter(r => r.purchases24h.length).length,
    distinctOrdersAfterConversations24h: new Set(reportRows.flatMap(r => r.purchases24h.map(p => p.orderLabel))).size,
    purchasesWithLineItems: reportRows.flatMap(r => r.purchases24h).filter(p => p.items.length).length,
  };
  const output = { generatedAt: new Date(NOW), timezone: 'Asia/Jerusalem',
    methodology: { attribution: 'Exact product ID + same persistent browser ID + commerce timestamp after the recorded recommendation, within 24h. This is an association, not proof that the click originated on the concierge card.',
      origin: 'Concierge product cards use the general /product-click handler with source=ai_search. No conversation_id is stored by that handler. No historical feedback events exist.',
      followup: 'Recent conversations have less than 24h followup. No rate is inferred from incomplete followup.',
      deduplication: 'Orders deduplicated by order_id before matching. Same order can appear in multiple conversation rows when windows overlap; row totals must not be summed as distinct orders.',
      productTime: 'Product recommendation timestamp is transcript finished_at, falling back to turn at and then conversation creation.',
      privacy: 'Conversation labels are report-local; browser, order and real conversation IDs omitted.' },
    summary, products: [...productGroups.values()].sort((a, b) => b.clickedConversations24h - a.clickedConversations24h || b.recommendedConversations - a.recommendedConversations), conversations: reportRows };
  await writeFile(stem + '.json', JSON.stringify(output, null, 2) + '\n');
  let md = `# הצלבת המלצות הקונסיירז׳ מול קליקים ורכישות — ביוטיקס\n\nנכון ל־${dt(NOW)}, שעון ישראל. קריאה בלבד מנתוני החנות.\n\nנמצאו ${summary.transcriptConversations} שיחות עם תמליל, מתוכן ${cc.length} עם מוצרים מוצעים, החל מ־${dt(cc[0].created_at)}. ב־${summary.matureProductConversations24h} מהשיחות עם מוצרים כבר עברו 24 שעות מההמלצה.\n\nההתאמה דורשת אותו מזהה מוצר, אותו דפדפן, ופעולה אחרי ההמלצה ועד 24 שעות ממנה. אותו דפדפן יכול לחזור לביקור נוסף. התאמה לקליק אינה מוכיחה שהקליק היה בכרטיס הקונסיירז׳: הכרטיסים משתמשים באותו source כמו החיפוש הרגיל, ללא מזהה שיחה באירוע הקליק.\n\n| תוצאה | שיחות עם לפחות התאמה אחת |\n|---|---:|\n| קליק על מוצר שהומלץ | ${summary.conversationsWithRecommendedProductClick24h} |\n| הוספה מוצלחת של מוצר שהומלץ | ${summary.conversationsWithRecommendedProductCart24h} |\n| רכישה של מוצר שהומלץ | ${summary.conversationsWithRecommendedProductPurchase24h} |\n| רכישה כלשהי, גם של מוצרים אחרים | ${summary.conversationsWithAnyPurchase24h} |\n\nנמצאו **${summary.distinctOrdersAfterConversations24h} הזמנות שונות** אחרי השיחות. הספירה בטבלה היא לפי שיחות, ולכן שיחות שונות מאותו ביקור עשויות לחפוף. שיחות חדשות טרם השלימו חלון של 24 שעות. אין להשתמש בנתונים אלה כאומדן מלא לחודש.\n\n## המוצרים שנמצאה בהם פעולה אחרי המלצה\n\n| שיחה | הוצע בתאריך | מוצר | קליקים | הוספות מוצלחות לסל | רכישות | נוסף לסל גם לפני ההמלצה? |\n|---|---|---|---:|---:|---:|---|\n`;
  for (const r of matchedRows) for (const p of r.products.filter(p => p.clickCount24h || p.successfulCartCount24h || p.purchasedOrders24h))
    md += `| ${r.label} | ${dt(p.shownAt)} | ${esc(p.name)} (${p.productId}) | ${p.clickCount24h} | ${p.successfulCartCount24h} | ${p.purchasedOrders24h} | ${p.alreadyInCartBeforeRecommendation24h ? 'כן' : 'לא נמדדה הוספה קודמת'} |\n`;
  md += '\n## שיחות שאחריהן נמצאה רכישה: מה הוצע ומה נקנה\n\n';
  for (const r of reportRows.filter(r => r.purchases24h.length)) {
    md += `### ${r.label} — ${dt(r.firstRecommendationAt)}\n\nהוצע: ${r.products.map(p => esc(p.name)).join('; ')}.\n\n`;
    for (const p of r.purchases24h) md += `רכישה ${p.orderLabel} ב־${dt(p.at)} (${p.sameVisit ? 'אותו ביקור משוחזר' : 'ביקור מאוחר יותר בתוך 24 שעות'}), ${p.orderGross} ${p.currency}:\n\n${p.items.map(item => '- ' + esc(item.name) + ' — ' + (item.recommendedBeforePurchase ? '**תואם המלצה קודמת**' : 'לא תואם למוצרים שהוצעו בשיחה')).join('\n')}\n\n`;
  }
  md += '## כל השיחות עם רשימת מוצרים\n\n| שיחה | המלצה ראשונה | מוצרים שהוצעו | נרכשה הזמנה בתוך 24 שעות? | הושלם חלון 24 שעות? |\n|---|---|---|---|---|\n';
  for (const r of reportRows) md += `| ${r.label} | ${dt(r.firstRecommendationAt)} | ${r.products.map(p => esc(p.name)).join('; ')} | ${r.purchases24h.length ? 'כן' : 'לא נמצאה עד הבדיקה'} | ${r.mature24h ? 'כן' : 'לא'} |\n`;
  md += '\nפרטי המוצרים, חותמות הזמן, מקורות הקליקים וההתאמות זמינים בקובץ JSON הסמוך. מזהי מבקרים והזמנות הושמטו. הנתונים לא שונו.\n';
  await writeFile(stem + '.md', md);
  console.log(JSON.stringify({ files: [stem + '.md', stem + '.json'], summary,
    matches: matchedRows.map(r => ({ label: r.label, products: r.products.filter(p => p.clickCount24h || p.successfulCartCount24h || p.purchasedOrders24h) })),
    purchases: reportRows.filter(r => r.purchases24h.length).map(r => ({ label: r.label, recommended: r.products.map(p => p.name), purchases: r.purchases24h })),
  }, null, 2));
} finally { await client.close(); }
