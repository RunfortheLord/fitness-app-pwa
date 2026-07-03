import {
  clampProgramDurationWeeks,
  DEFAULT_PROGRAM_DURATION_WEEKS,
} from '@domain/programWeeks'
import { getTrackingMethod } from '@domain/trackingMethods'
import { weightInputToLb, weightInputValue } from '@domain/weightUnits'
import type { CreateExerciseInput } from '@repositories/exerciseRepository'
import type { CreateTemplateExerciseInput } from '@repositories/programRepository'
import type {
  ActiveCycleWorkoutExercise,
  ActiveProgramCycle,
  BodyweightLoadMode,
  Exercise,
  ProgramTemplate,
  TemplateWorkoutExercise,
  TrackingMethodId,
  WeightUnit,
} from '@shared-types/app'

import { isRepetitionBased, showsWeightTarget } from './exerciseMetadata'

export type ExerciseFormState = {
  bodyweightLoadMode: BodyweightLoadMode
  bodyweightPercentage: string
  name: string
  notes: string
  restMinutes: string
  restSeconds: string
  trackingMethodId: TrackingMethodId
}

export type ProgramFormState = {
  name: string
  durationWeeks: string
}

export type PrescriptionFormState = {
  exerciseId: string
  restMinutes: string
  restSeconds: string
  targetSetCount: string
  targetWeight: string
  targetDurationSeconds: string
  targetDistance: string
  targetRepsMin: string
  targetRepsMax: string
  targetRir: string
  notes: string
}

export const emptyExerciseForm: ExerciseFormState = {
  bodyweightLoadMode: 'external_weight_only',
  bodyweightPercentage: '',
  name: '',
  notes: '',
  restMinutes: '2',
  restSeconds: '0',
  trackingMethodId: 'weight_reps',
}

export const emptyProgramForm: ProgramFormState = {
  name: '',
  durationWeeks: String(DEFAULT_PROGRAM_DURATION_WEEKS),
}

export const emptyPrescriptionForm: PrescriptionFormState = {
  exerciseId: '',
  restMinutes: '2',
  restSeconds: '0',
  targetSetCount: '3',
  targetWeight: '',
  targetDurationSeconds: '',
  targetDistance: '',
  targetRepsMin: '',
  targetRepsMax: '',
  targetRir: '',
  notes: '',
}

// Forms keep the week count as a string; coerce to a clamped number (falling
// back to the default when blank/invalid) before persisting.
export function parseDurationWeeks(value: string): number {
  const parsed = Number.parseInt(value, 10)
  return clampProgramDurationWeeks(
    Number.isFinite(parsed) ? parsed : DEFAULT_PROGRAM_DURATION_WEEKS,
  )
}

export function programFormFromRecord(
  record: ProgramTemplate | ActiveProgramCycle,
): ProgramFormState {
  return {
    name: record.name,
    durationWeeks: String(
      record.durationWeeks ?? DEFAULT_PROGRAM_DURATION_WEEKS,
    ),
  }
}

export function parseExerciseForm(
  form: ExerciseFormState,
): { ok: true; value: CreateExerciseInput } | { ok: false; error: string } {
  const name = form.name.trim()
  const restDuration = parseRestDuration(form.restMinutes, form.restSeconds)
  const trackingMethod = getTrackingMethod(form.trackingMethodId)
  const bodyweightPercentage =
    form.bodyweightLoadMode === 'bodyweight_percentage_plus_external'
      ? parseOptionalNumber(form.bodyweightPercentage)
      : { ok: true, value: null as number | null }

  if (!name) {
    return { ok: false, error: 'Exercise name is required.' }
  }

  if (!restDuration.ok) {
    return restDuration
  }

  if (!trackingMethod) {
    return { ok: false, error: 'Tracking preset is required.' }
  }
  if (
    !bodyweightPercentage.ok ||
    (form.bodyweightLoadMode === 'bodyweight_percentage_plus_external' &&
      (bodyweightPercentage.value === null ||
        bodyweightPercentage.value < 0 ||
        bodyweightPercentage.value > 100))
  ) {
    return { ok: false, error: 'Bodyweight percentage must be 0 through 100.' }
  }

  return {
    ok: true,
    value: {
      name,
      notes: form.notes.trim(),
      defaultRestSeconds: restDuration.value,
      trackingMethodId: trackingMethod.id,
      bodyweightLoadMode: form.bodyweightLoadMode,
      bodyweightPercentage: bodyweightPercentage.value,
    },
  }
}

export function parseRestDuration(
  restMinutesInput: string,
  restSecondsInput: string,
): { ok: true; value: number } | { ok: false; error: string } {
  const restMinutes = Number(restMinutesInput)
  const restSeconds = Number(restSecondsInput)

  if (
    !Number.isFinite(restMinutes) ||
    !Number.isInteger(restMinutes) ||
    restMinutes < 0 ||
    !Number.isFinite(restSeconds) ||
    !Number.isInteger(restSeconds) ||
    restSeconds < 0
  ) {
    return {
      ok: false,
      error: 'Default rest time must use whole minutes and seconds.',
    }
  }

  return { ok: true, value: restMinutes * 60 + restSeconds }
}

export function restFieldsFromSeconds(defaultRestSeconds: number) {
  return {
    restMinutes: String(Math.floor(defaultRestSeconds / 60)),
    restSeconds: String(defaultRestSeconds % 60),
  }
}

export function parsePrescriptionForm(
  form: PrescriptionFormState,
  exercise: Exercise | null,
  unit: WeightUnit = 'lb',
):
  | { ok: true; value: CreateTemplateExerciseInput }
  | { ok: false; error: string } {
  const targetSetCount = Number(form.targetSetCount)
  const targetWeight = parseOptionalNumber(form.targetWeight)
  const targetDurationSeconds = { ok: true, value: null } as const
  const targetDistance = parseOptionalNumber(form.targetDistance)
  const targetRepsMin = parseOptionalInteger(form.targetRepsMin)
  const targetRepsMax = parseOptionalInteger(form.targetRepsMax)
  const targetRir = parseOptionalInteger(form.targetRir)

  if (!form.exerciseId || !exercise) {
    return { ok: false, error: 'Exercise selection is required.' }
  }

  if (
    !Number.isInteger(targetSetCount) ||
    targetSetCount <= 0 ||
    targetSetCount > 99
  ) {
    return { ok: false, error: 'Target sets must be a positive whole number.' }
  }

  if (!targetRepsMin.ok || !targetRepsMax.ok || !targetRir.ok) {
    return { ok: false, error: 'Optional targets must be whole numbers.' }
  }

  if (!targetWeight.ok || !targetDurationSeconds.ok || !targetDistance.ok) {
    return { ok: false, error: 'Targets must be valid positive numbers.' }
  }
  const targetWeightValue = targetWeight.value
  const targetDurationSecondsValue = targetDurationSeconds.value
  const targetDistanceValue = targetDistance.value

  if (isRepetitionBased(exercise)) {
    if (targetRepsMin.value === null || targetRepsMax.value === null) {
      return { ok: false, error: 'Minimum and maximum reps are required.' }
    }
    if (targetRepsMin.value <= 0 || targetRepsMax.value <= 0) {
      return { ok: false, error: 'Reps must be positive whole numbers.' }
    }
  }

  if (
    showsWeightTarget(exercise) &&
    targetWeightValue !== null &&
    targetWeightValue < 0
  ) {
    return { ok: false, error: 'Weight target cannot be negative.' }
  }

  if (
    exercise.trackingMethodId === 'distance_duration' &&
    (targetDistanceValue === null || targetDistanceValue <= 0)
  ) {
    return { ok: false, error: 'Distance target must be positive.' }
  }

  if (
    targetRepsMin.ok &&
    targetRepsMax.ok &&
    targetRepsMin.value !== null &&
    targetRepsMax.value !== null &&
    targetRepsMin.value > targetRepsMax.value
  ) {
    return { ok: false, error: 'Rep minimum cannot exceed rep maximum.' }
  }

  return {
    ok: true,
    value: {
      exerciseId: form.exerciseId,
      targetSetCount,
      // The form edits weight in the display unit; persist canonical pounds.
      targetWeight:
        targetWeightValue === null
          ? null
          : weightInputToLb(targetWeightValue, unit),
      targetDurationSeconds: targetDurationSecondsValue,
      targetDistance: targetDistanceValue,
      targetRepsMin: targetRepsMin.value,
      targetRepsMax: targetRepsMax.value,
      targetRir: targetRir.value,
      // Existing stored overrides are still honored in summaries and workout
      // creation, but new prescription edits normalize to the exercise default.
      restSecondsOverride: null,
      notes: form.notes.trim(),
    },
  }
}

function parseOptionalInteger(
  value: string,
): { ok: true; value: number | null } | { ok: false } {
  if (!value.trim()) {
    return { ok: true, value: null } as const
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    return { ok: false } as const
  }

  return { ok: true, value: parsed } as const
}

function parseOptionalNumber(
  value: string,
): { ok: true; value: number | null } | { ok: false } {
  if (!value.trim()) {
    return { ok: true, value: null } as const
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
    return { ok: false } as const
  }

  return { ok: true, value: parsed } as const
}

export function formIsDirty(
  form: PrescriptionFormState,
  exercise: TemplateWorkoutExercise | ActiveCycleWorkoutExercise | null,
  unit: WeightUnit = 'lb',
  selectedExercise: Exercise | null = null,
) {
  if (!exercise) {
    return (
      form.exerciseId !== '' ||
      form.restMinutes !== emptyPrescriptionForm.restMinutes ||
      form.restSeconds !== emptyPrescriptionForm.restSeconds ||
      form.targetSetCount !== emptyPrescriptionForm.targetSetCount ||
      form.targetWeight !== '' ||
      form.targetDurationSeconds !== '' ||
      form.targetDistance !== '' ||
      form.targetRepsMin !== '' ||
      form.targetRepsMax !== '' ||
      form.targetRir !== '' ||
      form.notes !== ''
    )
  }

  const defaultRestSeconds =
    selectedExercise?.defaultRestSeconds ??
    exercise.exerciseSnapshot.defaultRestSeconds
  const restFields = restFieldsFromSeconds(defaultRestSeconds)
  return (
    form.exerciseId !== exercise.exerciseId ||
    form.restMinutes !== restFields.restMinutes ||
    form.restSeconds !== restFields.restSeconds ||
    form.targetSetCount !== String(exercise.targetSetCount) ||
    form.targetWeight !==
      weightInputValue(exercise.targetWeight, unit, 'lifting') ||
    form.targetDurationSeconds !==
      (exercise.targetDurationSeconds?.toString() ?? '') ||
    form.targetDistance !== (exercise.targetDistance?.toString() ?? '') ||
    form.targetRepsMin !== (exercise.targetRepsMin?.toString() ?? '') ||
    form.targetRepsMax !== (exercise.targetRepsMax?.toString() ?? '') ||
    form.targetRir !== (exercise.targetRir?.toString() ?? '') ||
    form.notes !== exercise.notes
  )
}
