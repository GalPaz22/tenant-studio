import express from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { PassThrough, Readable } from 'node:stream';
import { ObjectId } from 'mongodb';
import { getMongo, getRedis, configureDashboardStorage } from './dashboard/core/db.js';
import { getTenantByApiKey, getTenantByDbName } from './dashboard/core/tenant.js';
import { configureStudioTransport } from './dashboard/agent/studio-client.js';
import { dashboardRoutes } from './dashboard/api/routes/dashboard.js';
import { productRoutes } from './dashboard/api/routes/products.js';
import { conciergeRoutes } from './dashboard/api/routes/concierge.js';
import { agentRoutes } from './dashboard/api/routes/agent.js';
import { proposalRoutes } from './dashboard/api/routes/proposals.js';
import { executeAction } from './dashboard/optimization/actions.js';
import { weeklyRoutes } from './dashboard/api/routes/weekly.js';
import { refreshAllActiveKeys } from './dashboard/engine/publisher.js';
import { expireWeeklyExperiments } from './dashboard/weekly/service.js';
import { tickGrowthMonitors } from './dashboard/growth/service.js';
import { refreshAllActiveRuleKeys } from './dashboard/rules/publisher.js';

// Invoke the same Studio operations in process. No optimizer service, loopback
// HTTP request, operator session or browser token is involved in model execution.
export function studioOperationTransport(operations) {
  return (operation, body, signal) => new Promise((resolve, reject) => {
    if (!['turn', 'approve'].includes(operation) || !operations?.[operation]) return reject(Error('Unknown Studio operation'));
    const output = new PassThrough(); let status = 200, headers = {}, sent = false;
    const respond = () => { if (!sent) { sent = true; resolve(new Response(Readable.toWeb(output), { status, headers })); } };
    output.status = code => { status = code; return output; };
    output.set = values => { Object.assign(headers, values); return output; };
    output.flushHeaders = respond;
    output.json = value => { headers['content-type'] = 'application/json'; respond(); output.end(JSON.stringify(value)); return output; };
    const abort = () => output.destroy(Object.assign(Error('הריצה נעצרה'), { name: 'AbortError' }));
    output.on('error', error => { if (!sent) reject(error); });
    output.once('close', () => signal?.removeEventListener('abort', abort));
    if (signal?.aborted) return abort();
    signal?.addEventListener('abort', abort, { once: true });
    Promise.resolve().then(() => operations[operation]({ body }, output)).catch(error => {
      if (output.destroyed) return;
      if (sent) { output.end(JSON.stringify({ type: 'error', message: error.message }) + '\n'); }
      else { status = error.status || 400; output.json({ error: error.message }); }
    });
  });
}

export async function installCustomerDashboard(app, { operations, storage, resolveTenant = getTenantByApiKey, resolveStore = getTenantByDbName, database = getMongo } = {}) {
  if (storage) configureDashboardStorage(storage);
  configureStudioTransport(studioOperationTransport(operations));
  const router = express.Router();
  router.use((req, res, next) => {
    const secret = process.env.STUDIO_CUSTOMER_API_TOKEN || '', supplied = req.get('X-Studio-Customer-Token') || '';
    if (!secret || !supplied || !timingSafeEqual(createHash('sha256').update(secret).digest(), createHash('sha256').update(supplied).digest())) return res.status(401).json({ error: 'Unauthorized' });
    next();
  });
  router.get('/health', async (_req, res) => {
    try { await (await database()).db('admin').command({ ping: 1 }); res.json({ ok: true, engine: 'tenant-studio' }); }
    catch { res.status(503).json({ ok: false, engine: 'tenant-studio' }); }
  });
  // Independently enforce store ownership, even when the caller has the service
  // token. Only the authenticated frontend supplies the user's stored dbName.
  // Retain tenant-key calls for older frontends during a rolling deployment.
  router.use(async (req, res, next) => {
    try {
      const byDbName = req.query.dbName !== undefined;
      const identity = byDbName ? req.query.dbName : req.query.tenant;
      if (typeof identity !== 'string' || !identity.trim()) return res.status(401).json({ error: 'נדרשת חנות מחוברת' });
      const store = await (byDbName ? resolveStore(identity) : resolveTenant(identity));
      if (!store?.dbName) return res.status(401).json({ error: 'החנות אינה מחוברת' });
      req.customerStore = store;
      // Legacy domain handlers may need a private key for search publication.
      // It is resolved on the server, never accepted alongside a dbName scope.
      req.query.tenant = store.apiKey;
      const parts = req.path.split('/').filter(Boolean);
      const id = parts[0] === 'concierge' ? null : parts.find(part => /^[a-f\d]{24}$/i.test(part));
      if (id) {
        const client = await database(), keys = await client.db('users').collection('users').find({ dbName: store.dbName }, { projection: { apiKey: 1 } }).toArray();
        const collection = parts[0] === 'agent' ? 'agent_runs' : parts[0] === 'optimization' ? 'optimization_actions' : parts[0];
        const owned = await client.db('control_plane').collection(collection).findOne({ _id: new ObjectId(id), $or: [{ dbName: store.dbName }, { 'draftExperiment.dbName': store.dbName }, { 'draftRule.dbName': store.dbName }, { tenantApiKey: { $in: keys.map(row => row.apiKey).filter(Boolean) } }] }, { projection: { _id: 1 } });
        if (!owned) return res.status(404).json({ error: 'הפריט לא נמצא בחנות שלך' });
      }
      next();
    } catch (error) { next(error); }
  });
  // Adapt existing deterministic dashboard domain handlers to Studio's Express
  // server; these modules own Mongo reads/writes and never start another server.
  const routes = Object.fromEntries(['get', 'post', 'put', 'delete'].map(method => [method, (path, handler) => router[method](path, async (req, res, next) => {
    let hijacked = false;
    req.raw = req;
    const reply = { raw: res, code(code) { res.status(code); return this; }, send(value) { res.json(value); return this; }, hijack() { hijacked = true; } };
    try { const result = await handler(req, reply); if (!hijacked && !res.headersSent) res.json(result ?? null); }
    catch (error) { next(error); }
  })]));
  for (const install of [dashboardRoutes, productRoutes, conciergeRoutes, agentRoutes, weeklyRoutes, proposalRoutes]) await install(routes);
  routes.post('/optimization/actions/:id/execute', async (req, reply) => {
    try { return await executeAction(req.params.id, req.customerStore.apiKey, req.body?.by); }
    catch (error) { return reply.code(409).send({ error: error.message }); }
  });
  routes.post('/optimization/actions/:id/dismiss', async (req, reply) => {
    const result = await (await database()).db('control_plane').collection('optimization_actions').updateOne({ _id: new ObjectId(req.params.id), dbName: req.customerStore.dbName, status: 'pending' }, { $set: { status: 'dismissed', reviewedBy: req.body?.by, reviewedAt: new Date() } });
    return result.matchedCount ? { ok: true } : reply.code(409).send({ error: 'ההצעה כבר נבדקה' });
  });
  router.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  router.use((error, _req, res, _next) => {
    if (res.headersSent) return res.end();
    const databaseError = /^Mongo/.test(error.name || '');
    if (databaseError) console.error('[studio dashboard] database request failed');
    res.status(databaseError ? 503 : error.status || 400).json({ error: databaseError ? 'לא ניתן לקרוא כרגע את נתוני החנות' : error.message });
  });
  app.use('/api/customer-dashboard', router);
  // Refresh saved rules and experiments, expire elapsed tests; never generate proposals or run a model.
  let refreshing = false;
  const timer = setInterval(async () => { if (refreshing) return; refreshing = true; try { await expireWeeklyExperiments(); await refreshAllActiveKeys(); if(await getRedis()) await refreshAllActiveRuleKeys(); } catch {} finally { refreshing = false; } }, 30000);
  timer.unref();
  const growthTimer = setInterval(() => tickGrowthMonitors().catch(() => console.error('[search growth] background scan failed')), 60000);
  growthTimer.unref();
  return () => { clearInterval(timer); clearInterval(growthTimer); };
}
