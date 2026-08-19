import { describe, expect, it, vi } from 'vitest'

import {
  createMemoryServerRateLimiter,
  createRedisServerRateLimiter,
  evaluateRateLimit,
  readRedisRateLimiterConfig,
  type ServerRateLimiter,
} from './serverRateLimiter'

describe('server rate limiter', () => {
  it('limits each scope and key within a fixed window', async () => {
    let now = 1_000
    const limiter = createMemoryServerRateLimiter({ now: () => now })
    const input = {
      failClosed: true,
      key: 'client-a',
      limit: 2,
      limiter,
      scope: 'meal-analysis',
      windowMs: 10_000,
    }

    await expect(evaluateRateLimit(input)).resolves.toMatchObject({
      allowed: true,
      remaining: 1,
    })
    await expect(evaluateRateLimit(input)).resolves.toMatchObject({
      allowed: true,
      remaining: 0,
    })
    await expect(evaluateRateLimit(input)).resolves.toMatchObject({
      allowed: false,
      retryAfterSeconds: 10,
    })

    await expect(
      evaluateRateLimit({ ...input, key: 'client-b' }),
    ).resolves.toMatchObject({ allowed: true })
    now += 10_001
    await expect(evaluateRateLimit(input)).resolves.toMatchObject({
      allowed: true,
    })
  })

  it('fails closed for paid work and permits documented free-provider fallback', async () => {
    const unavailable: ServerRateLimiter = {
      check() {
        throw new Error('limiter unavailable')
      },
    }
    const base = {
      key: 'client-a',
      limit: 1,
      limiter: unavailable,
      scope: 'test',
      windowMs: 1_000,
    }

    await expect(
      evaluateRateLimit({ ...base, failClosed: true }),
    ).resolves.toMatchObject({ allowed: false, available: false })
    await expect(
      evaluateRateLimit({ ...base, failClosed: false }),
    ).resolves.toMatchObject({ allowed: true, available: false })
  })

  it('reports unavailable instead of evicting active clients at capacity', async () => {
    const limiter = createMemoryServerRateLimiter({ maxKeys: 1 })
    const base = {
      failClosed: true,
      limit: 10,
      limiter,
      scope: 'paid',
      windowMs: 60_000,
    }

    await expect(
      evaluateRateLimit({ ...base, key: 'first' }),
    ).resolves.toMatchObject({ allowed: true })
    await expect(
      evaluateRateLimit({ ...base, key: 'second' }),
    ).resolves.toMatchObject({ allowed: false, available: false })
  })

  it('shares one atomic allowance across simulated server instances and concurrent requests', async () => {
    const sharedStore = createMockRedisStore()
    const config = {
      fetchImpl: sharedStore.fetch,
      hashSecret: 'test-only-hash-secret-32-characters',
      restToken: 'test-only-redis-token',
      restUrl: 'https://redis.test',
    }
    const firstInstance = createRedisServerRateLimiter(config)
    const secondInstance = createRedisServerRateLimiter(config)
    const checks = Array.from({ length: 7 }, (_, index) =>
      (index % 2 === 0 ? firstInstance : secondInstance).check({
        key: '203.0.113.8|private-agent',
        limit: 6,
        scope: 'meal-analysis',
        windowMs: 600_000,
      }),
    )

    const decisions = await Promise.all(checks)
    const rejected = decisions.filter((decision) => !decision.allowed)

    expect(decisions.filter((decision) => decision.allowed)).toHaveLength(6)
    expect(rejected).toEqual([
      {
        allowed: false,
        available: true,
        remaining: 0,
        retryAfterSeconds: 600,
      },
    ])
    expect(sharedStore.keys).toHaveLength(7)
    expect(new Set(sharedStore.keys)).toHaveLength(1)
    expect(sharedStore.keys[0]).toMatch(
      /^vigorune:rate-limit:meal-analysis:[a-f0-9]{64}$/,
    )
  })

  it('never sends raw anonymous client information as the shared-store key', async () => {
    const rawClient = '198.51.100.4|Sensitive Browser Agent'
    const sharedStore = createMockRedisStore()
    const limiter = createRedisServerRateLimiter({
      fetchImpl: sharedStore.fetch,
      hashSecret: 'test-only-hash-secret-32-characters',
      restToken: 'test-only-redis-token',
      restUrl: 'https://redis.test',
    })

    await limiter.check({
      key: rawClient,
      limit: 6,
      scope: 'meal-analysis',
      windowMs: 600_000,
    })

    expect(sharedStore.fetch).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(sharedStore.fetch.mock.calls[0])).not.toContain(
      rawClient,
    )
    expect(sharedStore.keys[0]).not.toContain('198.51.100.4')
    expect(sharedStore.keys[0]).not.toContain('Sensitive Browser Agent')
  })

  it('returns unavailable within a bounded deadline when Redis stalls', async () => {
    const fetchImpl = vi.fn(
      (_input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }),
    )
    const limiter = createRedisServerRateLimiter({
      fetchImpl,
      hashSecret: 'test-only-hash-secret-32-characters',
      restToken: 'test-only-redis-token',
      restUrl: 'https://redis.test',
      timeoutMs: 5,
    })

    await expect(
      limiter.check({
        key: 'client-a',
        limit: 6,
        scope: 'meal-analysis',
        windowMs: 600_000,
      }),
    ).resolves.toMatchObject({ allowed: false, available: false })
  })

  it('requires complete server-only Redis and hash configuration', () => {
    expect(
      readRedisRateLimiterConfig({
        AI_RATE_LIMIT_HASH_SECRET: 'test-only-hash-secret-32-characters',
        UPSTASH_REDIS_REST_TOKEN: 'redis-token',
        UPSTASH_REDIS_REST_URL: 'https://redis.test/',
      }),
    ).toEqual({
      hashSecret: 'test-only-hash-secret-32-characters',
      restToken: 'redis-token',
      restUrl: 'https://redis.test',
    })
    expect(
      readRedisRateLimiterConfig({
        UPSTASH_REDIS_REST_TOKEN: 'redis-token',
        UPSTASH_REDIS_REST_URL: 'https://redis.test',
      }),
    ).toBeUndefined()
  })
})

function createMockRedisStore() {
  const counts = new Map<string, number>()
  const keys: string[] = []
  const fetch = vi.fn(
    async (_input: string | URL | Request, init?: RequestInit) => {
      const command = JSON.parse(String(init?.body)) as unknown[]
      const key = String(command[3])
      const count = (counts.get(key) ?? 0) + 1
      counts.set(key, count)
      keys.push(key)
      return new Response(
        JSON.stringify({ result: [count, Number(command[4])] }),
        { status: 200 },
      )
    },
  )
  return { fetch, keys }
}
