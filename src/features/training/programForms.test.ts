import { describe, expect, it } from 'vitest'

import { getTrackingMethod } from '@domain/trackingMethods'
import type { Exercise } from '@shared-types/app'

import { parsePrescriptionForm, emptyPrescriptionForm } from './programForms'

const exercise: Exercise = {
  id: 'exercise-1',
  name: 'Bench press',
  notes: '',
  defaultRestSeconds: 120,
  defaultWeightIncrement: null,
  trackingMethodId: 'weight_reps',
  trackingMetrics: getTrackingMethod('weight_reps')!.metrics,
  primaryMuscleGroups: [],
  secondaryMuscleGroups: [],
  equipmentType: 'barbell',
  recordsRepsPerSide: false,
  origin: 'custom',
  seedDataVersion: null,
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('parsePrescriptionForm', () => {
  it('allows a prescription without optional rep targets', () => {
    const result = parsePrescriptionForm(
      { ...emptyPrescriptionForm, exerciseId: exercise.id },
      exercise,
    )

    expect(result).toMatchObject({
      ok: true,
      value: { targetRepsMin: null, targetRepsMax: null },
    })
  })

  it('rejects a nonpositive rep target', () => {
    const result = parsePrescriptionForm(
      { ...emptyPrescriptionForm, exerciseId: exercise.id, targetRepsMin: '0' },
      exercise,
    )

    expect(result).toMatchObject({ ok: false })
  })

  it('preserves an optional duration target', () => {
    const result = parsePrescriptionForm(
      {
        ...emptyPrescriptionForm,
        exerciseId: exercise.id,
        targetDurationSeconds: '45',
      },
      {
        ...exercise,
        trackingMethodId: 'duration',
        trackingMetrics: getTrackingMethod('duration')!.metrics,
      },
    )

    expect(result).toMatchObject({
      ok: true,
      value: { targetDurationSeconds: 45 },
    })
  })
})
