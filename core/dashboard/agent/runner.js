import { ObjectId } from 'mongodb';
import { controlDb } from '../core/db.js';
import { getTenantByApiKey } from '../core/tenant.js';
import { runStudioTurn, saveStudioProposals } from './studio-client.js';

// Runs live in the Studio process. Mongo keeps history, per-store leases and
// cancellation across replicas; the model/tool execution is the real studioAgent.
const active = new Map(), feeds = new Map();
export function subscribeRun(id, listener) {
  const feed = feeds.get(id); if (!feed) return null;
  feed.listeners.add(listener);
  return { text: feed.text, step: feed.step, note: feed.note, provisional: feed.provisional, unsubscribe: () => feed.listeners.delete(listener) };
}
export async function stopAgentRun(id) {
  const db = await controlDb();
  const changed = await db.collection('agent_runs').updateOne({ _id: new ObjectId(id), status: { $in: ['queued', 'running'] } }, { $set: { cancelRequested: true } });
  active.get(id)?.abort();
  return changed.matchedCount === 1;
}
export async function startAgentRun(identity, opts = {}) {
  const tenant = typeof identity === 'object' && identity !== null ? identity : await getTenantByApiKey(identity);
  if (!tenant?.dbName) throw Error('Unknown store');
  const apiKey = tenant.apiKey;
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
  const controller = new AbortController(), feed = { text: '', step: null, note: '', provisional: false, listeners: new Set() };
  active.set(runId, controller); feeds.set(runId, feed);
  const emit = event => { for (const listener of feed.listeners) { try { listener(event); } catch {} } };
  const update = fields => runs.updateOne({ _id: id, dbName: tenant.dbName }, { $set: { ...fields, lastProgressAt: new Date() } });
  const done = (async () => {
    let pendingSteps = [], flushTimer = null, progressWrite = Promise.resolve(), progressError = null;
    let toolCalls = 0;
    const flushProgress = () => {
      clearTimeout(flushTimer); flushTimer = null;
      if (pendingSteps.length) {
        const batch = pendingSteps; pendingSteps = []; const count = toolCalls;
        progressWrite = progressWrite.then(() => runs.updateOne({ _id: id }, { $push: { steps: { $each: batch, $slice: -400 } }, $set: { lastProgressAt: new Date(), toolCalls: count } })).catch(error => { progressError = error; });
      }
      return progressWrite;
    };
    const timeout = setTimeout(() => controller.abort(), 10 * 60000);
    let checking = false;
    const cancellation = setInterval(async () => {
      if (checking) return; checking = true;
      try { if ((await runs.findOne({ _id: id }, { projection: { cancelRequested: 1 } }))?.cancelRequested) controller.abort(); }
      catch { controller.abort(); } finally { checking = false; }
    }, 2000);
    try {
      await update({ status: 'running' });
      const previous = await runs.find({ dbName: tenant.dbName, conversationId, _id: { $ne: id }, status: 'completed' }, { projection: { request: 1, summary: 1 } }).sort({ startedAt: -1 }).limit(8).toArray();
      if (controller.signal.aborted) throw Error('Stopped');
      const history = previous.reverse().flatMap(row => [{ role: 'user', text: String(row.request || '').slice(0, 2000) }, { role: 'assistant', text: String(row.summary || '').slice(0, 8000) }]);
      const message = [opts.query ? `בדיקת החיפוש ״${opts.query}״.` : '', opts.request || (opts.review ? 'סקור את ביצועי החיפוש והצע שיפורים מבוססים. הכן שינויים לאישור בלבד.' : 'בדוק את החיפוש לפי נתוני החנות.')].filter(Boolean).join(' ');
      const result = await runStudioTurn({ dbName: tenant.dbName, message, history, analyticsDays: opts.days || 30 }, controller.signal, async event => {
        if (controller.signal.aborted) throw Error('Stopped');
        if (event.type === 'answer_reset') { feed.text = ''; feed.provisional = false; emit({ type: 'reset' }); return; }
        if (event.type === 'answer_delta') {
          if (feed.text.length + event.delta.length > 12000) throw Error('תשובת הסטודיו ארוכה מדי');
          feed.text += event.delta; feed.provisional = true;
          emit({ type: 'text', delta: event.delta, provisional: true }); return;
        }
        const step = { id: String(event.id || new ObjectId()), at: new Date() };
        if (event.type === 'tool') { toolCalls++; feed.step = event.name; emit({ type: 'step', name: event.name }); Object.assign(step, { type: 'tool', name: event.name }); }
        else { Object.assign(step, { type: 'note', text: String(event.text || '').slice(0, 1500), ok: event.ok }); feed.note = step.text; emit({ type: 'note', text: step.text }); }
        pendingSteps.push(step);
        if (!flushTimer) flushTimer = setTimeout(flushProgress, 300);
      });
      await flushProgress(); if (progressError) throw progressError;
      if (controller.signal.aborted) throw Error('Stopped');
      const proposals = await saveStudioProposals(tenant, runId, result);
      feed.text = result.summary; feed.provisional = false; emit({ type: 'answer', text: result.summary });
      await update({ status: 'completed', endedAt: new Date(), summary: result.summary, proposals, toolCalls, reportMissing: result.analyticsStatus === 'unavailable', analyticsStatus: result.analyticsStatus, studioUsage: result.usage, studioModelCalls: result.modelCalls, timings: result.timings });
      return { runId, summary: result.summary };
    } catch (error) {
      await flushProgress();
      await update({ status: controller.signal.aborted ? 'stopped' : 'failed', endedAt: new Date(), error: controller.signal.aborted ? 'הריצה נעצרה' : error.message });
      return { runId, error: error.message };
    } finally {
      clearTimeout(flushTimer);
      clearTimeout(timeout); clearInterval(cancellation); emit({ type: 'done' }); feeds.delete(runId); active.delete(runId);
      await locks.deleteOne({ _id: tenant.dbName, owner: runId });
    }
  })();
  done.catch(error => console.error('[studio dashboard] run failed:', error.message));
  return { runId, conversationId, status: 'running', done };
}
