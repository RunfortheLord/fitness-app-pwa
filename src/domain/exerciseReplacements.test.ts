import { describe, expect, it } from 'vitest'

import { rankedExerciseReplacements } from './exerciseReplacements'
import type { Exercise } from '@shared-types/app'

describe('rankedExerciseReplacements', () => {
  it('prioritizes active exercises with matching tracking and muscle metadata', () => {
    const current = exercise('bench', 'Bench Press', ['chest'], 'barbell')
    const close = exercise('db-bench', 'Dumbbell Bench Press', ['chest'])
    const trackingMismatch = exercise(
      'pushup',
      'Push-up',
      ['chest'],
      'bodyweight',
      'reps_only',
    )
    const unrelated = exercise('curl', 'Curl', ['biceps'])

    expect(
      rankedExerciseReplacements({
        candidates: [unrelated, trackingMismatch, close, current],
        current,
      }).map((entry) => entry.id),
    ).toEqual(['db-bench', 'pushup'])
  })

  it('excludes the current exercise and caller-provided ids', () => {
    const current = exercise('bench', 'Bench Press', ['chest'])
    const swap = exercise('machine', 'Machine Chest Press', ['chest'])

    expect(
      rankedExerciseReplacements({
        candidates: [current, swap],
        current,
        excludedExerciseIds: [swap.id],
      }),
    ).toEqual([])
  })
})

function exercise(
  id: string,
  name: string,
  primaryMuscleGroups: Exercise['primaryMuscleGroups'],
  equipmentType: Exercise['equipmentType'] = 'machine',
  trackingMethodId: Exercise['trackingMethodId'] = 'weight_reps',
): Exercise {
  return {
    id,
    name,
    notes: '',
    defaultRestSeconds: 120,
    defaultWeightIncrement: 5,
    trackingMethodId,
    trackingMetrics: [],
    primaryMuscleGroups,
    secondaryMuscleGroups: [],
    equipmentType,
    recordsRepsPerSide: false,
    origin: 'custom',
    seedDataVersion: null,
    status: 'active',
    createdAt: '2026-07-07T00:00:00.000Z',
    updatedAt: '2026-07-07T00:00:00.000Z',
  }
}
