import { estimateOneRepMax } from '@domain/strengthProgress'

export function suggestedWeightForReps({
  previousWeight,
  previousReps,
  targetReps,
  weightIncrement,
}: {
  previousWeight: number
  previousReps: number
  targetReps: number
  weightIncrement: number | null | undefined
}) {
  const estimate = estimateOneRepMax(previousWeight, previousReps)
  if (estimate === null || !positiveFinite(targetReps)) {
    return previousWeight
  }
  const unrounded =
    targetReps === 1 ? estimate : estimate / (1 + targetReps / 30)
  if (!positiveFinite(unrounded)) {
    return previousWeight
  }
  if (typeof weightIncrement !== 'number' || !positiveFinite(weightIncrement)) {
    return normalize(unrounded)
  }
  return normalize(
    Math.max(
      weightIncrement,
      Math.round(unrounded / weightIncrement) * weightIncrement,
    ),
  )
}

function positiveFinite(value: number) {
  return Number.isFinite(value) && value > 0
}

function normalize(value: number) {
  return Number(value.toFixed(6))
}
