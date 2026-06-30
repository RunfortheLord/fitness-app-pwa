import { z } from 'zod'

import {
  geminiMealAnalysisSchema,
  type GeminiMealAnalysis,
} from '@domain/geminiMealAnalysis'
import type { IntegrationConnectionStatus } from '@shared-types/app'

export const GEMINI_MEAL_MODEL = 'gemini-3.5-flash'

export type GeminiImageInput = {
  base64: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
}

export type GeminiMealAnalysisErrorCode =
  | Exclude<
      IntegrationConnectionStatus,
      'not_configured' | 'testing' | 'connected'
    >
  | 'invalid_response'
  | 'no_food_detected'

export class GeminiMealAnalysisError extends Error {
  readonly code: GeminiMealAnalysisErrorCode

  constructor(code: GeminiMealAnalysisErrorCode, message: string) {
    super(message)
    this.name = 'GeminiMealAnalysisError'
    this.code = code
  }
}

const interactionResponseSchema = z.object({
  status: z.string().optional(),
  steps: z.array(
    z.object({
      type: z.string(),
      content: z
        .array(
          z.object({
            type: z.string(),
            text: z.string().optional(),
          }),
        )
        .optional(),
    }),
  ),
})

const mealAnalysisJsonSchema = {
  type: 'object',
  properties: {
    recipeName: {
      type: 'string',
      description: 'A short descriptive recipe name for the photographed meal.',
    },
    confidence: {
      type: 'string',
      enum: ['low', 'medium', 'high'],
      description: 'Confidence in the overall visual estimate.',
    },
    assumptions: {
      type: 'array',
      maxItems: 8,
      items: { type: 'string' },
      description:
        'Important assumptions about portions, hidden ingredients, sauces, or cooking fats.',
    },
    ingredients: {
      type: 'array',
      minItems: 0,
      maxItems: 20,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          servingQuantity: { type: 'number', minimum: 0.01 },
          servingUnit: {
            type: 'string',
            description:
              'A practical unit such as g, oz, cup, tbsp, piece, or serving.',
          },
          calories: { type: 'number', minimum: 0 },
          proteinGrams: { type: 'number', minimum: 0 },
          carbohydrateGrams: { type: 'number', minimum: 0 },
          fatGrams: { type: 'number', minimum: 0 },
        },
        required: [
          'name',
          'servingQuantity',
          'servingUnit',
          'calories',
          'proteinGrams',
          'carbohydrateGrams',
          'fatGrams',
        ],
      },
    },
  },
  required: ['recipeName', 'confidence', 'assumptions', 'ingredients'],
} as const

const mealAnalysisPrompt = `
Estimate the visible meal as a recipe draft for manual user review.
Identify each visually distinguishable food component and estimate the consumed
amount, calories, protein, total carbohydrates, and fat for that component.
Include likely sauces or cooking fats only when visually plausible and state
important uncertainty in assumptions. Do not provide dietary advice, targets,
or recommendations. If no food is visible, return an empty ingredients array.
Values are estimates and must fit the response schema.
`.trim()

export async function analyzeMealPhoto(input: {
  apiKey: string
  image: GeminiImageInput
  fetchImpl?: typeof fetch
}): Promise<GeminiMealAnalysis> {
  const response = await requestGemini(
    input.apiKey,
    {
      model: GEMINI_MEAL_MODEL,
      input: [
        { type: 'text', text: mealAnalysisPrompt },
        {
          type: 'image',
          data: input.image.base64,
          mime_type: input.image.mimeType,
        },
      ],
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: mealAnalysisJsonSchema,
      },
      generation_config: {
        temperature: 0.2,
        thinking_level: 'low',
        max_output_tokens: 1_800,
      },
      store: false,
    },
    input.fetchImpl,
  )

  const outputText = extractOutputText(response)
  try {
    const parsed: unknown = JSON.parse(outputText)
    if (hasEmptyIngredientList(parsed)) {
      throw new GeminiMealAnalysisError('no_food_detected', 'AI failed')
    }
    return geminiMealAnalysisSchema.parse(parsed)
  } catch (error) {
    if (error instanceof GeminiMealAnalysisError) {
      throw error
    }
    throw new GeminiMealAnalysisError(
      'invalid_response',
      'Gemini returned meal data that the app could not validate.',
    )
  }
}

function hasEmptyIngredientList(value: unknown) {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ingredients' in value &&
    Array.isArray(value.ingredients) &&
    value.ingredients.length === 0
  )
}

export async function testGeminiApiKey(input: {
  apiKey: string
  fetchImpl?: typeof fetch
}): Promise<void> {
  await requestGemini(
    input.apiKey,
    {
      model: GEMINI_MEAL_MODEL,
      input: 'Reply with OK.',
      generation_config: {
        thinking_level: 'minimal',
        max_output_tokens: 8,
      },
      store: false,
    },
    input.fetchImpl,
  )
}

export function geminiConnectionStatusForError(
  error: unknown,
): IntegrationConnectionStatus {
  if (!(error instanceof GeminiMealAnalysisError)) {
    return 'service_unavailable'
  }
  return error.code === 'invalid_response' || error.code === 'no_food_detected'
    ? 'service_unavailable'
    : error.code
}

async function requestGemini(
  apiKey: string,
  body: object,
  fetchImpl: typeof fetch = fetch,
) {
  const trimmedKey = apiKey.trim()
  if (!trimmedKey) {
    throw new GeminiMealAnalysisError(
      'invalid_key',
      'A Gemini API key is required.',
    )
  }

  let response: Response
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), 45_000)
  try {
    response = await fetchImpl(
      'https://generativelanguage.googleapis.com/v1beta/interactions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': trimmedKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      },
    )
  } catch {
    throw new GeminiMealAnalysisError(
      'network_unavailable',
      'Gemini could not be reached. Check your connection and try again.',
    )
  } finally {
    globalThis.clearTimeout(timeoutId)
  }

  if (!response.ok) {
    throw await errorForResponse(response)
  }

  try {
    return interactionResponseSchema.parse(await response.json())
  } catch {
    throw new GeminiMealAnalysisError(
      'invalid_response',
      'Gemini returned an unreadable response.',
    )
  }
}

function extractOutputText(
  response: z.infer<typeof interactionResponseSchema>,
) {
  for (const step of response.steps) {
    if (step.type !== 'model_output') {
      continue
    }
    const text = step.content?.find(
      (content) => content.type === 'text' && content.text,
    )?.text
    if (text) {
      return text
    }
  }
  throw new GeminiMealAnalysisError(
    'invalid_response',
    'Gemini did not return a meal estimate.',
  )
}

async function errorForResponse(response: Response) {
  const responseText = await response.text().catch(() => '')
  if (
    response.status === 401 ||
    response.status === 403 ||
    (response.status === 400 &&
      /api.?key|permission_denied/iu.test(responseText))
  ) {
    return new GeminiMealAnalysisError(
      'invalid_key',
      'Google rejected this Gemini API key.',
    )
  }
  if (response.status === 429) {
    return new GeminiMealAnalysisError(
      'rate_limited',
      'The Gemini free-tier limit was reached. Try again later.',
    )
  }
  return new GeminiMealAnalysisError(
    'service_unavailable',
    'Gemini is unavailable right now. Try again later.',
  )
}
