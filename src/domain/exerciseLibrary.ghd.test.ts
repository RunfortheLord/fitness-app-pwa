import { describe, expect, it } from 'vitest'

import {
  BUILT_IN_EXERCISES,
  validateBuiltInExercises,
} from '@domain/exerciseLibrary'

describe('GHD Sit-Up seed', () => {
  it('includes exactly one weighted GHD Sit-Up exercise', () => {
    expect(() => validateBuiltInExercises()).not.toThrow()
    const matches = BUILT_IN_EXERCISES.filter(
      (exercise) => exercise.name === 'GHD Sit-Up',
    )

    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject({
      id: 'builtin:ghd-sit-up',
      equipmentType: 'bodyweight',
      trackingMethodId: 'weight_reps',
      defaultWeightIncrement: 5,
      primaryMuscleGroups: ['core'],
    })
  })
})
