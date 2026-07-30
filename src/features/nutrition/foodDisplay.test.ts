import { describe, expect, it } from 'vitest'

import type { GroupedFoodResult } from '@domain/foodProviderModels'
import type { Food, FoodLogEntry } from '@shared-types/app'

import {
  durableServingPreference,
  foodSnapshotPortionBasis,
  formatLoggedAmount,
  servingOptionsForResult,
  snapshotServingLabel,
} from './foodDisplay'

describe('nutrition food display', () => {
  it('normalizes amount-encoded snapshot units for history and editing', () => {
    const entry: FoodLogEntry = {
      id: 'log-1',
      localDate: '2026-07-16',
      foodId: 'food-1',
      foodSnapshot: {
        foodName: 'Hazelnut spread',
        servingQuantity: 1,
        servingUnit: '15 g',
        servingDescription: '15 g',
        gramsPerServing: 15,
        caloriesPerServing: 80,
        proteinGramsPerServing: 1,
        carbohydrateGramsPerServing: 8,
        fatGramsPerServing: 5,
        notes: '',
      },
      mealType: 'snack',
      servingMultiplier: 1.5,
      computedCalories: 120,
      computedProteinGrams: 1.5,
      computedCarbohydrateGrams: 12,
      computedFatGrams: 7.5,
      notes: '',
      createdAt: '2026-07-16T12:00:00.000Z',
      updatedAt: '2026-07-16T12:00:00.000Z',
    }

    expect(foodSnapshotPortionBasis(entry.foodSnapshot)).toEqual({
      amount: 15,
      unit: 'g',
    })
    expect(snapshotServingLabel(entry)).toBe('15 g')
    expect(formatLoggedAmount(entry)).toBe('22.5 g')
  })

  it('stores provider preferences on the persisted serving basis', () => {
    const food: GroupedFoodResult = {
      id: 'usda:yogurt',
      source: {
        provider: 'usda',
        providerRecordId: 'yogurt',
        providerDataType: 'Foundation',
        sourceName: 'USDA FoodData Central',
        sourceUrl: null,
        barcode: null,
        sourceUpdatedAt: null,
        ingestedAt: '2026-07-16T12:00:00.000Z',
      },
      name: 'Plain yogurt',
      brandName: null,
      foodCategory: 'Dairy',
      descriptionQualifiers: [],
      rawCookedStatus: 'unknown',
      rawCookedBasis: null,
      serving: {
        quantity: 100,
        unit: 'g',
        description: '100 g',
        gramsPerServing: 100,
        ouncesPerServing: 3.5274,
        conversionReliable: true,
        conversionSource: 'per_100g',
        sourcePortions: [
          {
            amount: 1,
            unit: 'cup',
            description: '1 cup',
            gramWeight: 245,
          },
          {
            amount: 1,
            unit: 'container',
            description: '1 container',
            gramWeight: 170,
          },
        ],
      },
      macrosPerServing: {
        calories: 60,
        proteinGrams: 10,
        carbohydrateGrams: 4,
        fatGrams: 0,
      },
      macrosPer100Grams: {
        calories: 60,
        proteinGrams: 10,
        carbohydrateGrams: 4,
        fatGrams: 0,
      },
      macroBasis: 'both',
      sourcePrecision: {},
      normalizedSearchName: 'plain yogurt',
      normalizedBrand: null,
      providerPriority: 100,
      relevanceScore: 1,
      duplicateGroupId: 'usda:yogurt',
      alternateResultIds: [],
      groupingReasons: [],
      normalizerVersion: 1,
      alternates: [],
    }
    const result = { type: 'external' as const, food }
    const container = servingOptionsForResult(result, null).find(
      (option) => option.key === 'container',
    )
    expect(container).toBeDefined()
    const servingMultiplier = container!.toServingMultiplier(1)
    expect(servingMultiplier).toBeCloseTo(1.7)

    expect(
      durableServingPreference(result, container!, 1, servingMultiplier!),
    ).toEqual({ unitKey: 'serving', amount: 170 })

    const restaurantFood: GroupedFoodResult = {
      ...food,
      id: 'usda:restaurant-platter',
      name: 'Market Grill chicken platter',
      brandName: 'Market Grill',
      foodCategory: 'Restaurant Foods',
      serving: {
        ...food.serving,
        sourcePortions: [
          {
            amount: 1,
            unit: 'platter',
            description: '1 platter',
            gramWeight: 250,
          },
        ],
      },
      normalizedSearchName: 'market grill chicken platter',
    }
    const restaurantResult = {
      type: 'external' as const,
      food: restaurantFood,
    }
    const platter = servingOptionsForResult(restaurantResult, null)[0]
    const platterMultiplier = platter.toServingMultiplier(platter.amount)
    expect(platterMultiplier).toBe(2.5)

    const persistedFood: Food = {
      id: restaurantFood.id,
      name: restaurantFood.name,
      brandName: restaurantFood.brandName,
      foodCategory: restaurantFood.foodCategory,
      servingQuantity: 1,
      servingUnit: 'platter',
      servingDescription: '1 platter',
      gramsPerServing: 250,
      ouncesPerServing: 8.8185,
      servingConversionReliable: true,
      servingConversionSource: 'provider_portion_weight',
      caloriesPerServing: 150,
      proteinGramsPerServing: 25,
      carbohydrateGramsPerServing: 10,
      fatGramsPerServing: 0,
      sourceType: 'provider',
      provider: 'usda',
      providerRecordId: 'restaurant-platter',
      providerDataType: 'Foundation',
      notes: '',
      status: 'active',
      createdAt: '2026-07-19T00:00:00.000Z',
      updatedAt: '2026-07-19T00:00:00.000Z',
    }
    expect(
      durableServingPreference(
        restaurantResult,
        platter,
        platter.amount,
        platterMultiplier!,
        persistedFood,
      ),
    ).toEqual({ unitKey: 'serving', amount: 1 })
  })
})
