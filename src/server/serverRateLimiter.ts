export type RateLimitCheck = {
  key: string
  limit: number
  scope: string
  windowMs: number
}

export type RateLimitDecision = {
  allowed: boolean
  available: boolean
  remaining: number
  retryAfterSeconds: number
}

export type ServerRateLimiter = {
  check(input: RateLimitCheck): Promise<RateLimitDecision> | RateLimitDecision
}

export type DistributedRateLimiterEnvironment = Record<
  string,
  string | undefined
>

export type RedisRateLimiterConfig = {
  hashSecret: string
  restToken: string
  restUrl: string
}

type RateLimitWindow = {
  count: number
  expiresAt: number
}

type RedisCommandResponse = {
  result?: unknown
}

const DEFAULT_REDIS_TIMEOUT_MS = 1_500
const REDIS_KEY_PREFIX = 'vigorune:rate-limit'
const FIXED_WINDOW_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {count, ttl}
`.trim()

export function readRedisRateLimiterConfig(
  environment: DistributedRateLimiterEnvironment,
): RedisRateLimiterConfig | undefined {
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
  const hashSecret = environment.AI_RATE_LIMIT_HASH_SECRET?.trim()
  if (!restUrl || !restToken || !hashSecret || hashSecret.length < 32) {
    return undefined
  }
  return { hashSecret, restToken, restUrl: restUrl.replace(/\/+$/, '') }
}

export function createRedisServerRateLimiter({
  fetchImpl = fetch,
  hashSecret,
  restToken,
  restUrl,
  timeoutMs = DEFAULT_REDIS_TIMEOUT_MS,
}: RedisRateLimiterConfig & {
  fetchImpl?: typeof fetch
  timeoutMs?: number
}): ServerRateLimiter {
  return {
    async check(input) {
      if (!isValidRateLimitCheck(input) || !isValidTimeout(timeoutMs)) {
        return unavailableDecision()
      }

      const controller = new AbortController()
      const timeoutId = globalThis.setTimeout(
        () => controller.abort(),
        timeoutMs,
      )
      try {
        const key = await createSharedStoreKey(
          input.scope,
          input.key,
          hashSecret,
        )
        const response = await fetchImpl(restUrl, {
          body: JSON.stringify([
            'EVAL',
            FIXED_WINDOW_SCRIPT,
            '1',
            key,
            String(Math.ceil(input.windowMs)),
          ]),
          headers: {
            Authorization: `Bearer ${restToken}`,
            'Content-Type': 'application/json',
          },
          method: 'POST',
          signal: controller.signal,
        })
        if (!response.ok) {
          return unavailableDecision()
        }

        const payload = (await response.json()) as RedisCommandResponse
        const parsed = parseRedisWindowResult(payload.result)
        if (!parsed) {
          return unavailableDecision()
        }

        return {
          allowed: parsed.count <= input.limit,
          available: true,
          remaining: Math.max(0, input.limit - parsed.count),
          retryAfterSeconds: Math.max(1, Math.ceil(parsed.ttlMs / 1_000)),
        }
      } catch {
        return unavailableDecision()
      } finally {
        globalThis.clearTimeout(timeoutId)
      }
    },
  }
}

export function createMemoryServerRateLimiter({
  maxKeys = 10_000,
  now = () => Date.now(),
}: {
  maxKeys?: number
  now?: () => number
} = {}): ServerRateLimiter {
  const windows = new Map<string, RateLimitWindow>()

  return {
    check(input) {
      if (!isValidRateLimitCheck(input)) {
        return unavailableDecision()
      }

      const current = now()
      const key = `${input.scope}:${input.key}`
      const existing = windows.get(key)
      if (existing && existing.expiresAt > current) {
        if (existing.count >= input.limit) {
          return {
            allowed: false,
            available: true,
            remaining: 0,
            retryAfterSeconds: secondsUntil(existing.expiresAt, current),
          }
        }
        existing.count += 1
        return {
          allowed: true,
          available: true,
          remaining: Math.max(0, input.limit - existing.count),
          retryAfterSeconds: secondsUntil(existing.expiresAt, current),
        }
      }

      if (existing) {
        windows.delete(key)
      }
      pruneExpiredWindows(windows, current)
      if (windows.size >= maxKeys) {
        return unavailableDecision()
      }

      windows.set(key, { count: 1, expiresAt: current + input.windowMs })
      return {
        allowed: true,
        available: true,
        remaining: input.limit - 1,
        retryAfterSeconds: Math.max(1, Math.ceil(input.windowMs / 1_000)),
      }
    },
  }
}

export async function evaluateRateLimit({
  failClosed,
  key,
  limit,
  limiter,
  scope,
  windowMs,
}: RateLimitCheck & {
  failClosed: boolean
  limiter: ServerRateLimiter | undefined
}): Promise<RateLimitDecision> {
  try {
    const decision = limiter
      ? await limiter.check({ key, limit, scope, windowMs })
      : unavailableDecision()
    if (decision.available || failClosed) {
      return decision
    }
  } catch {
    if (failClosed) {
      return unavailableDecision()
    }
  }

  return {
    allowed: true,
    available: false,
    remaining: 0,
    retryAfterSeconds: 60,
  }
}

function unavailableDecision(): RateLimitDecision {
  return {
    allowed: false,
    available: false,
    remaining: 0,
    retryAfterSeconds: 60,
  }
}

async function createSharedStoreKey(
  scope: string,
  clientKey: string,
  hashSecret: string,
) {
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(hashSecret),
    { hash: 'SHA-256', name: 'HMAC' },
    false,
    ['sign'],
  )
  const digest = await globalThis.crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    new TextEncoder().encode(clientKey),
  )
  const hexDigest = [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
  return `${REDIS_KEY_PREFIX}:${scope}:${hexDigest}`
}

function isValidRateLimitCheck(input: RateLimitCheck) {
  return (
    Boolean(input.key) &&
    input.key.length <= 1_024 &&
    /^[a-z0-9-]{1,64}$/.test(input.scope) &&
    Number.isInteger(input.limit) &&
    input.limit >= 1 &&
    Number.isFinite(input.windowMs) &&
    input.windowMs >= 1
  )
}

function isValidTimeout(timeoutMs: number) {
  return Number.isFinite(timeoutMs) && timeoutMs >= 1 && timeoutMs <= 10_000
}

function parseRedisWindowResult(result: unknown) {
  if (!Array.isArray(result) || result.length !== 2) {
    return undefined
  }
  const count = Number(result[0])
  const ttlMs = Number(result[1])
  if (
    !Number.isSafeInteger(count) ||
    count < 1 ||
    !Number.isFinite(ttlMs) ||
    ttlMs < 1
  ) {
    return undefined
  }
  return { count, ttlMs }
}

function pruneExpiredWindows(
  windows: Map<string, RateLimitWindow>,
  current: number,
) {
  for (const [key, window] of windows) {
    if (window.expiresAt <= current) {
      windows.delete(key)
    }
  }
}

function secondsUntil(expiresAt: number, current: number) {
  return Math.max(1, Math.ceil((expiresAt - current) / 1_000))
}
