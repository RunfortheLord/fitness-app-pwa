export type AuthRelayEnvironment = Record<string, string | undefined>

export type RedisAuthRelayConfig = {
  restToken: string
  restUrl: string
}

export type AuthRelayTicket = {
  expiresInSeconds: number
  relayId: string
  retrievalSecret: string
}

export type AuthRelayConsumeResult =
  | { status: 'failed' | 'missing' | 'pending' | 'unavailable' }
  | { code: string; status: 'ready' }

export type AuthRelayCompleteResult =
  | 'stored'
  | 'missing'
  | 'used'
  | 'unavailable'

export type AuthRelayStore = {
  complete(
    relayId: string,
    result: { code: string; status: 'ready' } | { status: 'failed' },
  ): Promise<AuthRelayCompleteResult>
  consume(
    relayId: string,
    retrievalSecret: string,
  ): Promise<AuthRelayConsumeResult>
  create(): Promise<AuthRelayTicket | undefined>
}

type RedisCommandResponse = { result?: unknown }

const AUTH_RELAY_KEY_PREFIX = 'vigorune:auth-relay'
const AUTH_RELAY_TTL_MS = 5 * 60 * 1_000
const DEFAULT_REDIS_TIMEOUT_MS = 1_500
const RELAY_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const RETRIEVAL_SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/

const CREATE_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 1 then
  return 0
end
redis.call('HSET', KEYS[1], 'secret', ARGV[1], 'status', 'pending')
redis.call('PEXPIRE', KEYS[1], ARGV[2])
return 1
`.trim()

const COMPLETE_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then
  return 'missing'
end
if redis.call('HGET', KEYS[1], 'status') ~= 'pending' then
  return 'used'
end
if ARGV[1] == 'ready' then
  redis.call('HSET', KEYS[1], 'status', 'ready', 'code', ARGV[2])
else
  redis.call('HSET', KEYS[1], 'status', 'failed')
end
return 'stored'
`.trim()

const CONSUME_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then
  return {'missing'}
end
if redis.call('HGET', KEYS[1], 'secret') ~= ARGV[1] then
  return {'missing'}
end
local status = redis.call('HGET', KEYS[1], 'status')
if status == 'pending' then
  return {'pending'}
end
local code = ''
if status == 'ready' then
  code = redis.call('HGET', KEYS[1], 'code') or ''
end
redis.call('DEL', KEYS[1])
return {status, code}
`.trim()

export function readRedisAuthRelayConfig(
  environment: AuthRelayEnvironment,
): RedisAuthRelayConfig | undefined {
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

export function createRedisAuthRelayStore({
  fetchImpl = fetch,
  restToken,
  restUrl,
  timeoutMs = DEFAULT_REDIS_TIMEOUT_MS,
}: RedisAuthRelayConfig & {
  fetchImpl?: typeof fetch
  timeoutMs?: number
}): AuthRelayStore {
  async function execute(command: unknown[]) {
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) {
      return undefined
    }
    const controller = new AbortController()
    const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(restUrl, {
        body: JSON.stringify(command),
        headers: {
          Authorization: `Bearer ${restToken}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        signal: controller.signal,
      })
      if (!response.ok) {
        return undefined
      }
      return ((await response.json()) as RedisCommandResponse).result
    } catch {
      return undefined
    } finally {
      globalThis.clearTimeout(timeoutId)
    }
  }

  return {
    async create() {
      const relayId = globalThis.crypto.randomUUID()
      const retrievalSecret = createRetrievalSecret()
      const secretDigest = await hashRetrievalSecret(retrievalSecret)
      const result = await execute([
        'EVAL',
        CREATE_SCRIPT,
        '1',
        authRelayKey(relayId),
        secretDigest,
        String(AUTH_RELAY_TTL_MS),
      ])
      if (Number(result) !== 1) {
        return undefined
      }
      return {
        expiresInSeconds: AUTH_RELAY_TTL_MS / 1_000,
        relayId,
        retrievalSecret,
      }
    },

    async complete(relayId, result) {
      if (!isRelayId(relayId)) {
        return 'missing'
      }
      if (result.status === 'ready' && !isAuthCode(result.code)) {
        return 'missing'
      }
      const redisResult = await execute([
        'EVAL',
        COMPLETE_SCRIPT,
        '1',
        authRelayKey(relayId),
        result.status,
        result.status === 'ready' ? result.code : '',
      ])
      return redisResult === 'stored' ||
        redisResult === 'missing' ||
        redisResult === 'used'
        ? redisResult
        : 'unavailable'
    },

    async consume(relayId, retrievalSecret) {
      if (!isRelayId(relayId) || !isRetrievalSecret(retrievalSecret)) {
        return { status: 'missing' }
      }
      const secretDigest = await hashRetrievalSecret(retrievalSecret)
      const redisResult = await execute([
        'EVAL',
        CONSUME_SCRIPT,
        '1',
        authRelayKey(relayId),
        secretDigest,
      ])
      if (!Array.isArray(redisResult) || typeof redisResult[0] !== 'string') {
        return { status: 'unavailable' }
      }
      const status = redisResult[0]
      if (status === 'ready') {
        const code = redisResult[1]
        return typeof code === 'string' && isAuthCode(code)
          ? { code, status }
          : { status: 'unavailable' }
      }
      return status === 'failed' || status === 'missing' || status === 'pending'
        ? { status }
        : { status: 'unavailable' }
    },
  }
}

export function isRelayId(value: unknown): value is string {
  return typeof value === 'string' && RELAY_ID_PATTERN.test(value)
}

export function isRetrievalSecret(value: unknown): value is string {
  return typeof value === 'string' && RETRIEVAL_SECRET_PATTERN.test(value)
}

export function isAuthCode(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 4096 &&
    !/\s/.test(value) &&
    [...value].every((character) => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint > 31 && codePoint !== 127
    })
  )
}

function authRelayKey(relayId: string) {
  return `${AUTH_RELAY_KEY_PREFIX}:${relayId}`
}

function createRetrievalSecret() {
  const bytes = new Uint8Array(32)
  globalThis.crypto.getRandomValues(bytes)
  return toBase64Url(bytes)
}

async function hashRetrievalSecret(secret: string) {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(secret),
  )
  return toBase64Url(new Uint8Array(digest))
}

function toBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
