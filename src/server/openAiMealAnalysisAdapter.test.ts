import { describe, expect, it, vi } from 'vitest'

import {
  createOpenAiMealAnalysisProvider,
  DEFAULT_OPENAI_MEAL_MODEL,
  MealAnalysisProviderError,
} from './openAiMealAnalysisAdapter'

const providerInput = {
  images: [{ base64: 'cGhvdG8=', mimeType: 'image/jpeg' as const }],
  note: '8 oz chicken',
}

describe('OpenAI meal analysis adapter', () => {
  it('uses Responses structured output without storing the response or key', async () => {
    let body: Record<string, unknown> | null = null
    let headers = new Headers()
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>
      headers = new Headers(init?.headers)
      return jsonResponse({
        output_text: JSON.stringify({
          assumptions: [],
          confidence: 'high',
          ingredients: [
            {
              calories: 375,
              carbohydrateGrams: 0,
              fatGrams: 8,
              name: 'Chicken breast',
              proteinGrams: 70,
              servingQuantity: 8,
              servingUnit: 'oz',
            },
          ],
          recipeName: 'Chicken plate',
        }),
      })
    })
    const provider = createOpenAiMealAnalysisProvider({
      apiKey: 'server-secret-key',
      fetchImpl,
    })

    await expect(provider.analyze(providerInput)).resolves.toMatchObject({
      ingredients: [{ name: 'Chicken breast' }],
      recipeName: 'Chicken plate',
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(headers.get('authorization')).toBe('Bearer server-secret-key')
    expect(body).toMatchObject({
      model: DEFAULT_OPENAI_MEAL_MODEL,
      store: false,
      text: { format: { strict: true, type: 'json_schema' } },
    })
    expect(JSON.stringify(body)).not.toContain('server-secret-key')
    expect(JSON.stringify(body)).toContain('data:image/jpeg;base64,cGhvdG8=')
  })

  it('maps an empty ingredient result to no_food_detected', async () => {
    const provider = createOpenAiMealAnalysisProvider({
      apiKey: 'server-key',
      fetchImpl: async () =>
        jsonResponse({
          output_text: JSON.stringify({
            assumptions: [],
            confidence: 'low',
            ingredients: [],
            recipeName: 'Unknown meal',
          }),
        }),
    })

    await expect(provider.analyze(providerInput)).rejects.toMatchObject({
      code: 'no_food_detected',
    } satisfies Partial<MealAnalysisProviderError>)
  })

  it('maps upstream rate limits without reflecting response details', async () => {
    const provider = createOpenAiMealAnalysisProvider({
      apiKey: 'server-key',
      fetchImpl: async () =>
        new Response('sensitive upstream response', { status: 429 }),
    })

    await expect(provider.analyze(providerInput)).rejects.toMatchObject({
      code: 'provider_rate_limited',
      upstreamStatus: 429,
    } satisfies Partial<MealAnalysisProviderError>)
  })
})

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
    status: 200,
  })
}
