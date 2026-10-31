import { randomUUID } from 'node:crypto';
import { controlDb, coreUsersDb } from '../core/db.js';
import { loadStoreEvents, DAY_MS } from '../analytics/events.js';
import { reportGate } from '../analytics/work-limit.js';
import { analyzeGrowth } from './analysis.js';

const HOUR = 3600000;
const pending = new Map();
const publicState = row => ({ enabled: row?.enabled === true, status: row?.status || 'idle', lastScannedAt: row?.lastScannedAt || null,
  nextScanAt: row?.enabled ? row.nextScanAt : null, error: row?.error || null, report: row?.report || null });

export async function projectGrowthStore(project) {
  const dbName = project.existingClient?.dbName;
  if (!dbName) throw Object.assign(Error('יש לחבר את החנות לדאשבורד לפני ניטור מכירות מהחיפוש'), { status: 409 });
  const user = await (await coreUsersDb()).collection('users').findOne({ dbName, apiKey: { $exists: true, $ne: '' } }, { projection: { apiKey: 1, dbName: 1 } });
  if (!user?.apiKey) throw Object.assign(Error('לא נמצא חיבור פעיל לחנות'), { status: 409 });
  return { dbName, apiKey: user.apiKey };
}
async function collection() {
  const col = (await controlDb()).collection('search_growth_monitors');
  await col.createIndex({ dbName: 1 }, { unique: true });
  await col.createIndex({ enabled: 1, nextScanAt: 1 });
  return col;
}
export async function growthState(store) {
  const col = await collection();
  let row = await col.findOne({ dbName: store.dbName });
  if (row?.status === 'scanning' && +row.leaseUntil <= Date.now()) {
    await col.updateOne({ dbName: store.dbName, status: 'scanning', lease: row.lease, leaseUntil: row.leaseUntil },
      { $set: { status: 'failed', error: 'הסריקה הקודמת הופסקה. אפשר לנסות שוב.' }, $unset: { lease: '', leaseUntil: '' } });
    row = await col.findOne({ dbName: store.dbName });
  }
  return publicState(row);
}
export async function configureGrowth(store, enabled) {
  if (typeof enabled !== 'boolean') throw Object.assign(Error('enabled חייב להיות ערך בוליאני'), { status: 400 });
  const col = await collection();
  await col.updateOne({ dbName: store.dbName }, { $set: { enabled, nextScanAt: new Date(), updatedAt: new Date() } }, { upsert: true });
  return growthState(store);
}
export async function scanGrowth(store, { now = Date.now(), loadEvents = loadStoreEvents } = {}) {
  if (pending.has(store.dbName)) return pending.get(store.dbName);
  const work = (async () => {
    const col = await collection(), lease = randomUUID();
    // One bounded scan per store across instances; failures can be retried after
    // the lease expires, without overwriting a newer report.
    await col.updateOne({ dbName: store.dbName }, { $setOnInsert: { enabled: false } }, { upsert: true });
    const locked = await col.updateOne({ dbName: store.dbName, $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: new Date(now) } }] },
      { $set: { lease, leaseUntil: new Date(now + 10 * 60000), status: 'scanning', error: null } });
    if (!locked.matchedCount) return growthState(store);
    try {
      const report = await reportGate.run(async () => analyzeGrowth(await loadEvents(store.dbName, new Date(now - 7 * DAY_MS), new Date(now)), { now }));
      await col.updateOne({ dbName: store.dbName, lease }, { $set: { report, status: 'ready', lastScannedAt: new Date(now), nextScanAt: new Date(now + HOUR), error: null }, $unset: { lease: '', leaseUntil: '' } });
    } catch (error) {
      await col.updateOne({ dbName: store.dbName, lease }, { $set: { status: 'failed', error: 'לא ניתן להשלים את הניטור כעת. הנתונים הקודמים נשמרו.', nextScanAt: new Date(now + 5 * 60000) }, $unset: { lease: '', leaseUntil: '' } });
      console.error('[search growth] scan failed:', error.name);
      throw Object.assign(Error('לא ניתן להשלים את ניטור החיפוש כעת. אפשר לנסות שוב.'), { status: 503 });
    }
    return growthState(store);
  })().finally(() => pending.delete(store.dbName));
  pending.set(store.dbName, work); return work;
}
let ticking = false;
export async function tickGrowthMonitors() {
  if (ticking) return; ticking = true;
  try {
    const col = await collection(), now = new Date();
    const due = await col.findOne({ enabled: true, nextScanAt: { $lte: now }, $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: now } }] }, { sort: { nextScanAt: 1 }, projection: { dbName: 1 } });
    if (due) await scanGrowth({ dbName: due.dbName });
  } finally { ticking = false; }
}
