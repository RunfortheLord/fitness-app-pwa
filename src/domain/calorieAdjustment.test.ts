import { describe, expect, it } from 'vitest'

import type { LocalDateString } from '@domain/dates'
import type { BodyweightEntry, NutritionGoal } from '@shared-types/app'

import {
  ADJUSTMENT_MAX_HISTORY_INFLUENCE,
  type DailyCalorieAdjustmentData,
  estimateAdaptiveMaintenance,
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
  it('rounds raw adjustments to single calories without coarse steps', () => {
    expect(roundCalorieAdjustment(0.6)).toBe(1)
    expect(roundCalorieAdjustment(-0.6)).toBe(-1)
    expect(roundCalorieAdjustment(60.4)).toBe(60)
    expect(roundCalorieAdjustment(137.6)).toBe(138)
    expect(roundCalorieAdjustment(260)).toBe(260)
    expect(roundCalorieAdjustment(-260)).toBe(-260)
    expect(roundCalorieAdjustment(Number.NaN)).toBe(0)
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
      // maintenance at 2300. Desired -0.9 lb/wk gives the exact 1850 kcal
      // whole-calorie target.
      expect(result.averageLoggedCalories).toBeCloseTo(2300)
      expect(result.averageTargetCalories).toBeCloseTo(2300)
      expect(result.intakeDayCount).toBe(8)
      expect(result.estimatedMaintenanceCalories).toBe(2300)
      expect(result.deltaKcal).toBe(-450)
      expect(result.newCalories).toBe(1850)
      expect(result.newMaintenanceCalories).toBe(2300)
      expect(result.newTargets.calories).toBe(1850)
    }
  })

  it('uses the current target as the baseline and can update by one calorie', () => {
    const result = evaluateCalorieUpdate({
      goal: makeGoal({
        targets: {
          calories: 2100,
          proteinGrams: 126,
          carbohydrateGrams: 255,
          fatGrams: 58,
        },
      }),
      entries: [entry(0, 180), entry(7, 180), entry(14, 180)],
      dailyCalories: intakeDays([6, 7, 8, 9, 10, 11, 12, 13], 2551, 2300),
      asOf: dayString(14),
    })

    expect(result.status).toBe('changed')
    if (result.status === 'changed') {
      // Maintenance is 2551 at stable trend weight; the selected -0.9 lb/week
      // rate is -450 kcal/day, producing 2101 directly. Historical targets do
      // not incorrectly push the current target down by another 199 calories.
      expect(result.averageTargetCalories).toBeCloseTo(2300)
      expect(result.estimatedMaintenanceCalories).toBe(2551)
      expect(result.deltaKcal).toBe(1)
      expect(result.newCalories).toBe(2101)
      expect(result.newMaintenanceCalories).toBe(2551)
    }
  })

  it('estimates maintenance after trend weight reaches the desired goal', () => {
    const result = evaluateCalorieUpdate({
      goal: makeGoal(),
      entries: [entry(0, 170), entry(7, 170), entry(14, 170)],
      dailyCalories: intakeDays([6, 7, 8, 9, 10, 11, 12, 13], 2300),
      asOf: dayString(14),
    })

    expect(result.status).toBe('no_change')
    if (result.status === 'no_change') {
      expect(result.estimatedMaintenanceCalories).toBe(2300)
      expect(result.trendWeightLb).toBe(170)
    }
  })

  it('uses the recent signal alone while history is still developing', () => {
    const estimate = estimateAdaptiveMaintenance({
      entries: [entry(0, 180), entry(7, 180), entry(14, 180)],
      dailyCalories: intakeDays(
        Array.from({ length: 14 }, (_, index) => index),
        2500,
      ),
      asOf: dayString(14),
    })

    expect(estimate).not.toBeNull()
    expect(estimate?.historyInfluence).toBe(0)
    expect(estimate?.estimateConfidence).toBe('developing')
    expect(estimate?.historyIntakeDayCount).toBe(14)
    expect(estimate?.estimatedMaintenanceCalories).toBe(2500)
  })

  it('gives consistent three-month history its full stabilizing influence', () => {
    const estimate = estimateAdaptiveMaintenance({
      entries: [
        ...Array.from({ length: 13 }, (_, index) => entry(index * 7, 180)),
        entry(90, 180),
      ],
      dailyCalories: intakeDays(
        Array.from({ length: 90 }, (_, index) => index),
        2500,
      ),
      asOf: dayString(90),
    })

    expect(estimate).not.toBeNull()
    expect(estimate?.historyInfluence).toBe(ADJUSTMENT_MAX_HISTORY_INFLUENCE)
    expect(estimate?.estimateConfidence).toBe('strong')
    expect(estimate?.historyIntakeDayCount).toBe(90)
    expect(estimate?.historyWeightPointCount).toBe(14)
    expect(estimate?.estimatedMaintenanceCalories).toBe(2500)
  })

  it('uses established history to soften a one-week intake outlier', () => {
    const entries = [
      ...Array.from({ length: 13 }, (_, index) => entry(index * 7, 180)),
      entry(90, 180),
    ]
    const baselineDays = Array.from({ length: 83 }, (_, index) =>
      intakeDay(index, 2500),
    )
    const outlierDays = Array.from({ length: 7 }, (_, index) =>
      intakeDay(83 + index, 3500),
    )
    const estimate = estimateAdaptiveMaintenance({
      entries,
      dailyCalories: [...baselineDays, ...outlierDays],
      asOf: dayString(90),
    })

    expect(estimate).not.toBeNull()
    if (!estimate) {
      return
    }
    expect(estimate.recentMaintenanceCalories).toBeGreaterThan(
      estimate.estimatedMaintenanceCalories,
    )
    expect(estimate.estimatedMaintenanceCalories).toBeGreaterThan(
      estimate.historicalMaintenanceCalories,
    )
    expect(estimate.historyInfluence).toBe(ADJUSTMENT_MAX_HISTORY_INFLUENCE)
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
