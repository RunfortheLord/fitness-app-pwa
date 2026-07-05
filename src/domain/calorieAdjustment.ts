import { sortBodyweightEntries } from '@domain/bodyweightProgress'
import { currentTrendWeight, weeklyTrendSlope } from '@domain/bodyweightTrend'
import { addLocalDays, type LocalDateString } from '@domain/dates'
import {
  CALORIES_PER_POUND,
  MIN_GOAL_CALORIES,
  computeMacroTargets,
} from '@domain/goalMacros'
import type {
  BodyweightEntry,
  NutritionGoal,
  NutritionTargetValues,
} from '@shared-types/app'

// Trailing trend-weight window analysed for a manual update.
export const ADJUSTMENT_WINDOW_DAYS = 14
export const ADJUSTMENT_INTAKE_LOOKBACK_DAYS = 28
// Minimum observed measurements and calendar span required before any change is
// made. Interpolated daily trend points do not satisfy the measurement minimum.
export const ADJUSTMENT_MIN_POINTS = 3
export const ADJUSTMENT_MIN_SPAN_DAYS = 7
export const ADJUSTMENT_MIN_INTAKE_DAYS = 7
export const ADJUSTMENT_MIN_INTAKE_SPAN_DAYS = 7
// A change is rounded to this increment, capped at this magnitude, and treated
// as no change when smaller than the deadband.
export const ADJUSTMENT_ROUNDING_KCAL = 25
export const ADJUSTMENT_MAX_KCAL = 200
export const ADJUSTMENT_DEADBAND_KCAL = 50

/**
 * Rounds a raw daily calorie adjustment to a practical, bounded value: zero
 * within the deadband, otherwise rounded to {@link ADJUSTMENT_ROUNDING_KCAL} and
 * clamped to ±{@link ADJUSTMENT_MAX_KCAL}.
 */
export function roundCalorieAdjustment(rawKcal: number): number {
  if (
    !Number.isFinite(rawKcal) ||
    Math.abs(rawKcal) < ADJUSTMENT_DEADBAND_KCAL
  ) {
    return 0
  }
  const rounded =
    Math.round(rawKcal / ADJUSTMENT_ROUNDING_KCAL) * ADJUSTMENT_ROUNDING_KCAL
  return Math.max(-ADJUSTMENT_MAX_KCAL, Math.min(ADJUSTMENT_MAX_KCAL, rounded))
}

export type DailyCalorieAdjustmentData = {
  localDate: LocalDateString
  loggedCalories: number
  targetCalories: number
}

export type CalorieUpdateEvaluation =
  | { status: 'insufficient_data' }
  | { status: 'already_applied' }
  | {
      status: 'no_change'
      estimatedMaintenanceCalories: number
      averageLoggedCalories: number
      averageTargetCalories: number
      intakeDayCount: number
      observedWeeklyChangeLb: number
      trendWeightLb: number
      signature: string
    }
  | {
      status: 'changed'
      deltaKcal: number
      newCalories: number
      newMaintenanceCalories: number
      estimatedMaintenanceCalories: number
      averageLoggedCalories: number
      averageTargetCalories: number
      intakeDayCount: number
      newTargets: NutritionTargetValues
      observedWeeklyChangeLb: number
      trendWeightLb: number
      signature: string
    }

/**
 * Decides whether the goal's calorie target should change based on recent trend
 * weight. Pure and deterministic: it never mutates state and only suggests a
 * change after enough robust trend data exists. Re-running with the same trend
 * data yields a stable signature so callers can avoid duplicate updates.
 */
export function evaluateCalorieUpdate(input: {
  goal: NutritionGoal
  entries: BodyweightEntry[]
  dailyCalories: DailyCalorieAdjustmentData[]
  asOf: LocalDateString
}): CalorieUpdateEvaluation {
  const slope = weeklyTrendSlope(input.entries, {
    asOf: input.asOf,
    windowDays: ADJUSTMENT_WINDOW_DAYS,
  })

  if (
    !slope ||
    slope.measurementCount < ADJUSTMENT_MIN_POINTS ||
    slope.spanDays < ADJUSTMENT_MIN_SPAN_DAYS
  ) {
    return { status: 'insufficient_data' }
  }

  const trendWeightLb = currentTrendWeight(input.entries)
  if (trendWeightLb === null) {
    return { status: 'insufficient_data' }
  }

  const intake = summarizeRecentIntake(input.dailyCalories, input.asOf)
  if (
    !intake ||
    intake.dayCount < ADJUSTMENT_MIN_INTAKE_DAYS ||
    intake.spanDays < ADJUSTMENT_MIN_INTAKE_SPAN_DAYS
  ) {
    return { status: 'insufficient_data' }
  }

  const observedWeeklyChangeLb = slope.weeklyChangeLb
  const signature = buildSignature(
    input.entries,
    observedWeeklyChangeLb,
    intake,
  )

  if (input.goal.lastCalorieUpdate?.signature === signature) {
    return { status: 'already_applied' }
  }

  const observedDailyWeightCalories =
    (observedWeeklyChangeLb * CALORIES_PER_POUND) / 7
  const desiredDailyWeightCalories =
    (input.goal.weeklyRateLb * CALORIES_PER_POUND) / 7
  const estimatedMaintenanceCalories = Math.max(
    MIN_GOAL_CALORIES,
    Math.round(intake.averageLoggedCalories - observedDailyWeightCalories),
  )
  const estimatedGoalCalories = Math.max(
    MIN_GOAL_CALORIES,
    Math.round(estimatedMaintenanceCalories + desiredDailyWeightCalories),
  )

  const currentCalories = input.goal.targets.calories
  const targetBaselineCalories =
    intake.averageTargetCalories > 0
      ? intake.averageTargetCalories
      : currentCalories
  const deltaKcal = roundCalorieAdjustment(
    estimatedGoalCalories - targetBaselineCalories,
  )
  const newCalories = Math.max(MIN_GOAL_CALORIES, currentCalories + deltaKcal)
  const effectiveDelta = newCalories - currentCalories

  if (deltaKcal === 0 || effectiveDelta === 0) {
    return {
      status: 'no_change',
      estimatedMaintenanceCalories,
      averageLoggedCalories: intake.averageLoggedCalories,
      averageTargetCalories: intake.averageTargetCalories,
      intakeDayCount: intake.dayCount,
      observedWeeklyChangeLb,
      trendWeightLb,
      signature,
    }
  }

  return {
    status: 'changed',
    deltaKcal: effectiveDelta,
    newCalories,
    newMaintenanceCalories: Math.max(
      MIN_GOAL_CALORIES,
      input.goal.maintenanceCalories + effectiveDelta,
    ),
    estimatedMaintenanceCalories,
    averageLoggedCalories: intake.averageLoggedCalories,
    averageTargetCalories: intake.averageTargetCalories,
    intakeDayCount: intake.dayCount,
    newTargets: computeMacroTargets(newCalories, trendWeightLb),
    observedWeeklyChangeLb,
    trendWeightLb,
    signature,
  }
}

/**
 * Builds a stable fingerprint of the trend data so the same unchanged data does
 * not apply the same adjustment twice.
 */
function buildSignature(
  entries: BodyweightEntry[],
  observedWeeklyChangeLb: number,
  intake: RecentIntakeSummary,
): string {
  const sorted = sortBodyweightEntries(entries)
  const latest = sorted.at(-1)
  const latestKey = latest ? `${latest.localDate}:${latest.updatedAt}` : 'none'
  const intakeKey = intake.days
    .map(
      (day) =>
        `${day.localDate}:${Math.round(day.loggedCalories)}:${Math.round(day.targetCalories)}`,
    )
    .join('|')
  return `${latestKey}:${sorted.length}:${observedWeeklyChangeLb.toFixed(3)}:${intakeKey}`
}

type RecentIntakeSummary = {
  averageLoggedCalories: number
  averageTargetCalories: number
  dayCount: number
  spanDays: number
  days: DailyCalorieAdjustmentData[]
}

function summarizeRecentIntake(
  dailyCalories: DailyCalorieAdjustmentData[],
  asOf: LocalDateString,
): RecentIntakeSummary | null {
  const start = addLocalDays(asOf, -ADJUSTMENT_INTAKE_LOOKBACK_DAYS)
  const completeLoggedDays = dailyCalories
    .filter(
      (day) =>
        day.localDate < asOf &&
        day.localDate >= start &&
        Number.isFinite(day.loggedCalories) &&
        day.loggedCalories > 0,
    )
    .sort((left, right) => left.localDate.localeCompare(right.localDate))

  const first = completeLoggedDays[0]
  const latest = completeLoggedDays.at(-1)
  if (!first || !latest) {
    return null
  }

  const totalLoggedCalories = completeLoggedDays.reduce(
    (total, day) => total + day.loggedCalories,
    0,
  )
  const totalTargetCalories = completeLoggedDays.reduce(
    (total, day) => total + day.targetCalories,
    0,
  )

  return {
    averageLoggedCalories: totalLoggedCalories / completeLoggedDays.length,
    averageTargetCalories: totalTargetCalories / completeLoggedDays.length,
    dayCount: completeLoggedDays.length,
    spanDays:
      localDateDayNumber(latest.localDate) -
      localDateDayNumber(first.localDate),
    days: completeLoggedDays,
  }
}

function localDateDayNumber(localDate: LocalDateString): number {
  return Math.round(new Date(`${localDate}T00:00:00`).getTime() / 86_400_000)
}
