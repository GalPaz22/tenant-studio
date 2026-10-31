# Weekly conversion review

The customer dashboard's **הצעות תיקון** panel runs in tenant-studio, without search-optimizer. It considers every recorded query from the seven days preceding generation, including the long tail. There is one completed report per store per UTC calendar week, created with **הכנת דוח השבוע**. There are zero to three new proposals for the entire store; generating a report never activates a change.

## Supported changes

Exact-query ordering, demotion, exclusion, catalog-grounded explanations, and complementary product groups. A group is not a new SKU, discount, or cart pricing rule. It requires three distinct co-cart sessions per pair/query. Every product must belong to the store and have been observed for the action's query. Displayed products must be in stock; notes quote exact catalog facts. Actions in a grouped proposal may target different queries. Queries require five measured sessions; a group needs twenty session-query observations. Incomplete searches, unreliable conversion tracking or oversized input produce no recommendations. Model input is limited to 900 KB; every query is analyzed before that check, without silent sampling. Query evidence is persisted separately and paginated.

Pending/active overlapping scopes and repeated recent proposals are suppressed. Approval rechecks catalog fingerprints and rule/experiment conflicts under a per-store Mongo transaction. Pending proposals expire after seven days.

## Decisions and measurement

Approval starts an always-on query-scoped treatment. A/B uses an unchanged control and an equal-weight variant, with stable session assignment. Stop removes treatment for new searches. Promotion closes the randomized experiment and starts a separate always-on measurement; historical A/B data remains available. A/B stops after 21 days unless stopped/promoted earlier. Always-on changes remain until stopped.

The primary metric is frozen at creation: purchase if measurable, otherwise cart. Missing sources never become measured zero. Rates count distinct sessions after each session's own first assignment, reject contaminated arms, and deduplicate orders. Conversion windows are cart 2 h and purchase 24 h. Every denominator waits 24 h for equal follow-up. Session aliases/devices are not stitched: matching search/tracking IDs are required. For long-running direct changes, monitoring covers the most recent 28 days, returned explicitly.

Always-on results are observational. A/B reports an observed difference and conservative Wilson interval subtraction; at least 100 mature sessions per arm and 20 conversions are required for an indication. There is no automatic winner/promotion. Repeated peeking, tracking gaps and changing traffic remain limitations. Raw session IDs and private keys never leave the server. Report creation and monitoring share Studio's bounded analytics work gate to avoid memory spikes.

## Production rollout

Deploy main in three repositories:

1. `dashboard-server`: search-side actions, A/B in tenant engines, health capability `features.weeklyReviewV1: true`.
2. `tenant-studio`: report/decision/monitor routes, Mongo transactions, active-experiment refresh every 30 seconds, and updated storefront-widget support.
3. `semantix`: the frontend panel and authenticated proxy allowlist.

No new secret is required. Reuse existing Mongo/Redis/Gemini/Studio token configuration. Mongo must support transactions; Studio and search must share tenant/control-plane Mongo databases. Studio can publish through the authenticated search-server bridge, using the search server’s Redis connection; Studio no longer requires its own REDIS_URL for experiments. Activation is refused until the search capability and a verified publication channel are available. The bridge uses GET /experiments/publication for preflight/status and POST for republishing Mongo-approved store definitions. It ignores browser-provided definitions, independently scopes the store, republishes sibling keys, confirms the Redis write and refreshes its 120-second TTL every 30 seconds. Deploy the dashboard-server version advertising features.experimentPublication: true before the Studio update. Publication is distinguished from shopper rendering.

The current Studio widget reuses the `semantix_session_id` cookie and sends `serpFeatures: ['weekly-serp-v1']`, renders plain explanations, and renders complementary product links on the store's own origin. Older storefronts may support explanation/order changes but require the updated integration for structured bundles. Monitoring flags missing client-reported presentation support. An assignment is not proof of rendering. Deploying services does not automatically update installed merchant plugins/themes.

## Authenticated routes

All under `/api/customer-dashboard/`:

- `GET/POST optimization/weekly-review`
- `GET optimization/weekly-review/queries?page=0&query=...`
- `POST proposals/:id/weekly/{approve,test,reject,stop,promote}`
- `GET proposals/:id/monitor`

Tenant, database and actor are derived from the authenticated session and checked independently in Studio. Only the existing admin picker permits store selection.

## Search growth in Studio

Studio's **צמיחה מהחיפוש** tab now places a search growth panel before the existing engine/catalog review. Connected projects resolve their store from the saved `existingClient.dbName`; request bodies never choose another store or API key. The same tenant-scoped growth endpoints are available to the customer dashboard:

- `GET optimization/search-growth`
- `POST optimization/search-growth/scan`
- `POST optimization/search-growth/settings` with `{enabled:boolean}`

The operator UI uses authenticated `/api/projects/:id/growth` routes for these operations, weekly proposal generation, A/B activation, stopping, promotion and monitoring. It can also pass an opportunity's evidence into the Studio conversation for a draft-only diagnosis. It preserves the original engine review in a disclosure panel.

Monitoring is explicitly enabled per store. A server worker checks every minute and refreshes one due store at a time, approximately hourly, using a rolling seven-day window. It resumes persisted enabled monitors after restart. It runs deterministic analytics without model calls or search-setting changes. A Mongo lease prevents concurrent instances scanning the same store; scans share the existing bounded analytics gate, and failures preserve the last successful snapshot. This is an in-process worker: Studio must remain running. A scan does not automatically generate model proposals or activate an experiment.

Opportunities include measured zero results, rapid changes of wording (excluding prefix typing), low engagement rates (the union of recorded clicks, carts and purchases, so direct cart actions are not failures), click-to-cart drop-off and cart-to-purchase drop-off relative to the store's own measured funnel. All query groups are examined; the panel initially shows five priorities, expandable to the top 50, with a total count. Priority combines volume, affected fraction and evidence coverage, not estimated lost revenue. Evidence volume is not causal confidence. Unknown or truncated tracking cannot become measured zero. Conversion opportunities use sessions whose first search has a full 24h follow-up, with events capped at that session's own window. Synthetic query traffic is excluded from opportunity baselines.

Every proposal and experiment records `revenue_per_search_session` as its business objective while retaining the existing engine-compatible cart/purchase metric. Proposal planning receives growth opportunities and business evidence, distinguishes conversion and basket-value hypotheses, and requires catalog support for complementary products in addition to co-cart evidence.

Experiment monitoring adds `business` alongside the existing conversion results. It measures purchase conversion, deduplicated recorded order revenue, average order value and revenue per mature search session, including zero-revenue sessions. An order is attributed once, after its session's first exposure and within 24h, to an exact targeted query. Conflicting assignments are excluded. Missing order IDs, invalid amounts/currencies or incomplete purchase tracking suppress monetary inference. Multiple currencies are displayed separately and never combined into one revenue-per-session metric. Amounts are gross recorded totals, not refund-adjusted or incremental revenue.

The revenue comparison reports an observed difference and approximate independent-session mean interval (zero-revenue sessions included). An indication requires at least 100 mature sessions and 20 orders in **each** arm, but is not a power calculation or a sequentially valid test. Skewed revenue and repeated inspection remain limitations. AOV is descriptive; it has no significance claim. The UI says **עדיין אין הכרעה** when evidence is insufficient. It never promotes automatically. Direct changes remain observational. Revenue is shown alongside purchase conversion; latency is not currently collected by this monitor and must be checked separately before rollout. Publishing still requires the existing search-engine capability and publication checks; installed storefronts need presentation support for product bundles.
