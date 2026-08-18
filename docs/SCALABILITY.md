# Phase 1 Scalability Baseline

This pass hardens the current Version 1 architecture without turning Vigorune
into a required-backend product. IndexedDB remains authoritative, accounts stay
optional, and a claim such as “100,000 registered users” is not a concurrency
claim. Capacity must be evaluated from active users, burst shape, request
multiplication, payload size, cache hit rate, provider quotas, and serverless
instance count.

## Request Inventory And Boundaries

| Flow                       | Boundary                             | Main amplification risk                          | Phase 1 protection                                                                                                                |
| -------------------------- | ------------------------------------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Food search/detail/barcode | Browser → Vercel → USDA/OFF          | Repeated searches and provider fan-out           | Normalized bounded cache, in-flight coalescing, result cap, 8 KiB body, 12 s deadline, endpoint rate limits                       |
| Meal photos                | Browser → Vercel → Redis → OpenAI    | Large base64 images and paid inference           | Client compression, 1–3 images, 3 MB body, strict output schema, 40 s provider deadline, atomic shared fail-closed 6/10 min limit |
| Feedback                   | Browser → Vercel → webhook           | Spam and webhook stalls                          | 8 KiB body, fail-closed 5/10 min limit, 5 s deadline                                                                              |
| Rest-timer scheduling      | Browser → Vercel → QStash → Web Push | Duplicate/replaced jobs and retries              | Validate first, schedule revision deduplication, 8 KiB bodies, fail-closed rate limit, signed delivery                            |
| Cloud snapshots            | Browser → Supabase                   | Full replace uploads and deterministic seed data | Compact cloud format 1, 15 min throttle, 8 MiB preflight cap, metadata-only conflict check                                        |
| Daily graph rows           | Browser → Supabase                   | Up to 90 unchanged conflict writes per load      | Account/date fingerprints; only changed rows upsert                                                                               |

`GET /api/health` reports configuration booleans only. It never exposes
credentials, user data, provider payloads, or account identifiers.

## Food Providers

Search, detail, and barcode operations cache normalized successful results in a
bounded per-instance cache. Search uses a 15-minute TTL/300-entry bound; detail
uses six hours/500 entries; barcode uses six hours/250 entries. Identical
in-flight calls coalesce. Provider-key tests bypass the cache, errors are not
cached, and transient provider failures are not converted into durable “not
found” results.

The current cache and limiter are intentionally process-local. Serverless cold
starts, evictions, regions, and horizontal instances lower the effective hit
rate and multiply the nominal quota. Before traffic requires a global budget,
move the same cache/limiter interfaces to a shared low-latency store. A USDA
bulk-dataset adapter may later reduce interactive API dependence, but Phase 1
does not bundle or ingest a new database.

## OpenAI Meal Analysis

The browser never receives or stores `OPENAI_API_KEY`. `/api/meal-analysis`
accepts bounded JPEG, PNG, or WebP base64 inputs, validates the request again on
the server, and calls the OpenAI Responses API with strict structured output and
`store: false`. The default deployment model is `gpt-5.6-terra`; the server may
override it through `OPENAI_MEAL_MODEL` after quality/cost evaluation.

Before OpenAI is called, production uses one shared Redis fixed window across
all Vercel instances. One Lua operation atomically increments the counter,
starts the ten-minute expiry on the first increment, and returns the remaining
TTL. The allowance remains six requests per ten minutes per anonymous client;
the seventh returns `429` and `Retry-After`. Redis requests have a 1.5-second
deadline. Missing configuration, timeout, non-success response, or malformed
response fails closed with `503`, so a paid request never falls back to a
per-instance allowance. Local tests may still inject the existing in-memory
`ServerRateLimiter`; free food-provider routes retain their documented
per-instance/fail-open storage policy.

The Redis key is `vigorune:rate-limit:<scope>:<digest>`, where `<digest>` is a
bounded HMAC-SHA-256 value derived from the anonymous IP/user-agent key. Raw IP
addresses, user agents, meal notes, images, API keys, request counts, Redis
URLs, and Redis tokens are not included in health output or shared-store keys.

The prompt treats the optional meal note only as scoped meal context. Output is
validated before it reaches the recipe draft. Images and provider responses are
not written to IndexedDB, Supabase, logs, or the cloud snapshot by this route.
Only a user’s later explicit Log food or Save as recipe action writes the
reviewed nutrition estimate through existing local flows.

## Cloud Cost Shape And Compact Format

Manual JSON backup format 1 remains the full-fidelity portable format. Cloud
snapshots now use the separate `cloudSnapshotFormatVersion: 1` envelope, record
their source backup format, and omit only records that exactly equal the
current deterministic built-in exercise/program seeds. Custom copies,
user-created data, modified built-ins, archived or hidden user choices, active
cycles, workouts, history, nutrition, bodyweight, and settings remain in the
payload. Restore expands current deterministic seed records in memory, overlays
preserved records by stable ID, validates the resulting full backup, and only
then enters the existing replace transaction. Legacy cloud snapshots using
manual backup format 1 remain readable. Unsupported future compact versions are
rejected before IndexedDB changes.

Measured final serialized cloud rows, including row metadata and a synthetic
user ID, on 2026-08-18:

| Local state                  | Previous full row | Compact row | Reduction | Full records | Compact records |
| ---------------------------- | ----------------: | ----------: | --------: | -----------: | --------------: |
| Fresh initialized app        |           513,176 |       1,401 |    99.73% |          804 |               1 |
| After built-in programs seed |         1,315,541 |       1,401 |    99.89% |        1,765 |               1 |
| Representative user records  |         1,318,178 |       4,034 |    99.69% |        1,771 |               7 |

The final row remains replace-only, so upload traffic is `active backup uploads
× average serialized row bytes`; stored size is approximately `cloud users ×
latest average row bytes`. The 8 MiB cap is calculated from that final row
before Supabase is contacted. It prevents an unbounded upload but is not a
promise that every future user dataset fits. GPS run samples remain local-only.

Using the measured 4,034-byte representative row, latest-row storage is:

| Cloud users | Representative compact storage | Previous representative full storage |
| ----------: | -----------------------------: | -----------------------------------: |
|       1,000 |                       3.85 MiB |                             1.23 GiB |
|      10,000 |                      38.47 MiB |                            12.28 GiB |
|     100,000 |                     384.71 MiB |                           122.77 GiB |

Daily upload volume uses the same table multiplied by average successful
backups per cloud user per day. For example, two successful backups per day at
100,000 representative users is about 769 MiB/day before protocol/database
overhead. Actual capacity planning must use p50/p95 row size and active backup
frequency rather than assuming every registered account uploads daily.

## Rate Limits, Failure Policy, And Idempotency

Installed iOS PWA Google sign-in reuses the configured Redis REST integration
for a five-minute, one-time PKCE authorization-code relay. Relay rows contain
no account or fitness data and are consumed atomically. Relay creation is
limited to 10 attempts per anonymous client per 10 minutes and fails closed
when Redis is unavailable. Monitor relay create failures, callback failures,
expirations, and Redis latency. A safe rollback disables installed-PWA Google
sign-in while retaining normal browser PKCE sign-in; it must never fall back to
moving Supabase access or refresh tokens through URLs, Redis, or logs.

Meal analysis uses the shared atomic Redis window described above. Food,
feedback, and timer limits remain bounded per-instance windows. Food lookup
fails open only if limiter storage itself is unavailable; normal quota
exhaustion returns `429` and `Retry-After`. Feedback and timer scheduling remain
fail closed. The AI per-client limit is global across serverless instances, but
it is not a global spend ceiling and cannot stop a sufficiently distributed
botnet by itself.

Timer schedule revisions form the logical idempotency key. A failed client
retry reuses its revision, and QStash receives a deterministic deduplication ID.
Replacement scheduling publishes the new job before canceling the explicit old
message. Callback signatures are verified before parsing and Web Push delivery.

## Observability And Capacity Signals

Structured request logs include request ID, route, method, outcome/status,
duration, rate-limit result, cache outcome, and safe size/count fields. They do
not include request bodies, API keys, image data, push subscriptions, IP
addresses, meal notes, or raw provider errors.

Track at minimum:

- route request rate, p50/p95/p99 latency, 4xx/5xx/429 counts, timeout rate, and
  serverless concurrency/cold starts;
- food cache hit/coalesced/miss rates, provider calls per app action, provider
  latency/errors, and normalized result counts;
- OpenAI requests, input images/bytes, output validation failures, token usage,
  spend limits, model-specific cost, Redis decision latency, Redis
  unavailable/timeout rate, and `429` rate;
- QStash publish/cancel/dedup and callback outcomes plus Web Push failures;
- Supabase PostgREST requests, egress, p50/p95/max backup-row bytes, compact
  format versions, 8 MiB rejections, restore-validation failures, daily row
  writes, database/table size, latency, conflicts, and RLS failures.

Alert on any sustained Redis-unavailable response rate for the paid route,
OpenAI calls without a preceding allowed limiter decision, unusual growth in
`429` or unique hashed keys, provider spend approaching the configured budget,
p95 snapshot size growth, any 8 MiB rejection, unsupported restore versions,
or sustained cloud-backup failure. Thresholds must be derived from the selected
Vercel, Redis, Supabase, OpenAI, QStash, and provider plans rather than copied
from registered-user counts.

OpenAI request exposure is based on daily active use, not registered accounts.
If `D` is meal-analysis DAU, `A` is accepted analyses per active user per day,
and `C` is the observed blended provider cost per successful analysis, then
monthly requests are approximately `30 × D × A` and monthly cost is
`30 × D × A × C`. At `A = 1.2`, 1,000/10,000/100,000 meal-analysis DAU imply
36,000/360,000/3,600,000 monthly requests. Use actual provider token and image
usage to determine `C`; the six-per-ten-minute client limit is abuse control,
not a budgeting model.

## Deployment And Rollout

Required server configuration is integration-specific. Meal analysis requires
`OPENAI_API_KEY`, `AI_RATE_LIMIT_HASH_SECRET`, and either
`UPSTASH_REDIS_REST_URL` plus `UPSTASH_REDIS_REST_TOKEN`, or the compatible
`KV_REST_API_URL` plus `KV_REST_API_TOKEN` pair. `OPENAI_MEAL_MODEL` is
optional. The hash secret should be an independently generated random value of
at least 32 bytes. All limiter values are server-only and must never use the
`VITE_` prefix. `GET /api/health` reports only safe configuration booleans,
including `distributedAiProtection`; it never reports values, endpoints,
counts, or identifiers.

Roll out first to the isolated developer-stable origin. Verify configuration
health, bounded invalid-request behavior, explicit user review, and provider
dashboards before increasing traffic. Roll back the deployment if error rate,
latency, provider spend, or duplicate side effects exceed the agreed threshold;
the local-first application remains usable while optional integrations are
unavailable.

For an AI-limiter rollback, disable the paid endpoint or remove its OpenAI key
before removing distributed enforcement; never fall back to per-instance
allowances in production. For a compact-backup rollback, stop compact writes
while retaining the compact reader. Do not deploy an older build that cannot
read already-written compact rows. If a Redis incident occurs, keep meal
analysis fail closed and leave local nutrition workflows available. If compact
restore errors rise, preserve existing cloud rows, disable new backup writes,
and ship a reader fix; do not rewrite or bulk-convert user snapshots in place.
