import type { NormalizedFoodResult } from '@domain/foodProviderModels'
import type { FoodProviderId } from '@shared-types/app'

export type FoodProviderClientErrorCode =
  | 'invalid_request'
  | 'query_too_short'
  | 'no_acceptable_results'
  | 'offline'
  | 'provider_timeout'
  | 'provider_unavailable'
  | 'provider_rate_limited'
  | 'server_missing_configuration'
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
  results: NormalizedFoodResult[]
  fallbackUsed: boolean
}

export type SearchFoodsInput = {
  query: string
  provider?: FoodProviderId | 'all'
  page?: number
  pageSize?: number
  allowFallback?: boolean
  signal?: AbortSignal
}

export async function searchProviderFoods(input: SearchFoodsInput) {
  const params = new URLSearchParams({
    q: input.query,
  })
  if (input.provider) {
    params.set('provider', input.provider)
  }
  if (input.page !== undefined) {
    params.set('page', String(input.page))
  }
  if (input.pageSize !== undefined) {
    params.set('pageSize', String(input.pageSize))
  }
  if (input.allowFallback) {
    params.set('allowFallback', 'true')
  }

  return readProviderResponse<FoodSearchResponse>(
    await fetch(`/api/foods/search?${params.toString()}`, {
      signal: input.signal,
      headers: { Accept: 'application/json' },
    }),
  )
}

export async function resolveProviderFood(input: {
  provider: 'usda'
  providerRecordId: string
  signal?: AbortSignal
}) {
  const params = new URLSearchParams({
    provider: input.provider,
    providerRecordId: input.providerRecordId,
  })
  return readProviderResponse<NormalizedFoodResult>(
    await fetch(`/api/foods/resolve?${params.toString()}`, {
      signal: input.signal,
      headers: { Accept: 'application/json' },
    }),
  )
}

async function readProviderResponse<T>(response: Response): Promise<T> {
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
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
