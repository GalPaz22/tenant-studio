import { buildConversionReport } from './report.js';

// One measured snapshot shared by the dashboard and its agent. No answers, API
// keys or drafts are cached. Expired/failed data is never served as current data.
export function createReportCache({ build = buildConversionReport, ttlMs = 60000, maxEntries = 4, now = Date.now } = {}) {
  const entries = new Map();
  const invalidate = dbName => { for (const [key, entry] of entries) if (entry.dbName === dbName) entries.delete(key); };
  const get = (tenant, { days = 30 } = {}) => {
    if (!tenant?.dbName || ![7, 30, 90].includes(days)) throw Error('Invalid report scope');
    const key = JSON.stringify([tenant.dbName, days]);
    for (const [id, entry] of entries) if (entry.expires <= now()) entries.delete(id);
    let entry = entries.get(key);
    if (!entry) {
      entry = { dbName: tenant.dbName, expires: Infinity, result: null };
      entry.result = Promise.resolve().then(() => build(tenant, { days, persist: false })).then(report => {
        entry.expires = now() + ttlMs; entry.value = report; return report;
      }).catch(error => { if (entries.get(key) === entry) entries.delete(key); throw error; });
      if (entries.size >= maxEntries) entries.delete(entries.keys().next().value);
      entries.set(key, entry);
    }
    return entry.result;
  };
  const peek = (tenant, { days = 30 } = {}) => {
    const entry = entries.get(JSON.stringify([tenant.dbName, days]));
    return entry?.expires > now() ? entry.value ?? null : null;
  };
  return { get, peek, invalidate };
}
const cache = createReportCache();
export const getDashboardReport = cache.get;
export const invalidateMeasuredReports = cache.invalidate;
export const peekDashboardReport = cache.peek;
