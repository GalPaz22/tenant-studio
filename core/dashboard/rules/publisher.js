import { controlDb, getRedis } from "../core/db.js";
import { siblingApiKeys } from "../core/tenant.js";
export const ACTIVE_RULES_KEY = (apiKey) => `rules:active:${apiKey}`;
const ACTIVE_TTL_SECONDS = 120; // refreshed every 30s by cron; TTL bounds staleness if we die
function toWire(rule) {
    return { id: String(rule._id), condition: rule.condition, patch: rule.patch };
}
/**
 * Rewrites rules:active:{apiKey} in Redis from Mongo truth — under every apiKey
 * of the tenant (see publishActiveExperiments), unioned across those keys.
 */
export async function publishActiveRules(apiKey) {
    const redis = await getRedis();
    if (!redis) {
        console.warn("[rules publisher] Redis unavailable; hook will serve unmodified store");
        return;
    }
    const keys = await siblingApiKeys(apiKey);
    const db = await controlDb();
    const active = (await db
        .collection("rules")
        .find({ tenantApiKey: { $in: keys }, status: "active" })
        .toArray());
    const payload = active.length > 0 ? JSON.stringify(active.map(toWire)) : null;
    for (const k of keys) {
        if (payload)
            await redis.set(ACTIVE_RULES_KEY(k), payload, { EX: ACTIVE_TTL_SECONDS });
        else
            await redis.del(ACTIVE_RULES_KEY(k));
    }
}
/** Cron target: refresh keys for every tenant with active rules. */
export async function refreshAllActiveRuleKeys() {
    const db = await controlDb();
    const apiKeys = await db.collection("rules").distinct("tenantApiKey", { status: "active" });
    for (const apiKey of apiKeys) {
        try {
            await publishActiveRules(apiKey);
        }
        catch (e) {
            console.error(`[rules publisher] refresh failed for ${apiKey}:`, e.message);
        }
    }
}
