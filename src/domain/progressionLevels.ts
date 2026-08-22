import type {
  ExerciseProgressionState,
  IsoTimestamp,
  ProgressionExperienceLevel,
} from '@shared-types/app'

/**
 * Internal tuning parameters for smart progression. These are never shown in
 * the UI; they only decide how quickly the deterministic engine raises or
 * lowers load and climbs reps. A more conservative cadence progresses slower.
 */
export type ProgressionLevelParams = {
  /**
   * Qualifying top-of-range sessions (counting the current one) required before
   * a load increase is recommended.
   */
  sessionsBeforeIncrease: number
  /**
   * Sessions with missed minimum reps (counting the current one) required
   * before a load reduction is recommended.
   */
  sessionsBeforeReduce: number
  /** Reps added per session while climbing toward the top of the rep range. */
  repClimbPerSession: number
}

export const DEFAULT_PROGRESSION_LEVEL: ProgressionExperienceLevel =
  'intermediate'

/**
 * The four preset choices offered when smart progression is first enabled.
 * Ordered fastest to slowest; each is an anchor on the continuous spectrum.
 */
export const PROGRESSION_LEVEL_PARAMS: Record<
  ProgressionExperienceLevel,
  ProgressionLevelParams
> = {
  novice: {
    sessionsBeforeIncrease: 1,
    sessionsBeforeReduce: 1,
    repClimbPerSession: 2,
  },
  intermediate: {
    sessionsBeforeIncrease: 2,
    sessionsBeforeReduce: 2,
    repClimbPerSession: 1,
  },
  advanced: {
    sessionsBeforeIncrease: 3,
    sessionsBeforeReduce: 2,
    repClimbPerSession: 1,
  },
  expert: {
    sessionsBeforeIncrease: 4,
    sessionsBeforeReduce: 3,
    repClimbPerSession: 1,
  },
}

/**
 * The continuous per-exercise spectrum. Score 0 is the novice (fastest) end and
 * {@link PROGRESSION_SCORE_MAX} is the expert (slowest) end. A chosen preset
 * seeds an exercise's score; the score then drifts as the exercise is trained,
 * so progression is tailored per exercise rather than snapped to four buckets.
 */
export const PROGRESSION_SCORE_MIN = 0
export const PROGRESSION_SCORE_MAX = 3

const SCORE_ANCHORS: ProgressionExperienceLevel[] = [
  'novice',
  'intermediate',
  'advanced',
  'expert',
]

const PRESET_SCORES: Record<ProgressionExperienceLevel, number> = {
  novice: 0,
  intermediate: 1,
  advanced: 2,
  expert: 3,
}

/** The spectrum position that a chosen preset seeds an exercise with. */
export function presetToScore(level: ProgressionExperienceLevel): number {
  return PRESET_SCORES[level]
}

/**
 * The nearest preset label for a spectrum score. Used only for display and
 * explanations; the engine always works from the continuous score.
 */
export function scoreToNearestLevel(score: number): ProgressionExperienceLevel {
  return SCORE_ANCHORS[Math.round(clampScore(score))]
}

/**
 * Derives the cadence for a point on the spectrum by interpolating between the
 * two neighboring preset anchors, then rounding the values that must be whole.
 */
export function cadenceForScore(score: number): ProgressionLevelParams {
  const clamped = clampScore(score)
  const lowerIndex = Math.floor(clamped)
  const upperIndex = Math.min(lowerIndex + 1, SCORE_ANCHORS.length - 1)
  const fraction = clamped - lowerIndex
  const lower = PROGRESSION_LEVEL_PARAMS[SCORE_ANCHORS[lowerIndex]]
  const upper = PROGRESSION_LEVEL_PARAMS[SCORE_ANCHORS[upperIndex]]
  return {
    sessionsBeforeIncrease: Math.max(
      1,
      Math.round(
        lerp(
          lower.sessionsBeforeIncrease,
          upper.sessionsBeforeIncrease,
          fraction,
        ),
      ),
    ),
    sessionsBeforeReduce: Math.max(
      1,
      Math.round(
        lerp(lower.sessionsBeforeReduce, upper.sessionsBeforeReduce, fraction),
      ),
    ),
    repClimbPerSession: Math.max(
      1,
      Math.round(
        lerp(lower.repClimbPerSession, upper.repClimbPerSession, fraction),
      ),
    ),
  }
}

/**
 * How far a single completed-workout outcome nudges an exercise's score along
 * the spectrum. A clean increase eases the cadence faster (toward novice); a
 * reduction slows it (toward expert). Reductions move slightly more so a
 * struggling lift backs off promptly. About three increases or two reductions
 * shift a full preset step.
 */
export const SCORE_STEP_FASTER = 1 / 3
export const SCORE_STEP_SLOWER = 1 / 2

export type ProgressionOutcome = 'increase' | 'reduce' | 'hold'

/**
 * Deterministically tailors an exercise's spectrum score from one outcome. A
 * hold leaves it untouched. Only adjusts cadence — never a prescription target.
 */
export function adjustScoreForOutcome(
  score: number,
  outcome: ProgressionOutcome,
): number {
  if (outcome === 'increase') {
    return clampScore(score - SCORE_STEP_FASTER)
  }
  if (outcome === 'reduce') {
    return clampScore(score + SCORE_STEP_SLOWER)
  }
  return clampScore(score)
}

export function createExerciseProgressionState(
  exerciseId: string,
  score: number,
  now: IsoTimestamp,
): ExerciseProgressionState {
  return {
    exerciseId,
    score: clampScore(score),
    createdAt: now,
    updatedAt: now,
  }
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) {
    return PRESET_SCORES[DEFAULT_PROGRESSION_LEVEL]
  }
  return Math.min(PROGRESSION_SCORE_MAX, Math.max(PROGRESSION_SCORE_MIN, score))
}

function lerp(start: number, end: number, fraction: number): number {
  return start + (end - start) * fraction
}
