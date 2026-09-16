# Tenant Studio — local first release

Run `npm start`, then open http://127.0.0.1:4320. Uses the local .env
GEMINI_API_KEY or GOOGLE_API_KEY; STUDIO_MODEL defaults to gemini-2.5-flash.
STUDIO_DATA_DIR and STUDIO_PORT optionally override local storage and port.

## Implemented

- HTTPS URL + Shopify / WooCommerce / Magento / Custom onboarding.
- Public WooCommerce Store API and Shopify JSON discovery, at most 500 products.
  Generic/Magento fallback reads Product JSON-LD on the supplied page only.
- Real LLM profile generation; no fabricated demo products.
- Chat edits versioned executable policies: product types, category mappings,
  spelling dictionary, colors, finishes, approved badge rules and pipeline budget.
- Shared runtime executes that revision in the preview, including spelling,
  LLM fallback, alternatives and cursor pagination.
- Revision history and rollback create a new revision; atomic local persistence.
- On-demand static-HTML badge/tag scraping: homepage plus up to five same-origin
  catalog product URLs. Exact product URL attribution, source selectors and
  timestamps are saved in the local project and exposed in preview badges.
  Failed pages leave previous observations intact. This is partial evidence,
  not a browser-rendered crawl or a guarantee of every badge on the site.
- Mongo staging provisioning through a separate button (studio_<project UUID>).
  Standard indexes are created. Atlas Search creation is attempted and its status
  is reported; requesting an index is not proof that it is ready.
- ZIP exports: tenant factory, profile, product schema, Atlas index definition,
  browser widget and, for WooCommerce, a shortcode plugin wrapper.

## Boundaries of this release

This is a local developer workbench, not an internet-facing admin service.
Loopback binding, Host/Origin checks and a session token protect the local API.
Do not expose it by reverse proxy without adding real operator authentication.
No production tenant registration, deployment, Git commit, or store installation
is performed by the chat. It edits policy JSON, not arbitrary JavaScript. New
code capabilities require implementation and tests in the shared core/adapter.
The generated module depends on dashboard-server's shared runtime.

The public sample is not full synchronization. No deletion reconciliation,
platform OAuth, webhook installation or nightly scheduling is provisioned.
The badge scraper reads server HTML and does not execute JavaScript or compute
CSS visibility. Magento and Custom need a feed/connector for full data.
The initial widget supports first-page search and badges. Platform-native
autocomplete, load-more and sync lifecycle installation are follow-up work.
Preview retrieval is local; it does not query the newly requested Atlas index.

## Resource limits

At most two expensive operations, 3 MB per fetched response, a 500-product
sample in 25-product pages (automatically reduced to 10 or 5 on oversized
responses, restarting pagination to avoid gaps), 15-second source timeout, 45-second model timeout, 100 profile
revisions, 30 projects, one cached preview runtime with ten search sessions.
DNS is validated and pinned per request and per redirect; internal network
addresses are rejected. Remote content cannot supply executable module code.

## Tests

`npm run test:studio`
`node --test studio/*.test.mjs pilot/beautics/*.test.mjs tenants/beautics/*.test.mjs`

Test actual generation on Beautics, then use chat to add `ביס → בייס`, inspect
revision differences, and search the alias. The existing Beautics production
module is not overwritten by this project.
