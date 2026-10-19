import { ObjectId } from 'mongodb';
import { controlDb } from '../core/db.js';
import { getTenantByApiKey } from '../core/tenant.js';
import { buildConversionReport, reportDigest } from '../analytics/report.js';
import { runStudioTurn, saveStudioProposals } from './studio-client.js';

// Runs live in the Studio process. Mongo keeps history, per-store leases and
// cancellation across replicas; the model/tool execution is the real studioAgent.
const active = new Map(), feeds = new Map();
export function subscribeRun(id, listener) {
  const feed = feeds.get(id); if (!feed) return null;
  feed.listeners.add(listener);
  return { text: feed.text, step: feed.step, unsubscribe: () => feed.listeners.delete(listener) };
}
export async function stopAgentRun(id) {
  const db = await controlDb();
  const changed = await db.collection('agent_runs').updateOne({ _id: new ObjectId(id), status: { $in: ['queued', 'running'] } }, { $set: { cancelRequested: true } });
  active.get(id)?.abort();
  return changed.matchedCount === 1;
}
export async function startAgentRun(apiKey, opts = {}) {
  const tenant = await getTenantByApiKey(apiKey);
  if (!tenant) throw Error('Unknown store');
  const db = await controlDb(), locks = db.collection('agent_run_locks'), runs = db.collection('agent_runs');
  const id = new ObjectId(), runId = String(id), now = new Date();
  try {
    const lock = await locks.findOneAndUpdate({ _id: tenant.dbName, until: { $lt: now } }, { $set: { owner: runId, until: new Date(+now + 15 * 60000) } }, { upsert: true, returnDocument: 'after' });
    if (!lock) throw Error('Analysis already running for this store');
  } catch (error) { if (error.code === 11000) throw Error('Analysis already running for this store'); throw error; }
  let conversationId;
  try {
    await runs.updateMany({ dbName: tenant.dbName, status: { $in: ['queued', 'running'] }, lastProgressAt: { $lt: new Date(+now - 15 * 60000) } }, { $set: { status: 'failed', endedAt: now, error: 'הריצה הופסקה בעקבות הפעלה מחדש של השרת. אפשר לשלוח הודעה חדשה.' } });
    conversationId = typeof opts.conversationId === 'string' && ObjectId.isValid(opts.conversationId) && await runs.findOne({ dbName: tenant.dbName, conversationId: opts.conversationId }, { projection: { _id: 1 } }) ? opts.conversationId : runId;
    const request = opts.request?.trim() || (opts.query ? `בדיקת החיפוש ״${opts.query}״` : 'סקירה מלאה של החנות');
    await runs.insertOne({ _id: id, tenantApiKey: apiKey, dbName: tenant.dbName, conversationId, request, query: opts.query || null, engine: 'tenant-studio', model: 'tenant-studio', mode: opts.query ? 'query' : opts.review ? 'review' : 'ask', trigger: 'manual', startedAt: now, lastProgressAt: now, status: 'queued', steps: [], toolCalls: 0, proposals: 0 });
  } catch (error) { await locks.deleteOne({ _id: tenant.dbName, owner: runId }); throw error; }
  const controller = new AbortController(), feed = { text: '', step: null, listeners: new Set() };
  active.set(runId, controller); feeds.set(runId, feed);
  const emit = event => { for (const listener of feed.listeners) { try { listener(event); } catch {} } };
  const update = fields => runs.updateOne({ _id: id, dbName: tenant.dbName }, { $set: { ...fields, lastProgressAt: new Date() } });
  const done = (async () => {
    const timeout = setTimeout(() => controller.abort(), 10 * 60000);
    let checking = false;
    const cancellation = setInterval(async () => {
      if (checking) return; checking = true;
      try { if ((await runs.findOne({ _id: id }, { projection: { cancelRequested: 1 } }))?.cancelRequested) controller.abort(); }
      catch { controller.abort(); } finally { checking = false; }
    }, 2000);
    try {
      await update({ status: 'running' });
      const [report, previous] = await Promise.all([
        buildConversionReport(tenant, { days: opts.days || 30, persist: false }).catch(() => null),
        runs.find({ dbName: tenant.dbName, conversationId, _id: { $ne: id }, status: 'completed' }).sort({ startedAt: -1 }).limit(8).toArray(),
      ]);
      if (controller.signal.aborted) throw Error('Stopped');
      const history = previous.reverse().flatMap(row => [{ role: 'user', text: String(row.request || '').slice(0, 2000) }, { role: 'assistant', text: String(row.summary || '').slice(0, 8000) }]);
      const message = [opts.query ? `בדיקת החיפוש ״${opts.query}״.` : '', opts.request || (opts.review ? 'סקור את ביצועי החיפוש והצע שיפורים מבוססים. הכן שינויים לאישור בלבד.' : 'בדוק את החיפוש לפי נתוני החנות.')].filter(Boolean).join(' ');
      let toolCalls = 0;
      const result = await runStudioTurn({ apiKey, message, history, analytics: report ? reportDigest(report) : null }, controller.signal, async event => {
        if (controller.signal.aborted) throw Error('Stopped');
        const step = { id: String(event.id || new ObjectId()), at: new Date() };
        if (event.type === 'tool') { toolCalls++; feed.step = event.name; emit({ type: 'step', name: event.name }); Object.assign(step, { type: 'tool', name: event.name }); }
        else Object.assign(step, { type: 'note', text: String(event.text || '').slice(0, 1500), ok: event.ok });
        await runs.updateOne({ _id: id }, { $push: { steps: { $each: [step], $slice: -400 } }, $set: { lastProgressAt: new Date(), toolCalls } });
      });
      if (controller.signal.aborted) throw Error('Stopped');
      const proposals = await saveStudioProposals(tenant, runId, result);
      feed.text = result.summary; emit({ type: 'text', delta: result.summary });
      await update({ status: 'completed', endedAt: new Date(), summary: result.summary, proposals, toolCalls, reportMissing: !report, studioUsage: result.usage, studioModelCalls: result.modelCalls });
      return { runId, summary: result.summary };
    } catch (error) {
      await update({ status: controller.signal.aborted ? 'stopped' : 'failed', endedAt: new Date(), error: controller.signal.aborted ? 'הריצה נעצרה' : error.message });
      return { runId, error: error.message };
    } finally {
      clearTimeout(timeout); clearInterval(cancellation); emit({ type: 'done' }); feeds.delete(runId); active.delete(runId);
      await locks.deleteOne({ _id: tenant.dbName, owner: runId });
    }
  })();
  done.catch(error => console.error('[studio dashboard] run failed:', error.message));
  return { runId, conversationId, status: 'running', done };
}
