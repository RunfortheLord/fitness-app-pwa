import { describe, expect, it } from 'vitest'

import {
  adjustScoreForOutcome,
  cadenceForScore,
  createExerciseProgressionState,
  PROGRESSION_SCORE_MAX,
  PROGRESSION_SCORE_MIN,
  presetToScore,
  scoreToNearestLevel,
} from '@domain/progressionLevels'
import type { ProgressionExperienceLevel } from '@shared-types/app'

const NOW = '2026-08-21T00:00:00.000Z'

describe('progression spectrum', () => {
  it('maps the four presets onto the spectrum in order', () => {
    const order: ProgressionExperienceLevel[] = [
      'novice',
      'intermediate',
      'advanced',
      'expert',
    ]
    const scores = order.map(presetToScore)
    expect(scores).toEqual([0, 1, 2, 3])
    for (let index = 1; index < scores.length; index += 1) {
      expect(scores[index]).toBeGreaterThan(scores[index - 1])
    }
  })

  it('increase cadence at each preset anchor gets slower as experience rises', () => {
    expect(cadenceForScore(0).sessionsBeforeIncrease).toBe(1)
    expect(cadenceForScore(1).sessionsBeforeIncrease).toBe(2)
    expect(cadenceForScore(2).sessionsBeforeIncrease).toBe(3)
    expect(cadenceForScore(3).sessionsBeforeIncrease).toBe(4)
  })

  it('interpolates cadence between anchors for in-between spectrum points', () => {
    // Halfway between intermediate (2) and advanced (3) rounds to 3 sessions.
    expect(cadenceForScore(1.5).sessionsBeforeIncrease).toBe(3)
    // Just past novice still climbs reps faster than intermediate does.
    expect(cadenceForScore(0.2).repClimbPerSession).toBe(2)
  })

  it('clamps the spectrum at both ends', () => {
    expect(cadenceForScore(-5).sessionsBeforeIncrease).toBe(1)
    expect(cadenceForScore(99).sessionsBeforeIncrease).toBe(4)
  })

  it('a clean increase eases an exercise toward faster progression', () => {
    let score = presetToScore('expert') // 3
    score = adjustScoreForOutcome(score, 'increase')
    expect(score).toBeLessThan(3)
    // Three clean increases move roughly one full preset step.
    score = adjustScoreForOutcome(score, 'increase')
    score = adjustScoreForOutcome(score, 'increase')
    expect(score).toBeCloseTo(2, 5)
    expect(scoreToNearestLevel(score)).toBe('advanced')
  })

  it('a reduction slows an exercise toward more conservative progression', () => {
    let score = presetToScore('novice') // 0
    score = adjustScoreForOutcome(score, 'reduce')
    expect(score).toBeGreaterThan(0)
    score = adjustScoreForOutcome(score, 'reduce')
    expect(score).toBeCloseTo(1, 5)
    expect(scoreToNearestLevel(score)).toBe('intermediate')
  })

  it('a hold leaves the score unchanged', () => {
    const score = 1.5
    expect(adjustScoreForOutcome(score, 'hold')).toBe(1.5)
  })

  it('never drifts beyond the spectrum bounds', () => {
    let score = PROGRESSION_SCORE_MIN
    for (let index = 0; index < 10; index += 1) {
      score = adjustScoreForOutcome(score, 'increase')
    }
    expect(score).toBe(PROGRESSION_SCORE_MIN)

    score = PROGRESSION_SCORE_MAX
    for (let index = 0; index < 10; index += 1) {
      score = adjustScoreForOutcome(score, 'reduce')
    }
    expect(score).toBe(PROGRESSION_SCORE_MAX)
  })

  it('seeds a per-exercise state from a preset score and clamps it', () => {
    const state = createExerciseProgressionState(
      'builtin:squat',
      presetToScore('intermediate'),
      NOW,
    )
    expect(state).toMatchObject({ exerciseId: 'builtin:squat', score: 1 })
    expect(createExerciseProgressionState('builtin:squat', 99, NOW).score).toBe(
      PROGRESSION_SCORE_MAX,
    )
  })
})
