import { addDays } from 'date-fns'

import type {
  GoalActivityLevel,
  GoalDirection,
  GoalSex,
  NutritionTargetValues,
} from '@shared-types/app'

export type { GoalActivityLevel, GoalDirection, GoalSex }

/**
 * Identifies the calculation formula used for a goal so a stored goal stays
 * reproducible even if the equations change in a later release.
 */
export const GOAL_FORMULA_VERSION = 1

// Protein target per pound of calculation weight, per the product spec.
export const PROTEIN_GRAMS_PER_LB = 0.7

// Intended weekly bodyweight change as a fraction of current bodyweight.
export const CUT_WEEKLY_RATE_FRACTION = 0.005
export const BULK_WEEKLY_RATE_FRACTION = 0.0025

export type GoalRateRange = {
  minPercent: number
  maxPercent: number
  recommendedPercent: number
  stepPercent: number
}

export const GOAL_RATE_RANGES: Record<
  Exclude<GoalDirection, 'maintain'>,
  GoalRateRange
> = {
  cut: {
    minPercent: 0.25,
    maxPercent: 1,
    recommendedPercent: CUT_WEEKLY_RATE_FRACTION * 100,
    stepPercent: 0.05,
  },
  bulk: {
    minPercent: 0.1,
    maxPercent: 0.5,
    recommendedPercent: BULK_WEEKLY_RATE_FRACTION * 100,
    stepPercent: 0.05,
  },
}

// Share of goal calories allocated to fat; carbohydrates take the remainder.
export const FAT_CALORIE_SHARE = 0.25

// Energy used to translate a weekly weight change into a daily calorie delta.
export const CALORIES_PER_POUND = 3500

// Centralized guard so invalid input cannot create unusable calorie targets.
export const MIN_GOAL_CALORIES = 1200

const KG_PER_LB = 0.45359237
const CM_PER_INCH = 2.54

const ACTIVITY_MULTIPLIERS: Record<GoalActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  heavily_active: 1.725,
}

export function activityMultiplier(level: GoalActivityLevel) {
  return ACTIVITY_MULTIPLIERS[level]
}

export function mifflinStJeorBmr(input: {
  sex: GoalSex
  weightLb: number
  heightInches: number
  ageYears: number
}) {
  const kg = input.weightLb * KG_PER_LB
  const cm = input.heightInches * CM_PER_INCH
  const base = 10 * kg + 6.25 * cm - 5 * input.ageYears
  return base + (input.sex === 'male' ? 5 : -161)
}

export function goalDirection(
  bodyweightLb: number,
  goalWeightLb: number,
): GoalDirection {
  const difference = goalWeightLb - bodyweightLb
  if (Math.abs(difference) < 0.5) {
    return 'maintain'
  }
  return difference < 0 ? 'cut' : 'bulk'
}

/**
 * Intended weekly bodyweight change in pounds (negative for a cut, positive for
 * a bulk, zero for maintenance) based on a fraction of current bodyweight.
 */
export function weeklyRateLb(
  direction: GoalDirection,
  bodyweightLb: number,
): number {
  if (direction === 'cut') {
    return -bodyweightLb * CUT_WEEKLY_RATE_FRACTION
  }
  if (direction === 'bulk') {
    return bodyweightLb * BULK_WEEKLY_RATE_FRACTION
  }
  return 0
}

export function weeklyRateFromPercent(
  direction: GoalDirection,
  bodyweightLb: number,
  percentPerWeek: number,
): number {
  if (direction === 'maintain') {
    return 0
  }
  const magnitude = bodyweightLb * (percentPerWeek / 100)
  return direction === 'cut' ? -magnitude : magnitude
}

/**
 * Allocates calories into macro grams: protein from bodyweight, fat from a fixed
 * share of calories (protected against pushing carbs negative), and carbs as the
 * reconciled remainder. Shared by initial goal creation and manual updates.
 */
export function computeMacroTargets(
  calories: number,
  calculationWeightLb: number,
): NutritionTargetValues {
  const safeCalories = Math.max(0, Math.round(calories))
  const proteinGrams = Math.max(
    0,
    Math.round(calculationWeightLb * PROTEIN_GRAMS_PER_LB),
  )
  const proteinCalories = proteinGrams * 4
  const caloriesAfterProtein = Math.max(0, safeCalories - proteinCalories)
  // Fat takes its share of total calories, but never more than what remains
  // after protein, so carbohydrates can never be negative.
  const fatGrams = Math.max(
    0,
    Math.min(
      Math.round((safeCalories * FAT_CALORIE_SHARE) / 9),
      Math.floor(caloriesAfterProtein / 9),
    ),
  )
  const carbohydrateGrams = Math.max(
    0,
    Math.round((caloriesAfterProtein - fatGrams * 9) / 4),
  )

  return { calories: safeCalories, proteinGrams, carbohydrateGrams, fatGrams }
}

export type GoalPlanInput = {
  sex: GoalSex
  bodyweightLb: number
  heightFeet: number
  heightInches: number
  ageYears: number
  activityLevel: GoalActivityLevel
  goalWeightLb: number
  maintenanceCalories?: number
  direction?: GoalDirection
  weeklyRateLb?: number
}

export type GoalPlan = {
  direction: GoalDirection
  maintenanceCalories: number
  goalCalories: number
  dailyCalorieDelta: number
  weeklyRateLb: number
  targets: NutritionTargetValues
}

/**
 * Computes maintenance calories, goal calories, and macro targets from the Set
 * Goal inputs. The deficit/surplus is derived from a weekly rate that is a
 * fraction of current bodyweight, converted to a daily calorie delta.
 */
export function computeGoalPlan(input: GoalPlanInput): GoalPlan {
  const heightInches = input.heightFeet * 12 + input.heightInches
  const maintenanceCalories =
    typeof input.maintenanceCalories === 'number' &&
    Number.isFinite(input.maintenanceCalories)
      ? input.maintenanceCalories
      : mifflinStJeorBmr({
          sex: input.sex,
          weightLb: input.bodyweightLb,
          heightInches,
          ageYears: input.ageYears,
        }) * activityMultiplier(input.activityLevel)
  const direction =
    input.direction ?? goalDirection(input.bodyweightLb, input.goalWeightLb)
  const rateLb =
    input.weeklyRateLb ?? weeklyRateLb(direction, input.bodyweightLb)
  const dailyDelta = (rateLb * CALORIES_PER_POUND) / 7
  const goalCalories = Math.max(
    MIN_GOAL_CALORIES,
    Math.round(maintenanceCalories + dailyDelta),
  )

  return {
    direction,
    maintenanceCalories: Math.round(maintenanceCalories),
    goalCalories,
    dailyCalorieDelta: goalCalories - Math.round(maintenanceCalories),
    weeklyRateLb: rateLb,
    targets: computeMacroTargets(goalCalories, input.bodyweightLb),
  }
}

/**
 * Estimates the date the trend weight reaches the goal weight given the intended
 * weekly rate. Returns null when the goal is already met, the weights are equal,
 * or the rate does not move weight toward the goal (e.g. the trend has crossed
 * the goal).
 */
export function estimateGoalDate(input: {
  currentWeightLb: number
  goalWeightLb: number
  weeklyRateLb: number
  from: Date
}): Date | null {
  const remainingLb = input.goalWeightLb - input.currentWeightLb
  if (Math.abs(remainingLb) < 0.5) {
    return null
  }
  if (input.weeklyRateLb === 0) {
    return null
  }
  const weeks = remainingLb / input.weeklyRateLb
  if (!Number.isFinite(weeks) || weeks <= 0) {
    return null
  }
  return addDays(input.from, Math.round(weeks * 7))
}
