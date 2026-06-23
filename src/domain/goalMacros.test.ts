import { describe, expect, it } from 'vitest'

import {
  computeGoalPlan,
  estimateGoalDate,
  goalDirection,
  mifflinStJeorBmr,
} from './goalMacros'

describe('goalMacros', () => {
  it('computes a sex-aware cut plan with macro targets', () => {
    const plan = computeGoalPlan({
      sex: 'male',
      bodyweightLb: 180,
      heightFeet: 5,
      heightInches: 10,
      activityLevel: 'moderately_active',
      goalWeightLb: 170,
    })

    expect(plan.direction).toBe('cut')
    expect(plan.maintenanceCalories).toBe(2763)
    expect(plan.goalCalories).toBe(2263)
    expect(plan.dailyCalorieDelta).toBe(-500)
    expect(plan.targets).toEqual({
      calories: 2263,
      proteinGrams: 126,
      fatGrams: 63,
      carbohydrateGrams: 298,
    })
  })

  it('gives men a higher BMR than women for the same body', () => {
    const base = { weightLb: 150, heightInches: 65 }
    expect(mifflinStJeorBmr({ sex: 'male', ...base })).toBeGreaterThan(
      mifflinStJeorBmr({ sex: 'female', ...base }),
    )
  })

  it('treats a higher goal weight as a bulk and a near-equal goal as maintain', () => {
    expect(goalDirection(170, 185)).toBe('bulk')
    expect(goalDirection(180, 180)).toBe('maintain')

    const bulk = computeGoalPlan({
      sex: 'female',
      bodyweightLb: 140,
      heightFeet: 5,
      heightInches: 4,
      activityLevel: 'lightly_active',
      goalWeightLb: 150,
    })
    expect(bulk.direction).toBe('bulk')
    expect(bulk.dailyCalorieDelta).toBe(300)
  })

  it('estimates the goal date from trend weight and returns null when misaligned', () => {
    const from = new Date(2026, 5, 23)

    expect(
      estimateGoalDate({
        currentWeightLb: 180,
        goalWeightLb: 170,
        dailyCalorieDelta: -500,
        from,
      }),
    ).toEqual(new Date(2026, 8, 1))

    // A deficit while trying to gain weight cannot reach the goal.
    expect(
      estimateGoalDate({
        currentWeightLb: 170,
        goalWeightLb: 180,
        dailyCalorieDelta: -500,
        from,
      }),
    ).toBeNull()

    // Already at the goal weight.
    expect(
      estimateGoalDate({
        currentWeightLb: 180,
        goalWeightLb: 180,
        dailyCalorieDelta: -500,
        from,
      }),
    ).toBeNull()
  })
})
