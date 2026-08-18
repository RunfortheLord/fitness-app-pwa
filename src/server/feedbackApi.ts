/// <reference types="node" />

import {
  createMemoryServerRateLimiter,
  evaluateRateLimit,
  type ServerRateLimiter,
} from './serverRateLimiter.js'

// Relays a single piece of typed user feedback to a chat webhook (Discord or
// Slack). The webhook URL is a server-only secret (FEEDBACK_WEBHOOK_URL) and is
// never sent to the client, so testers never see — or need — the destination.

export type FeedbackErrorCode =
  | 'invalid_request'
  | 'not_configured'
  | 'rate_limited'
  | 'service_unavailable'
  | 'relay_failed'

export type SubmitFeedbackResult =
  | { ok: true }
  | {
      ok: false
      error: {
        code: FeedbackErrorCode
        message: string
        retryAfterSeconds?: number
      }
    }

export type FeedbackInput = {
  message: unknown
  context?: unknown
}

export type FeedbackConfig = {
  clientIp?: string
  clientKey?: string
  webhookUrl: string | undefined
  fetchImpl?: typeof fetch
  rateLimiter: ServerRateLimiter
}

// Discord caps webhook `content` at 2000 characters; keep the message well under
// that so the formatted payload (with header + context) always fits.
const MAX_MESSAGE_LENGTH = 1800
const MAX_CONTEXT_LENGTH = 300

export async function handleFeedbackSubmission(
  input: FeedbackInput,
  config: FeedbackConfig,
): Promise<SubmitFeedbackResult> {
  const message = typeof input.message === 'string' ? input.message.trim() : ''
  if (!message) {
    return invalid('Feedback message is required.')
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return invalid(
      `Feedback must be ${MAX_MESSAGE_LENGTH} characters or fewer.`,
    )
  }
  if (!config.webhookUrl) {
    return {
      ok: false,
      error: {
        code: 'not_configured',
        message: 'Feedback is not configured yet.',
      },
    }
  }
  const rateLimit = await evaluateRateLimit({
    failClosed: true,
    key: config.clientKey ?? config.clientIp ?? 'unknown',
    limit: 5,
    limiter: config.rateLimiter,
    scope: 'feedback',
    windowMs: 10 * 60 * 1_000,
  })
  if (!rateLimit.allowed) {
    return {
      ok: false,
      error: {
        code: rateLimit.available ? 'rate_limited' : 'service_unavailable',
        message: rateLimit.available
          ? 'Feedback is being sent too quickly. Try again later.'
          : 'Feedback is temporarily unavailable. Try again later.',
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
    }
  }

  const context =
    typeof input.context === 'string'
      ? input.context.trim().slice(0, MAX_CONTEXT_LENGTH)
      : ''
  const body = formatWebhookPayload(message, context)
  const fetchImpl = config.fetchImpl ?? fetch
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), 5_000)

  try {
    const response = await fetchImpl(config.webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!response.ok) {
      return relayFailed()
    }
    return { ok: true }
  } catch {
    return relayFailed()
  } finally {
    globalThis.clearTimeout(timeoutId)
  }
}

function formatWebhookPayload(message: string, context: string) {
  const lines = ['**App feedback**', '', message]
  if (context) {
    lines.push('', `_${context}_`)
  }
  const text = lines.join('\n')
  // Discord reads `content`, Slack reads `text`; sending both keeps the relay
  // working for either service without code changes. The extra fields disable
  // broadcast/user/role mention parsing where the webhook service supports it.
  return {
    allowed_mentions: { parse: [] },
    content: text,
    link_names: false,
    text,
  }
}

export function createMemoryFeedbackRateLimiter({
  limit,
  now = () => Date.now(),
  windowMs,
}: {
  limit: number
  now?: () => number
  windowMs: number
}): ServerRateLimiter {
  const limiter = createMemoryServerRateLimiter({ now })
  return {
    check(input) {
      return limiter.check({ ...input, limit, windowMs })
    },
  }
}

function invalid(message: string): SubmitFeedbackResult {
  return { ok: false, error: { code: 'invalid_request', message } }
}

function relayFailed(): SubmitFeedbackResult {
  return {
    ok: false,
    error: {
      code: 'relay_failed',
      message: 'Feedback could not be delivered. Please try again later.',
    },
  }
}

export function statusForFeedbackError(code: FeedbackErrorCode): number {
  switch (code) {
    case 'invalid_request':
      return 400
    case 'not_configured':
    case 'service_unavailable':
      return 503
    case 'rate_limited':
      return 429
    case 'relay_failed':
      return 502
    default:
      return 500
  }
}
