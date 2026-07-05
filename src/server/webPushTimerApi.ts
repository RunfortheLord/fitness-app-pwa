export type WebPushSubscriptionPayload = {
  endpoint: string
  expirationTime?: number | null
  keys: {
    auth: string
    p256dh: string
  }
}

export type WebPushTimerJob = {
  subscription: WebPushSubscriptionPayload
  timerId: string
}

export type WebPushTimerRequest = {
  completionAt: unknown
  previousMessageId: unknown
  subscription: unknown
  timerId: unknown
}

export type WebPushTimerResult =
  | { ok: true; messageId: string | null }
  | {
      ok: false
      error: {
        code: 'invalid_request' | 'not_configured' | 'scheduler_failed'
        message: string
      }
    }

type SchedulerDependencies = {
  cancel(messageId: string): Promise<void>
  cancelForSubscription(subscription: WebPushSubscriptionPayload): Promise<void>
  now?: () => number
  publish(input: {
    body: WebPushTimerJob
    delaySeconds: number
  }): Promise<{ messageId: string }>
}

const MAX_TIMER_DELAY_SECONDS = 24 * 60 * 60
const MAX_IDENTIFIER_LENGTH = 200

export async function handleWebPushTimerRequest(
  input: WebPushTimerRequest,
  dependencies: SchedulerDependencies,
): Promise<WebPushTimerResult> {
  const previousMessageId = readOptionalIdentifier(input.previousMessageId)
  if (input.previousMessageId != null && previousMessageId === null) {
    return invalid('The previous timer message identifier is invalid.')
  }

  const subscription = readSubscription(input.subscription)
  if (!subscription) {
    return invalid('The push subscription is invalid.')
  }

  try {
    if (previousMessageId) {
      await dependencies.cancel(previousMessageId)
    }
    await dependencies.cancelForSubscription(subscription)

    if (input.completionAt === null) {
      return { ok: true, messageId: null }
    }

    const completionAt =
      typeof input.completionAt === 'string'
        ? Date.parse(input.completionAt)
        : Number.NaN
    const timerId = readRequiredIdentifier(input.timerId)
    const now = dependencies.now?.() ?? Date.now()
    const delaySeconds = Math.ceil((completionAt - now) / 1000)

    if (
      !Number.isFinite(completionAt) ||
      !timerId ||
      !subscription ||
      delaySeconds <= 0 ||
      delaySeconds > MAX_TIMER_DELAY_SECONDS
    ) {
      return invalid('The rest timer notification request is invalid.')
    }

    const published = await dependencies.publish({
      body: { subscription, timerId },
      delaySeconds,
    })
    return { ok: true, messageId: published.messageId }
  } catch {
    return {
      ok: false,
      error: {
        code: 'scheduler_failed',
        message: 'The outside-app timer alert could not be scheduled.',
      },
    }
  }
}

export function readWebPushTimerJob(value: unknown): WebPushTimerJob | null {
  if (!isRecord(value)) {
    return null
  }
  const timerId = readRequiredIdentifier(value.timerId)
  const subscription = readSubscription(value.subscription)
  return timerId && subscription ? { timerId, subscription } : null
}

function readSubscription(value: unknown): WebPushSubscriptionPayload | null {
  if (!isRecord(value) || !isRecord(value.keys)) {
    return null
  }
  const endpoint = readHttpsUrl(value.endpoint)
  const auth = readBoundedString(value.keys.auth, 512)
  const p256dh = readBoundedString(value.keys.p256dh, 512)
  const expirationTime =
    value.expirationTime === null || value.expirationTime === undefined
      ? null
      : typeof value.expirationTime === 'number' &&
          Number.isFinite(value.expirationTime)
        ? value.expirationTime
        : undefined
  if (!endpoint || !auth || !p256dh || expirationTime === undefined) {
    return null
  }
  return {
    endpoint,
    expirationTime,
    keys: { auth, p256dh },
  }
}

function readHttpsUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 2_048) {
    return null
  }
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' ? parsed.toString() : null
  } catch {
    return null
  }
}

function readRequiredIdentifier(value: unknown) {
  const identifier = readBoundedString(value, MAX_IDENTIFIER_LENGTH)
  return identifier && /^[a-zA-Z0-9:._-]+$/.test(identifier) ? identifier : null
}

function readOptionalIdentifier(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null
  }
  return readRequiredIdentifier(value)
}

function readBoundedString(value: unknown, maxLength: number) {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maxLength
    ? value
    : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function invalid(message: string): WebPushTimerResult {
  return {
    ok: false,
    error: { code: 'invalid_request', message },
  }
}
