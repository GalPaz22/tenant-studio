import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { ObjectId } from 'mongodb';
import { installCustomerDashboard, studioOperationTransport } from './core/customer-dashboard.mjs';
import { configureDashboardStorage } from './core/dashboard/core/db.js';
import { configureStudioTransport } from './core/dashboard/agent/studio-client.js';
import { startAgentRun } from './core/dashboard/agent/runner.js';

test('Studio dashboard authenticates independently, scopes object identities and never falls through to operator APIs', async () => {
  const before = process.env.STUDIO_CUSTOMER_API_TOKEN; process.env.STUDIO_CUSTOMER_API_TOKEN = 'fixture';
  const id = new ObjectId(), checks = [];
  const database = async () => ({ db: name => ({ command: async () => ({ ok: 1 }), collection: collection => ({
    find: filter => { checks.push({ name, collection, filter }); return { async toArray() { return [{ apiKey: 'a' }]; } }; },
    findOne: async filter => { checks.push({ name, collection, filter }); return null; },
  }) }) });
  const app = express(); app.use(express.json());
  const close = await installCustomerDashboard(app, { operations: {}, database, resolveTenant: async key => key === 'a' ? { dbName: 'own-store' } : null });
  app.use('/api', (_req, res) => res.json({ operator: true }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/customer-dashboard`;
  const read = (path, token = 'fixture') => fetch(base + path, { headers: token ? { 'X-Studio-Customer-Token': token } : {} });
  try {
    assert.equal((await read('/health', '')).status, 401);
    assert.equal((await read('/health', 'operator-token')).status, 401);
    assert.deepEqual(await (await read('/health')).json(), { ok: true, engine: 'tenant-studio' });
    assert.equal((await read('/agent/runs')).status, 401);
    assert.equal((await read('/agent/runs?tenant=foreign')).status, 401);
    assert.equal((await read(`/agent/runs/${id}?tenant=a&dbName=foreign`)).status, 404);
    assert.equal(checks.at(-1).name, 'control_plane');
    assert.deepEqual(checks.at(-1).filter.$or[0], { dbName: 'own-store' });
    assert.equal((await read('/projects?tenant=a')).status, 404);
  } finally { close(); await new Promise(resolve => server.close(resolve)); if (before === undefined) delete process.env.STUDIO_CUSTOMER_API_TOKEN; else process.env.STUDIO_CUSTOMER_API_TOKEN = before; }
});
test('in-process transport runs the actual customer operations and preserves streaming and approval errors', async () => {
  const seen = [];
  const invoke = studioOperationTransport({
    turn: async (req, res) => { seen.push(req.body); res.status(200).set({ 'content-type': 'application/x-ndjson' }); res.flushHeaders(); res.write(JSON.stringify({ type: 'note', text: 'קורא נתונים' }) + '\n'); res.end(JSON.stringify({ type: 'done', summary: 'תשובה מהסטודיו' }) + '\n'); },
    approve: async () => { throw Object.assign(Error('stale draft'), { status: 409 }); },
  });
  const result = await invoke('turn', { apiKey: 'own', message: 'שאלה' });
  assert.equal(result.status, 200); assert.equal(seen[0].apiKey, 'own');
  assert.equal((await result.text()).trim().split('\n').map(JSON.parse).at(-1).summary, 'תשובה מהסטודיו');
  const stale = await invoke('approve', {}); assert.equal(stale.status, 409); assert.deepEqual(await stale.json(), { error: 'stale draft' });
  await assert.rejects(invoke('operator-deploy', {}), /Unknown Studio operation/);
  await assert.rejects(invoke('turn', {}, AbortSignal.abort()), /נעצרה/);
});
test('Studio owns async customer history and leaves product requests pending for approval', async () => {
  const documents = [], proposals = [], writes = [];
  const productId = new ObjectId(); let sent;
  const cursor = rows => ({ project() { return this; }, sort() { return this; }, limit() { return this; }, maxTimeMS() { return this; }, async toArray() { return rows; } });
  const runs = {
    async insertOne(row) { documents.push(row); },
    async updateOne(filter, update) { const row = documents.find(row => String(row._id) === String(filter._id)); if (row) Object.assign(row, update.$set); return { matchedCount: row ? 1 : 0 }; },
    async updateMany() { return {}; },
    async findOne(filter) { return documents.find(row => String(row._id) === String(filter._id)); },
    find(filter) { assert.equal(filter.dbName, 'own-store'); return cursor([{ request: 'הודעה קודמת שלי', summary: 'תשובה קודמת' }]); },
  };
  const client = { db(name) { return { collection(collection) {
    if (name === 'users') return { async findOne() { return { apiKey: 'own', dbName: 'own-store' }; } };
    if (collection === 'agent_runs') return runs;
    if (collection === 'agent_run_locks') return { async findOneAndUpdate() { return { owner: 'fixture' }; }, async deleteOne() {} };
    if (collection === 'proposals') return { async insertOne(row) { proposals.push(row); return { insertedId: new ObjectId() }; } };
    if (name === 'own-store' && collection === 'products') return { find() { return cursor([{ _id: productId, name: 'ריף', boost: null, stockStatus: 'instock' }]); }, async updateMany() { writes.push('catalog'); } };
    throw Error('No report fixture');
  } }; } };
  configureDashboardStorage({ mongo: client, redis: null });
  configureStudioTransport(studioOperationTransport({ turn: async (req, res) => {
    sent = req.body; res.status(200).set({ 'content-type': 'application/x-ndjson' }); res.flushHeaders();
    res.end(JSON.stringify({ type: 'done', engine: 'tenant-studio', summary: 'הכנתי הצעה לאישור', actions: [{ kind: 'productBoost', term: 'ריף', level: 2, limit: 40 }], draft: null, modelCalls: 1, usage: [] }) + '\n');
  } }));
  try {
    const started = await startAgentRun('own', { request: 'קדם ריף', days: 30 });
    assert.equal(started.status, 'running'); await started.done;
    assert.equal(documents[0].status, 'completed'); assert.equal(documents[0].engine, 'tenant-studio');
    assert.equal(sent.apiKey, 'own'); assert.equal(sent.history[0].text, 'הודעה קודמת שלי');
    assert.equal(proposals[0].status, 'pending'); assert.equal(proposals[0].dbName, 'own-store');
    assert.equal(proposals[0].boostChange.products[0]._id, String(productId)); assert.deepEqual(writes, []);
  } finally { configureDashboardStorage(null); }
});
