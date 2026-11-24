import { migrateWeekPlan } from './periodization'
import type {
  ExercisePrescription,
  PeriodizedPlan,
  SetPrescription,
} from './periodization'

export const februaryProgramName =
  'February 2027 Powerlifting Peak + Upper Body Hypertrophy'
export const februaryDays = [
  {
    name: 'Monday — Heavy Bench + Back',
    offset: 0,
    exercises: [
      ['Barbell bench press', 4, 4, 6],
      ['Single-arm kneeling lat pulldown', 3, 8, 12],
      ['Low-incline dumbbell bench press', 3, 8, 12],
      ['Barbell row', 2, 6, 10],
      ['Pec deck', 2, 10, 15],
      ['Machine lateral raise', 2, 12, 20],
      ['Overhead cable triceps extension', 2, 10, 15],
    ],
  },
  {
    name: 'Tuesday — Heavy Squat + Technique Deadlift',
    offset: 1,
    exercises: [
      ['Low-bar squat', 4, 3, 5],
      ['Sumo deadlift', 2, 3, 3],
      ['Seated leg curl', 2, 8, 12],
      ['Standing calf raise', 2, 8, 12],
      ['Ab wheel', 2, 6, 10],
    ],
  },
  {
    name: 'Thursday — Paused Bench + Upper Chest',
    offset: 3,
    exercises: [
      ['Paused barbell bench press', 3, 4, 6],
      ['Low-incline barbell press', 3, 6, 8],
      ['Pull-up', 2, 6, 9],
      ['Single-arm kneeling lat pulldown', 2, 8, 12],
      ['Chest-supported T-bar row', 2, 8, 12],
      ['Machine lateral raise', 2, 12, 20],
      ['Incline dumbbell curl', 2, 8, 12],
      ['Cable rear delt fly', 2, 12, 20],
    ],
  },
  {
    name: 'Friday — Heavy Sumo Deadlift + Legs',
    offset: 4,
    exercises: [
      ['Sumo deadlift', 4, 3, 5],
      ['Belt squat', 2, 8, 12],
      ['Seated leg curl', 2, 8, 12],
      ['Standing calf raise', 2, 8, 12],
      ['Ab wheel', 2, 6, 10],
    ],
  },
  {
    name: 'Saturday — Lats + Arms + Delts',
    offset: 5,
    exercises: [
      ['Single-arm kneeling lat pulldown', 3, 8, 12],
      ['Hammer curl', 3, 8, 12],
      ['Overhead cable triceps extension', 3, 8, 12],
      ['Barbell preacher curl', 3, 8, 12],
      ['Cable triceps pressdown', 2, 10, 15],
      ['Machine lateral raise', 2, 12, 20],
    ],
  },
] satisfies {
  name: string
  offset: number
  exercises: [string, number, number, number][]
}[]

export function prescriptionSet(
  kind: SetPrescription['kind'],
  count: number,
  repsMin: number,
  repsMax = repsMin,
  rir: number | null = 2,
  extra: Partial<SetPrescription> = {},
): SetPrescription {
  return { kind, count, repsMin, repsMax, rir, restSeconds: 180, ...extra }
}

export function createFebruaryPlan(
  keys: string[][],
  dayKeys: string[],
  exerciseIds: string[][],
): PeriodizedPlan {
  const definitions = [
    ['Deload', 1, 1],
    ['Strength + hypertrophy', 2, 5],
    ['Strength development', 6, 8],
    ['Intensification', 9, 11],
    ['Peaking', 12, 12],
    ['Taper', 13, 13],
    ['Max testing', 14, 14],
  ] as const
  const plan: PeriodizedPlan = {
    version: 1,
    startDate: '2026-11-23',
    defaults: {},
    dayOffsets: Object.fromEntries(
      dayKeys.map((key, index) => [key, februaryDays[index].offset]),
    ),
    phases: definitions.map(([name, startWeek, endWeek], index) => ({
      id: `phase-${index + 1}`,
      name,
      startWeek,
      endWeek,
      overrides: {},
    })),
    weeks: Array.from({ length: 14 }, (_, index) => ({
      phaseId: `phase-${definitions.findIndex((phase) => index + 1 >= phase[1] && index + 1 <= phase[2]) + 1}`,
      overrides: {},
    })),
  }
  for (const [dayIndex, day] of februaryDays.entries()) {
    for (const [
      exerciseIndex,
      [name, count, min, max],
    ] of day.exercises.entries()) {
      const key = keys[dayIndex][exerciseIndex]
      const main = exerciseIndex === 0 && [0, 1, 3].includes(dayIndex)
      const paused = dayIndex === 2 && exerciseIndex === 0
      const technique = dayIndex === 1 && exerciseIndex === 1
      const referenceMax = main
        ? [228, 375, 0, 405][dayIndex]
        : paused
          ? 195
          : technique
            ? 405
            : undefined
      const starting = main
        ? [185, 325, 0, 350][dayIndex]
        : paused
          ? 160
          : technique
            ? 260
            : name === 'Low-incline barbell press'
              ? 155
              : undefined
      const base: ExercisePrescription = {
        included: true,
        optional: false,
        progression:
          main || paused || technique ? 'capacity' : 'double progression',
        referenceMax,
        referenceExerciseId: paused
          ? exerciseIds[0][0]
          : technique
            ? exerciseIds[3][0]
            : undefined,
        referenceScale: paused ? 0.82 : undefined,
        notes:
          name === 'Pull-up'
            ? 'Stay submaximal. Pulldowns are the primary progressive lat exercise.'
            : paused
              ? 'Start near 160 lb. Uses your own paused-bench performance when available; otherwise uses a conservative 82% of competition-bench capacity as a reference.'
              : '',
        sets: main
          ? [
              prescriptionSet('top set', 1, min, max, 2, {
                startingWeight: starting,
                restSeconds: 240,
              }),
              prescriptionSet('back-off', 3, min, max, 2, {
                percent: 0.76,
                startingWeight: [175, 290, 0, 310][dayIndex],
                restSeconds: 240,
              }),
            ]
          : [
              prescriptionSet(
                technique ? 'technique set' : 'straight set',
                count,
                min,
                max,
                technique ? 5 : paused ? 2 : 1.5,
                {
                  startingWeight: starting,
                  percent: technique ? 0.65 : undefined,
                  restSeconds: main || paused ? 240 : 120,
                },
              ),
            ],
      }
      plan.defaults[key] = base
      const reduced = (factor: number, rir: number) =>
        base.sets.map((set) => ({
          ...set,
          count: Math.max(1, Math.round(set.count * factor)),
          rir,
          startingWeight: undefined,
        }))
      plan.phases[0].overrides[key] = {
        optional: dayIndex === 4,
        progression: 'hold',
        sets:
          main || paused
            ? [
                prescriptionSet(
                  'technique set',
                  2,
                  main ? [5, 4, 0, 3][dayIndex] : 5,
                  undefined,
                  5,
                  {
                    startingWeight: main ? [140, 235, 0, 250][dayIndex] : 120,
                    percent: main ? [0.61, 0.63, 0, 0.62][dayIndex] : 0.62,
                  },
                ),
              ]
            : reduced(0.45, 5).map((set) => ({
                ...set,
                percent: referenceMax ? 0.6 : 0.45,
                startingWeight: starting ? starting * 0.65 : undefined,
              })),
        notes:
          'Short, easy session. Skip during illness; missed work is never added to later sessions.',
      }
      plan.phases[2].overrides[key] = main
        ? {
            sets: [
              prescriptionSet('top set', 1, 3, 5, 2.5, { restSeconds: 240 }),
              prescriptionSet('back-off', 3, 3, 5, 3, {
                percent: 0.77,
                restSeconds: 240,
              }),
            ],
          }
        : {}
      plan.phases[3].overrides[key] = main
        ? {
            sets: [
              prescriptionSet('top set', 1, 1, 1, 2.5, {
                percent: 0.9,
                restSeconds: 300,
              }),
              prescriptionSet('back-off', 3, 2, 3, 3, {
                percent: 0.8,
                restSeconds: 240,
              }),
            ],
          }
        : {
            sets: paused
              ? [prescriptionSet('straight set', 2, 3, 5, 3)]
              : reduced(0.75, 3),
          }
      plan.phases[4].overrides[key] = main
        ? {
            sets: [
              prescriptionSet('top set', 1, 1, 1, 1.5, {
                percent: 0.94,
                restSeconds: 300,
              }),
              prescriptionSet('back-off', 2, 2, 2, 3, {
                percent: 0.8,
                restSeconds: 240,
              }),
            ],
          }
        : { sets: reduced(0.5, 3), included: !technique }
      plan.phases[5].overrides[key] = {
        included:
          (main && dayIndex !== 3) ||
          technique ||
          (dayIndex === 0 && [1, 2, 6].includes(exerciseIndex)) ||
          (dayIndex === 1 && [2, 3].includes(exerciseIndex)) ||
          (dayIndex === 2 && [0, 1, 3, 6].includes(exerciseIndex)),
        optional: !main && !technique,
        progression: 'hold',
        sets:
          main || technique
            ? [
                prescriptionSet('technique set', 2, 1, 1, 4, {
                  percent: 0.8,
                  restSeconds: 240,
                }),
              ]
            : paused
              ? [
                  prescriptionSet('technique set', 2, 3, 3, 5, {
                    percent: 0.55,
                  }),
                ]
              : [
                  prescriptionSet(
                    'straight set',
                    dayIndex === 1 && exerciseIndex === 3 ? 1 : 2,
                    min,
                    max,
                    5,
                    { percent: 0.45, restSeconds: 120 },
                  ),
                ],
        notes:
          'Only if readiness is good. Skip if fatigued. No failed attempts.',
      }
      plan.phases[6].overrides[key] = {
        included: main,
        progression: 'attempts',
        sets: main
          ? [
              prescriptionSet('warm-up', 1, 5, 5, 5, { percent: 0.4 }),
              prescriptionSet('warm-up', 1, 3, 3, 5, { percent: 0.6 }),
              prescriptionSet('warm-up', 1, 1, 1, 4, { percent: 0.75 }),
              prescriptionSet('max attempt', 1, 1, 1, null, {
                percent: 0.9,
                restSeconds: 300,
              }),
              prescriptionSet('max attempt', 1, 1, 1, null, {
                percent: 0.96,
                restSeconds: 300,
              }),
              prescriptionSet('max attempt', 1, 1, 1, null, {
                percent: 1,
                restSeconds: 300,
              }),
            ]
          : [],
        notes:
          'Review each attempt after the previous result. Use spotters and safeties. Stop after a failure or painful lift; never chase a stretch goal. A fourth attempt is optional only after an easy successful third.',
      }
    }
  }
  plan.phases[6].dayOffsets = {
    [dayKeys[0]]: 0,
    [dayKeys[1]]: 2,
    [dayKeys[3]]: 5,
  }
  plan.phases[6].dayNames = {
    [dayKeys[0]]: 'Monday — Bench 1RM test',
    [dayKeys[1]]: 'Wednesday — Squat 1RM test',
    [dayKeys[3]]: 'Saturday — Sumo deadlift 1RM test',
  }
  // Distribute the intensification reduction across the day, so rounding
  // two-set exercises individually cannot accidentally retain all their volume.
  for (const [dayIndex, keysForDay] of keys.entries()) {
    const accessories = keysForDay.filter(
      (_, index) =>
        !(index === 0 && [0, 1, 2, 3].includes(dayIndex)) &&
        !(dayIndex === 1 && index === 1),
    )
    const baseline = accessories.reduce(
      (total, key) => total + plan.defaults[key].sets[0].count,
      0,
    )
    const desired = Math.round(baseline * 0.75)
    let assigned = 0
    for (const key of accessories) {
      const group = plan.phases[3].overrides[key].sets![0]
      group.count = Math.max(
        1,
        Math.floor(plan.defaults[key].sets[0].count * 0.75),
      )
      assigned += group.count
    }
    for (const key of accessories) {
      if (assigned >= desired) break
      plan.phases[3].overrides[key].sets![0].count += 1
      assigned += 1
    }
  }
  for (const [dayIndex, goal] of [
    [
      0,
      'Bench: 225 lb minimum goal; 235–245 lb stretch range. Reference: 185 × 7 on November 16, 2026, approximately 228 lb estimated 1RM.',
    ],
    [1, 'Squat: 405 lb stretch goal. Reference: 375 lb completed single.'],
    [
      3,
      'Sumo deadlift: 455 lb stretch goal. Reference: 405 lb completed single.',
    ],
  ] as const) {
    plan.phases[6].overrides[keys[dayIndex][0]].notes +=
      ` ${goal} Goals are not prescribed attempts; recent performance must support each load.`
  }
  return migrateWeekPlan(plan, true)
}
