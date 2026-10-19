# Customer dashboard

The customer frontend connects directly to this Studio service using
`STUDIO_SERVICE_URL` and the private `STUDIO_CUSTOMER_API_TOKEN`. Set the same
token in Vercel and Studio, then redeploy both. The four customer panels do not
require a separately deployed optimizer or OPS password.

`/api/customer-dashboard/*` exposes measured analytics, catalog visibility/boosts,
saved concierge history/settings, management chat history/progress and explicit
proposal approval/rejection. The frontend's existing NextAuth session resolves
the store key server-side. Studio independently authenticates
`X-Studio-Customer-Token`, resolves the store in Mongo and verifies resource
ownership before reading or writing. Unknown customer endpoints stay inside
this boundary and cannot fall through to operator APIs.

`core/dashboard/` contains the dashboard domain services migrated from the
previous optimizer service. The existing measured analytics/merchandising
semantics and Mongo collections are retained. These are standalone ESM modules;
no optimizer server, Claude SDK, cron-based model work, or loopback HTTP dependency
is started. The Studio runner executes the existing customer-chat operations
in process, using the real `studioAgent` and customer project. The original
`/api/customer-chat/turn` and `/approve` bridge remains available for older callers.

Use `STUDIO_DASHBOARD_MONGODB_URI` or `MONGODB_URI` for the shared production data.
Analytics and saved conversations work without a local Studio project. Management
chat restores a scoped checkpoint from `<tenant>.studio_customer_project` when its
local project is missing. If no checkpoint exists, it opens the real saved customer
catalog automatically (bounded to 50,000 products / 24 MiB of source data). This
connection does not publish changes. Approved customer revisions are checkpointed
before saving locally. Checkpoints exclude private operator chats and plugin/crawl
workspaces. Persistent `STUDIO_DATA_DIR` is still recommended for operator projects
and pending chat drafts.
When multiple projects share a store, configure `STUDIO_CUSTOMER_PROJECTS` with
an explicit mapping; the project's actual database ownership is still checked.
Use the live search engine's shared `REDIS_URL` for immediate cache clearing and
publication of saved exact-query rules. Its absence does not block analytics.

Questions do not save or publish projects. Product promotion, visibility and
pins are pending proposals. Studio edits remain private drafts; approval checks
the original project fingerprint and refuses stale/foreign drafts. Customer
history excludes operator messages. Mongo retains runs, history, proposals,
per-store leases and cancellation flags across instances. Publication is reported
separately from persistence; interrupted turns cannot save Studio drafts.

Run `npm test`. Coverage includes the existing Studio tests, migrated analytics
and product tests, independent customer authentication/ownership, in-process
streaming, stale drafts and management requests that remain pending approval.
