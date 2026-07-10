import { z } from 'zod'

import {
  geminiMealAnalysisSchema,
  type GeminiMealAnalysis,
} from '@domain/geminiMealAnalysis'
import type { IntegrationConnectionStatus } from '@shared-types/app'

export const GEMINI_MEAL_MODEL = 'gemini-3.5-flash'
export const MAX_MEAL_PHOTOS = 3
export const MAX_MEAL_NOTE_LENGTH = 500

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
  readonly httpStatus?: number

  constructor(
    code: GeminiMealAnalysisErrorCode,
    message: string,
    options: { httpStatus?: number } = {},
  ) {
    super(message)
    this.name = 'GeminiMealAnalysisError'
    this.code = code
    this.httpStatus = options.httpStatus
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

const generateContentResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({
            parts: z.array(
              z.object({
                text: z.string().optional(),
              }),
            ),
          })
          .optional(),
      }),
    )
    .optional(),
})

type GeminiInteractionContent =
  | { type: 'text'; text: string }
  | {
      type: 'image'
      data: string
      mime_type: GeminiImageInput['mimeType']
    }

type GeminiInteractionRequest = {
  model: typeof GEMINI_MEAL_MODEL
  input: string | GeminiInteractionContent[]
  response_format?: {
    type: 'text'
    mime_type: 'application/json'
    schema: typeof mealAnalysisJsonSchema
  }
  generation_config?: {
    temperature?: number
    thinking_level?: 'minimal' | 'low' | 'medium' | 'high'
    max_output_tokens?: number
  }
  store: false
}

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
Estimate the photographed meal as a recipe draft for manual user review.
All photos show the same single meal, possibly from different angles; use every
photo together to judge portion size and produce one combined estimate.
Identify each visually distinguishable food component and estimate the consumed
amount, calories, protein, total carbohydrates, and fat for that component.
Include likely sauces or cooking fats only when visually plausible and state
important uncertainty in assumptions. Do not provide dietary advice, targets,
or recommendations. If no food is visible, return an empty ingredients array.
Values are estimates and must fit the response schema.
`.trim()

const userNotePreamble =
  'The user added these details about the meal. Trust them over visual ' +
  'guesses when they conflict, but only for describing the food:'

export async function analyzeMealPhoto(input: {
  apiKey: string
  images: GeminiImageInput[]
  note?: string
  fetchImpl?: typeof fetch
}): Promise<GeminiMealAnalysis> {
  const images = input.images.slice(0, MAX_MEAL_PHOTOS)
  if (images.length === 0) {
    throw new GeminiMealAnalysisError(
      'invalid_response',
      'At least one meal photo is required.',
    )
  }
  const note = input.note?.trim().slice(0, MAX_MEAL_NOTE_LENGTH)
  const interactionInput: GeminiInteractionContent[] = [
    { type: 'text', text: mealAnalysisPrompt },
    ...(note
      ? [{ type: 'text' as const, text: `${userNotePreamble}\n${note}` }]
      : []),
    ...images.map(
      (image): GeminiInteractionContent => ({
        type: 'image',
        data: image.base64,
        mime_type: image.mimeType,
      }),
    ),
  ]

  const response = await requestGemini(
    input.apiKey,
    {
      model: GEMINI_MEAL_MODEL,
      input: interactionInput,
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

  try {
    return parseMealAnalysisResponse(response)
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
  const response = await requestGemini(
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
  extractOutputText(response)
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
  body: GeminiInteractionRequest,
  fetchImpl: typeof fetch = fetch,
) {
  try {
    return await requestGeminiInteraction(apiKey, body, fetchImpl)
  } catch (error) {
    if (!shouldFallbackToGenerateContent(error)) {
      throw error
    }
    return requestGeminiGenerateContent(apiKey, body, fetchImpl)
  }
}

async function requestGeminiInteraction(
  apiKey: string,
  body: GeminiInteractionRequest,
  fetchImpl: typeof fetch,
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
    return await response.json()
  } catch {
    throw new GeminiMealAnalysisError(
      'invalid_response',
      'Gemini returned an unreadable response.',
    )
  }
}

async function requestGeminiGenerateContent(
  apiKey: string,
  body: GeminiInteractionRequest,
  fetchImpl: typeof fetch,
) {
  const trimmedKey = apiKey.trim()
  const fallbackBody = toGenerateContentRequest(body)
  let response: Response
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), 45_000)
  try {
    response = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${body.model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': trimmedKey,
        },
        body: JSON.stringify(fallbackBody),
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
    return await response.json()
  } catch {
    throw new GeminiMealAnalysisError(
      'invalid_response',
      'Gemini returned an unreadable response.',
    )
  }
}

function shouldFallbackToGenerateContent(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'service_unavailable' &&
    'httpStatus' in error &&
    (error.httpStatus === 404 || error.httpStatus === 410)
  )
}

function toGenerateContentRequest(body: GeminiInteractionRequest) {
  const parts = Array.isArray(body.input)
    ? body.input.map((part) =>
        part.type === 'text'
          ? { text: part.text }
          : {
              inline_data: {
                data: part.data,
                mime_type: part.mime_type,
              },
            },
      )
    : [{ text: body.input }]

  const generationConfig: Record<string, unknown> = {}
  if (body.generation_config?.temperature !== undefined) {
    generationConfig.temperature = body.generation_config.temperature
  }
  if (body.generation_config?.max_output_tokens !== undefined) {
    generationConfig.maxOutputTokens = body.generation_config.max_output_tokens
  }
  if (body.generation_config?.thinking_level !== undefined) {
    generationConfig.thinkingConfig = {
      thinkingLevel: body.generation_config.thinking_level,
    }
  }
  if (body.response_format) {
    generationConfig.responseFormat = {
      text: {
        mimeType: body.response_format.mime_type,
        schema: body.response_format.schema,
      },
    }
  }

  return {
    contents: [{ role: 'user', parts }],
    generationConfig,
  }
}

function parseMealAnalysisResponse(response: unknown) {
  if (hasEmptyIngredientList(response)) {
    throw new GeminiMealAnalysisError('no_food_detected', 'AI failed')
  }

  const directResult = geminiMealAnalysisSchema.safeParse(response)
  if (directResult.success) {
    return directResult.data
  }

  const outputText = extractOutputText(response)
  const parsed: unknown = JSON.parse(outputText)
  if (hasEmptyIngredientList(parsed)) {
    throw new GeminiMealAnalysisError('no_food_detected', 'AI failed')
  }
  return geminiMealAnalysisSchema.parse(parsed)
}

function extractOutputText(response: unknown) {
  if (
    typeof response === 'object' &&
    response !== null &&
    'output_text' in response &&
    typeof response.output_text === 'string' &&
    response.output_text
  ) {
    return response.output_text
  }

  const interaction = interactionResponseSchema.safeParse(response)
  if (interaction.success) {
    for (const step of interaction.data.steps) {
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
  }

  const generated = generateContentResponseSchema.safeParse(response)
  if (generated.success) {
    const text = generated.data.candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      .find((part) => part.text)?.text
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
      { httpStatus: response.status },
    )
  }
  if (response.status === 429) {
    return new GeminiMealAnalysisError(
      'rate_limited',
      'The Gemini free-tier limit was reached. Try again later.',
      { httpStatus: response.status },
    )
  }
  return new GeminiMealAnalysisError(
    'service_unavailable',
    'Gemini is unavailable right now. Try again later.',
    { httpStatus: response.status },
  )
}
