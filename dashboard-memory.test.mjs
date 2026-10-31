import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dailyActivity } from './core/dashboard/analytics/activity.js';
import { loadStoreEvents, toQueryEvent } from './core/dashboard/analytics/events.js';
import { createReportGate } from './core/dashboard/analytics/work-limit.js';

test('daily activity handles 40,000 events within a small-instance memory budget', () => {
  const module = new URL('./core/dashboard/analytics/activity.js', import.meta.url).href;
  const script = `import {dailyActivity} from ${JSON.stringify(module)};
    const rows=Array.from({length:40000},(_,i)=>({t:Date.parse('2026-10-01')+i*60000}));
    const result=dailyActivity({queries:rows,clicks:[],carts:[],checkouts:[],purchases:[]});
    console.log(JSON.stringify({events:result.perDay.reduce((n,d)=>n+d.searches,0),maxRssKb:process.resourceUsage().maxRSS}));`;
  const child = spawnSync(process.execPath, ['--max-old-space-size=96', '--input-type=module', '-e', script], { encoding: 'utf8', timeout: 20000 });
  assert.equal(child.status, 0, child.stderr);
  const result = JSON.parse(child.stdout);
  assert.equal(result.events, 40000); assert.ok(result.maxRssKb < 256 * 1024, `Peak RSS: ${result.maxRssKb} KB`);
});
test('daily buckets retain Israel-local dates and deduplicate purchases', () => {
  const early = Date.parse('2026-10-18T20:30Z'), later = Date.parse('2026-10-18T22:30Z');
  const result = dailyActivity({ queries: [{ t: early }, { t: later }], clicks: [], carts: [], checkouts: [], purchases: [{ orderId: 'a', t: later }, { orderId: 'a', t: later }] });
  assert.deepEqual(result.perDay.map(day => [day.day, day.searches, day.purchases]), [['2026-10-18', 1, 0], ['2026-10-19', 1, 1]]);
});
function eventDb(data, failSource) {
  const closed = [], projections = [];
  return { closed, projections, db: {
    listCollections: () => ({ async toArray() { return Object.keys(data).map(name => ({ name })); } }),
    collection(name) { return { async findOne() { return { _id: 1 }; }, find(_filter, options) {
      projections.push({ name, projection: options.projection });
      return { sort() { return this; }, limit() { return this; }, batchSize() { return this; }, maxTimeMS() { return this; }, async close() { closed.push(name); },
        async *[Symbol.asyncIterator]() { for (const row of data[name]) { yield row; if (name === failSource) throw Error('fixture cursor error'); } },
      };
    } }; },
  } };
}
const from = new Date('2026-10-01'), to = new Date('2026-11-01'), timestamp = '2026-10-19T09:00Z';
test('streaming keeps full result counts, discards out-of-window rows and closes cursors', async () => {
  const fixture = eventDb({ queries: [{ query: 'wine', timestamp, session_id: 'a', _analyticsResultCount: 1000, deliveredProducts: Array(10).fill('wine') }, { query: 'future', timestamp: '2027-01-01' }], cart: [{ timestamp, event_type: 'add_to_cart', product_id: 1 }] });
  const result = await loadStoreEvents('own-store', from, to, { db: fixture.db });
  assert.equal(result.queries.length, 1); assert.equal(result.queries[0].delivered, 1000); assert.equal(result.queries[0].names.length, 10);
  assert.equal(result.carts.length, 1); assert.equal(result.sources.product_clicks.status, 'missing');
  assert.deepEqual(fixture.closed, ['queries', 'cart']);
  assert.ok(fixture.projections[0].projection._analyticsResultCount);
  assert.equal(toQueryEvent({ query: 'unknown', timestamp }).zero, null);
});
test('event/byte budgets explicitly mark truncation rather than fabricate measured zero rates', async () => {
  const fixture = eventDb({ queries: Array.from({ length: 8 }, (_, i) => ({ query: 'wine', timestamp, session_id: String(i) })), cart: [{ timestamp, product_id: 1 }] });
  const result = await loadStoreEvents('own', from, to, { db: fixture.db, maxEvents: 2 });
  assert.equal(result.queries.length, 2); assert.equal(result.sources.queries.truncated, true); assert.equal(result.sources.cart.truncated, true);
  const small = await loadStoreEvents('own', from, to, { db: fixture.db, maxBytes: 1 });
  assert.equal(small.queries.length, 0); assert.equal(small.sources.queries.truncated, true);
});
test('a failed source discards its partial rows while complete sources remain usable', async () => {
  const fixture = eventDb({ queries: [{ query: 'wine', timestamp }], product_clicks: [{ timestamp, product_id: '1' }], cart: [{ timestamp, product_id: '2' }] }, 'product_clicks');
  const result = await loadStoreEvents('own', from, to, { db: fixture.db });
  assert.equal(result.queries.length, 1); assert.equal(result.clicks.length, 0); assert.equal(result.carts.length, 1);
  assert.equal(result.sources.product_clicks.status, 'unavailable'); assert.equal(result.sources.cart.status, 'ok');
  assert.deepEqual(fixture.closed, ['queries', 'product_clicks', 'cart']);
});
test('heavy reports run one at a time and overflow returns retryable overload', async () => {
  const gate = createReportGate({ maxPending: 1 }); let release, running = 0, peak = 0;
  const hold = new Promise(resolve => { release = resolve; });
  const first = gate.run(async () => { running++; peak = Math.max(peak, running); await hold; running--; });
  const second = gate.run(async () => { running++; peak = Math.max(peak, running); running--; return 'second'; });
  await assert.rejects(gate.run(async () => 'overflow'), { status: 503 });
  release(); await first; assert.equal(await second, 'second'); assert.equal(peak, 1);
  await assert.rejects(gate.run(async () => { throw Error('fixture error'); }), /fixture error/);
  assert.equal(await gate.run(async () => 'recovered'), 'recovered');
});
