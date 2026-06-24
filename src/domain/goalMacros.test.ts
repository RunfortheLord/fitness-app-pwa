import { describe, expect, it } from 'vitest'

import {
  computeGoalPlan,
  computeMacroTargets,
  estimateGoalDate,
  goalDirection,
  mifflinStJeorBmr,
  weeklyRateLb,
} from './goalMacros'

describe('goalMacros', () => {
  it('computes a sex-aware cut plan with weekly-rate deficit and macros', () => {
    const plan = computeGoalPlan({
      sex: 'male',
      bodyweightLb: 180,
      heightFeet: 5,
      heightInches: 10,
      ageYears: 30,
      activityLevel: 'moderately_active',
      goalWeightLb: 170,
    })

    expect(plan.direction).toBe('cut')
    expect(plan.maintenanceCalories).toBe(2763)
    // 0.5% of 180 lb/week = -0.9 lb/week -> -450 kcal/day.
    expect(plan.weeklyRateLb).toBeCloseTo(-0.9, 5)
    expect(plan.goalCalories).toBe(2313)
    expect(plan.dailyCalorieDelta).toBe(-450)
    expect(plan.targets).toEqual({
      calories: 2313,
      proteinGrams: 126,
      fatGrams: 64,
      carbohydrateGrams: 308,
    })
  })

  it('gives men a higher BMR than women for the same body', () => {
    const base = { weightLb: 150, heightInches: 65, ageYears: 30 }
    expect(mifflinStJeorBmr({ sex: 'male', ...base })).toBeGreaterThan(
      mifflinStJeorBmr({ sex: 'female', ...base }),
    )
  })

  it('detects direction and uses a smaller bulk rate than cut rate', () => {
    expect(goalDirection(170, 185)).toBe('bulk')
    expect(goalDirection(180, 180)).toBe('maintain')
    expect(goalDirection(180, 170)).toBe('cut')

    expect(weeklyRateLb('cut', 200)).toBeCloseTo(-1, 5)
    expect(weeklyRateLb('bulk', 200)).toBeCloseTo(0.5, 5)
    expect(weeklyRateLb('maintain', 200)).toBe(0)

    const bulk = computeGoalPlan({
      sex: 'female',
      bodyweightLb: 140,
      heightFeet: 5,
      heightInches: 4,
      ageYears: 28,
      activityLevel: 'lightly_active',
      goalWeightLb: 150,
    })
    expect(bulk.direction).toBe('bulk')
    expect(bulk.weeklyRateLb).toBeCloseTo(0.35, 5)
    expect(bulk.dailyCalorieDelta).toBe(175)
  })

  it('never produces negative macros or sub-floor calories', () => {
    const targets = computeMacroTargets(1000, 220)
    expect(targets.proteinGrams).toBeGreaterThanOrEqual(0)
    expect(targets.carbohydrateGrams).toBeGreaterThanOrEqual(0)
    expect(targets.fatGrams).toBeGreaterThanOrEqual(0)

    const plan = computeGoalPlan({
      sex: 'female',
      bodyweightLb: 110,
      heightFeet: 5,
      heightInches: 0,
      ageYears: 25,
      activityLevel: 'sedentary',
      goalWeightLb: 95,
    })
    expect(plan.goalCalories).toBeGreaterThanOrEqual(1200)
  })

  it('estimates the goal date from the weekly rate and returns null when misaligned', () => {
    const from = new Date(2026, 5, 23)

    expect(
      estimateGoalDate({
        currentWeightLb: 180,
        goalWeightLb: 170,
        weeklyRateLb: -0.9,
        from,
      }),
    ).toEqual(new Date(2026, 8, 9))

    // A cut rate while trying to gain weight cannot reach the goal.
    expect(
      estimateGoalDate({
        currentWeightLb: 170,
        goalWeightLb: 180,
        weeklyRateLb: -0.9,
        from,
      }),
    ).toBeNull()

    // Already at the goal weight.
    expect(
      estimateGoalDate({
        currentWeightLb: 180,
        goalWeightLb: 180,
        weeklyRateLb: -0.9,
        from,
      }),
    ).toBeNull()

    // No movement.
    expect(
      estimateGoalDate({
        currentWeightLb: 180,
        goalWeightLb: 170,
        weeklyRateLb: 0,
        from,
      }),
    ).toBeNull()
  })
})
