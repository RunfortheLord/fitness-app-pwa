import { describe, expect, it } from 'vitest'

import {
  createStrengthGraphModel,
  createStrengthGraphPoints,
  estimateOneRepMax,
  filterStrengthPointsForRange,
  formatEstimatedWeight,
  formatTotalVolume,
  listStrengthExerciseOptions,
} from './strengthProgress'
import type {
  WorkoutHistoryEntry,
  WorkoutHistoryExercise,
  WorkoutHistorySet,
} from '@shared-types/app'

describe('strength progress calculations', () => {
  it('uses entered weight for one rep and Epley for multi-rep sets', () => {
    expect(estimateOneRepMax(225, 1)).toBe(225)
    expect(estimateOneRepMax(200, 6)).toBeCloseTo(240)
  })

  it('plots the highest eligible set per workout and excludes incompatible data', () => {
    const points = createStrengthGraphPoints([
      structure({
        workoutId: 'workout-1',
        completedAt: '2026-06-01T12:00:00.000Z',
        sets: [
          set({ id: 'set-1', weight: 100, reps: 5 }),
          set({ id: 'set-2', weight: 110, reps: 5 }),
          set({ id: 'set-3', weight: 500, reps: 20 }),
          set({ id: 'set-4', weight: 120, reps: 3, completed: false }),
        ],
      }),
      structure({
        workoutId: 'workout-2',
        completedAt: '2026-06-02T12:00:00.000Z',
        sets: [set({ id: 'set-5', weight: 115, reps: 1 })],
      }),
      structure({
        workoutId: 'duration-workout',
        completedAt: '2026-06-03T12:00:00.000Z',
        trackingMethodId: 'duration',
        sets: [set({ id: 'set-6', weight: 200, reps: 5 })],
      }),
    ])

    expect(points).toHaveLength(2)
    expect(points[0]).toMatchObject({
      workoutId: 'workout-1',
      setNumber: 2,
      estimatedOneRepMax: 128.33333333333334,
      totalVolume: 11_050,
      completedSetCount: 3,
    })
    expect(points[1]).toMatchObject({
      workoutId: 'workout-2',
      estimatedOneRepMax: 115,
    })
  })

  it('creates exercise options, ranges, and empty/single graph models', () => {
    const points = createStrengthGraphPoints([
      structure({
        workoutId: 'older',
        completedAt: '2025-01-01T12:00:00.000Z',
        localDate: '2025-01-01',
        sets: [set({ id: 'old-set', weight: 100, reps: 5 })],
      }),
      structure({
        workoutId: 'recent',
        completedAt: '2026-06-01T12:00:00.000Z',
        localDate: '2026-06-01',
        sets: [set({ id: 'new-set', weight: 120, reps: 5 })],
      }),
    ])

    expect(listStrengthExerciseOptions(points)[0]).toMatchObject({
      exerciseId: 'bench',
      pointCount: 2,
    })
    const ranged = filterStrengthPointsForRange({
      points,
      range: '1m',
      today: '2026-06-19',
    })
    expect(ranged).toHaveLength(1)
    expect(createStrengthGraphModel([]).status).toBe('empty')
    const singleModel = createStrengthGraphModel(ranged)
    expect(singleModel.status).toBe('single')
    // A lone point is centered horizontally so it clears the y-axis labels.
    expect(singleModel.points[0]?.x).toBe(50)
    expect(createStrengthGraphModel(points).status).toBe('ready')
  })

  it('formats estimates and the graph summary in the chosen unit', () => {
    // 225 lb -> 102.0 kg (snapped to 0.5), pounds stay integer.
    expect(formatEstimatedWeight(225, 'lb')).toBe('225 lb')
    expect(formatEstimatedWeight(225, 'kg')).toBe('102 kg')

    const points = createStrengthGraphPoints([
      structure({
        workoutId: 'a',
        completedAt: '2026-06-01T12:00:00.000Z',
        localDate: '2026-06-01',
        sets: [set({ id: 's1', weight: 100, reps: 1 })],
      }),
      structure({
        workoutId: 'b',
        completedAt: '2026-06-08T12:00:00.000Z',
        localDate: '2026-06-08',
        sets: [set({ id: 's2', weight: 110, reps: 1 })],
      }),
    ])
    const kgModel = createStrengthGraphModel(points, 'kg')
    // 110 lb -> 49.895 kg -> 50 (0.5 snap); summary carries the kg suffix.
    expect(kgModel.status !== 'empty' ? kgModel.summary : '').toContain('50 kg')
    expect(kgModel.status !== 'empty' ? kgModel.summary : '').not.toContain(
      ' lb',
    )
  })

  it('sums completed set volume per exercise and workout', () => {
    const points = createStrengthGraphPoints([
      structure({
        workoutId: 'volume-session',
        completedAt: '2026-06-01T12:00:00.000Z',
        sets: [
          set({ id: 's1', weight: 100, reps: 5 }),
          set({ id: 's2', weight: 100, reps: 5 }),
          set({ id: 's3', weight: 100, reps: 5, completed: false }),
        ],
      }),
    ])

    expect(points[0]).toMatchObject({
      totalVolume: 1_000,
      completedSetCount: 2,
    })
    expect(listStrengthExerciseOptions(points, 'volume')).toHaveLength(1)
    const model = createStrengthGraphModel(points, 'lb', 'volume')
    expect(model.status).toBe('single')
    expect(model.status === 'empty' ? '' : model.summary).toContain(
      'latest total volume: 1,000 lb',
    )
    expect(formatTotalVolume(1_000, 'kg')).toBe('453.6 kg')
  })

  it('includes high-repetition completed sets in volume without estimating 1RM', () => {
    const points = createStrengthGraphPoints([
      structure({
        workoutId: 'high-rep-session',
        completedAt: '2026-06-01T12:00:00.000Z',
        sets: [set({ id: 's1', weight: 50, reps: 20 })],
      }),
    ])

    expect(points[0]).toMatchObject({
      estimatedOneRepMax: null,
      totalVolume: 1_000,
    })
    expect(createStrengthGraphModel(points).status).toBe('empty')
    expect(createStrengthGraphModel(points, 'lb', 'volume').status).toBe(
      'single',
    )
  })

  it('excludes deload workouts from both estimated 1RM and volume points', () => {
    const points = createStrengthGraphPoints([
      structure({
        workoutId: 'regular',
        completedAt: '2026-06-01T12:00:00.000Z',
        sets: [set({ id: 'regular-set', weight: 100, reps: 5 })],
      }),
      structure({
        workoutId: 'deload',
        completedAt: '2026-06-08T12:00:00.000Z',
        isDeload: true,
        sets: [set({ id: 'deload-set', weight: 90, reps: 5 })],
      }),
    ])

    expect(points.map((point) => point.workoutId)).toEqual(['regular'])
  })
})

function structure({
  workoutId,
  completedAt,
  localDate = completedAt.slice(0, 10) as WorkoutHistoryEntry['localDate'],
  trackingMethodId = 'weight_reps',
  isDeload = false,
  sets,
}: {
  workoutId: string
  completedAt: string
  localDate?: WorkoutHistoryEntry['localDate']
  trackingMethodId?: WorkoutHistoryExercise['exerciseSnapshot']['trackingMethodId']
  isDeload?: boolean
  sets: WorkoutHistorySet[]
}) {
  const exercise: WorkoutHistoryExercise = {
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
    sourcePrescribedExerciseId: 'source',
    orderIndex: 0,
    notes: '',
    skipped: false,
    replacementOfExerciseId: null,
    createdAt: completedAt,
    updatedAt: completedAt,
  }
  const workout: WorkoutHistoryEntry = {
    id: workoutId,
    sourceActiveCycleId: 'cycle',
    sourceTemplateId: 'template',
    sourceDayId: 'day',
    localDate,
    name: 'Upper',
    workoutSnapshot: {
      activeCycleName: 'Program',
      templateName: 'Program',
      dayName: 'Upper',
      dayNotes: '',
    },
    notes: '',
    startedAt: completedAt,
    completedAt,
    durationSeconds: 1800,
    elapsedPausedSeconds: 0,
    activeRestTimer: null,
    status: 'completed',
    isDeload,
    createdAt: completedAt,
    updatedAt: completedAt,
  }
  return {
    workout,
    exercises: [exercise],
    setsByExercise: {
      [exercise.id]: sets.map((workoutSet, index) => ({
        ...workoutSet,
        workoutId,
        workoutExerciseId: exercise.id,
        setNumber: index + 1,
      })),
    },
  }
}

function set({
  id,
  weight,
  reps,
  completed = true,
}: {
  id: string
  weight: number
  reps: number
  completed?: boolean
}): WorkoutHistorySet {
  return {
    id,
    workoutId: 'workout',
    workoutExerciseId: 'exercise',
    setNumber: 1,
    targetSnapshot: null,
    targetRecommendation: null,
    metricValues: { weight, reps },
    rir: null,
    completed,
    completedAt: completed ? '2026-06-01T12:10:00.000Z' : null,
    restSecondsUsed: null,
  }
}
