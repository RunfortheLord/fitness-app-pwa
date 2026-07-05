import { TRACKING_METHODS, getTrackingMethod } from '@domain/trackingMethods'
import type { Exercise } from '@shared-types/app'

export function parseTrackingMethodId(value: string) {
  return TRACKING_METHODS.find((method) => method.id === value)?.id ?? null
}

export function metricSummary(exercise: Exercise) {
  const metricLabels = exercise.trackingMetrics.map((metric) => metric.label)
  return [...metricLabels, 'RIR', 'Completed'].join(' - ')
}

export function exerciseMetadata(exercise: Exercise) {
  const trackingMethod = getTrackingMethod(exercise.trackingMethodId)
  const muscles = exercise.primaryMuscleGroups.join(', ') || 'No muscle group'
  return `${formatEquipment(exercise.equipmentType)} - ${muscles} - ${
    trackingMethod?.name ?? exercise.trackingMethodId
  }${exercise.origin === 'custom' ? ' - Custom' : ''}`
}

export function exerciseLibraryMetadata(exercise: Exercise) {
  const trackingMethod = getTrackingMethod(exercise.trackingMethodId)
  const trackingLabel = trackingMethod?.name ?? exercise.trackingMethodId
  if (exercise.origin === 'built_in') {
    return `${trackingLabel} - Built-in - ${exercise.defaultRestSeconds}s rest`
  }
  return `${trackingLabel} - ${exercise.defaultRestSeconds}s rest - Custom`
}

export function isRepetitionBased(exercise: Exercise) {
  return exercise.trackingMetrics.some((metric) => metric.key === 'reps')
}

export function showsWeightTarget(exercise: Exercise) {
  return exercise.trackingMetrics.some((metric) =>
    ['weight', 'assistedWeight', 'addedWeight'].includes(metric.key),
  )
}

function formatEquipment(equipment: Exercise['equipmentType']) {
  return equipment
    .split('_')
    .map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1))
    .join(' ')
}

export function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp))
}
