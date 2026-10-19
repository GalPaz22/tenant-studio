import { ObjectId } from "mongodb";
import { tenantDb } from "../core/db.js";
/**
 * One normalized view of what a store's shoppers did, read from the tenant
 * collections dashboard-server and the storefront plugins write:
 *   queries          searches the server logged (query, session, deliveredProducts)
 *   product_clicks   product clicks (search_query when the click came from search)
 *   cart             add-to-cart events
 *   checkout_events  checkout_initiated / checkout_completed
 *
 * Tenants disagree on shapes, so everything is normalized here once:
 * timestamps arrive as BSON dates, ISO strings (with or without offset) and
 * unix seconds; sessions as session_id or sessionId; order totals as
 * order_total, cart_total, total_price or orderData.*; line items as items,
 * cart_items or products. Raw session ids never leave the analytics layer.
 */
export const DAY_MS = 86_400_000;
const BLANK_QUERIES = new Set(["", "direct", "unknown", "null", "undefined"]);
export const normalizeQuery = (v) => typeof v === "string" ? v.trim().replace(/\s+/g, " ").toLowerCase() : "";
/** Milliseconds since epoch for every timestamp shape tenants log, or null. */
export function parseTime(v) {
    if (v instanceof Date)
        return Number.isFinite(+v) ? +v : null;
    if (typeof v === "number" && Number.isFinite(v))
        return v < 1e12 ? v * 1000 : v;
    if (typeof v === "string" && v.trim()) {
        if (/^\d{9,13}$/.test(v.trim()))
            return parseTime(Number(v));
        const t = Date.parse(v);
        return Number.isFinite(t) ? t : null;
    }
    return null;
}
const eventTime = (r) => parseTime(r.timestamp) ?? parseTime(r.created_at) ?? parseTime(r.received_at);
const sessionOf = (r) => {
    const s = r.session_id ?? r.sessionId ?? r.orderData?.session_id;
    return typeof s === "string" && s.trim() ? s.trim() : typeof s === "number" ? String(s) : null;
};
const num = (v) => {
    const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : typeof v === "number" ? v : NaN;
    return Number.isFinite(n) ? n : null;
};
const searchQueryOf = (r) => {
    const q = normalizeQuery(r.search_query ?? r.normalized_query);
    return BLANK_QUERIES.has(q) ? "" : q;
};
/** A completed purchase, never a checkout that was only started. */
export function isPurchase(r) {
    if (r.event_type)
        return r.event_type === "checkout_completed";
    // Legacy order webhooks without event_type: an order id with line items is an order.
    if (!r.order_id)
        return false;
    const status = r.shopify_data?.financial_status ?? r.financial_status ?? r.status;
    if (typeof status === "string" && !["paid", "completed", "processing", "partially_refunded"].includes(status))
        return false;
    return Array.isArray(r.items) || Array.isArray(r.cart_items) || Array.isArray(r.line_items) || Array.isArray(r.products) || num(r.order_total ?? r.total_price) !== null;
}
/** Recorded order amount (gross, as logged), from whichever field the tenant's plugin writes. */
export function orderTotal(r) {
    return num(r.order_total) ?? num(r.orderData?.total_price) ?? num(r.orderData?.total) ?? num(r.total_price) ?? num(r.total) ?? num(r.cart_total);
}
const currencyOf = (r) => {
    const c = r.currency ?? r.orderData?.currency;
    return typeof c === "string" && /^[A-Z]{3}$/.test(c) ? c : null;
};
export function toQueryEvent(r) {
    const t = eventTime(r), q = normalizeQuery(r.query);
    if (t === null || !q)
        return null;
    const list = Array.isArray(r.deliveredProducts) ? r.deliveredProducts : null;
    const count = num(r._analyticsResultCount) ?? (list ? list.length : num(r.native_result_count ?? r.resultCount ?? r.resultsCount ?? r.totalResults));
    const zero = r.zero_results === true ? true : r.zero_results === false ? false : count === null ? null : count === 0;
    return { q, s: sessionOf(r), t, delivered: count, zero, names: list ? list.slice(0, 10).map((x) => String(typeof x === "object" && x ? x.name ?? "" : x)).filter(Boolean) : [] };
}
export function toProductEvent(r) {
    const t = eventTime(r);
    if (t === null)
        return null;
    return { q: searchQueryOf(r), s: sessionOf(r), t, pid: r.product_id == null ? "" : String(r.product_id), name: typeof r.product_name === "string" ? r.product_name : "", url: typeof r.product_url === "string" ? r.product_url : "" };
}
export function toPurchaseEvent(r) {
    const t = eventTime(r);
    if (t === null || !isPurchase(r))
        return null;
    const raw = r.items ?? r.cart_items ?? r.line_items ?? r.products ?? [];
    const items = (Array.isArray(raw) ? raw : []).map((i) => ({ pid: String(i?.product_id ?? i?.id ?? ""), name: String(i?.product_name ?? i?.name ?? i?.title ?? ""), qty: num(i?.quantity) ?? 1 })).filter((i) => i.pid || i.name);
    return { q: searchQueryOf(r), s: sessionOf(r), t, orderId: r.order_id == null ? null : String(r.order_id), total: orderTotal(r), currency: currencyOf(r), items };
}
// Keep normalized events only, with a small Mongo batch. Raw event documents and
// full search-result payloads must never accumulate beside Studio's model/runtime.
const MAX_ROWS = 120_000;
const PAD_MS = 2 * DAY_MS;
export const queryProjection = {
    query: 1, zero_results: 1, native_result_count: 1, resultCount: 1, resultsCount: 1, totalResults: 1,
    _analyticsResultCount: { $cond: [{ $isArray: '$deliveredProducts' }, { $size: '$deliveredProducts' }, null] },
    deliveredProducts: { $cond: [{ $isArray: '$deliveredProducts' }, { $map: {
        input: { $slice: ['$deliveredProducts', 10] }, as: 'product',
        in: { $convert: { input: { $cond: [{ $eq: [{ $type: '$$product' }, 'object'] }, '$$product.name', '$$product'] }, to: 'string', onError: '', onNull: '' } },
    } }, null] },
};
export async function loadStoreEvents(dbName, from, to, options = {}) {
    const db = options.db || await tenantDb(dbName), f = +from, t = +to;
    const maxRows = options.maxRows ?? MAX_ROWS, maxEvents = options.maxEvents ?? 120_000, maxBytes = options.maxBytes ?? 24 * 1024 * 1024;
    let retained = 0, retainedBytes = 0;
    const result = { dbName, from: f, to: t, queries: [], clicks: [], carts: [], checkouts: [], purchases: [], sources: {} };
    const names = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(row => row.name));
    const sources = [
        ['queries', queryProjection, row => [['queries', toQueryEvent(row)]]],
        ['product_clicks', { search_query: 1, normalized_query: 1, product_id: 1, product_name: 1, product_url: 1 }, row => [['clicks', toProductEvent(row)]]],
        ['cart', { event_type: 1, search_query: 1, normalized_query: 1, product_id: 1, product_name: 1, product_url: 1 }, row => !row.event_type || row.event_type === 'add_to_cart' ? [['carts', toProductEvent(row)]] : []],
        ['checkout_events', {
            event_type: 1, search_query: 1, normalized_query: 1, order_id: 1, order_total: 1, cart_total: 1, total_price: 1, total: 1, currency: 1, status: 1, financial_status: 1,
            'shopify_data.financial_status': 1, 'orderData.total_price': 1, 'orderData.total': 1, 'orderData.currency': 1, 'orderData.session_id': 1,
            'items.product_id': 1, 'items.product_name': 1, 'items.quantity': 1, 'cart_items.product_id': 1, 'cart_items.product_name': 1,
            'cart_items.quantity': 1, 'line_items.product_id': 1, 'line_items.name': 1, 'line_items.quantity': 1, 'products.product_id': 1, 'products.product_name': 1, 'products.quantity': 1,
        }, row => row.event_type === 'checkout_initiated' ? [['checkouts', { q: searchQueryOf(row), s: sessionOf(row), t: eventTime(row) ?? NaN }]] : [['purchases', toPurchaseEvent(row)]]],
    ];
    for (const [name, projection, normalize] of sources) {
        if (!names.has(name)) { result.sources[name] = { status: 'missing', rows: 0, truncated: false }; continue; }
        if (retained >= maxEvents || retainedBytes >= maxBytes) { result.sources[name] = { status: 'ok', rows: 0, truncated: true }; continue; }
        let cursor, rows = 0, truncated = false;
        // If a source fails, discard its partial events so it is never presented
        // as a complete measured zero. Earlier, complete sources remain intact.
        const lengths = Object.fromEntries(['queries', 'clicks', 'carts', 'checkouts', 'purchases'].map(key => [key, result[key].length]));
        const retainedBefore = retained, bytesBefore = retainedBytes;
        try {
            const latest = await db.collection(name).findOne({}, { sort: { _id: -1 }, projection: { _id: 1 } });
            const byId = latest?._id instanceof ObjectId ? { _id: { $gte: ObjectId.createFromTime(Math.floor((f - PAD_MS) / 1000)), $lt: ObjectId.createFromTime(Math.floor(Math.min(t + PAD_MS, Date.now() + DAY_MS) / 1000)) } } : {};
            cursor = db.collection(name).find(byId, { projection: { ...projection, timestamp: 1, created_at: 1, received_at: 1, session_id: 1, sessionId: 1 } })
                .sort({ _id: -1 }).limit(maxRows + 1).batchSize(200).maxTimeMS(45000);
            for await (const row of cursor) {
                if (++rows > maxRows) { truncated = true; break; }
                for (const [kind, event] of normalize(row)) {
                    if (!event || event.t < f || event.t >= t) continue;
                    const bytes = Buffer.byteLength(JSON.stringify(event));
                    if (retained >= maxEvents || retainedBytes + bytes > maxBytes) { truncated = true; break; }
                    result[kind].push(event); retained++; retainedBytes += bytes;
                }
                if (truncated) break;
            }
            result.sources[name] = { status: 'ok', rows: Math.min(rows, maxRows), truncated };
        } catch {
            for (const key of Object.keys(lengths)) result[key].length = lengths[key];
            retained = retainedBefore; retainedBytes = bytesBefore;
            result.sources[name] = { status: 'unavailable', rows: 0, truncated: false };
        } finally { await cursor?.close().catch(() => {}); }
    }
    return result;
}
