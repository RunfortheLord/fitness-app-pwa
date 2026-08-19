/// <reference types="node" />
import { Client } from '@upstash/qstash'
import { createHash } from 'node:crypto'

import {
  handleWebPushTimerRequest,
  type WebPushTimerRequest,
} from '../../src/server/webPushTimerApi.js'
import {
  createRequestObserver,
  readAnonymousClientKey,
  readBoundedJsonObject,
} from '../../src/server/serverHttp.js'
import {
  createMemoryServerRateLimiter,
  evaluateRateLimit,
} from '../../src/server/serverRateLimiter.js'

type VercelRequest = {
  method?: string
  body?: unknown
  headers?: Record<string, string | string[] | undefined>
}

type VercelResponse = {
  status(code: number): VercelResponse
  setHeader(name: string, value: string): void
  json(value: unknown): void
}

const rateLimiter = createMemoryServerRateLimiter()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const observer = createRequestObserver({
    headers: req.headers,
    method: req.method,
    route: '/api/push/timer',
  })
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Request-ID', observer.requestId)

  if (req.method !== 'POST') {
    observer.finish({ outcome: 'method_not_allowed', status: 405 })
    res.status(405).json({
      ok: false,
      error: { code: 'invalid_request', message: 'Method not allowed.' },
    })
    return
  }

  const qstashToken = process.env.QSTASH_TOKEN
  const origin = getRequestOrigin(req)
  if (!qstashToken || !origin) {
    observer.finish({
      outcome: 'not_configured',
      provider: 'qstash',
      status: 503,
    })
    res.status(503).json({
      ok: false,
      error: {
        code: 'not_configured',
        message: 'Outside-app timer alerts are not configured.',
      },
    })
    return
  }
  const requestOrigin = readHeader(req.headers?.origin)
  const fetchSite = readHeader(req.headers?.['sec-fetch-site'])
  if (
    (requestOrigin && requestOrigin !== origin) ||
    (fetchSite && fetchSite !== 'same-origin')
  ) {
    observer.finish({ outcome: 'origin_rejected', status: 403 })
    res.status(403).json({
      ok: false,
      error: { code: 'invalid_request', message: 'Request origin rejected.' },
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
        message: 'The timer notification request is invalid.',
      },
    })
    return
  }
  const rateLimit = await evaluateRateLimit({
    failClosed: true,
    key: readAnonymousClientKey(req),
    limit: 30,
    limiter: rateLimiter,
    scope: 'push-timer',
    windowMs: 60_000,
  })
  if (!rateLimit.allowed) {
    const status = rateLimit.available ? 429 : 503
    res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds))
    observer.finish({
      outcome: rateLimit.available ? 'rate_limited' : 'limiter_unavailable',
      provider: 'qstash',
      rateLimiterAvailable: rateLimit.available,
      status,
    })
    res.status(status).json({
      ok: false,
      error: {
        code: rateLimit.available ? 'rate_limited' : 'scheduler_failed',
        message: 'The outside-app timer alert is temporarily unavailable.',
      },
    })
    return
  }

  const qstash = new Client({
    token: qstashToken,
    enableTelemetry: false,
    retry: false,
  })
  const input = parsedBody.data as WebPushTimerRequest
  const result = await handleWebPushTimerRequest(input, {
    async cancel(messageId) {
      try {
        await qstash.messages.cancel(messageId)
      } catch (caught: unknown) {
        if (!isMissingQstashMessage(caught)) {
          throw caught
        }
      }
    },
    async cancelForSubscription(subscription) {
      const label = subscriptionLabel(subscription.endpoint)
      await qstash.messages.cancel({
        filter: { label },
        count: 100,
      })
    },
    async publish({ body, deduplicationKey, delaySeconds }) {
      const label = subscriptionLabel(body.subscription.endpoint)
      const published = await qstash.publishJSON({
        url: `${origin}/api/push/deliver`,
        body,
        deduplicationId: `rest-timer-${createHash('sha256')
          .update(deduplicationKey)
          .digest('hex')}`,
        delay: delaySeconds,
        retries: 0,
        timeout: 15,
        label,
        redact: { body: true },
      })
      return { messageId: published.messageId }
    },
  })

  if (result.ok) {
    observer.finish({
      outcome: result.messageId ? 'scheduled' : 'canceled',
      provider: 'qstash',
      status: 200,
    })
    res.status(200).json(result)
    return
  }
  const status =
    'error' in result && result.error.code === 'invalid_request' ? 400 : 502
  observer.finish({
    outcome: 'error' in result ? result.error.code : 'scheduler_failed',
    provider: 'qstash',
    status,
  })
  res.status(status).json(result)
}

function getRequestOrigin(req: VercelRequest) {
  const configuredOrigin = process.env.PUBLIC_APP_ORIGIN
  if (configuredOrigin) {
    try {
      return new URL(configuredOrigin).origin
    } catch {
      return null
    }
  }
  const host = readHeader(
    req.headers?.['x-forwarded-host'] ?? req.headers?.host,
  )
  const protocol = readHeader(req.headers?.['x-forwarded-proto']) ?? 'https'
  if (!host || protocol !== 'https') {
    return null
  }
  return `https://${host}`
}

function readHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isMissingQstashMessage(value: unknown) {
  return (
    isRecord(value) &&
    'status' in value &&
    typeof value.status === 'number' &&
    value.status === 404
  )
}

function subscriptionLabel(endpoint: string) {
  const digest = createHash('sha256')
    .update(endpoint)
    .digest('hex')
    .slice(0, 32)
  return `rest-timer-${digest}`
}
