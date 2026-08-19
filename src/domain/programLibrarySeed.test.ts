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
  'Powerlifting-Focused Full Body - Four Days per Week',
  'Full Body Five Days per Week',
  'Full Body Six Days per Week',
  'Classic Upper/Lower Four Days per Week',
  'Upper/Lower Six Days per Week',
  'Chest/Back, Biceps/Triceps, Shoulders, Lower Body Split',
  'Hybrid Upper/Lower/Push/Pull/Legs',
  'Hybrid Upper/Lower/Chest-Back/Lower/Arms',
  'Bodybuilding-Biased Powerbuilding',
]

// number of training days expected per program, in order.
const EXPECTED_DAY_COUNTS = [
  2, 3, 4, 3, 4, 4, 4, 6, 5, 4, 5, 4, 4, 4, 3, 5, 3, 6, 2, 3, 4, 5, 6, 4, 6, 4,
  5, 5, 7,
]

function programByName(name: string) {
  const program = BUILT_IN_PROGRAMS.find((p) => p.name === name)
  if (!program) {
    throw new Error(`missing program ${name}`)
  }
  return program
}

describe('BUILT_IN_PROGRAMS', () => {
  it('contains exactly 29 programs in the required order', () => {
    expect(BUILT_IN_PROGRAMS).toHaveLength(29)
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
      ['Powerlifting-Focused Full Body - Four Days per Week', 7],
      ['Full Body Five Days per Week', 6],
      ['Full Body Six Days per Week', 6],
    ]
    for (const [name, count] of cases) {
      for (const day of programByName(name).days) {
        expect(day.exercises).toHaveLength(count)
      }
    }
  })

  it('defines the powerlifting-focused four-day full-body revision exactly', () => {
    const program = programByName(
      'Powerlifting-Focused Full Body - Four Days per Week',
    )
    expect(program.goal).toBe(
      'Improve squat, bench press, and deadlift strength while retaining sufficient hypertrophy work',
    )
    expect(program.notes).toContain('Monday, Tuesday, Thursday, Saturday')
    expect(program.days.map((day) => day.name)).toEqual([
      'Monday - Squat + Bench',
      'Tuesday - Bench + Deadlift',
      'Thursday - Squat + Bench',
      'Saturday - Bench + Deadlift',
    ])
    expect(
      program.days.map((day) =>
        day.exercises.map((exercise) => exercise.exerciseId),
      ),
    ).toEqual([
      [
        'builtin:barbell-back-squat',
        'builtin:barbell-bench-press',
        'builtin:pull-up',
        'builtin:barbell-hip-thrust',
        'builtin:cable-lateral-raise',
        'builtin:rope-triceps-pressdown',
        'builtin:dragon-flag',
      ],
      [
        'builtin:conventional-deadlift',
        'builtin:low-incline-barbell-bench-press',
        'builtin:chest-supported-row',
        'builtin:bulgarian-split-squat',
        'builtin:machine-shoulder-press',
        'builtin:hammer-curl',
        'builtin:standing-calf-raise',
      ],
      [
        'builtin:barbell-front-squat',
        'builtin:barbell-bench-press',
        'builtin:barbell-overhead-press',
        'builtin:neutral-grip-lat-pulldown',
        'builtin:romanian-deadlift',
        'builtin:seated-leg-curl',
        'builtin:ghd-sit-up',
      ],
      [
        'builtin:paused-barbell-bench-press',
        'builtin:conventional-deadlift',
        'builtin:seated-cable-row',
        'builtin:belt-squat',
        'builtin:reverse-pec-deck',
        'builtin:overhead-cable-triceps-extension',
        'builtin:machine-preacher-curl',
      ],
    ])

    expect(program.days[0].exercises[0]).toMatchObject({
      targetSetCount: 3,
      targetRepsMin: 3,
      targetRepsMax: 3,
      targetRir: 1,
      notes: expect.stringContaining('back-off sets'),
    })
    expect(program.days[0].exercises[1]).toMatchObject({
      targetSetCount: 4,
      targetRepsMin: 4,
      targetRepsMax: 7,
      targetRir: 1,
      notes: expect.stringContaining('70% 1RM'),
    })
    expect(program.days[2].exercises[1]).toMatchObject({
      targetSetCount: 3,
      targetRepsMin: 4,
      targetRepsMax: 8,
      targetRir: 4,
      notes: expect.stringContaining('40-60% 1RM'),
    })
    expect(program.days[3].exercises[1]).toMatchObject({
      targetSetCount: 3,
      targetRepsMin: 4,
      targetRepsMax: 6,
      targetRir: 4,
      notes: expect.stringContaining('Reset completely'),
    })
  })

  it('defines the bodybuilding-biased powerbuilding schedule exactly without a deload', () => {
    const program = programByName('Bodybuilding-Biased Powerbuilding')
    expect(program.days.map((day) => day.name)).toEqual([
      'Day 1 - Upper',
      'Day 2 - Lower - Heavy Squat',
      'Day 3 - Rest',
      'Day 4 - Chest / Back',
      'Day 5 - Lower - Heavy Deadlift',
      'Day 6 - Arms / Shoulders',
      'Day 7 - Rest',
    ])
    expect(
      program.days.map((day) =>
        day.exercises.map((exercise) => [
          exercise.exerciseId,
          exercise.targetSetCount,
          exercise.targetRepsMin,
          exercise.targetRepsMax,
          exercise.targetRir,
        ]),
      ),
    ).toEqual([
      [
        ['builtin:barbell-bench-press', 3, 3, 7, 1],
        ['builtin:weighted-pull-up', 3, 5, 8, 1],
        ['builtin:low-incline-dumbbell-bench-press', 3, 6, 10, 1],
        ['builtin:chest-supported-row', 3, 6, 8, 1],
        ['builtin:pec-deck', 2, 6, 10, 0],
        ['builtin:cable-lateral-raise', 3, 8, 12, 0],
        ['builtin:dumbbell-shrug', 3, 8, 12, 1],
        ['builtin:straight-bar-triceps-pressdown', 2, 8, 12, 0],
        ['builtin:incline-dumbbell-curl', 2, 8, 12, 0],
      ],
      [
        ['builtin:barbell-back-squat', 3, 3, 7, 1],
        ['builtin:romanian-deadlift', 3, 6, 10, 1],
        ['builtin:dumbbell-step-up', 3, 8, 12, 1],
        ['builtin:seated-leg-curl', 2, 6, 10, 1],
        ['builtin:leg-extension', 2, 10, 15, 0],
        ['builtin:standing-calf-raise', 3, 8, 15, 0],
      ],
      [],
      [
        ['builtin:low-incline-barbell-bench-press', 3, 5, 8, 1],
        ['builtin:pull-up', 3, 8, 12, 1],
        ['builtin:pec-deck', 3, 12, 20, 0],
        ['builtin:chest-supported-row', 3, 10, 15, 1],
        ['builtin:machine-chest-press', 2, 8, 15, 0],
        ['builtin:lat-pulldown', 2, 10, 15, 0],
        ['builtin:seated-cable-row', 2, 10, 15, 0],
        ['builtin:cable-lateral-raise', 2, 15, 25, 0],
      ],
      [
        ['builtin:sumo-deadlift', 3, 3, 6, 1],
        ['builtin:barbell-back-squat', 3, 6, 10, 2],
        ['builtin:barbell-hip-thrust', 3, 6, 10, 1],
        ['builtin:seated-leg-curl', 3, 10, 15, 0],
        ['builtin:leg-extension', 2, 12, 20, 0],
        ['builtin:seated-calf-raise', 3, 10, 15, 0],
      ],
      [
        ['builtin:barbell-overhead-press', 3, 5, 8, 1],
        ['builtin:cable-lateral-raise', 4, 12, 20, 0],
        ['builtin:cable-rear-delt-fly', 3, 12, 20, 0],
        ['builtin:ez-bar-curl', 3, 6, 10, 1],
        ['builtin:overhead-cable-triceps-extension', 3, 8, 12, 1],
        ['builtin:machine-preacher-curl', 3, 10, 15, 0],
        ['builtin:straight-bar-triceps-pressdown', 3, 10, 15, 0],
        ['builtin:cable-shrug', 3, 10, 15, 0],
      ],
      [],
    ])
    expect(program.days[0].exercises[0].notes).toContain(
      '1 top set of 3-5 reps, then 2 backoff sets of 5-7 reps',
    )
    expect(program.days[1].exercises[2]).toMatchObject({ perSide: true })
    expect(JSON.stringify(program).toLowerCase()).not.toContain('deload')
  })

  it('never repeats an exercise on consecutive days in the full-body programs', () => {
    const fullBody = [
      'Full Body Two Days per Week',
      'Full Body Three Days per Week',
      'Powerlifting-Focused Full Body - Four Days per Week',
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
        if (day.name.endsWith('Rest')) {
          expect(day.exercises).toHaveLength(0)
        } else {
          expect(day.exercises.length).toBeGreaterThan(0)
        }
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
