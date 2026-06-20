import { db, type TrainingLogDatabase } from '@db/database'
import type { NormalizedFoodResult } from '@domain/foodProviderModels'
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

export type LogExternalFoodInput = {
  food: NormalizedFoodResult
  localDate: LocalDateString
  servingMultiplier: number
  notes?: string
}

export type UpdateFoodLogInput = {
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
  let lastFoodLogTimestampMs = 0

  function createMonotonicTimestamp() {
    const currentMs = Date.now()
    const nextMs =
      currentMs <= lastFoodLogTimestampMs
        ? lastFoodLogTimestampMs + 1
        : currentMs
    lastFoodLogTimestampMs = nextMs
    return new Date(nextMs).toISOString()
  }

  function validateFoodInput(input: CreateFoodInput) {
    if (!input.name.trim()) {
      throw new Error('Food name is required.')
    }

    if (input.servingQuantity <= 0 || !Number.isFinite(input.servingQuantity)) {
      throw new Error('Serving quantity must be greater than zero.')
    }

    if (!input.servingUnit.trim()) {
      throw new Error('Serving unit is required.')
    }

    for (const [label, value] of [
      ['Calories', input.caloriesPerServing],
    ] as const) {
      if (value < 0 || !Number.isFinite(value)) {
        throw new Error(`${label} must be zero or greater.`)
      }
    }

    for (const [label, value] of [
      ['Protein', input.proteinGramsPerServing],
      ['Carbohydrates', input.carbohydrateGramsPerServing],
      ['Fat', input.fatGramsPerServing],
    ] as const) {
      if (value < 0 || !Number.isFinite(value)) {
        throw new Error(`${label} must be zero or greater when provided.`)
      }
    }
  }

  function validateServingMultiplier(servingMultiplier: number) {
    if (servingMultiplier <= 0 || !Number.isFinite(servingMultiplier)) {
      throw new Error('Serving multiplier must be greater than zero.')
    }
  }

  function computeLogTotals(
    snapshot: FoodLogEntry['foodSnapshot'],
    servingMultiplier: number,
  ) {
    return {
      computedCalories: snapshot.caloriesPerServing * servingMultiplier,
      computedProteinGrams: snapshot.proteinGramsPerServing * servingMultiplier,
      computedCarbohydrateGrams:
        snapshot.carbohydrateGramsPerServing * servingMultiplier,
      computedFatGrams: snapshot.fatGramsPerServing * servingMultiplier,
    }
  }

  const repository = {
    async createFood(input: CreateFoodInput) {
      validateFoodInput(input)
      const normalizedName = input.name.trim().toLocaleLowerCase()
      const duplicate = await database.foods
        .where('status')
        .equals('active')
        .filter(
          (food) => food.name.trim().toLocaleLowerCase() === normalizedName,
        )
        .first()
      if (duplicate) {
        throw new Error('A food with that name already exists.')
      }
      const now = new Date().toISOString()
      const food: Food = {
        id: createId(),
        ...input,
        name: input.name.trim(),
        servingUnit: input.servingUnit.trim(),
        servingDescription: '',
        proteinGramsPerServing: input.proteinGramsPerServing ?? 0,
        carbohydrateGramsPerServing: input.carbohydrateGramsPerServing ?? 0,
        fatGramsPerServing: input.fatGramsPerServing ?? 0,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      }
      await database.foods.add(food)
      return food
    },

    async upsertProviderFood(input: NormalizedFoodResult) {
      const macros = input.macrosPerServing ?? input.macrosPer100Grams
      if (!macros) {
        throw new Error('Provider food is missing required macros.')
      }

      const now = new Date().toISOString()
      const existing = await database.foods.get(input.id)
      const food: Food = {
        id: input.id,
        name: input.name,
        brandName: input.brandName,
        servingQuantity: input.serving.quantity,
        servingUnit: input.serving.unit,
        servingDescription: input.serving.description,
        gramsPerServing: input.serving.gramsPerServing,
        ouncesPerServing: input.serving.ouncesPerServing,
        servingConversionReliable: input.serving.conversionReliable,
        servingConversionSource: input.serving.conversionSource,
        caloriesPerServing: macros.calories,
        proteinGramsPerServing: macros.proteinGrams,
        carbohydrateGramsPerServing: macros.carbohydrateGrams,
        fatGramsPerServing: macros.fatGrams,
        sourceType: 'provider',
        provider: input.source.provider,
        providerRecordId: input.source.providerRecordId,
        providerDataType: input.source.providerDataType,
        sourceName: input.source.sourceName,
        sourceUrl: input.source.sourceUrl,
        barcode: input.source.barcode,
        sourceUpdatedAt: input.source.sourceUpdatedAt,
        providerIngestedAt: input.source.ingestedAt,
        normalizerVersion: input.normalizerVersion,
        rawCookedStatus: input.rawCookedStatus,
        macroBasis: input.macroBasis,
        notes: existing?.notes ?? '',
        status: 'active',
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }

      validateFoodInput(food)
      await database.foods.put(food)
      return food
    },

    async updateFood(id: string, input: UpdateFoodInput) {
      const food = await database.foods.get(id)
      if (!food) {
        throw new Error(`Food ${id} was not found.`)
      }
      if (food.sourceType === 'provider') {
        throw new Error('Imported provider foods cannot be edited directly.')
      }
      const updated: Food = {
        ...food,
        ...input,
        id: food.id,
        name: (input.name ?? food.name).trim(),
        servingUnit: (input.servingUnit ?? food.servingUnit).trim(),
        servingDescription: '',
        status: food.status,
        createdAt: food.createdAt,
        updatedAt: new Date().toISOString(),
      }
      validateFoodInput(updated)
      const normalizedName = updated.name.trim().toLocaleLowerCase()
      const duplicate = await database.foods
        .where('status')
        .equals('active')
        .filter(
          (candidate) =>
            candidate.id !== id &&
            candidate.name.trim().toLocaleLowerCase() === normalizedName,
        )
        .first()
      if (duplicate) {
        throw new Error('A food with that name already exists.')
      }
      await database.foods.put(updated)
      return updated
    },

    async logExternalFood(input: LogExternalFoodInput) {
      const food = await repository.upsertProviderFood(input.food)
      return repository.logFood({
        foodId: food.id,
        localDate: input.localDate,
        servingMultiplier: input.servingMultiplier,
        notes: input.notes,
      })
    },

    async archiveFood(id: string) {
      await database.foods.update(id, {
        status: 'archived',
        updatedAt: new Date().toISOString(),
      })
    },

    async logFood(input: LogFoodInput) {
      validateServingMultiplier(input.servingMultiplier)
      const now = createMonotonicTimestamp()
      return database.transaction(
        'rw',
        database.foods,
        database.foodLogEntries,
        async () => {
          const food = await database.foods.get(input.foodId)
          if (!food) {
            throw new Error(`Food ${input.foodId} was not found.`)
          }

          const foodSnapshot = snapshotFood(food)
          const entry: FoodLogEntry = {
            id: createId(),
            localDate: input.localDate,
            foodId: food.id,
            foodSnapshot,
            servingMultiplier: input.servingMultiplier,
            ...computeLogTotals(foodSnapshot, input.servingMultiplier),
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

    async updateFoodLogEntry(id: string, input: UpdateFoodLogInput) {
      validateServingMultiplier(input.servingMultiplier)
      const existing = await database.foodLogEntries.get(id)
      if (!existing) {
        throw new Error(`Food log ${id} was not found.`)
      }

      const updated: FoodLogEntry = {
        ...existing,
        servingMultiplier: input.servingMultiplier,
        ...computeLogTotals(existing.foodSnapshot, input.servingMultiplier),
        notes: input.notes ?? existing.notes,
        updatedAt: new Date().toISOString(),
      }
      await database.foodLogEntries.put(updated)
      return updated
    },

    async deleteFoodLogEntry(id: string) {
      await database.foodLogEntries.delete(id)
    },

    getFood(id: string) {
      return database.foods.get(id)
    },

    listFoods() {
      return database.foods.orderBy('name').toArray()
    },

    async searchFoods(query: string, limit = 25) {
      const normalizedQuery = query.trim().toLocaleLowerCase()
      const foods = await database.foods
        .where('status')
        .equals('active')
        .toArray()

      if (!normalizedQuery) {
        return foods
          .sort((left, right) => left.name.localeCompare(right.name))
          .slice(0, limit)
      }

      return foods
        .map((food) => {
          const normalizedName = food.name.toLocaleLowerCase()
          let rank = Number.POSITIVE_INFINITY
          if (normalizedName === normalizedQuery) {
            rank = 0
          } else if (normalizedName.startsWith(normalizedQuery)) {
            rank = 1
          } else {
            const index = normalizedName.indexOf(normalizedQuery)
            if (index >= 0) {
              rank = 2 + index / 100
            }
          }

          return { food, rank }
        })
        .filter((result) => Number.isFinite(result.rank))
        .sort(
          (left, right) =>
            left.rank - right.rank ||
            left.food.name.localeCompare(right.food.name),
        )
        .slice(0, limit)
        .map((result) => result.food)
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

    async listRecentFoods(limit = 5) {
      const logs = await database.foodLogEntries
        .orderBy('createdAt')
        .reverse()
        .toArray()
      const foods = new Map<string, Food>()

      for (const log of logs) {
        if (!log.foodId || foods.has(log.foodId)) {
          continue
        }

        const food = await database.foods.get(log.foodId)
        if (food?.status === 'active') {
          foods.set(food.id, food)
        }

        if (foods.size >= limit) {
          break
        }
      }

      return Array.from(foods.values())
    },
  }

  return repository
}

export const foodRepository = createFoodRepository()
