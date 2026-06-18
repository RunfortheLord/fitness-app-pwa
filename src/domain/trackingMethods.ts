import type { TrackingMethod } from '@shared-types/app'

export const TRACKING_METHODS = [
  {
    id: 'weight_reps',
    name: 'Weight + reps',
    metrics: [
      {
        key: 'weight',
        label: 'Weight',
        valueType: 'number',
        unit: 'lb',
        requiredForCompletion: true,
      },
      {
        key: 'reps',
        label: 'Reps',
        valueType: 'integer',
        unit: null,
        requiredForCompletion: true,
      },
    ],
  },
  {
    id: 'bodyweight_reps',
    name: 'Bodyweight + reps',
    metrics: [
      {
        key: 'reps',
        label: 'Reps',
        valueType: 'integer',
        unit: null,
        requiredForCompletion: true,
      },
    ],
  },
  {
    id: 'assisted_weight_reps',
    name: 'Assisted weight + reps',
    metrics: [
      {
        key: 'assistedWeight',
        label: 'Assisted weight',
        valueType: 'number',
        unit: 'lb',
        requiredForCompletion: true,
      },
      {
        key: 'reps',
        label: 'Reps',
        valueType: 'integer',
        unit: null,
        requiredForCompletion: true,
      },
    ],
  },
  {
    id: 'reps_only',
    name: 'Reps only',
    metrics: [
      {
        key: 'reps',
        label: 'Reps',
        valueType: 'integer',
        unit: null,
        requiredForCompletion: true,
      },
    ],
  },
  {
    id: 'duration',
    name: 'Duration',
    metrics: [
      {
        key: 'durationSeconds',
        label: 'Duration',
        valueType: 'durationSeconds',
        unit: 's',
        requiredForCompletion: true,
      },
    ],
  },
  {
    id: 'distance_duration',
    name: 'Distance + duration',
    metrics: [
      {
        key: 'distance',
        label: 'Distance',
        valueType: 'number',
        unit: 'mi',
        requiredForCompletion: true,
      },
      {
        key: 'durationSeconds',
        label: 'Duration',
        valueType: 'durationSeconds',
        unit: 's',
        requiredForCompletion: true,
      },
    ],
  },
] satisfies TrackingMethod[]

export function getTrackingMethod(id: TrackingMethod['id']) {
  return TRACKING_METHODS.find((method) => method.id === id)
}
