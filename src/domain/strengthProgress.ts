import { subMonths } from 'date-fns'

import {
  formatLocalDate,
  parseLocalDate,
  type LocalDateString,
} from '@domain/dates'
import type {
  TrackingMethodId,
  WorkoutHistoryEntry,
  WorkoutHistoryExercise,
  WorkoutHistorySet,
} from '@shared-types/app'

export type StrengthRange = '1m' | '3m' | '6m' | '1y' | 'all'

export type StrengthGraphWorkout = {
  workout: WorkoutHistoryEntry
  exercises: WorkoutHistoryExercise[]
  setsByExercise: Record<string, WorkoutHistorySet[]>
}

export type StrengthGraphPoint = {
  id: string
  exerciseId: string
  exerciseName: string
  workoutId: string
  localDate: LocalDateString
  completedAt: string
  setNumber: number
  weight: number
  repetitions: number
  estimatedOneRepMax: number
  x: number
  y: number
}

export type StrengthExerciseOption = {
  exerciseId: string
  exerciseName: string
  latest: StrengthGraphPoint
  allTimeBest: StrengthGraphPoint
  pointCount: number
}

export type StrengthGraphModel =
  | { status: 'empty'; points: [] }
  | {
      status: 'single' | 'ready'
      points: StrengthGraphPoint[]
      minEstimate: number
      maxEstimate: number
      latest: StrengthGraphPoint
      allTimeBest: StrengthGraphPoint
      summary: string
    }

const rangeMonths: Record<Exclude<StrengthRange, 'all'>, number> = {
  '1m': 1,
  '3m': 3,
  '6m': 6,
  '1y': 12,
}

const weightedMethods = new Set<TrackingMethodId>([
  'weight_reps',
  'added_weight_reps',
])

const MAX_REPETITIONS_FOR_ESTIMATE = 12

export function estimateOneRepMax(weight: number, repetitions: number) {
  if (!positiveFinite(weight) || !positiveFinite(repetitions)) {
    return null
  }
  if (repetitions > MAX_REPETITIONS_FOR_ESTIMATE) {
    return null
  }
  return repetitions === 1 ? weight : weight * (1 + repetitions / 30)
}

export function createStrengthGraphPoints(workouts: StrengthGraphWorkout[]) {
  const points: StrengthGraphPoint[] = []
  for (const structure of workouts) {
    for (const exercise of structure.exercises) {
      if (
        !exercise.exerciseId ||
        !weightedMethods.has(exercise.exerciseSnapshot.trackingMethodId)
      ) {
        continue
      }
      const setPoints = (structure.setsByExercise[exercise.id] ?? [])
        .map((set) => pointFromSet(structure.workout, exercise, set))
        .filter((point): point is StrengthGraphPoint => point !== null)
      const best = setPoints.sort(
        (left, right) =>
          right.estimatedOneRepMax - left.estimatedOneRepMax ||
          left.setNumber - right.setNumber,
      )[0]
      if (best) {
        points.push(best)
      }
    }
  }
  return sortStrengthPoints(points)
}

export function listStrengthExerciseOptions(points: StrengthGraphPoint[]) {
  const byExercise = new Map<string, StrengthGraphPoint[]>()
  for (const point of points) {
    byExercise.set(point.exerciseId, [
      ...(byExercise.get(point.exerciseId) ?? []),
      point,
    ])
  }
  return [...byExercise.entries()]
    .map(([exerciseId, exercisePoints]) => {
      const sorted = sortStrengthPoints(exercisePoints)
      const latest = sorted.at(-1)
      const allTimeBest = [...sorted].sort(
        (left, right) =>
          right.estimatedOneRepMax - left.estimatedOneRepMax ||
          right.completedAt.localeCompare(left.completedAt),
      )[0]
      if (!latest || !allTimeBest) {
        return null
      }
      return {
        exerciseId,
        exerciseName: latest.exerciseName,
        latest,
        allTimeBest,
        pointCount: sorted.length,
      }
    })
    .filter((option): option is StrengthExerciseOption => option !== null)
    .sort((left, right) => left.exerciseName.localeCompare(right.exerciseName))
}

export function filterStrengthPointsForRange({
  points,
  range,
  today,
}: {
  points: StrengthGraphPoint[]
  range: StrengthRange
  today: LocalDateString
}) {
  const sorted = sortStrengthPoints(points)
  if (range === 'all') {
    return sorted
  }

  const start = formatLocalDate(
    subMonths(parseLocalDate(today), rangeMonths[range]),
  )
  return sorted.filter((point) => point.localDate >= start)
}

export function createStrengthGraphModel(
  points: StrengthGraphPoint[],
): StrengthGraphModel {
  const sorted = sortStrengthPoints(points)
  if (!sorted.length) {
    return { status: 'empty', points: [] }
  }
  const estimates = sorted.map((point) => point.estimatedOneRepMax)
  const minEstimate = Math.min(...estimates)
  const maxEstimate = Math.max(...estimates)
  const firstTime = pointTime(sorted[0])
  const lastTime = pointTime(sorted.at(-1) ?? sorted[0])
  const estimateSpread = maxEstimate - minEstimate
  const timeSpread = Math.max(1, lastTime - firstTime)
  const yPadding = estimateSpread === 0 ? 5 : estimateSpread * 0.12
  const chartMin = minEstimate - yPadding
  const chartMax = maxEstimate + yPadding
  const chartSpread = Math.max(1, chartMax - chartMin)
  const latest = sorted.at(-1) ?? sorted[0]
  const allTimeBest = [...sorted].sort(
    (left, right) =>
      right.estimatedOneRepMax - left.estimatedOneRepMax ||
      right.completedAt.localeCompare(left.completedAt),
  )[0]
  const plotted = sorted.map((point) => ({
    ...point,
    x: ((pointTime(point) - firstTime) / timeSpread) * 100,
    y: 100 - ((point.estimatedOneRepMax - chartMin) / chartSpread) * 100,
  }))
  return {
    status: sorted.length === 1 ? 'single' : 'ready',
    points: plotted,
    minEstimate,
    maxEstimate,
    latest: plotted.find((point) => point.id === latest.id) ?? plotted[0],
    allTimeBest:
      plotted.find((point) => point.id === allTimeBest.id) ?? plotted[0],
    summary: `${latest.exerciseName} latest estimated 1RM is ${formatEstimatedMax(latest.estimatedOneRepMax)} lb. All-time best is ${formatEstimatedMax(allTimeBest.estimatedOneRepMax)} lb on ${allTimeBest.localDate}, from ${formatEstimatedMax(allTimeBest.weight)} lb x ${allTimeBest.repetitions}.`,
  }
}

export function formatEstimatedMax(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function strengthEstimateLimitText() {
  return `Epley estimates use completed weighted-rep sets from 1-${MAX_REPETITIONS_FOR_ESTIMATE} reps.`
}

function pointFromSet(
  workout: WorkoutHistoryEntry,
  exercise: WorkoutHistoryExercise,
  set: WorkoutHistorySet,
) {
  const weight = numericValue(
    exercise.exerciseSnapshot.trackingMethodId === 'added_weight_reps'
      ? set.metricValues.addedWeight
      : set.metricValues.weight,
  )
  const repetitions = numericValue(set.metricValues.reps)
  const estimate =
    weight === null || repetitions === null
      ? null
      : estimateOneRepMax(weight, repetitions)
  if (!set.completed || estimate === null) {
    return null
  }
  return {
    id: `${workout.id}:${exercise.id}:${set.id}`,
    exerciseId: exercise.exerciseId ?? '',
    exerciseName: exercise.exerciseSnapshot.exerciseName,
    workoutId: workout.id,
    localDate: workout.localDate,
    completedAt: workout.completedAt,
    setNumber: set.setNumber,
    weight,
    repetitions,
    estimatedOneRepMax: estimate,
    x: 0,
    y: 0,
  }
}

function sortStrengthPoints(points: StrengthGraphPoint[]) {
  return [...points].sort(
    (left, right) =>
      left.localDate.localeCompare(right.localDate) ||
      left.completedAt.localeCompare(right.completedAt) ||
      left.workoutId.localeCompare(right.workoutId),
  )
}

function numericValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null
}

function positiveFinite(value: number) {
  return Number.isFinite(value) && value > 0
}

function pointTime(point: StrengthGraphPoint) {
  const parsed = Date.parse(point.completedAt)
  if (Number.isFinite(parsed)) {
    return parsed
  }
  return parseLocalDate(point.localDate).getTime()
}
