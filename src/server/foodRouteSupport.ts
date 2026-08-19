import { readAnonymousClientKey, type ServerRequestLike } from './serverHttp.js'
import {
  createMemoryServerRateLimiter,
  evaluateRateLimit,
} from './serverRateLimiter.js'

export const MAX_FOOD_REQUEST_BODY_BYTES = 8_192
export const FOOD_REQUEST_TIMEOUT_MS = 12_000

const limiter = createMemoryServerRateLimiter()

export async function checkFoodRouteRateLimit(
  request: ServerRequestLike,
  scope: 'search' | 'details' | 'barcode' | 'test-key',
) {
  const limit =
    scope === 'search'
      ? 60
      : scope === 'details'
        ? 90
        : scope === 'barcode'
          ? 30
          : 10
  return evaluateRateLimit({
    failClosed: false,
    key: readAnonymousClientKey(request),
    limit,
    limiter,
    scope: `food-${scope}`,
    windowMs: 60_000,
  })
}

export function statusForFoodError(code: string) {
  switch (code) {
    case 'invalid_request':
    case 'query_too_short':
    case 'missing_api_key':
      return 400
    case 'invalid_api_key':
      return 401
    case 'rate_limited':
    case 'provider_rate_limited':
      return 429
    case 'provider_timeout':
      return 504
    case 'provider_unavailable':
    case 'offline':
      return 503
    case 'no_acceptable_results':
      return 404
    default:
      return 500
  }
}
