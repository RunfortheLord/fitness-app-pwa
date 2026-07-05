import { describe, expect, it } from 'vitest'

import {
  analyzeMealPhoto,
  GEMINI_MEAL_MODEL,
  GeminiMealAnalysisError,
  testGeminiApiKey,
} from '@services/geminiMealAnalysisClient'

describe('geminiMealAnalysisClient', () => {
  it('sends an inline image without storing the interaction and validates the result', async () => {
    let requestBody: Record<string, unknown> | null = null
    let requestHeaders = new Headers()
    const fetchImpl: typeof fetch = async (_input, init) => {
      requestBody = JSON.parse(String(init?.body))
      requestHeaders = new Headers(init?.headers)
      return jsonResponse({
        status: 'completed',
        steps: [
          {
            type: 'model_output',
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  recipeName: 'Eggs and toast',
                  confidence: 'high',
                  assumptions: ['Two eggs'],
                  ingredients: [
                    {
                      name: 'Eggs',
                      servingQuantity: 2,
                      servingUnit: 'piece',
                      calories: 140,
                      proteinGrams: 12,
                      carbohydrateGrams: 1,
                      fatGrams: 10,
                    },
                  ],
                }),
              },
            ],
          },
        ],
      })
    }

    await expect(
      analyzeMealPhoto({
        apiKey: 'local-test-key',
        images: [{ base64: 'image-bytes', mimeType: 'image/jpeg' }],
        fetchImpl,
      }),
    ).resolves.toMatchObject({
      recipeName: 'Eggs and toast',
      ingredients: [{ name: 'Eggs', calories: 140 }],
    })

    expect(requestHeaders.get('x-goog-api-key')).toBe('local-test-key')
    expect(JSON.stringify(requestBody)).not.toContain('local-test-key')
    expect(requestBody).toMatchObject({
      model: GEMINI_MEAL_MODEL,
      store: false,
      input: [
        expect.objectContaining({ type: 'text' }),
        {
          type: 'image',
          data: 'image-bytes',
          mime_type: 'image/jpeg',
        },
      ],
    })
  })

  it('sends every photo plus the trimmed user note as extra context', async () => {
    let requestBody: { input?: unknown[] } | null = null
    const fetchImpl: typeof fetch = async (_input, init) => {
      requestBody = JSON.parse(String(init?.body)) as { input?: unknown[] }
      return jsonResponse({
        status: 'completed',
        steps: [
          {
            type: 'model_output',
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  recipeName: 'Steak plate',
                  confidence: 'medium',
                  assumptions: [],
                  ingredients: [
                    {
                      name: 'Ribeye',
                      servingQuantity: 8,
                      servingUnit: 'oz',
                      calories: 616,
                      proteinGrams: 54,
                      carbohydrateGrams: 0,
                      fatGrams: 43,
                    },
                  ],
                }),
              },
            ],
          },
        ],
      })
    }

    await analyzeMealPhoto({
      apiKey: 'test-key',
      images: [
        { base64: 'angle-one', mimeType: 'image/jpeg' },
        { base64: 'angle-two', mimeType: 'image/jpeg' },
      ],
      note: '  8 oz ribeye, cooked in butter  ',
      fetchImpl,
    })

    const input = requestBody!.input!
    expect(input).toHaveLength(4)
    expect(input[1]).toMatchObject({ type: 'text' })
    expect(JSON.stringify(input[1])).toContain('8 oz ribeye, cooked in butter')
    expect(input[2]).toMatchObject({ type: 'image', data: 'angle-one' })
    expect(input[3]).toMatchObject({ type: 'image', data: 'angle-two' })
  })

  it('maps free-tier rate limits to an actionable error', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response('quota exceeded', { status: 429 })

    await expect(
      analyzeMealPhoto({
        apiKey: 'test-key',
        images: [{ base64: 'image-bytes', mimeType: 'image/jpeg' }],
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      code: 'rate_limited',
    } satisfies Partial<GeminiMealAnalysisError>)
  })

  it('identifies an empty ingredient result as no food detected', async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse({
        status: 'completed',
        steps: [
          {
            type: 'model_output',
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  recipeName: 'No meal found',
                  confidence: 'low',
                  assumptions: [],
                  ingredients: [],
                }),
              },
            ],
          },
        ],
      })

    await expect(
      analyzeMealPhoto({
        apiKey: 'test-key',
        images: [{ base64: 'image-bytes', mimeType: 'image/jpeg' }],
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      code: 'no_food_detected',
      message: 'AI failed',
    } satisfies Partial<GeminiMealAnalysisError>)
  })

  it('tests a saved key with the configured Flash model', async () => {
    let requestBody: Record<string, unknown> | null = null
    const fetchImpl: typeof fetch = async (_input, init) => {
      requestBody = JSON.parse(String(init?.body))
      return jsonResponse({
        status: 'completed',
        steps: [
          {
            type: 'model_output',
            content: [{ type: 'text', text: 'OK' }],
          },
        ],
      })
    }

    await expect(
      testGeminiApiKey({ apiKey: 'test-key', fetchImpl }),
    ).resolves.toBeUndefined()
    expect(requestBody).toMatchObject({
      model: GEMINI_MEAL_MODEL,
      store: false,
    })
  })
})

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
