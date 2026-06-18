import { db, type TrainingLogDatabase } from '@db/database'
import type { LocalDateString } from '@domain/dates'
import { createId } from '@domain/ids'
import { snapshotFood } from '@domain/snapshots'
import type { Food, FoodLogEntry } from '@shared-types/app'

export type CreateFoodInput = Omit<
  Food,
  'id' | 'status' | 'createdAt' | 'updatedAt'
>
export type UpdateFoodInput = Partial<CreateFoodInput>

export type LogFoodInput = {
  foodId: string
  localDate: LocalDateString
  servingMultiplier: number
  notes?: string
}

export type FoodRepositoryTestHooks = {
  afterFoodLogAdded?: () => void | Promise<void>
}

export function createFoodRepository(
  database: TrainingLogDatabase = db,
  testHooks: FoodRepositoryTestHooks = {},
) {
  return {
    async createFood(input: CreateFoodInput) {
      const now = new Date().toISOString()
      const food: Food = {
        id: createId(),
        ...input,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      }
      await database.foods.add(food)
      return food
    },

    async updateFood(id: string, input: UpdateFoodInput) {
      const food = await database.foods.get(id)
      if (!food) {
        throw new Error(`Food ${id} was not found.`)
      }
      const updated: Food = {
        ...food,
        ...input,
        id: food.id,
        status: food.status,
        createdAt: food.createdAt,
        updatedAt: new Date().toISOString(),
      }
      await database.foods.put(updated)
      return updated
    },

    async archiveFood(id: string) {
      await database.foods.update(id, {
        status: 'archived',
        updatedAt: new Date().toISOString(),
      })
    },

    async logFood(input: LogFoodInput) {
      const now = new Date().toISOString()
      return database.transaction(
        'rw',
        database.foods,
        database.foodLogEntries,
        async () => {
          const food = await database.foods.get(input.foodId)
          if (!food) {
            throw new Error(`Food ${input.foodId} was not found.`)
          }

          const entry: FoodLogEntry = {
            id: createId(),
            localDate: input.localDate,
            foodId: food.id,
            foodSnapshot: snapshotFood(food),
            servingMultiplier: input.servingMultiplier,
            computedCalories: food.caloriesPerServing * input.servingMultiplier,
            computedProteinGrams:
              food.proteinGramsPerServing * input.servingMultiplier,
            computedCarbohydrateGrams:
              food.carbohydrateGramsPerServing * input.servingMultiplier,
            computedFatGrams: food.fatGramsPerServing * input.servingMultiplier,
            notes: input.notes ?? '',
            createdAt: now,
            updatedAt: now,
          }

          await database.foodLogEntries.add(entry)
          await testHooks.afterFoodLogAdded?.()
          return entry
        },
      )
    },

    getFood(id: string) {
      return database.foods.get(id)
    },

    listFoods() {
      return database.foods.orderBy('name').toArray()
    },

    listFoodLogsByDate(localDate: LocalDateString) {
      return database.foodLogEntries.where({ localDate }).sortBy('createdAt')
    },

    listRecentFoodLogs(limit = 5) {
      return database.foodLogEntries
        .orderBy('createdAt')
        .reverse()
        .limit(limit)
        .toArray()
    },
  }
}

export const foodRepository = createFoodRepository()
