import { describe, expect, it } from 'vitest'

import { buildSetMetricPropagationUpdates } from './setPropagation'
import type { WorkoutSet } from '@shared-types/app'

describe('buildSetMetricPropagationUpdates', () => {
  it('propagates one edited field to blank and auto-filled later sets', () => {
    const sets = [
      workoutSet(1, { weight: null }),
      workoutSet(2, {}),
      workoutSet(3, { weight: 95 }, { weight: 'auto' }),
    ]

    const updates = buildSetMetricPropagationUpdates({
      allSets: sets,
      sourceSet: sets[0],
      metricKey: 'weight',
      value: 100,
    })

    expect(updates.map((update) => update.metricValues.weight)).toEqual([
      100, 100, 100,
    ])
    expect(updates.map((update) => update.metricValueSources.weight)).toEqual([
      'manual',
      'auto',
      'auto',
    ])
  })

  it('preserves manually customized later fields and stops at the barrier', () => {
    const sets = [
      workoutSet(1, { reps: 5 }),
      workoutSet(2, { reps: 5 }, { reps: 'auto' }),
      workoutSet(3, { reps: 8 }, { reps: 'manual' }),
      workoutSet(4, { reps: 5 }, { reps: 'auto' }),
    ]

    const updates = buildSetMetricPropagationUpdates({
      allSets: sets,
      sourceSet: sets[1],
      metricKey: 'reps',
      value: 6,
    })

    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatchObject({
      setId: sets[1].id,
      metricValues: { reps: 6 },
      metricValueSources: { reps: 'manual' },
    })
  })

  it('propagates manually entered reps unchanged to eligible later sets', () => {
    const sets = [workoutSet(1, {}), workoutSet(2, {}), workoutSet(3, {})]

    const updates = buildSetMetricPropagationUpdates({
      allSets: sets,
      sourceSet: sets[0],
      metricKey: 'reps',
      value: 10,
    })

    expect(updates.map((update) => update.metricValues.reps)).toEqual([
      10, 10, 10,
    ])
  })

  it('does not clear later fields when the current field is cleared', () => {
    const sets = [
      workoutSet(1, { weight: 100 }),
      workoutSet(2, { weight: 100 }, { weight: 'auto' }),
    ]

    const updates = buildSetMetricPropagationUpdates({
      allSets: sets,
      sourceSet: sets[0],
      metricKey: 'weight',
      value: null,
    })

    expect(updates).toHaveLength(1)
    expect(updates[0].metricValues.weight).toBeNull()
  })

  it('stops at completed later sets', () => {
    const sets = [
      workoutSet(1, { reps: 5 }),
      workoutSet(2, { reps: 5 }, { reps: 'auto' }, true),
      workoutSet(3, { reps: 5 }, { reps: 'auto' }),
    ]

    const updates = buildSetMetricPropagationUpdates({
      allSets: sets,
      sourceSet: sets[0],
      metricKey: 'reps',
      value: 6,
    })

    expect(updates).toHaveLength(1)
  })
})

function workoutSet(
  setNumber: number,
  metricValues: WorkoutSet['metricValues'],
  metricValueSources: NonNullable<WorkoutSet['metricValueSources']> = {},
  completed = false,
): WorkoutSet {
  return {
    id: `set-${setNumber}`,
    workoutId: 'workout',
    workoutExerciseId: 'exercise',
    setNumber,
    targetSnapshot: null,
    targetRecommendation: null,
    metricValues,
    metricValueSources,
    rir: null,
    completed,
    completedAt: completed ? '2026-06-20T00:00:00.000Z' : null,
    restSecondsUsed: null,
    createdAt: '2026-06-20T00:00:00.000Z',
    updatedAt: '2026-06-20T00:00:00.000Z',
  }
}
