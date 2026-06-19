import { describe, expect, it } from 'vitest'

import {
  buildSetRecommendation,
  evaluateCurrentWorkoutRecommendation,
  evaluateNextWorkoutRecommendation,
} from '@domain/progressionRecommendations'
import type {
  ActiveCycleWorkoutExercise,
  TrackingMethodId,
  WorkoutExercise,
  WorkoutHistoryEntry,
  WorkoutSet,
  WorkoutSetTargetSnapshot,
} from '@shared-types/app'

describe('current workout progression recommendations', () => {
  const target: WorkoutSetTargetSnapshot = {
    trackingMethodId: 'weight_reps',
    targetWeight: 185,
    targetRepsMin: 5,
    targetRepsMax: 10,
  }

  it.each([
    ['above max', { reps: 11 }, false, 'above_range_increase_difficulty', 190],
    ['exact max', { reps: 10 }, false, 'exactly_at_maximum_hold', null],
    ['within range', { reps: 7 }, false, 'within_range_hold', null],
    ['exact min', { reps: 5 }, false, 'within_range_hold', null],
    [
      'below min without failure',
      { reps: 3 },
      false,
      'below_minimum_without_failure_hold',
      null,
    ],
    [
      'below min with failure',
      { reps: 3, failed: true },
      false,
      'below_minimum_failed_reduce_difficulty',
      180,
    ],
    ['skipped', { reps: 11 }, true, 'skipped_no_progression', null],
  ])(
    '%s',
    (_name, metricValues, exerciseSkipped, expectedReason, expectedWeight) => {
      const result = evaluateCurrentWorkoutRecommendation({
        trackingMethodId: 'weight_reps',
        exerciseName: 'Bench press',
        sourceSet: set({ completed: true, metricValues }),
        nextSet: set({ setNumber: 2 }),
        originalTarget: target,
        increment: 5,
        generatedAt: '2026-06-19T12:00:00.000Z',
        exerciseSkipped,
      })

      expect(result.reason).toBe(expectedReason)
      expect(result.suggestedTarget?.targetWeight ?? null).toBe(expectedWeight)
    },
  )

  it.each([
    [
      'missing minimum',
      { ...target, targetRepsMin: null },
      'missing_rep_range',
    ],
    [
      'missing maximum',
      { ...target, targetRepsMax: null },
      'missing_rep_range',
    ],
    ['missing target', { ...target, targetWeight: null }, 'missing_target'],
  ])('%s', (_name, originalTarget, expectedReason) => {
    expect(
      evaluateCurrentWorkoutRecommendation({
        trackingMethodId: 'weight_reps',
        exerciseName: 'Bench press',
        sourceSet: set({ completed: true, metricValues: { reps: 11 } }),
        nextSet: set({ setNumber: 2 }),
        originalTarget,
        increment: 5,
        generatedAt: '2026-06-19T12:00:00.000Z',
      }).reason,
    ).toBe(expectedReason)
  })

  it.each([
    ['missing increment', null],
    ['zero increment', 0],
    ['negative increment', -2.5],
    ['nan increment', Number.NaN],
  ])('%s', (_name, increment) => {
    expect(
      evaluateCurrentWorkoutRecommendation({
        trackingMethodId: 'weight_reps',
        exerciseName: 'Bench press',
        sourceSet: set({ completed: true, metricValues: { reps: 11 } }),
        nextSet: set({ setNumber: 2 }),
        originalTarget: target,
        increment,
        generatedAt: '2026-06-19T12:00:00.000Z',
      }).reason,
    ).toBe('invalid_increment')
  })

  it.each([
    ['dumbbell increment', 'weight_reps', 50, 2.5, 'up', 52.5],
    ['custom increment normalized', 'weight_reps', 190, 0.1, 'up', 190.1],
    ['assisted harder', 'assisted_weight_reps', 70, 5, 'up', 65],
    ['assisted easier', 'assisted_weight_reps', 70, 5, 'down', 75],
    ['assisted clamped', 'assisted_weight_reps', 2.5, 5, 'up', 0],
    ['added harder', 'added_weight_reps', 25, 5, 'up', 30],
    ['added easier clamped', 'added_weight_reps', 2.5, 5, 'down', 0],
  ])('%s', (_name, method, weight, increment, direction, expectedWeight) => {
    const reps = direction === 'up' ? 11 : 3
    const result = evaluateCurrentWorkoutRecommendation({
      trackingMethodId: method as TrackingMethodId,
      exerciseName: 'Exercise',
      sourceSet: set({
        completed: true,
        metricValues: { reps, failed: direction === 'down' },
      }),
      nextSet: set({ setNumber: 2 }),
      originalTarget: {
        ...target,
        trackingMethodId: method as TrackingMethodId,
        targetWeight: weight as number,
      },
      increment: increment as number,
      generatedAt: '2026-06-19T12:00:00.000Z',
    })

    expect(result.suggestedTarget?.targetWeight).toBe(expectedWeight)
  })

  it.each(['reps_only', 'duration', 'distance_duration'] as const)(
    'returns structured no-change for %s',
    (trackingMethodId) => {
      expect(
        evaluateCurrentWorkoutRecommendation({
          trackingMethodId,
          exerciseName: 'Exercise',
          sourceSet: set({ completed: true, metricValues: { reps: 11 } }),
          nextSet: set({ setNumber: 2 }),
          originalTarget: { ...target, trackingMethodId },
          increment: 5,
          generatedAt: '2026-06-19T12:00:00.000Z',
        }).reason,
      ).toBe('unsupported_tracking_method')
    },
  )

  it('is idempotent and preserves manual target edits separately', () => {
    const input = {
      trackingMethodId: 'weight_reps' as const,
      exerciseName: 'Bench press',
      sourceSet: set({ completed: true, metricValues: { reps: 11 } }),
      nextSet: set({ setNumber: 2 }),
      originalTarget: target,
      increment: 5,
      generatedAt: '2026-06-19T12:00:00.000Z',
    }

    expect(buildSetRecommendation(input)).toEqual(buildSetRecommendation(input))
    expect(
      buildSetRecommendation({
        ...input,
        userEditedTarget: { ...target, targetWeight: 187.5 },
      })?.reason,
    ).toBe('manual_target_retained')
  })
})

describe('next workout progression recommendations', () => {
  it('requires two comparable top-range workouts and sufficient final RIR', () => {
    const result = evaluateNextWorkoutRecommendation({
      current: performance({ reps: [10, 10], finalRir: 2 }),
      previous: performance({
        workoutId: 'previous',
        reps: [10, 11],
        finalRir: 3,
      }),
      increment: 5,
    })

    expect(result).toMatchObject({
      reason: 'repeated_top_range_increase',
      materialChange: true,
      recommendedTargetWeight: 190,
    })
  })

  it.each([
    ['no previous', undefined, 'no_comparable_previous_performance_hold'],
    [
      'zero final RIR',
      performance({ workoutId: 'previous', reps: [10, 10], finalRir: 0 }),
      'insufficient_final_rir_hold',
    ],
    [
      'one final RIR',
      performance({ workoutId: 'previous', reps: [10, 10], finalRir: 1 }),
      'insufficient_final_rir_hold',
    ],
  ])('%s holds', (_name, previous, expectedReason) => {
    expect(
      evaluateNextWorkoutRecommendation({
        current: performance({ reps: [10, 10], finalRir: previous ? 1 : 2 }),
        previous,
        increment: 5,
      }).reason,
    ).toBe(expectedReason)
  })

  it('reduces only after repeated missed minimums or failures', () => {
    const result = evaluateNextWorkoutRecommendation({
      current: performance({ reps: [3, 4], failedSetNumbers: [1] }),
      previous: performance({
        workoutId: 'previous',
        reps: [4, 5],
        failedSetNumbers: [1],
      }),
      increment: 5,
    })

    expect(result).toMatchObject({
      reason: 'repeated_failed_performance_reduce',
      materialChange: true,
      recommendedTargetWeight: 180,
    })
  })

  it('does not let added sets replace final programmed-set RIR', () => {
    const current = performance({ reps: [10, 10], finalRir: 1 })
    current.sets.push(
      set({
        setNumber: 3,
        completed: true,
        metricValues: { reps: 20 },
        rir: 4,
      }),
    )

    expect(
      evaluateNextWorkoutRecommendation({
        current,
        previous: performance({
          workoutId: 'previous',
          reps: [10, 10],
          finalRir: 3,
        }),
        increment: 5,
      }).reason,
    ).toBe('insufficient_final_rir_hold')
  })
})

function set(input: Partial<WorkoutSet>): WorkoutSet {
  return {
    id: input.id ?? `set-${input.setNumber ?? 1}`,
    workoutId: input.workoutId ?? 'workout',
    workoutExerciseId: input.workoutExerciseId ?? 'exercise',
    setNumber: input.setNumber ?? 1,
    targetSnapshot: input.targetSnapshot ?? null,
    targetRecommendation: input.targetRecommendation ?? null,
    metricValues: input.metricValues ?? {},
    rir: input.rir ?? null,
    completed: input.completed ?? false,
    completedAt: input.completedAt ?? null,
    restSecondsUsed: input.restSecondsUsed ?? null,
    createdAt: input.createdAt ?? '2026-06-19T12:00:00.000Z',
    updatedAt: input.updatedAt ?? '2026-06-19T12:00:00.000Z',
  }
}

function performance({
  workoutId = 'current',
  reps,
  finalRir = null,
  failedSetNumbers = [],
  trackingMethodId = 'weight_reps',
}: {
  workoutId?: string
  reps: number[]
  finalRir?: number | null
  failedSetNumbers?: number[]
  trackingMethodId?: TrackingMethodId
}) {
  const exercise: WorkoutExercise = {
    id: `${workoutId}-exercise`,
    workoutId,
    exerciseId: 'bench',
    exerciseSnapshot: {
      exerciseName: 'Bench press',
      notes: '',
      defaultRestSeconds: 120,
      trackingMethodId,
      trackingMetrics: [],
      recordsRepsPerSide: false,
    },
    sourcePrescribedExerciseId: 'source-exercise',
    orderIndex: 0,
    notes: '',
    skipped: false,
    replacementOfExerciseId: null,
    createdAt: '2026-06-19T12:00:00.000Z',
    updatedAt: '2026-06-19T12:00:00.000Z',
  }
  const prescription: ActiveCycleWorkoutExercise = {
    id: 'source-exercise',
    activeCycleId: 'cycle',
    dayId: 'day',
    sourceTemplateExerciseId: 'template-exercise',
    exerciseId: 'bench',
    exerciseSnapshot: exercise.exerciseSnapshot,
    orderIndex: 0,
    targetSetCount: 2,
    targetWeight: 185,
    targetDurationSeconds: null,
    targetDistance: null,
    targetRepsMin: 5,
    targetRepsMax: 10,
    targetRir: 2,
    restSecondsOverride: null,
    notes: '',
    createdAt: '2026-06-19T12:00:00.000Z',
    updatedAt: '2026-06-19T12:00:00.000Z',
  }
  const workout: WorkoutHistoryEntry = {
    id: workoutId,
    sourceActiveCycleId: 'cycle',
    sourceTemplateId: 'template',
    sourceDayId: 'day',
    localDate: '2026-06-19',
    name: 'Upper',
    workoutSnapshot: {
      activeCycleName: 'Program',
      templateName: 'Program',
      dayName: 'Upper',
      dayNotes: '',
    },
    notes: '',
    startedAt: '2026-06-19T12:00:00.000Z',
    completedAt:
      workoutId === 'current'
        ? '2026-06-19T13:00:00.000Z'
        : '2026-06-12T13:00:00.000Z',
    durationSeconds: 3600,
    elapsedPausedSeconds: 0,
    activeRestTimer: null,
    status: 'completed',
    createdAt: '2026-06-19T12:00:00.000Z',
    updatedAt: '2026-06-19T13:00:00.000Z',
  }

  return {
    workout,
    exercise,
    prescription,
    sets: reps.map((value, index) =>
      set({
        id: `${workoutId}-set-${index + 1}`,
        workoutId,
        workoutExerciseId: exercise.id,
        setNumber: index + 1,
        completed: true,
        metricValues: {
          reps: value,
          failed: failedSetNumbers.includes(index + 1),
        },
        rir: index === 1 ? finalRir : null,
      }),
    ),
  }
}
