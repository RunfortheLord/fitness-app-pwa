import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createFoodRepository } from '@repositories/foodRepository'
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
})
