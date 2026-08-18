import {
  MAX_MEAL_IMAGE_BASE64_LENGTH,
  MAX_MEAL_IMAGE_BASE64_TOTAL,
  MAX_MEAL_NOTE_LENGTH,
  MAX_MEAL_PHOTOS,
  SUPPORTED_MEAL_IMAGE_TYPES,
  type MealImageMimeType,
} from '../domain/mealAnalysisLimits.js'
import type { MealAnalysis } from '../domain/mealAnalysis.js'
import {
  createOpenAiMealAnalysisProvider,
  MealAnalysisProviderError,
  type MealAnalysisProvider,
} from './openAiMealAnalysisAdapter.js'
import {
  evaluateRateLimit,
  type ServerRateLimiter,
} from './serverRateLimiter.js'

export type MealAnalysisApiErrorCode =
  | 'invalid_request'
  | 'payload_too_large'
  | 'rate_limited'
  | 'not_configured'
  | 'no_food_detected'
  | 'provider_timeout'
  | 'provider_unavailable'
  | 'invalid_response'

export type MealAnalysisApiResult =
  | { ok: true; data: MealAnalysis }
  | {
      ok: false
      error: {
        code: MealAnalysisApiErrorCode
        message: string
        retryAfterSeconds?: number
      }
    }

export type MealAnalysisRequest = {
  images: unknown
  note?: unknown
}

export type MealAnalysisApiConfig = {
  apiKey: string | undefined
  clientKey: string
  fetchImpl?: typeof fetch
  limiter: ServerRateLimiter | undefined
  model?: string
  provider?: MealAnalysisProvider
  timeoutMs?: number
}

const RATE_LIMIT = 6
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1_000
const DEFAULT_TIMEOUT_MS = 40_000

export async function handleMealAnalysis(
  request: MealAnalysisRequest,
  config: MealAnalysisApiConfig,
): Promise<MealAnalysisApiResult> {
  const validated = validateMealAnalysisRequest(request)
  if ('result' in validated) {
    return validated.result
  }

  const rateLimit = await evaluateRateLimit({
    failClosed: true,
    key: config.clientKey,
    limit: RATE_LIMIT,
    limiter: config.limiter,
    scope: 'meal-analysis',
    windowMs: RATE_LIMIT_WINDOW_MS,
  })
  if (!rateLimit.allowed) {
    return {
      ok: false,
      error: {
        code: rateLimit.available ? 'rate_limited' : 'provider_unavailable',
        message: rateLimit.available
          ? 'Meal analysis is being requested too quickly. Try again later.'
          : 'Meal analysis is temporarily unavailable. Try again later.',
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
    }
  }

  const apiKey = config.apiKey?.trim()
  if (!apiKey) {
    return {
      ok: false,
      error: {
        code: 'not_configured',
        message: 'Meal analysis is not configured yet.',
      },
    }
  }

  const provider =
    config.provider ??
    createOpenAiMealAnalysisProvider({
      apiKey,
      fetchImpl: config.fetchImpl,
      model: config.model,
    })
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(
    () => controller.abort(),
    config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  )
  try {
    const data = await provider.analyze(validated.data, controller.signal)
    return { ok: true, data }
  } catch (error) {
    return resultForProviderError(error)
  } finally {
    globalThis.clearTimeout(timeoutId)
  }
}

export function validateMealAnalysisRequest(request: MealAnalysisRequest):
  | {
      ok: true
      data: {
        images: Array<{ base64: string; mimeType: MealImageMimeType }>
        note?: string
      }
    }
  | { ok: false; result: MealAnalysisApiResult } {
  if (!Array.isArray(request.images)) {
    return invalid('At least one meal photo is required.')
  }
  if (request.images.length < 1 || request.images.length > MAX_MEAL_PHOTOS) {
    return invalid(`Use between 1 and ${MAX_MEAL_PHOTOS} meal photos.`)
  }

  const images: Array<{ base64: string; mimeType: MealImageMimeType }> = []
  let totalLength = 0
  for (const value of request.images) {
    if (!isRecord(value)) {
      return invalid('A meal photo is invalid.')
    }
    const mimeType = value.mimeType
    const base64 = value.base64
    if (
      typeof mimeType !== 'string' ||
      !SUPPORTED_MEAL_IMAGE_TYPES.includes(mimeType as MealImageMimeType) ||
      typeof base64 !== 'string' ||
      !isBase64(base64)
    ) {
      return invalid('A meal photo has an unsupported format.')
    }
    if (base64.length > MAX_MEAL_IMAGE_BASE64_LENGTH) {
      return payloadTooLarge(
        'A meal photo is too large. Choose a smaller photo.',
      )
    }
    totalLength += base64.length
    if (totalLength > MAX_MEAL_IMAGE_BASE64_TOTAL) {
      return payloadTooLarge(
        'The meal photos are too large to analyze together.',
      )
    }
    images.push({ base64, mimeType: mimeType as MealImageMimeType })
  }

  if (request.note !== undefined && typeof request.note !== 'string') {
    return invalid('Meal details must be text.')
  }
  const note = typeof request.note === 'string' ? request.note.trim() : ''
  if (note.length > MAX_MEAL_NOTE_LENGTH) {
    return invalid(
      `Meal details must be ${MAX_MEAL_NOTE_LENGTH} characters or fewer.`,
    )
  }

  return {
    ok: true,
    data: { images, ...(note ? { note } : {}) },
  }
}

export function statusForMealAnalysisError(code: MealAnalysisApiErrorCode) {
  switch (code) {
    case 'invalid_request':
      return 400
    case 'payload_too_large':
      return 413
    case 'rate_limited':
      return 429
    case 'no_food_detected':
      return 422
    case 'invalid_response':
      return 502
    case 'provider_timeout':
      return 504
    case 'not_configured':
    case 'provider_unavailable':
      return 503
  }
}

function resultForProviderError(error: unknown): MealAnalysisApiResult {
  if (!(error instanceof MealAnalysisProviderError)) {
    return {
      ok: false,
      error: {
        code: 'provider_unavailable',
        message: 'Meal analysis is unavailable right now. Try again later.',
      },
    }
  }
  switch (error.code) {
    case 'no_food_detected':
      return { ok: false, error: { code: error.code, message: error.message } }
    case 'provider_timeout':
      return { ok: false, error: { code: error.code, message: error.message } }
    case 'invalid_response':
      return { ok: false, error: { code: error.code, message: error.message } }
    case 'provider_rate_limited':
      return {
        ok: false,
        error: {
          code: 'provider_unavailable',
          message: error.message,
          retryAfterSeconds: 60,
        },
      }
    case 'provider_unavailable':
      return { ok: false, error: { code: error.code, message: error.message } }
  }
}

function invalid(message: string) {
  return {
    ok: false as const,
    result: {
      ok: false as const,
      error: { code: 'invalid_request' as const, message },
    },
  }
}

function payloadTooLarge(message: string) {
  return {
    ok: false as const,
    result: {
      ok: false as const,
      error: { code: 'payload_too_large' as const, message },
    },
  }
}

function isBase64(value: string) {
  return (
    value.length >= 4 &&
    value.length % 4 === 0 &&
    /^[a-zA-Z0-9+/]+={0,2}$/.test(value)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
