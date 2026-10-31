import { ObjectId } from "mongodb";
import { controlDb, ensureTenantRuleIndexes } from "../core/db.js";
import { getTenantByApiKey } from "../core/tenant.js";
import { publishActiveRules } from "./publisher.js";
export async function createRule(input) {
    const db = await controlDb();
    const doc = { ...input, status: "active", createdAt: new Date() };
    const res = await db.collection("rules").insertOne(doc);
    await ensureTenantRuleIndexes(input.dbName);
    await publishActiveRules(input.tenantApiKey);
    return { ...doc, _id: res.insertedId };
}
export async function listRules(filter = {}) {
    const db = await controlDb();
    const q = {};
    if (filter.tenantApiKey) {
        const tenant = await getTenantByApiKey(filter.tenantApiKey);
        if (tenant)
            q.dbName = tenant.dbName;
        else
            q.tenantApiKey = filter.tenantApiKey;
    }
    return db.collection("rules").find(q).sort({ createdAt: -1 }).limit(200).toArray();
}
export async function getRule(id) {
    const db = await controlDb();
    return db.collection("rules").findOne({ _id: new ObjectId(id) });
}
export async function setRuleStatus(id, status) {
    const rule = await getRule(id);
    if (!rule)
        throw new Error("Rule not found");
    const db = await controlDb();
    await db.collection("rules").updateOne({ _id: new ObjectId(id) }, { $set: { status }, $push: { history: { status, at: new Date() } } });
    await publishActiveRules(rule.tenantApiKey);
    return (await getRule(id));
}
export async function deleteRule(id) {
    const rule = await getRule(id);
    if (!rule)
        throw new Error("Rule not found");
    const db = await controlDb();
    await db.collection("rules").deleteOne({ _id: new ObjectId(id) });
    await publishActiveRules(rule.tenantApiKey);
}
/** Last-24h trigger count per rule, from the tenant-local rule_applications counter. */
export async function getRuleTriggerCounts(rule) {
    const { tenantDb } = await import("../core/db.js");
    const db = await tenantDb(rule.dbName);
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
    const docs = await db
        .collection("rule_applications")
        .find({ rule_id: String(rule._id), date: { $in: [today, yesterday] } })
        .toArray();
    return docs.reduce((s, d) => s + (d.count || 0), 0);
}
