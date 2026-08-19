import { getTrackingMethod } from '@domain/trackingMethods'
import { formatWorkoutDuration } from '@domain/workoutTiming'
import type {
  TrackingMetric,
  WorkoutHistoryEntry,
  WorkoutHistoryExercise,
  WorkoutHistorySet,
} from '@shared-types/app'

export type WorkoutHistoryStructure = {
  workout: WorkoutHistoryEntry
  exercises: WorkoutHistoryExercise[]
  setsByExercise: Record<string, WorkoutHistorySet[]>
}

export function hasRecordedExercisePerformance(
  sets: WorkoutHistorySet[],
): boolean {
  return sets.some((set) => hasSetPerformance(set))
}

export function hasExercisePerformance(sets: WorkoutHistorySet[]): boolean {
  return sets.some((set) => hasSetPerformance(set))
}

export function summarizeHistoryWorkout(structure: WorkoutHistoryStructure) {
  const performedExerciseIds = structure.exercises
    .filter((exercise) =>
      hasExercisePerformance(structure.setsByExercise[exercise.id] ?? []),
    )
    .map((exercise) => exercise.id)

  const sets = performedExerciseIds.flatMap(
    (exerciseId) => structure.setsByExercise[exerciseId] ?? [],
  )

  return {
    completedSetCount: sets.filter((set) => set.completed).length,
    exerciseCount: performedExerciseIds.length,
  }
}

export function qualifiesForWorkoutHistory(structure: WorkoutHistoryStructure) {
  return (
    Boolean(structure.workout.completedAt) &&
    summarizeHistoryWorkout(structure).exerciseCount > 0
  )
}

export function workoutHistoryType(workout: WorkoutHistoryEntry) {
  return workout.workoutSnapshot.templateName || workout.sourceTemplateId
    ? 'Strength'
    : 'Workout'
}

export function exerciseHistorySummary(
  exercise: WorkoutHistoryExercise,
  sets: WorkoutHistorySet[],
) {
  const completed = sets.filter((set) => set.completed)
  const methodId = exercise.exerciseSnapshot.trackingMethodId

  if (methodId === 'distance_duration') {
    const distance = completed
      .map((set) => numberValue(set.metricValues.distance))
      .find((value) => value !== null)
    if (distance !== undefined && distance !== null) {
      return `${completed.length || sets.length} x ${formatMetricValue(
        'distance',
        distance,
      )}`
    }
  }

  if (methodId === 'duration') {
    return `${completed.length || sets.length} holds`
  }

  if (methodId === 'reps_only') {
    return `${sumReps(completed.length ? completed : sets)} reps`
  }

  return `${completed.length} completed sets`
}

export function formatHistorySetMetric(metric: TrackingMetric, value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }
  return `${metric.label}: ${formatMetricValue(metric.key, value)}`
}

export function historyMetricsForExercise(exercise: WorkoutHistoryExercise) {
  return (
    exercise.exerciseSnapshot.trackingMetrics ??
    getTrackingMethod(exercise.exerciseSnapshot.trackingMethodId)?.metrics ??
    []
  )
}

export function formatHistoryDate(localDate: string) {
  const [year, month, day] = localDate.split('-').map(Number)
  if (!year || !month || !day) {
    return localDate
  }
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

export function formatHistoryDuration(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) {
    return null
  }
  return formatWorkoutDuration(seconds)
}

function hasSetPerformance(set: WorkoutHistorySet) {
  if (set.completed) {
    return true
  }
  return Object.values(set.metricValues).some(
    (value) =>
      value === true || (typeof value === 'number' && Number.isFinite(value)),
  )
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function sumReps(sets: WorkoutHistorySet[]) {
  return sets.reduce(
    (total, set) => total + (numberValue(set.metricValues.reps) ?? 0),
    0,
  )
}

function formatMetricValue(metricKey: string, value: number) {
  if (metricKey === 'durationSeconds') {
    const minutes = Math.floor(value / 60)
    const seconds = value % 60
    return minutes
      ? `${minutes}:${seconds.toString().padStart(2, '0')}`
      : `${seconds}s`
  }
  if (metricKey === 'distance') {
    const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1)
    return `${formatted} ft`
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
