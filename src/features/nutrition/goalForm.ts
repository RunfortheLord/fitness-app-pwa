import { latestBodyweight } from '@domain/bodyweightProgress'
import { currentTrendWeight } from '@domain/bodyweightTrend'
import {
  MIN_GOAL_CALORIES,
  type GoalActivityLevel,
  type GoalPlanInput,
  type GoalSex,
} from '@domain/goalMacros'
import { weightInputToLb } from '@domain/weightUnits'
import type { BodyweightEntry, WeightUnit } from '@shared-types/app'

import { parseNonNegativeNumber, parsePositiveNumber } from './nutritionForms'

export const ACTIVITY_OPTIONS: { value: GoalActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'lightly_active', label: 'Lightly active' },
  { value: 'moderately_active', label: 'Moderately active' },
  { value: 'heavily_active', label: 'Heavily active' },
]

export type GoalFormState = {
  bodyweight: string
  heightFeet: string
  heightInches: string
  activityLevel: GoalActivityLevel
  goalWeight: string
  age: string
  sex: GoalSex
}

export type GoalMaintenanceMode = 'calculated' | 'manual'

export function goalCurrentWeight(entries: BodyweightEntry[]): number | null {
  const trend = currentTrendWeight(entries)
  if (trend !== null) {
    return trend
  }
  const latest = latestBodyweight(entries)
  return latest ? latest.weight : null
}

export function parseGoalForm(
  form: GoalFormState,
  unit: WeightUnit = 'lb',
  maintenanceMode: GoalMaintenanceMode = 'calculated',
  manualMaintenanceCalories = '',
): { ok: true; value: GoalPlanInput } | { ok: false; error: string } {
  // Bodyweight and goal weight are entered in the display unit; the macro math
  // works in canonical pounds, so convert before validating and computing.
  const bodyweightInput = parsePositiveNumber(form.bodyweight)
  const goalWeightInput = parsePositiveNumber(form.goalWeight)
  const bodyweightLb =
    bodyweightInput === null ? null : weightInputToLb(bodyweightInput, unit)
  const heightFeet = parseNonNegativeNumber(form.heightFeet)
  const heightInches = parseNonNegativeNumber(form.heightInches)
  const goalWeightLb =
    goalWeightInput === null ? null : weightInputToLb(goalWeightInput, unit)
  const ageYears = parsePositiveNumber(form.age)
  const maintenanceCalories =
    maintenanceMode === 'manual'
      ? parseMaintenanceCalories(manualMaintenanceCalories)
      : null

  if (bodyweightLb === null || bodyweightLb > 1500) {
    return { ok: false, error: 'Enter a realistic current body weight.' }
  }
  if (maintenanceMode === 'manual' && maintenanceCalories === null) {
    return { ok: false, error: 'Enter realistic maintenance calories.' }
  }
  if (
    maintenanceMode === 'calculated' &&
    (heightFeet === null || heightInches === null)
  ) {
    return { ok: false, error: 'Enter your height in feet and inches.' }
  }
  if (
    maintenanceMode === 'calculated' &&
    heightInches !== null &&
    heightInches >= 12
  ) {
    return { ok: false, error: 'Height inches must be between 0 and 11.' }
  }
  const totalInches = (heightFeet ?? 0) * 12 + (heightInches ?? 0)
  if (
    maintenanceMode === 'calculated' &&
    (totalInches <= 0 || totalInches > 96)
  ) {
    return { ok: false, error: 'Enter a realistic height.' }
  }
  if (
    maintenanceMode === 'calculated' &&
    (ageYears === null || ageYears < 13 || ageYears > 120)
  ) {
    return { ok: false, error: 'Enter an age between 13 and 120.' }
  }
  if (goalWeightLb === null || goalWeightLb > 1500) {
    return { ok: false, error: 'Enter a realistic goal weight.' }
  }

  return {
    ok: true,
    value: {
      sex: form.sex,
      bodyweightLb,
      heightFeet: heightFeet ?? 5,
      heightInches: heightInches ?? 10,
      ageYears: ageYears ?? 30,
      activityLevel: form.activityLevel,
      goalWeightLb,
      maintenanceCalories: maintenanceCalories ?? undefined,
    },
  }
}

export function parseMaintenanceCalories(value: string): number | null {
  const parsed = parsePositiveNumber(value)
  if (parsed === null || parsed < MIN_GOAL_CALORIES || parsed > 10000) {
    return null
  }
  return Math.round(parsed)
}
