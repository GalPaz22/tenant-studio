import { ObjectId } from "mongodb";
import { controlDb } from "../../core/db.js";
import { getTenantByApiKey } from "../../core/tenant.js";
import { startAgentRun, stopAgentRun, subscribeRun } from "../../agent/runner.js";
/** Changes a run saved for review, so the chat can show them under the answer with approve/reject. */
async function withArtifacts(runs) {
    const ids = runs.map(r => String(r._id));
    const db = await controlDb();
    const [proposals, actions] = ids.length ? await Promise.all([
        db.collection("proposals").find({ agentRunId: { $in: ids } })
            .project({ agentRunId: 1, kind: 1, status: 1, hypothesis: 1, evidence: 1, boostChange: 1, visibilityChange: 1, studioChanges: 1, published: 1, "draftRule.name": 1, "draftRule.naturalLanguageText": 1, "draftRule.patch": 1, "draftExperiment.name": 1, appliedCount: 1, applyError: 1 }).toArray(),
        db.collection("optimization_actions").find({ agentRunId: { $in: ids }, kind: { $ne: "investigate" } })
            .project({ agentRunId: 1, kind: 1, status: 1, title: 1, rationale: 1, filter: 1, categories: 1, "selectedProducts._id": 1, "selectedProducts.name": 1, error: 1 }).toArray(),
    ]) : [[], []];
    return runs.map(r => ({ ...r, artifacts: [
            ...proposals.filter(p => p.agentRunId === String(r._id)),
            ...actions.filter(a => a.agentRunId === String(r._id)).map(a => ({ ...a, artifactType: "action" })),
        ] }));
}
export async function agentRoutes(app) {
    // Returns at once with a run id; progress is read from /agent/runs/:id.
    app.post("/agent/run", async (req, reply) => {
        const { tenant } = req.query;
        const { request, query, review, conversationId, days } = (req.body ?? {});
        if (!req.customerStore && !tenant)
            return reply.code(400).send({ error: "Store scope required" });
        if (days !== undefined && ![7, 30, 90].includes(days))
            return reply.code(400).send({ error: 'Invalid analytics window' });
        if (request !== undefined && (typeof request !== "string" || request.length > 2000))
            return reply.code(400).send({ error: "request must be text of at most 2000 characters" });
        if (query !== undefined && (typeof query !== "string" || !query.trim() || query.length > 200))
            return reply.code(400).send({ error: "query must be text of at most 200 characters" });
        try {
            const started = await startAgentRun(req.customerStore || tenant, { request, query, days, review: review === true, conversationId: typeof conversationId === "string" ? conversationId : undefined, trigger: "manual" });
            return { runId: started.runId, status: started.status, conversationId: started.conversationId };
        }
        catch (e) {
            const message = e.message;
            return reply.code(/already running/.test(message) ? 409 : /Unknown store/.test(message) ? 404 : 500).send({ error: message });
        }
    });
    app.get("/agent/runs", async (req) => {
        const { tenant } = req.query;
        const t = req.customerStore ?? (tenant ? await getTenantByApiKey(tenant) : null);
        const q = t ? { $or: [{ dbName: t.dbName }, ...(t.apiKey ? [{ tenantApiKey: t.apiKey }] : [])] } : tenant ? { tenantApiKey: tenant } : {};
        const runs = await (await controlDb()).collection("agent_runs").find(q).project({ steps: 0 }).sort({ startedAt: -1 }).limit(80).toArray();
        return withArtifacts(runs);
    });
    app.get("/agent/runs/:id", async (req, reply) => {
        const { id } = req.params;
        if (!ObjectId.isValid(id))
            return reply.code(400).send({ error: "invalid run id" });
        const run = await (await controlDb()).collection("agent_runs").findOne({ _id: new ObjectId(id) });
        return run ? (await withArtifacts([run]))[0] : reply.code(404).send({ error: "run not found" });
    });
    // Server-sent events with the answer as it is written; ends with "done" (immediately when the run is not live here).
    app.get("/agent/runs/:id/stream", async (req, reply) => {
        const { id } = req.params;
        if (!ObjectId.isValid(id))
            return reply.code(400).send({ error: "invalid run id" });
        reply.hijack();
        const res = reply.raw;
        res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" });
        const send = (e) => res.write(`data: ${JSON.stringify(e)}\n\n`);
        const sub = subscribeRun(id, e => { send(e); if (e.type === "done")
            close(); });
        const ping = setInterval(() => res.write(": ping\n\n"), 15_000);
        const close = () => { clearInterval(ping); sub?.unsubscribe(); if (!res.writableEnded)
            res.end(); };
        req.raw.on("close", close);
        if (!sub) {
            send({ type: "done" });
            close();
            return;
        }
        send({ type: "snapshot", text: sub.text, step: sub.step, note: sub.note, provisional: sub.provisional });
    });
    app.post("/agent/runs/:id/stop", async (req, reply) => {
        const { id } = req.params;
        if (!ObjectId.isValid(id))
            return reply.code(400).send({ error: "invalid run id" });
        if (await stopAgentRun(id))
            return { ok: true };
        return reply.code(409).send({ error: "This run is not running in this server process" });
    });
}
