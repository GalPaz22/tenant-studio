# Tenant Studio — Core build pipeline

Run `npm start`, then open http://127.0.0.1:4320. `npm test` runs the verification suite.

The Studio now runs **Build store**: source inspection → complete connected-source crawl → normalization/specifications → taxonomy → store/domain research → product enrichment → evidence-based tags → product cards → store context → index → readiness checks.

## Execution and review

- Builds return a run ID immediately and execute outside the HTTP request. A local durable queue, raw page assets, per-product assets and checkpoints live under `data/runs/` (or `STUDIO_DATA_DIR/runs/`). At most two expensive operations execute concurrently in this single-server implementation.
- Pause, cancel and resume are available in the UI. Restarted running jobs become paused; queued jobs recover automatically. Completed work survives restarts. Failed stages can be retried without replacing the previous usable catalog.
- Source, model-call and elapsed-time budgets are enforced. A budget stop is paused, never successful completion. Budgets are counts/time, not a monetary price estimate.
- Imported products can be inspected before the build finishes and are explicitly marked as pending enrichment. Completed cards expose specifications, variants, tag decisions and source evidence.
- Every build pins a profile. Operator spelling/tag rules are preserved. Chat repairs use bounded category/product discovery and deterministic query inspection. They add scoped vocabulary links to selections of at most 200 existing product IDs, fix spelling, or edit existing aliases. Alias-only edits reuse cards, the index, and prior classifications; chat cannot create/change tag definitions or start a catalog rebuild. Deleted or changed definitions cannot silently reuse old assignments. Activated snapshots remain separate from draft chat edits.

## Catalog connectors

- Public WooCommerce Store API and Shopify JSON are crawled to exhaustion, without the legacy 500/10000-product ceiling. Pagination checkpoints, smaller-page restarts, repeated-page detection and duplicate-ID checks prevent silent truncation. Public-source coverage does **not** prove the complete store catalog.
- Authenticated WooCommerce REST v3 reads published products and all their variant pages; Shopify Admin GraphQL uses product cursors and exhausts variant connections. Server-side credentials are scoped to the configured store. Tokens are never stored in run assets or returned to the browser.
- Magento REST reads the product list/custom attributes, category tree, base currency, configurable-product children and salability for the configured inventory stock (default stock 1). Hidden/disabled child products remain hidden. Store-specific stock/store-code, media base URL and URL suffix can be configured; an unavailable inventory endpoint is an error rather than fabricated stock. This is coverage of the configured API/store/stock scope.
- JSON, CSV and TSV feeds are supported. JSON can be an array or `{products, nextUrl}` for paginated feeds. Product records require a stable `id`/`sku`, name, product URL, and available commercial/attribute fields. CSV variants/specifications can be JSON cells. A feed can be declared complete by the operator; that declaration is reported separately from measured source coverage.
- Nested same-origin XML sitemaps are crawled and Product JSON-LD is extracted. Failed pages remain incomplete. Server HTML is inspected; browser-rendered/JavaScript-only details are not claimed as collected.
- Before readiness, a second connected-source scan verifies product membership. Source additions/deletions or overlapping pagination block readiness and require a new import. A matching membership check is not a transactional snapshot guarantee for prices and stock; observations retain their timestamps.
- Each completed build is a source-scoped snapshot. Missing products disappear from the next active source view only after validation/activation. Older snapshots remain available; no failed/partial import deletes the active catalog or Mongo collection.

## Research, tags and context

- Public product pages supply descriptions/specification tables and attributed badges. Merchant price/stock conflicts prevent contradictory sale/stock badges from being displayed.
- Merchant-text extraction derives material, dimensions, capacity and other explicit attributes in batches. Every accepted value needs a literal quote from that product; invented evidence is rejected and conflicting values remain visible without overwriting the source specifications. This step can be disabled in build settings.
- Store homepage and discovered about/shipping/returns/terms links supply business context. Business facts/policies require a literal source quote; missing policies stay absent.
- Google Search grounding discovers sourced domain knowledge; returned claims, source links, queries and full research output are retained. Domain guidance is separate from exact product facts. See [Google grounding documentation](https://ai.google.dev/gemini-api/docs/generate-content/google-search).
- Optional per-model research discovers manufacturer sources. Explicit research URLs are also supported. External technical facts need an exact GTIN/MPN/model identity and literal nearby quotes. Model-prefix matches, invented values and merchant price/stock claims are rejected. Conflicting facts remain visible and never silently overwrite merchant specifications.
- Public sources discovered through grounded research share a 24-hour cache. Supplied feeds, authorized responses and private store data are not shared through that cache.
- Tags are classified in bounded groups of products/tags. Each pair keeps `matched`, `not_matched`, `unknown`, `conflict` or `failed`, its definition/product hashes and source quote. Positive/negative decisions need literal evidence. Model-memory knowledge cannot supply a verified assignment. Failed classification blocks build readiness; missing evidence remains unknown.
- Garmin-specific product rules live in a domain pack above the shared runner. The older Garmin research endpoint remains available for compatibility, but the main UI uses the generic build.

## Index and activation

- A persisted inverted index covers names, descriptions, specifications, categories/tags and exact identifiers. Preview reads this index and shares the same search service as the exported tenant runtime; cursor pagination is retained.
- Optional embeddings build a versioned 768-dimension vector index. Semantic candidate retrieval combines lexical and vector ranking, followed by source-evidence selection. The embedding model and content hash are pinned; incompatible vectors are not reused. Default: `gemini-embedding-2`, override with `STUDIO_EMBEDDING_MODEL`. See [embedding documentation](https://ai.google.dev/gemini-api/docs/embeddings).
- Choosing Mongo requires `MONGODB_URI`. Each build writes a separate staging collection, requests Atlas Search, waits for queryability and executes identifier smoke queries. Requested/pending/error is distinct from ready. Optional Atlas Vector Search is also created/tested. Mongo-ready builds use the Atlas text retriever; the local index remains available for local draft changes.
- Local activation selects one validated catalog/context/index snapshot. Active search is `/api/projects/:id/active/search`; ordinary `/search` is draft preview. Prior builds can be activated from the history panel. This is local version selection, not internet deployment or installation in a production store.
- ZIP export includes the actual shared runtime/dependencies, catalog snapshot, cards, evidence, tags, store context and build report, plus a widget with pagination and optional autocomplete. No live endpoint or tenant routing is published by export.

## Synchronization

The UI can enable periodic reconciliation (minimum 15 minutes) and optionally activate successful sync builds. It runs only while this local server is alive. Unchanged product enrichment is reused for up to 24 hours; tag decisions are reused only when product/definition hashes match. Changes are reprocessed; optional failures are reported. Automatic updates stop at the existing 100-revision limit.

`POST /api/projects/:id/sync/event` accepts `{eventId, productId, action: "create"|"update"|"delete"}` and deduplicates recent event IDs. A trusted local integration can use the Studio session token, or set `STUDIO_WEBHOOK_SECRET` and send `X-Studio-Timestamp` (Unix seconds) plus `X-Studio-Signature = HMAC-SHA256(secret, timestamp + "." + exact JSON body)` as hex. Signatures expire after five minutes. Events trigger reconciliation with incremental enrichment; they do not blindly delete products. Platform-native webhook/OAuth installation is not performed. The service stays loopback-only.

## Configuration and boundaries

The local `.env` supplies `GEMINI_API_KEY`/`GOOGLE_API_KEY`, optional `STUDIO_CHAT_MODEL` (chat defaults to Gemini 3.1 Flash Lite with minimal thinking), `STUDIO_MODEL` (build agent remains Flash), `STUDIO_RESEARCH_MODEL`, `STUDIO_AGENT_MODEL`/`STUDIO_JUDGE_MODEL` (studio agent and the reasoning reviewer that verifies its search fixes), `STUDIO_EMBEDDING_MODEL`, `MONGODB_URI`, `STUDIO_DATA_DIR`, `STUDIO_PORT`, and `STUDIO_WEBHOOK_SECRET`.

`STUDIO_CONNECTORS` is server-only JSON keyed by project UUID. Entries require the exact public store `host`:

```json
{
  "<woo-project-uuid>": {"host":"store.example","key":"<read-only key>","secret":"<secret>"},
  "<shopify-project-uuid>": {"host":"store.example","shop":"store.myshopify.com","token":"<read_products token>","apiVersion":"2026-07"},
  "<magento-project-uuid>": {"host":"store.example","token":"<read-only token>","stockId":1,"storeCode":"default","urlSuffix":".html"}
}
```

Credentials cannot redirect to another origin. All fetches validate/pin public DNS and reject internal networks. Responses default to 3 MB, feeds to 64 MB, with 15-second source timeouts. Remote content is information, never executable instructions. ZIP assets are compressed and bounded (256 MB per file / 512 MB total uncompressed).

This remains a local developer workbench with Host/Origin/session protection. It is not a multi-host worker system or an internet-facing authenticated admin service. Live tests of authenticated platform access, Atlas and optional embedding providers require their configured credentials; automated tests use injected providers to verify behavior without writing to external stores.

### Focused search repair

The chat agent has up to six tool rounds to inspect categories, select products by exact category and title substring, and inspect deterministic query results. A scoped alias augments existing literal matches; it never labels product facts. The response records tools used, selected-product count, and before/after query results. Product selections are snapshots of existing IDs; future products are not implicitly added. No catalog source reads, classification jobs, or index rebuilds are started by chat. The former automatic `/repair` rebuild endpoint is disabled; explicit build controls remain separate.

Complex search (four or more words, or explicit negation) bypasses cheap lexical/router shortcuts and uses `STUDIO_SEARCH_MODEL` (default `gemini-3.1-flash-lite`, medium thinking) for both interpretation and evidence-based selection. Chat repair uses Gemini 3.1 Flash Lite. The studio agent's answer is not final until a fresh search passes review: the harness reruns the real search for the operator's quoted queries, a separate reviewer judges each returned product by id against the request, and a failed verdict (named unwanted or missing products) sends the agent back to fix it, up to three rounds; an unverified fix is reported as such. “בדוק חיפושים” / “בדוק ותקן” (`POST /api/projects/:id/audit {fix}`) reviews real shopper queries from the client database — zero-result searches (`queries.deliveredProducts`), searched-but-never-clicked (`product_clicks`/`cart`, same time window) and the most searched — against the current rules. With fix, up to five findings go to the studio agent one query at a time; only fixes that pass their own verification are saved (each as a version, plus a pending regression example), and earlier fixes are rechecked after later ones. Open findings are passed to the studio agent as `lastAudit`. Linked terms can add products (`mode: "add"`) or narrow a word to exactly the linked products (`mode: "only"`, e.g. "יומן" → diaries rather than novels titled "יומן"). Semantic matches require evidence for every constraint, including specifications. When full matching fails, a bounded model pass ranks closest alternatives and reports missing constraints. If the provider fails, local similarity returns explicitly unverified suggestions. Only visible in-stock tenant products are eligible; an empty eligible catalog remains empty. Search examines a bounded candidate set and does not reclassify the catalog.

### Focused learning trial

The learning panel imports existing repair checks and scoped rules as **unconfirmed** examples. Review expected and unwanted products, then confirm examples. A bounded Flash model call proposes up to six equivalent search phrasings; each proposal previews a scoped alias against the existing cards/index and checks confirmed examples. Applying requires explicit review, a confirmed source example, a fresh profile/catalog check, improvement, and passing confirmed examples. Later chat repairs that break previously passing examples are rejected.

These are deterministic retrieval checks, not proof of semantic equivalence or end-to-end LLM ranking quality. No model training, catalog classification, or automatic application occurs. Approved rules travel with the exported profile; confirmed examples are included in `learning-tests.json` as data (no automatic test runner). Suggestions remain reviewable hypotheses.

### Existing Dashboard clients

Use “עבודה על לקוח קיים” and an exact username to open saved MongoDB products, categories and tags. The connection uses `STUDIO_DASHBOARD_MONGODB_URI`, falling back to `MONGODB_URI`; the username is resolved through `users.users` and the stored `dbName`/`collections.products` mapping. This reads existing data only, creates a local working snapshot and local search index, and does not crawl, classify, or write to the source database. Reopening returns the existing local project, preserving edits. Imported tags are displayed as stored labels; this does not import the production search code or infer tag definitions. The current limit is 50,000 products, with an explicit error rather than silent truncation.

### Existing-client fast track

The existing-client panel can analyze saved context plus recent query signals and separately rebuild the local index from the current cards. It never starts catalog sync, scraping, classification or activation. Analysis aggregates all cards, sends up to 80 distributed product examples, the profile/context, and top query aggregates to the configured chat model. Mongo reads are limited to the latest 10,000 events per source. A missing result count is unknown, not failure; attributed add-to-cart events are labelled as such, not purchase conversions. Recommendations are proposals only; reindexing does not apply proposed translations or other enrichment. The report and index stay in the local project and travel with the existing snapshot export where applicable.

### Workspace chat agent

The chat uses `/agent` for projects with saved cards. Its context includes catalog-wide summaries, sampled products, profile, saved fast-track report and conversation history; paginated tools inspect products and distinct field values across the saved catalog. Tools can refresh query aggregates, apply focused search repair, adjust bounded candidate/router settings, reindex, and derive a new searchable specifications field from an existing text field. Processing deduplicates source strings, runs batches of 40 up to 1,000 distinct values per operation, preserves source fields and records model-derived provenance. “Undo processing” removes the most recent derived field. Unsupported/missing source fields require clarification; the agent cannot change arbitrary code, crawl, or deploy. Changes are staged in a copy and saved only on successful completion with non-regression of confirmed examples. New fields invalidate vector snapshots and are indexed locally; they are not independently source-verified facts.

## Per-tenant search loop

The studio's goal for an existing client is to replace its current search: keep everything that works and deliver where it fails.

- **Baseline against production** ("מול הקיים"): built from the client's own logs (`queries`, `product_clicks`, `cart`, default 30 days). A query *works* in production when shoppers repeatedly chose products (clicked ≥3 with a real share, or carted); those products are the keep targets. It *fails* when it mostly returned nothing or was never clicked. Chosen products missing from the catalog or out of stock are reported as catalog gaps (the site crawler closes them), not as search failures. Evaluation is deterministic (local index): kept / partial / lost / gap, weighted by searches.
- **Regression guard**: every studio-agent save is checked against the queries currently kept; a change that loses one is sent back to the agent once, then refused.
- **Fixes from real queries**: "תקן אבודים" (`POST /audit {fix:true, source:"baseline"}`) sends the most-searched lost queries to the agent with the products shoppers chose; a fix is kept only when it passes the reviewer and those products come back.
- **Processing lab** ("עיבוד"): `STUDIO_PLANNER_MODEL` (default `gemini-3.1-pro-preview`) researches the tenant (lost queries, field coverage, client database fields) and proposes up to five plans (import a database field, derive a field with `STUDIO_PROCESSING_MODEL`, default `gemini-3.8-flash`, or extract with a pattern), each citing the queries it should fix. Plans are tried on a sample, then run and measured against the baseline; a run that loses a kept query is rolled back.
- **Dedicated scraper** ("סורק" → "סורק ייעודי ללקוח"): the planner writes a declarative product-page spec (product URL rule with key, JSON-LD paths or CSS selectors per field) from sample pages; it is validated on more pages and against the catalog, refined once if weak, and used by the tenant's crawl after the operator activates it.
- Models: the studio agent defaults to `gemini-3.8-flash` (`STUDIO_AGENT_MODEL`); the reviewer (`STUDIO_JUDGE_MODEL`) and planner default to Pro.
