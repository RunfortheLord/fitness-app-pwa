import {
  createCalorieInsights,
  type CalorieInsights,
  type CalorieInsightsRange,
} from '@domain/calorieInsights'
import type { LocalDateString } from '@domain/dates'
import { calorieHistoryService } from '@services/calorieHistoryService'

export type CalorieInsightsPageState =
  | { status: 'loading' }
  | { status: 'error'; requestKey: string }
  | {
      status: 'ready'
      insights: CalorieInsights
      requestKey: string
    }

const cache = new Map<string, CalorieInsightsPageState>()

export function getCachedCalorieInsightsPageData(requestKey: string) {
  return cache.get(requestKey)
}

export function setCachedCalorieInsightsPageData(
  requestKey: string,
  state: CalorieInsightsPageState,
) {
  cache.set(requestKey, state)
}

export function clearCachedCalorieInsightsPageData() {
  cache.clear()
}

export async function preloadCalorieInsightsPageData(
  endDate: LocalDateString,
  range: CalorieInsightsRange = '1w',
) {
  const requestKey = `${range}:${endDate}`
  const history = await calorieHistoryService.getHistory(endDate, range, {
    syncToCloud: false,
  })
  const state: CalorieInsightsPageState = {
    status: 'ready',
    requestKey,
    insights: createCalorieInsights({
      history,
      range,
      today: endDate,
    }),
  }
  setCachedCalorieInsightsPageData(requestKey, state)
  return state
}
