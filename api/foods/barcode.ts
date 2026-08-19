/// <reference types="node" />
import { handleFoodBarcodeLookup } from '../../src/server/foodProviderApi.js'
import {
  checkFoodRouteRateLimit,
  FOOD_REQUEST_TIMEOUT_MS,
  MAX_FOOD_REQUEST_BODY_BYTES,
  statusForFoodError,
} from '../../src/server/foodRouteSupport.js'
import {
  createRequestObserver,
  readBoundedJsonObject,
} from '../../src/server/serverHttp.js'

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

type ProviderErrorResponse = {
  ok: false
  error: { code: string; message: string }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const observer = createRequestObserver({
    headers: req.headers,
    method: req.method,
    route: '/api/foods/barcode',
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

  const parsedBody = readBoundedJsonObject(
    req.body,
    MAX_FOOD_REQUEST_BODY_BYTES,
  )
  if ('reason' in parsedBody) {
    const status = parsedBody.reason === 'payload_too_large' ? 413 : 400
    observer.finish({ outcome: parsedBody.reason, status })
    res.status(status).json({
      ok: false,
      error: {
        code: 'invalid_request',
        message: 'The barcode request is invalid.',
      },
    })
    return
  }
  const rateLimit = await checkFoodRouteRateLimit(req, 'barcode')
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds))
    observer.finish({ outcome: 'rate_limited', status: 429 })
    res.status(429).json({
      ok: false,
      error: {
        code: 'rate_limited',
        message: 'Barcode lookups are being requested too quickly.',
      },
    })
    return
  }

  const body = parsedBody.data
  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(),
    FOOD_REQUEST_TIMEOUT_MS,
  )
  const result = await handleFoodBarcodeLookup(
    { barcode: readString(body.barcode) },
    { usdaApiKey: readApiKey(req) },
    controller.signal,
  ).finally(() => clearTimeout(timeoutId))

  if (result.ok) {
    observer.finish({
      cache: result.meta.cache,
      outcome: 'success',
      provider: 'usda+open_food_facts',
      rateLimiterAvailable: rateLimit.available,
      status: 200,
    })
    res.status(200).json(result)
    return
  }

  const errorResult = result as ProviderErrorResponse
  const status = statusForFoodError(errorResult.error.code)
  if (status === 429) {
    res.setHeader('Retry-After', '60')
  }
  observer.finish({
    outcome: errorResult.error.code,
    provider: 'usda+open_food_facts',
    rateLimiterAvailable: rateLimit.available,
    status,
  })
  res.status(status).json(errorResult)
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function readApiKey(req: VercelRequest) {
  const value = req.headers?.['x-usda-fdc-api-key']
  const headerKey = Array.isArray(value) ? value[0] : value
  // Prefer a user-supplied key; otherwise fall back to the server-configured
  // USDA key so users do not have to enter their own. The server env var is
  // never bundled into the client output.
  return headerKey && headerKey.trim()
    ? headerKey
    : process.env.USDA_FDC_API_KEY
}
