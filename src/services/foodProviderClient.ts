import type {
  GroupedFoodResult,
  NormalizedFoodResult,
} from '@domain/foodProviderModels'
import type { AppLanguage, FoodProviderId } from '@shared-types/app'

export type FoodProviderClientErrorCode =
  | 'invalid_request'
  | 'query_too_short'
  | 'no_acceptable_results'
  | 'offline'
  | 'missing_api_key'
  | 'invalid_api_key'
  | 'provider_timeout'
  | 'provider_unavailable'
  | 'provider_rate_limited'
  | 'server_missing_configuration'
  | 'api_route_misconfigured'
  | 'normalization_failure'
  | 'unexpected_server_error'

export class FoodProviderClientError extends Error {
  readonly code: FoodProviderClientErrorCode

  constructor(code: FoodProviderClientErrorCode, message: string) {
    super(message)
    this.name = 'FoodProviderClientError'
    this.code = code
  }
}

export type FoodSearchResponse = {
  provider: FoodProviderId | 'all'
  query: string
  results: GroupedFoodResult[]
  fallbackUsed: boolean
}

export type BarcodeLookupResponse = {
  barcode: string
  result: NormalizedFoodResult
  alternate: NormalizedFoodResult | null
  sourcePreference: FoodProviderId
}

export type SearchFoodsInput = {
  query: string
  apiKey: string
  provider?: FoodProviderId | 'all'
  page?: number
  pageSize?: number
  allowFallback?: boolean
  language?: AppLanguage
  signal?: AbortSignal
}

export async function searchProviderFoods(input: SearchFoodsInput) {
  return readProviderResponse<FoodSearchResponse>(
    await fetch('/api/foods/search', {
      method: 'POST',
      signal: input.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-USDA-FDC-API-Key': input.apiKey,
      },
      body: JSON.stringify({
        query: input.query,
        provider: input.provider,
        page: input.page,
        pageSize: input.pageSize,
        allowFallback: input.allowFallback,
        language: input.language,
      }),
    }),
  )
}

export async function resolveProviderFood(input: {
  apiKey: string
  provider: 'usda'
  providerRecordId: string
  signal?: AbortSignal
}) {
  return readProviderResponse<NormalizedFoodResult>(
    await fetch('/api/foods/details', {
      method: 'POST',
      signal: input.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-USDA-FDC-API-Key': input.apiKey,
      },
      body: JSON.stringify({
        provider: input.provider,
        providerRecordId: input.providerRecordId,
      }),
    }),
  )
}

export async function testUsdaApiKey(input: {
  apiKey: string
  signal?: AbortSignal
}) {
  return readProviderResponse<{ status: 'connected' }>(
    await fetch('/api/foods/test-key', {
      method: 'POST',
      signal: input.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-USDA-FDC-API-Key': input.apiKey,
      },
      body: JSON.stringify({}),
    }),
  )
}

export async function lookupBarcodeProduct(input: {
  barcode: string
  apiKey: string
  signal?: AbortSignal
}) {
  return readProviderResponse<BarcodeLookupResponse>(
    await fetch('/api/foods/barcode', {
      method: 'POST',
      signal: input.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-USDA-FDC-API-Key': input.apiKey,
      },
      body: JSON.stringify({ barcode: input.barcode }),
    }),
  )
}

async function readProviderResponse<T>(response: Response): Promise<T> {
  let payload: unknown
  try {
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) {
      throw new FoodProviderClientError(
        response.url.includes('/api/')
          ? 'api_route_misconfigured'
          : 'unexpected_server_error',
        response.url.includes('/api/')
          ? 'Food provider API route returned the app shell instead of JSON.'
          : 'Food provider returned a non-JSON response.',
      )
    }
    payload = await response.json()
  } catch (error) {
    if (error instanceof FoodProviderClientError) {
      throw error
    }
    throw new FoodProviderClientError(
      'unexpected_server_error',
      'Food provider returned an unreadable response.',
    )
  }

  if (isProviderSuccess<T>(payload)) {
    return payload.data
  }

  if (isProviderError(payload)) {
    throw new FoodProviderClientError(
      payload.error.code as FoodProviderClientErrorCode,
      payload.error.message,
    )
  }

  throw new FoodProviderClientError(
    'unexpected_server_error',
    'Food provider returned an unexpected response.',
  )
}

function isProviderSuccess<T>(value: unknown): value is { ok: true; data: T } {
  return isRecord(value) && value.ok === true && 'data' in value
}

function isProviderError(
  value: unknown,
): value is { ok: false; error: { code: string; message: string } } {
  return (
    isRecord(value) &&
    value.ok === false &&
    isRecord(value.error) &&
    typeof value.error.code === 'string' &&
    typeof value.error.message === 'string'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
