/// <reference types="node" />
import { Client } from '@upstash/qstash'
import { createHash } from 'node:crypto'

import {
  handleWebPushTimerRequest,
  type WebPushTimerRequest,
} from '../../src/server/webPushTimerApi.js'

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.status(405).json({
      ok: false,
      error: { code: 'invalid_request', message: 'Method not allowed.' },
    })
    return
  }

  const qstashToken = process.env.QSTASH_TOKEN
  const origin = getRequestOrigin(req)
  if (!qstashToken || !origin) {
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
    res.status(403).json({
      ok: false,
      error: { code: 'invalid_request', message: 'Request origin rejected.' },
    })
    return
  }

  const qstash = new Client({ token: qstashToken, enableTelemetry: false })
  const input = readBody(req.body) as WebPushTimerRequest
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
    async publish({ body, delaySeconds }) {
      const label = subscriptionLabel(body.subscription.endpoint)
      const published = await qstash.publishJSON({
        url: `${origin}/api/push/deliver`,
        body,
        delay: delaySeconds,
        retries: 0,
        label,
        redact: { body: true },
      })
      return { messageId: published.messageId }
    },
  })

  if (result.ok) {
    res.status(200).json(result)
    return
  }
  const status =
    'error' in result && result.error.code === 'invalid_request' ? 400 : 502
  res.status(status).json(result)
}

function readBody(body: unknown): Record<string, unknown> {
  if (typeof body === 'string') {
    try {
      const parsed: unknown = JSON.parse(body)
      return isRecord(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  return isRecord(body) ? body : {}
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
