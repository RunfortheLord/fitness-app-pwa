import { normalizeProviderQuery } from '@domain/foodProviderModels'
import {
  createOpenFoodFactsAdapter,
  createUsdaAdapter,
  resolveUsdaFood,
  type ProviderAdapter,
} from './foodProviderAdapters'
import { TtlCache } from './foodProviderCache'
import { ProviderError, toProviderError } from './foodProviderErrors'

export type FoodProviderApiConfig = {
  usdaApiKey?: string
  fetcher?: typeof fetch
}

export type SearchProviderName = 'usda' | 'open_food_facts' | 'all'

export type FoodSearchRequest = {
  query: string
  provider?: SearchProviderName
  page?: number
  pageSize?: number
  allowFallback?: boolean
}

export type FoodResolveRequest = {
  provider: 'usda'
  providerRecordId: string
}

export type FoodProviderResponse =
  | { ok: true; data: unknown }
  | { ok: false; error: { code: string; message: string } }

const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000
const OFF_CACHE_TTL_MS = 60 * 60 * 1000
const searchCache = new TtlCache<unknown>(150, SEARCH_CACHE_TTL_MS)
const offCache = new TtlCache<unknown>(50, OFF_CACHE_TTL_MS)

export async function handleFoodSearch(
  request: FoodSearchRequest,
  config: FoodProviderApiConfig,
  signal?: AbortSignal,
): Promise<FoodProviderResponse> {
  try {
    const input = validateSearchRequest(request)
    const fetcher = config.fetcher ?? fetch
    const adapters = {
      usda: createUsdaAdapter(config.usdaApiKey, fetcher),
      open_food_facts: createOpenFoodFactsAdapter(fetcher),
    } as const
    const cacheKey = [
      'search',
      input.provider,
      input.query.toLocaleLowerCase(),
      input.page,
      input.pageSize,
      input.allowFallback,
    ].join('|')

    const data = await searchCache.getOrCreate(cacheKey, async () =>
      searchWithFallback(input, adapters, signal),
    )
    return { ok: true, data }
  } catch (error) {
    return formatError(error)
  }
}

export async function handleFoodResolve(
  request: FoodResolveRequest,
  config: FoodProviderApiConfig,
  signal?: AbortSignal,
): Promise<FoodProviderResponse> {
  try {
    if (request.provider !== 'usda') {
      throw new ProviderError('invalid_request', 'Unsupported provider.')
    }
    const data = await resolveUsdaFood(
      config.usdaApiKey,
      request.providerRecordId,
      signal,
      config.fetcher ?? fetch,
    )
    return { ok: true, data }
  } catch (error) {
    return formatError(error)
  }
}

export function validateSearchRequest(request: FoodSearchRequest) {
  const query = normalizeProviderQuery(request.query ?? '')
  if (!query) {
    throw new ProviderError('invalid_request', 'Query is required.')
  }
  if (query.length < 2) {
    throw new ProviderError(
      'query_too_short',
      'Query must be at least 2 characters.',
    )
  }
  if (query.length > 80) {
    throw new ProviderError(
      'invalid_request',
      'Query must be 80 characters or less.',
    )
  }
  if (containsControlCharacter(query)) {
    throw new ProviderError(
      'invalid_request',
      'Query contains unsupported control characters.',
    )
  }

  const provider = request.provider ?? 'usda'
  if (!['usda', 'open_food_facts', 'all'].includes(provider)) {
    throw new ProviderError('invalid_request', 'Unsupported provider.')
  }

  const page = request.page ?? 1
  const pageSize = request.pageSize ?? 20
  if (!Number.isInteger(page) || page < 1 || page > 20) {
    throw new ProviderError('invalid_request', 'Invalid page.')
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    throw new ProviderError('invalid_request', 'Invalid page size.')
  }

  return {
    query,
    provider: provider as SearchProviderName,
    page,
    pageSize,
    allowFallback: request.allowFallback ?? false,
  }
}

function containsControlCharacter(value: string) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0)
    return code < 32 || code === 127
  })
}

async function searchWithFallback(
  input: ReturnType<typeof validateSearchRequest>,
  adapters: Record<'usda' | 'open_food_facts', ProviderAdapter>,
  signal?: AbortSignal,
) {
  if (input.provider === 'open_food_facts') {
    return searchOpenFoodFacts(input, adapters.open_food_facts, signal)
  }

  const usdaResults = await adapters.usda.search({ ...input, signal })
  if (
    usdaResults.length > 0 ||
    (input.provider === 'usda' && !input.allowFallback)
  ) {
    return {
      provider: 'usda',
      query: input.query,
      results: usdaResults,
      fallbackUsed: false,
    }
  }

  const fallbackResults = await searchOpenFoodFacts(
    input,
    adapters.open_food_facts,
    signal,
  )
  return {
    provider: 'all',
    query: input.query,
    results: fallbackResults.results,
    fallbackUsed: true,
  }
}

async function searchOpenFoodFacts(
  input: ReturnType<typeof validateSearchRequest>,
  adapter: ProviderAdapter,
  signal?: AbortSignal,
) {
  const cacheKey = [
    'off',
    input.query.toLocaleLowerCase(),
    input.page,
    input.pageSize,
  ].join('|')
  const results = await offCache.getOrCreate(cacheKey, () =>
    adapter.search({ ...input, signal }),
  )
  return {
    provider: 'open_food_facts',
    query: input.query,
    results,
    fallbackUsed: false,
  }
}

function formatError(error: unknown): FoodProviderResponse {
  const providerError = toProviderError(error)
  return {
    ok: false,
    error: {
      code: providerError.code,
      message: providerError.message,
    },
  }
}
