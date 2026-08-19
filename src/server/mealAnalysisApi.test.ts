import { describe, expect, it, vi } from 'vitest'

import { MAX_MEAL_IMAGE_BASE64_LENGTH } from '../domain/mealAnalysisLimits'
import {
  handleMealAnalysis,
  statusForMealAnalysisError,
  validateMealAnalysisRequest,
} from './mealAnalysisApi'
import { createMemoryServerRateLimiter } from './serverRateLimiter'

const validRequest = {
  images: [{ base64: 'cGhvdG8=', mimeType: 'image/jpeg' }],
  note: '  rice cooked in butter  ',
}

const analysis = {
  assumptions: ['Portion estimated visually'],
  confidence: 'medium' as const,
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

describe('meal analysis API', () => {
  it('bounds images, MIME types, total size, and note text', () => {
    expect(validateMealAnalysisRequest(validRequest)).toMatchObject({
      ok: true,
      data: { note: 'rice cooked in butter' },
    })
    expect(
      validateMealAnalysisRequest({
        images: [{ base64: 'cGhvdG8=', mimeType: 'image/gif' }],
      }),
    ).toMatchObject({
      ok: false,
      result: { error: { code: 'invalid_request' } },
    })
    expect(
      validateMealAnalysisRequest({
        images: [
          {
            base64: 'a'.repeat(MAX_MEAL_IMAGE_BASE64_LENGTH + 4),
            mimeType: 'image/jpeg',
          },
        ],
      }),
    ).toMatchObject({
      ok: false,
      result: { error: { code: 'payload_too_large' } },
    })
    expect(
      validateMealAnalysisRequest({
        images: validRequest.images,
        note: 'x'.repeat(501),
      }),
    ).toMatchObject({
      ok: false,
      result: { error: { code: 'invalid_request' } },
    })
  })

  it('passes validated data to the provider and returns its structured result', async () => {
    const analyze = vi.fn(async () => analysis)
    await expect(
      handleMealAnalysis(validRequest, {
        apiKey: 'server-key',
        clientKey: 'client-a',
        limiter: createMemoryServerRateLimiter(),
        provider: { analyze },
      }),
    ).resolves.toEqual({ ok: true, data: analysis })
    expect(analyze).toHaveBeenCalledWith(
      {
        images: validRequest.images,
        note: 'rice cooked in butter',
      },
      expect.any(AbortSignal),
    )
  })

  it('fails closed without a limiter and enforces typed per-client limits', async () => {
    const provider = { analyze: vi.fn(async () => analysis) }
    await expect(
      handleMealAnalysis(validRequest, {
        apiKey: 'server-key',
        clientKey: 'client-a',
        limiter: undefined,
        provider,
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'provider_unavailable', retryAfterSeconds: 60 },
    })
    expect(provider.analyze).not.toHaveBeenCalled()

    const limiter = createMemoryServerRateLimiter()
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await expect(
        handleMealAnalysis(validRequest, {
          apiKey: 'server-key',
          clientKey: 'client-b',
          limiter,
          provider,
        }),
      ).resolves.toMatchObject({ ok: true })
    }
    const limited = await handleMealAnalysis(validRequest, {
      apiKey: 'server-key',
      clientKey: 'client-b',
      limiter,
      provider,
    })
    expect(limited).toMatchObject({
      ok: false,
      error: { code: 'rate_limited', retryAfterSeconds: 600 },
    })
    expect(statusForMealAnalysisError('rate_limited')).toBe(429)
  })

  it('reports missing server configuration without exposing key details', async () => {
    const result = await handleMealAnalysis(validRequest, {
      apiKey: undefined,
      clientKey: 'client-a',
      limiter: createMemoryServerRateLimiter(),
    })
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'not_configured',
        message: 'Meal analysis is not configured yet.',
      },
    })
    expect(JSON.stringify(result)).not.toContain('OPENAI_API_KEY')
  })
})
