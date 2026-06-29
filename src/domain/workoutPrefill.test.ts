import { describe, expect, it } from 'vitest'

import { suggestedWeightForReps } from '@domain/workoutPrefill'

describe('workout prefill', () => {
  it('translates a previous set estimate to a new rep scheme and load increment', () => {
    expect(
      suggestedWeightForReps({
        previousWeight: 200,
        previousReps: 10,
        targetReps: 5,
        weightIncrement: 5,
      }),
    ).toBe(230)
  })

  it('preserves the prior load when the previous set cannot produce an estimate', () => {
    expect(
      suggestedWeightForReps({
        previousWeight: 100,
        previousReps: 15,
        targetReps: 8,
        weightIncrement: 5,
      }),
    ).toBe(100)
  })

  it('handles a one-repetition target without applying the multi-rep divisor', () => {
    expect(
      suggestedWeightForReps({
        previousWeight: 180,
        previousReps: 5,
        targetReps: 1,
        weightIncrement: 5,
      }),
    ).toBe(210)
  })
})
