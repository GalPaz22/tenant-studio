# Storefront search and WooCommerce measurement

## Shipi Shadow package

`exports/shipi-shadow.zip` is the requested measurement-only edition. Build it with `node scripts/package-shipi.mjs --shadow`. It replaces the same `semantix-search` WordPress plugin directory, so only one edition runs. Clear page/CDN caches after replacing the active edition.

This package ships only `semantix-commerce.js` and `semantix-shadow.js` on the storefront. It contains no search engine, card template or CSS, never fetches `/site-config`, and cannot activate takeover through a remote flag. Searches are logged on native results pages through the existing `/log-query` endpoint; zero results also go to `/zero-search`. It does not run `/search`, `/fast-search` or autocomplete. Pagination is excluded. Native product clicks, successful WooCommerce cart hooks and paid orders share the same 30-minute session. Existing API routes were verified using deliberately invalid requests rejected before writing measurement events. No new server was created or deployed.

`scripts/verify-shipi-shadow.mjs` runs the packaged scripts against Shipi's saved native HTML/CSS and a local API, checking identical native markup, zero storefront mutations, preserved form GET navigation, shared session attribution, no cart event on click intent, retained zero-result messages, and no engine/config requests. Commerce hooks, unpaid-order exclusion and delivery retries are checked by the PHP regression harness with `SEMANTIX_SHADOW_MODE=true`. Production installation and real payment-gateway flow remain installation checks.

## Shipi correction

Shipi (`https://shipi.co.il/`) is a WooCommerce store running Matat / Matat Child. The earlier identification as Shopify/Foxhome was incorrect. `exports/shipi.zip` contains the generic WooCommerce package: `ul.products` / `li.product`, whereas Shipi's theme styles `div.products-row` / `div.product-col` / `.product-item`. That mismatch reproduces the unstyled-card report independently of whether the store runs in development or production.

Use `exports/shipi-fixed.zip`, built by `node scripts/package-shipi.mjs` from Shipi's saved, detected takeover configuration and existing public site key. It preserves the site's card markup, grid ancestors and theme CSS dependencies; the Matat stylesheets need to be present in the target WordPress theme. No production configuration or server was deployed. Local Chrome tests against saved public HTML and actual theme CSS reproduce the generic mismatch, compare native/replaced card computed styles, verify desktop and two-column mobile layout, and verify empty-message recovery and failure fallback. Screenshots and results are under `reports/shipi-qa/`.

Shipi's existing catalog uses numeric WooCommerce product IDs. Its package preserves those IDs as strings across clicks, carts and purchases, instead of adding the `woo_product_` prefix used by some other stores. The browser also recognizes Matat's `.product-col`, `.product-name` and `.btn-add-cart[data-id]` for native-click measurement.

Prepared locally on 2026-10-21. Neither package has been deployed or installed.

Use the existing `dashboard-server` service and the existing store database. The default API URL is `https://api.semantix-ai.com`; searches use `/search`, clicks use `/product-click`, and cart/purchase events use `/search-to-cart`. No new server, hosting resource or measurement service is needed. Any backend deployment mentioned below means updating the code of that existing service through its normal release process.

- `exports/semantix-shopify-foxhome-fixed.zip`: both existing Foxhome extensions, preserving their UIDs and settings. The engine hides native empty-state messages only while it has rendered products, watches subsequent theme insertions, and releases the hiding when the query changes or takeover fails.
- `exports/semantix-woocommerce.zip`: installable WordPress plugin. Configure its public site key and HTTPS search server under Settings → Semantix Search. Store-specific layout/configuration can subsequently be supplied through `/site-config` or a new Studio export. The default template targets standard WooCommerce product grids.

The WooCommerce browser script runs before the search engine and maintains a first-party session with a 30-minute inactivity boundary. Search and engine clicks use the same ID; native WooCommerce cards are tracked separately when a product ID is present. Add-to-cart events come exclusively from the successful WooCommerce hook. Classic checkout and the Store API save session, last query and A/B group on the order. Paid-order hooks queue purchases using that saved context, including asynchronous payment callbacks. Orders without context remain unattributed.

Delivery uses Action Scheduler, falling back to WP-Cron. It preserves the event's ID, timestamp and payload across eight attempts, and marks an order delivered only after a 2xx acknowledgement. Failed records remain in `semantix_event_*` options with `attempt` and `last_status`; retry them by scheduling `semantix_send_event` with the saved ID. No names, addresses, emails or payment details are included in the plugin payload. Search queries and product/order identifiers are sent.

The measurement server also needs the prepared changes in `~/Desktop/dashboard-server/server.js` and `tracking-events.mjs`: stable event IDs use deterministic Mongo `_id` values for atomic retry deduplication. Distinct cart actions are preserved instead of merging the same session/product for 30 minutes. Existing clients without event IDs retain the legacy behavior. These backend changes are not part of the WordPress ZIP and still need deployment. A standalone patch is provided in `exports/measurement-server.patch`; it contains only this task's server changes, preserving the other local changes in that checkout.

Validation: 33 focused Node tests; PHP syntax checks and standalone hook/queue tests under PHP.wasm; headless Chrome against local fixtures for empty-state cleanup, repeated DOM insertion, error/empty fallback, real engine and native clicks, identity across pages, idle expiry and background polling. This does not replace installation QA against a real WooCommerce store, a payment gateway and the production event endpoint.

Rebuild with `node scripts/package-storefront-plugins.mjs`. Browser checks: `PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/verify-storefront-plugins.mjs`. PHP checks: `php scripts/test-woo-tracking.php`. Engine fixes live in `core/takeover-engine.mjs` and apply to future exports and previews as well as the updated local engine copies.

Hook references: [WooCommerce Store API checkout](https://woocommerce.github.io/code-reference/files/woocommerce-src-storeapi-routes-v1-checkout.html), [payment gateway lifecycle](https://developer.woocommerce.com/docs/features/payments/payment-gateway-api/).
