import { describe, expect, it } from 'vitest'

import {
  normalizeOpenFoodFactsFood,
  normalizeUsdaFood,
} from './foodProviderAdapters'

const now = new Date('2026-06-19T12:00:00.000Z')

describe('food provider adapters', () => {
  it('normalizes USDA Foundation-style per-100-gram records with stable nutrient IDs', () => {
    const food = normalizeUsdaFood(
      {
        fdcId: 123,
        description: 'Chicken breast, cooked, grilled',
        dataType: 'Foundation',
        foodCategory: 'Poultry Products',
        foodNutrients: [
          { nutrientId: 1008, nutrientName: 'Energy', value: 165 },
          { nutrientId: 1003, nutrientName: 'Protein', value: 31 },
          {
            nutrientId: 1005,
            nutrientName: 'Carbohydrate, by difference',
            value: 0,
          },
          { nutrientId: 1004, nutrientName: 'Total lipid (fat)', value: 3.6 },
        ],
        foodPortions: [{ amount: 1, modifier: 'breast', gramWeight: 120 }],
        publicationDate: '2026-01-01',
      },
      now,
    )

    expect(food).toMatchObject({
      id: 'usda:123',
      rawCookedStatus: 'cooked',
      macroBasis: 'both',
      source: {
        provider: 'usda',
        providerRecordId: '123',
        sourceUpdatedAt: '2026-01-01T00:00:00.000Z',
      },
      macrosPer100Grams: {
        calories: 165,
        proteinGrams: 31,
        carbohydrateGrams: 0,
        fatGrams: 3.6,
      },
    })
    expect(food?.macrosPerServing?.calories).toBeCloseTo(198)
    expect(food?.macrosPerServing?.proteinGrams).toBeCloseTo(37.2)
    expect(food?.macrosPerServing?.fatGrams).toBeCloseTo(4.32)
  })

  it('normalizes USDA branded and restaurant-like records while preserving brand and barcode metadata', () => {
    const food = normalizeUsdaFood(
      {
        fdcId: 456,
        description: 'Fast Burger Chain Cheeseburger',
        dataType: 'Branded',
        brandOwner: 'Fast Burger Chain',
        brandedFoodCategory: 'Restaurant Foods',
        gtinUpc: '00012345678905',
        servingSize: 5,
        servingSizeUnit: 'oz',
        householdServingFullText: '1 sandwich',
        modifiedDate: '2026-02-02',
        foodNutrients: [
          { nutrientId: 1008, value: 250 },
          { nutrientId: 1003, value: 14 },
          { nutrientId: 1005, value: 22 },
          { nutrientId: 1004, value: 12 },
        ],
      },
      now,
    )

    expect(food).toMatchObject({
      brandName: 'Fast Burger Chain',
      foodCategory: 'Restaurant Foods',
      source: { barcode: '00012345678905' },
      serving: {
        unit: 'oz',
        gramsPerServing: 141.747615625,
        conversionReliable: true,
      },
    })
  })

  it('rejects USDA records missing required macros but keeps legitimate zero values', () => {
    expect(
      normalizeUsdaFood(
        {
          fdcId: 789,
          description: 'Calorie only item',
          dataType: 'Survey (FNDDS)',
          foodNutrients: [{ nutrientId: 1008, value: 10 }],
        },
        now,
      ),
    ).toBeNull()

    expect(
      normalizeUsdaFood(
        {
          fdcId: 790,
          description: 'Zero macro test',
          dataType: 'Survey (FNDDS)',
          foodNutrients: [
            { nutrientId: 1008, value: 0 },
            { nutrientId: 1003, value: 0 },
            { nutrientId: 1005, value: 0 },
            { nutrientId: 1004, value: 0 },
          ],
        },
        now,
      ),
    ).toMatchObject({
      macrosPer100Grams: {
        calories: 0,
        proteinGrams: 0,
        carbohydrateGrams: 0,
        fatGrams: 0,
      },
    })
  })

  it('normalizes Open Food Facts branded products and converts explicit kilojoules to kilocalories', () => {
    const food = normalizeOpenFoodFactsFood(
      {
        code: '3017620422003',
        product_name: 'Hazelnut Spread',
        brands: 'Example Brand, Other Brand',
        categories: 'Spreads',
        serving_size: '15 g',
        serving_quantity: '15',
        last_modified_t: 1780000000,
        nutriments: {
          'energy-kj_100g': 2092,
          proteins_100g: '6.3',
          carbohydrates_100g: '57.5',
          fat_100g: '30.9',
        },
      },
      now,
    )

    expect(food).toMatchObject({
      id: 'open_food_facts:3017620422003',
      brandName: 'Example Brand',
      source: {
        barcode: '3017620422003',
        sourceUpdatedAt: '2026-05-28T20:26:40.000Z',
      },
      macrosPer100Grams: {
        calories: 500,
        proteinGrams: 6.3,
        carbohydrateGrams: 57.5,
        fatGrams: 30.9,
      },
      serving: { gramsPerServing: 15 },
    })
  })

  it('rejects incomplete and malformed Open Food Facts records', () => {
    expect(
      normalizeOpenFoodFactsFood(
        {
          code: 'missing',
          product_name: 'Incomplete',
          nutriments: {
            'energy-kcal_100g': 100,
            proteins_100g: 'not-a-number',
            carbohydrates_100g: 10,
            fat_100g: 1,
          },
        },
        now,
      ),
    ).toBeNull()
  })
})
