# Analytics (Launch Metrics)

> Status at time of writing: **shipped OFF**. Analytics collects nothing until it
> is deliberately enabled (see [Enabling](#enabling-it)). This document describes
> what it does when enabled, why it is privacy-safe, and how to read activation
> and D1/D7/D30 retention. It supports **Step 2** of `docs/LAUNCH_PLAN.md`.

## Goal

Measure the launch metrics defined in the launch plan — installs, **activation**,
and **D7 / D30 retention** — without compromising Vigorune's core promise:
private, local-first, no account, does not sell your data.

## Approach chosen and why

**A minimal first-party event endpoint (`/api/analytics`) that appends anonymous
event records to the Redis (Upstash / Vercel KV) instance already in the stack.**

Considered alternatives and why they were rejected:

| Option                                       | Verdict                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Analytics / any ad-tech SDK           | **Rejected outright.** Contradicts the product's privacy positioning, adds third-party tracking, and needs CSP `connect-src`/`script-src` exceptions.                                                                                                                                                                                              |
| Hosted privacy analytics (Plausible / Umami) | Cookieless and aggregate, but by design they do **not** correlate a stable per-install identifier across visits, so they cannot produce cohort D1/D7/D30 retention — the number Step 7 hinges on. They would also add a new external origin to the CSP and a new vendor/cost.                                                                      |
| First-party endpoint (**chosen**)            | Same-origin `POST /api/analytics`, so **no CSP change** and it works with the offline model. Reuses Upstash Redis already configured for rate limiting / the OAuth relay, so **no new vendor and ~no new ongoing cost** for a solo dev. Gives us the stable-install-id retention the plan requires while keeping the payload to name + coarse day. |

## What is tracked

Exactly four anonymous events, each carrying **only** an event name and a coarse
day (`YYYY-MM-DD` — no time of day), tagged with a stable anonymous install id:

| Event            | Fired when                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| `app_opened`     | The app shell starts (`src/main.tsx`). This is also the returning-visit signal used for retention. |
| `workout_logged` | A live workout is completed (`LiveWorkoutPage`).                                                   |
| `meal_logged`    | Any food/meal is logged on the Nutrition page (single choke point `reloadAfterFoodLog`).           |
| `run_tracked`    | A GPS/treadmill run is finished or a manual run is saved (`RunPage`).                              |

### The install id

Retention requires correlating repeat visits from the same install. That id is a
**random UUID** generated with `crypto.randomUUID()` and stored in
`localStorage` under `vigorune.analytics.installId`.

- It is **not** derived from, or joined to, any account, Apple/Google identity,
  email, device identifier, or fitness data. It exists only to group this
  device's own events.
- It resets whenever local storage is cleared or the user opts out (opt-out also
  deletes it), so it is not a durable cross-reset identifier.
- Design note: an install id is the minimum needed to compute retention. We
  deliberately store it client-side as an opaque UUID rather than deriving any
  server-side fingerprint from IP/user-agent for identity. (The rate limiter does
  hash IP+UA for abuse control only; that hash is never stored as an event field.)

## Why it is privacy-safe

- **No personal data, ever.** The payload is `{ installId, events: [{ name, day }] }`.
  The event names are an exhaustive allow-list; the server re-sanitises every
  batch (`sanitizeAnalyticsEvents`) and stores only `{i, d, n}`, so even a buggy
  or malicious client cannot introduce a richer or identifying field. There are
  no health values, no precise location, no account linkage, and no time-of-day.
- **Off by default and double-gated.** Nothing is sent unless the build sets
  `VITE_ANALYTICS_ENABLED=true` **and** the server has Redis configured.
- **Respects the user.** Do-Not-Track / Global Privacy Control and a local
  opt-out each independently suppress everything (no id created, no events
  queued, no requests).
- **Never blocks the app.** Every entry point swallows its own errors; events are
  queued locally and flushed best-effort. If the endpoint is unavailable or the
  device is offline, the app is unaffected and the queue is retried later. The
  local-first guarantee is untouched — analytics is purely additive.
- **No new attack/tracking surface.** Same-origin only; no third-party script,
  cookie, or CSP exception.

## Enabling it

1. **Client:** set `VITE_ANALYTICS_ENABLED=true` at build time (Vercel env for the
   target project). It defaults off, so existing/other builds keep collecting
   nothing. For the native (Capacitor) build, `VITE_PUBLIC_APP_ORIGIN` must point
   at the deployed origin (same variable feedback already uses).
2. **Server:** provide the Redis connection already used elsewhere —
   `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (or the `KV_REST_API_URL`
   / `KV_REST_API_TOKEN` pair) — plus `AI_RATE_LIMIT_HASH_SECRET` (≥32 chars) for
   the shared rate limiter. Without Redis the endpoint returns `not_configured`
   and records nothing.
3. Redeploy. Verify a real device produces rows (see below). Update the in-app
   privacy copy's effective date and the privacy drafts to state analytics is now
   live before turning it on for real users.

To turn it back off, unset `VITE_ANALYTICS_ENABLED` (client) or remove the Redis
config (server). Either alone stops collection.

### Opt-out

- **Do-Not-Track / GPC:** honoured automatically from the browser/OS.
- **Explicit opt-out:** `setAnalyticsOptOut(true)` (from
  `@services/analyticsService`) sets `vigorune.analytics.optOut` and deletes the
  install id + queue. `setAnalyticsOptOut(false)` re-enables. A Settings toggle
  can be wired to these when analytics is switched on; the mechanism is already
  respected today.

## How the data is stored

Each accepted event becomes one entry appended to the Redis list
`vigorune:analytics:events` (capped at the newest 100,000 via `LTRIM`). Each entry
is compact JSON: `{"i":"<installId>","d":"<YYYY-MM-DD>","n":"<event>"}`.

## Reading activation and D1/D7/D30 retention

The exact metric definitions live in one tested place —
`computeLaunchMetrics(records)` in `src/domain/analytics.ts`:

- **Activation:** an install that produced at least one `workout_logged`,
  `meal_logged`, or `run_tracked` event (`app_opened` alone is not activation).
- **Dn retention:** of installs first seen at least N days before the reference
  day (so they had the chance), the share that were active again on any day at
  least N days after their first day. This matches the launch plan's
  "still using at day 30" framing (D1, D7, D30 use N = 1, 7, 30).

To compute the metrics, read the list back and run the same function. Minimal
recipe (Node, using the Upstash REST API):

```js
// LRANGE vigorune:analytics:events 0 -1
import { decodeStoredAnalyticsRecords } from './src/server/analyticsApi.js'
import { computeLaunchMetrics } from './src/domain/analytics.js'

const res = await fetch(
  `${process.env.UPSTASH_REDIS_REST_URL}/lrange/vigorune:analytics:events/0/-1`,
  {
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
    },
  },
)
const { result } = await res.json() // array of JSON strings
const records = decodeStoredAnalyticsRecords(result)
console.log(computeLaunchMetrics(records))
// => { installs, activated, activationRate, retention: { d1, d7, d30 } }
// each retention point is { eligible, returned, rate }
```

`installs` is the denominator for activation; `retention.d30.rate` is the Step 7
target (aim ~20%+).

## Where the code lives

- `src/domain/analytics.ts` — pure event/validation logic + `computeLaunchMetrics`.
- `src/services/analyticsService.ts` — client transport: install id, offline
  queue, DNT/opt-out gating, best-effort flush. `trackAnalyticsEvent(name)` is the
  call used at each seam.
- `src/server/analyticsApi.ts` — request validation, PII stripping, rate limiting,
  and the Redis sink + read helpers.
- `api/analytics.ts` — the Vercel handler wiring the above.
- Seams: `src/main.tsx`, `src/pages/LiveWorkoutPage.tsx`, `src/pages/NutritionPage.tsx`,
  `src/pages/RunPage.tsx`.
