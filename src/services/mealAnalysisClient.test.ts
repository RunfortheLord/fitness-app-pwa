import { describe, expect, it, vi } from 'vitest'

import {
  analyzeMealPhoto,
  MAX_MEAL_IMAGE_BASE64_LENGTH,
  MealAnalysisError,
} from '@services/mealAnalysisClient'

const analysis = {
  assumptions: [],
  confidence: 'medium',
  ingredients: [
    {
      calories: 205,
      carbohydrateGrams: 45,
      fatGrams: 0.4,
      name: 'Rice',
      proteinGrams: 4,
      servingQuantity: 1,
      servingUnit: 'cup',
    },
  ],
  recipeName: 'Rice bowl',
}

describe('meal analysis client', () => {
  it('sends only bounded image fields and a trimmed note to the same-origin route', async () => {
    let body: unknown
    const fetchImpl = vi.fn<typeof fetch>(async (url, init) => {
      expect(url).toBe('/api/meal-analysis')
      body = JSON.parse(String(init?.body)) as unknown
      return jsonResponse({ ok: true, data: analysis })
    })

    await expect(
      analyzeMealPhoto({
        fetchImpl,
        images: [
          {
            base64: 'cGhvdG8=',
            dataUrl: 'data:image/jpeg;base64,cGhvdG8=',
            mimeType: 'image/jpeg',
          } as { base64: string; dataUrl: string; mimeType: 'image/jpeg' },
        ],
        note: '  rice cooked in butter  ',
      }),
    ).resolves.toMatchObject({ recipeName: 'Rice bowl' })

    expect(body).toEqual({
      images: [{ base64: 'cGhvdG8=', mimeType: 'image/jpeg' }],
      note: 'rice cooked in butter',
    })
    expect(JSON.stringify(body)).not.toContain('data:image')
  })

  it('surfaces a typed 429 and Retry-After value', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse(
        {
          error: {
            code: 'rate_limited',
            message: 'Try again later.',
            retryAfterSeconds: 42,
          },
          ok: false,
        },
        429,
        { 'retry-after': '42' },
      ),
    )

    await expect(
      analyzeMealPhoto({
        fetchImpl,
        images: [{ base64: 'cGhvdG8=', mimeType: 'image/jpeg' }],
      }),
    ).rejects.toMatchObject({
      code: 'rate_limited',
      httpStatus: 429,
      retryAfterSeconds: 42,
    } satisfies Partial<MealAnalysisError>)
  })

  it('rejects oversized images before starting a request', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    await expect(
      analyzeMealPhoto({
        fetchImpl,
        images: [
          {
            base64: 'a'.repeat(MAX_MEAL_IMAGE_BASE64_LENGTH + 1),
            mimeType: 'image/jpeg',
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'payload_too_large' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('rejects a successful response that does not match the meal schema', async () => {
    await expect(
      analyzeMealPhoto({
        fetchImpl: async () =>
          jsonResponse({ ok: true, data: { ingredients: [] } }),
        images: [{ base64: 'cGhvdG8=', mimeType: 'image/jpeg' }],
      }),
    ).rejects.toMatchObject({ code: 'invalid_response' })
  })
})

function jsonResponse(
  value: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json', ...headers },
    status,
  })
}
