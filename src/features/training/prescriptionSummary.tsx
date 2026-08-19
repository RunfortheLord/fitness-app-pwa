import { formatWeight as formatWeightWithUnit } from '@domain/weightUnits'
import { useWeightUnit } from '@hooks/useWeightUnit'
import type { CreateTemplateExerciseInput } from '@repositories/programRepository'
import type {
  ActiveCycleWorkoutExercise,
  TemplateWorkoutExercise,
  WeightUnit,
} from '@shared-types/app'

type PrescriptionTargets = Pick<
  TemplateWorkoutExercise,
  | 'targetSetCount'
  | 'targetWeight'
  | 'targetDurationSeconds'
  | 'targetDistance'
  | 'targetRepsMin'
  | 'targetRepsMax'
  | 'targetRir'
  | 'restSecondsOverride'
>

export function PrescriptionSummaryText({
  prescribed,
}: {
  prescribed: TemplateWorkoutExercise | ActiveCycleWorkoutExercise
}) {
  const weightUnit = useWeightUnit()
  return <>{prescriptionSummary(prescribed, weightUnit)}</>
}

/** Live preview of a not-yet-saved prescription form (weights already in lb). */
export function PrescriptionInputSummaryText({
  input,
}: {
  input: CreateTemplateExerciseInput
}) {
  const weightUnit = useWeightUnit()
  return (
    <>
      {prescriptionSummary(
        {
          targetSetCount: input.targetSetCount,
          targetWeight: input.targetWeight ?? null,
          targetDurationSeconds: input.targetDurationSeconds ?? null,
          targetDistance: input.targetDistance ?? null,
          targetRepsMin: input.targetRepsMin ?? null,
          targetRepsMax: input.targetRepsMax ?? null,
          targetRir: input.targetRir ?? null,
          restSecondsOverride: input.restSecondsOverride ?? null,
        },
        weightUnit,
      )}
    </>
  )
}

function prescriptionSummary(
  prescribed: PrescriptionTargets,
  unit: WeightUnit = 'lb',
) {
  const parts = [`${prescribed.targetSetCount} sets`]
  if (
    prescribed.targetWeight !== null &&
    prescribed.targetWeight !== undefined
  ) {
    parts.push(formatWeightWithUnit(prescribed.targetWeight, unit, 'lifting'))
  }
  if (
    prescribed.targetDurationSeconds !== null &&
    prescribed.targetDurationSeconds !== undefined
  ) {
    parts.push(`${prescribed.targetDurationSeconds}s`)
  }
  if (
    prescribed.targetDistance !== null &&
    prescribed.targetDistance !== undefined
  ) {
    parts.push(`${prescribed.targetDistance} ft`)
  }
  if (
    prescribed.targetRepsMin !== null &&
    prescribed.targetRepsMax !== null &&
    prescribed.targetRepsMin !== prescribed.targetRepsMax
  ) {
    parts.push(`${prescribed.targetRepsMin}-${prescribed.targetRepsMax} reps`)
  } else if (prescribed.targetRepsMin !== null) {
    parts.push(`${prescribed.targetRepsMin} reps`)
  } else if (prescribed.targetRepsMax !== null) {
    parts.push(`${prescribed.targetRepsMax} reps`)
  }
  if (prescribed.targetRir !== null) {
    parts.push(`${prescribed.targetRir} RIR`)
  }
  if (prescribed.restSecondsOverride !== null) {
    parts.push(`${prescribed.restSecondsOverride}s rest`)
  }
  return parts.join(' - ')
}
