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

No new secret is required. Reuse existing Mongo/Redis/Gemini/Studio token configuration. Mongo must support transactions; Studio and search must share Redis/tenant databases. Activation is refused until the search capability and Redis are available. Publication is distinguished from shopper rendering.

The current Studio widget reuses the `semantix_session_id` cookie and sends `serpFeatures: ['weekly-serp-v1']`, renders plain explanations, and renders complementary product links on the store's own origin. Older storefronts may support explanation/order changes but require the updated integration for structured bundles. Monitoring flags missing client-reported presentation support. An assignment is not proof of rendering. Deploying services does not automatically update installed merchant plugins/themes.

## Authenticated routes

All under `/api/customer-dashboard/`:

- `GET/POST optimization/weekly-review`
- `GET optimization/weekly-review/queries?page=0&query=...`
- `POST proposals/:id/weekly/{approve,test,reject,stop,promote}`
- `GET proposals/:id/monitor`

Tenant, database and actor are derived from the authenticated session and checked independently in Studio. Only the existing admin picker permits store selection.
