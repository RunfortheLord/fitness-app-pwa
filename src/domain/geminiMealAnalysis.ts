import { z } from 'zod'

import type { SavedMealComponent } from '@shared-types/app'

const estimatedIngredientSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    servingQuantity: z.number().finite().positive().max(10_000),
    servingUnit: z.string().trim().min(1).max(32),
    calories: z.number().finite().nonnegative().max(20_000),
    proteinGrams: z.number().finite().nonnegative().max(2_000),
    carbohydrateGrams: z.number().finite().nonnegative().max(2_000),
    fatGrams: z.number().finite().nonnegative().max(2_000),
  })
  .strict()

export const geminiMealAnalysisSchema = z
  .object({
    recipeName: z.string().trim().min(1).max(120),
    confidence: z.enum(['low', 'medium', 'high']),
    assumptions: z.array(z.string().trim().min(1).max(240)).max(8),
    ingredients: z.array(estimatedIngredientSchema).min(1).max(20),
  })
  .strict()

export type GeminiMealAnalysis = z.infer<typeof geminiMealAnalysisSchema>

export type GeneratedRecipeDraft = {
  name: string
  notes: string
  components: SavedMealComponent[]
}

export function createRecipeDraftFromGemini(
  analysis: GeminiMealAnalysis,
): GeneratedRecipeDraft {
  const assumptions = analysis.assumptions.length
    ? ` Assumptions: ${analysis.assumptions.join('; ')}`
    : ''

  return {
    name: analysis.recipeName,
    notes: `Gemini 3.5 Flash meal-photo estimate (${analysis.confidence} confidence).${assumptions}`,
    components: analysis.ingredients.map((ingredient) => ({
      foodId: null,
      servingMultiplier: 1,
      foodSnapshot: {
        foodName: ingredient.name,
        brandName: null,
        servingQuantity: ingredient.servingQuantity,
        servingUnit: ingredient.servingUnit,
        servingDescription: `${formatQuantity(ingredient.servingQuantity)} ${ingredient.servingUnit}`,
        caloriesPerServing: ingredient.calories,
        proteinGramsPerServing: ingredient.proteinGrams,
        carbohydrateGramsPerServing: ingredient.carbohydrateGrams,
        fatGramsPerServing: ingredient.fatGrams,
        macroBasis: 'per_serving',
        rawCookedStatus: 'unknown',
        notes: 'Estimated from a meal photo with Gemini 3.5 Flash.',
      },
    })),
  }
}

function formatQuantity(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : String(Number(value.toFixed(2)))
}
