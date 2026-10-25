import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { installCustomerDashboard } from './core/customer-dashboard.mjs';
import { configureDashboardStorage } from './core/dashboard/core/db.js';
import { customerTenant } from './core/customer-chat.mjs';

test('service-authenticated dashboards resolve dbName without a user or store API key', async () => {
  const before = process.env.STUDIO_CUSTOMER_API_TOKEN;
  process.env.STUDIO_CUSTOMER_API_TOKEN = 'db-scope-fixture';
  const reads = [];
  const account = { _id: 'account', dbName: 'keyless-store', platform: 'woocommerce', credentials: {} };
  const cursor = rows => ({ project() { return this; }, sort() { return this; }, skip() { return this; }, limit() { return this; }, maxTimeMS() { return this; }, async toArray() { return rows; } });
  const client = { db(name) { return { collection(collection) { return {
    async findOne(filter) {
      reads.push({ name, collection, filter });
      if (name === 'users') {
        assert.ok(!('apiKey' in filter), 'store identity must not query by an API key');
        return filter.dbName === account.dbName ? account : null;
      }
      assert.equal(filter.dbName, account.dbName);
      return null;
    },
    find(filter) {
      reads.push({ name, collection, filter });
      if (['users', 'control_plane'].includes(name)) assert.equal(filter.dbName || filter.$or?.[0]?.dbName, account.dbName);
      else assert.equal(name, account.dbName);
      return cursor(name === 'users' ? [account] : []);
    },
    async countDocuments() { assert.equal(name, account.dbName); return 0; },
  }; } }; } };
  const app = express(); app.use(express.json());
  const close = await installCustomerDashboard(app, { operations: {}, storage: { mongo: client, redis: null } });
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/customer-dashboard`;
  const read = (path, token = 'db-scope-fixture') => fetch(base + path, { headers: token ? { 'X-Studio-Customer-Token': token } : {} });
  try {
    assert.equal((await read('/dashboard/products?dbName=keyless-store', '')).status, 401);
    assert.equal((await read('/dashboard/products?dbName=unknown')).status, 401);
    assert.equal((await read('/dashboard/products?dbName=&tenant=some-key')).status, 401);
    assert.equal((await read('/dashboard/products?dbName=a&dbName=b')).status, 401);
    for (const path of ['dashboard/products', 'agent/runs', 'optimization/weekly-review', 'concierge/settings']) {
      const response = await read(`/${path}?dbName=keyless-store&tenant=foreign-key`);
      const data = await response.json();
      assert.equal(response.status, 200, JSON.stringify(data));
      assert.ok(!JSON.stringify(data).includes('foreign-key'));
    }
    assert.ok(reads.some(read => read.name === 'keyless-store' && read.collection === 'products'));
    assert.ok(reads.some(read => read.name === 'control_plane' && read.collection === 'agent_runs'));
    assert.deepEqual(await customerTenant(undefined, 'keyless-store'), { dbName: 'keyless-store' });
    await assert.rejects(customerTenant('ignored-key', ''), { status: 401 });
    await assert.rejects(customerTenant(undefined, 'unknown'), { status: 404 });
  } finally {
    close(); await new Promise(resolve => server.close(resolve)); configureDashboardStorage(null);
    if (before === undefined) delete process.env.STUDIO_CUSTOMER_API_TOKEN; else process.env.STUDIO_CUSTOMER_API_TOKEN = before;
  }
});
