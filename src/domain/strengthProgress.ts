import { subMonths } from 'date-fns'

import {
  formatLocalDate,
  parseLocalDate,
  type LocalDateString,
} from '@domain/dates'
import {
  convertFromLb,
  weightDisplayNumber,
  weightUnitSuffix,
} from '@domain/weightUnits'
import type {
  TrackingMethodId,
  WeightUnit,
  WorkoutHistoryEntry,
  WorkoutHistoryExercise,
  WorkoutHistorySet,
} from '@shared-types/app'

export type StrengthRange = '1m' | '3m' | '6m' | '1y' | 'all'
export type StrengthMetric = 'estimated_1rm' | 'volume'

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
  estimatedOneRepMax: number | null
  totalVolume: number
  completedSetCount: number
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
      metric: StrengthMetric
      minValue: number
      maxValue: number
      chartMin: number
      chartMax: number
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
    if (structure.workout.isDeload) {
      continue
    }
    for (const exercise of structure.exercises) {
      if (
        !exercise.exerciseId ||
        !weightedMethods.has(exercise.exerciseSnapshot.trackingMethodId)
      ) {
        continue
      }
      const completedSets = (structure.setsByExercise[exercise.id] ?? [])
        .map((set) =>
          setMetrics(set, exercise.exerciseSnapshot.trackingMethodId),
        )
        .filter((set): set is CompletedSetMetrics => set !== null)
      if (!completedSets.length) {
        continue
      }
      const bestEstimate = completedSets
        .map((set) => ({
          ...set,
          estimatedOneRepMax: estimateOneRepMax(set.weight, set.repetitions),
        }))
        .filter(
          (set): set is CompletedSetMetrics & { estimatedOneRepMax: number } =>
            set.estimatedOneRepMax !== null,
        )
        .sort(
          (left, right) =>
            right.estimatedOneRepMax - left.estimatedOneRepMax ||
            left.setNumber - right.setNumber,
        )[0]
      const representativeSet = bestEstimate ?? completedSets[0]
      points.push({
        id: `${structure.workout.id}:${exercise.id}`,
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseSnapshot.exerciseName,
        workoutId: structure.workout.id,
        localDate: structure.workout.localDate,
        completedAt: structure.workout.completedAt,
        setNumber: representativeSet.setNumber,
        weight: representativeSet.weight,
        repetitions: representativeSet.repetitions,
        estimatedOneRepMax: bestEstimate?.estimatedOneRepMax ?? null,
        totalVolume: completedSets.reduce(
          (total, set) => total + set.weight * set.repetitions,
          0,
        ),
        completedSetCount: completedSets.length,
        x: 0,
        y: 0,
      })
    }
  }
  return sortStrengthPoints(points)
}

export function listStrengthExerciseOptions(
  points: StrengthGraphPoint[],
  metric: StrengthMetric = 'estimated_1rm',
) {
  const byExercise = new Map<string, StrengthGraphPoint[]>()
  for (const point of points) {
    if (strengthPointValue(point, metric) === null) {
      continue
    }
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
          strengthPointValue(right, metric)! -
            strengthPointValue(left, metric)! ||
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
  unit: WeightUnit = 'lb',
  metric: StrengthMetric = 'estimated_1rm',
): StrengthGraphModel {
  const sorted = sortStrengthPoints(points).filter(
    (point) => strengthPointValue(point, metric) !== null,
  )
  if (!sorted.length) {
    return { status: 'empty', points: [] }
  }
  const values = sorted.map((point) => strengthPointValue(point, metric)!)
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const firstTime = pointTime(sorted[0])
  const lastTime = pointTime(sorted.at(-1) ?? sorted[0])
  const valueSpread = maxValue - minValue
  const timeSpread = Math.max(1, lastTime - firstTime)
  const yPadding =
    valueSpread === 0 ? Math.max(1, maxValue * 0.05) : valueSpread * 0.12
  const chartMin = Math.max(0, minValue - yPadding)
  const chartMax = maxValue + yPadding
  const chartSpread = Math.max(1, chartMax - chartMin)
  const latest = sorted.at(-1) ?? sorted[0]
  const allTimeBest = [...sorted].sort(
    (left, right) =>
      strengthPointValue(right, metric)! - strengthPointValue(left, metric)! ||
      right.completedAt.localeCompare(left.completedAt),
  )[0]
  // A lone point has no time spread to position against; center it so it floats
  // in the plot area instead of sitting at x=0, on top of the y-axis labels.
  const isSinglePoint = sorted.length === 1
  const plotted = sorted.map((point) => ({
    ...point,
    x: isSinglePoint ? 50 : ((pointTime(point) - firstTime) / timeSpread) * 100,
    y:
      100 -
      ((strengthPointValue(point, metric)! - chartMin) / chartSpread) * 100,
  }))
  return {
    status: sorted.length === 1 ? 'single' : 'ready',
    points: plotted,
    metric,
    minValue,
    maxValue,
    chartMin,
    chartMax,
    latest: plotted.find((point) => point.id === latest.id) ?? plotted[0],
    allTimeBest:
      plotted.find((point) => point.id === allTimeBest.id) ?? plotted[0],
    summary:
      metric === 'volume'
        ? `${latest.exerciseName} — latest total volume: ${formatTotalVolume(latest.totalVolume, unit)}. Best: ${formatTotalVolume(allTimeBest.totalVolume, unit)} on ${formatLongLocalDate(allTimeBest.localDate)} across ${allTimeBest.completedSetCount} completed ${allTimeBest.completedSetCount === 1 ? 'set' : 'sets'}.`
        : `${latest.exerciseName} — latest estimated 1 rep max: ${formatEstimatedWeight(latest.estimatedOneRepMax!, unit)}. Best: ${formatEstimatedWeight(allTimeBest.estimatedOneRepMax!, unit)} on ${formatLongLocalDate(allTimeBest.localDate)}, based on ${formatEstimatedWeight(allTimeBest.weight, unit)} × ${allTimeBest.repetitions} reps.`,
  }
}

/**
 * Formats a canonical-pounds estimate (1RM or set weight) in the display unit,
 * suffix included. Kilograms snap to gym-friendly 0.5 kg; pounds keep the Epley
 * estimate's integer-or-one-decimal style.
 */
export function formatEstimatedWeight(valueLb: number, unit: WeightUnit) {
  const number =
    unit === 'kg'
      ? weightDisplayNumber(valueLb, 'kg', 'lifting')
      : formatEstimatedMax(valueLb)
  return `${number} ${weightUnitSuffix(unit)}`
}

export function formatTotalVolumeNumber(valueLb: number, unit: WeightUnit) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
  }).format(convertFromLb(valueLb, unit))
}

export function formatTotalVolume(valueLb: number, unit: WeightUnit) {
  return `${formatTotalVolumeNumber(valueLb, unit)} ${weightUnitSuffix(unit)}`
}

/** Formats a `YYYY-MM-DD` local date as e.g. `June 21, 2026` without UTC drift. */
function formatLongLocalDate(localDate: string) {
  const [year, month, day] = localDate.split('-').map(Number)
  if (!year || !month || !day) {
    return localDate
  }
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatEstimatedMax(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function strengthEstimateLimitText() {
  return `Epley estimates use completed weighted-rep sets from 1-${MAX_REPETITIONS_FOR_ESTIMATE} reps.`
}

export function strengthVolumeDescriptionText() {
  return 'Total volume sums weight × reps across every completed set for this exercise in each workout.'
}

type CompletedSetMetrics = {
  setNumber: number
  weight: number
  repetitions: number
}

function setMetrics(
  set: WorkoutHistorySet,
  trackingMethodId: TrackingMethodId,
): CompletedSetMetrics | null {
  const weight = numericValue(
    trackingMethodId === 'added_weight_reps'
      ? set.metricValues.addedWeight
      : set.metricValues.weight,
  )
  const repetitions = numericValue(set.metricValues.reps)
  if (!set.completed || weight === null || repetitions === null) {
    return null
  }
  return {
    setNumber: set.setNumber,
    weight,
    repetitions,
  }
}

function strengthPointValue(point: StrengthGraphPoint, metric: StrengthMetric) {
  return metric === 'volume' ? point.totalVolume : point.estimatedOneRepMax
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
