/// <reference types="node" />
import {
  createRedisAnalyticsSink,
  handleAnalyticsIngest,
  readAnalyticsRedisConfig,
  statusForAnalyticsError,
} from '../src/server/analyticsApi.js'
import {
  handleFeedbackSubmission,
  statusForFeedbackError,
} from '../src/server/feedbackApi.js'
import {
  createRequestObserver,
  readAnonymousClientKey,
  readBoundedJsonObject,
  readHeader,
} from '../src/server/serverHttp.js'
import {
  createRedisServerRateLimiter,
  readRedisRateLimiterConfig,
} from '../src/server/serverRateLimiter.js'
import { isAllowedAppOrigin } from '../src/server/accountDeletion.js'

type VercelRequest = {
  headers?: Record<string, string | string[] | undefined>
  method?: string
  body?: unknown
  query?: Record<string, string | string[] | undefined>
  socket?: { remoteAddress?: string }
}

type VercelResponse = {
  status(code: number): VercelResponse
  setHeader(name: string, value: string): void
  json(value: unknown): void
  end(): void
}

const sharedRateLimiterConfig = readRedisRateLimiterConfig(process.env)
const sharedRateLimiter = sharedRateLimiterConfig
  ? createRedisServerRateLimiter(sharedRateLimiterConfig)
  : undefined
// Analytics remains off unless both the client build flag and this Redis-backed
// sink are configured. Sharing this function with feedback does not enable it.
const analyticsRedisConfig = readAnalyticsRedisConfig(process.env)
const analyticsSink = analyticsRedisConfig
  ? createRedisAnalyticsSink(analyticsRedisConfig)
  : undefined

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.query?.route === 'analytics') {
    await handleAnalyticsRequest(req, res)
    return
  }

  const observer = createRequestObserver({
    headers: req.headers,
    method: req.method,
    route: '/api/feedback',
  })
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Request-ID', observer.requestId)

  const requestOrigin = readHeader(req.headers, 'origin')
  const originAllowed = isAllowedAppOrigin({
    host: readHeader(req.headers, 'host'),
    origin: requestOrigin,
    publicAppOrigin: process.env.PUBLIC_APP_ORIGIN,
  })
  if (!originAllowed) {
    observer.finish({ outcome: 'origin_rejected', status: 403 })
    res.status(403).json({
      ok: false,
      error: { code: 'invalid_request', message: 'Request origin rejected.' },
    })
    return
  }
  if (requestOrigin) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    observer.finish({ outcome: 'preflight', status: 204 })
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    observer.finish({ outcome: 'method_not_allowed', status: 405 })
    res.status(405).json({
      ok: false,
      error: { code: 'invalid_request', message: 'Method not allowed.' },
    })
    return
  }

  const parsedBody = readBoundedJsonObject(req.body, 8_192)
  if ('reason' in parsedBody) {
    const status = parsedBody.reason === 'payload_too_large' ? 413 : 400
    observer.finish({ outcome: parsedBody.reason, status })
    res.status(status).json({
      ok: false,
      error: {
        code: 'invalid_request',
        message: 'The feedback request is invalid.',
      },
    })
    return
  }
  const body = parsedBody.data
  const result = await handleFeedbackSubmission(
    { message: body.message, context: body.context },
    {
      clientKey: readAnonymousClientKey(req),
      rateLimiter: sharedRateLimiter,
      webhookUrl: process.env.FEEDBACK_WEBHOOK_URL,
    },
  )

  if ('error' in result) {
    const status = statusForFeedbackError(result.error.code)
    if (result.error.retryAfterSeconds) {
      res.setHeader('Retry-After', String(result.error.retryAfterSeconds))
    }
    observer.finish({ outcome: result.error.code, provider: 'webhook', status })
    res.status(status).json(result)
    return
  }

  observer.finish({ outcome: 'success', provider: 'webhook', status: 200 })
  res.status(200).json(result)
}

async function handleAnalyticsRequest(req: VercelRequest, res: VercelResponse) {
  const observer = createRequestObserver({
    headers: req.headers,
    method: req.method,
    route: '/api/analytics',
  })
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Request-ID', observer.requestId)

  const requestOrigin = readHeader(req.headers, 'origin')
  const originAllowed = isAllowedAppOrigin({
    host: readHeader(req.headers, 'host'),
    origin: requestOrigin,
    publicAppOrigin: process.env.PUBLIC_APP_ORIGIN,
  })
  if (!originAllowed) {
    observer.finish({ outcome: 'origin_rejected', status: 403 })
    res.status(403).json({
      ok: false,
      error: { code: 'invalid_request', message: 'Request origin rejected.' },
    })
    return
  }
  if (requestOrigin) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    observer.finish({ outcome: 'preflight', status: 204 })
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    observer.finish({ outcome: 'method_not_allowed', status: 405 })
    res.status(405).json({
      ok: false,
      error: { code: 'invalid_request', message: 'Method not allowed.' },
    })
    return
  }

  const parsedBody = readBoundedJsonObject(req.body, 16_384)
  if ('reason' in parsedBody) {
    const status = parsedBody.reason === 'payload_too_large' ? 413 : 400
    observer.finish({ outcome: parsedBody.reason, status })
    res.status(status).json({
      ok: false,
      error: {
        code: 'invalid_request',
        message: 'The analytics request is invalid.',
      },
    })
    return
  }

  const body = parsedBody.data
  const result = await handleAnalyticsIngest(
    { installId: body.installId, events: body.events },
    {
      clientKey: readAnonymousClientKey(req),
      rateLimiter: sharedRateLimiter,
      sink: analyticsSink,
    },
  )

  if ('error' in result) {
    const status = statusForAnalyticsError(result.error.code)
    if (result.error.retryAfterSeconds) {
      res.setHeader('Retry-After', String(result.error.retryAfterSeconds))
    }
    observer.finish({
      outcome: result.error.code,
      provider: 'analytics',
      status,
    })
    res.status(status).json(result)
    return
  }

  observer.finish({ outcome: 'success', provider: 'analytics', status: 200 })
  res.status(200).json(result)
}
