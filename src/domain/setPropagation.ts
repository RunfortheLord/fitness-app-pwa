import type { WorkoutSet } from '@shared-types/app'

export type PropagateSetMetricInput = {
  allSets: WorkoutSet[]
  sourceSet: WorkoutSet
  metricKey: string
  value: number | boolean | null
}

export type PropagatedSetUpdate = {
  setId: string
  metricValues: WorkoutSet['metricValues']
  metricValueSources: NonNullable<WorkoutSet['metricValueSources']>
}

export function buildSetMetricPropagationUpdates({
  allSets,
  metricKey,
  sourceSet,
  value,
}: PropagateSetMetricInput): PropagatedSetUpdate[] {
  const currentSources = { ...(sourceSet.metricValueSources ?? {}) }
  const updates: PropagatedSetUpdate[] = [
    {
      setId: sourceSet.id,
      metricValues: { ...sourceSet.metricValues, [metricKey]: value },
      metricValueSources: {
        ...currentSources,
        [metricKey]: value === null ? 'manual' : 'manual',
      },
    },
  ]

  if (value === null) {
    return updates
  }

  const laterSets = [...allSets]
    .filter((set) => set.setNumber > sourceSet.setNumber)
    .sort((left, right) => left.setNumber - right.setNumber)

  for (const candidate of laterSets) {
    if (candidate.completed) {
      break
    }

    const candidateSources = candidate.metricValueSources ?? {}
    const existingValue = candidate.metricValues[metricKey]
    const source = candidateSources[metricKey]
    const eligible =
      existingValue === undefined || existingValue === null || source === 'auto'

    if (!eligible) {
      break
    }

    updates.push({
      setId: candidate.id,
      metricValues: {
        ...candidate.metricValues,
        [metricKey]: value,
      },
      metricValueSources: { ...candidateSources, [metricKey]: 'auto' },
    })
  }

  return updates
}
