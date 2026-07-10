/// <reference types="node" />
import {
  createMemoryFeedbackRateLimiter,
  handleFeedbackSubmission,
  statusForFeedbackError,
} from '../src/server/feedbackApi.js'

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
}

const feedbackRateLimiter = createMemoryFeedbackRateLimiter({
  limit: 5,
  windowMs: 10 * 60 * 1_000,
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.status(405).json({
      ok: false,
      error: { code: 'invalid_request', message: 'Method not allowed.' },
    })
    return
  }

  const body = readBody(req.body)
  const result = await handleFeedbackSubmission(
    { message: body.message, context: body.context },
    {
      clientIp: readClientIp(req),
      rateLimiter: feedbackRateLimiter,
      webhookUrl: process.env.FEEDBACK_WEBHOOK_URL,
    },
  )

  if ('error' in result) {
    res.status(statusForFeedbackError(result.error.code)).json(result)
    return
  }

  res.status(200).json(result)
}

function readClientIp(req: VercelRequest) {
  const forwardedFor = readHeader(req, 'x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown'
  }
  return readHeader(req, 'x-real-ip') ?? req.socket?.remoteAddress ?? 'unknown'
}

function readHeader(req: VercelRequest, name: string) {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()]
  if (Array.isArray(value)) {
    return value[0]
  }
  return value
}

function readBody(body: unknown): Record<string, unknown> {
  if (typeof body === 'string') {
    try {
      const parsed: unknown = JSON.parse(body)
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {}
    } catch {
      return {}
    }
  }
  return typeof body === 'object' && body !== null
    ? (body as Record<string, unknown>)
    : {}
}
