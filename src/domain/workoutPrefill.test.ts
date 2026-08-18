import { describe, expect, it } from 'vitest'

import {
  buildDeloadPrefillPlan,
  buildWorkoutPrefillPlan,
  type WorkoutPrefillSourceSet,
} from '@domain/workoutPrefill'

describe('workout prefill', () => {
  it('returns no plan without completed exercise history', () => {
    expect(buildPlan({ previousSets: [] })).toBeNull()
  })

  it('centers a cross-day estimate and carries observed fatigue through later sets', () => {
    const plan = buildPlan({
      previousSets: [
        sourceSet(1, 200, 10),
        sourceSet(2, 200, 10),
        sourceSet(3, 200, 9),
      ],
      targetSetCount: 3,
      sameProgramDay: false,
    })

    expect(plan?.sets.map(({ load, reps }) => ({ load, reps }))).toEqual([
      { load: 200, reps: 10 },
      { load: 200, reps: 10 },
      { load: 200, reps: 9 },
    ])
  })

  it('rounds a changed rep scheme to the nearest five pounds', () => {
    const plan = buildPlan({
      previousSets: [sourceSet(1, 200, 5)],
      targetSetCount: 1,
      sameProgramDay: false,
    })

    expect(plan?.sets[0]).toMatchObject({ load: 175, reps: 10 })
  })

  it('advances one same-day repetition where it best preserves the fatigue sequence', () => {
    const plan = buildPlan({
      previousSets: [
        sourceSet(1, 200, 10),
        sourceSet(2, 200, 10),
        sourceSet(3, 200, 9),
      ],
      targetSetCount: 3,
      sameProgramDay: true,
    })

    expect(plan?.sets.map((set) => set.reps)).toEqual([10, 10, 10])
    expect(plan?.loadProgressed).toBe(false)
  })

  it('never turns historical fatigue into a different rep scheme', () => {
    const plan = buildPlan({
      previousSets: [
        sourceSet(1, 200, 12),
        sourceSet(2, 200, 6),
        sourceSet(3, 200, 6),
      ],
      targetSetCount: 3,
      targetRepsMin: 6,
      targetRepsMax: 12,
      sameProgramDay: true,
    })

    expect(plan?.sets.map((set) => set.reps)).toEqual([12, 10, 10])
    expect(
      Math.max(...plan!.sets.map((set) => set.reps)) -
        Math.min(...plan!.sets.map((set) => set.reps)),
    ).toBeLessThanOrEqual(2)
  })

  it('uses RIR-adjusted capacity when adding five pounds after the full top range', () => {
    const plan = buildPlan({
      previousSets: [
        sourceSet(1, 100, 12, 0),
        sourceSet(2, 100, 12, 0),
        sourceSet(3, 100, 12, 0),
      ],
      targetSetCount: 3,
      sameProgramDay: true,
    })

    expect(plan?.sets.map(({ load, reps }) => ({ load, reps }))).toEqual([
      { load: 105, reps: 8 },
      { load: 105, reps: 8 },
      { load: 105, reps: 8 },
    ])
    expect(plan?.loadProgressed).toBe(true)
  })

  it('holds load when five pounds would miss the range at the target RIR', () => {
    const plan = buildPlan({
      previousSets: [sourceSet(1, 135, 10, 0), sourceSet(2, 135, 10, 0)],
      targetSetCount: 2,
      targetRepsMin: 8,
      targetRepsMax: 10,
      sameProgramDay: true,
    })

    expect(plan?.sets.map(({ load, reps }) => ({ load, reps }))).toEqual([
      { load: 135, reps: 11 },
      { load: 135, reps: 10 },
    ])
    expect(plan?.loadProgressed).toBe(false)
  })

  it('centers reps-only history while preserving its fatigue pattern', () => {
    const plan = buildPlan({
      previousSets: [sourceSet(1, null, 15), sourceSet(2, null, 13)],
      targetSetCount: 3,
      sameProgramDay: false,
      trackingMethodId: 'reps_only',
    })

    expect(plan?.sets.map((set) => set.reps)).toEqual([10, 8, 8])
    expect(plan?.sets.every((set) => set.load === null)).toBe(true)
  })

  it('keeps zero added-weight history usable without inventing external load', () => {
    const plan = buildPlan({
      previousSets: [sourceSet(1, 0, 11), sourceSet(2, 0, 9)],
      targetSetCount: 2,
      sameProgramDay: false,
      trackingMethodId: 'added_weight_reps',
    })

    expect(plan?.sets.map(({ load, reps }) => ({ load, reps }))).toEqual([
      { load: 0, reps: 10 },
      { load: 0, reps: 8 },
    ])
  })

  it('builds reduced deload estimates directly from remembered history', () => {
    const weighted = buildDeloadPrefillPlan({
      previousSets: [sourceSet(1, 200, 10, 2)],
      targetSetCount: 2,
      targetRepsMin: 8,
      targetRepsMax: 12,
      targetRir: 2,
      trackingMethodId: 'weight_reps',
    })
    expect(weighted?.sets).toHaveLength(2)
    expect(weighted?.sets[0].load).toBeLessThan(200)

    const repsOnly = buildDeloadPrefillPlan({
      previousSets: [sourceSet(1, null, 12, 2)],
      targetSetCount: 1,
      targetRepsMin: 8,
      targetRepsMax: 12,
      targetRir: 2,
      trackingMethodId: 'reps_only',
    })
    expect(repsOnly?.sets[0]).toMatchObject({ load: null, reps: 7 })
  })
})

function buildPlan(
  overrides: Partial<Parameters<typeof buildWorkoutPrefillPlan>[0]> = {},
) {
  return buildWorkoutPrefillPlan({
    previousSets: [],
    targetSetCount: 3,
    targetRepsMin: 8,
    targetRepsMax: 12,
    targetRir: 2,
    trackingMethodId: 'weight_reps',
    sameProgramDay: false,
    ...overrides,
  })
}

function sourceSet(
  setNumber: number,
  load: number | null,
  reps: number,
  rir: number | null = null,
): WorkoutPrefillSourceSet {
  return { id: `set-${setNumber}`, setNumber, load, reps, rir }
}
