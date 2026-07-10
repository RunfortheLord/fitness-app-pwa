/// <reference types="node" />

// Relays a single piece of typed user feedback to a chat webhook (Discord or
// Slack). The webhook URL is a server-only secret (FEEDBACK_WEBHOOK_URL) and is
// never sent to the client, so testers never see — or need — the destination.

export type FeedbackErrorCode =
  | 'invalid_request'
  | 'not_configured'
  | 'rate_limited'
  | 'relay_failed'

export type SubmitFeedbackResult =
  | { ok: true }
  | { ok: false; error: { code: FeedbackErrorCode; message: string } }

export type FeedbackInput = {
  message: unknown
  context?: unknown
}

export type FeedbackConfig = {
  clientIp?: string
  webhookUrl: string | undefined
  fetchImpl?: typeof fetch
  rateLimiter?: FeedbackRateLimiter
}

export type FeedbackRateLimiter = {
  check(key: string): Promise<boolean> | boolean
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
  if (config.rateLimiter) {
    const allowed = await config.rateLimiter.check(config.clientIp ?? 'unknown')
    if (!allowed) {
      return {
        ok: false,
        error: {
          code: 'rate_limited',
          message: 'Feedback is being sent too quickly. Try again later.',
        },
      }
    }
  }

  const context =
    typeof input.context === 'string'
      ? input.context.trim().slice(0, MAX_CONTEXT_LENGTH)
      : ''
  const body = formatWebhookPayload(message, context)
  const fetchImpl = config.fetchImpl ?? fetch

  try {
    const response = await fetchImpl(config.webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      return relayFailed()
    }
    return { ok: true }
  } catch {
    return relayFailed()
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
}): FeedbackRateLimiter {
  const hitsByKey = new Map<string, number[]>()

  return {
    check(key: string) {
      const current = now()
      const windowStart = current - windowMs
      const recentHits = (hitsByKey.get(key) ?? []).filter(
        (hit) => hit > windowStart,
      )
      if (recentHits.length >= limit) {
        hitsByKey.set(key, recentHits)
        return false
      }
      recentHits.push(current)
      hitsByKey.set(key, recentHits)
      return true
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
      return 503
    case 'rate_limited':
      return 429
    case 'relay_failed':
      return 502
    default:
      return 500
  }
}
