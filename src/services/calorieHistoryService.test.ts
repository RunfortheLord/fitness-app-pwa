import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { TrainingLogDatabase } from '@db/database'
import { createFoodRepository } from '@repositories/foodRepository'
import { createSettingsRepository } from '@repositories/settingsRepository'
import { createCalorieHistoryService } from '@services/calorieHistoryService'
import { createTestDatabase, destroyTestDatabase } from '@test/database'
import { seedFood } from '@test/seedFactories'

let database: TrainingLogDatabase

beforeEach(() => {
  database = createTestDatabase()
})

afterEach(async () => {
  await destroyTestDatabase(database)
})

describe('calorieHistoryService', () => {
  it('returns every day in the requested range, including unlogged days', async () => {
    const service = createCalorieHistoryService(database, {
      syncToCloud: false,
    })
    const foodRepository = createFoodRepository(database)
    const food = await seedFood(database)
    await foodRepository.logFood({
      foodId: food.id,
      localDate: '2026-06-27',
      servingMultiplier: 1.5,
    })

    const history = await service.getHistory('2026-06-27', '1w')

    expect(history).toHaveLength(7)
    expect(history[0]).toMatchObject({
      localDate: '2026-06-21',
      loggedCalories: 0,
    })
    expect(history.at(-1)).toMatchObject({
      localDate: '2026-06-27',
      loggedCalories: 300,
    })
  })

  it('uses the target applicable to each calendar day', async () => {
    const settings = createSettingsRepository(database)
    const service = createCalorieHistoryService(database, {
      syncToCloud: false,
    })
    const first = await settings.saveNutritionTargets({
      calories: 2000,
      proteinGrams: 100,
      carbohydrateGrams: 200,
      fatGrams: 60,
    })
    await database.nutritionTargets.update(first.id, {
      createdAt: '2026-06-22T12:00:00.000Z',
    })
    const second = await settings.saveNutritionTargets({
      calories: 2400,
      proteinGrams: 120,
      carbohydrateGrams: 240,
      fatGrams: 70,
    })
    await database.nutritionTargets.update(second.id, {
      createdAt: '2026-06-25T12:00:00.000Z',
    })

    const history = await service.getHistory('2026-06-27', '1w')

    expect(history.map((day) => day.targetCalories)).toEqual([
      0, 2000, 2000, 2000, 2400, 2400, 2400,
    ])
  })

  it.each([
    ['1w', 7],
    ['1m', 30],
    ['3m', 90],
  ] as const)('returns %s as %i calendar days', async (range, days) => {
    const service = createCalorieHistoryService(database, {
      syncToCloud: false,
    })
    await expect(service.getHistory('2026-06-27', range)).resolves.toHaveLength(
      days,
    )
  })
})
