import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createFoodRepository } from '@repositories/foodRepository'
import {
  FOOD_NORMALIZER_VERSION,
  gramsToOunces,
  normalizeFoodText,
  type NormalizedFoodResult,
} from '@domain/foodProviderModels'
import { createTestDatabase, destroyTestDatabase } from '@test/database'
import { seedFood, testLocalDate } from '@test/seedFactories'
import type { TrainingLogDatabase } from '@db/database'

let database: TrainingLogDatabase

beforeEach(() => {
  database = createTestDatabase()
})

afterEach(async () => {
  await destroyTestDatabase(database)
})

describe('foodRepository', () => {
  it('snapshots nutrition values when logging food', async () => {
    const repository = createFoodRepository(database)
    const food = await seedFood(database)

    const log = await repository.logFood({
      foodId: food.id,
      localDate: testLocalDate,
      servingMultiplier: 1.5,
    })
    await repository.updateFood(food.id, {
      name: 'Updated rice',
      caloriesPerServing: 300,
    })

    const logs = await repository.listFoodLogsByDate(testLocalDate)

    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({
      id: log.id,
      computedCalories: 300,
      computedProteinGrams: 6,
      foodSnapshot: {
        foodName: 'Rice',
        caloriesPerServing: 200,
      },
    })
  })

  it('calculates decimal multipliers and can edit and delete logged food', async () => {
    const repository = createFoodRepository(database)
    const food = await seedFood(database)

    const log = await repository.logFood({
      foodId: food.id,
      localDate: testLocalDate,
      servingMultiplier: 0.75,
    })

    expect(log).toMatchObject({
      computedCalories: 150,
      computedProteinGrams: 3,
      computedCarbohydrateGrams: 33.75,
      computedFatGrams: 0.75,
    })

    await repository.updateFoodLogEntry(log.id, { servingMultiplier: 2 })
    await expect(
      repository.listFoodLogsByDate(testLocalDate),
    ).resolves.toMatchObject([
      {
        id: log.id,
        computedCalories: 400,
        computedProteinGrams: 8,
        computedCarbohydrateGrams: 90,
        computedFatGrams: 2,
      },
    ])

    await repository.deleteFoodLogEntry(log.id)
    await expect(repository.listFoodLogsByDate(testLocalDate)).resolves.toEqual(
      [],
    )
  })

  it('multiplies calories and macros for quantity two custom foods', async () => {
    const repository = createFoodRepository(database)
    const food = await repository.createFood({
      name: 'Banana',
      servingQuantity: 1,
      servingUnit: 'medium banana',
      servingDescription: '',
      caloriesPerServing: 85,
      proteinGramsPerServing: 1,
      carbohydrateGramsPerServing: 22,
      fatGramsPerServing: 0.3,
      notes: '',
    })

    const log = await repository.logFood({
      foodId: food.id,
      localDate: testLocalDate,
      servingMultiplier: 2,
    })

    expect(log).toMatchObject({
      computedCalories: 170,
      computedProteinGrams: 2,
      computedCarbohydrateGrams: 44,
      computedFatGrams: 0.6,
    })
  })

  it('searches foods case-insensitively with exact and prefix matches first', async () => {
    const repository = createFoodRepository(database)
    await repository.createFood({
      name: 'Greek Yogurt',
      servingQuantity: 1,
      servingUnit: 'cup',
      servingDescription: '',
      caloriesPerServing: 120,
      proteinGramsPerServing: 20,
      carbohydrateGramsPerServing: 8,
      fatGramsPerServing: 0,
      notes: '',
    })
    await repository.createFood({
      name: 'Yogurt Bowl',
      servingQuantity: 1,
      servingUnit: 'bowl',
      servingDescription: '',
      caloriesPerServing: 220,
      proteinGramsPerServing: 24,
      carbohydrateGramsPerServing: 32,
      fatGramsPerServing: 2,
      notes: '',
    })
    await repository.createFood({
      name: 'Yogurt',
      servingQuantity: 1,
      servingUnit: 'cup',
      servingDescription: '',
      caloriesPerServing: 100,
      proteinGramsPerServing: 16,
      carbohydrateGramsPerServing: 7,
      fatGramsPerServing: 0,
      notes: '',
    })

    await expect(repository.searchFoods('yogurt')).resolves.toMatchObject([
      { name: 'Yogurt' },
      { name: 'Yogurt Bowl' },
      { name: 'Greek Yogurt' },
    ])
  })

  it('matches local foods when query words are out of order', async () => {
    const repository = createFoodRepository(database)
    await repository.createFood({
      name: 'Greek Yogurt Bowl',
      servingQuantity: 1,
      servingUnit: 'bowl',
      servingDescription: '',
      caloriesPerServing: 220,
      proteinGramsPerServing: 24,
      carbohydrateGramsPerServing: 32,
      fatGramsPerServing: 2,
      notes: '',
    })

    await expect(repository.searchFoods('bowl greek')).resolves.toMatchObject([
      { name: 'Greek Yogurt Bowl' },
    ])
  })

  it('lists recent active foods once after use', async () => {
    const repository = createFoodRepository(database)
    const rice = await seedFood(database)
    const oats = await repository.createFood({
      name: 'Oats',
      servingQuantity: 1,
      servingUnit: 'cup',
      servingDescription: '',
      caloriesPerServing: 300,
      proteinGramsPerServing: 10,
      carbohydrateGramsPerServing: 54,
      fatGramsPerServing: 5,
      notes: '',
    })

    await repository.logFood({
      foodId: rice.id,
      localDate: testLocalDate,
      servingMultiplier: 1,
    })
    await repository.logFood({
      foodId: oats.id,
      localDate: testLocalDate,
      servingMultiplier: 1,
    })
    await repository.logFood({
      foodId: rice.id,
      localDate: testLocalDate,
      servingMultiplier: 2,
    })

    await expect(repository.listRecentFoods()).resolves.toMatchObject([
      { id: rice.id },
      { id: oats.id },
    ])
  })

  it('rejects invalid foods and serving multipliers', async () => {
    const repository = createFoodRepository(database)
    await expect(
      repository.createFood({
        name: '',
        servingQuantity: 1,
        servingUnit: 'cup',
        servingDescription: '',
        caloriesPerServing: 0,
        proteinGramsPerServing: 0,
        carbohydrateGramsPerServing: 0,
        fatGramsPerServing: 0,
        notes: '',
      }),
    ).rejects.toThrow('Food name is required.')

    const food = await seedFood(database)
    await expect(
      repository.logFood({
        foodId: food.id,
        localDate: testLocalDate,
        servingMultiplier: 0,
      }),
    ).rejects.toThrow('Serving multiplier must be greater than zero.')
  })

  it('rolls back a food log when the source food is missing', async () => {
    const repository = createFoodRepository(database)

    await expect(
      repository.logFood({
        foodId: 'missing',
        localDate: testLocalDate,
        servingMultiplier: 1,
      }),
    ).rejects.toThrow('Food missing was not found.')

    await expect(repository.listFoodLogsByDate(testLocalDate)).resolves.toEqual(
      [],
    )
  })

  it('rolls back a food log when the transaction fails after writing', async () => {
    const food = await seedFood(database)
    const repository = createFoodRepository(database, {
      afterFoodLogAdded: () => {
        throw new Error('forced food log failure')
      },
    })

    await expect(
      repository.logFood({
        foodId: food.id,
        localDate: testLocalDate,
        servingMultiplier: 1,
      }),
    ).rejects.toThrow('forced food log failure')

    await expect(database.foodLogEntries.toArray()).resolves.toEqual([])
  })

  it('archives referenced foods instead of deleting them', async () => {
    const repository = createFoodRepository(database)
    const food = await seedFood(database)
    await repository.archiveFood(food.id)

    await expect(repository.getFood(food.id)).resolves.toMatchObject({
      id: food.id,
      status: 'archived',
    })
  })

  it('creates immutable external-food snapshots that render without provider access', async () => {
    const repository = createFoodRepository(database)
    const providerFood = makeProviderFood()

    const log = await repository.logExternalFood({
      food: providerFood,
      localDate: testLocalDate,
      servingMultiplier: 2,
    })
    await repository.upsertProviderFood({
      ...providerFood,
      macrosPerServing: {
        calories: 300,
        proteinGrams: 99,
        carbohydrateGrams: 1,
        fatGrams: 2,
      },
    })

    const [storedLog] = await repository.listFoodLogsByDate(testLocalDate)
    expect(storedLog).toMatchObject({
      id: log.id,
      foodId: providerFood.id,
      computedCalories: 400,
      computedProteinGrams: 20,
      foodSnapshot: {
        foodName: 'Provider Rice',
        brandName: 'Provider Brand',
        sourceType: 'provider',
        provider: 'usda',
        providerRecordId: '123',
        providerDataType: 'Branded',
        caloriesPerServing: 200,
        proteinGramsPerServing: 10,
        carbohydrateGramsPerServing: 45,
        fatGramsPerServing: 1,
        gramsPerServing: 100,
        ouncesPerServing: gramsToOunces(100),
        macroBasis: 'both',
        rawCookedStatus: 'unknown',
        normalizerVersion: FOOD_NORMALIZER_VERSION,
      },
    })
    expect(storedLog.foodSnapshot.snapshotId).toBeTruthy()
  })

  it('prevents imported provider foods from being directly edited', async () => {
    const repository = createFoodRepository(database)
    const food = await repository.upsertProviderFood(makeProviderFood())

    await expect(
      repository.updateFood(food.id, { name: 'Edited provider food' }),
    ).rejects.toThrow('Imported provider foods cannot be edited directly.')
  })
})

function makeProviderFood(): NormalizedFoodResult {
  return {
    id: 'usda:123',
    source: {
      provider: 'usda',
      providerRecordId: '123',
      providerDataType: 'Branded',
      sourceName: 'USDA FoodData Central',
      sourceUrl:
        'https://fdc.nal.usda.gov/fdc-app.html#/food-details/123/nutrients',
      barcode: '000123',
      sourceUpdatedAt: '2026-01-01T00:00:00.000Z',
      ingestedAt: '2026-06-19T00:00:00.000Z',
    },
    name: 'Provider Rice',
    brandName: 'Provider Brand',
    foodCategory: 'Grains',
    descriptionQualifiers: [],
    rawCookedStatus: 'unknown',
    rawCookedBasis: null,
    serving: {
      quantity: 1,
      unit: 'cup',
      description: '1 cup',
      gramsPerServing: 100,
      ouncesPerServing: gramsToOunces(100),
      conversionReliable: true,
      conversionSource: 'provider_serving_weight',
      sourcePortions: [],
    },
    macrosPerServing: {
      calories: 200,
      proteinGrams: 10,
      carbohydrateGrams: 45,
      fatGrams: 1,
    },
    macrosPer100Grams: {
      calories: 200,
      proteinGrams: 10,
      carbohydrateGrams: 45,
      fatGrams: 1,
    },
    macroBasis: 'both',
    sourcePrecision: {},
    normalizedSearchName: normalizeFoodText('Provider Rice'),
    normalizedBrand: normalizeFoodText('Provider Brand'),
    providerPriority: 85,
    relevanceScore: 0,
    duplicateGroupId: 'usda:123',
    alternateResultIds: [],
    groupingReasons: [],
    normalizerVersion: FOOD_NORMALIZER_VERSION,
  }
}
