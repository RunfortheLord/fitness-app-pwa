import { db, type TrainingLogDatabase } from '@db/database'
import {
  addLocalDays,
  parseLocalDate,
  type LocalDateString,
} from '@domain/dates'
import { dailyNutritionCloudService } from '@services/dailyNutritionCloudService'

export type CalorieHistoryRange = '1w' | '1m' | '3m'

export type DailyCalorieHistory = {
  localDate: LocalDateString
  loggedCalories: number
  targetCalories: number
}

const rangeDays: Record<CalorieHistoryRange, number> = {
  '1w': 7,
  '1m': 30,
  '3m': 90,
}

export function createCalorieHistoryService(
  database: TrainingLogDatabase = db,
  options: { syncToCloud?: boolean } = {},
) {
  return {
    async getHistory(
      endDate: LocalDateString,
      range: CalorieHistoryRange,
    ): Promise<DailyCalorieHistory[]> {
      const dates = createDateRange(endDate, rangeDays[range])
      const startDate = dates[0]
      const [logs, targets, settings] = await Promise.all([
        database.foodLogEntries
          .where('localDate')
          .between(startDate, endDate, true, true)
          .toArray(),
        database.nutritionTargets.orderBy('updatedAt').toArray(),
        database.userSettings.get('settings'),
      ])

      const caloriesByDate = new Map<LocalDateString, number>()
      for (const log of logs) {
        caloriesByDate.set(
          log.localDate,
          (caloriesByDate.get(log.localDate) ?? 0) + log.computedCalories,
        )
      }

      const sortedTargets = [...targets].sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt),
      )
      const history = dates.map((localDate) => {
        const dayEnd = parseLocalDate(localDate)
        dayEnd.setHours(23, 59, 59, 999)
        const target = sortedTargets
          .filter(
            (candidate) =>
              new Date(candidate.createdAt).getTime() <= dayEnd.getTime(),
          )
          .at(-1)

        return {
          localDate,
          loggedCalories: caloriesByDate.get(localDate) ?? 0,
          targetCalories:
            target?.calories ??
            (sortedTargets.length === 0
              ? (settings?.nutritionTargets.calories ?? 0)
              : 0),
        }
      })

      if (options.syncToCloud !== false) {
        // Cloud persistence is supplementary. A network or Supabase failure
        // must not make the local-first graph unavailable.
        try {
          await dailyNutritionCloudService.sync(history)
        } catch {
          return history
        }
      }

      return history
    },
  }
}

function createDateRange(
  endDate: LocalDateString,
  numberOfDays: number,
): LocalDateString[] {
  const startDate = addLocalDays(endDate, -(numberOfDays - 1))
  return Array.from({ length: numberOfDays }, (_, index) =>
    addLocalDays(startDate, index),
  )
}

export const calorieHistoryService = createCalorieHistoryService()
