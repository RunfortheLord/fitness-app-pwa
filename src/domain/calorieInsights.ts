import { addLocalDays, type LocalDateString } from '@domain/dates'

export type CalorieInsightsRange = '1w' | '1m' | '3m'

export type CalorieInsightDay = {
  localDate: LocalDateString
  loggedCalories: number
  targetCalories: number
}

export type CalorieBalance = 'surplus' | 'deficit' | 'on_target'

export type CalorieInsightsSummary = {
  daysLogged: number
  daysInRange: number
  consistencyPercentage: number
  averageLoggedCalories: number | null
  averageTargetCalories: number | null
  averageDailyCalorieDifference: number | null
  calorieBalance: CalorieBalance | null
}

export type CalorieInsights = {
  range: CalorieInsightsRange
  startDate: LocalDateString
  endDate: LocalDateString
  days: CalorieInsightDay[]
  summary: CalorieInsightsSummary
}

// Month labels intentionally use the same fixed calendar-day windows as the
// calorie history graph: 1M is 30 days and 3M is 90 days, both including today.
export const CALORIE_INSIGHTS_RANGE_DAYS: Record<CalorieInsightsRange, number> =
  {
    '1w': 7,
    '1m': 30,
    '3m': 90,
  }

/**
 * Creates a deterministic calorie-insights model from daily history rows.
 *
 * Logging consistency is coverage, not adherence to the calorie target. Since
 * a zero-filled history row cannot distinguish no log from a zero-calorie food,
 * only a finite positive calorie total counts as a logged day. Target comparison
 * likewise requires a finite positive target. With no comparable days, the
 * averages and classification remain null rather than implying "on target."
 */
export function createCalorieInsights({
  history,
  range,
  today,
}: {
  history: readonly CalorieInsightDay[]
  range: CalorieInsightsRange
  today: LocalDateString
}): CalorieInsights {
  const daysInRange = CALORIE_INSIGHTS_RANGE_DAYS[range]
  const startDate = addLocalDays(today, -(daysInRange - 1))
  const days = history
    .filter((day) => day.localDate >= startDate && day.localDate <= today)
    .sort((left, right) => left.localDate.localeCompare(right.localDate))
  const loggedDays = days.filter((day) => isPositive(day.loggedCalories))
  const comparableDays = loggedDays.filter((day) =>
    isPositive(day.targetCalories),
  )
  const comparableTotals = comparableDays.reduce(
    (totals, day) => ({
      loggedCalories: totals.loggedCalories + day.loggedCalories,
      targetCalories: totals.targetCalories + day.targetCalories,
    }),
    { loggedCalories: 0, targetCalories: 0 },
  )
  const averageLoggedCalories = comparableDays.length
    ? comparableTotals.loggedCalories / comparableDays.length
    : null
  const averageTargetCalories = comparableDays.length
    ? comparableTotals.targetCalories / comparableDays.length
    : null
  // Preserve the exact arithmetic mean; presentation can choose its own calorie
  // precision without changing whether the signed result is above or below zero.
  const averageDailyCalorieDifference = comparableDays.length
    ? (comparableTotals.loggedCalories - comparableTotals.targetCalories) /
      comparableDays.length
    : null

  return {
    range,
    startDate,
    endDate: today,
    days,
    summary: {
      daysLogged: loggedDays.length,
      daysInRange,
      // Whole percentages keep the summary stable and readable. This is the
      // nearest integer, so 2 of 7 logged days is reported as 29%.
      consistencyPercentage: Math.round(
        (loggedDays.length / daysInRange) * 100,
      ),
      averageLoggedCalories,
      averageTargetCalories,
      averageDailyCalorieDifference,
      calorieBalance: classifyCalorieBalance(averageDailyCalorieDifference),
    },
  }
}

function classifyCalorieBalance(
  averageDailyCalorieDifference: number | null,
): CalorieBalance | null {
  if (averageDailyCalorieDifference === null) {
    return null
  }
  if (averageDailyCalorieDifference > 0) {
    return 'surplus'
  }
  if (averageDailyCalorieDifference < 0) {
    return 'deficit'
  }
  // There is intentionally no arbitrary tolerance band: only an exact average
  // difference of zero is classified as on target.
  return 'on_target'
}

function isPositive(value: number) {
  return Number.isFinite(value) && value > 0
}
