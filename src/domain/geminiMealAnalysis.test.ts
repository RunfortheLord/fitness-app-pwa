import { describe, expect, it } from 'vitest'

import {
  createRecipeDraftFromGemini,
  geminiMealAnalysisSchema,
} from '@domain/geminiMealAnalysis'

describe('gemini meal analysis', () => {
  it('validates an estimate and converts it to unsaved snapshot components', () => {
    const analysis = geminiMealAnalysisSchema.parse({
      recipeName: 'Chicken rice bowl',
      confidence: 'medium',
      assumptions: ['Chicken appears grilled', 'One tablespoon of sauce'],
      ingredients: [
        {
          name: 'Grilled chicken',
          servingQuantity: 5.5,
          servingUnit: 'oz',
          calories: 260,
          proteinGrams: 48,
          carbohydrateGrams: 0,
          fatGrams: 6,
        },
        {
          name: 'Cooked rice',
          servingQuantity: 1,
          servingUnit: 'cup',
          calories: 205,
          proteinGrams: 4,
          carbohydrateGrams: 45,
          fatGrams: 0.4,
        },
      ],
    })

    expect(createRecipeDraftFromGemini(analysis)).toMatchObject({
      name: 'Chicken rice bowl',
      notes: expect.stringContaining('medium confidence'),
      components: [
        {
          foodId: null,
          servingMultiplier: 1,
          foodSnapshot: {
            foodName: 'Grilled chicken',
            servingDescription: '5.5 oz',
            caloriesPerServing: 260,
          },
        },
        {
          foodId: null,
          servingMultiplier: 1,
          foodSnapshot: {
            foodName: 'Cooked rice',
            servingDescription: '1 cup',
            caloriesPerServing: 205,
          },
        },
      ],
    })
  })

  it('rejects negative nutrition and empty ingredient lists', () => {
    expect(() =>
      geminiMealAnalysisSchema.parse({
        recipeName: 'Unknown meal',
        confidence: 'low',
        assumptions: [],
        ingredients: [],
      }),
    ).toThrow()

    expect(() =>
      geminiMealAnalysisSchema.parse({
        recipeName: 'Unknown meal',
        confidence: 'low',
        assumptions: [],
        ingredients: [
          {
            name: 'Food',
            servingQuantity: 1,
            servingUnit: 'serving',
            calories: -1,
            proteinGrams: 0,
            carbohydrateGrams: 0,
            fatGrams: 0,
          },
        ],
      }),
    ).toThrow()
  })
})
