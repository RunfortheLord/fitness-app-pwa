/// <reference types="node" />

import {
  isAnalyticsEventName,
  isValidAnalyticsDay,
  isValidInstallId,
  sanitizeAnalyticsEvents,
  type AnalyticsRecord,
} from '../domain/analytics.js'
import {
  evaluateRateLimit,
  type DistributedRateLimiterEnvironment,
  type ServerRateLimiter,
} from './serverRateLimiter.js'

// First-party, privacy-first analytics ingest. This module never persists or
// forwards anything beyond {installId, day, name}: the batch is reduced to that
// shape here, so even a buggy or malicious client cannot get a richer or more
// identifying record into storage. There are no accounts, IPs, user agents, or
// health values in the stored record.

export type AnalyticsErrorCode =
  | 'invalid_request'
  | 'not_configured'
  | 'rate_limited'
  | 'service_unavailable'
  | 'sink_failed'

export type AnalyticsIngestResult =
  | { ok: true; accepted: number }
  | {
      ok: false
      error: {
        code: AnalyticsErrorCode
        message: string
        retryAfterSeconds?: number
      }
    }

/** Persists sanitized records. May reject; the caller turns that into a bounded
 * `sink_failed` error and never leaks the underlying reason to the client. */
export type AnalyticsSink = (records: AnalyticsRecord[]) => Promise<void>

export type AnalyticsIngestInput = {
  installId: unknown
  events: unknown
}

export type AnalyticsConfig = {
  clientKey?: string
  rateLimiter: ServerRateLimiter | undefined
  sink: AnalyticsSink | undefined
}

// A batch carries at most one flush of a device's queue.
const RATE_LIMIT = 60
const RATE_WINDOW_MS = 60 * 1_000

export async function handleAnalyticsIngest(
  input: AnalyticsIngestInput,
  config: AnalyticsConfig,
): Promise<AnalyticsIngestResult> {
  if (!isValidInstallId(input.installId)) {
    return invalid('A valid install id is required.')
  }
  const events = sanitizeAnalyticsEvents(input.events)
  if (events.length === 0) {
    return invalid('No valid analytics events were provided.')
  }
  if (!config.sink) {
    return {
      ok: false,
      error: {
        code: 'not_configured',
        message: 'Analytics is not configured.',
      },
    }
  }

  const rateLimit = await evaluateRateLimit({
    failClosed: true,
    key: config.clientKey ?? input.installId,
    limit: RATE_LIMIT,
    limiter: config.rateLimiter,
    scope: 'analytics',
    windowMs: RATE_WINDOW_MS,
  })
  if (!rateLimit.allowed) {
    return {
      ok: false,
      error: {
        code: rateLimit.available ? 'rate_limited' : 'service_unavailable',
        message: rateLimit.available
          ? 'Analytics events are arriving too quickly.'
          : 'Analytics is temporarily unavailable.',
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
    }
  }

  const records: AnalyticsRecord[] = events.map((event) => ({
    installId: input.installId as string,
    day: event.day,
    name: event.name,
  }))

  try {
    await config.sink(records)
  } catch {
    return {
      ok: false,
      error: {
        code: 'sink_failed',
        message: 'Analytics events could not be recorded.',
      },
    }
  }

  return { ok: true, accepted: records.length }
}

export function statusForAnalyticsError(code: AnalyticsErrorCode): number {
  switch (code) {
    case 'invalid_request':
      return 400
    case 'not_configured':
    case 'service_unavailable':
      return 503
    case 'rate_limited':
      return 429
    case 'sink_failed':
      return 502
    default:
      return 500
  }
}

function invalid(message: string): AnalyticsIngestResult {
  return { ok: false, error: { code: 'invalid_request', message } }
}

// ---------------------------------------------------------------------------
// Redis-backed sink (Upstash / Vercel KV REST). Events are appended to a single
// capped list. Retention is computed offline by reading that list back and
// running computeLaunchMetrics over it (see docs/ANALYTICS.md). Reusing Redis
// keeps analytics on the infrastructure already in the stack — no new vendor,
// no new CSP entry (the client only ever calls the same-origin /api/analytics).
// ---------------------------------------------------------------------------

export const ANALYTICS_LIST_KEY = 'vigorune:analytics:events'

type StoredAnalyticsRecord = { i: string; d: string; n: string }

export type AnalyticsRedisConfig = {
  restToken: string
  restUrl: string
}

export function readAnalyticsRedisConfig(
  environment: DistributedRateLimiterEnvironment,
): AnalyticsRedisConfig | undefined {
  const upstashUrl = environment.UPSTASH_REDIS_REST_URL?.trim()
  const upstashToken = environment.UPSTASH_REDIS_REST_TOKEN?.trim()
  const kvUrl = environment.KV_REST_API_URL?.trim()
  const kvToken = environment.KV_REST_API_TOKEN?.trim()
  const [restUrl, restToken] =
    upstashUrl && upstashToken
      ? [upstashUrl, upstashToken]
      : kvUrl && kvToken
        ? [kvUrl, kvToken]
        : []
  if (!restUrl || !restToken) {
    return undefined
  }
  return { restToken, restUrl: restUrl.replace(/\/+$/, '') }
}

export function createRedisAnalyticsSink(
  config: AnalyticsRedisConfig & {
    fetchImpl?: typeof fetch
    maxEvents?: number
    timeoutMs?: number
  },
): AnalyticsSink {
  const fetchImpl = config.fetchImpl ?? fetch
  const maxEvents = config.maxEvents ?? 100_000
  const timeoutMs = config.timeoutMs ?? 2_000
  const restUrl = config.restUrl.replace(/\/+$/, '')
  return async (records) => {
    if (records.length === 0) {
      return
    }
    const values = records.map((record) =>
      JSON.stringify({
        i: record.installId,
        d: record.day,
        n: record.name,
      } satisfies StoredAnalyticsRecord),
    )
    const controller = new AbortController()
    const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(`${restUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.restToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['RPUSH', ANALYTICS_LIST_KEY, ...values],
          ['LTRIM', ANALYTICS_LIST_KEY, String(-maxEvents), '-1'],
        ]),
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new Error('analytics_sink_unavailable')
      }
    } finally {
      globalThis.clearTimeout(timeoutId)
    }
  }
}

/**
 * Decode raw list entries (as returned by a Redis LRANGE) back into analytics
 * records for computeLaunchMetrics. Malformed entries are skipped.
 */
export function decodeStoredAnalyticsRecords(
  values: unknown,
): AnalyticsRecord[] {
  if (!Array.isArray(values)) {
    return []
  }
  const records: AnalyticsRecord[] = []
  for (const value of values) {
    if (typeof value !== 'string') {
      continue
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(value)
    } catch {
      continue
    }
    if (!parsed || typeof parsed !== 'object') {
      continue
    }
    const candidate = parsed as Record<string, unknown>
    if (
      isValidInstallId(candidate.i) &&
      isValidAnalyticsDay(candidate.d) &&
      isAnalyticsEventName(candidate.n)
    ) {
      records.push({
        installId: candidate.i,
        day: candidate.d,
        name: candidate.n,
      })
    }
  }
  return records
}
