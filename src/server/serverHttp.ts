export type ServerHeaders = Record<string, string | string[] | undefined>

export type ServerRequestLike = {
  body?: unknown
  headers?: ServerHeaders
  method?: string
  socket?: { remoteAddress?: string }
}

export type RequestLogDetails = {
  cache?: 'hit' | 'miss' | 'coalesced' | 'bypass' | 'not_applicable' | 'unknown'
  outcome?: string
  provider?: string
  rateLimiterAvailable?: boolean
  status: number
}

export type RequestObserver = {
  finish(details: RequestLogDetails): void
  requestId: string
}

export function readHeader(headers: ServerHeaders | undefined, name: string) {
  const normalizedName = name.toLowerCase()
  const matchingKey = Object.keys(headers ?? {}).find(
    (key) => key.toLowerCase() === normalizedName,
  )
  const value = matchingKey ? headers?.[matchingKey] : undefined
  return Array.isArray(value) ? value[0] : value
}

export function readAnonymousClientKey(request: ServerRequestLike) {
  const forwarded =
    readHeader(request.headers, 'x-vercel-forwarded-for') ??
    readHeader(request.headers, 'x-forwarded-for')
  const address =
    forwarded?.split(',')[0]?.trim() ||
    readHeader(request.headers, 'x-real-ip') ||
    request.socket?.remoteAddress ||
    'unknown'
  const userAgent = readHeader(request.headers, 'user-agent') ?? 'unknown'
  return `${address.slice(0, 128)}|${userAgent.slice(0, 256)}`
}

export function readBoundedJsonObject(
  body: unknown,
  maxBytes: number,
):
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; reason: 'invalid_json' | 'payload_too_large' } {
  let parsed = body
  if (typeof body === 'string') {
    if (byteLength(body) > maxBytes) {
      return { ok: false, reason: 'payload_too_large' }
    }
    try {
      parsed = JSON.parse(body) as unknown
    } catch {
      return { ok: false, reason: 'invalid_json' }
    }
  }
  if (!isRecord(parsed)) {
    return { ok: false, reason: 'invalid_json' }
  }
  try {
    if (byteLength(JSON.stringify(parsed)) > maxBytes) {
      return { ok: false, reason: 'payload_too_large' }
    }
  } catch {
    return { ok: false, reason: 'invalid_json' }
  }
  return { ok: true, data: parsed }
}

export function createRequestObserver({
  headers,
  logger = (line) => console.info(line),
  method,
  now = () => Date.now(),
  route,
}: {
  headers?: ServerHeaders
  logger?: (line: string) => void
  method: string | undefined
  now?: () => number
  route: string
}): RequestObserver {
  const startedAt = now()
  const requestId = safeRequestId(
    readHeader(headers, 'x-request-id') ?? createRequestId(),
  )
  let finished = false

  return {
    requestId,
    finish(details) {
      if (finished) {
        return
      }
      finished = true
      logger(
        JSON.stringify({
          cache: details.cache ?? 'not_applicable',
          duration_ms: Math.max(0, now() - startedAt),
          event: 'api_request',
          method: method ?? 'UNKNOWN',
          outcome: details.outcome ?? 'completed',
          provider: details.provider ?? 'none',
          rate_limiter_available: details.rateLimiterAvailable ?? true,
          request_id: requestId,
          route,
          status: details.status,
        }),
      )
    },
  }
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).byteLength
}

function createRequestId() {
  const values = new Uint32Array(3)
  globalThis.crypto.getRandomValues(values)
  return [...values].map((value) => value.toString(16)).join('-')
}

function safeRequestId(value: string) {
  const trimmed = value.trim()
  return /^[a-zA-Z0-9._:-]{1,100}$/.test(trimmed) ? trimmed : createRequestId()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
