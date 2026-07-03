import { formatWeight as formatWeightWithUnit } from '@domain/weightUnits'
import { useWeightUnit } from '@hooks/useWeightUnit'
import type {
  ActiveCycleWorkoutExercise,
  TemplateWorkoutExercise,
  WeightUnit,
} from '@shared-types/app'

export function PrescriptionSummaryText({
  prescribed,
}: {
  prescribed: TemplateWorkoutExercise | ActiveCycleWorkoutExercise
}) {
  const weightUnit = useWeightUnit()
  return <>{prescriptionSummary(prescribed, weightUnit)}</>
}

function prescriptionSummary(
  prescribed: TemplateWorkoutExercise | ActiveCycleWorkoutExercise,
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
