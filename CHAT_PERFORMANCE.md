# Customer dashboard chat latency

Measured on 21 October 2026 against the real Beautics Studio catalog and Mongo
analytics, using the existing Gemini agent model. These are local server
measurements over the actual in-process customer operation and provider; they are
not production browser latency or a statistical SLA. The benchmark does not write
production conversations, rules, proposals or catalog data.

| Request | Before | After |
| --- | ---: | ---: |
| Catalog size, full answer | 23.0 s | 5.2 s |
| Analytics question, cold report, full answer | 29.5 s | 12.5 s |
| Same analytics question, report already available | 29.5 s (report rebuilt each turn) | 4.2 s |
| First model request for catalog question | 18.4 s | 0.20 s |
| Event loading for a fixed 30-day window | 14.52 s | 3.64 s |

On the final run, cached analytics began streaming after 2.9 s and completed in
4.2 s. The catalog question used one model call before and after. Cold analytics used
two; cached analytics needed one. Provider timing varied between runs (catalog
answers measured approximately 4.7–6.8 s after the change).

The fixed-window event comparison read 6,882 searches, 6,352 clicks, 17,108 cart
events, 4,801 checkout starts and 1,361 purchases. The complete normalized event
objects had the same SHA-256 digest for batch sizes 200 and 1,000:
`6622a525bc2a2a0f44c31503f71021a74f8bf4de0cef71063c600584b1dc4cf2`.
No sources were truncated. Peak process RSS was 209 MiB in the sequential
comparison, including allocations retained from the previous pass.

## Changes

- Catalog and merchandising questions no longer wait for an unrelated full report
  or a second seven-day shopper activity scan.
- Dashboard and chat share at most four measured reports for 60 seconds after
  computation. In-flight requests are coalesced. Store/range boundaries,
  invalidation, missing-source flags and unavailable conversion rates are retained.
- A fresh report is supplied as measured context so the model can answer directly.
  Otherwise it retrieves the same report through `dashboard_analytics` on demand.
  Customer chat no longer advertises legacy analytics tools with a different
  measurement methodology.
- Project fingerprinting is deferred until a revision is actually drafted.
- Event reads use bounded batches of 1,000 projected rows; sources remain sequential
  and keep the existing row/byte limits and completeness checks.
- Conversation reads project only request/answer and use the compound
  `agent_conversation_history` index. Progress writes are coalesced; streamed text
  never waits for a Mongo progress write.
- Gemini streams JSON message text through Studio, NDJSON, dashboard SSE and the
  authenticated frontend proxy. Only the first root `message` string is decoded;
  reasoning, notes and tool arguments cannot become answer text. Incomplete JSON
  escapes and split Unicode remain buffered.
- Read-only answer previews are marked as being written and replaced by the final
  validated summary. Proposed actions, mutated drafts and explicit query
  verification wait for the existing checks. No action becomes live without the
  existing approval flow. Cancellation reaches the provider.
- The frontend avoids reloading dashboard analytics after merely sending a chat
  message. Polling backs off while SSE is connected and remains as a fallback.

Each completed run stores `timings` (first model, first text, model time, analytics
time and total Studio time) plus `analyticsStatus`, allowing production latency
to be assessed independently of these sample runs.

## Reproduce

With private Mongo/provider configuration already present locally:

```sh
node --env-file=.env scripts/benchmark-customer-chat.mjs --db=woo-beautics-shop-co-il --data-dir=/path/to/studio/data --output=/tmp/chat-after.json
```

For comparison with a pre-change checkout, copy the benchmark script into its
`scripts/` folder, remove the import of `report-cache.js` (unavailable there), and
run with `--legacy`; that checkout uses the original workspace and analytics
paths. The checked-in measurements above were captured from the original code
before editing it. No model downgrade or cached generated answers are involved.
