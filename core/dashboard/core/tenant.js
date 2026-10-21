import { coreUsersDb } from "./db.js";
export async function listTenants() {
    const db = await coreUsersDb();
    const docs = await db
        .collection("users")
        .find({ apiKey: { $exists: true }, dbName: { $exists: true } })
        .project({ apiKey: 1, dbName: 1, context: 1, "credentials.softCategories": 1, "credentials.softCategoriesBoosted": 1, "credentials.pinnedResults": 1 })
        .toArray();
    return docs.map((d) => ({
        apiKey: d.apiKey,
        dbName: d.dbName,
        context: d.context,
        softCategories: d.credentials?.softCategories,
        softCategoriesBoosted: d.credentials?.softCategoriesBoosted,
        pinnedResults: d.credentials?.pinnedResults,
    }));
}
/**
 * One entry per store (dbName) for pickers: a store can hold several user
 * docs/keys; the one with a platform (the store's own settings) represents it.
 */
export async function listStores() {
    const db = await coreUsersDb();
    const docs = await db.collection("users").find({ apiKey: { $exists: true, $ne: "" }, dbName: { $exists: true, $ne: "" } }).project({ apiKey: 1, dbName: 1, platform: 1 }).toArray();
    const byDb = new Map();
    for (const d of docs) {
        const cur = byDb.get(d.dbName);
        if (!cur || (!cur.platform && d.platform))
            byDb.set(d.dbName, d);
    }
    return [...byDb.values()].map(d => ({ apiKey: d.apiKey, dbName: d.dbName, platform: d.platform || null })).sort((a, b) => a.dbName.localeCompare(b.dbName));
}
/**
 * All user apiKeys that resolve to the same tenant dbName as the given key.
 * A store can have several user docs (e.g. separate search and tracking keys,
 * as manoVino does); dashboard-server's hook reads Redis under whichever key
 * the request authenticated with, so published state must exist under all of
 * them. Falls back to [apiKey] when the user doc is missing.
 */
export async function siblingApiKeys(apiKey) {
    const db = await coreUsersDb();
    const me = await db.collection("users").findOne({ apiKey }, { projection: { dbName: 1 } });
    if (!me?.dbName)
        return [apiKey];
    const docs = await db
        .collection("users")
        .find({ dbName: me.dbName, apiKey: { $exists: true } })
        .project({ apiKey: 1 })
        .toArray();
    const keys = new Set(docs.map((d) => d.apiKey).filter(Boolean));
    keys.add(apiKey);
    return [...keys];
}
const PROFILE_FIELDS = { _id: 0, name: 1, platform: 1, dbName: 1, wooSiteUrl: 1, shopifyDomain: 1, active: 1, syncMode: 1, context: 1, concierge: 1, semantix: 1,
    "credentials.showOutOfStock": 1, "credentials.categories": 1, "credentials.softCategories": 1, "credentials.softCategoriesBoosted": 1, "credentials.pinnedResults": 1 };
const strings = (v) => (Array.isArray(v) ? v.flat() : typeof v === "string" ? v.split(",") : []).filter((x) => typeof x === "string").map(s => s.trim()).filter(Boolean);
export async function storeProfile(dbName) {
    const db = await coreUsersDb();
    const docs = await db.collection("users").find({ dbName }, { projection: PROFILE_FIELDS }).limit(20).toArray();
    if (!docs.length)
        return null;
    const u = docs.find(d => d.platform) ?? docs[0], soft = strings(u.credentials?.softCategories);
    const boosted = u.credentials?.softCategoriesBoosted && typeof u.credentials.softCategoriesBoosted === "object" ? u.credentials.softCategoriesBoosted : {};
    return {
        dbName, name: u.name ?? null, platform: u.platform || null, site: u.wooSiteUrl ?? u.shopifyDomain ?? null, active: u.active !== false, syncMode: u.syncMode ?? null,
        context: typeof u.context === "string" ? u.context.slice(0, 800) : "", conciergeOn: u.concierge === true, showsOutOfStock: u.credentials?.showOutOfStock === true,
        semanticModule: u.semantix && typeof u.semantix === "object" ? { module: String(u.semantix.module ?? ""), enabled: u.semantix.enabled === true, percent: Number(u.semantix.percent ?? 100) } : null,
        categories: strings(u.credentials?.categories).slice(0, 40), softCategories: { count: soft.length, sample: soft.slice(0, 40) },
        softCategoriesBoosted: Object.fromEntries(Object.entries(boosted).filter(([, v]) => typeof v === "number").slice(0, 60)),
        pinnedResults: Array.isArray(u.credentials?.pinnedResults) ? u.credentials.pinnedResults.length : 0,
        apiKeys: docs.length,
    };
}
export async function getTenantByApiKey(apiKey) {
    const db = await coreUsersDb();
    const d = await db.collection("users").findOne({ apiKey }, { projection: { apiKey: 1, dbName: 1, context: 1, 'credentials.softCategories': 1, 'credentials.softCategoriesBoosted': 1, 'credentials.pinnedResults': 1 } });
    if (!d)
        return null;
    return {
        apiKey: d.apiKey,
        dbName: d.dbName,
        context: d.context,
        softCategories: d.credentials?.softCategories,
        softCategoriesBoosted: d.credentials?.softCategoriesBoosted,
        pinnedResults: d.credentials?.pinnedResults,
    };
}
