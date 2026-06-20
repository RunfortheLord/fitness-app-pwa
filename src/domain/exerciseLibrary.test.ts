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

  it('contains the requested added exercises with tracking metadata', () => {
    expect(() => validateBuiltInExercises()).not.toThrow()
    const byName = new Map(
      BUILT_IN_EXERCISES.map((exercise) => [exercise.name, exercise]),
    )

    expect(byName.get('10 lb Medicine Ball Throws')).toMatchObject({
      trackingMethodId: 'distance_duration',
    })
    expect(byName.get('#2 Gripper Strapholds')).toMatchObject({
      trackingMethodId: 'weight_reps',
      defaultRestSeconds: 150,
    })
    expect(byName.get('#1.5 Gripper Strapholds')).toMatchObject({
      trackingMethodId: 'weight_reps',
      defaultRestSeconds: 150,
    })
    expect(byName.get('#2 Gripper Isometric Holds')).toMatchObject({
      trackingMethodId: 'duration',
    })
    expect(byName.get('#1.5 Gripper Isometric Holds')).toMatchObject({
      trackingMethodId: 'duration',
    })
    expect(byName.get('#2 Gripper Closes')).toMatchObject({
      trackingMethodId: 'reps_only',
    })
    expect(byName.get('#1.5 Gripper Closes')).toMatchObject({
      trackingMethodId: 'reps_only',
    })
    expect(byName.get('Triple Broad Jumps')).toMatchObject({
      trackingMethodId: 'distance_duration',
    })
    expect(byName.get('40 yd Sprints')).toMatchObject({
      trackingMethodId: 'duration',
    })
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
