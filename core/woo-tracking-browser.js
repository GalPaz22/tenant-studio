(function () {
  'use strict';
  const cfg = window.SemantixWooTracking;
  if (!cfg || window.__semantixWooTracking) return;
  window.__semantixWooTracking = true;
  const ttl = 1800000;
  let memory = null;
  const read = (store, key) => { try { return window[store].getItem(key); } catch { return null; } };
  const write = (store, key, value) => { try { window[store].setItem(key, value); } catch {} };
  const cookie = (key, value) => {
    document.cookie = key + '=' + encodeURIComponent(value) + ';path=/;max-age=1800;SameSite=Lax' + (location.protocol === 'https:' ? ';Secure' : '');
  };
  const fromCookie = key => { try { return decodeURIComponent(document.cookie.split('; ').find(s => s.startsWith(key + '='))?.slice(key.length + 1) || ''); } catch { return ''; } };
  function sync(queryOverride) {
    const now = Date.now();
    let state;
    try { state = JSON.parse(read('localStorage', 'semantix_woo_session') || 'null'); } catch {}
    state = state || memory || (fromCookie('semantix_sid') ? {id: fromCookie('semantix_sid'), at: now} : null);
    if (!state || now - state.at >= ttl || !/^vis-[\w-]{8,180}$/.test(state.id || '')) {
      // A separate visit ends after 30 minutes of inactivity. The engine uses the
      // same identity for search, click, exposure and checkout attribution.
      state = { id: 'vis-' + (globalThis.crypto?.randomUUID?.() || now + '-' + Math.random().toString(36).slice(2)), at: now };
      write('sessionStorage', 'semantix_last_query', '');
      cookie('semantix_last_query', '');
      if (!window.__semantix_engine_v5) write('localStorage', 'semantix_ab_current', '{}');
      write('localStorage', 'semantix_ab_exposed', '');
      write('localStorage', 'semantix_woo_query', '');
    }
    state.at = now; memory = state;
    write('localStorage', 'semantix_woo_session', JSON.stringify(state));
    write('localStorage', 'semantix_visitor_id', state.id);
    const params = new URLSearchParams(location.search);
    const query = (typeof queryOverride === 'string' ? queryOverride : params.get('s') || params.get('q') || '').trim().slice(0, 500);
    if (query) write('localStorage', 'semantix_woo_query', query);
    const last = query || read('localStorage', 'semantix_woo_query') || fromCookie('semantix_last_query') || '';
    write('sessionStorage', 'semantix_last_query', last);
    cookie('semantix_sid', state.id);
    cookie('semantix_last_query', last);
    cookie('semantix_ab_current', cfg.shadowMode ? '{}' : read('localStorage', 'semantix_ab_current') || '{}');
    return {session_id: state.id, search_query: last || null};
  }
  function postClick(payload) {
    if (!cfg.apiKey) return;
    fetch(cfg.apiBase + '/product-click', {method: 'POST', keepalive: true, credentials: 'omit',
      headers: {'Content-Type': 'application/json', 'X-API-Key': cfg.apiKey}, body: JSON.stringify(payload)}).catch(() => {});
  }
  cfg.context = () => sync();
  cfg.rememberQuery = query => sync(String(query || ''));
  sync();
  // Capture before the search engine or WooCommerce sends a request.
  document.addEventListener('click', event => {
    const context = sync();
    const target = event.target?.closest?.('a[href]');
    if (!target || target.closest('[data-semantix-ai],[data-semantix-replaced],[data-semantix-ac]') || target.matches('.add_to_cart_button,.btn-add-cart,[data-semantix-atc],[href*="add-to-cart="]')) return;
    const configured = cfg.productCardSelectors || window.SemantixSettings?.siteConfig?.selectors?.productCard;
    const selectors = (Array.isArray(configured) ? configured : [configured]).filter(s => typeof s === 'string');
    let card;
    try { card = target.closest([...selectors, 'li.product', '.wc-block-grid__product', '.wc-block-product', '.product-col'].join(',')); } catch { return; }
    if (!card) return;
    if (!target.matches('.woocommerce-LoopProduct-link,.woocommerce-loop-product__link,.wc-block-grid__product-link,.archive-prod-thumb,.product-name a') && !target.querySelector('img,.woocommerce-loop-product__title,.wc-block-grid__product-title')) return;
    const id = card.querySelector('[data-product_id]')?.getAttribute('data-product_id') || card.querySelector('.btn-add-cart[data-id]')?.getAttribute('data-id') || /\bpost-(\d+)\b/.exec(card.className)?.[1] || card.getAttribute('data-product-id');
    if (!/^\d+$/.test(id || '')) return;
    const url = new URL(target.href, location.href); if (url.origin !== location.origin) return;
    postClick({...context, product_id: (cfg.productIdPrefix ?? 'woo_product_') + id, product_name: card.querySelector('.woocommerce-loop-product__title,.wc-block-grid__product-title,.product-name')?.textContent?.trim() || null,
      product_url: url.origin + url.pathname, platform: 'woocommerce', source: cfg.shadowMode ? 'woocommerce-shadow' : 'woocommerce-native', interaction_type: 'click',
      event_id: 'clk-' + (globalThis.crypto?.randomUUID?.() || Date.now() + '-' + Math.random()), timestamp: new Date().toISOString()});
  }, true);
  document.addEventListener('submit', sync, true);
  document.addEventListener('input', sync, {capture: true, passive: true});
  document.addEventListener('keydown', sync, {capture: true, passive: true});
  addEventListener('popstate', sync);
  // Only commerce mutations count as activity; background polling does not
  // keep a shopper's session alive indefinitely.
  const commerceRequest = (url, method) => String(method).toUpperCase() !== 'GET' && /wc-ajax=add_to_cart|add-to-cart=|\/wc\/store\/(?:v\d+\/)?(?:cart\/(?:add-item|items)|checkout|batch)/i.test(String(url));
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    if (commerceRequest(typeof input === 'string' ? input : input?.url, init?.method || input?.method || 'GET')) sync();
    return originalFetch.apply(this, arguments);
  };
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) { this.__semantixCommerce = commerceRequest(url, method); return originalOpen.apply(this, arguments); };
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () { if (this.__semantixCommerce) sync(); return originalSend.apply(this, arguments); };
})();
