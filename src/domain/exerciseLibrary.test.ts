import { describe, expect, it } from 'vitest'

import {
  BUILT_IN_EXERCISES,
  BUILT_IN_EXERCISE_SEED_VERSION,
  validateBuiltInExercises,
} from '@domain/exerciseLibrary'

describe('built-in exercise library', () => {
  it('contains a validated seed set in the intended size range', () => {
    expect(() => validateBuiltInExercises()).not.toThrow()
    expect(BUILT_IN_EXERCISES.length).toBeGreaterThanOrEqual(150)
    expect(BUILT_IN_EXERCISES.length).toBeLessThanOrEqual(250)
  })

  it('uses stable built-in IDs and covers required equipment categories', () => {
    expect(BUILT_IN_EXERCISES[0]).toMatchObject({
      id: 'builtin:barbell-bench-press',
      name: 'Barbell Bench Press',
      origin: 'built_in',
      seedDataVersion: BUILT_IN_EXERCISE_SEED_VERSION,
    })
    expect(
      new Set(BUILT_IN_EXERCISES.map((seed) => seed.equipmentType)),
    ).toEqual(
      new Set(['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight']),
    )
  })

  it('includes each supported tracking method and meaningful metadata', () => {
    expect(
      new Set(BUILT_IN_EXERCISES.map((seed) => seed.trackingMethodId)),
    ).toEqual(
      new Set([
        'weight_reps',
        'reps_only',
        'duration',
        'distance_duration',
        'assisted_weight_reps',
        'added_weight_reps',
      ]),
    )
    expect(
      BUILT_IN_EXERCISES.find((seed) => seed.name === 'Weighted Pull-Up'),
    ).toMatchObject({
      trackingMethodId: 'added_weight_reps',
      defaultWeightIncrement: 5,
    })
    expect(
      BUILT_IN_EXERCISES.find((seed) => seed.name === 'Assisted Pull-Up'),
    ).toMatchObject({
      trackingMethodId: 'assisted_weight_reps',
      defaultWeightIncrement: 5,
    })
    expect(
      BUILT_IN_EXERCISES.find(
        (seed) => seed.name === 'Dumbbell Bulgarian Split Squat',
      ),
    ).toMatchObject({ recordsRepsPerSide: true })
    expect(
      BUILT_IN_EXERCISES.every((seed) => seed.primaryMuscleGroups.length),
    ).toBe(true)
  })

  it('rejects duplicate IDs and invalid records during validation', () => {
    expect(() =>
      validateBuiltInExercises([
        BUILT_IN_EXERCISES[0],
        { ...BUILT_IN_EXERCISES[0], name: 'Duplicate Bench' },
      ]),
    ).toThrow(/Duplicate exercise ID/)
    expect(() =>
      validateBuiltInExercises([
        { ...BUILT_IN_EXERCISES[0], id: 'bad', defaultRestSeconds: -1 },
      ]),
    ).toThrow(/builtin ID prefix/)
  })
})
