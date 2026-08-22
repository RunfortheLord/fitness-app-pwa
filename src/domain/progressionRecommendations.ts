import type {
  ActiveCycleWorkoutExercise,
  CurrentWorkoutProgressionReason,
  NextWorkoutProgressionReason,
  TrackingMethodId,
  WorkoutExercise,
  WorkoutHistoryEntry,
  WorkoutHistorySet,
  WorkoutSet,
  WorkoutSetTargetRecommendation,
  WorkoutSetTargetSnapshot,
} from '@shared-types/app'

import {
  PROGRESSION_LEVEL_PARAMS,
  type ProgressionLevelParams,
} from './progressionLevels'

const WEIGHTED_METHODS = new Set<TrackingMethodId>([
  'weight_reps',
  'assisted_weight_reps',
  'added_weight_reps',
])

export type CurrentWorkoutRecommendationInput = {
  trackingMethodId: TrackingMethodId
  exerciseName: string
  sourceSet: WorkoutSet
  nextSet: WorkoutSet | undefined
  originalTarget: WorkoutSetTargetSnapshot | null
  userEditedTarget?: WorkoutSetTargetSnapshot | null
  increment: number | null | undefined
  generatedAt: string
  exerciseSkipped?: boolean
}

export type CurrentWorkoutRecommendationResult = {
  reason: CurrentWorkoutProgressionReason
  suggestedTarget: WorkoutSetTargetSnapshot | null
  explanation: string
}

export type NextWorkoutPerformance = {
  workout: Pick<
    WorkoutHistoryEntry,
    | 'id'
    | 'sourceActiveCycleId'
    | 'sourceTemplateId'
    | 'sourceDayId'
    | 'completedAt'
  >
  exercise: WorkoutExercise
  prescription: ActiveCycleWorkoutExercise | undefined
  sets: Array<WorkoutSet | WorkoutHistorySet>
}

export type NextWorkoutRecommendationInput = {
  current: NextWorkoutPerformance
  previous: NextWorkoutPerformance | undefined
  increment: number | null | undefined
  /**
   * Comparable performances older than `previous`, most-recent first. Used when
   * the experience level requires more than two qualifying sessions.
   */
  earlierPerformances?: NextWorkoutPerformance[]
  /** Level cadence parameters. Defaults to the intermediate cadence. */
  params?: ProgressionLevelParams
  /**
   * RIR the final programmed set must leave in reserve to qualify for a load
   * increase (from the program prescription, falling back to the last record).
   * Defaults to 2.
   */
  targetRir?: number | null
}

export type NextWorkoutRecommendationResult = {
  reason: NextWorkoutProgressionReason
  action: 'increase' | 'reduce' | 'hold'
  materialChange: boolean
  recommendedTargetWeight: number | null
  description: string
  summary: string
}

export function createOriginalTargetSnapshot(
  prescription: ActiveCycleWorkoutExercise | undefined,
  trackingMethodId: TrackingMethodId,
): WorkoutSetTargetSnapshot | null {
  if (!prescription) {
    return null
  }
  return {
    trackingMethodId,
    targetWeight: prescription.targetWeight ?? null,
    targetRepsMin: prescription.targetRepsMin,
    targetRepsMax: prescription.targetRepsMax,
  }
}

export function getEffectiveTarget(
  set: WorkoutSet,
): WorkoutSetTargetSnapshot | null {
  return (
    set.targetRecommendation?.userEditedTarget ??
    set.targetRecommendation?.suggestedTarget ??
    set.targetRecommendation?.originalTarget ??
    set.targetSnapshot ??
    null
  )
}

export function evaluateCurrentWorkoutRecommendation({
  trackingMethodId,
  exerciseName,
  sourceSet,
  nextSet,
  originalTarget,
  userEditedTarget,
  increment,
  exerciseSkipped = false,
}: CurrentWorkoutRecommendationInput): CurrentWorkoutRecommendationResult {
  if (!WEIGHTED_METHODS.has(trackingMethodId)) {
    return hold(
      'unsupported_tracking_method',
      'Automatic live progression is not implemented for this tracking method.',
    )
  }
  if (!nextSet) {
    return hold(
      'within_range_hold',
      'No later uncompleted programmed set is available for this exercise.',
    )
  }
  if (exerciseSkipped) {
    return hold('skipped_no_progression', 'Skipped sets do not change targets.')
  }
  if (!sourceSet.completed) {
    return hold(
      'within_range_hold',
      'The source set is not completed, so no later target is suggested.',
    )
  }
  const reps = numberValue(sourceSet.metricValues.reps)
  if (reps === null) {
    return hold(
      'missing_target',
      'Completed repetitions are unavailable, so the next target was held.',
    )
  }
  if (!originalTarget) {
    return hold(
      'missing_target',
      'The original programmed target is unavailable, so the next target was held.',
    )
  }
  const min = originalTarget.targetRepsMin
  const max = originalTarget.targetRepsMax
  if (!validRepBoundary(min) || !validRepBoundary(max)) {
    return hold(
      'missing_rep_range',
      'The programmed repetition range is unavailable, so the next target was held.',
    )
  }
  const load = originalTarget.targetWeight
  if (!validLoad(load)) {
    return hold(
      'missing_target',
      'The programmed load or assistance target is unavailable, so the next target was held.',
    )
  }
  if (!validIncrement(increment)) {
    return hold(
      'invalid_increment',
      'The exercise increment is unavailable or invalid, so the next target was held.',
    )
  }
  if (userEditedTarget) {
    return hold(
      'manual_target_retained',
      'Your edited target is retained; the engine suggestion remains separate.',
    )
  }

  if (reps > max) {
    const suggested = {
      ...originalTarget,
      targetWeight: adjustDifficulty(load, increment, trackingMethodId, 'up'),
      targetRepsMin: min,
      targetRepsMax: min,
    }
    return {
      reason: 'above_range_increase_difficulty',
      suggestedTarget: suggested,
      explanation: `${formatCompleted(exerciseName, trackingMethodId, load, reps)} above the programmed ${min}-${max} range. Suggested next set: ${formatTarget(trackingMethodId, suggested)}.`,
    }
  }

  if (reps === max) {
    return hold(
      'exactly_at_maximum_hold',
      `You completed exactly the programmed maximum of ${max}; the next target is held.`,
    )
  }
  if (reps >= min && reps <= max) {
    return hold(
      'within_range_hold',
      `You completed ${reps} within the programmed ${min}-${max} range; the next target is held.`,
    )
  }
  if (reps < min) {
    const suggested = {
      ...originalTarget,
      targetWeight: adjustDifficulty(load, increment, trackingMethodId, 'down'),
      targetRepsMin: min,
      targetRepsMax: min,
    }
    const failedText =
      sourceSet.metricValues.failed === true ? ' and marked it failed' : ''
    return {
      reason: 'below_minimum_failed_reduce_difficulty',
      suggestedTarget: suggested,
      explanation: `${formatCompleted(exerciseName, trackingMethodId, load, reps)}${failedText}, below the programmed minimum of ${min}. Suggested next set: ${formatTarget(trackingMethodId, suggested)}.`,
    }
  }
  return hold('within_range_hold', 'The next target is held.')
}

export function buildSetRecommendation(
  input: CurrentWorkoutRecommendationInput,
): WorkoutSetTargetRecommendation | null {
  const result = evaluateCurrentWorkoutRecommendation(input)
  if (!input.originalTarget) {
    return null
  }
  return {
    version: 1,
    originalTarget: input.originalTarget,
    suggestedTarget: result.suggestedTarget,
    userEditedTarget: input.userEditedTarget ?? null,
    reason: result.reason,
    explanation: result.explanation,
    sourceSetId: input.sourceSet.completed ? input.sourceSet.id : null,
    generatedAt: input.generatedAt,
  }
}

export function evaluateNextWorkoutRecommendation({
  current,
  previous,
  increment,
  earlierPerformances,
  params = PROGRESSION_LEVEL_PARAMS.intermediate,
  targetRir,
}: NextWorkoutRecommendationInput): NextWorkoutRecommendationResult {
  const method = current.exercise.exerciseSnapshot.trackingMethodId
  if (!WEIGHTED_METHODS.has(method)) {
    return nextHold(
      'unsupported_tracking_method',
      'Automatic next-workout progression is not implemented for this tracking method.',
    )
  }
  // Comparable prior performances, most-recent first. `previous` stays first so
  // the intermediate two-session cadence keeps its existing behavior.
  const priors = [previous, ...(earlierPerformances ?? [])].filter(
    (performance): performance is NextWorkoutPerformance =>
      performance !== undefined &&
      performance.exercise.exerciseId === current.exercise.exerciseId &&
      performance.exercise.exerciseSnapshot.trackingMethodId === method,
  )
  const needsPriors =
    params.sessionsBeforeIncrease > 1 && params.sessionsBeforeReduce > 1
  if (priors.length === 0 && needsPriors) {
    return nextHold(
      'no_comparable_previous_performance_hold',
      'No comparable previous completed performance was found.',
    )
  }
  if (!validIncrement(increment)) {
    return nextHold(
      'no_material_prescription_change',
      'The exercise increment is unavailable or invalid, so the prescription is held.',
    )
  }
  const currentAnalysis = analyzePerformance(current)
  if (!currentAnalysis) {
    return nextHold(
      'no_material_prescription_change',
      'Comparable target or actual data is unavailable, so the prescription is held.',
    )
  }
  const effectiveTargetRir = validRir(targetRir) ? targetRir : 2

  // Reduce: the current session plus enough recent sessions all missed the
  // programmed minimum. Fewer sessions are required at lower experience levels.
  const reducePriorsNeeded = Math.max(0, params.sessionsBeforeReduce - 1)
  const reducePriors = priors
    .slice(0, reducePriorsNeeded)
    .map(analyzePerformance)
  const reduceHistoryComplete =
    reducePriors.length === reducePriorsNeeded &&
    reducePriors.every((analysis) => analysis !== null)
  if (
    currentAnalysis.repeatedFailure &&
    reduceHistoryComplete &&
    reducePriors.every((analysis) => analysis?.repeatedFailure)
  ) {
    const hasFailedBelowMin =
      currentAnalysis.hasFailedBelowMin ||
      reducePriors.some((analysis) => analysis?.hasFailedBelowMin)
    return nextMaterial(
      hasFailedBelowMin
        ? 'repeated_failed_performance_reduce'
        : 'repeated_missed_minimums_reduce',
      'reduce',
      current,
      increment,
    )
  }

  // Increase: the current session plus enough recent sessions all reached the
  // top of the range with the required reserve. Higher levels need more.
  const increasePriorsNeeded = Math.max(0, params.sessionsBeforeIncrease - 1)
  const increasePriors = priors
    .slice(0, increasePriorsNeeded)
    .map(analyzePerformance)
  const increaseHistoryComplete =
    increasePriors.length === increasePriorsNeeded &&
    increasePriors.every((analysis) => analysis !== null)
  if (currentAnalysis.topRange && !currentAnalysis.hasSkipped) {
    const priorsQualify =
      increaseHistoryComplete &&
      increasePriors.every(
        (analysis) =>
          analysis?.topRange &&
          !analysis.hasSkipped &&
          !analysis.repeatedFailure,
      )
    if (priorsQualify) {
      if (currentAnalysis.finalRir === null) {
        return nextHold(
          'missing_final_rir_hold',
          'Final programmed-set RIR is missing, so the prescription is held.',
        )
      }
      if (currentAnalysis.finalRir < effectiveTargetRir) {
        return nextHold(
          'insufficient_final_rir_hold',
          'Final programmed-set RIR is below the target reserve, so the prescription is held.',
        )
      }
      return nextMaterial(
        'repeated_top_range_increase',
        'increase',
        current,
        increment,
      )
    }
    if (
      increasePriors.some(
        (analysis) => analysis !== null && analysis.hasSkipped,
      )
    ) {
      return nextHold(
        'skipped_programmed_set_hold',
        'A comparable workout contains a skipped programmed set, so progression is withheld.',
      )
    }
    return nextHold(
      'top_range_insufficient_history_hold',
      'Not enough comparable top-range workouts qualify, so the prescription is held.',
    )
  }

  if (currentAnalysis.hasSkipped) {
    return nextHold(
      'skipped_programmed_set_hold',
      'A comparable workout contains a skipped programmed set, so progression is withheld.',
    )
  }

  return nextHold(
    'normal_in_range_hold',
    'Performance was within the programmed range, so the prescription is held.',
  )
}

function analyzePerformance(performance: NextWorkoutPerformance) {
  const prescription = performance.prescription
  const method = performance.exercise.exerciseSnapshot.trackingMethodId
  if (!prescription || !validRepBoundary(prescription.targetRepsMin)) {
    return null
  }
  if (!validRepBoundary(prescription.targetRepsMax)) {
    return null
  }
  if (!validLoad(prescription.targetWeight ?? null)) {
    return null
  }
  const programmedSets = performance.sets
    .filter((set) => set.setNumber <= prescription.targetSetCount)
    .sort((left, right) => left.setNumber - right.setNumber)
  if (programmedSets.length < prescription.targetSetCount) {
    return null
  }
  const min = prescription.targetRepsMin
  const max = prescription.targetRepsMax
  const completed = programmedSets.filter((set) => set.completed)
  const hasSkipped = performance.exercise.skipped
  const belowMinSets = completed.filter((set) => {
    const reps = numberValue(set.metricValues.reps)
    return reps !== null && reps < min
  })
  const hasFailedBelowMin = completed.some((set) => {
    const reps = numberValue(set.metricValues.reps)
    return reps !== null && reps < min && set.metricValues.failed === true
  })
  const topRange =
    !hasSkipped &&
    completed.length === prescription.targetSetCount &&
    completed.every((set) => {
      const reps = numberValue(set.metricValues.reps)
      return reps !== null && reps >= max
    })
  const finalSet = programmedSets[prescription.targetSetCount - 1]
  const finalRir = method === 'duration' ? null : (finalSet?.rir ?? null)
  return {
    topRange,
    hasSkipped,
    repeatedFailure:
      belowMinSets.length >= Math.ceil(programmedSets.length / 2) ||
      hasFailedBelowMin,
    hasFailedBelowMin,
    finalRir,
  }
}

function nextMaterial(
  reason: NextWorkoutProgressionReason,
  action: 'increase' | 'reduce',
  current: NextWorkoutPerformance,
  increment: number,
): NextWorkoutRecommendationResult {
  const prescription = current.prescription
  if (!prescription || !validLoad(prescription.targetWeight ?? null)) {
    return nextHold(
      'no_material_prescription_change',
      'The current prescription target is unavailable.',
    )
  }
  const method = current.exercise.exerciseSnapshot.trackingMethodId
  const direction = action === 'increase' ? 'up' : 'down'
  const recommendedTargetWeight = adjustDifficulty(
    prescription.targetWeight ?? 0,
    increment,
    method,
    direction,
  )
  const materialChange = recommendedTargetWeight !== prescription.targetWeight
  const description =
    action === 'increase'
      ? `Progress ${current.exercise.exerciseSnapshot.exerciseName}: ${formatLoad(method, prescription.targetWeight ?? 0)} to ${formatLoad(method, recommendedTargetWeight)}`
      : `Ease ${current.exercise.exerciseSnapshot.exerciseName}: ${formatLoad(method, prescription.targetWeight ?? 0)} to ${formatLoad(method, recommendedTargetWeight)}`
  return {
    reason: materialChange ? reason : 'no_material_prescription_change',
    action,
    materialChange,
    recommendedTargetWeight,
    description,
    summary:
      action === 'increase'
        ? `Two comparable workouts reached the top of the programmed range with sufficient final-set RIR. Suggested next-workout target: ${formatLoad(method, recommendedTargetWeight)}.`
        : `Two comparable workouts missed the programmed minimum or included failed sets. Suggested next-workout target: ${formatLoad(method, recommendedTargetWeight)}.`,
  }
}

function nextHold(
  reason: NextWorkoutProgressionReason,
  summary: string,
): NextWorkoutRecommendationResult {
  return {
    reason,
    action: 'hold',
    materialChange: false,
    recommendedTargetWeight: null,
    description: summary,
    summary,
  }
}

function hold(
  reason: CurrentWorkoutProgressionReason,
  explanation: string,
): CurrentWorkoutRecommendationResult {
  return { reason, suggestedTarget: null, explanation }
}

function adjustDifficulty(
  target: number,
  increment: number,
  method: TrackingMethodId,
  direction: 'up' | 'down',
) {
  const signed =
    method === 'assisted_weight_reps'
      ? direction === 'up'
        ? -increment
        : increment
      : direction === 'up'
        ? increment
        : -increment
  return normalizeLoad(Math.max(0, target + signed))
}

function normalizeLoad(value: number) {
  return Math.round(value * 1000) / 1000
}

function validIncrement(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function validRir(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function validLoad(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function validRepBoundary(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function formatCompleted(
  exerciseName: string,
  method: TrackingMethodId,
  load: number,
  reps: number,
) {
  return `You completed ${exerciseName}: ${formatLoad(method, load)} x ${reps},`
}

function formatTarget(
  method: TrackingMethodId,
  target: WorkoutSetTargetSnapshot,
) {
  const reps = target.targetRepsMin ?? target.targetRepsMax
  return `${formatLoad(method, target.targetWeight ?? 0)} x ${reps}`
}

function formatLoad(method: TrackingMethodId, value: number) {
  if (method === 'assisted_weight_reps') {
    return `${value} lb assistance`
  }
  if (method === 'added_weight_reps') {
    return `${value} lb added`
  }
  return `${value} lb`
}
