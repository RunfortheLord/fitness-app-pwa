import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createFoodRepository } from '@repositories/foodRepository'
import {
  FOOD_NORMALIZER_VERSION,
  gramsToOunces,
  normalizeFoodText,
  type NormalizedFoodResult,
} from '@domain/foodProviderModels'
import { createTestDatabase, destroyTestDatabase } from '@test/database'
import { snapshotFood } from '@domain/snapshots'
import { servingOptionsForFood } from '@domain/foodServings'
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

  it('stores the chosen meal and can move an entry to another meal', async () => {
    const repository = createFoodRepository(database)
    const food = await seedFood(database)

    const log = await repository.logFood({
      foodId: food.id,
      localDate: testLocalDate,
      servingMultiplier: 1,
      mealType: 'breakfast',
    })
    expect(log.mealType).toBe('breakfast')

    const moved = await repository.updateFoodLogEntry(log.id, {
      servingMultiplier: 1,
      mealType: 'dinner',
    })
    expect(moved.mealType).toBe('dinner')

    const retained = await repository.updateFoodLogEntry(log.id, {
      servingMultiplier: 2,
    })
    expect(retained.mealType).toBe('dinner')
  })

  it('defaults a logged meal from the time of day when none is given', async () => {
    const repository = createFoodRepository(database)
    const food = await seedFood(database)

    const log = await repository.logFood({
      foodId: food.id,
      localDate: testLocalDate,
      servingMultiplier: 1,
    })

    expect(['breakfast', 'lunch', 'dinner', 'snack']).toContain(log.mealType)
  })

  it('creates a saved meal and logs it as separate dated entries', async () => {
    const repository = createFoodRepository(database)
    const oats = await repository.createFood({
      name: 'Oats',
      servingQuantity: 1,
      servingUnit: 'cup',
      servingDescription: '',
      caloriesPerServing: 150,
      proteinGramsPerServing: 5,
      carbohydrateGramsPerServing: 27,
      fatGramsPerServing: 3,
      notes: '',
    })
    const milk = await repository.createFood({
      name: 'Milk',
      servingQuantity: 1,
      servingUnit: 'cup',
      servingDescription: '',
      caloriesPerServing: 100,
      proteinGramsPerServing: 8,
      carbohydrateGramsPerServing: 12,
      fatGramsPerServing: 2,
      notes: '',
    })

    const meal = await repository.createSavedMeal({
      name: 'Oatmeal bowl',
      components: [
        {
          foodId: oats.id,
          foodSnapshot: snapshotFood(oats),
          servingMultiplier: 2,
        },
        {
          foodId: milk.id,
          foodSnapshot: snapshotFood(milk),
          servingMultiplier: 1,
        },
      ],
    })

    await expect(
      repository.listSavedMeals().then((meals) => meals.map((m) => m.name)),
    ).resolves.toEqual(['Oatmeal bowl'])

    const logged = await repository.logSavedMeal({
      savedMealId: meal.id,
      localDate: testLocalDate,
      mealType: 'breakfast',
    })
    expect(logged).toHaveLength(2)

    const logs = await repository.listFoodLogsByDate(testLocalDate)
    expect(logs).toHaveLength(2)
    expect(logs.every((log) => log.mealType === 'breakfast')).toBe(true)
    expect(logs.map((log) => log.foodSnapshot.foodName).sort()).toEqual([
      'Milk',
      'Oats',
    ])
    const oatsLog = logs.find((log) => log.foodSnapshot.foodName === 'Oats')
    expect(oatsLog?.computedCalories).toBe(300)
  })

  it('rejects an empty saved meal and archives saved meals', async () => {
    const repository = createFoodRepository(database)
    const food = await seedFood(database)

    await expect(
      repository.createSavedMeal({ name: 'Empty', components: [] }),
    ).rejects.toThrow('at least one food')

    const meal = await repository.createSavedMeal({
      name: 'Just rice',
      components: [
        {
          foodId: food.id,
          foodSnapshot: snapshotFood(food),
          servingMultiplier: 1,
        },
      ],
    })
    await repository.archiveSavedMeal(meal.id)
    await expect(repository.listSavedMeals()).resolves.toEqual([])
  })

  it('logs a draft meal and saves it only when requested', async () => {
    const repository = createFoodRepository(database)
    const food = await seedFood(database)
    const components = [
      {
        foodId: food.id,
        foodSnapshot: snapshotFood(food),
        servingMultiplier: 1.5,
      },
    ]

    const loggedOnly = await repository.logMealDraft({
      name: 'Photo meal',
      components,
      localDate: testLocalDate,
      saveAsRecipe: false,
    })

    expect(loggedOnly.savedMeal).toBeNull()
    expect(loggedOnly.entries).toHaveLength(1)
    expect(loggedOnly.entries[0].computedCalories).toBe(300)
    await expect(database.savedMeals.count()).resolves.toBe(0)

    const loggedAndSaved = await repository.logMealDraft({
      name: 'Photo meal',
      components,
      localDate: testLocalDate,
      saveAsRecipe: true,
    })

    expect(loggedAndSaved.savedMeal?.name).toBe('Photo meal')
    await expect(database.savedMeals.count()).resolves.toBe(1)
    await expect(database.foodLogEntries.count()).resolves.toBe(2)
  })

  it('rolls back AI recipe saving when ingredient logging fails', async () => {
    const food = await seedFood(database)
    const repository = createFoodRepository(database, {
      afterFoodLogAdded: () => {
        throw new Error('forced draft log failure')
      },
    })

    await expect(
      repository.logMealDraft({
        name: 'Photo meal',
        components: [
          {
            foodId: food.id,
            foodSnapshot: snapshotFood(food),
            servingMultiplier: 1,
          },
        ],
        localDate: testLocalDate,
        saveAsRecipe: true,
      }),
    ).rejects.toThrow('forced draft log failure')

    await expect(database.savedMeals.count()).resolves.toBe(0)
    await expect(database.foodLogEntries.count()).resolves.toBe(0)
  })

  it('edits a saved meal name and components', async () => {
    const repository = createFoodRepository(database)
    const makeFood = (name: string, calories: number) =>
      repository.createFood({
        name,
        servingQuantity: 1,
        servingUnit: 'serving',
        servingDescription: '',
        caloriesPerServing: calories,
        proteinGramsPerServing: 10,
        carbohydrateGramsPerServing: 20,
        fatGramsPerServing: 5,
        notes: '',
      })
    const rice = await makeFood('Rice', 205)
    const chicken = await makeFood('Chicken', 165)

    const meal = await repository.createSavedMeal({
      name: 'Chicken bowl',
      components: [
        {
          foodId: chicken.id,
          foodSnapshot: snapshotFood(chicken),
          servingMultiplier: 1,
        },
      ],
    })

    const updated = await repository.updateSavedMeal(meal.id, {
      name: 'Chicken & rice',
      components: [
        {
          foodId: chicken.id,
          foodSnapshot: snapshotFood(chicken),
          servingMultiplier: 2,
        },
        {
          foodId: rice.id,
          foodSnapshot: snapshotFood(rice),
          servingMultiplier: 1,
        },
      ],
    })

    expect(updated.name).toBe('Chicken & rice')
    expect(updated.components).toHaveLength(2)
    expect(updated.components[0].servingMultiplier).toBe(2)

    const reloaded = await repository.listSavedMeals()
    expect(reloaded).toHaveLength(1)
    expect(reloaded[0].components.map((c) => c.foodSnapshot.foodName)).toEqual([
      'Chicken',
      'Rice',
    ])

    await expect(
      repository.updateSavedMeal(meal.id, { components: [] }),
    ).rejects.toThrow('at least one food')
  })

  it('stars and unstars foods and lists favorites alphabetically', async () => {
    const repository = createFoodRepository(database)
    const apple = await repository.createFood({
      name: 'Apple',
      servingQuantity: 1,
      servingUnit: 'medium',
      servingDescription: '',
      caloriesPerServing: 95,
      proteinGramsPerServing: 0,
      carbohydrateGramsPerServing: 25,
      fatGramsPerServing: 0,
      notes: '',
    })
    const banana = await repository.createFood({
      name: 'Banana',
      servingQuantity: 1,
      servingUnit: 'medium',
      servingDescription: '',
      caloriesPerServing: 105,
      proteinGramsPerServing: 1,
      carbohydrateGramsPerServing: 27,
      fatGramsPerServing: 0,
      notes: '',
    })

    await expect(repository.listFavoriteFoods()).resolves.toEqual([])

    await repository.setFoodFavorite(banana.id, true)
    await repository.setFoodFavorite(apple.id, true)
    await expect(
      repository.listFavoriteFoods().then((foods) => foods.map((f) => f.name)),
    ).resolves.toEqual(['Apple', 'Banana'])

    await repository.setFoodFavorite(banana.id, false)
    await expect(
      repository.listFavoriteFoods().then((foods) => foods.map((f) => f.name)),
    ).resolves.toEqual(['Apple'])
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

  it('lists distinct foods closest to the current clock time', async () => {
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
    const eggs = await repository.createFood({
      name: 'Eggs',
      servingQuantity: 2,
      servingUnit: 'eggs',
      servingDescription: '',
      caloriesPerServing: 140,
      proteinGramsPerServing: 12,
      carbohydrateGramsPerServing: 1,
      fatGramsPerServing: 10,
      notes: '',
    })

    await repository.logFood({
      foodId: eggs.id,
      localDate: '2026-06-11',
      servingMultiplier: 1,
      mealType: 'breakfast',
    })
    await repository.logFood({
      foodId: rice.id,
      localDate: '2026-06-18',
      servingMultiplier: 1,
      mealType: 'lunch',
    })
    await repository.logFood({
      foodId: rice.id,
      localDate: '2026-06-17',
      servingMultiplier: 1,
      mealType: 'breakfast',
    })
    await repository.logFood({
      foodId: oats.id,
      localDate: '2026-06-18',
      servingMultiplier: 1,
      mealType: 'breakfast',
    })
    await repository.logFood({
      foodId: rice.id,
      localDate: '2026-06-18',
      servingMultiplier: 2,
      mealType: 'breakfast',
    })

    const logs = await database.foodLogEntries.toArray()
    const createdAtByFood = new Map([
      [eggs.id, '2026-06-18T17:55:00.000Z'],
      [rice.id, '2026-06-18T18:05:00.000Z'],
      [oats.id, '2026-06-18T15:00:00.000Z'],
    ])
    await database.foodLogEntries.bulkPut(
      logs.map((log) => ({
        ...log,
        createdAt:
          (log.foodId && createdAtByFood.get(log.foodId)) ?? log.createdAt,
      })),
    )

    await expect(
      repository.listFoodsLoggedNearTime({
        before: new Date('2026-06-19T18:00:00.000Z'),
        limit: 8,
      }),
    ).resolves.toMatchObject([
      { id: rice.id },
      { id: eggs.id },
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
        foodCategory: 'Grains',
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

  it('persists generic restaurant categories so full menu servings survive reuse', async () => {
    const repository = createFoodRepository(database)
    const restaurants = [
      {
        id: 'usda:restaurant-steak',
        name: 'Oak Street Grill sirloin steak',
        brandName: 'Oak Street Grill',
        foodCategory: 'Restaurant Foods',
        servingQuantity: 9,
        servingUnit: 'oz',
        servingDescription: '1 steak',
        gramsPerServing: 9 * 28.349523125,
        expectedKey: 'steak',
        expectedLabel: '1 steak',
      },
      {
        id: 'usda:fast-food-brisket',
        name: 'River Road Smokehouse beef brisket',
        brandName: 'River Road Smokehouse',
        foodCategory: 'Fast Foods',
        servingQuantity: 310,
        servingUnit: 'g',
        servingDescription: '1 platter',
        gramsPerServing: 310,
        expectedKey: 'platter',
        expectedLabel: '1 platter',
      },
    ]

    for (const restaurant of restaurants) {
      const providerFood = makeProviderFood()
      await repository.upsertProviderFood({
        ...providerFood,
        id: restaurant.id,
        name: restaurant.name,
        brandName: restaurant.brandName,
        foodCategory: restaurant.foodCategory,
        source: {
          ...providerFood.source,
          providerRecordId: restaurant.id,
        },
        serving: {
          ...providerFood.serving,
          quantity: restaurant.servingQuantity,
          unit: restaurant.servingUnit,
          description: restaurant.servingDescription,
          gramsPerServing: restaurant.gramsPerServing,
          ouncesPerServing: gramsToOunces(restaurant.gramsPerServing),
          sourcePortions: [],
        },
      })

      const stored = await repository.getFood(restaurant.id)
      expect(stored).toMatchObject({
        foodCategory: restaurant.foodCategory,
        servingDescription: restaurant.servingDescription,
      })
      if (!stored) {
        throw new Error('Expected provider food to persist.')
      }
      expect(servingOptionsForFood(stored)[0]).toMatchObject({
        amount: 1,
        label: restaurant.expectedLabel,
      })
    }
  })

  it('persists a restaurant item count and keeps its known category on a later sparse upsert', async () => {
    const repository = createFoodRepository(database)
    const base = makeProviderFood()
    const sixNuggets: NormalizedFoodResult = {
      ...base,
      id: 'usda:mcnuggets-six-piece',
      name: "McDonald's Chicken McNuggets",
      brandName: "McDonald's",
      foodCategory: 'Fast Foods',
      source: {
        ...base.source,
        providerRecordId: 'mcnuggets-six-piece',
      },
      serving: {
        ...base.serving,
        quantity: 1,
        unit: 'serving',
        description: '',
        gramsPerServing: 95,
        ouncesPerServing: gramsToOunces(95),
        sourcePortions: [
          {
            amount: 6,
            unit: 'pieces',
            description: '6 pieces',
            gramWeight: 95,
          },
        ],
      },
      macrosPerServing: {
        calories: 250,
        proteinGrams: 14,
        carbohydrateGrams: 15,
        fatGrams: 15,
      },
    }

    const first = await repository.upsertProviderFood(sixNuggets)
    expect(first).toMatchObject({
      foodCategory: 'Fast Foods',
      servingQuantity: 6,
      servingUnit: 'pieces',
      servingDescription: '6 pieces',
      caloriesPerServing: 250,
    })
    expect(servingOptionsForFood(first)[0]).toMatchObject({
      amount: 6,
      label: '6 pieces',
    })

    const refreshed = await repository.upsertProviderFood({
      ...sixNuggets,
      foodCategory: null,
    })
    expect(refreshed).toMatchObject({
      foodCategory: 'Fast Foods',
      servingQuantity: 6,
      servingUnit: 'pieces',
      caloriesPerServing: 250,
    })

    const log = await repository.logExternalFood({
      food: sixNuggets,
      localDate: testLocalDate,
      servingMultiplier: 1,
    })
    expect(log).toMatchObject({
      computedCalories: 250,
      foodSnapshot: {
        foodCategory: 'Fast Foods',
        servingQuantity: 6,
        servingUnit: 'pieces',
        caloriesPerServing: 250,
      },
    })
  })

  it('rebases an external restaurant multiplier after canonicalizing a larger listed portion', async () => {
    const repository = createFoodRepository(database)
    const base = makeProviderFood()
    const platter: NormalizedFoodResult = {
      ...base,
      id: 'usda:restaurant-platter',
      name: 'Market Grill chicken platter',
      brandName: 'Market Grill',
      foodCategory: 'Restaurant Foods',
      source: {
        ...base.source,
        providerRecordId: 'restaurant-platter',
      },
      serving: {
        ...base.serving,
        quantity: 100,
        unit: 'g',
        description: '100 g',
        gramsPerServing: 100,
        ouncesPerServing: gramsToOunces(100),
        sourcePortions: [
          {
            amount: 1,
            unit: 'platter',
            description: '1 platter',
            gramWeight: 250,
          },
        ],
      },
      macrosPerServing: {
        calories: 100,
        proteinGrams: 10,
        carbohydrateGrams: 8,
        fatGrams: 3,
      },
      macrosPer100Grams: {
        calories: 100,
        proteinGrams: 10,
        carbohydrateGrams: 8,
        fatGrams: 3,
      },
    }
    const listedServing = servingOptionsForFood(platter)[0]
    const providerMultiplier = listedServing.toServingMultiplier(
      listedServing.amount,
    )
    expect(providerMultiplier).toBe(2.5)

    const log = await repository.logExternalFood({
      food: platter,
      localDate: testLocalDate,
      servingMultiplier: providerMultiplier ?? 0,
    })

    expect(log).toMatchObject({
      servingMultiplier: 1,
      computedCalories: 250,
      computedProteinGrams: 25,
      foodSnapshot: {
        servingQuantity: 1,
        servingUnit: 'platter',
        caloriesPerServing: 250,
      },
    })
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
