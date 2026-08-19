import { describe, expect, it } from 'vitest'

import { mapLastWorkoutRirToCurrentDay } from './workoutRirPrefill'
import type {
  ActiveCycleWorkoutExercise,
  WorkoutHistoryExercise,
  WorkoutHistorySet,
} from '@shared-types/app'

describe('mapLastWorkoutRirToCurrentDay', () => {
  it('maps previous RIR by matching source exercise and set number', () => {
    const current = sourceExercise('source-a', 'bench', 3)
    const previous = historyExercise('history-a', 'source-a', 'bench')

    expect(
      mapLastWorkoutRirToCurrentDay({
        currentExercises: [current],
        previousExercises: [previous],
        previousSetsByExercise: {
          'history-a': [
            historySet('set-1', 'history-a', 1, 3),
            historySet('set-2', 'history-a', 2, null),
            historySet('set-3', 'history-a', 3, 1),
          ],
        },
      }),
    ).toEqual({ 'source-a': { 1: 3, 3: 1 } })
  })

  it('ignores changed exercises and sets beyond the new set count', () => {
    const current = sourceExercise('source-a', 'bench', 1)
    const previous = historyExercise('history-a', 'source-a', 'row')

    expect(
      mapLastWorkoutRirToCurrentDay({
        currentExercises: [current],
        previousExercises: [previous],
        previousSetsByExercise: {
          'history-a': [
            historySet('set-1', 'history-a', 1, 2),
            historySet('set-2', 'history-a', 2, 1),
          ],
        },
      }),
    ).toEqual({})
  })
})

function sourceExercise(
  id: string,
  exerciseId: string,
  targetSetCount: number,
): ActiveCycleWorkoutExercise {
  return {
    id,
    activeCycleId: 'cycle',
    dayId: 'day',
    sourceTemplateExerciseId: null,
    exerciseId,
    exerciseSnapshot: snapshot(),
    orderIndex: 0,
    targetSetCount,
    targetWeight: null,
    targetRepsMin: null,
    targetRepsMax: null,
    targetRir: null,
    restSecondsOverride: null,
    notes: '',
    createdAt: '2026-07-07T00:00:00.000Z',
    updatedAt: '2026-07-07T00:00:00.000Z',
  }
}

function historyExercise(
  id: string,
  sourcePrescribedExerciseId: string,
  exerciseId: string,
): WorkoutHistoryExercise {
  return {
    id,
    workoutId: 'workout',
    exerciseId,
    exerciseSnapshot: snapshot(),
    sourcePrescribedExerciseId,
    orderIndex: 0,
    notes: '',
    skipped: false,
    replacementOfExerciseId: null,
    createdAt: '2026-07-07T00:00:00.000Z',
    updatedAt: '2026-07-07T00:00:00.000Z',
  }
}

function historySet(
  id: string,
  workoutExerciseId: string,
  setNumber: number,
  rir: number | null,
): WorkoutHistorySet {
  return {
    id,
    workoutId: 'workout',
    workoutExerciseId,
    setNumber,
    targetSnapshot: null,
    targetRecommendation: null,
    metricValues: {},
    metricValueSources: {},
    rir,
    completed: true,
    completedAt: '2026-07-07T00:00:00.000Z',
    restSecondsUsed: null,
  }
}

function snapshot() {
  return {
    exerciseName: 'Bench',
    notes: '',
    defaultRestSeconds: 120,
    trackingMethodId: 'weight_reps' as const,
    trackingMetrics: [],
  }
}
