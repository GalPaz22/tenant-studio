// Apply runtime fixes to both local and CDN engines, including older app exports.
// Keep this idempotent so an already updated engine can be exported again.
export function patchTakeoverEngine(source){
 if(!source.includes('function replaceGrid('))return source;
 if(!source.includes('function hideNativeEmptyState(')){
  const helper=`
  let nativeEmptyObserver = null;
  function releaseNativeEmptyState() {
    nativeEmptyObserver?.disconnect();
    nativeEmptyObserver = null;
    qa('[data-semantix-empty-hidden]').forEach(n => {
      n.removeAttribute('data-semantix-empty-hidden');
      n.removeAttribute('data-semantix-native-hidden');
    });
  }
  function hideNativeEmptyState(grid) {
    nativeEmptyObserver?.disconnect();
    const root = grid.closest('main,[role="main"],#main,#MainContent') || grid.parentElement || grid;
    const selectors = [...asList(cfg.selectors?.noResults), '.no-results', '.search-no-results', '.woocommerce-no-products-found', '.search__no-results', '[data-no-results]'];
    const hide = () => {
      if (!grid.isConnected || !grid.querySelector('[data-semantix-replaced="1"]')) return;
      const candidates = new Set();
      for (const selector of selectors) {
        try { root.querySelectorAll(selector).forEach(n => candidates.add(n)); } catch {}
      }
      // Some themes print an unclassified message inside the grid itself.
      grid.querySelectorAll('p,span,div,h2,h3').forEach(n => {
        const text = (n.textContent || '').trim();
        if (text.length < 240 && /^(?:לא נמצאו (?:מוצרים|תוצאות)|אין (?:מוצרים|תוצאות)|no (?:products|results) (?:found|match)|nothing found)/i.test(text)) candidates.add(n);
      });
      for (const node of candidates) {
        // A broad merchant selector may match a grid ancestor or a product's text.
        if (node === grid || node.contains(grid) || node.closest('[data-semantix-replaced],[data-semantix-head],[data-semantix-load-more]') || node.querySelector('[data-semantix-replaced]')) continue;
        node.setAttribute('data-semantix-empty-hidden', '1');
        node.setAttribute('data-semantix-native-hidden', '1');
      }
    };
    hide();
    // Themes may insert the message again while our cards are still present.
    nativeEmptyObserver = new MutationObserver(hide);
    nativeEmptyObserver.observe(root, {childList:true, subtree:true});
  }
`;
  source=source.replace('  function productKey(p) {',helper+'\n  function productKey(p) {');
  source=source.replace('      natives.forEach(n => n.remove());','      natives.forEach(n => n.remove());\n      hideNativeEmptyState(grid);');
  source=source.replace('  function releaseMain() {','  function releaseMain() {\n    releaseNativeEmptyState();');
  source=source.replace('    LAST_Q = q;\n    try { ssSet("semantix_last_query", q); } catch {}\n\n    // Clean up', '    LAST_Q = q;\n    releaseNativeEmptyState();\n    try { ssSet("semantix_last_query", q); } catch {}\n\n    // Clean up');
  source=source.replace('if (!q) { LAST_Q = ""; STORE_OWN = null;', 'if (!q) { releaseNativeEmptyState(); LAST_Q = ""; STORE_OWN = null;');
 }
 if(!source.includes('SemantixWooTracking?.serverCartTracking'))source=source.replace('  function sendSearchToCart(documentPayload) {','  function sendSearchToCart(documentPayload) {\n    if (window.SemantixWooTracking?.serverCartTracking && documentPayload.event_type === "add_to_cart") return;');
 if(!source.includes('SemantixWooTracking?.nativeClickTracking'))source=source.replaceAll('if (!isAI && !cfg.clickTracking.trackNativeClicks) return;', 'if (!isAI && (window.SemantixWooTracking?.nativeClickTracking || !cfg.clickTracking.trackNativeClicks)) return;');
 return source;
}
