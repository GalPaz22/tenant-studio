# Customer dashboard chat

The customer dashboard uses the real `studioAgent` and the existing store project. `POST /api/customer-chat/turn` streams NDJSON to the optimizer; `POST /api/customer-chat/approve` applies a reviewed draft. Both require the server-only `X-Studio-Customer-Token`, matching `STUDIO_CUSTOMER_API_TOKEN`, and resolve the supplied store API key against MongoDB. The normal operator Studio token never authorizes these routes.

Set the same `STUDIO_CUSTOMER_API_TOKEN` on Studio and search-optimizer. The optimizer also needs `DASHBOARD_CHAT_ENGINE=studio` and `STUDIO_SERVICE_URL` pointing at this service's HTTPS origin. Keep Studio project/draft storage on the existing persistent `STUDIO_DATA_DIR`; import or restore the existing customer project there before enabling chat. If multiple projects share a dbName, configure `STUDIO_CUSTOMER_PROJECTS` as JSON, for example `{"manoVino":"2b3f29d3-1caf-4193-a527-d7da17bbae85"}`. The project must actually belong to that database.

Questions do not save or publish the project. The agent sees the customer's conversation, not private operator messages. Product promotions, visibility and pins become pending optimizer proposals. Supported Studio rule/catalog edits become private drafts; approval compares the original project fingerprint, retains concurrent edits by refusing stale drafts, and reports saving and publication separately. Model calls are bounded and interrupted turns cannot save drafts. Plugin editing, deployment and cross-tenant operations are excluded from this customer toolset.

Validation: `npm test`. The customer tests cover authentication, tenant mapping and isolation, pending merchandising, deferred project writes, stale draft rejection and idempotent approval.
