import {
  FOOD_NORMALIZER_VERSION,
  classifyRawCooked,
  createServing,
  derivePer100GramMacros,
  derivePerServingMacros,
  groupDuplicateFoods,
  normalizeFoodText,
  rankFoods,
  stableProviderId,
  validateRequiredMacros,
  type NormalizedFoodMacros,
  type NormalizedFoodPortion,
  type NormalizedFoodResult,
} from '../domain/foodProviderModels.js'
import { ProviderError } from './foodProviderErrors.js'

export type ProviderSearchInput = {
  query: string
  page: number
  pageSize: number
  signal?: AbortSignal
  now?: Date
}

export type ProviderAdapter = {
  id: 'usda' | 'open_food_facts'
  search(input: ProviderSearchInput): Promise<NormalizedFoodResult[]>
}

type Fetcher = typeof fetch

const USDA_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search'
const USDA_FOOD_URL = 'https://api.nal.usda.gov/fdc/v1/food'
const OFF_SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl'
const OFF_PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product'
const USER_AGENT = 'FitnessLog/0.0.0 (local-first fitness PWA)'

export function createUsdaAdapter(
  apiKey: string | undefined,
  fetcher: Fetcher = fetch,
): ProviderAdapter {
  return {
    id: 'usda',
    async search(input) {
      if (!apiKey) {
        throw new ProviderError('missing_api_key', 'USDA API key is missing.')
      }

      const url = new URL(USDA_SEARCH_URL)
      url.searchParams.set('api_key', apiKey)
      const response = await fetchWithTimeout(
        fetcher,
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'User-Agent': USER_AGENT,
          },
          body: JSON.stringify({
            query: input.query,
            pageSize: input.pageSize,
            pageNumber: input.page,
            dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'],
          }),
        },
        input.signal,
      )
      const payload = await readProviderJson(response)
      const records =
        isRecord(payload) && Array.isArray(payload.foods) ? payload.foods : []
      const foods = records
        .map((record) => normalizeUsdaFood(record, input.now ?? new Date()))
        .filter((food): food is NormalizedFoodResult => food !== null)
      return groupDuplicateFoods(rankFoods(foods, input.query))
    },
  }
}

export function createOpenFoodFactsAdapter(
  fetcher: Fetcher = fetch,
): ProviderAdapter {
  return {
    id: 'open_food_facts',
    async search(input) {
      const url = new URL(OFF_SEARCH_URL)
      url.searchParams.set('search_terms', input.query)
      url.searchParams.set('search_simple', '1')
      url.searchParams.set('action', 'process')
      url.searchParams.set('json', '1')
      url.searchParams.set('page', String(input.page))
      url.searchParams.set('page_size', String(input.pageSize))
      url.searchParams.set(
        'fields',
        [
          'code',
          'product_name',
          'generic_name',
          'brands',
          'brands_tags',
          'categories',
          'serving_size',
          'serving_quantity',
          'nutriments',
          'last_modified_t',
          'url',
        ].join(','),
      )

      const response = await fetchWithTimeout(
        fetcher,
        url,
        {
          headers: {
            Accept: 'application/json',
            'User-Agent': USER_AGENT,
          },
        },
        input.signal,
      )
      const payload = await readProviderJson(response)
      const records =
        isRecord(payload) && Array.isArray(payload.products)
          ? payload.products
          : []
      const foods = records
        .map((record) =>
          normalizeOpenFoodFactsFood(record, input.now ?? new Date()),
        )
        .filter((food): food is NormalizedFoodResult => food !== null)
      return groupDuplicateFoods(rankFoods(foods, input.query))
    },
  }
}

export async function resolveUsdaFood(
  apiKey: string | undefined,
  providerRecordId: string,
  signal?: AbortSignal,
  fetcher: Fetcher = fetch,
) {
  if (!apiKey) {
    throw new ProviderError('missing_api_key', 'USDA API key is missing.')
  }
  if (!/^\d+$/.test(providerRecordId)) {
    throw new ProviderError('invalid_request', 'Invalid provider record ID.')
  }
  const url = new URL(`${USDA_FOOD_URL}/${providerRecordId}`)
  url.searchParams.set('api_key', apiKey)
  const response = await fetchWithTimeout(
    fetcher,
    url,
    {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    },
    signal,
  )
  const payload = await readProviderJson(response)
  const food = normalizeUsdaFood(payload, new Date())
  if (!food) {
    throw new ProviderError(
      'no_acceptable_results',
      'The provider record is missing required macros.',
      404,
    )
  }
  return food
}

export async function lookupUsdaBarcode(
  apiKey: string | undefined,
  barcode: string,
  signal?: AbortSignal,
  fetcher: Fetcher = fetch,
) {
  const adapter = createUsdaAdapter(apiKey, fetcher)
  const results = await adapter.search({
    query: barcode,
    page: 1,
    pageSize: 10,
    signal,
  })
  return (
    results.find((result) => result.source.barcode === barcode) ??
    results[0] ??
    null
  )
}

export async function lookupOpenFoodFactsBarcode(
  barcode: string,
  signal?: AbortSignal,
  fetcher: Fetcher = fetch,
) {
  const url = new URL(`${OFF_PRODUCT_URL}/${encodeURIComponent(barcode)}.json`)
  url.searchParams.set(
    'fields',
    [
      'code',
      'product_name',
      'generic_name',
      'brands',
      'brands_tags',
      'categories',
      'serving_size',
      'serving_quantity',
      'nutriments',
      'last_modified_t',
      'url',
    ].join(','),
  )
  const response = await fetchWithTimeout(
    fetcher,
    url,
    { headers: { Accept: 'application/json', 'User-Agent': USER_AGENT } },
    signal,
  )
  const payload = await readProviderJson(response)
  const product = isRecord(payload) ? payload.product : null
  return normalizeOpenFoodFactsFood(product, new Date())
}

export function normalizeUsdaFood(
  record: unknown,
  now: Date,
): NormalizedFoodResult | null {
  if (!isRecord(record)) {
    return null
  }
  const fdcId = readStringOrNumber(record.fdcId)
  const description = readString(record.description) ?? ''
  if (!fdcId || !description.trim()) {
    return null
  }

  const nutrients = Array.isArray(record.foodNutrients)
    ? record.foodNutrients
    : []
  const per100 = extractUsdaMacros(nutrients)
  const macroValidation = validateRequiredMacros(per100)
  if (!macroValidation.ok) {
    return null
  }

  const portions = extractUsdaPortions(record)
  const serving = createServing({
    quantity: portions[0]?.amount ?? readNumber(record.servingSize) ?? 100,
    unit: portions[0]?.unit ?? readString(record.servingSizeUnit) ?? 'g',
    description:
      portions[0]?.description ??
      readString(record.householdServingFullText) ??
      '',
    gramsPerServing:
      portions[0]?.gramWeight ?? gramsFromUsdaServingSize(record) ?? 100,
    conversionSource: portions[0]?.gramWeight
      ? 'provider_portion_weight'
      : 'provider_serving_weight',
    sourcePortions: portions,
  })
  const macrosPer100Grams = toMacros(macroValidation.macros)
  const macrosPerServing = derivePerServingMacros(
    macrosPer100Grams,
    serving.gramsPerServing,
  )
  const rawCooked = classifyUsdaRawCooked(record, description)
  const brandName =
    readString(record.brandOwner) ??
    readString(record.brandName) ??
    readString(record.distributorName)
  const dataType = readString(record.dataType) ?? 'unknown'
  const sourceUpdatedAt =
    readIsoDate(record.modifiedDate) ??
    readIsoDate(record.availableDate) ??
    readIsoDate(record.publicationDate)

  return {
    id: stableProviderId('usda', fdcId),
    source: {
      provider: 'usda',
      providerRecordId: fdcId,
      providerDataType: dataType,
      sourceName: 'USDA FoodData Central',
      sourceUrl: `https://fdc.nal.usda.gov/fdc-app.html#/food-details/${fdcId}/nutrients`,
      barcode: readString(record.gtinUpc),
      sourceUpdatedAt,
      ingestedAt: now.toISOString(),
    },
    name: description.trim(),
    brandName,
    foodCategory:
      readString(record.foodCategory) ?? readString(record.brandedFoodCategory),
    descriptionQualifiers: [],
    rawCookedStatus: rawCooked.rawCookedStatus,
    rawCookedBasis: rawCooked.rawCookedBasis,
    serving,
    macrosPerServing,
    macrosPer100Grams,
    macroBasis: macrosPerServing ? 'both' : 'per_100g',
    sourcePrecision: {},
    normalizedSearchName: normalizeFoodText(description),
    normalizedBrand: brandName ? normalizeFoodText(brandName) : null,
    providerPriority:
      dataType === 'Foundation'
        ? 100
        : dataType === 'Survey (FNDDS)'
          ? 95
          : dataType === 'SR Legacy'
            ? 90
            : 85,
    relevanceScore: 0,
    duplicateGroupId: stableProviderId('usda', fdcId),
    alternateResultIds: [],
    groupingReasons: [],
    normalizerVersion: FOOD_NORMALIZER_VERSION,
  }
}

export function normalizeOpenFoodFactsFood(
  record: unknown,
  now: Date,
): NormalizedFoodResult | null {
  if (!isRecord(record)) {
    return null
  }
  const code = readStringOrNumber(record.code)
  const nutriments = isRecord(record.nutriments) ? record.nutriments : {}
  const perServingValidation = validateRequiredMacros({
    calories: firstNumber(
      nutriments['energy-kcal_serving'],
      kilojoulesToKilocalories(nutriments['energy-kj_serving']),
    ),
    protein: nutriments.proteins_serving,
    carbohydrate: nutriments.carbohydrates_serving,
    fat: nutriments.fat_serving,
  })
  const per100Validation = validateRequiredMacros({
    calories: firstNumber(
      nutriments['energy-kcal_100g'],
      kilojoulesToKilocalories(nutriments['energy-kj_100g']),
    ),
    protein: nutriments.proteins_100g,
    carbohydrate: nutriments.carbohydrates_100g,
    fat: nutriments.fat_100g,
  })
  if (!code || (!perServingValidation.ok && !per100Validation.ok)) {
    return null
  }
  const name =
    readString(record.product_name) ??
    readString(record.generic_name) ??
    'Open Food Facts product'
  const gramsPerServing = readNumber(record.serving_quantity)
  const serving = createServing({
    quantity: 1,
    unit: readString(record.serving_size) ?? 'serving',
    description: readString(record.serving_size) ?? '',
    gramsPerServing,
    conversionSource: 'provider_serving_weight',
  })
  const macrosPer100Grams = per100Validation.ok
    ? toMacros(per100Validation.macros)
    : derivePer100GramMacros(
        toMacros(perServingValidation.macros),
        serving.gramsPerServing,
      )
  const macrosPerServing = perServingValidation.ok
    ? toMacros(perServingValidation.macros)
    : macrosPer100Grams
      ? derivePerServingMacros(macrosPer100Grams, serving.gramsPerServing)
      : null
  const brandName = normalizeBrand(readString(record.brands))
  const sourceUpdatedAt = unixToIso(readNumber(record.last_modified_t))
  const rawCooked = classifyUsdaRawCooked(record, name)

  return {
    id: stableProviderId('open_food_facts', code),
    source: {
      provider: 'open_food_facts',
      providerRecordId: code,
      providerDataType: 'product',
      sourceName: 'Open Food Facts',
      sourceUrl:
        readString(record.url) ??
        `https://world.openfoodfacts.org/product/${code}`,
      barcode: code,
      sourceUpdatedAt,
      ingestedAt: now.toISOString(),
    },
    name,
    brandName,
    foodCategory: readString(record.categories),
    descriptionQualifiers: [],
    rawCookedStatus: rawCooked.rawCookedStatus,
    rawCookedBasis: rawCooked.rawCookedBasis,
    serving,
    macrosPerServing,
    macrosPer100Grams,
    macroBasis:
      macrosPerServing && macrosPer100Grams
        ? 'both'
        : macrosPerServing
          ? 'per_serving'
          : 'per_100g',
    sourcePrecision: {},
    normalizedSearchName: normalizeFoodText(name),
    normalizedBrand: brandName ? normalizeFoodText(brandName) : null,
    providerPriority: 50,
    relevanceScore: 0,
    duplicateGroupId: stableProviderId('open_food_facts', code),
    alternateResultIds: [],
    groupingReasons: [],
    normalizerVersion: FOOD_NORMALIZER_VERSION,
  }
}

async function fetchWithTimeout(
  fetcher: Fetcher,
  url: URL,
  init: RequestInit,
  outerSignal?: AbortSignal,
) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 6000)
  const abort = () => controller.abort()
  outerSignal?.addEventListener('abort', abort, { once: true })
  try {
    const response = await fetcher(url, { ...init, signal: controller.signal })
    if (response.status === 429) {
      throw new ProviderError(
        'provider_rate_limited',
        'Food provider rate limited the request.',
        429,
      )
    }
    if (response.status === 401 || response.status === 403) {
      throw new ProviderError(
        'invalid_api_key',
        'USDA API key is invalid.',
        401,
      )
    }
    if (response.status === 503 || response.status >= 500) {
      throw new ProviderError(
        'provider_unavailable',
        'Food provider is unavailable.',
        503,
      )
    }
    if (!response.ok) {
      throw new ProviderError(
        'provider_unavailable',
        'Food provider request failed.',
        503,
      )
    }
    return response
  } finally {
    clearTimeout(timeoutId)
    outerSignal?.removeEventListener('abort', abort)
  }
}

async function readProviderJson(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new ProviderError(
      'provider_unavailable',
      'Food provider returned a non-JSON response.',
      503,
    )
  }
  try {
    return await response.json()
  } catch {
    throw new ProviderError(
      'provider_unavailable',
      'Food provider returned malformed JSON.',
      503,
    )
  }
}

function extractUsdaMacros(nutrients: unknown[]) {
  const byId = new Map<number, unknown>()
  const byName = new Map<string, unknown>()
  for (const item of nutrients) {
    if (!isRecord(item)) {
      continue
    }
    const id =
      readNumber(item.nutrientId) ??
      (isRecord(item.nutrient) ? readNumber(item.nutrient.id) : null)
    const name =
      readString(item.nutrientName) ??
      (isRecord(item.nutrient) ? readString(item.nutrient.name) : null)
    const value = item.value ?? item.amount
    if (id !== null) {
      byId.set(id, value)
    }
    if (name) {
      byName.set(normalizeFoodText(name), value)
    }
  }
  return {
    calories: firstNumber(byId.get(1008), byId.get(2047), byName.get('energy')),
    protein: firstNumber(byId.get(1003), byName.get('protein')),
    carbohydrate: firstNumber(
      byId.get(1005),
      byName.get('carbohydrate by difference'),
      byName.get('carbohydrate total'),
    ),
    fat: firstNumber(
      byId.get(1004),
      byName.get('total lipid fat'),
      byName.get('total fat'),
    ),
  }
}

function extractUsdaPortions(
  record: Record<string, unknown>,
): NormalizedFoodPortion[] {
  const portions = Array.isArray(record.foodPortions) ? record.foodPortions : []
  return portions
    .map((portion) => {
      if (!isRecord(portion)) {
        return null
      }
      const gramWeight = readNumber(portion.gramWeight)
      const amount = readNumber(portion.amount) ?? 1
      const modifier = readString(portion.modifier)
      const measureUnit = isRecord(portion.measureUnit)
        ? readString(portion.measureUnit.name)
        : null
      return {
        amount,
        unit: measureUnit ?? modifier ?? 'serving',
        description: modifier ?? measureUnit ?? '',
        gramWeight,
      }
    })
    .filter((portion): portion is NormalizedFoodPortion => portion !== null)
}

function gramsFromUsdaServingSize(record: Record<string, unknown>) {
  const servingSize = readNumber(record.servingSize)
  const unit = readString(record.servingSizeUnit)?.toLocaleLowerCase()
  if (!servingSize || servingSize <= 0) {
    return null
  }
  if (unit === 'g' || unit === 'gram' || unit === 'grams') {
    return servingSize
  }
  if (unit === 'oz' || unit === 'ounce' || unit === 'ounces') {
    return servingSize * 28.349523125
  }
  return null
}

function classifyUsdaRawCooked(
  record: Record<string, unknown>,
  fallback: string,
) {
  return classifyRawCooked([
    fallback,
    readString(record.additionalDescriptions) ?? '',
    readString(record.ingredients) ?? '',
    readString(record.foodCategory) ?? '',
    readString(record.brandedFoodCategory) ?? '',
  ])
}

function toMacros(values: Record<string, number | null>): NormalizedFoodMacros {
  return {
    calories: values.calories ?? 0,
    proteinGrams: values.protein ?? 0,
    carbohydrateGrams: values.carbohydrate ?? 0,
    fatGrams: values.fat ?? 0,
  }
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const numeric = readNumber(value)
    if (numeric !== null) {
      return numeric
    }
  }
  return null
}

function kilojoulesToKilocalories(value: unknown) {
  const numeric = readNumber(value)
  return numeric === null ? null : numeric / 4.184
}

function readNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readStringOrNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return readString(value)
}

function readIsoDate(value: unknown) {
  const text = readString(value)
  if (!text) {
    return null
  }
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function unixToIso(value: number | null) {
  if (!value) {
    return null
  }
  return new Date(value * 1000).toISOString()
}

function normalizeBrand(value: string | null) {
  return value?.split(',')[0]?.trim() || null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
