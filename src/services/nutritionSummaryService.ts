import { db, type TrainingLogDatabase } from '@db/database'
import type { LocalDateString } from '@domain/dates'
import type { NutritionTargetValues } from '@shared-types/app'

export type DailyNutritionSummary = {
  totals: NutritionTargetValues
  targets: NutritionTargetValues
  remainingCalories: number
}

const zeroTargets: NutritionTargetValues = {
  calories: 0,
  proteinGrams: 0,
  carbohydrateGrams: 0,
  fatGrams: 0,
}

export function createNutritionSummaryService(
  database: TrainingLogDatabase = db,
) {
  return {
    async getDailySummary(
      localDate: LocalDateString,
    ): Promise<DailyNutritionSummary> {
      const [settings, logs] = await Promise.all([
        database.userSettings.get('settings'),
        database.foodLogEntries.where({ localDate }).toArray(),
      ])

      const totals = logs.reduce<NutritionTargetValues>(
        (summary, log) => ({
          calories: summary.calories + log.computedCalories,
          proteinGrams: summary.proteinGrams + log.computedProteinGrams,
          carbohydrateGrams:
            summary.carbohydrateGrams + log.computedCarbohydrateGrams,
          fatGrams: summary.fatGrams + log.computedFatGrams,
        }),
        { ...zeroTargets },
      )
      const targets = settings?.nutritionTargets ?? zeroTargets

      return {
        totals,
        targets,
        remainingCalories: Math.max(0, targets.calories - totals.calories),
      }
    },
  }
}

export const nutritionSummaryService = createNutritionSummaryService()
