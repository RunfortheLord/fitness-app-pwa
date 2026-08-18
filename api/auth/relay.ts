/// <reference types="node" />
import {
  createRedisAuthRelayStore,
  isAuthCode,
  isRelayId,
  isRetrievalSecret,
  readRedisAuthRelayConfig,
} from '../../src/server/authRelay.js'
import {
  createRequestObserver,
  readAnonymousClientKey,
  readBoundedJsonObject,
  readHeader,
  type ServerRequestLike,
} from '../../src/server/serverHttp.js'
import { isAllowedAppOrigin } from '../../src/server/accountDeletion.js'
import {
  createRedisServerRateLimiter,
  evaluateRateLimit,
  readRedisRateLimiterConfig,
} from '../../src/server/serverRateLimiter.js'

type VercelRequest = ServerRequestLike

type VercelResponse = {
  end(): void
  status(code: number): VercelResponse
  setHeader(name: string, value: string): void
  json(value: unknown): void
}

const MAX_BODY_BYTES = 8 * 1_024
const CREATE_LIMIT = 10
const CREATE_WINDOW_MS = 10 * 60 * 1_000
const redisConfig = readRedisAuthRelayConfig(process.env)
const authRelayStore = redisConfig
  ? createRedisAuthRelayStore(redisConfig)
  : undefined
const limiterConfig = readRedisRateLimiterConfig(process.env)
const createLimiter = limiterConfig
  ? createRedisServerRateLimiter(limiterConfig)
  : undefined

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const observer = createRequestObserver({
    headers: req.headers,
    method: req.method,
    route: '/api/auth/relay',
  })
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Request-ID', observer.requestId)

  const requestOrigin = readHeader(req.headers, 'origin')
  if (
    !isAllowedAppOrigin({
      host: readHeader(req.headers, 'host'),
      origin: requestOrigin,
      publicAppOrigin: process.env.PUBLIC_APP_ORIGIN,
    })
  ) {
    respond(res, observer, 403, 'forbidden')
    return
  }
  if (requestOrigin) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin)
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Vary', 'Origin')
  }
  if (req.method === 'OPTIONS') {
    observer.finish({ outcome: 'preflight', status: 204 })
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    respond(res, observer, 405, 'method_not_allowed')
    return
  }
  const body = readBoundedJsonObject(req.body, MAX_BODY_BYTES)
  if ('reason' in body || typeof body.data.action !== 'string') {
    respond(res, observer, 400, 'invalid_request')
    return
  }
  if (!authRelayStore) {
    respond(res, observer, 503, 'service_unavailable')
    return
  }

  if (body.data.action === 'create') {
    const rateLimit = await evaluateRateLimit({
      failClosed: true,
      key: readAnonymousClientKey(req),
      limit: CREATE_LIMIT,
      limiter: createLimiter,
      scope: 'auth-relay-create',
      windowMs: CREATE_WINDOW_MS,
    })
    if (!rateLimit.allowed) {
      res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds))
      respond(
        res,
        observer,
        rateLimit.available ? 429 : 503,
        rateLimit.available ? 'rate_limited' : 'service_unavailable',
      )
      return
    }
    const ticket = await authRelayStore.create()
    if (!ticket) {
      respond(res, observer, 503, 'service_unavailable')
      return
    }
    observer.finish({ outcome: 'created', status: 201 })
    res.status(201).json({ ok: true, data: ticket })
    return
  }

  if (body.data.action === 'complete') {
    const relayId = body.data.relayId
    const code = body.data.code
    const failed = body.data.failed === true
    if (!isRelayId(relayId) || (!failed && !isAuthCode(code))) {
      respond(res, observer, 400, 'invalid_request')
      return
    }
    let result
    if (failed) {
      result = await authRelayStore.complete(relayId, { status: 'failed' })
    } else {
      if (!isAuthCode(code)) {
        respond(res, observer, 400, 'invalid_request')
        return
      }
      result = await authRelayStore.complete(relayId, {
        code,
        status: 'ready',
      })
    }
    if (result === 'unavailable') {
      respond(res, observer, 503, 'service_unavailable')
      return
    }
    if (result === 'missing') {
      respond(res, observer, 404, 'not_found')
      return
    }
    if (result === 'used') {
      respond(res, observer, 409, 'already_completed')
      return
    }
    observer.finish({ outcome: 'completed', status: 202 })
    res.status(202).json({ ok: true })
    return
  }

  if (body.data.action === 'consume') {
    const relayId = body.data.relayId
    const retrievalSecret = body.data.retrievalSecret
    if (!isRelayId(relayId) || !isRetrievalSecret(retrievalSecret)) {
      respond(res, observer, 400, 'invalid_request')
      return
    }
    const result = await authRelayStore.consume(relayId, retrievalSecret)
    if (result.status === 'unavailable') {
      respond(res, observer, 503, 'service_unavailable')
      return
    }
    if (result.status === 'missing') {
      respond(res, observer, 404, 'not_found')
      return
    }
    observer.finish({
      outcome: result.status,
      status: result.status === 'pending' ? 202 : 200,
    })
    res.status(result.status === 'pending' ? 202 : 200).json({
      ok: true,
      data:
        result.status === 'ready'
          ? { code: result.code, status: result.status }
          : { status: result.status },
    })
    return
  }

  respond(res, observer, 400, 'invalid_request')
}

function respond(
  res: VercelResponse,
  observer: ReturnType<typeof createRequestObserver>,
  status: number,
  code: string,
) {
  observer.finish({ outcome: code, status })
  res.status(status).json({ ok: false, error: { code } })
}
