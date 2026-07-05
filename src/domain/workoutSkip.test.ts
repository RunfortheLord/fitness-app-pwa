import { describe, expect, it } from 'vitest'

import { canSkipWorkoutExercise } from '@domain/workoutSkip'

describe('canSkipWorkoutExercise', () => {
  it('disables skip when every set is complete', () => {
    expect(
      canSkipWorkoutExercise([{ completed: true }, { completed: true }]),
    ).toBe(false)
  })

  it('allows skip while at least one set is incomplete', () => {
    expect(
      canSkipWorkoutExercise([{ completed: true }, { completed: false }]),
    ).toBe(true)
  })

  it('allows skip when an exercise has no sets', () => {
    expect(canSkipWorkoutExercise([])).toBe(true)
  })

  it('does not treat an already skipped exercise as a skip target', () => {
    expect(canSkipWorkoutExercise([{ completed: false }], true)).toBe(false)
  })
})
