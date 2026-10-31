import { searchExperimentPublication } from './search-publication.js';
import { controlDb, getRedis } from "../core/db.js";
import { siblingApiKeys } from "../core/tenant.js";
export const ACTIVE_KEY = (apiKey) => `experiments:active:${apiKey}`;
const ACTIVE_TTL_SECONDS = 120; // refreshed every 30s by cron; TTL bounds staleness if we die
export function toWire(exp) {
    return {
        id: String(exp._id),
        layer: exp.layer,
        delivery: exp.delivery || 'randomized',
        expiresAt: exp.expiresAt || null,
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
    const redis=await getRedis();
    if(redis){try{return await publishRedisExperiments(apiKey,redis);}catch{/* The search server has its own authenticated connection. */}}
    return searchExperimentPublication(apiKey,{publish:true});
}
async function publishRedisExperiments(apiKey,redis) {
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
    return {available:true,published:true,mode:'studio-redis',experimentIds:running.map(exp=>String(exp._id))};
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

export async function experimentPublicationStatus(apiKey){
 const redis=await getRedis();if(redis){try{const wire=JSON.parse(await redis.get(ACTIVE_KEY(apiKey))||'[]');return {available:true,published:true,mode:'studio-redis',experimentIds:wire.map(e=>e.id)};}catch{}}
 return searchExperimentPublication(apiKey);
}
