import {
  normalizeProviderQuery,
  type NormalizedFoodResult,
} from '../domain/foodProviderModels.js'
import { correctFoodQuery } from '../domain/foodSpellingCorrection.js'
import {
  createOpenFoodFactsAdapter,
  createUsdaAdapter,
  lookupOpenFoodFactsBarcode,
  lookupUsdaBarcode,
  resolveUsdaFood,
  type ProviderAdapter,
} from './foodProviderAdapters.js'
import {
  TtlCache,
  type AsyncCacheAdapter,
  type CacheOutcome,
} from './foodProviderCache.js'
import { ProviderError, toProviderError } from './foodProviderErrors.js'

export type FoodProviderApiConfig = {
  usdaApiKey?: string
  fetcher?: typeof fetch
  caches?: FoodProviderCaches
  bypassCache?: boolean
}

export type FoodProviderCaches = {
  barcode: AsyncCacheAdapter<unknown>
  details: AsyncCacheAdapter<unknown>
  search: AsyncCacheAdapter<unknown>
}

export type SearchProviderName = 'usda' | 'open_food_facts' | 'all'

export type FoodSearchRequest = {
  query: string
  provider?: SearchProviderName
  page?: number
  pageSize?: number
  allowFallback?: boolean
  language?: 'en' | 'es'
}

export type FoodResolveRequest = {
  provider: 'usda'
  providerRecordId: string
}

export type FoodBarcodeRequest = {
  barcode: string
}

export type FoodProviderResponse =
  | {
      ok: true
      data: unknown
      meta: { cache: CacheOutcome | 'bypass' }
    }
  | { ok: false; error: { code: string; message: string } }

const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000
const DETAILS_CACHE_TTL_MS = 6 * 60 * 60 * 1000
const BARCODE_CACHE_TTL_MS = 6 * 60 * 60 * 1000
const defaultCaches: FoodProviderCaches = {
  barcode: new TtlCache<unknown>(250, BARCODE_CACHE_TTL_MS),
  details: new TtlCache<unknown>(500, DETAILS_CACHE_TTL_MS),
  search: new TtlCache<unknown>(300, SEARCH_CACHE_TTL_MS),
}

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
    const cacheKey = cacheKeyFor('search', [
      input.provider,
      input.query.toLowerCase(),
      input.page,
      input.pageSize,
      input.allowFallback,
      input.language,
    ])
    const create = async () =>
      limitSearchResults(
        await searchWithTypoCorrection(input, adapters, signal),
        input.pageSize,
      )
    if (config.bypassCache) {
      return { ok: true, data: await create(), meta: { cache: 'bypass' } }
    }
    const lookup = await (
      config.caches ?? defaultCaches
    ).search.getOrCreateWithStatus(cacheKey, create)
    return { ok: true, data: lookup.value, meta: { cache: lookup.outcome } }
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
    if (!/^\d{1,20}$/.test(request.providerRecordId)) {
      throw new ProviderError('invalid_request', 'Invalid provider record ID.')
    }
    const create = () =>
      resolveUsdaFood(
        config.usdaApiKey,
        request.providerRecordId,
        signal,
        config.fetcher ?? fetch,
      )
    if (config.bypassCache) {
      return { ok: true, data: await create(), meta: { cache: 'bypass' } }
    }
    const lookup = await (
      config.caches ?? defaultCaches
    ).details.getOrCreateWithStatus(
      cacheKeyFor('details', [request.provider, request.providerRecordId]),
      create,
    )
    return { ok: true, data: lookup.value, meta: { cache: lookup.outcome } }
  } catch (error) {
    return formatError(error)
  }
}

export async function handleFoodBarcodeLookup(
  request: FoodBarcodeRequest,
  config: FoodProviderApiConfig,
  signal?: AbortSignal,
): Promise<FoodProviderResponse> {
  try {
    const barcode = validateBarcode(request.barcode)
    const fetcher = config.fetcher ?? fetch
    const create = async () => {
      const [usda, openFoodFacts] = await Promise.allSettled([
        lookupUsdaBarcode(config.usdaApiKey, barcode, signal, fetcher),
        lookupOpenFoodFactsBarcode(barcode, signal, fetcher),
      ])
      const usdaFood = usda.status === 'fulfilled' ? usda.value : null
      const offFood =
        openFoodFacts.status === 'fulfilled' ? openFoodFacts.value : null
      const food = usdaFood ?? offFood
      if (!food) {
        const transientFailure = [usda, openFoodFacts].find(
          (result): result is PromiseRejectedResult =>
            result.status === 'rejected' &&
            toProviderError(result.reason).code !== 'no_acceptable_results',
        )
        if (transientFailure) {
          throw toProviderError(transientFailure.reason)
        }
        throw new ProviderError(
          'no_acceptable_results',
          'No complete barcode product was found.',
          404,
        )
      }
      return {
        barcode,
        result: food,
        alternate:
          usdaFood && offFood && usdaFood.id !== offFood.id ? offFood : null,
        sourcePreference: usdaFood ? 'usda' : 'open_food_facts',
      }
    }
    if (config.bypassCache) {
      return { ok: true, data: await create(), meta: { cache: 'bypass' } }
    }
    const lookup = await (
      config.caches ?? defaultCaches
    ).barcode.getOrCreateWithStatus(cacheKeyFor('barcode', [barcode]), create)
    return { ok: true, data: lookup.value, meta: { cache: lookup.outcome } }
  } catch (error) {
    return formatError(error)
  }
}

export function validateSearchRequest(request: FoodSearchRequest) {
  const query = normalizeProviderQuery(request.query ?? '')
  if (!query) {
    throw new ProviderError('invalid_request', 'Query is required.')
  }
  if (query.length < 3) {
    throw new ProviderError(
      'query_too_short',
      'Query must be at least 3 characters.',
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
    language: validateSearchLanguage(request.language),
  }
}

function validateSearchLanguage(language: FoodSearchRequest['language']) {
  if (language === undefined || language === 'en') {
    return 'en' as const
  }
  if (language === 'es') {
    return 'es' as const
  }
  throw new ProviderError('invalid_request', 'Unsupported search language.')
}

function containsControlCharacter(value: string) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0)
    return code < 32 || code === 127
  })
}

function validateBarcode(value: string) {
  const barcode = String(value ?? '').trim()
  if (!/^\d{8,14}$/.test(barcode)) {
    throw new ProviderError(
      'invalid_request',
      'Barcode must be 8 to 14 digits.',
    )
  }
  return barcode
}

// When a query token is an obvious misspelling (USDA returns nothing canonical
// for it), retry once with the corrected spelling and merge the canonical
// results in. The original results are kept first so stored misspelled brand
// products still appear; the client's section split surfaces the canonical
// (Common) matches above them.
async function searchWithTypoCorrection(
  input: ReturnType<typeof validateSearchRequest>,
  adapters: Record<'usda' | 'open_food_facts', ProviderAdapter>,
  signal?: AbortSignal,
) {
  const base = await searchWithFallback(input, adapters, signal)
  const corrected = correctFoodQuery(input.query)
  if (!corrected) {
    return base
  }

  const correctedData = await searchWithFallback(
    { ...input, query: corrected },
    adapters,
    signal,
  )
  const seenIds = new Set(base.results.map((result) => result.id))
  const merged = [...base.results]
  for (const result of correctedData.results) {
    if (!seenIds.has(result.id)) {
      seenIds.add(result.id)
      merged.push(result)
    }
  }
  return { ...base, results: merged }
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
  const results = await adapter.search({ ...input, signal })
  return {
    provider: 'open_food_facts',
    query: input.query,
    results,
    fallbackUsed: false,
  }
}

function cacheKeyFor(operation: string, values: unknown[]) {
  return `food:v1:${operation}:${JSON.stringify(values)}`
}

function limitSearchResults<T extends { results: NormalizedFoodResult[] }>(
  data: T,
  pageSize: number,
) {
  return {
    ...data,
    results: data.results.slice(0, Math.min(100, pageSize * 3)),
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
