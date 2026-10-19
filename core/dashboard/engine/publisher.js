import { controlDb, getRedis } from "../core/db.js";
import { siblingApiKeys } from "../core/tenant.js";
export const ACTIVE_KEY = (apiKey) => `experiments:active:${apiKey}`;
const ACTIVE_TTL_SECONDS = 120; // refreshed every 30s by cron; TTL bounds staleness if we die
export function toWire(exp) {
    return {
        id: String(exp._id),
        layer: exp.layer,
        targeting: exp.targeting,
        trafficPct: exp.trafficPct,
        arms: exp.arms.map((a) => ({ key: a.key, weight: a.weight, patch: a.patch ?? {} })),
    };
}
/**
 * Rewrites experiments:active:{apiKey} in Redis from Mongo truth — under every
 * apiKey of the tenant (a store may have separate search/tracking keys, and the
 * dashboard-server hook reads under the key the search request authenticated
 * with), with the running set unioned across those keys.
 */
export async function publishActiveExperiments(apiKey) {
    const redis = await getRedis();
    if (!redis) {
        console.warn("[publisher] Redis unavailable; hook will serve control");
        return;
    }
    const keys = await siblingApiKeys(apiKey);
    const db = await controlDb();
    const running = (await db
        .collection("experiments")
        .find({ tenantApiKey: { $in: keys }, status: "running" })
        .toArray());
    const payload = running.length > 0 ? JSON.stringify(running.map(toWire)) : null;
    for (const k of keys) {
        if (payload)
            await redis.set(ACTIVE_KEY(k), payload, { EX: ACTIVE_TTL_SECONDS });
        else
            await redis.del(ACTIVE_KEY(k));
    }
}
/** Cron target: refresh keys for every tenant with running experiments. */
export async function refreshAllActiveKeys() {
    const db = await controlDb();
    const apiKeys = await db.collection("experiments").distinct("tenantApiKey", { status: "running" });
    for (const apiKey of apiKeys) {
        try {
            await publishActiveExperiments(apiKey);
        }
        catch (e) {
            console.error(`[publisher] refresh failed for ${apiKey}:`, e.message);
        }
    }
}
