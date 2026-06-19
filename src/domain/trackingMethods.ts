import type { TrackingMethod } from '@shared-types/app'

export const TRACKING_METHODS = [
  {
    id: 'weight_reps',
    name: 'Weight + reps',
    explanation:
      'Use for loaded movements where each set records external weight and repetitions.',
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
    explanation:
      'Legacy preset for bodyweight movements where each set records repetitions only.',
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
    explanation:
      'Use for assisted movements where each set records assistance weight and repetitions.',
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
    id: 'added_weight_reps',
    name: 'Added weight + reps',
    explanation:
      'Use for bodyweight movements where each set records external added load and repetitions.',
    metrics: [
      {
        key: 'addedWeight',
        label: 'Added weight',
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
    explanation:
      'Use for movements where repetitions are the only performance value.',
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
    explanation: 'Use for timed work where each set records duration.',
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
    name: 'Distance',
    explanation: 'Use for carries where each set records distance.',
    metrics: [
      {
        key: 'distance',
        label: 'Distance',
        valueType: 'number',
        unit: 'ft',
        requiredForCompletion: true,
      },
    ],
  },
] satisfies TrackingMethod[]

export function getTrackingMethod(id: TrackingMethod['id']) {
  return TRACKING_METHODS.find((method) => method.id === id)
}
