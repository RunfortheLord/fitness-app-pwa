import { sortBodyweightEntries } from '@domain/bodyweightProgress'
import {
  currentTrendWeight,
  weeklyTimeAwareTrendChange,
} from '@domain/bodyweightTrend'
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

// The recent signal responds to current behavior while the longer signal
// stabilizes the estimate as consistent history accumulates.
export const ADJUSTMENT_RECENT_WINDOW_DAYS = 28
export const ADJUSTMENT_HISTORY_WINDOW_DAYS = 90
export const ADJUSTMENT_RECENT_HALF_LIFE_DAYS = 14
export const ADJUSTMENT_HISTORY_HALF_LIFE_DAYS = 42
export const ADJUSTMENT_MAX_HISTORY_INFLUENCE = 0.5
export const ADJUSTMENT_HISTORY_FULL_INTAKE_DAYS = 60
export const ADJUSTMENT_HISTORY_FULL_SPAN_DAYS = 70
export const ADJUSTMENT_HISTORY_FULL_WEIGHT_POINTS = 12
// Minimum observed measurements and calendar span required before any change is
// made.
export const ADJUSTMENT_MIN_POINTS = 3
export const ADJUSTMENT_MIN_SPAN_DAYS = 7
export const ADJUSTMENT_MIN_INTAKE_DAYS = 7
export const ADJUSTMENT_MIN_INTAKE_SPAN_DAYS = 7

/**
 * Rounds a raw daily calorie adjustment to the nearest whole calorie.
 */
export function roundCalorieAdjustment(rawKcal: number): number {
  if (!Number.isFinite(rawKcal)) {
    return 0
  }
  return Math.round(rawKcal)
}

export type DailyCalorieAdjustmentData = {
  localDate: LocalDateString
  loggedCalories: number
  targetCalories: number
}

export type AdaptiveMaintenanceEstimate = {
  estimatedMaintenanceCalories: number
  recentMaintenanceCalories: number
  historicalMaintenanceCalories: number
  historyInfluence: number
  estimateConfidence: CalorieEstimateConfidence
  recentAverageLoggedCalories: number
  recentAverageTargetCalories: number
  recentIntakeDayCount: number
  historyIntakeDayCount: number
  historySpanDays: number
  recentObservedWeeklyChangeLb: number
  historicalObservedWeeklyChangeLb: number
  historyWeightPointCount: number
  trendWeightLb: number
}

export type CalorieEstimateConfidence = 'developing' | 'moderate' | 'strong'

/**
 * Estimates maintenance from a responsive 28-day signal and a stabilizing
 * 90-day signal. Both intake averages and weight regressions are recency
 * weighted. The historical estimate gains influence only as calorie coverage,
 * calendar span, and weigh-in count accumulate, up to 50% of the blend.
 */
export function estimateAdaptiveMaintenance(input: {
  entries: BodyweightEntry[]
  dailyCalories: DailyCalorieAdjustmentData[]
  asOf: LocalDateString
}): AdaptiveMaintenanceEstimate | null {
  const eligibleEntries = input.entries.filter(
    (entry) => entry.localDate <= input.asOf,
  )
  const recentIntake = summarizeWeightedIntake(
    input.dailyCalories,
    input.asOf,
    ADJUSTMENT_RECENT_WINDOW_DAYS,
    ADJUSTMENT_RECENT_HALF_LIFE_DAYS,
  )
  const historicalIntake = summarizeWeightedIntake(
    input.dailyCalories,
    input.asOf,
    ADJUSTMENT_HISTORY_WINDOW_DAYS,
    ADJUSTMENT_HISTORY_HALF_LIFE_DAYS,
  )
  const recentTrend = weeklyTimeAwareTrendChange(eligibleEntries, {
    asOf: input.asOf,
    lookbackDays: ADJUSTMENT_RECENT_WINDOW_DAYS,
    halfLifeDays: ADJUSTMENT_RECENT_HALF_LIFE_DAYS,
  })
  const historicalTrend = weeklyTimeAwareTrendChange(eligibleEntries, {
    asOf: input.asOf,
    lookbackDays: ADJUSTMENT_HISTORY_WINDOW_DAYS,
    halfLifeDays: ADJUSTMENT_HISTORY_HALF_LIFE_DAYS,
  })
  const trendWeightLb = currentTrendWeight(eligibleEntries)

  if (
    !recentIntake ||
    !historicalIntake ||
    !recentTrend ||
    !historicalTrend ||
    trendWeightLb === null ||
    recentIntake.dayCount < ADJUSTMENT_MIN_INTAKE_DAYS ||
    recentIntake.spanDays < ADJUSTMENT_MIN_INTAKE_SPAN_DAYS ||
    recentTrend.pointCount < ADJUSTMENT_MIN_POINTS ||
    recentTrend.spanDays < ADJUSTMENT_MIN_SPAN_DAYS
  ) {
    return null
  }

  const recentMaintenanceCalories =
    recentIntake.averageLoggedCalories -
    (recentTrend.weeklyChangeLb * CALORIES_PER_POUND) / 7
  const historicalMaintenanceCalories =
    historicalIntake.averageLoggedCalories -
    (historicalTrend.weeklyChangeLb * CALORIES_PER_POUND) / 7
  const historyReadiness = historicalReadiness({
    intakeDayCount: historicalIntake.dayCount,
    intakeSpanDays: historicalIntake.spanDays,
    weightPointCount: historicalTrend.pointCount,
    weightSpanDays: historicalTrend.spanDays,
  })
  const historyInfluence = historyReadiness * ADJUSTMENT_MAX_HISTORY_INFLUENCE
  const blendedMaintenanceCalories =
    recentMaintenanceCalories * (1 - historyInfluence) +
    historicalMaintenanceCalories * historyInfluence

  return {
    estimatedMaintenanceCalories: Math.max(
      MIN_GOAL_CALORIES,
      Math.round(blendedMaintenanceCalories),
    ),
    recentMaintenanceCalories: Math.round(recentMaintenanceCalories),
    historicalMaintenanceCalories: Math.round(historicalMaintenanceCalories),
    historyInfluence,
    estimateConfidence: estimateConfidence(historyReadiness),
    recentAverageLoggedCalories: recentIntake.averageLoggedCalories,
    recentAverageTargetCalories: recentIntake.averageTargetCalories,
    recentIntakeDayCount: recentIntake.dayCount,
    historyIntakeDayCount: historicalIntake.dayCount,
    historySpanDays: historicalIntake.spanDays,
    recentObservedWeeklyChangeLb: recentTrend.weeklyChangeLb,
    historicalObservedWeeklyChangeLb: historicalTrend.weeklyChangeLb,
    historyWeightPointCount: historicalTrend.pointCount,
    trendWeightLb,
  }
}

export type CalorieUpdateEvaluation =
  | { status: 'insufficient_data' }
  | {
      status: 'already_applied'
      estimateConfidence: CalorieEstimateConfidence
    }
  | {
      status: 'no_change'
      estimatedMaintenanceCalories: number
      averageLoggedCalories: number
      averageTargetCalories: number
      intakeDayCount: number
      observedWeeklyChangeLb: number
      trendWeightLb: number
      estimateConfidence: CalorieEstimateConfidence
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
      estimateConfidence: CalorieEstimateConfidence
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
  const maintenance = estimateAdaptiveMaintenance(input)
  if (!maintenance) {
    return { status: 'insufficient_data' }
  }

  const {
    estimatedMaintenanceCalories,
    recentAverageLoggedCalories: averageLoggedCalories,
    recentAverageTargetCalories: averageTargetCalories,
    recentIntakeDayCount: intakeDayCount,
    recentObservedWeeklyChangeLb: observedWeeklyChangeLb,
    trendWeightLb,
  } = maintenance
  const signature = buildSignature(
    input.entries,
    input.dailyCalories,
    input.asOf,
    maintenance,
  )

  if (input.goal.lastCalorieUpdate?.signature === signature) {
    return {
      status: 'already_applied',
      estimateConfidence: maintenance.estimateConfidence,
    }
  }

  const desiredWeeklyChangeLb = desiredWeeklyChangeTowardGoal(
    input.goal,
    trendWeightLb,
  )
  const desiredDailyWeightCalories =
    (desiredWeeklyChangeLb * CALORIES_PER_POUND) / 7
  const estimatedGoalCalories = Math.max(
    MIN_GOAL_CALORIES,
    Math.round(estimatedMaintenanceCalories + desiredDailyWeightCalories),
  )

  const currentCalories = input.goal.targets.calories
  const deltaKcal = roundCalorieAdjustment(
    estimatedGoalCalories - currentCalories,
  )
  const newCalories = Math.max(MIN_GOAL_CALORIES, currentCalories + deltaKcal)
  const effectiveDelta = newCalories - currentCalories

  if (deltaKcal === 0 || effectiveDelta === 0) {
    return {
      status: 'no_change',
      estimatedMaintenanceCalories,
      averageLoggedCalories,
      averageTargetCalories,
      intakeDayCount,
      observedWeeklyChangeLb,
      trendWeightLb,
      estimateConfidence: maintenance.estimateConfidence,
      signature,
    }
  }

  return {
    status: 'changed',
    deltaKcal: effectiveDelta,
    newCalories,
    newMaintenanceCalories: estimatedMaintenanceCalories,
    estimatedMaintenanceCalories,
    averageLoggedCalories,
    averageTargetCalories,
    intakeDayCount,
    newTargets: computeMacroTargets(newCalories, trendWeightLb),
    observedWeeklyChangeLb,
    trendWeightLb,
    estimateConfidence: maintenance.estimateConfidence,
    signature,
  }
}

/**
 * Keeps the selected rate magnitude but derives its direction from the
 * remaining distance to the desired weight. Once trend weight is within the
 * goal threshold, the update estimates maintenance instead of continuing a
 * deficit or surplus past the goal.
 */
function desiredWeeklyChangeTowardGoal(
  goal: NutritionGoal,
  trendWeightLb: number,
): number {
  const remainingLb = goal.goalWeightLb - trendWeightLb
  if (Math.abs(remainingLb) < 0.5) {
    return 0
  }
  const magnitude = Math.abs(goal.weeklyRateLb)
  return remainingLb < 0 ? -magnitude : magnitude
}

/**
 * Builds a stable fingerprint of the trend data so the same unchanged data does
 * not apply the same adjustment twice.
 */
function buildSignature(
  entries: BodyweightEntry[],
  dailyCalories: DailyCalorieAdjustmentData[],
  asOf: LocalDateString,
  maintenance: AdaptiveMaintenanceEstimate,
): string {
  const start = addLocalDays(asOf, -ADJUSTMENT_HISTORY_WINDOW_DAYS)
  const weightKey = sortBodyweightEntries(entries)
    .filter((entry) => entry.localDate >= start && entry.localDate <= asOf)
    .map(
      (entry) =>
        `${entry.localDate}:${entry.weight.toFixed(3)}:${entry.updatedAt}`,
    )
    .join('|')
  const intakeKey = dailyCalories
    .filter(
      (day) =>
        day.localDate < asOf &&
        day.localDate >= start &&
        Number.isFinite(day.loggedCalories) &&
        day.loggedCalories > 0,
    )
    .sort((left, right) => left.localDate.localeCompare(right.localDate))
    .map(
      (day) =>
        `${day.localDate}:${day.loggedCalories.toFixed(3)}:${day.targetCalories.toFixed(3)}`,
    )
    .join('|')
  return [
    maintenance.recentObservedWeeklyChangeLb.toFixed(4),
    maintenance.historicalObservedWeeklyChangeLb.toFixed(4),
    maintenance.historyInfluence.toFixed(4),
    weightKey,
    intakeKey,
  ].join(':')
}

type WeightedIntakeSummary = {
  averageLoggedCalories: number
  averageTargetCalories: number
  dayCount: number
  spanDays: number
  days: DailyCalorieAdjustmentData[]
}

function summarizeWeightedIntake(
  dailyCalories: DailyCalorieAdjustmentData[],
  asOf: LocalDateString,
  lookbackDays: number,
  halfLifeDays: number,
): WeightedIntakeSummary | null {
  if (!(lookbackDays > 0) || !(halfLifeDays > 0)) {
    return null
  }
  const start = addLocalDays(asOf, -lookbackDays)
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

  const asOfDay = localDateDayNumber(asOf)
  let totalWeight = 0
  let weightedLoggedCalories = 0
  let weightedTargetCalories = 0
  for (const day of completeLoggedDays) {
    const daysAgo = Math.max(0, asOfDay - localDateDayNumber(day.localDate))
    const weight = Math.pow(2, -daysAgo / halfLifeDays)
    totalWeight += weight
    weightedLoggedCalories += day.loggedCalories * weight
    weightedTargetCalories +=
      (Number.isFinite(day.targetCalories) ? day.targetCalories : 0) * weight
  }
  if (!(totalWeight > 0)) {
    return null
  }

  return {
    averageLoggedCalories: weightedLoggedCalories / totalWeight,
    averageTargetCalories: weightedTargetCalories / totalWeight,
    dayCount: completeLoggedDays.length,
    spanDays:
      localDateDayNumber(latest.localDate) -
      localDateDayNumber(first.localDate),
    days: completeLoggedDays,
  }
}

function historicalReadiness(input: {
  intakeDayCount: number
  intakeSpanDays: number
  weightPointCount: number
  weightSpanDays: number
}): number {
  const readiness = Math.min(
    progressTowardHistory(
      input.intakeDayCount,
      ADJUSTMENT_MIN_INTAKE_DAYS,
      ADJUSTMENT_HISTORY_FULL_INTAKE_DAYS,
    ),
    progressTowardHistory(
      input.intakeSpanDays,
      ADJUSTMENT_MIN_INTAKE_SPAN_DAYS,
      ADJUSTMENT_HISTORY_FULL_SPAN_DAYS,
    ),
    progressTowardHistory(
      input.weightPointCount,
      ADJUSTMENT_MIN_POINTS,
      ADJUSTMENT_HISTORY_FULL_WEIGHT_POINTS,
    ),
    progressTowardHistory(
      input.weightSpanDays,
      ADJUSTMENT_MIN_SPAN_DAYS,
      ADJUSTMENT_HISTORY_FULL_SPAN_DAYS,
    ),
  )
  return readiness
}

function estimateConfidence(
  historyReadiness: number,
): CalorieEstimateConfidence {
  if (historyReadiness >= 0.8) {
    return 'strong'
  }
  if (historyReadiness >= 1 / 3) {
    return 'moderate'
  }
  return 'developing'
}

function progressTowardHistory(
  value: number,
  minimum: number,
  full: number,
): number {
  if (full <= minimum) {
    return value >= full ? 1 : 0
  }
  return Math.max(0, Math.min(1, (value - minimum) / (full - minimum)))
}

function localDateDayNumber(localDate: LocalDateString): number {
  return Math.round(new Date(`${localDate}T00:00:00`).getTime() / 86_400_000)
}
