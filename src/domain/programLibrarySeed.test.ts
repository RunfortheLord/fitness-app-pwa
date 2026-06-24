import { describe, expect, it } from 'vitest'

import { BUILT_IN_PROGRAMS } from './programLibrarySeed'

const EXPECTED_NAMES = [
  'Beginner Full Body A/B',
  'Beginner Machine Foundations',
  'Beginner Upper/Lower',
  'Three-Day Strength Base',
  'Four-Day Upper/Lower Hypertrophy',
  'Adam’s Four-Day Cut Upper/Lower',
  'Four-Day Powerbuilding',
  'Six-Day Push/Pull/Legs',
  'Five-Day Push/Pull/Legs/Upper/Lower',
  'Four-Day Torso/Limbs',
  'Five-Day Bodybuilding Split',
  'Four-Day Bench Press Specialization',
  'Four-Day Squat Specialization',
  'Four-Day Pull-Up and Back Specialization',
  'Three-Day Minimalist Program',
  'Classic Bro Split',
  'Standard Repeating Push/Pull/Legs',
  'Push/Pull/Legs A/B',
  'Full Body Two Days per Week',
  'Full Body Three Days per Week',
  'Full Body Four Days per Week',
  'Full Body Five Days per Week',
  'Full Body Six Days per Week',
  'Classic Upper/Lower Four Days per Week',
  'Upper/Lower Six Days per Week',
  'Chest/Back, Biceps/Triceps, Shoulders, Lower Body Split',
  'Hybrid Upper/Lower/Push/Pull/Legs',
  'Hybrid Upper/Lower/Chest-Back/Lower/Arms',
]

// number of training days expected per program, in order.
const EXPECTED_DAY_COUNTS = [
  2, 3, 4, 3, 4, 4, 4, 6, 5, 4, 5, 4, 4, 4, 3, 5, 3, 6, 2, 3, 4, 5, 6, 4, 6, 4,
  5, 5,
]

function programByName(name: string) {
  const program = BUILT_IN_PROGRAMS.find((p) => p.name === name)
  if (!program) {
    throw new Error(`missing program ${name}`)
  }
  return program
}

describe('BUILT_IN_PROGRAMS', () => {
  it('contains exactly 28 programs in the required order', () => {
    expect(BUILT_IN_PROGRAMS).toHaveLength(28)
    expect(BUILT_IN_PROGRAMS.map((p) => p.name)).toEqual(EXPECTED_NAMES)
  })

  it('has unique slugs and the expected training-day counts', () => {
    const slugs = BUILT_IN_PROGRAMS.map((p) => p.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(BUILT_IN_PROGRAMS.map((p) => p.days.length)).toEqual(
      EXPECTED_DAY_COUNTS,
    )
  })

  it('gives every program a level and goal', () => {
    for (const program of BUILT_IN_PROGRAMS) {
      expect(program.level.length).toBeGreaterThan(0)
      expect(program.goal.length).toBeGreaterThan(0)
    }
  })

  it('enforces the exact full-body exercise counts', () => {
    const cases: Array<[string, number]> = [
      ['Full Body Two Days per Week', 10],
      ['Full Body Three Days per Week', 8],
      ['Full Body Four Days per Week', 7],
      ['Full Body Five Days per Week', 6],
      ['Full Body Six Days per Week', 6],
    ]
    for (const [name, count] of cases) {
      for (const day of programByName(name).days) {
        expect(day.exercises).toHaveLength(count)
      }
    }
  })

  it('never repeats an exercise on consecutive days in the full-body programs', () => {
    const fullBody = [
      'Full Body Two Days per Week',
      'Full Body Three Days per Week',
      'Full Body Four Days per Week',
      'Full Body Five Days per Week',
      'Full Body Six Days per Week',
    ]
    for (const name of fullBody) {
      const days = programByName(name).days
      for (let i = 0; i < days.length - 1; i += 1) {
        const today = new Set(days[i].exercises.map((e) => e.exerciseId))
        const tomorrow = days[i + 1].exercises.map((e) => e.exerciseId)
        for (const id of tomorrow) {
          expect(today.has(id)).toBe(false)
        }
      }
    }
  })

  it('gives every prescription valid sets, rep range, and final-set RIR', () => {
    for (const program of BUILT_IN_PROGRAMS) {
      expect(program.days.length).toBeGreaterThan(0)
      for (const day of program.days) {
        expect(day.name.length).toBeGreaterThan(0)
        expect(day.exercises.length).toBeGreaterThan(0)
        for (const ex of day.exercises) {
          expect(ex.exerciseId.startsWith('builtin:')).toBe(true)
          expect(ex.targetSetCount).toBeGreaterThanOrEqual(1)
          expect(ex.targetRepsMin).toBeGreaterThanOrEqual(1)
          expect(ex.targetRepsMax).toBeGreaterThanOrEqual(ex.targetRepsMin)
          expect(ex.targetRir).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })
})
