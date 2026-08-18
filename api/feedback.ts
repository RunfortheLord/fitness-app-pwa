/// <reference types="node" />
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
  socket?: { remoteAddress?: string }
}

type VercelResponse = {
  status(code: number): VercelResponse
  setHeader(name: string, value: string): void
  json(value: unknown): void
  end(): void
}

const feedbackRateLimiterConfig = readRedisRateLimiterConfig(process.env)
const feedbackRateLimiter = feedbackRateLimiterConfig
  ? createRedisServerRateLimiter(feedbackRateLimiterConfig)
  : undefined

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
      rateLimiter: feedbackRateLimiter,
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
