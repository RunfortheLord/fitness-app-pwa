import { describe, expect, it, vi } from 'vitest'

import {
  handleFoodBarcodeLookup,
  handleFoodSearch,
  validateSearchRequest,
} from './foodProviderApi'
import { TtlCache } from './foodProviderCache'

describe('food provider API core', () => {
  it('validates and normalizes search inputs without accepting arbitrary provider URLs', () => {
    expect(
      validateSearchRequest({
        query: '  greek   yogurt ',
        provider: 'usda',
        page: 1,
        pageSize: 20,
      }),
    ).toMatchObject({ query: 'greek yogurt' })

    expect(() =>
      validateSearchRequest({ query: 'a', provider: 'usda' }),
    ).toThrow('at least 3 characters')
    expect(() =>
      validateSearchRequest({
        query: 'rice',
        provider: 'https://example.com' as never,
      }),
    ).toThrow('Unsupported provider')
    expect(() =>
      validateSearchRequest({ query: 'rice', pageSize: 500 }),
    ).toThrow('Invalid page size')
    expect(() =>
      validateSearchRequest({ query: 'rice\u0000', provider: 'usda' }),
    ).toThrow('control characters')
    expect(() =>
      validateSearchRequest({
        query: 'arroz',
        provider: 'open_food_facts',
        language: 'de' as never,
      }),
    ).toThrow('Unsupported search language')
  })

  it('returns a server configuration error when the USDA key is missing', async () => {
    await expect(
      handleFoodSearch({ query: 'rice', provider: 'usda' }, {}),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'missing_api_key' },
    })
  })

  it('uses controlled Open Food Facts fallback only when requested after empty USDA results', async () => {
    const fetcher = vi.fn(async (url: URL | RequestInfo) => {
      const href = String(url)
      if (href.includes('api.nal.usda.gov')) {
        return jsonResponse({ foods: [] })
      }
      return jsonResponse({
        products: [
          {
            code: '123',
            product_name: 'Fallback Product',
            brands: 'Fallback Brand',
            serving_size: '30 g',
            serving_quantity: 30,
            nutriments: {
              'energy-kcal_100g': 100,
              proteins_100g: 5,
              carbohydrates_100g: 10,
              fat_100g: 1,
            },
          },
        ],
      })
    })

    await expect(
      handleFoodSearch(
        { query: 'fallback', provider: 'usda', allowFallback: false },
        { usdaApiKey: 'USDA_FDC_API_KEY_TEST_SENTINEL', fetcher },
      ),
    ).resolves.toMatchObject({
      ok: true,
      data: { provider: 'usda', results: [], fallbackUsed: false },
    })

    await expect(
      handleFoodSearch(
        { query: 'fallback', provider: 'usda', allowFallback: true },
        { usdaApiKey: 'USDA_FDC_API_KEY_TEST_SENTINEL', fetcher },
      ),
    ).resolves.toMatchObject({
      ok: true,
      data: { provider: 'all', fallbackUsed: true },
    })

    const offCalls = fetcher.mock.calls.filter(([url]) =>
      String(url).includes('openfoodfacts'),
    )
    expect(offCalls).toHaveLength(1)
  })

  it('searches Open Food Facts with Spanish fields and returns Spanish names', async () => {
    const fetcher = vi.fn(async (url: URL | RequestInfo) => {
      void url
      return jsonResponse({
        products: [
          {
            code: '8410000000001',
            product_name: 'Tomato Soup',
            product_name_es: 'Sopa de tomate',
            categories: 'Soups',
            categories_es: 'Sopas',
            nutriments: {
              'energy-kcal_100g': 45,
              proteins_100g: 1.2,
              carbohydrates_100g: 7.5,
              fat_100g: 1.1,
            },
          },
        ],
      })
    })

    const response = await handleFoodSearch(
      {
        query: 'sopa de tomate',
        provider: 'open_food_facts',
        language: 'es',
      },
      { fetcher },
    )

    expect(response).toMatchObject({
      ok: true,
      data: {
        provider: 'open_food_facts',
        results: [{ name: 'Sopa de tomate', foodCategory: 'Sopas' }],
      },
    })
    const requestedUrl = new URL(String(fetcher.mock.calls[0]?.[0]))
    expect(requestedUrl.searchParams.get('lc')).toBe('es')
    expect(requestedUrl.searchParams.get('fields')).toContain('product_name_es')
    expect(requestedUrl.searchParams.get('fields')).toContain('categories_es')
  })

  it('retries a misspelled query with a corrected spelling and merges canonical results', async () => {
    const fetcher = vi.fn(
      async (url: URL | RequestInfo, init?: RequestInit) => {
        const href = String(url)
        if (!href.includes('api.nal.usda.gov')) {
          return jsonResponse({ products: [] })
        }
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          query: string
          dataType?: string[]
        }
        const isBranded = Boolean(body.dataType?.includes('Branded'))
        if (body.query === 'chicken' && !isBranded) {
          return jsonResponse({
            foods: [usdaFoodRecord(1, 'Chicken Breast, cooked', 'Foundation')],
          })
        }
        if (body.query === 'chiken' && isBranded) {
          return jsonResponse({
            foods: [usdaFoodRecord(2, 'CHIKEN FINGERS', 'Branded')],
          })
        }
        return jsonResponse({ foods: [] })
      },
    )

    const response = await handleFoodSearch(
      { query: 'chiken', provider: 'usda' },
      { usdaApiKey: 'USDA_FDC_API_KEY_TEST_SENTINEL', fetcher },
    )

    expect(response.ok).toBe(true)
    const names =
      response.ok && isSearchData(response.data)
        ? response.data.results.map((result) => result.name)
        : []
    expect(names).toContain('Chicken Breast, cooked')
    expect(names).toContain('CHIKEN FINGERS')
  })

  it('does not issue a correction retry for a correctly spelled query', async () => {
    const fetcher = vi.fn(async (url: URL | RequestInfo) => {
      const href = String(url)
      if (href.includes('api.nal.usda.gov')) {
        return jsonResponse({ foods: [] })
      }
      return jsonResponse({ products: [] })
    })

    await handleFoodSearch(
      { query: 'chicken', provider: 'usda' },
      { usdaApiKey: 'USDA_FDC_API_KEY_TEST_SENTINEL', fetcher },
    )

    // One search => canonical + branded data-type calls only; no corrected retry.
    const usdaCalls = fetcher.mock.calls.filter(([url]) =>
      String(url).includes('api.nal.usda.gov'),
    )
    expect(usdaCalls).toHaveLength(2)
  })

  it('requests a wider canonical candidate pool for first-page UI searches', async () => {
    const requestBodies: Array<{ dataType?: string[]; pageSize?: number }> = []
    const fetcher = vi.fn(
      async (_url: URL | RequestInfo, init?: RequestInit) => {
        requestBodies.push(
          JSON.parse(String(init?.body ?? '{}')) as {
            dataType?: string[]
            pageSize?: number
          },
        )
        return jsonResponse({ foods: [] })
      },
    )

    await handleFoodSearch(
      { query: 'strawberry', provider: 'usda', page: 1, pageSize: 20 },
      { usdaApiKey: 'USDA_FDC_API_KEY_TEST_SENTINEL', fetcher },
    )

    expect(
      requestBodies.find((body) => !body.dataType?.includes('Branded'))
        ?.pageSize,
    ).toBe(50)
    expect(
      requestBodies.find((body) => body.dataType?.includes('Branded'))
        ?.pageSize,
    ).toBe(20)
  })

  it('coalesces concurrent identical cache misses and evicts by bounded size', async () => {
    let now = 1_000
    const cache = new TtlCache<string>(2, 100, () => now)
    const create = vi.fn(async () => 'value')

    await expect(
      Promise.all([
        cache.getOrCreate('a', create),
        cache.getOrCreate('a', create),
      ]),
    ).resolves.toEqual(['value', 'value'])
    expect(create).toHaveBeenCalledTimes(1)
    expect(cache.get('a')).toBe('value')

    cache.set('b', 'second')
    cache.set('c', 'third')
    expect(cache.get('a')).toBeNull()
    expect(cache.size).toBe(2)

    now = 2_000
    expect(cache.get('b')).toBeNull()
  })

  it('prefers complete USDA barcode records over Open Food Facts conflicts', async () => {
    const fetcher = vi.fn(async (url: URL | RequestInfo) => {
      const href = String(url)
      if (href.includes('api.nal.usda.gov')) {
        return jsonResponse({
          foods: [
            {
              fdcId: 42,
              description: 'USDA Cereal Bar',
              dataType: 'Branded',
              brandOwner: 'USDA Brand',
              gtinUpc: '012345678905',
              servingSize: 40,
              servingSizeUnit: 'g',
              foodNutrients: usdaMacros(),
            },
          ],
        })
      }
      return jsonResponse({
        product: {
          code: '012345678905',
          product_name: 'Open Cereal Bar',
          brands: 'Open Brand',
          serving_size: '35 g',
          serving_quantity: 35,
          nutriments: {
            'energy-kcal_serving': 130,
            proteins_serving: 3,
            carbohydrates_serving: 24,
            fat_serving: 4,
          },
        },
      })
    })

    await expect(
      handleFoodBarcodeLookup(
        { barcode: '012345678905' },
        { usdaApiKey: 'USDA_FDC_API_KEY_TEST_SENTINEL', fetcher },
      ),
    ).resolves.toMatchObject({
      ok: true,
      data: {
        sourcePreference: 'usda',
        result: { name: 'USDA Cereal Bar' },
      },
    })
  })
})

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function isSearchData(
  data: unknown,
): data is { results: Array<{ name: string }> } {
  return (
    typeof data === 'object' &&
    data !== null &&
    Array.isArray((data as { results?: unknown }).results)
  )
}

function usdaFoodRecord(id: number, description: string, dataType: string) {
  return {
    fdcId: id,
    description,
    dataType,
    servingSize: 100,
    servingSizeUnit: 'g',
    foodNutrients: usdaMacros(),
  }
}

function usdaMacros() {
  return [
    { nutrientId: 1008, value: 150 },
    { nutrientId: 1003, value: 4 },
    { nutrientId: 1005, value: 25 },
    { nutrientId: 1004, value: 5 },
  ]
}
