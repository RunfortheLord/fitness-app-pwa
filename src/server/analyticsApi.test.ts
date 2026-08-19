import { describe, expect, it, vi } from 'vitest'

import {
  ANALYTICS_LIST_KEY,
  createRedisAnalyticsSink,
  decodeStoredAnalyticsRecords,
  handleAnalyticsIngest,
  readAnalyticsRedisConfig,
  statusForAnalyticsError,
  type AnalyticsSink,
} from './analyticsApi.js'
import {
  createMemoryServerRateLimiter,
  type ServerRateLimiter,
} from './serverRateLimiter.js'

const INSTALL_ID = '55555555-5555-4555-8555-555555555555'

function allowingLimiter(): ServerRateLimiter {
  return createMemoryServerRateLimiter()
}

describe('handleAnalyticsIngest', () => {
  it('rejects a missing/invalid install id', async () => {
    const result = await handleAnalyticsIngest(
      {
        installId: 'not-a-uuid',
        events: [{ name: 'app_opened', day: '2026-08-19' }],
      },
      { rateLimiter: allowingLimiter(), sink: vi.fn() },
    )
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'invalid_request' },
    })
  })

  it('rejects a batch with no valid events', async () => {
    const result = await handleAnalyticsIngest(
      {
        installId: INSTALL_ID,
        events: [{ name: 'page_view', day: '2026-08-19' }],
      },
      { rateLimiter: allowingLimiter(), sink: vi.fn() },
    )
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'invalid_request' },
    })
  })

  it('returns not_configured when no sink is wired', async () => {
    const result = await handleAnalyticsIngest(
      {
        installId: INSTALL_ID,
        events: [{ name: 'app_opened', day: '2026-08-19' }],
      },
      { rateLimiter: allowingLimiter(), sink: undefined },
    )
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'not_configured' },
    })
  })

  it('records only {installId, day, name} — stripping any extra client fields (no PII)', async () => {
    const received: unknown[] = []
    const sink: AnalyticsSink = async (records) => {
      received.push(...records)
    }
    const result = await handleAnalyticsIngest(
      {
        installId: INSTALL_ID,
        events: [
          {
            name: 'workout_logged',
            day: '2026-08-19',
            latitude: 30.27,
            userId: 'account-123',
            email: 'a@b.com',
          },
        ],
      },
      { rateLimiter: allowingLimiter(), sink },
    )
    expect(result).toEqual({ ok: true, accepted: 1 })
    expect(received).toEqual([
      { installId: INSTALL_ID, day: '2026-08-19', name: 'workout_logged' },
    ])
    expect(Object.keys(received[0] as object).sort()).toEqual([
      'day',
      'installId',
      'name',
    ])
  })

  it('rate limits when the limiter denies the request', async () => {
    const denying: ServerRateLimiter = {
      check: () => ({
        allowed: false,
        available: true,
        remaining: 0,
        retryAfterSeconds: 30,
      }),
    }
    const result = await handleAnalyticsIngest(
      {
        installId: INSTALL_ID,
        events: [{ name: 'app_opened', day: '2026-08-19' }],
      },
      { rateLimiter: denying, sink: vi.fn() },
    )
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'rate_limited', retryAfterSeconds: 30 },
    })
  })

  it('fails closed (service_unavailable) when the limiter is unavailable', async () => {
    const result = await handleAnalyticsIngest(
      {
        installId: INSTALL_ID,
        events: [{ name: 'app_opened', day: '2026-08-19' }],
      },
      { rateLimiter: undefined, sink: vi.fn() },
    )
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'service_unavailable' },
    })
  })

  it('turns a sink failure into a bounded sink_failed error without leaking details', async () => {
    const sink: AnalyticsSink = async () => {
      throw new Error('redis exploded: secret token abc')
    }
    const result = await handleAnalyticsIngest(
      {
        installId: INSTALL_ID,
        events: [{ name: 'run_tracked', day: '2026-08-19' }],
      },
      { rateLimiter: allowingLimiter(), sink },
    )
    expect(result).toMatchObject({ ok: false, error: { code: 'sink_failed' } })
    expect(JSON.stringify(result)).not.toContain('secret token')
  })
})

describe('error status mapping', () => {
  it('maps codes to HTTP statuses', () => {
    expect(statusForAnalyticsError('invalid_request')).toBe(400)
    expect(statusForAnalyticsError('not_configured')).toBe(503)
    expect(statusForAnalyticsError('service_unavailable')).toBe(503)
    expect(statusForAnalyticsError('rate_limited')).toBe(429)
    expect(statusForAnalyticsError('sink_failed')).toBe(502)
  })
})

describe('createRedisAnalyticsSink', () => {
  it('appends compact records via RPUSH + LTRIM to a capped list', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true }) as Response)
    const sink = createRedisAnalyticsSink({
      restUrl: 'https://redis.example.com/',
      restToken: 'token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      maxEvents: 1000,
    })
    await sink([
      { installId: INSTALL_ID, day: '2026-08-19', name: 'app_opened' },
    ])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe('https://redis.example.com/pipeline')
    const commands = JSON.parse(String(init.body)) as unknown[][]
    expect(commands[0][0]).toBe('RPUSH')
    expect(commands[0][1]).toBe(ANALYTICS_LIST_KEY)
    expect(commands[1]).toEqual(['LTRIM', ANALYTICS_LIST_KEY, '-1000', '-1'])
    // The stored value is the compact {i,d,n} form — no account/PII fields.
    expect(JSON.parse(String(commands[0][2]))).toEqual({
      i: INSTALL_ID,
      d: '2026-08-19',
      n: 'app_opened',
    })
  })

  it('does not call the network for an empty batch', async () => {
    const fetchImpl = vi.fn()
    const sink = createRedisAnalyticsSink({
      restUrl: 'https://redis.example.com',
      restToken: 'token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    await sink([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('throws when Redis responds non-ok so the route reports sink_failed', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false }) as Response)
    const sink = createRedisAnalyticsSink({
      restUrl: 'https://redis.example.com',
      restToken: 'token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    await expect(
      sink([{ installId: INSTALL_ID, day: '2026-08-19', name: 'meal_logged' }]),
    ).rejects.toBeInstanceOf(Error)
  })
})

describe('readAnalyticsRedisConfig', () => {
  it('reads Upstash then Vercel KV variables', () => {
    expect(
      readAnalyticsRedisConfig({
        UPSTASH_REDIS_REST_URL: 'https://a/',
        UPSTASH_REDIS_REST_TOKEN: 'tok',
      }),
    ).toEqual({ restUrl: 'https://a', restToken: 'tok' })
    expect(
      readAnalyticsRedisConfig({
        KV_REST_API_URL: 'https://b',
        KV_REST_API_TOKEN: 'tok2',
      }),
    ).toEqual({ restUrl: 'https://b', restToken: 'tok2' })
    expect(readAnalyticsRedisConfig({})).toBeUndefined()
  })
})

describe('decodeStoredAnalyticsRecords', () => {
  it('parses stored records and skips malformed entries', () => {
    const records = decodeStoredAnalyticsRecords([
      JSON.stringify({ i: INSTALL_ID, d: '2026-08-19', n: 'app_opened' }),
      JSON.stringify({ i: 'bad', d: '2026-08-19', n: 'app_opened' }),
      JSON.stringify({ i: INSTALL_ID, d: 'nope', n: 'app_opened' }),
      JSON.stringify({ i: INSTALL_ID, d: '2026-08-19', n: 'page_view' }),
      'not json',
      42,
    ])
    expect(records).toEqual([
      { installId: INSTALL_ID, day: '2026-08-19', name: 'app_opened' },
    ])
  })
})
