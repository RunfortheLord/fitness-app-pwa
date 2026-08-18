import { describe, expect, it } from 'vitest'

import {
  BUILT_IN_EXERCISES,
  BUILT_IN_EXERCISE_SEED_VERSION,
  CORE_BUILT_IN_EXERCISES,
  validateBuiltInExercises,
} from '@domain/exerciseLibrary'

describe('built-in exercise library', () => {
  it('contains a validated seed set comparable to a large commercial library', () => {
    expect(() => validateBuiltInExercises()).not.toThrow()
    expect(BUILT_IN_EXERCISES.length).toBeGreaterThanOrEqual(800)
    expect(BUILT_IN_EXERCISES.length).toBeLessThanOrEqual(900)
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
      BUILT_IN_EXERCISES.find((seed) => seed.name === 'Pull-Up'),
    ).toMatchObject({
      trackingMethodId: 'added_weight_reps',
      defaultWeightIncrement: 5,
    })
    expect(
      BUILT_IN_EXERCISES.find((seed) => seed.name === 'Chin-Up'),
    ).toMatchObject({
      trackingMethodId: 'added_weight_reps',
      defaultWeightIncrement: 5,
    })
    expect(
      BUILT_IN_EXERCISES.find((seed) => seed.name === 'Dip'),
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
      BUILT_IN_EXERCISES.find((seed) => seed.name === 'Scapular Pull-Up'),
    ).toMatchObject({
      equipmentType: 'bodyweight',
      trackingMethodId: 'added_weight_reps',
      defaultWeightIncrement: 5,
      primaryMuscleGroups: ['back'],
      secondaryMuscleGroups: ['shoulders'],
    })
    expect(
      BUILT_IN_EXERCISES.every((seed) => seed.primaryMuscleGroups.length),
    ).toBe(true)
  })

  it('limits reps-only tracking to exercises without a meaningful load field', () => {
    const repsOnlyNames = CORE_BUILT_IN_EXERCISES.filter(
      (exercise) => exercise.trackingMethodId === 'reps_only',
    )
      .map((exercise) => exercise.name)
      .sort()

    expect(repsOnlyNames).toEqual(
      [
        '#1.5 Gripper Closes',
        '#2 Gripper Closes',
        'Ab Wheel Rollout',
        'Band External Rotation',
        'Band Face Pull',
        'Band Pull-Apart',
        'Banded Lateral Walk',
        'Banded Leg Curl',
        'Bird Dog',
        'Burpee',
        'Dead Bug',
        'Dragon Flag',
        'Hand Gripper Crushing',
        'Mountain Climber',
        'Neck Extension',
        'Neck Flexion',
        'Neck Lateral Flexion',
        'Plyometric Push-Up',
        'Pogo Jump',
        'Reverse Crunch',
        'Scapular Push-Up',
        'Serratus Wall Slide',
        'Wall Slide',
      ].sort(),
    )
  })

  it.each([
    'Bodyweight Squat',
    'Crunch',
    'Glute Bridge',
    'Hip Thrust',
    'Inverted Row',
    'Pistol Squat',
    'Roman Chair Sit-Up',
    'Scapular Pull-Up',
    'Sit-Up',
    'Standing Calf Raise',
    'Step-Up',
    'Walking Lunge',
  ])('provides an added-weight field for %s', (name) => {
    expect(
      BUILT_IN_EXERCISES.find((exercise) => exercise.name === name),
    ).toMatchObject({
      trackingMethodId: 'added_weight_reps',
      defaultWeightIncrement: 5,
    })
  })

  it.each(['Medicine Ball Slam', 'Prone Y-Raise'])(
    'provides a weight field for %s',
    (name) => {
      expect(
        BUILT_IN_EXERCISES.find((exercise) => exercise.name === name),
      ).toMatchObject({
        trackingMethodId: 'weight_reps',
      })
    },
  )

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
    expect(byName.get('Tempo Barbell Bench Press')).toMatchObject({
      id: 'builtin:tempo-barbell-bench-press',
      primaryMuscleGroups: ['chest'],
      trackingMethodId: 'weight_reps',
    })
    expect(byName.get('3-Second Eccentric Pull-Up')).toMatchObject({
      id: 'builtin:three-second-eccentric-pull-up',
      trackingMethodId: 'added_weight_reps',
    })
    expect(byName.has('1.5-Rep Dumbbell Lateral Raise')).toBe(false)
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
