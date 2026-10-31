export function createReportGate({ maxPending = 2, waitMs = 20000, pressure = () => false } = {}) {
    let active = false;
    const pending = [];
    const busy = () => Object.assign(Error('השרת מכין כעת דוח אחר. נסו שוב בעוד רגע או בחרו טווח קצר יותר.'), { status: 503 });
    async function run(work) {
        if (pressure()) throw busy();
        if (active) {
            if (pending.length >= maxPending) throw busy();
            await new Promise((resolve, reject) => {
                const entry = { resolve, reject, timer: null };
                entry.timer = setTimeout(() => { const index = pending.indexOf(entry); if (index >= 0) pending.splice(index, 1); reject(busy()); }, waitMs);
                pending.push(entry);
            });
        } else active = true;
        try { if (pressure()) throw busy(); return await work(); }
        finally {
            const next = pending.shift();
            if (next) { clearTimeout(next.timer); next.resolve(); }
            else active = false;
        }
    }
    return { run };
}
const MB = 1024 * 1024;
const constrained = typeof process.constrainedMemory === 'function' ? process.constrainedMemory() : 0;
const memoryBudget = constrained || (process.env.RENDER ? 512 * MB : 0);
export const reportGate = createReportGate({ pressure: () => memoryBudget > 0 && process.memoryUsage().rss > memoryBudget * 0.8 });
