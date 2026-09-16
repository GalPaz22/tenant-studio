export function createViewState(storage) {
  const prefix = 'tenant-studio:';
  const valid = id => typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id);
  function read(key) { try { return JSON.parse(storage.getItem(prefix + key)); } catch { return null; } }
  function write(key, value) { try { storage.setItem(prefix + key, JSON.stringify(value)); } catch {} }
  return {
    selected() { const id = read('selected'); return valid(id) ? id : null; },
    select(id) { write('selected', valid(id) ? id : null); },
    draft(id) {
      const value = read('draft:' + id);
      return {message: typeof value?.message === 'string' ? value.message : '', query: typeof value?.query === 'string' ? value.query : ''};
    },
    saveDraft(id, value) { if (valid(id)) write('draft:' + id, {message: value.message.slice(0, 10000), query: value.query.slice(0, 2000)}); }
  };
}
