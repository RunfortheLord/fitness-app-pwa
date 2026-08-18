import { mealAnalysisSchema, type MealAnalysis } from '@domain/mealAnalysis'
import {
  MAX_MEAL_IMAGE_BASE64_LENGTH,
  MAX_MEAL_IMAGE_BASE64_TOTAL,
  MAX_MEAL_NOTE_LENGTH,
  MAX_MEAL_PHOTOS,
  SUPPORTED_MEAL_IMAGE_TYPES,
  type MealImageMimeType,
} from '@domain/mealAnalysisLimits'

export { MAX_MEAL_IMAGE_BASE64_LENGTH, MAX_MEAL_NOTE_LENGTH, MAX_MEAL_PHOTOS }

export type MealImageInput = {
  base64: string
  mimeType: MealImageMimeType
}

export type MealAnalysisErrorCode =
  | 'invalid_request'
  | 'payload_too_large'
  | 'rate_limited'
  | 'not_configured'
  | 'network_unavailable'
  | 'provider_timeout'
  | 'provider_unavailable'
  | 'invalid_response'
  | 'no_food_detected'
  | 'api_route_misconfigured'

export class MealAnalysisError extends Error {
  readonly code: MealAnalysisErrorCode
  readonly httpStatus?: number
  readonly retryAfterSeconds?: number

  constructor(
    code: MealAnalysisErrorCode,
    message: string,
    options: { httpStatus?: number; retryAfterSeconds?: number } = {},
  ) {
    super(message)
    this.name = 'MealAnalysisError'
    this.code = code
    this.httpStatus = options.httpStatus
    this.retryAfterSeconds = options.retryAfterSeconds
  }
}

export async function analyzeMealPhoto(input: {
  images: MealImageInput[]
  note?: string
  fetchImpl?: typeof fetch
}): Promise<MealAnalysis> {
  const request = validateClientInput(input.images, input.note)
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), 55_000)
  let response: Response
  try {
    response = await (input.fetchImpl ?? fetch)('/api/meal-analysis', {
      body: JSON.stringify(request),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
      signal: controller.signal,
    })
  } catch (error) {
    if (controller.signal.aborted || isAbortError(error)) {
      throw new MealAnalysisError(
        'provider_timeout',
        'Meal analysis timed out. Try again.',
      )
    }
    throw new MealAnalysisError(
      'network_unavailable',
      'Meal analysis could not be reached. Check your connection and try again.',
    )
  } finally {
    globalThis.clearTimeout(timeoutId)
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new MealAnalysisError(
      'api_route_misconfigured',
      'The meal-analysis API route returned the app shell instead of JSON.',
      { httpStatus: response.status },
    )
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw invalidResponse(response.status)
  }

  if (response.ok && isSuccess(payload)) {
    const validated = mealAnalysisSchema.safeParse(payload.data)
    if (!validated.success) {
      throw invalidResponse(response.status)
    }
    return validated.data
  }

  if (isError(payload)) {
    throw new MealAnalysisError(
      toClientErrorCode(payload.error.code),
      payload.error.message,
      {
        httpStatus: response.status,
        retryAfterSeconds:
          readPositiveInteger(payload.error.retryAfterSeconds) ??
          readPositiveInteger(response.headers.get('retry-after')) ??
          undefined,
      },
    )
  }
  throw invalidResponse(response.status)
}

function validateClientInput(
  images: MealImageInput[],
  note: string | undefined,
) {
  if (images.length < 1 || images.length > MAX_MEAL_PHOTOS) {
    throw new MealAnalysisError(
      'invalid_request',
      `Use between 1 and ${MAX_MEAL_PHOTOS} meal photos.`,
    )
  }
  let totalLength = 0
  const boundedImages = images.map((image) => {
    if (!SUPPORTED_MEAL_IMAGE_TYPES.includes(image.mimeType)) {
      throw new MealAnalysisError(
        'invalid_request',
        'A meal photo has an unsupported format.',
      )
    }
    if (image.base64.length > MAX_MEAL_IMAGE_BASE64_LENGTH) {
      throw new MealAnalysisError(
        'payload_too_large',
        'A meal photo is too large. Choose a smaller photo.',
      )
    }
    totalLength += image.base64.length
    return { base64: image.base64, mimeType: image.mimeType }
  })
  if (totalLength > MAX_MEAL_IMAGE_BASE64_TOTAL) {
    throw new MealAnalysisError(
      'payload_too_large',
      'The meal photos are too large to analyze together.',
    )
  }
  const trimmedNote = note?.trim() ?? ''
  if (trimmedNote.length > MAX_MEAL_NOTE_LENGTH) {
    throw new MealAnalysisError(
      'invalid_request',
      `Meal details must be ${MAX_MEAL_NOTE_LENGTH} characters or fewer.`,
    )
  }
  return {
    images: boundedImages,
    ...(trimmedNote ? { note: trimmedNote } : {}),
  }
}

function toClientErrorCode(value: string): MealAnalysisErrorCode {
  switch (value) {
    case 'invalid_request':
    case 'payload_too_large':
    case 'rate_limited':
    case 'not_configured':
    case 'provider_timeout':
    case 'provider_unavailable':
    case 'invalid_response':
    case 'no_food_detected':
      return value
    default:
      return 'provider_unavailable'
  }
}

function invalidResponse(httpStatus?: number) {
  return new MealAnalysisError(
    'invalid_response',
    'Meal analysis returned data the app could not validate.',
    { httpStatus },
  )
}

function isSuccess(value: unknown): value is { ok: true; data: unknown } {
  return isRecord(value) && value.ok === true && 'data' in value
}

function isError(value: unknown): value is {
  ok: false
  error: { code: string; message: string; retryAfterSeconds?: unknown }
} {
  return (
    isRecord(value) &&
    value.ok === false &&
    isRecord(value.error) &&
    typeof value.error.code === 'string' &&
    typeof value.error.message === 'string'
  )
}

function readPositiveInteger(value: unknown) {
  const numberValue = typeof value === 'string' ? Number(value) : value
  return typeof numberValue === 'number' &&
    Number.isInteger(numberValue) &&
    numberValue > 0
    ? numberValue
    : null
}

function isAbortError(value: unknown) {
  return value instanceof DOMException && value.name === 'AbortError'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
