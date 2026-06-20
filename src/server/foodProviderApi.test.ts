import { describe, expect, it, vi } from 'vitest'

import { handleFoodSearch, validateSearchRequest } from './foodProviderApi'
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
})

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}
