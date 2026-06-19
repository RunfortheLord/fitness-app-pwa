import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { TrainingLogDatabase } from '@db/database'
import { createFoodRepository } from '@repositories/foodRepository'
import { createSettingsRepository } from '@repositories/settingsRepository'
import { createNutritionSummaryService } from '@services/nutritionSummaryService'
import { createTestDatabase, destroyTestDatabase } from '@test/database'
import { seedFood } from '@test/seedFactories'

let database: TrainingLogDatabase

beforeEach(() => {
  database = createTestDatabase()
})

afterEach(async () => {
  await destroyTestDatabase(database)
})

describe('nutritionSummaryService', () => {
  it('totals logged foods and allows calories remaining to be negative', async () => {
    const foodRepository = createFoodRepository(database)
    const settingsRepository = createSettingsRepository(database)
    const summaryService = createNutritionSummaryService(database)
    const food = await seedFood(database)

    await settingsRepository.saveNutritionTargets({
      calories: 100,
      proteinGrams: 10,
      carbohydrateGrams: 10,
      fatGrams: 10,
    })
    await foodRepository.logFood({
      foodId: food.id,
      localDate: '2026-06-18',
      servingMultiplier: 1,
    })

    await expect(
      summaryService.getDailySummary('2026-06-18'),
    ).resolves.toMatchObject({
      totals: {
        calories: 200,
        proteinGrams: 4,
        carbohydrateGrams: 45,
        fatGrams: 1,
      },
      remainingCalories: -100,
    })
  })

  it('uses target history for historical dates', async () => {
    const settingsRepository = createSettingsRepository(database)
    const summaryService = createNutritionSummaryService(database)

    const firstTarget = await settingsRepository.saveNutritionTargets({
      calories: 2000,
      proteinGrams: 150,
      carbohydrateGrams: 220,
      fatGrams: 60,
    })
    await database.nutritionTargets.update(firstTarget.id, {
      createdAt: '2026-06-18T12:00:00.000Z',
      updatedAt: '2026-06-18T12:00:00.000Z',
    })
    const secondTarget = await settingsRepository.saveNutritionTargets({
      calories: 2400,
      proteinGrams: 180,
      carbohydrateGrams: 260,
      fatGrams: 70,
    })
    await database.nutritionTargets.update(secondTarget.id, {
      createdAt: '2026-06-19T12:00:00.000Z',
      updatedAt: '2026-06-19T12:00:00.000Z',
    })

    await expect(
      summaryService.getDailySummary('2026-06-18'),
    ).resolves.toMatchObject({
      targets: { calories: 2000 },
    })
    await expect(
      summaryService.getDailySummary('2026-06-19'),
    ).resolves.toMatchObject({
      targets: { calories: 2400 },
    })
  })
})
