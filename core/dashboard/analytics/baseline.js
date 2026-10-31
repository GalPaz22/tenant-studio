import { SessionTimeline, uniquePurchases, WINDOWS } from "./conversion.js";
export function chosenProducts(ev) {
    const tl = new SessionTimeline(ev.queries), out = new Map();
    const add = (q, e, kind) => {
        const key = e.pid || e.name;
        if (!q || !key)
            return;
        if (!out.has(q))
            out.set(q, new Map());
        const m = out.get(q), row = m.get(key) ?? { pid: e.pid, name: e.name, url: e.url ?? "", clicks: 0, carts: 0, purchases: 0 };
        row[kind]++;
        if (!row.name && e.name)
            row.name = e.name;
        m.set(key, row);
    };
    for (const c of ev.clicks)
        add(c.q || tl.preceding(c.s, c.t, WINDOWS.click)?.q || "", c, "clicks");
    for (const c of ev.carts)
        add(c.q || tl.preceding(c.s, c.t, WINDOWS.cart)?.q || "", c, "carts");
    for (const o of uniquePurchases(ev.purchases).list) {
        const q = o.q || tl.preceding(o.s, o.t, WINDOWS.purchase)?.q || "";
        for (const i of o.items)
            add(q, i, "purchases");
    }
    return out;
}
const resolve = (t, catalog) => {
    const p = catalog?.match(t) ?? null;
    return { pid: t.pid, name: p?.name || t.name, clicks: t.clicks, carts: t.carts, purchases: t.purchases, inCatalog: !!p, available: !!p?.available, hidden: !!p?.hidden, catalogId: p?._id ?? null, stockStatus: p?.stockStatus ?? null };
};
/**
 * Share of chosen-product events whose product resolves to a catalog document.
 * When plugins log ids the catalog does not carry, an unmatched product is
 * "unknown", not "missing": gaps are then only claimed for products that are
 * in the catalog and unavailable.
 */
export function catalogMatchRate(chosen, catalog) {
    if (!catalog)
        return null;
    let matched = 0, total = 0;
    for (const m of chosen.values())
        for (const t of m.values()) {
            const w = t.clicks + t.carts + t.purchases;
            total += w;
            if (catalog.match(t))
                matched += w;
        }
    return total ? matched / total : null;
}
export function buildBaseline(ev, rows, catalog, { minSearches = 3, limit = 400 } = {}) {
    const chosen = chosenProducts(ev), out = [];
    const matchRate = catalogMatchRate(chosen, catalog), reliable = matchRate !== null && matchRate >= 0.9;
    const unavailable = (p) => (p.inCatalog ? !p.available : reliable);
    for (const r of rows) {
        const volume = Math.max(r.searches, r.clicks);
        if (volume < minSearches)
            continue;
        const tallies = [...(chosen.get(r.query)?.values() ?? [])];
        const totalClicks = tallies.reduce((s, t) => s + t.clicks, 0);
        const picked = tallies
            .filter(t => (t.carts > 0 || t.purchases > 0 || t.clicks >= 3) && (t.carts > 0 || t.purchases > 0 || !totalClicks || t.clicks / totalClicks >= 0.1))
            .sort((a, b) => b.purchases - a.purchases || b.carts - a.carts || b.clicks - a.clicks).slice(0, 8)
            .map(t => resolve(t, catalog));
        const production = picked.length ? "works" : (r.zeroRate ?? 0) >= 0.5 || (r.searches >= 5 && !totalClicks) ? "fails" : "unclear";
        const targets = catalog ? picked.filter(p => !unavailable(p)) : picked, gone = catalog ? picked.filter(unavailable) : [];
        out.push({
            query: r.query, searches: r.searches, zeroRate: r.zeroRate, clicks: r.clicks, carts: r.carts, purchases: r.purchases, production,
            status: production === "works" && !targets.length ? "gap" : production, targets, unavailable: gone, delivered: r.delivered,
        });
    }
    out.sort((a, b) => b.searches - a.searches || b.clicks - a.clicks);
    const weight = (f) => out.filter(f).reduce((s, q) => s + q.searches, 0);
    return {
        queries: out.slice(0, limit),
        catalogMatchRate: matchRate,
        summary: {
            queries: out.length, works: out.filter(q => q.status === "works").length, gaps: out.filter(q => q.status === "gap").length,
            fails: out.filter(q => q.status === "fails").length, unclear: out.filter(q => q.status === "unclear").length,
            searchesWorking: weight(q => q.status === "works"), searchesFailing: weight(q => q.status === "fails"), searchesInGaps: weight(q => q.status === "gap"),
            partialGaps: out.filter(q => q.status === "works" && q.unavailable.length).length,
        },
    };
}
