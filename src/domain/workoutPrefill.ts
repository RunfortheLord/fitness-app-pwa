import type { TrackingMethodId } from '@shared-types/app'

import { DEFAULT_DELOAD_RIR_INCREASE } from './programWeeks'

const ESTIMATE_INCREMENT_LB = 5
const DEFAULT_TARGET_RIR = 2
const MIN_FATIGUE_FACTOR = 0.85
const MAX_FATIGUE_FACTOR = 1.02
const MAX_SMART_REP_SPREAD = 2

export type WorkoutPrefillSourceSet = {
  id: string
  setNumber: number
  load: number | null
  reps: number
  rir: number | null
}

export type WorkoutPrefillPlanSet = {
  sourceSetId: string
  sourceSetNumber: number
  load: number | null
  reps: number
}

export type WorkoutPrefillPlan = {
  sets: WorkoutPrefillPlanSet[]
  loadProgressed: boolean
}

/**
 * Builds a deload estimate directly from remembered completed history. Unlike
 * smart progression, this path never increases difficulty; it recalculates
 * load or repetitions for the higher deload RIR target.
 */
export function buildDeloadPrefillPlan({
  previousSets,
  targetSetCount,
  targetRepsMin,
  targetRepsMax,
  targetRir,
  trackingMethodId,
}: {
  previousSets: WorkoutPrefillSourceSet[]
  targetSetCount: number
  targetRepsMin: number | null
  targetRepsMax: number | null
  targetRir: number | null
  trackingMethodId: TrackingMethodId
}): WorkoutPrefillPlan | null {
  if (!Number.isInteger(targetSetCount) || targetSetCount < 1) {
    return null
  }
  const sources = previousSets
    .filter(
      (set) =>
        Number.isInteger(set.setNumber) &&
        set.setNumber > 0 &&
        positiveFinite(set.reps),
    )
    .sort((left, right) => left.setNumber - right.setNumber)
  const hasLoad = loadMetricKey(trackingMethodId) !== null
  const usable = hasLoad
    ? sources.filter((set) => validLoad(set.load, trackingMethodId))
    : sources
  if (!usable.length) {
    return null
  }

  const range = normalizedRepRange(targetRepsMin, targetRepsMax)
  const baseDesiredRir = nonNegativeFinite(targetRir)
    ? targetRir
    : DEFAULT_TARGET_RIR
  const plan = buildCrossDayPlan({
    sources: usable,
    targetSetCount,
    range,
    desiredRir: baseDesiredRir + DEFAULT_DELOAD_RIR_INCREASE,
    sourceRirFallback: baseDesiredRir,
    deloadRirIncrease: DEFAULT_DELOAD_RIR_INCREASE,
    trackingMethodId,
  })
  return differentiateConsecutiveSets(plan, range, trackingMethodId)
}

/**
 * Smart progression keeps a level rep scheme when the estimate supports one.
 * Historical fatigue may still lower later sets, but never by enough to turn a
 * coherent prescription into a different rep scheme (for example 12 -> 6).
 */
function limitSmartRepSpread(plan: WorkoutPrefillPlan): WorkoutPrefillPlan {
  const sets = plan.sets.map((set) => ({ ...set }))
  const highestReps = Math.max(...sets.map((set) => set.reps))
  const minimumSuggestedReps = Math.max(1, highestReps - MAX_SMART_REP_SPREAD)

  for (const set of sets) {
    set.reps = Math.max(set.reps, minimumSuggestedReps)
  }

  return { ...plan, sets }
}

/**
 * Creates one coherent workout-start estimate from a completed set sequence.
 * The sequence establishes a fatigue curve; later sets are not estimated as
 * unrelated performances.
 */
export function buildWorkoutPrefillPlan({
  previousSets,
  targetSetCount,
  targetRepsMin,
  targetRepsMax,
  targetRir,
  trackingMethodId,
  sameProgramDay,
  repClimbPerSession = 1,
}: {
  previousSets: WorkoutPrefillSourceSet[]
  targetSetCount: number
  targetRepsMin: number | null
  targetRepsMax: number | null
  targetRir: number | null
  trackingMethodId: TrackingMethodId
  sameProgramDay: boolean
  /**
   * How many reps to add per session while climbing toward the top of the rep
   * range (from the experience level). Defaults to 1.
   */
  repClimbPerSession?: number
}): WorkoutPrefillPlan | null {
  if (!Number.isInteger(targetSetCount) || targetSetCount < 1) {
    return null
  }
  const sources = previousSets
    .filter(
      (set) =>
        Number.isInteger(set.setNumber) &&
        set.setNumber > 0 &&
        positiveFinite(set.reps),
    )
    .sort((left, right) => left.setNumber - right.setNumber)
  if (!sources.length) {
    return null
  }

  const range = normalizedRepRange(targetRepsMin, targetRepsMax)
  const baseDesiredRir = nonNegativeFinite(targetRir)
    ? targetRir
    : DEFAULT_TARGET_RIR
  const desiredRir = baseDesiredRir
  const hasLoad = loadMetricKey(trackingMethodId) !== null
  const usable = hasLoad
    ? sources.filter((set) => validLoad(set.load, trackingMethodId))
    : sources
  if (!usable.length) {
    return null
  }

  const plan = sameProgramDay
    ? buildSameDayPlan({
        sources: usable,
        targetSetCount,
        range,
        desiredRir,
        trackingMethodId,
        repClimbPerSession,
      })
    : buildCrossDayPlan({
        sources: usable,
        targetSetCount,
        range,
        desiredRir,
        sourceRirFallback: baseDesiredRir,
        deloadRirIncrease: 0,
        trackingMethodId,
      })
  return limitSmartRepSpread(plan)
}

function differentiateConsecutiveSets(
  plan: WorkoutPrefillPlan,
  range: RepRange | null,
  trackingMethodId: TrackingMethodId,
): WorkoutPrefillPlan {
  const sets = plan.sets.map((set) => ({ ...set }))
  for (let index = 1; index < sets.length; index += 1) {
    const previous = sets[index - 1]
    const current = sets[index]
    const originalPrevious = plan.sets[index - 1]
    if (
      current.load === originalPrevious.load &&
      current.reps === originalPrevious.reps
    ) {
      current.load = previous.load
      current.reps = previous.reps
    }
    if (current.load !== previous.load || current.reps !== previous.reps) {
      continue
    }

    const minimumReps = range?.min ?? 1
    if (current.reps > minimumReps) {
      current.reps -= 1
      continue
    }

    if (current.load !== null) {
      const direction = trackingMethodId === 'assisted_weight_reps' ? 1 : -1
      current.load = Math.max(
        0,
        normalize(current.load + direction * ESTIMATE_INCREMENT_LB),
      )
      continue
    }

    // Reps-only estimates have no load lever. A one-rep fatigue step is more
    // useful than presenting consecutive auto-filled sets as identical work.
    current.reps = Math.max(1, current.reps - 1)
  }
  return { ...plan, sets }
}

function buildSameDayPlan({
  sources,
  targetSetCount,
  range,
  desiredRir,
  trackingMethodId,
  repClimbPerSession = 1,
}: {
  sources: WorkoutPrefillSourceSet[]
  targetSetCount: number
  range: RepRange | null
  desiredRir: number
  trackingMethodId: TrackingMethodId
  repClimbPerSession?: number
}): WorkoutPrefillPlan {
  const plan = mapSourceSequence(sources, targetSetCount)
  const isWeighted = loadMetricKey(trackingMethodId) !== null
  const reachedTop =
    range !== null &&
    sources.length >= targetSetCount &&
    sources.slice(0, targetSetCount).every((set) => set.reps >= range.max)

  if (isWeighted && reachedTop) {
    const progressed = progressLoad({
      plan,
      desiredRir,
      range,
      trackingMethodId,
    })
    if (progressed) {
      return { sets: progressed, loadProgressed: true }
    }
  }

  // Climb reps toward the top of the range. Higher experience adds one rep per
  // session; lower experience climbs faster. progressOneRep caps at range.max.
  const climbSteps = Math.max(1, Math.round(repClimbPerSession))
  let climbed: WorkoutPrefillPlanSet[] = progressOneRep(
    plan,
    range?.max ?? null,
  )
  for (let step = 1; step < climbSteps; step += 1) {
    climbed = progressOneRep(climbed, range?.max ?? null)
  }

  return {
    sets: climbed,
    loadProgressed: false,
  }
}

function buildCrossDayPlan({
  sources,
  targetSetCount,
  range,
  desiredRir,
  sourceRirFallback,
  deloadRirIncrease,
  trackingMethodId,
}: {
  sources: WorkoutPrefillSourceSet[]
  targetSetCount: number
  range: RepRange | null
  desiredRir: number
  sourceRirFallback: number
  deloadRirIncrease: number
  trackingMethodId: TrackingMethodId
}): WorkoutPrefillPlan {
  const midpoint = range
    ? Math.round((range.min + range.max) / 2)
    : sources[0].reps
  const metricKey = loadMetricKey(trackingMethodId)
  if (
    !metricKey ||
    trackingMethodId === 'assisted_weight_reps' ||
    (trackingMethodId === 'added_weight_reps' &&
      sources.every((set) => set.load === 0))
  ) {
    const sourceLoad = sources[0].load ?? 0
    let firstLoad = metricKey
      ? sourceLoad === 0
        ? 0
        : roundToIncrement(sourceLoad, ESTIMATE_INCREMENT_LB)
      : null
    const repSequence = centeredRepSequence({
      sources,
      targetSetCount,
      midpoint,
      range,
    })
    if (
      trackingMethodId === 'assisted_weight_reps' &&
      firstLoad !== null &&
      deloadRirIncrease > 0
    ) {
      firstLoad = normalize(firstLoad + ESTIMATE_INCREMENT_LB)
    }
    const repetitionReduction =
      deloadRirIncrease > 0 &&
      (!metricKey ||
        (trackingMethodId === 'added_weight_reps' && firstLoad === 0))
        ? Math.ceil(deloadRirIncrease)
        : 0
    return {
      sets: repSequence.map((reps, index) => {
        const source = sourceForIndex(sources, index)
        return {
          sourceSetId: source.id,
          sourceSetNumber: source.setNumber,
          load: firstLoad,
          reps: Math.max(1, reps - repetitionReduction),
        }
      }),
      loadProgressed: false,
    }
  }

  const capacities = fatigueAdjustedCapacities({
    sources,
    targetSetCount,
    sourceRirFallback,
  })
  const firstCapacity = capacities[0]
  let load = roundToIncrement(
    firstCapacity / (1 + (midpoint + desiredRir) / 30),
    ESTIMATE_INCREMENT_LB,
  )
  if (!positiveFinite(load)) {
    load = ESTIMATE_INCREMENT_LB
  }

  if (range) {
    while (
      load > ESTIMATE_INCREMENT_LB &&
      capacities.some(
        (capacity) => estimatedReps(capacity, load, desiredRir) < range.min,
      )
    ) {
      load = normalize(load - ESTIMATE_INCREMENT_LB)
    }
  }

  const reps = capacities.map((capacity) => {
    const estimate = estimatedReps(capacity, load, desiredRir)
    return range ? clamp(estimate, range.min, range.max) : Math.max(1, estimate)
  })
  enforceFatigueOrder(reps)
  return {
    sets: reps.map((setReps, index) => {
      const source = sourceForIndex(sources, index)
      return {
        sourceSetId: source.id,
        sourceSetNumber: source.setNumber,
        load,
        reps: setReps,
      }
    }),
    loadProgressed: false,
  }
}

function progressLoad({
  plan,
  desiredRir,
  range,
  trackingMethodId,
}: {
  plan: SameDayPlanSet[]
  desiredRir: number
  range: RepRange
  trackingMethodId: TrackingMethodId
}): WorkoutPrefillPlanSet[] | null {
  if (trackingMethodId === 'assisted_weight_reps') {
    return plan.map((set) => ({
      sourceSetId: set.sourceSetId,
      sourceSetNumber: set.sourceSetNumber,
      load: Math.max(0, normalize((set.load ?? 0) - ESTIMATE_INCREMENT_LB)),
      reps: clamp(set.reps - 1, range.min, range.max),
    }))
  }

  const estimates = plan.map((set) => {
    if (!positiveFinite(set.load ?? 0)) {
      return null
    }
    const sourceRir = nonNegativeFinite(set.sourceRir)
      ? set.sourceRir
      : desiredRir
    const capacity = (set.load ?? 0) * (1 + (set.reps + sourceRir) / 30)
    const load = normalize((set.load ?? 0) + ESTIMATE_INCREMENT_LB)
    return {
      sourceSetId: set.sourceSetId,
      sourceSetNumber: set.sourceSetNumber,
      load,
      reps: estimatedReps(capacity, load, desiredRir),
    }
  })
  if (
    estimates.some(
      (set) => set === null || set.reps < range.min || set.reps > range.max,
    )
  ) {
    return null
  }
  const progressed = estimates.map((set) => set!)
  const reps = progressed.map((set) => set.reps)
  enforceFatigueOrder(reps)
  return progressed.map((set, index) => ({ ...set, reps: reps[index] }))
}

function mapSourceSequence(
  sources: WorkoutPrefillSourceSet[],
  targetSetCount: number,
): SameDayPlanSet[] {
  const averageDrop = averageFatigueDrop(sources.map((set) => set.reps))
  return Array.from({ length: targetSetCount }, (_, index) => {
    const source = sourceForIndex(sources, index)
    const extrapolatedReps =
      index < sources.length
        ? source.reps
        : Math.max(
            1,
            Math.round(
              source.reps - averageDrop * (index - sources.length + 1),
            ),
          )
    return {
      sourceSetId: source.id,
      sourceSetNumber: source.setNumber,
      sourceRir: source.rir,
      load: source.load,
      reps: extrapolatedReps,
    }
  })
}

type SameDayPlanSet = WorkoutPrefillPlanSet & { sourceRir: number | null }

function progressOneRep(
  plan: Array<WorkoutPrefillPlanSet & { sourceRir?: number | null }>,
  maximum: number | null,
) {
  const candidates = plan
    .map((set, index) => ({ set, index }))
    .filter(({ set }) => maximum === null || set.reps < maximum)
  const eligible = candidates.length
    ? candidates
    : plan.map((set, index) => ({ set, index }))
  let bestIndex = eligible[0]?.index ?? 0
  let bestScore = Number.POSITIVE_INFINITY
  for (const { index } of eligible) {
    const reps = plan.map((set) => set.reps)
    reps[index] += 1
    const inversionPenalty = reps.reduce(
      (penalty, repsAtSet, currentIndex) =>
        currentIndex === 0
          ? penalty
          : penalty + Math.max(0, repsAtSet - reps[currentIndex - 1]) * 100,
      0,
    )
    const spread = Math.max(...reps) - Math.min(...reps)
    const score = inversionPenalty + spread + index / 100
    if (score < bestScore) {
      bestScore = score
      bestIndex = index
    }
  }
  return plan.map((set, index) => ({
    sourceSetId: set.sourceSetId,
    sourceSetNumber: set.sourceSetNumber,
    load: set.load,
    reps: set.reps + (index === bestIndex ? 1 : 0),
  }))
}

function centeredRepSequence({
  sources,
  targetSetCount,
  midpoint,
  range,
}: {
  sources: WorkoutPrefillSourceSet[]
  targetSetCount: number
  midpoint: number
  range: RepRange | null
}) {
  const first = sources[0].reps
  const averageDrop = averageFatigueDrop(sources.map((set) => set.reps))
  const reps = Array.from({ length: targetSetCount }, (_, index) => {
    const source = sources[index]
    const raw = source
      ? midpoint + source.reps - first
      : midpoint +
        sources.at(-1)!.reps -
        first -
        averageDrop * (index - sources.length + 1)
    const rounded = Math.round(raw)
    return range ? clamp(rounded, range.min, range.max) : Math.max(1, rounded)
  })
  enforceFatigueOrder(reps)
  return reps
}

function fatigueAdjustedCapacities({
  sources,
  targetSetCount,
  sourceRirFallback,
}: {
  sources: WorkoutPrefillSourceSet[]
  targetSetCount: number
  sourceRirFallback: number
}) {
  const observed = sources.map((set) => {
    const load = set.load ?? 0
    const rir = nonNegativeFinite(set.rir) ? set.rir : sourceRirFallback
    return load * (1 + (set.reps + rir) / 30)
  })
  const factors = observed
    .slice(1)
    .map((capacity, index) =>
      clamp(capacity / observed[index], MIN_FATIGUE_FACTOR, MAX_FATIGUE_FACTOR),
    )
  const continuationFactor = factors.length
    ? factors.reduce((sum, factor) => sum + factor, 0) / factors.length
    : 0.97
  const capacities = [...observed]
  while (capacities.length < targetSetCount) {
    capacities.push(capacities.at(-1)! * continuationFactor)
  }
  return capacities.slice(0, targetSetCount)
}

function sourceForIndex(sources: WorkoutPrefillSourceSet[], index: number) {
  return sources[index] ?? sources.at(-1)!
}

function estimatedReps(capacity: number, load: number, rir: number) {
  if (!positiveFinite(capacity) || !positiveFinite(load)) {
    return 1
  }
  return Math.max(1, Math.round(30 * (capacity / load - 1) - rir))
}

function averageFatigueDrop(reps: number[]) {
  if (reps.length < 2) {
    return 1
  }
  const drops = reps
    .slice(1)
    .map((value, index) => Math.max(0, reps[index] - value))
  return drops.reduce((sum, drop) => sum + drop, 0) / drops.length
}

function enforceFatigueOrder(reps: number[]) {
  for (let index = 1; index < reps.length; index += 1) {
    reps[index] = Math.min(reps[index], reps[index - 1])
  }
}

type RepRange = { min: number; max: number }

function normalizedRepRange(min: number | null, max: number | null) {
  const validMin = positiveFinite(min ?? 0) ? Math.round(min ?? 0) : null
  const validMax = positiveFinite(max ?? 0) ? Math.round(max ?? 0) : null
  if (validMin === null && validMax === null) {
    return null
  }
  const first = validMin ?? validMax!
  const second = validMax ?? validMin!
  return { min: Math.min(first, second), max: Math.max(first, second) }
}

export function loadMetricKey(trackingMethodId: TrackingMethodId) {
  if (trackingMethodId === 'weight_reps') {
    return 'weight'
  }
  if (trackingMethodId === 'assisted_weight_reps') {
    return 'assistedWeight'
  }
  if (trackingMethodId === 'added_weight_reps') {
    return 'addedWeight'
  }
  return null
}

function validLoad(load: number | null, method: TrackingMethodId) {
  if (typeof load !== 'number' || !Number.isFinite(load)) {
    return false
  }
  return method === 'weight_reps' ? load > 0 : load >= 0
}

function positiveFinite(value: number) {
  return Number.isFinite(value) && value > 0
}

function nonNegativeFinite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function roundToIncrement(value: number, increment: number) {
  return normalize(
    Math.max(increment, Math.round(value / increment) * increment),
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalize(value: number) {
  return Number(value.toFixed(6))
}
