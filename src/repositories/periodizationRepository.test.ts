import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { TrainingLogDatabase } from '@db/database'
import { createTestDatabase, destroyTestDatabase } from '@test/database'
import { seedProgram, seedFood } from '@test/seedFactories'
import { createPeriodizationRepository } from './periodizationRepository'
import { createProgramRepository } from './programRepository'
import { createWorkoutRepository } from './workoutRepository'
import { createBackupService, validateBackup } from '@services/backupService'
import {
  programPosition,
  resolvePrescription,
  scheduledDate,
  recentCapacity,
  recommendPeriodizedLoad,
  recommendNextAttempt,
  periodizedPlanSchema,
} from '@domain/periodization'
import type { LocalDateString } from '@domain/dates'

let database: TrainingLogDatabase
beforeEach(async () => {
  database = createTestDatabase()
  await database.open()
})
afterEach(async () => {
  await destroyTestDatabase(database)
})

async function fixture(enabled = true) {
  const periodization = createPeriodizationRepository(database)
  await periodization.seedFebruaryProgram()
  const programs = createProgramRepository(database)
  const source = await programs.getTemplateStructure('february-2027-peak')
  if (enabled) {
    source.template.periodization = await periodization.savePlan(
      source.template.id,
      'template',
      { ...source.template.periodization!, enabled: true },
    )
  }
  return {
    periodization,
    programs,
    source,
    plan: source.template.periodization!,
  }
}

describe('periodized programs', () => {
  it('keeps new and legacy plans off until explicitly enabled, with ordinary weeks and set logging', async () => {
    const { programs, source, plan } = await fixture(false)
    expect(plan.enabled ?? false).toBe(false)
    const active = await programs.activateTemplate(source.template.id)
    const current = await programs.getCurrentActiveCycleStructure('2027-05-01')
    expect(current?.cycle.currentWeekNumber).toBe(1)
    expect(current?.days).toHaveLength(active.days.length)
    const workouts = createWorkoutRepository(database)
    const session = await workouts.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: '2027-05-01',
    })
    expect(session.workout.periodizedSession).toBeUndefined()
    expect(session.workout.isDeload).toBe(false)
    expect(session.sets.every((set) => !set.plannedSet)).toBe(true)
    expect(
      session.sets.filter(
        (set) => set.workoutExerciseId === session.exercises[0].id,
      ),
    ).toHaveLength(current!.exercisesByDay[active.days[0].id][0].targetSetCount)
    expect(
      (await database.activeProgramCycles.get(active.cycle.id))?.periodization,
    ).toEqual(plan)
  })

  it('can disable an enabled plan without losing overrides or changing an active workout snapshot', async () => {
    const { programs, periodization, plan } = await fixture()
    const active = await programs.activateTemplate('february-2027-peak')
    const workouts = createWorkoutRepository(database)
    const session = await workouts.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: '2026-11-30',
    })
    await periodization.savePlan(active.cycle.id, 'cycle', {
      ...plan,
      enabled: false,
    })
    const restored = await workouts.getActiveWorkoutStructure()
    expect(restored?.periodizationEnabled).toBe(false)
    expect(restored?.workout).toEqual(session.workout)
    expect(Object.values(restored!.setsByExercise).flat()).toEqual(
      expect.arrayContaining(session.sets),
    )
    expect(
      (await database.activeProgramCycles.get(active.cycle.id))?.periodization
        ?.defaults,
    ).toEqual(plan.defaults)
  })
  it('keeps easy technique deadlifts out of capacity comparisons and strength trends', async () => {
    const { programs, periodization } = await fixture(),
      active = await programs.activateTemplate('february-2027-peak'),
      workouts = createWorkoutRepository(database)
    const heavy = await workouts.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[3].id,
      localDate: '2026-12-04',
    })
    await workouts.updateWorkoutSet(heavy.sets[0].id, {
      metricValues: { weight: 360, reps: 4 },
      rir: 2,
      completed: true,
    })
    await workouts.completeWorkout({ workoutId: heavy.workout.id })
    const easy = await workouts.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[1].id,
      localDate: '2026-12-08',
    })
    const technique = easy.sets.find(
      (set) => set.plannedSet?.kind === 'technique set',
    )!
    await workouts.updateWorkoutSet(technique.id, {
      metricValues: { weight: 270, reps: 3 },
      rir: 5,
      completed: true,
    })
    await workouts.completeWorkout({ workoutId: easy.workout.id })
    const nextHeavy = await workouts.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[3].id,
      localDate: '2026-12-11',
    })
    expect(nextHeavy.sets[0].targetSnapshot?.targetWeight).toBe(360)
    const performance = await periodization.performance(active.cycle.id)
    expect(
      performance.trends.some((point) => point.workoutId === easy.workout.id),
    ).toBe(false)
  })

  it('uses an appropriate paused-bench reference rather than assigning competition-bench loads', async () => {
    const { programs } = await fixture(),
      active = await programs.activateTemplate('february-2027-peak'),
      workouts = createWorkoutRepository(database)
    const bench = await workouts.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: '2026-11-30',
    })
    await workouts.updateWorkoutSet(bench.sets[0].id, {
      metricValues: { weight: 185, reps: 6 },
      rir: 2,
      completed: true,
    })
    await workouts.completeWorkout({ workoutId: bench.workout.id })
    const paused = await workouts.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[2].id,
      localDate: '2026-12-03',
    })
    expect(paused.sets[0].targetSnapshot?.targetWeight).toBeGreaterThanOrEqual(
      155,
    )
    expect(paused.sets[0].targetSnapshot?.targetWeight).toBeLessThanOrEqual(165)
  })
  it('serializes concurrent seeding without duplicate exercises or programs', async () => {
    const repository = createPeriodizationRepository(database)
    await Promise.all([
      repository.seedFebruaryProgram(),
      repository.seedFebruaryProgram(),
    ])
    expect(await database.programTemplates.count()).toBe(1)
    const exercises = await database.exercises.toArray()
    expect(
      new Set(exercises.map((exercise) => exercise.name.toLowerCase())).size,
    ).toBe(exercises.length)
  })

  it('permits a reviewed fourth attempt only after an easy successful third single', async () => {
    const { programs } = await fixture(),
      active = await programs.activateTemplate('february-2027-peak'),
      workouts = createWorkoutRepository(database)
    const session = await workouts.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: '2027-02-22',
    })
    expect(session.workout.name).toBe('Monday — Bench 1RM test')
    const attempts = session.sets.filter(
      (set) => set.plannedSet?.kind === 'max attempt',
    )
    await expect(workouts.addSet(session.exercises[0].id)).rejects.toThrow(
      'fourth attempt',
    )
    for (const [index, set] of attempts.entries())
      await workouts.updateWorkoutSet(set.id, {
        metricValues: { weight: 205 + index * 10, reps: 1 },
        rir: 2,
        barSpeed: 'fast',
        completed: true,
      })
    const fourth = await workouts.addSet(session.exercises[0].id)
    expect(fourth.plannedSet?.kind).toBe('max attempt')
    expect(fourth.targetSnapshot?.targetWeight).toBe(235)
    await expect(workouts.addSet(session.exercises[0].id)).rejects.toThrow(
      'fourth attempt',
    )
  })

  it('keeps planned targets and actual history through full backup restore', async () => {
    const { programs } = await fixture(),
      active = await programs.activateTemplate('february-2027-peak'),
      workouts = createWorkoutRepository(database)
    const session = await workouts.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: '2026-11-30',
    })
    await workouts.updateWorkoutSet(session.sets[0].id, {
      metricValues: { weight: 185, reps: 5 },
      rir: 2,
      completed: true,
    })
    await workouts.completeWorkout({ workoutId: session.workout.id })
    const backup = await createBackupService(database).createJsonBackup()
    const destination = createTestDatabase()
    try {
      await createBackupService(destination).restoreReplace(backup.backup)
      expect(
        (await destination.activeProgramCycles.get(active.cycle.id))
          ?.periodization,
      ).toEqual(active.cycle.periodization)
      expect(
        (await destination.workoutHistorySets.get(session.sets[0].id))
          ?.plannedSet?.kind,
      ).toBe('top set')
      expect(
        (await destination.workoutHistorySets.get(session.sets[0].id))
          ?.metricValues,
      ).toEqual({ weight: 185, reps: 5 })
      expect(
        (await destination.workoutHistoryEntries.get(session.workout.id))
          ?.programWeekNumber,
      ).toBe(2)
    } finally {
      await destroyTestDatabase(destination)
    }
  })
  it.each([
    ['2026-11-23', 1, 'Deload'],
    ['2026-11-30', 2, 'Strength + hypertrophy'],
    ['2026-12-07', 3, 'Strength + hypertrophy'],
    ['2026-12-28', 6, 'Strength development'],
    ['2027-01-18', 9, 'Intensification'],
    ['2027-02-08', 12, 'Peaking'],
    ['2027-02-15', 13, 'Taper'],
    ['2027-02-22', 14, 'Max testing'],
  ])('%s selects week %i, %s', async (date, week, name) => {
    const { plan } = await fixture()
    expect(programPosition(plan, date as LocalDateString)).toMatchObject({
      week,
      phase: { name },
    })
  })

  it('registers once without inventing history and preserves repeating programs and food', async () => {
    const ordinary = await seedProgram(database),
      food = await seedFood(database)
    const { periodization } = await fixture()
    const count = await database.exercises.count()
    await periodization.seedFebruaryProgram()
    expect(await database.exercises.count()).toBe(count)
    expect(await database.programTemplates.count()).toBe(2)
    expect(await database.programTemplates.get(ordinary.template.id)).toEqual(
      ordinary.template,
    )
    expect(await database.foods.get(food.id)).toEqual(food)
    expect(await database.workoutHistoryEntries.count()).toBe(0)
  })

  it('uses full accumulation volume, lower reps in December, and no December max attempts', async () => {
    const { plan, source } = await fixture()
    const bench = source.exercisesByDay[source.days[0].id][0].id
    expect(
      resolvePrescription(plan, 2, bench)?.sets.map((set) => [
        set.kind,
        set.count,
        set.repsMin,
        set.repsMax,
      ]),
    ).toEqual([
      ['top set', 1, 4, 6],
      ['back-off', 3, 4, 6],
    ])
    expect(resolvePrescription(plan, 6, bench)?.sets[0]).toMatchObject({
      repsMin: 3,
      repsMax: 5,
    })
    for (const week of [2, 3, 4, 5, 6])
      for (const key of Object.keys(plan.defaults))
        expect(
          resolvePrescription(plan, week, key)?.sets.some(
            (set) => set.kind === 'max attempt',
          ),
        ).toBe(false)
    expect(resolvePrescription(plan, 9, bench)?.sets[0]).toMatchObject({
      repsMin: 1,
      repsMax: 1,
      rir: 2.5,
    })
    const lat = source.exercisesByDay[source.days[0].id][1].id
    const accessories = source.exercisesByDay[source.days[0].id].slice(1)
    const total = (week: number) =>
      accessories.reduce(
        (sum, exercise) =>
          sum +
          resolvePrescription(plan, week, exercise.id)!.sets.reduce(
            (count, set) => count + set.count,
            0,
          ),
        0,
      )
    expect(total(9) / total(2)).toBeGreaterThanOrEqual(0.7)
    expect(total(9) / total(2)).toBeLessThanOrEqual(0.8)
    expect(resolvePrescription(plan, 12, lat)?.sets[0].count).toBe(2)
    expect(resolvePrescription(plan, 13, lat)).toMatchObject({
      included: true,
      optional: true,
    })
    const volume = (week: number) =>
      Object.keys(plan.defaults).reduce((sum, key) => {
        const prescription = resolvePrescription(plan, week, key)!
        return (
          sum +
          (prescription.included
            ? prescription.sets.reduce((sets, group) => sets + group.count, 0)
            : 0)
        )
      }, 0)
    expect(volume(13) / volume(2)).toBeGreaterThanOrEqual(0.3)
    expect(volume(13) / volume(2)).toBeLessThanOrEqual(0.5)
  })

  it('schedules max tests on February 22, 24 and 27 with warmups and three attempts', async () => {
    const { plan, source } = await fixture()
    for (const [day, date] of [
      [0, '2027-02-22'],
      [1, '2027-02-24'],
      [3, '2027-02-27'],
    ] as const) {
      expect(scheduledDate(plan, 14, source.days[day].id)).toBe(date)
      const sets = resolvePrescription(
        plan,
        14,
        source.exercisesByDay[source.days[day].id][0].id,
      )!.sets
      expect(sets.filter((set) => set.kind === 'max attempt')).toHaveLength(3)
      expect(sets.filter((set) => set.kind === 'warm-up')).toHaveLength(3)
    }
  })

  it('starts resolved sessions, stores actuals separately and preserves history across edits and restart', async () => {
    const { programs, periodization, plan } = await fixture()
    const active = await programs.activateTemplate('february-2027-peak')
    const workouts = createWorkoutRepository(database)
    const started = await workouts.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: '2026-11-30',
    })
    const sets = started.sets.filter(
      (set) => set.workoutExerciseId === started.exercises[0].id,
    )
    expect(sets).toHaveLength(4)
    expect(sets[0].targetSnapshot?.targetWeight).toBe(185)
    expect(sets[1].targetSnapshot?.targetWeight).toBe(175)
    expect(sets[0].metricValues).toEqual({})
    expect(sets[0].rir).toBeNull()
    await workouts.updateWorkoutSet(sets[0].id, {
      metricValues: { weight: 185, reps: 6 },
      rir: 2,
      completed: true,
    })
    expect(
      (await database.workoutSets.get(sets[1].id))?.targetSnapshot
        ?.targetWeight,
    ).toBe(175)
    await workouts.completeWorkout({ workoutId: started.workout.id })
    const history = await database.workoutHistorySets.toArray()
    const next = structuredClone(plan),
      key = Object.keys(plan.defaults)[0]
    next.weeks[10].overrides[key] = {
      sets: [
        { ...plan.defaults[key].sets[0], count: 2, repsMin: 6, repsMax: 6 },
      ],
    }
    await periodization.savePlan(active.cycle.id, 'cycle', next)
    expect(await database.workoutHistorySets.toArray()).toEqual(history)
    expect(
      (await database.programTemplates.get('february-2027-peak'))
        ?.periodization,
    ).toEqual(plan)
    database.close()
    await database.open()
    expect(
      (await database.activeProgramCycles.get(active.cycle.id))?.periodization,
    ).toEqual(next)
    expect(await database.workoutHistorySets.toArray()).toEqual(history)
    await expect(
      workouts.startWorkout({
        activeCycleId: active.cycle.id,
        dayId: active.days[0].id,
        localDate: '2026-12-01',
      }),
    ).rejects.toThrow('already completed')
    const intensification = await workouts.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: '2027-01-18',
    })
    expect(
      intensification.sets[0].targetSnapshot?.targetWeight,
    ).toBeGreaterThan(185)
    expect(intensification.sets[0].targetSnapshot?.targetRepsMin).toBe(1)
  })

  it('does not let deload or taper performance lower future capacity', async () => {
    const { programs } = await fixture(),
      active = await programs.activateTemplate('february-2027-peak'),
      workouts = createWorkoutRepository(database)
    const recovery = await workouts.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: '2026-11-23',
    })
    expect(recovery.workout.isDeload).toBe(true)
    expect(
      recovery.sets.filter(
        (set) => set.workoutExerciseId === recovery.exercises[0].id,
      ),
    ).toHaveLength(2)
    await workouts.updateWorkoutSet(recovery.sets[0].id, {
      metricValues: { weight: 140, reps: 5 },
      rir: 5,
      completed: true,
    })
    await workouts.completeWorkout({ workoutId: recovery.workout.id })
    const normal = await workouts.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: '2026-11-30',
    })
    expect(normal.sets[0].targetSnapshot?.targetWeight).toBe(185)
    expect(
      (
        await createPeriodizationRepository(database).performance(
          active.cycle.id,
        )
      ).trends,
    ).toHaveLength(0)
  })

  it('supports a second program from a repeating template, cloning and valid backups', async () => {
    const ordinary = await seedProgram(database),
      { periodization, programs } = await fixture()
    await periodization.fromRepeatingTemplate(
      ordinary.template.id,
      '2027-03-01',
      8,
    )
    const clone = await programs.cloneProgramTemplate(ordinary.template.id)
    expect(Object.keys(clone.template.periodization!.defaults)).toEqual([
      clone.exercises[0].id,
    ])
    const active = await programs.activateTemplate(clone.template.id)
    expect(active.cycle.periodization).toEqual(clone.template.periodization)
    const backup = await createBackupService(database).createJsonBackup()
    expect(validateBackup(backup.backup, backup.filename).ok).toBe(true)
    const validated = validateBackup(backup.backup, backup.filename)
    if (validated.ok)
      expect(
        validated.backup.data.activeProgramCycles[0].periodization,
      ).toEqual(active.cycle.periodization)
  })

  it('opts an ordinary active program in without losing its source exercise mappings', async () => {
    const ordinary = await seedProgram(database)
    const programs = createProgramRepository(database)
    const active = await programs.activateTemplate(ordinary.template.id)
    const periodization = createPeriodizationRepository(database)
    const plan = await periodization.fromRepeatingTemplate(
      active.cycle.id,
      '2027-03-01',
      8,
      'cycle',
    )
    expect(plan.enabled).toBe(true)
    const session = await createWorkoutRepository(database).startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: '2027-03-01',
    })
    expect(session.exercises).toHaveLength(1)
    expect(session.sets).toHaveLength(ordinary.exercises[0].targetSetCount)
    expect(session.sets[0].plannedSet?.kind).toBe('straight set')
    expect(session.workout.periodizedSession?.scheduledDate).toBe('2027-03-01')
  })

  it('rejects invalid schedules and stops aggressive attempts after misses or slow lifts', async () => {
    const { plan } = await fixture()
    expect(
      periodizedPlanSchema.safeParse({ ...plan, startDate: '2027-02-30' })
        .success,
    ).toBe(false)
    expect(recommendNextAttempt({ capacity: 228 })).toBe(205)
    expect(
      recommendNextAttempt({
        capacity: 240,
        previousWeight: 225,
        succeeded: false,
      }),
    ).toBeNull()
    expect(
      recommendNextAttempt({
        capacity: 240,
        previousWeight: 225,
        succeeded: true,
        speed: 'slow',
      }),
    ).toBeNull()
    expect(
      recommendNextAttempt({
        capacity: 240,
        previousWeight: 225,
        succeeded: true,
        fourth: true,
      }),
    ).toBeNull()
    expect(recentCapacity([], 228)).toBe(228)
    const prescription = Object.values(plan.defaults)[0]
    expect(
      recommendPeriodizedLoad(
        {
          ...prescription.sets[0],
          startingWeight: undefined,
          repsMin: 1,
          percent: 0.9,
        },
        prescription,
        [],
      ),
    ).toBe(205)
  })
})
