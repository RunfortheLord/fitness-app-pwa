import { describe, expect, it } from 'vitest'

import type { LocalDateString } from '@domain/dates'
import type { BodyweightEntry, NutritionGoal } from '@shared-types/app'

import {
  type DailyCalorieAdjustmentData,
  evaluateCalorieUpdate,
  roundCalorieAdjustment,
} from './calorieAdjustment'

function dayString(offset: number): LocalDateString {
  const date = new Date(2026, 0, 1)
  date.setDate(date.getDate() + offset)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}` as LocalDateString
}

function entry(offset: number, weight: number): BodyweightEntry {
  const localDate = dayString(offset)
  return {
    id: `bw-${offset}`,
    localDate,
    weight,
    unit: 'lb',
    notes: '',
    createdAt: `${localDate}T08:00:00.000Z`,
    updatedAt: `${localDate}T08:00:00.000Z`,
  }
}

function intakeDay(
  offset: number,
  loggedCalories: number,
  targetCalories = 2300,
): DailyCalorieAdjustmentData {
  return {
    localDate: dayString(offset),
    loggedCalories,
    targetCalories,
  }
}

function intakeDays(
  offsets: number[],
  loggedCalories: number,
  targetCalories = 2300,
): DailyCalorieAdjustmentData[] {
  return offsets.map((offset) =>
    intakeDay(offset, loggedCalories, targetCalories),
  )
}

function makeGoal(overrides: Partial<NutritionGoal> = {}): NutritionGoal {
  return {
    goalWeightLb: 170,
    calculationWeightLb: 180,
    heightInches: 70,
    ageYears: 30,
    sex: 'male',
    activityLevel: 'moderately_active',
    direction: 'cut',
    weeklyRateLb: -0.9,
    maintenanceCalories: 2763,
    targets: {
      calories: 2300,
      proteinGrams: 126,
      carbohydrateGrams: 305,
      fatGrams: 64,
    },
    estimatedFinishDate: null,
    formulaVersion: 1,
    lastCalorieUpdate: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('calorieAdjustment', () => {
  it('rounds, clamps, and deadbands raw adjustments', () => {
    expect(roundCalorieAdjustment(40)).toBe(0)
    expect(roundCalorieAdjustment(-40)).toBe(0)
    expect(roundCalorieAdjustment(60)).toBe(50)
    expect(roundCalorieAdjustment(137)).toBe(125)
    expect(roundCalorieAdjustment(260)).toBe(200)
    expect(roundCalorieAdjustment(-260)).toBe(-200)
  })

  it('reports insufficient data with too few measurements', () => {
    const result = evaluateCalorieUpdate({
      goal: makeGoal(),
      entries: [entry(0, 180), entry(14, 180)],
      dailyCalories: intakeDays([7, 8, 9, 10, 11, 12, 13], 2300),
      asOf: dayString(14),
    })
    expect(result.status).toBe('insufficient_data')
  })

  it('reports insufficient data without enough complete intake days', () => {
    const result = evaluateCalorieUpdate({
      goal: makeGoal(),
      entries: [entry(0, 180), entry(7, 180), entry(14, 180)],
      dailyCalories: intakeDays([10, 11, 12], 2300),
      asOf: dayString(14),
    })
    expect(result.status).toBe('insufficient_data')
  })

  it('decreases calories from recent complete intake days when a cut stalls', () => {
    const result = evaluateCalorieUpdate({
      goal: makeGoal(),
      entries: [entry(0, 180), entry(7, 180), entry(14, 180)],
      dailyCalories: [
        ...intakeDays([6, 7, 8, 9, 10, 11, 12, 13], 2300),
        intakeDay(14, 1200),
      ],
      asOf: dayString(14),
    })
    expect(result.status).toBe('changed')
    if (result.status === 'changed') {
      // Today is excluded; 2300 kcal average intake and stable weight estimate
      // maintenance at 2300. Desired -0.9 lb/wk gives a 1850 kcal target, then
      // the practical update clamps the change to -200.
      expect(result.averageLoggedCalories).toBe(2300)
      expect(result.averageTargetCalories).toBe(2300)
      expect(result.intakeDayCount).toBe(8)
      expect(result.estimatedMaintenanceCalories).toBe(2300)
      expect(result.deltaKcal).toBe(-200)
      expect(result.newCalories).toBe(2100)
      expect(result.newMaintenanceCalories).toBe(2563)
      expect(result.newTargets.calories).toBe(2100)
    }
  })

  it('recommends no change for an on-track maintenance plan', () => {
    const result = evaluateCalorieUpdate({
      goal: makeGoal({ direction: 'maintain', weeklyRateLb: 0 }),
      entries: [entry(0, 180), entry(7, 180), entry(14, 180)],
      dailyCalories: intakeDays([6, 7, 8, 9, 10, 11, 12, 13], 2300),
      asOf: dayString(14),
    })
    expect(result.status).toBe('no_change')
  })

  it('does not reapply the same adjustment from unchanged trend data', () => {
    const entries = [entry(0, 180), entry(7, 180), entry(14, 180)]
    const asOf = dayString(14)
    const dailyCalories = intakeDays([6, 7, 8, 9, 10, 11, 12, 13], 2300)
    const first = evaluateCalorieUpdate({
      goal: makeGoal(),
      entries,
      dailyCalories,
      asOf,
    })
    expect(first.status).toBe('changed')
    if (first.status !== 'changed') {
      return
    }
    const repeat = evaluateCalorieUpdate({
      goal: makeGoal({
        lastCalorieUpdate: {
          appliedAt: '2026-01-15T00:00:00.000Z',
          deltaKcal: first.deltaKcal,
          trendWeightLb: first.trendWeightLb,
          observedWeeklyChangeLb: first.observedWeeklyChangeLb,
          signature: first.signature,
        },
      }),
      entries,
      dailyCalories,
      asOf,
    })
    expect(repeat.status).toBe('already_applied')
  })
})
