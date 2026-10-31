(function () {
  'use strict';
  const cfg = window.SemantixWooTracking;
  if (!cfg?.shadowMode || !cfg.apiKey || window.__semantixWooShadow) return;
  window.__semantixWooShadow = true;
  const selectors = cfg.searchSelectors || {};
  const list = value => (Array.isArray(value) ? value : [value]).filter(s => typeof s === 'string' && s.trim());
  const first = (root, choices) => {
    for (const selector of list(choices)) { try { const node = root.querySelector(selector); if (node) return node; } catch {} }
    return null;
  };
  function queryFromLocation() {
    const params = new URLSearchParams(location.search);
    for (const name of cfg.queryParams || ['s']) { const value = params.get(name)?.trim(); if (value) return value.slice(0, 500); }
    return '';
  }
  function nativeZero() {
    const root = first(document, selectors.root || ['main', '#main']) || document;
    const grid = first(root, selectors.resultsGrid);
    if (grid && first(grid, selectors.productCard)) return false;
    const empty = first(grid || root, selectors.noResults);
    if (empty && !empty.hidden && empty.getClientRects().length && getComputedStyle(empty).display !== 'none' && getComputedStyle(empty).visibility !== 'hidden') return true;
    return undefined;
  }
  function post(endpoint, body) {
    // Logging endpoints only. Native results, autocomplete, forms and navigation
    // belong entirely to the shop. No product search is requested here.
    return fetch(cfg.apiBase + endpoint, {method: 'POST', keepalive: true, credentials: 'omit',
      headers: {'Content-Type': 'application/json', 'X-API-Key': cfg.apiKey}, body: JSON.stringify(body)}).catch(() => {});
  }
  let lastQuery = '', observer = null, timer = null, generation = 0;
  function measure() {
    const query = queryFromLocation(), params = new URLSearchParams(location.search);
    // Pagination and sorting re-use an existing search; they are not new searches.
    if (Number(params.get('paged') || params.get('product-page') || params.get('page') || 1) > 1) return;
    if (query === lastQuery) return;
    lastQuery = query;
    const current = ++generation;
    observer?.disconnect(); clearTimeout(timer);
    if (!query) return;
    let sent = false;
    const report = final => {
      if (sent || generation !== current || query !== queryFromLocation()) return;
      const zero = nativeZero();
      if (zero === undefined && !final) return;
      sent = true; observer?.disconnect(); clearTimeout(timer);
      const context = cfg.rememberQuery(query);
      const payload = {query, session_id: context.session_id, ...(zero === undefined ? {} : {zero_results: zero})};
      post('/log-query', payload);
      if (zero === true) post('/zero-search', {query, session_id: context.session_id, platform: 'woocommerce', source: 'shadow', recovered_count: null, page_url: location.origin + location.pathname});
    };
    if (nativeZero() !== undefined) return report(true);
    observer = new MutationObserver(() => report(false));
    observer.observe(document.body, {childList: true, subtree: true});
    timer = setTimeout(() => report(true), 2000);
  }
  // Remember a submitted native query for carts/checkout even before navigation.
  // No preventDefault, form field writes or request interception are involved.
  document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const field = first(form, selectors.searchInput) || first(form, ['input[name="s"]']);
    if (field?.value?.trim()) cfg.rememberQuery(field.value.trim().slice(0, 500));
  }, true);
  function ready() {
    measure();
    for (const method of ['pushState', 'replaceState']) {
      const original = history[method];
      history[method] = function () { const result = original.apply(this, arguments); queueMicrotask(measure); return result; };
    }
    addEventListener('popstate', measure);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, {once: true}); else ready();
})();
