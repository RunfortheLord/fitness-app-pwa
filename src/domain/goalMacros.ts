import { addDays } from 'date-fns'

import type { NutritionTargetValues } from '@shared-types/app'

export type GoalSex = 'male' | 'female'

export type GoalActivityLevel =
  | 'sedentary'
  | 'lightly_active'
  | 'moderately_active'
  | 'heavily_active'

export type GoalDirection = 'cut' | 'bulk' | 'maintain'

// The Set Goal form intentionally collects only bodyweight, height, activity,
// goal weight, and sex (no age). The sex-aware Mifflin-St Jeor equation needs
// an age, so a fixed default is assumed and documented in docs/DECISIONS.md.
export const DEFAULT_GOAL_AGE_YEARS = 30

// Protein target per pound of bodyweight, per the product spec.
export const PROTEIN_GRAMS_PER_LB = 0.7

// Daily calorie offsets applied for a cut or a bulk relative to maintenance.
export const CUT_DAILY_DEFICIT = 500
export const BULK_DAILY_SURPLUS = 300

// Share of goal calories allocated to fat; the remainder after protein and fat
// becomes carbohydrates.
export const FAT_CALORIE_SHARE = 0.25

const CALORIES_PER_POUND = 3500
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
  ageYears?: number
}) {
  const ageYears = input.ageYears ?? DEFAULT_GOAL_AGE_YEARS
  const kg = input.weightLb * KG_PER_LB
  const cm = input.heightInches * CM_PER_INCH
  const base = 10 * kg + 6.25 * cm - 5 * ageYears
  return base + (input.sex === 'male' ? 5 : -161)
}

export type GoalPlanInput = {
  sex: GoalSex
  bodyweightLb: number
  heightFeet: number
  heightInches: number
  activityLevel: GoalActivityLevel
  goalWeightLb: number
  ageYears?: number
}

export type GoalPlan = {
  direction: GoalDirection
  maintenanceCalories: number
  goalCalories: number
  dailyCalorieDelta: number
  targets: NutritionTargetValues
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
 * Computes maintenance calories, goal calories, and macro targets from the
 * Set Goal inputs. Cutting applies a deficit, bulking a surplus; protein is
 * driven by bodyweight, fat by a fixed share of goal calories, and carbs take
 * the remainder.
 */
export function computeGoalPlan(input: GoalPlanInput): GoalPlan {
  const heightInches = input.heightFeet * 12 + input.heightInches
  const bmr = mifflinStJeorBmr({
    sex: input.sex,
    weightLb: input.bodyweightLb,
    heightInches,
    ageYears: input.ageYears,
  })
  const maintenanceCalories = bmr * activityMultiplier(input.activityLevel)
  const direction = goalDirection(input.bodyweightLb, input.goalWeightLb)
  const goalCalories =
    direction === 'cut'
      ? maintenanceCalories - CUT_DAILY_DEFICIT
      : direction === 'bulk'
        ? maintenanceCalories + BULK_DAILY_SURPLUS
        : maintenanceCalories

  const proteinGrams = Math.round(input.bodyweightLb * PROTEIN_GRAMS_PER_LB)
  const proteinCalories = proteinGrams * 4
  const fatCalories = goalCalories * FAT_CALORIE_SHARE
  const fatGrams = Math.round(fatCalories / 9)
  const carbCalories = goalCalories - proteinCalories - fatCalories
  const carbohydrateGrams = Math.max(0, Math.round(carbCalories / 4))

  return {
    direction,
    maintenanceCalories: Math.round(maintenanceCalories),
    goalCalories: Math.round(goalCalories),
    dailyCalorieDelta: Math.round(goalCalories - maintenanceCalories),
    targets: {
      calories: Math.round(goalCalories),
      proteinGrams,
      carbohydrateGrams,
      fatGrams,
    },
  }
}

/**
 * Estimates the date the trend weight reaches the goal weight, given the daily
 * calorie delta from maintenance. Returns null when the goal is already met or
 * the calorie delta does not move the weight toward the goal.
 */
export function estimateGoalDate(input: {
  currentWeightLb: number
  goalWeightLb: number
  dailyCalorieDelta: number
  from: Date
}): Date | null {
  const remainingLb = input.goalWeightLb - input.currentWeightLb
  if (Math.abs(remainingLb) < 0.5) {
    return null
  }
  const weeklyChangeLb = (input.dailyCalorieDelta * 7) / CALORIES_PER_POUND
  if (weeklyChangeLb === 0) {
    return null
  }
  const weeks = remainingLb / weeklyChangeLb
  if (weeks <= 0) {
    return null
  }
  return addDays(input.from, Math.round(weeks * 7))
}
