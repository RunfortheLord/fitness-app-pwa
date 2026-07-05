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
import { TtlCache } from './foodProviderCache.js'
import { ProviderError, toProviderError } from './foodProviderErrors.js'

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
  | { ok: true; data: unknown }
  | { ok: false; error: { code: string; message: string } }

const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000
const OFF_CACHE_TTL_MS = 60 * 60 * 1000
const searchCache = new TtlCache<unknown>(150, SEARCH_CACHE_TTL_MS)
const offCache = new TtlCache<NormalizedFoodResult[]>(50, OFF_CACHE_TTL_MS)

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
      input.language,
    ].join('|')

    const data =
      input.provider === 'open_food_facts'
        ? await searchCache.getOrCreate(cacheKey, async () =>
            searchWithFallback(input, adapters, signal),
          )
        : await searchWithTypoCorrection(input, adapters, signal)
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

export async function handleFoodBarcodeLookup(
  request: FoodBarcodeRequest,
  config: FoodProviderApiConfig,
  signal?: AbortSignal,
): Promise<FoodProviderResponse> {
  try {
    const barcode = validateBarcode(request.barcode)
    const fetcher = config.fetcher ?? fetch
    const [usda, openFoodFacts] = await Promise.allSettled([
      lookupUsdaBarcode(config.usdaApiKey, barcode, signal, fetcher),
      lookupOpenFoodFactsBarcode(barcode, signal, fetcher),
    ])
    const usdaFood = usda.status === 'fulfilled' ? usda.value : null
    const offFood =
      openFoodFacts.status === 'fulfilled' ? openFoodFacts.value : null
    const food = usdaFood ?? offFood
    if (!food) {
      throw new ProviderError(
        'no_acceptable_results',
        'No complete barcode product was found.',
        404,
      )
    }
    return {
      ok: true,
      data: {
        barcode,
        result: food,
        alternate:
          usdaFood && offFood && usdaFood.id !== offFood.id ? offFood : null,
        sourcePreference: usdaFood ? 'usda' : 'open_food_facts',
      },
    }
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
  const cacheKey = [
    'off',
    input.query.toLocaleLowerCase(),
    input.page,
    input.pageSize,
    input.language,
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
