import { describe, expect, it } from 'vitest'

import { detectWorkoutStructuralChanges } from '@domain/workoutChanges'
import type {
  ActiveCycleWorkoutExercise,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@shared-types/app'

const now = '2026-06-18T12:00:00.000Z'

describe('detectWorkoutStructuralChanges', () => {
  it('detects added and removed sets without metric false positives', () => {
    const source = [sourceExercise('source-bench', 'bench', 'Bench press', 2)]
    const performed = [
      workoutExercise('workout-bench', 'bench', 'Bench press', 'source-bench'),
    ]
    const baseSets = [
      workoutSet('set-1', 'workout-bench', 1, { weight: 135, reps: 8 }, true),
      workoutSet('set-2', 'workout-bench', 2, { weight: 155, reps: 6 }, false),
    ]

    expect(detect(source, performed, { 'workout-bench': baseSets })).toEqual([])
    expect(
      detect(source, performed, {
        'workout-bench': [...baseSets, workoutSet('set-3', 'workout-bench', 3)],
      }).map((change) => change.type),
    ).toEqual(['set_added'])
    expect(
      detect(source, performed, {
        'workout-bench': [baseSets[0]],
      }).map((change) => change.type),
    ).toEqual(['set_removed'])
  })

  it('detects added, skipped, removed, and replaced exercises as separate items', () => {
    const source = [
      sourceExercise('source-bench', 'bench', 'Bench press', 2),
      sourceExercise('source-row', 'row', 'Barbell row', 2, 1),
      sourceExercise('source-raise', 'raise', 'Lateral raises', 2, 2),
    ]
    const performed = [
      workoutExercise('workout-bench', 'bench', 'Bench press', 'source-bench'),
      workoutExercise(
        'workout-row',
        'chest-row',
        'Chest-supported row',
        'source-row',
      ),
      {
        ...workoutExercise(
          'workout-raise',
          'raise',
          'Lateral raises',
          'source-raise',
        ),
        skipped: true,
      },
      workoutExercise('workout-curl', 'curl', 'Curl', null, 3),
    ]

    const sets = Object.fromEntries(
      performed.map((exercise) => [
        exercise.id,
        [
          workoutSet(`${exercise.id}-1`, exercise.id, 1),
          workoutSet(`${exercise.id}-2`, exercise.id, 2),
        ],
      ]),
    )
    expect(
      detect(source, performed, sets).map((change) => change.type),
    ).toEqual([
      'exercise_replaced',
      'exercise_skipped_or_removed',
      'exercise_added',
    ])
    expect(detect(source.slice(0, 1), [], {})).toMatchObject([
      {
        type: 'exercise_skipped_or_removed',
        description: 'Removed Bench press',
      },
    ])
  })

  it('detects exercise order changes', () => {
    const source = [
      sourceExercise('source-bench', 'bench', 'Bench press', 2),
      sourceExercise('source-row', 'row', 'Barbell row', 2, 1),
    ]
    const performed = [
      workoutExercise('workout-row', 'row', 'Barbell row', 'source-row'),
      workoutExercise(
        'workout-bench',
        'bench',
        'Bench press',
        'source-bench',
        1,
      ),
    ]

    expect(
      detect(source, performed, {
        'workout-row': [
          workoutSet('row-1', 'workout-row', 1),
          workoutSet('row-2', 'workout-row', 2),
        ],
        'workout-bench': [
          workoutSet('bench-1', 'workout-bench', 1),
          workoutSet('bench-2', 'workout-bench', 2),
        ],
      }).map((change) => change.type),
    ).toEqual(['exercise_order_changed'])
  })

  it('does not detect ordinary notes, completion, reps, RIR, or duration changes', () => {
    const source = [sourceExercise('source-bench', 'bench', 'Bench press', 1)]
    const performed = [
      {
        ...workoutExercise(
          'workout-bench',
          'bench',
          'Bench press',
          'source-bench',
        ),
        notes: 'felt fast',
      },
    ]

    expect(
      detect(source, performed, {
        'workout-bench': [
          {
            ...workoutSet('set-1', 'workout-bench', 1, {
              weight: 200,
              reps: 12,
            }),
            rir: 1,
            completed: true,
          },
        ],
      }),
    ).toEqual([])
  })
})

function detect(
  sourceExercises: ActiveCycleWorkoutExercise[],
  performedExercises: WorkoutExercise[],
  performedSetsByExercise: Record<string, WorkoutSet[]> = {},
) {
  return detectWorkoutStructuralChanges({
    sourceExercises,
    workout,
    performedExercises,
    performedSetsByExercise,
  })
}

function sourceExercise(
  id: string,
  exerciseId: string,
  name: string,
  targetSetCount: number,
  orderIndex = 0,
): ActiveCycleWorkoutExercise {
  return {
    id,
    activeCycleId: 'cycle-1',
    dayId: 'day-1',
    sourceTemplateExerciseId: `template-${id}`,
    exerciseId,
    exerciseSnapshot: snapshot(name),
    orderIndex,
    targetSetCount,
    targetRepsMin: null,
    targetRepsMax: null,
    targetRir: null,
    restSecondsOverride: null,
    notes: '',
    createdAt: now,
    updatedAt: now,
  }
}

function workoutExercise(
  id: string,
  exerciseId: string,
  name: string,
  sourcePrescribedExerciseId: string | null,
  orderIndex = 0,
): WorkoutExercise {
  return {
    id,
    workoutId: workout.id,
    exerciseId,
    exerciseSnapshot: snapshot(name),
    sourcePrescribedExerciseId,
    orderIndex,
    notes: '',
    skipped: false,
    replacementOfExerciseId: null,
    createdAt: now,
    updatedAt: now,
  }
}

function workoutSet(
  id: string,
  workoutExerciseId: string,
  setNumber: number,
  metricValues: WorkoutSet['metricValues'] = {},
  completed = false,
): WorkoutSet {
  return {
    id,
    workoutId: workout.id,
    workoutExerciseId,
    setNumber,
    metricValues,
    rir: null,
    completed,
    completedAt: null,
    restSecondsUsed: null,
    createdAt: now,
    updatedAt: now,
  }
}

function snapshot(exerciseName: string) {
  return {
    exerciseName,
    notes: '',
    defaultRestSeconds: 90,
    trackingMethodId: 'weight_reps' as const,
    trackingMetrics: [],
  }
}

const workout: Workout = {
  id: 'workout-1',
  sourceActiveCycleId: 'cycle-1',
  sourceTemplateId: 'template-1',
  sourceDayId: 'day-1',
  localDate: '2026-06-18',
  name: 'Upper',
  workoutSnapshot: {
    activeCycleName: 'Upper Lower',
    templateName: 'Upper Lower',
    dayName: 'Upper',
    dayNotes: '',
  },
  notes: '',
  startedAt: now,
  completedAt: null,
  durationSeconds: null,
  elapsedPausedSeconds: 60,
  activeRestTimer: null,
  status: 'active',
  createdAt: now,
  updatedAt: now,
}
