import { db, type TrainingLogDatabase } from '@db/database'
import { parseLocalDate, type LocalDateString } from '@domain/dates'
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
      const [settings, targetHistory, logs] = await Promise.all([
        database.userSettings.get('settings'),
        database.nutritionTargets.toArray(),
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
      const targetDate = parseLocalDate(localDate)
      targetDate.setHours(23, 59, 59, 999)
      const historicalTarget = targetHistory
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        .filter(
          (target) =>
            new Date(target.createdAt).getTime() <= targetDate.getTime(),
        )
        .at(-1)
      const targets =
        historicalTarget ?? settings?.nutritionTargets ?? zeroTargets

      return {
        totals,
        targets,
        remainingCalories: targets.calories - totals.calories,
      }
    },
  }
}

export const nutritionSummaryService = createNutritionSummaryService()
