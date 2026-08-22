import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { TrainingLogDatabase } from '@db/database'
import { BUILT_IN_EXERCISES } from '@domain/exerciseLibrary'
import { getTrackingMethod } from '@domain/trackingMethods'
import { createExerciseRepository } from '@repositories/exerciseRepository'
import { createProgramRepository } from '@repositories/programRepository'
import { createSettingsRepository } from '@repositories/settingsRepository'
import { createWorkoutRepository } from '@repositories/workoutRepository'
import { createTestDatabase, destroyTestDatabase } from '@test/database'
import { seedProgram, testLocalDate } from '@test/seedFactories'

let database: TrainingLogDatabase

beforeEach(() => {
  database = createTestDatabase()
})

afterEach(async () => {
  await destroyTestDatabase(database)
})

describe('workoutRepository', () => {
  it('prevents duplicate active workouts after one is already started', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    await database.activeCycleWorkoutExercises.update(active.exercises[0].id, {
      exerciseId: 'builtin:bench-press',
    })
    const repository = createWorkoutRepository(database)

    await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })

    await expect(
      repository.startWorkout({
        activeCycleId: active.cycle.id,
        dayId: active.days[0].id,
        localDate: testLocalDate,
      }),
    ).rejects.toThrow('An active workout already exists.')
    await expect(database.workouts.toArray()).resolves.toHaveLength(1)
  })

  it('starts a workout from an active-cycle day and completes it into history', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    await database.activeCycleWorkoutExercises.update(active.exercises[0].id, {
      exerciseId: 'builtin:bench-press',
    })
    const repository = createWorkoutRepository(database)

    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await repository.updateWorkoutSet(started.sets[0].id, { completed: true })
    const completed = await repository.completeWorkout({
      workoutId: started.workout.id,
      completedAt: new Date(
        Date.parse(started.workout.startedAt) + 30 * 60 * 1000,
      ).toISOString(),
      detectedChanges: [
        {
          type: 'set_added',
          description: 'Added set 3',
          sourcePath: 'cycle.days[0].exercises[0]',
          performedPath: 'workout.exercises[0].sets[2]',
        },
      ],
    })

    expect(started.exercises).toHaveLength(1)
    expect(started.sets).toHaveLength(2)
    expect(started.workout.id).not.toBe(active.days[0].id)
    expect(started.exercises[0].id).not.toBe(active.exercises[0].id)
    expect(completed.history).toMatchObject({
      id: started.workout.id,
      status: 'completed',
      durationSeconds: 1800,
    })
    await expect(database.workouts.toArray()).resolves.toEqual([])
    await expect(
      database.workoutHistoryEntries.toArray(),
    ).resolves.toHaveLength(1)
    await expect(
      database.detectedWorkoutChanges.toArray(),
    ).resolves.toMatchObject([
      {
        type: 'set_added',
        status: 'pending',
        selectedDestination: 'neither',
      },
    ])

    const resumed = await repository.resumeCompletedWorkout(
      completed.history.id,
    )

    expect(resumed).toMatchObject({
      id: started.workout.id,
      status: 'active',
      completedAt: null,
    })
    await expect(database.workouts.toArray()).resolves.toHaveLength(1)
    await expect(database.workoutExercises.toArray()).resolves.toHaveLength(1)
    await expect(database.workoutSets.toArray()).resolves.toHaveLength(2)
    await expect(database.workoutHistoryEntries.toArray()).resolves.toEqual([])
    await expect(database.detectedWorkoutChanges.toArray()).resolves.toEqual([])
  })

  it('dedupes concurrent finish requests for the same workout', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    await database.activeCycleWorkoutExercises.update(active.exercises[0].id, {
      exerciseId: 'builtin:bench-press',
    })
    const repository = createWorkoutRepository(database)

    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await repository.updateWorkoutSet(started.sets[0].id, { completed: true })

    // Two finishes race (for example the screen unmounts and the user presses
    // Finish again). Both resolve with the same history and only one is written.
    const [first, second] = await Promise.all([
      repository.completeWorkout({ workoutId: started.workout.id }),
      repository.completeWorkout({ workoutId: started.workout.id }),
    ])

    expect(first.history.id).toBe(started.workout.id)
    expect(second.history.id).toBe(first.history.id)
    await expect(
      database.workoutHistoryEntries.toArray(),
    ).resolves.toHaveLength(1)
    await expect(database.workouts.toArray()).resolves.toEqual([])

    // The in-flight guard clears after completion, so a later finish of the
    // same (now missing) workout still surfaces the not-found error.
    await expect(
      repository.completeWorkout({ workoutId: started.workout.id }),
    ).rejects.toThrow('was not found')
  })

  it('finishes a workout when a set has recorded values but is not checked complete', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const repository = createWorkoutRepository(database)
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })

    await repository.updateWorkoutSetMetricAndPropagate(
      started.sets[0].id,
      'reps',
      8,
    )
    const completed = await repository.completeWorkout({
      workoutId: started.workout.id,
    })

    await expect(
      database.workouts.get(started.workout.id),
    ).resolves.toBeUndefined()
    await expect(
      database.workoutHistorySets.get(started.sets[0].id),
    ).resolves.toMatchObject({
      workoutId: completed.history.id,
      metricValues: expect.objectContaining({ reps: 8 }),
      completed: false,
    })
  })

  it('persists manual pauses and excludes them from completed duration', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const repository = createWorkoutRepository(database)
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await repository.updateWorkoutSet(started.sets[0].id, { completed: true })

    const pauseAt = new Date(
      Date.parse(started.workout.startedAt) + 10 * 60 * 1000,
    ).toISOString()
    const resumeAt = new Date(
      Date.parse(pauseAt) + 20 * 60 * 1000,
    ).toISOString()
    await expect(
      repository.pauseWorkout(started.workout.id, pauseAt),
    ).resolves.toMatchObject({ pausedAt: pauseAt })
    await expect(
      repository.resumeWorkout(started.workout.id, resumeAt),
    ).resolves.toMatchObject({
      elapsedPausedSeconds: 1200,
      pausedAt: null,
    })

    const completedAt = new Date(
      Date.parse(resumeAt) + 15 * 60 * 1000,
    ).toISOString()
    const completed = await repository.completeWorkout({
      workoutId: started.workout.id,
      completedAt,
    })

    expect(completed.history).toMatchObject({
      durationSeconds: 1500,
      elapsedPausedSeconds: 1200,
      pausedAt: null,
    })
  })

  it('counts an unfinished current pause when completing a workout', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const repository = createWorkoutRepository(database)
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await repository.updateWorkoutSet(started.sets[0].id, { completed: true })
    const pauseAt = new Date(
      Date.parse(started.workout.startedAt) + 10 * 60 * 1000,
    ).toISOString()
    await repository.pauseWorkout(started.workout.id, pauseAt)

    const completed = await repository.completeWorkout({
      workoutId: started.workout.id,
      completedAt: new Date(Date.parse(pauseAt) + 30 * 60 * 1000).toISOString(),
    })

    expect(completed.history).toMatchObject({
      durationSeconds: 600,
      elapsedPausedSeconds: 1800,
      pausedAt: null,
    })
  })

  it('uses the current exercise default rest when starting from an older program snapshot', async () => {
    const exerciseRepository = createExerciseRepository(database)
    const exercise = await exerciseRepository.createExercise({
      name: 'Remembered rest press',
      defaultRestSeconds: 60,
      trackingMethodId: 'weight_reps',
    })
    const program = await createProgramRepository(
      database,
    ).createProgramTemplate({
      name: 'Remembered rest',
      days: [
        {
          name: 'Day',
          exercises: [
            {
              exerciseId: exercise.id,
              targetSetCount: 2,
              targetRepsMin: 5,
              targetRepsMax: 8,
              restSecondsOverride: null,
            },
          ],
        },
      ],
    })
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    await exerciseRepository.updateExerciseDefaultRest(exercise.id, 105)

    const started = await createWorkoutRepository(database).startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })

    expect(started.exercises[0].exerciseSnapshot.defaultRestSeconds).toBe(105)
    expect(started.sets.map((set) => set.restSecondsUsed)).toEqual([null, null])
  })

  it('uses corrected built-in tracking metadata when starting from an older program snapshot', async () => {
    const bodyweightSquat = BUILT_IN_EXERCISES.find(
      (exercise) => exercise.id === 'builtin:bodyweight-squat',
    )
    const repsOnly = getTrackingMethod('reps_only')
    if (!bodyweightSquat || !repsOnly) {
      throw new Error('Required exercise metadata was not found.')
    }
    await database.exercises.put(bodyweightSquat)
    const program = await createProgramRepository(
      database,
    ).createProgramTemplate({
      name: 'Corrected tracking',
      days: [
        {
          name: 'Day',
          exercises: [
            {
              exerciseId: bodyweightSquat.id,
              targetSetCount: 1,
              targetRepsMin: 8,
              targetRepsMax: 12,
              restSecondsOverride: null,
            },
          ],
        },
      ],
    })
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    await database.activeCycleWorkoutExercises.update(active.exercises[0].id, {
      exerciseSnapshot: {
        ...active.exercises[0].exerciseSnapshot,
        trackingMethodId: 'reps_only',
        trackingMetrics: repsOnly.metrics,
      },
    })

    const started = await createWorkoutRepository(database).startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })

    expect(started.exercises[0].exerciseSnapshot).toMatchObject({
      trackingMethodId: 'added_weight_reps',
      trackingMetrics: [
        expect.objectContaining({ key: 'addedWeight' }),
        expect.objectContaining({ key: 'reps' }),
      ],
    })
  })

  it('checks the program day off for the current week when a workout is completed', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const repository = createWorkoutRepository(database)

    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await repository.updateWorkoutSet(started.sets[0].id, { completed: true })
    await repository.completeWorkout({ workoutId: started.workout.id })

    const checks = await database.activeCycleDayChecks.toArray()
    expect(checks).toMatchObject([
      {
        activeCycleId: active.cycle.id,
        dayId: active.days[0].id,
        weekNumber: 1,
        checked: true,
      },
    ])
  })

  it('rejects invalid active-cycle and workout-day relationships', async () => {
    const firstProgram = await seedProgram(database)
    const firstActive = await createProgramRepository(
      database,
    ).activateTemplate(firstProgram.template.id)
    const secondProgram = await seedProgram(database)
    const secondActive = await createProgramRepository(
      database,
    ).activateTemplate(secondProgram.template.id)
    const repository = createWorkoutRepository(database)

    await expect(
      repository.startWorkout({
        activeCycleId: firstActive.cycle.id,
        dayId: secondActive.days[0].id,
        localDate: testLocalDate,
      }),
    ).rejects.toThrow('Active cycle workout day was not found.')
  })

  it('prefills the prescribed RIR target on the final set only', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const repository = createWorkoutRepository(database)
    await createSettingsRepository(database).saveRirTrackingEnabled(true)
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })

    const sets = started.sets
      .filter((set) => set.workoutExerciseId === started.exercises[0].id)
      .sort((first, second) => first.setNumber - second.setNumber)
    // seedProgram prescribes two sets with a target RIR of 2.
    expect(sets.map((set) => set.rir)).toEqual([null, 2])
    expect(sets.map((set) => set.metricValues)).toEqual([{}, {}])
    expect(sets.map((set) => set.targetRecommendation)).toEqual([null, null])
  })

  it('uses historical RIR for estimates without copying it into the new result field', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const repository = createWorkoutRepository(database)
    const settings = createSettingsRepository(database)
    await settings.saveRirTrackingEnabled(true)
    await settings.saveWorkoutAutofillMode('smart_progression')
    const first = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await repository.updateWorkoutSet(first.sets[0].id, {
      metricValues: { weight: 100, reps: 10 },
      completed: true,
    })
    await repository.updateWorkoutSet(first.sets[1].id, {
      metricValues: { weight: 100, reps: 10 },
      rir: 0,
      completed: true,
    })
    await repository.completeWorkout({
      workoutId: first.workout.id,
      completedAt: first.workout.startedAt,
    })

    const second = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })

    expect(second.sets.map((set) => set.rir)).toEqual([null, 2])
  })

  it('prefills the RIR target on every set and snapshots the flag when the program tracks RIR each set', async () => {
    const program = await seedProgram(database)
    const programRepository = createProgramRepository(database)
    await programRepository.updateProgramTemplate(program.template.id, {
      trackRirEverySet: true,
    })
    const active = await programRepository.activateTemplate(program.template.id)
    expect(active.cycle.trackRirEverySet).toBe(true)

    const repository = createWorkoutRepository(database)
    await createSettingsRepository(database).saveRirTrackingEnabled(true)
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })

    expect(started.workout.trackRirEverySet).toBe(true)
    const sets = started.sets
      .filter((set) => set.workoutExerciseId === started.exercises[0].id)
      .sort((first, second) => first.setNumber - second.setNumber)
    expect(sets.map((set) => set.rir)).toEqual([3, 2])
  })

  it('starts, saves, and advances a scheduled deload from history with RIR forced on', async () => {
    const program = await seedProgram(database)
    const programs = createProgramRepository(database)
    const active = await programs.activateTemplate(program.template.id)
    const settings = createSettingsRepository(database)
    await settings.saveRirTrackingEnabled(false)
    await settings.saveWorkoutAutofillMode('smart_progression')
    const repository = createWorkoutRepository(database)

    const regular = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    for (const set of regular.sets) {
      await repository.updateWorkoutSet(set.id, {
        metricValues: { weight: 100, reps: 10 },
        rir: set.setNumber === regular.sets.length ? 2 : null,
        completed: true,
      })
    }
    await repository.completeWorkout({ workoutId: regular.workout.id })
    await programs.updateActiveCycle(active.cycle.id, {
      deloadWeekNumbers: [2],
      deloadSchedulingEnabled: true,
    })

    const deload = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })

    expect(deload.workout).toMatchObject({
      name: 'Deload Upper',
      programWeekNumber: 2,
      isDeload: true,
    })
    expect(deload.sets).toHaveLength(1)
    expect(deload.sets[0].rir).toBe(5)
    expect(deload.sets[0].metricValues.weight).toBeLessThan(100)
    await repository.updateWorkoutSet(deload.sets[0].id, { completed: true })
    const completed = await repository.completeWorkout({
      workoutId: deload.workout.id,
    })
    expect(completed.history).toMatchObject({
      name: 'Deload Upper',
      programWeekNumber: 2,
      isDeload: true,
    })
    await expect(
      database.detectedWorkoutChanges
        .where({ workoutId: deload.workout.id })
        .count(),
    ).resolves.toBe(0)
    await expect(
      database.activeProgramCycles.get(active.cycle.id),
    ).resolves.toMatchObject({
      currentWeekNumber: 3,
    })
  })

  it('persists live metric edits, notes, set completion, add set, and delete set', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const repository = createWorkoutRepository(database)
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })

    await repository.updateWorkoutNotes(started.workout.id, 'felt steady')
    await repository.updateWorkoutExerciseNotes(
      started.exercises[0].id,
      'pause first rep',
    )
    await repository.updateWorkoutSet(started.sets[0].id, {
      metricValues: { weight: 185, reps: 8 },
      rir: 2,
      completed: true,
    })
    const added = await repository.addSet(started.exercises[0].id)
    await repository.deleteSet(started.sets[1].id)
    await expect(
      repository.deleteSet(started.sets[1].id),
    ).resolves.toBeUndefined()

    const reloaded = await repository.getActiveWorkoutStructure()

    expect(reloaded?.workout.notes).toBe('felt steady')
    expect(reloaded?.exercises[0].notes).toBe('pause first rep')
    expect(reloaded?.setsByExercise[started.exercises[0].id]).toMatchObject([
      {
        setNumber: 1,
        metricValues: { weight: 185, reps: 8 },
        rir: 2,
        completed: true,
      },
      {
        id: added.id,
        setNumber: 2,
      },
    ])
  })

  it('removes a live exercise and all of its active sets without changing the program', async () => {
    const program = await seedProgram(database)
    const programs = createProgramRepository(database)
    const active = await programs.activateTemplate(program.template.id)
    const repository = createWorkoutRepository(database)
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await repository.updateWorkoutSet(started.sets[0].id, {
      metricValues: { weight: 185, reps: 8 },
      completed: true,
    })

    await repository.removeExerciseFromLiveWorkout(started.exercises[0].id)

    const reloaded = await repository.getActiveWorkoutStructure()
    expect(reloaded?.exercises).toEqual([])
    expect(reloaded?.setsByExercise).toEqual({})
    await expect(
      database.activeCycleWorkoutExercises.get(active.exercises[0].id),
    ).resolves.toMatchObject({ targetSetCount: 2 })
    await expect(
      database.templateWorkoutExercises.get(program.exercises[0].id),
    ).resolves.toMatchObject({ targetSetCount: 2 })
  })

  it('uses the prescribed rest in the live snapshot and updates upcoming sets only', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const repository = createWorkoutRepository(database)
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })

    expect(started.exercises[0].exerciseSnapshot.defaultRestSeconds).toBe(90)
    await repository.updateWorkoutSet(started.sets[0].id, { completed: true })
    await repository.updateWorkoutExerciseDefaultRest(
      started.exercises[0].id,
      105,
    )

    const reloaded = await repository.getActiveWorkoutStructure()
    expect(
      reloaded?.setsByExercise[started.exercises[0].id].map(
        (set) => set.restSecondsUsed,
      ),
    ).toEqual([90, 105])
    expect(reloaded?.exercises[0].exerciseSnapshot.defaultRestSeconds).toBe(105)
  })

  it('added sets inherit auto values with a one-rep fatigue step', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const repository = createWorkoutRepository(database)
    await createSettingsRepository(database).saveWorkoutAutofillMode(
      'smart_progression',
    )
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })

    const lastSet = started.sets
      .filter((set) => set.workoutExerciseId === started.exercises[0].id)
      .at(-1)
    await repository.updateWorkoutSet(lastSet!.id, {
      metricValues: { weight: 200, reps: 6 },
    })
    const added = await repository.addSet(started.exercises[0].id)

    expect(added.metricValues).toMatchObject({ weight: 200, reps: 5 })
    expect(added.metricValueSources).toMatchObject({
      weight: 'auto',
      reps: 'auto',
    })

    // A live edit on the previous set still flows into the added set.
    await repository.updateWorkoutSetMetricAndPropagate(
      lastSet!.id,
      'weight',
      210,
    )
    const reloaded = await repository.getActiveWorkoutStructure()
    const reloadedAdded = reloaded?.setsByExercise[
      started.exercises[0].id
    ].find((set) => set.id === added.id)
    expect(reloadedAdded?.metricValues.weight).toBe(210)
  })

  it('adds a usable set immediately and restores prior reps', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const addedExercise = await createExerciseRepository(
      database,
    ).createExercise({
      name: 'History row',
      defaultRestSeconds: 75,
      trackingMethodId: 'weight_reps',
      notes: '',
    })
    const repository = createWorkoutRepository(database)
    const first = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    const firstAdded = await repository.addExercise({
      workoutId: first.workout.id,
      exerciseId: addedExercise.id,
    })
    await expect(
      repository.addExercise({
        workoutId: first.workout.id,
        exerciseId: addedExercise.id,
      }),
    ).rejects.toThrow('That exercise is already in this workout.')
    let structure = await repository.getActiveWorkoutStructure()
    const firstHistoricalSet = structure?.setsByExercise[firstAdded.id][0]
    expect(firstHistoricalSet).toBeDefined()
    await repository.updateWorkoutSet(firstHistoricalSet!.id, {
      metricValues: { weight: 135, reps: 8 },
      completed: true,
    })
    const secondHistoricalSet = await repository.addSet(firstAdded.id)
    await repository.updateWorkoutSet(secondHistoricalSet.id, {
      metricValues: { weight: 130, reps: 7 },
      completed: true,
    })
    await repository.completeWorkout({ workoutId: first.workout.id })

    const second = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    const secondAdded = await repository.addExercise({
      workoutId: second.workout.id,
      exerciseId: addedExercise.id,
    })
    structure = await repository.getActiveWorkoutStructure()
    const restoredSets = structure?.setsByExercise[secondAdded.id]

    expect(restoredSets).toHaveLength(1)
    expect(restoredSets?.[0]).toMatchObject({
      setNumber: 1,
      metricValues: { weight: 135, reps: 8 },
    })
    expect(restoredSets?.[0].metricValueSources).toMatchObject({
      weight: 'auto',
      reps: 'auto',
    })
  })

  it('prefills a swapped exercise from its most recent completed set sequence', async () => {
    const program = await seedProgram(database)
    const activeCycle = await createProgramRepository(
      database,
    ).activateTemplate(program.template.id)
    const replacement = await createExerciseRepository(database).createExercise(
      {
        name: 'History pulldown',
        defaultRestSeconds: 75,
        trackingMethodId: 'weight_reps',
        notes: '',
      },
    )
    const repository = createWorkoutRepository(database)
    const historical = await repository.startWorkout({
      activeCycleId: activeCycle.cycle.id,
      dayId: activeCycle.days[0].id,
      localDate: testLocalDate,
    })
    const historicalExercise = await repository.addExercise({
      workoutId: historical.workout.id,
      exerciseId: replacement.id,
    })
    let structure = await repository.getActiveWorkoutStructure()
    const firstSet = structure?.setsByExercise[historicalExercise.id][0]
    await repository.updateWorkoutSet(firstSet!.id, {
      metricValues: { weight: 120, reps: 10 },
      completed: true,
    })
    const secondSet = await repository.addSet(historicalExercise.id)
    await repository.updateWorkoutSet(secondSet.id, {
      metricValues: { weight: 115, reps: 9 },
      completed: true,
    })
    await repository.completeWorkout({ workoutId: historical.workout.id })

    const current = await repository.startWorkout({
      activeCycleId: activeCycle.cycle.id,
      dayId: activeCycle.days[0].id,
      localDate: testLocalDate,
    })
    await repository.replaceExercise({
      workoutExerciseId: current.exercises[0].id,
      exerciseId: replacement.id,
      keepCompatibleSetValues: false,
    })
    structure = await repository.getActiveWorkoutStructure()
    const swappedSets = structure?.setsByExercise[current.exercises[0].id]

    expect(swappedSets).toHaveLength(2)
    expect(swappedSets?.map((set) => set.setNumber)).toEqual([1, 2])
    expect(swappedSets?.map((set) => set.metricValues)).toEqual([
      { weight: 120, reps: 10 },
      { weight: 115, reps: 9 },
    ])
    expect(swappedSets?.every((set) => !set.completed)).toBe(true)
    const unchangedHistory = await repository.getWorkoutHistoryStructure(
      historical.workout.id,
    )
    expect(
      unchangedHistory.setsByExercise[historicalExercise.id].map(
        (set) => set.metricValues,
      ),
    ).toEqual([
      { weight: 120, reps: 10 },
      { weight: 115, reps: 9 },
    ])
  })

  it('keeps the current set count blank when a swap has no history', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const replacement = await createExerciseRepository(database).createExercise(
      {
        name: 'Never logged fly',
        defaultRestSeconds: 60,
        trackingMethodId: 'weight_reps',
        notes: '',
      },
    )
    const repository = createWorkoutRepository(database)
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    const originalSetCount = started.sets.filter(
      (set) => set.workoutExerciseId === started.exercises[0].id,
    ).length

    await repository.replaceExercise({
      workoutExerciseId: started.exercises[0].id,
      exerciseId: replacement.id,
      keepCompatibleSetValues: false,
    })
    const structure = await repository.getActiveWorkoutStructure()
    const swappedSets = structure?.setsByExercise[started.exercises[0].id]

    expect(swappedSets).toHaveLength(originalSetCount)
    expect(swappedSets?.every((set) => !set.completed)).toBe(true)
    expect(
      swappedSets?.every((set) => !Object.keys(set.metricValues).length),
    ).toBe(true)
  })

  it('merges partial live metric edits with stored set values', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const repository = createWorkoutRepository(database)
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })

    await repository.updateWorkoutSet(started.sets[0].id, {
      metricValues: { weight: 185 },
    })
    await repository.updateWorkoutSet(started.sets[0].id, {
      metricValues: { reps: 8 },
    })
    await repository.updateWorkoutSet(started.sets[0].id, {
      completed: true,
    })

    const reloaded = await repository.getActiveWorkoutStructure()

    expect(
      reloaded?.setsByExercise[started.exercises[0].id][0].metricValues,
    ).toEqual({ weight: 185, reps: 8 })
  })

  it('persists live progression suggestions and manual target edits separately from actuals', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    await database.activeCycleWorkoutExercises.update(active.exercises[0].id, {
      targetWeight: 185,
    })
    const repository = createWorkoutRepository(database)
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })

    await repository.updateWorkoutSet(started.sets[0].id, {
      metricValues: { weight: 185, reps: 11 },
      completed: true,
    })
    let reloaded = await repository.getActiveWorkoutStructure()
    const nextSet = reloaded?.setsByExercise[started.exercises[0].id][1]

    expect(nextSet?.targetRecommendation).toMatchObject({
      reason: 'above_range_increase_difficulty',
      originalTarget: {
        targetWeight: 185,
        targetRepsMin: 8,
        targetRepsMax: 10,
      },
      suggestedTarget: {
        targetWeight: 190,
        targetRepsMin: 8,
        targetRepsMax: 8,
      },
      userEditedTarget: null,
    })
    await repository.updateWorkoutSetTarget(nextSet!.id, {
      targetWeight: 187.5,
    })
    reloaded = await repository.getActiveWorkoutStructure()
    const edited = reloaded?.setsByExercise[started.exercises[0].id][1]
    expect(edited?.targetRecommendation).toMatchObject({
      reason: 'manual_target_retained',
      suggestedTarget: { targetWeight: 190 },
      userEditedTarget: { targetWeight: 187.5 },
    })
    expect(edited?.metricValues).toEqual({})
  })

  it('enters every tracking metric type during a live workout', async () => {
    const exerciseRepository = createExerciseRepository(database)
    const exercises = await Promise.all([
      exerciseRepository.createExercise({
        name: 'Pullup',
        defaultRestSeconds: 60,
        trackingMethodId: 'bodyweight_reps',
      }),
      exerciseRepository.createExercise({
        name: 'Assisted dip',
        defaultRestSeconds: 60,
        trackingMethodId: 'assisted_weight_reps',
      }),
      exerciseRepository.createExercise({
        name: 'Crunch',
        defaultRestSeconds: 30,
        trackingMethodId: 'reps_only',
      }),
      exerciseRepository.createExercise({
        name: 'Plank',
        defaultRestSeconds: 30,
        trackingMethodId: 'duration',
      }),
      exerciseRepository.createExercise({
        name: 'Carry',
        defaultRestSeconds: 30,
        trackingMethodId: 'distance_duration',
      }),
    ])
    const program = await createProgramRepository(
      database,
    ).createProgramTemplate({
      name: 'Metric day',
      days: [
        {
          name: 'All metrics',
          exercises: exercises.map((exercise) => ({
            exerciseId: exercise.id,
            targetSetCount: 1,
          })),
        },
      ],
    })
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const repository = createWorkoutRepository(database)
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    const values: Array<Record<string, number>> = [
      { reps: 10 },
      { assistedWeight: 40, reps: 8 },
      { reps: 20 },
      { durationSeconds: 45 },
      { distance: 0.25, durationSeconds: 60 },
    ]

    await Promise.all(
      started.sets.map((set, index) =>
        repository.updateWorkoutSet(set.id, {
          metricValues: values[index],
          completed: true,
        }),
      ),
    )

    const reloaded = await repository.getActiveWorkoutStructure()
    const storedValues = reloaded?.exercises.map(
      (exercise) => reloaded.setsByExercise[exercise.id][0].metricValues,
    )
    expect(storedValues).toEqual(values)
  })

  it('replaces and skips exercises only in the active workout snapshot', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const replacement = await createExerciseRepository(database).createExercise(
      {
        name: 'Dumbbell press',
        defaultRestSeconds: 75,
        trackingMethodId: 'weight_reps',
      },
    )
    const repository = createWorkoutRepository(database)
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })

    await repository.updateWorkoutSet(started.sets[0].id, {
      metricValues: { weight: 50, reps: 10 },
    })
    await repository.replaceExercise({
      workoutExerciseId: started.exercises[0].id,
      exerciseId: replacement.id,
      keepCompatibleSetValues: true,
    })
    await repository.skipExercise(started.exercises[0].id, true)

    const reloaded = await repository.getActiveWorkoutStructure()
    expect(reloaded?.exercises[0]).toMatchObject({
      exerciseId: replacement.id,
      skipped: true,
      replacementOfExerciseId: active.exercises[0].exerciseId,
    })
    expect(active.exercises[0].exerciseId).not.toBe(replacement.id)
    expect(
      reloaded?.setsByExercise[started.exercises[0].id][0].metricValues,
    ).toEqual({ weight: 50, reps: 10 })
  })

  it('manages rest timer pause, resume, add time, skip, and dismiss state', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const repository = createWorkoutRepository(database)
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })

    await repository.setRestTimer(started.workout.id, 90)
    await repository.pauseRestTimer(started.workout.id)
    let reloaded = await repository.getActiveWorkoutStructure()
    expect(reloaded?.workout.activeRestTimer).toMatchObject({
      durationSeconds: 90,
      status: 'paused',
    })

    await repository.resumeRestTimer(started.workout.id)
    await repository.addRestTimerSeconds(started.workout.id, 30)
    reloaded = await repository.getActiveWorkoutStructure()
    expect(reloaded?.workout.activeRestTimer).toMatchObject({
      durationSeconds: 120,
      status: 'running',
    })

    await repository.setRestTimerDuration(started.workout.id, 75)
    reloaded = await repository.getActiveWorkoutStructure()
    expect(reloaded?.workout.activeRestTimer).toMatchObject({
      durationSeconds: 75,
      accumulatedPausedSeconds: 0,
      status: 'running',
    })

    await repository.addRestTimerSeconds(started.workout.id, -150)
    reloaded = await repository.getActiveWorkoutStructure()
    expect(reloaded?.workout.activeRestTimer).toMatchObject({
      durationSeconds: 0,
      status: 'running',
    })

    await repository.completeRestTimer(started.workout.id)
    reloaded = await repository.getActiveWorkoutStructure()
    expect(reloaded?.workout.activeRestTimer).toMatchObject({
      status: 'completed',
    })

    await repository.dismissRestTimer(started.workout.id)
    reloaded = await repository.getActiveWorkoutStructure()
    expect(reloaded?.workout.activeRestTimer).toMatchObject({
      status: 'dismissed',
    })
  })

  it('dismisses a missing rest timer without surfacing an error', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const repository = createWorkoutRepository(database)
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })

    await expect(
      repository.dismissRestTimer(started.workout.id),
    ).resolves.toBeNull()
  })

  it('recovers active workout edits after repository reload and avoids duplicate sets', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const repository = createWorkoutRepository(database)
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await repository.updateWorkoutSet(started.sets[0].id, {
      metricValues: { weight: 200, reps: 5 },
      completed: true,
    })

    const reloadedRepository = createWorkoutRepository(database)
    const reloaded = await reloadedRepository.getActiveWorkoutStructure()

    expect(reloaded?.setsByExercise[started.exercises[0].id]).toHaveLength(2)
    expect(
      reloaded?.setsByExercise[started.exercises[0].id][0].metricValues,
    ).toEqual({ weight: 200, reps: 5 })
  })

  it('edits the live prescription without mutating the program or deleting completed sets', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const repository = createWorkoutRepository(database)
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    const workoutExercise = started.exercises[0]

    const expanded = await repository.updateLiveExercisePrescription({
      workoutExerciseId: workoutExercise.id,
      targetSetCount: 4,
      targetRepsMin: 6,
      targetRepsMax: 8,
    })
    expect(expanded.sets).toHaveLength(4)
    expect(expanded.sets.slice(2).map((set) => set.metricValues)).toEqual([
      {},
      {},
    ])
    expect(expanded.exercise).toMatchObject({
      sessionTargetRepsMin: 6,
      sessionTargetRepsMax: 8,
    })

    const completedSet = expanded.sets[3]
    await repository.updateWorkoutSet(completedSet.id, {
      metricValues: { weight: 185, reps: 7 },
      completed: true,
    })
    await repository.updateLiveExercisePrescription({
      workoutExerciseId: workoutExercise.id,
      targetSetCount: 2,
      targetRepsMin: 5,
      targetRepsMax: 7,
    })

    const reloaded = await repository.getActiveWorkoutStructure()
    const remaining = reloaded?.setsByExercise[workoutExercise.id] ?? []
    expect(remaining).toHaveLength(2)
    expect(remaining.map((set) => set.id)).toContain(completedSet.id)
    expect(remaining.find((set) => set.id === completedSet.id)).toMatchObject({
      completed: true,
      metricValues: { weight: 185, reps: 7 },
    })
    expect(reloaded?.exercises[0]).toMatchObject({
      sessionTargetRepsMin: 5,
      sessionTargetRepsMax: 7,
    })
    expect(active.exercises[0]).toMatchObject({
      targetSetCount: 2,
      targetRepsMin: 8,
      targetRepsMax: 10,
    })
  })

  it('cancels active workouts without writing history', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const repository = createWorkoutRepository(database)
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })

    await repository.cancelWorkout(started.workout.id)

    await expect(database.workouts.toArray()).resolves.toEqual([])
    await expect(database.workoutExercises.toArray()).resolves.toEqual([])
    await expect(database.workoutSets.toArray()).resolves.toEqual([])
    await expect(database.workoutHistoryEntries.toArray()).resolves.toEqual([])
  })

  it('loads previous performance from the most recent completed workout for the same exercise', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const repository = createWorkoutRepository(database)
    const first = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await repository.updateWorkoutSet(first.sets[0].id, {
      metricValues: { weight: 135, reps: 8 },
      completed: true,
    })
    await repository.completeWorkout({
      workoutId: first.workout.id,
      completedAt: '2026-01-01T00:00:00.000Z',
    })

    const second = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    const previous = await repository.getPreviousPerformance(
      second.exercises[0].exerciseId!,
      new Date(
        Date.parse(second.workout.startedAt) + 60 * 60 * 1000,
      ).toISOString(),
    )

    expect(previous[0].metricValues).toEqual({ weight: 135, reps: 8 })
  })

  it('copies corresponding completed set values in the default history mode', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const repository = createWorkoutRepository(database)
    const first = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await repository.updateWorkoutSet(first.sets[0].id, {
      metricValues: { weight: 135, reps: 8 },
      completed: true,
    })
    await repository.updateWorkoutSet(first.sets[1].id, {
      metricValues: { weight: 145, reps: 6 },
      completed: true,
    })
    await repository.completeWorkout({
      workoutId: first.workout.id,
      completedAt: first.workout.startedAt,
    })

    const second = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })

    expect(second.sets.map((set) => set.metricValues)).toEqual([
      { weight: 135, reps: 8 },
      { weight: 145, reps: 6 },
    ])
  })

  it('prefills the same-day sequence and advances one repetition without flattening loads in smart mode', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const repository = createWorkoutRepository(database)
    await createSettingsRepository(database).saveWorkoutAutofillMode(
      'smart_progression',
    )
    const first = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await repository.updateWorkoutSet(first.sets[0].id, {
      metricValues: { weight: 135, reps: 8 },
      completed: true,
    })
    await repository.updateWorkoutSet(first.sets[1].id, {
      metricValues: { weight: 145, reps: 8 },
      completed: true,
    })
    await repository.addSet(first.exercises[0].id)
    const extra = (await repository.getActiveWorkoutStructure())!
      .setsByExercise[first.exercises[0].id][2]
    await repository.updateWorkoutSet(extra.id, {
      metricValues: { weight: 155, reps: 8 },
      completed: true,
    })
    await repository.completeWorkout({
      workoutId: first.workout.id,
      completedAt: first.workout.startedAt,
    })

    await database.activeCycleWorkoutExercises.update(active.exercises[0].id, {
      targetSetCount: 3,
    })
    const second = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })

    expect(second.sets.map((set) => set.metricValues.weight)).toEqual([
      135, 145, 155,
    ])
    expect(second.sets.map((set) => set.metricValues.reps)).toEqual([9, 8, 8])
    expect(second.sets.map((set) => set.metricValueSources?.weight)).toEqual([
      'auto',
      'auto',
      'auto',
    ])
    expect(
      second.sets.map((set) => set.targetRecommendation?.sourceSetId),
    ).toEqual([first.sets[0].id, first.sets[1].id, extra.id])
  })

  it('matches legacy built-in history by exact exercise snapshot name', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    await database.activeCycleWorkoutExercises.update(active.exercises[0].id, {
      exerciseId: 'builtin:bench-press',
    })
    const repository = createWorkoutRepository(database)
    const first = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await repository.updateWorkoutSet(first.sets[0].id, {
      metricValues: { weight: 95, reps: 8 },
      completed: true,
    })
    await repository.completeWorkout({
      workoutId: first.workout.id,
      completedAt: '2026-01-01T00:00:00.000Z',
    })
    await database.workoutHistoryExercises.update(first.exercises[0].id, {
      exerciseId: null,
    })

    const second = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })

    // Legacy snapshot-name matching still finds the prior performance and
    // pre-logs its weight.
    expect(second.sets[0].metricValues.weight).toBe(95)
  })

  it('estimates a cross-day rep scheme from the full prior fatigue sequence', async () => {
    const program = await seedProgram(database)
    const programRepository = createProgramRepository(database)
    const active = await programRepository.activateTemplate(program.template.id)
    const repository = createWorkoutRepository(database)
    await createSettingsRepository(database).saveWorkoutAutofillMode(
      'smart_progression',
    )
    const exerciseId = active.exercises[0].exerciseId

    const first = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await repository.updateWorkoutSet(first.sets[0].id, {
      metricValues: { weight: 200, reps: 10 },
      completed: true,
    })
    await repository.completeWorkout({
      workoutId: first.workout.id,
      completedAt: '2026-01-01T00:00:00.000Z',
    })

    const nextProgram = await programRepository.createProgramTemplate({
      name: 'Different program',
      days: [
        {
          name: 'Different day',
          exercises: [
            {
              exerciseId,
              targetSetCount: 3,
              targetRepsMin: 5,
              targetRepsMax: 5,
            },
          ],
        },
      ],
    })
    const nextActive = await programRepository.activateTemplate(
      nextProgram.template.id,
    )
    const second = await repository.startWorkout({
      activeCycleId: nextActive.cycle.id,
      dayId: nextActive.days[0].id,
      localDate: testLocalDate,
    })

    expect(second.sets.map((set) => set.metricValues)).toEqual([
      { weight: 215, reps: 5 },
      { weight: 215, reps: 5 },
      { weight: 215, reps: 5 },
    ])
    expect(
      second.sets.map((set) => set.targetRecommendation?.sourceSetId),
    ).toEqual([first.sets[0].id, first.sets[0].id, first.sets[0].id])
  })

  it('records applied structural changes separately from workout completion', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const repository = createWorkoutRepository(database)
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await repository.updateWorkoutSet(started.sets[0].id, { completed: true })
    const completed = await repository.completeWorkout({
      workoutId: started.workout.id,
      completedAt: new Date(
        Date.parse(started.workout.startedAt) + 30 * 60 * 1000,
      ).toISOString(),
      detectedChanges: [
        {
          type: 'exercise_order_changed',
          description: 'Moved exercise',
          sourcePath: `cycle:${active.cycle.id};day:${active.days[0].id};template:${program.template.id}`,
          performedPath: 'workout',
        },
      ],
    })

    const applied = await repository.applyDetectedChange(
      completed.detectedChanges[0].id,
      'cycle_only',
    )

    expect(applied.destination).toBe('cycle_only')
    await expect(
      database.appliedWorkoutChanges.toArray(),
    ).resolves.toHaveLength(1)
    await expect(
      database.detectedWorkoutChanges.toArray(),
    ).resolves.toMatchObject([
      {
        status: 'applied',
        appliedDestination: 'cycle_only',
      },
    ])
  })

  it('detects no structural changes for an unchanged completed workout', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const repository = createWorkoutRepository(database)
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await repository.updateWorkoutSet(started.sets[0].id, {
      metricValues: { weight: 185, reps: 8 },
      rir: 1,
      completed: true,
    })

    const completed = await repository.completeWorkout({
      workoutId: started.workout.id,
    })

    expect(completed.detectedChanges).toEqual([])
    await expect(
      database.workoutHistoryEntries.toArray(),
    ).resolves.toHaveLength(1)
  })

  it('saves history and leaves detected changes pending without applying them', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const repository = createWorkoutRepository(database)
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await repository.updateWorkoutSet(started.sets[0].id, { completed: true })
    await repository.addSet(started.exercises[0].id)

    const completed = await repository.completeWorkout({
      workoutId: started.workout.id,
    })
    const reloadedChanges = await repository.listDetectedChanges(
      completed.history.id,
    )

    expect(completed.detectedChanges).toMatchObject([{ type: 'set_added' }])
    expect(reloadedChanges).toMatchObject([
      { type: 'set_added', status: 'pending', selectedDestination: 'neither' },
    ])
    await expect(database.workouts.toArray()).resolves.toEqual([])
    await expect(
      database.workoutHistoryEntries.toArray(),
    ).resolves.toHaveLength(1)
  })

  it('applies a selected change to the active cycle only', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const repository = createWorkoutRepository(database)
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await repository.updateWorkoutSet(started.sets[0].id, { completed: true })
    await repository.addSet(started.exercises[0].id)
    const completed = await repository.completeWorkout({
      workoutId: started.workout.id,
    })

    await repository.applyDetectedChange(
      completed.detectedChanges[0].id,
      'cycle_only',
    )

    await expect(
      database.activeCycleWorkoutExercises.get(active.exercises[0].id),
    ).resolves.toMatchObject({ targetSetCount: 3 })
    await expect(
      database.templateWorkoutExercises.get(program.exercises[0].id),
    ).resolves.toMatchObject({ targetSetCount: 2 })
  })

  it('applies a selected change to the reusable template only', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const repository = createWorkoutRepository(database)
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await repository.updateWorkoutSet(started.sets[0].id, { completed: true })
    await repository.addSet(started.exercises[0].id)
    const completed = await repository.completeWorkout({
      workoutId: started.workout.id,
    })

    await repository.applyDetectedChange(
      completed.detectedChanges[0].id,
      'template_only',
    )

    await expect(
      database.activeCycleWorkoutExercises.get(active.exercises[0].id),
    ).resolves.toMatchObject({ targetSetCount: 2 })
    await expect(
      database.templateWorkoutExercises.get(program.exercises[0].id),
    ).resolves.toMatchObject({ targetSetCount: 3 })
  })

  it('refuses to resume a completed workout after applied template changes would lose provenance', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const repository = createWorkoutRepository(database)
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await repository.updateWorkoutSet(started.sets[0].id, { completed: true })
    await repository.addSet(started.exercises[0].id)
    const completed = await repository.completeWorkout({
      workoutId: started.workout.id,
    })
    await repository.applyDetectedChange(
      completed.detectedChanges[0].id,
      'template_only',
    )

    await expect(
      repository.resumeCompletedWorkout(completed.history.id),
    ).rejects.toThrow('Applied workout changes must stay in history.')

    await expect(
      database.templateWorkoutExercises.get(program.exercises[0].id),
    ).resolves.toMatchObject({ targetSetCount: 3 })
    await expect(database.workouts.toArray()).resolves.toEqual([])
    await expect(
      database.workoutHistoryEntries.get(completed.history.id),
    ).resolves.toBeDefined()
    await expect(
      database.appliedWorkoutChanges.toArray(),
    ).resolves.toHaveLength(1)
    await expect(
      database.detectedWorkoutChanges.toArray(),
    ).resolves.toHaveLength(1)
  })

  it('applies selected replacement changes to both destinations', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const replacement = await createExerciseRepository(database).createExercise(
      {
        name: 'Chest-supported row',
        defaultRestSeconds: 75,
        trackingMethodId: 'weight_reps',
      },
    )
    const repository = createWorkoutRepository(database)
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await repository.replaceExercise({
      workoutExerciseId: started.exercises[0].id,
      exerciseId: replacement.id,
      keepCompatibleSetValues: true,
    })
    await repository.updateWorkoutSet(started.sets[0].id, { completed: true })
    const completed = await repository.completeWorkout({
      workoutId: started.workout.id,
    })

    await repository.applyDetectedChange(
      completed.detectedChanges[0].id,
      'both',
    )

    await expect(
      database.activeCycleWorkoutExercises.get(active.exercises[0].id),
    ).resolves.toMatchObject({ exerciseId: replacement.id })
    await expect(
      database.templateWorkoutExercises.get(program.exercises[0].id),
    ).resolves.toMatchObject({ exerciseId: replacement.id })
  })

  it('adds next-workout progression recommendations to detected-change review and applies both destinations once', async () => {
    const programRepository = createProgramRepository(database)
    const program = await seedProgram(database)
    const active = await programRepository.activateTemplate(program.template.id)
    await database.activeCycleWorkoutExercises.update(active.exercises[0].id, {
      targetWeight: 185,
    })
    await database.templateWorkoutExercises.update(program.exercises[0].id, {
      targetWeight: 185,
    })
    const repository = createWorkoutRepository(database)

    const first = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await repository.updateWorkoutSet(first.sets[0].id, {
      metricValues: { weight: 185, reps: 10 },
      completed: true,
    })
    await repository.updateWorkoutSet(first.sets[1].id, {
      metricValues: { weight: 185, reps: 10 },
      rir: 2,
      completed: true,
    })
    await repository.completeWorkout({
      workoutId: first.workout.id,
      completedAt: new Date(
        Date.parse(first.workout.startedAt) + 30 * 60 * 1000,
      ).toISOString(),
    })

    const second = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await repository.updateWorkoutSet(second.sets[0].id, {
      metricValues: { weight: 185, reps: 10 },
      completed: true,
    })
    await repository.updateWorkoutSet(second.sets[1].id, {
      metricValues: { weight: 185, reps: 11 },
      rir: 3,
      completed: true,
    })
    const completed = await repository.completeWorkout({
      workoutId: second.workout.id,
      completedAt: new Date(
        Date.parse(second.workout.startedAt) + 30 * 60 * 1000,
      ).toISOString(),
    })

    expect(completed.detectedChanges).toMatchObject([
      {
        type: 'progression_recommendation',
        recommendationReason: 'repeated_top_range_increase',
        status: 'pending',
        selectedDestination: 'neither',
      },
    ])
    await repository.applyDetectedChange(
      completed.detectedChanges[0].id,
      'both',
    )
    await repository.applyDetectedChange(
      completed.detectedChanges[0].id,
      'both',
    )

    await expect(
      database.activeCycleWorkoutExercises.get(active.exercises[0].id),
    ).resolves.toMatchObject({ targetWeight: 190 })
    await expect(
      database.templateWorkoutExercises.get(program.exercises[0].id),
    ).resolves.toMatchObject({ targetWeight: 190 })
  })

  it('novice level recommends a load increase after one top-range session and tunes exercise state', async () => {
    const programRepository = createProgramRepository(database)
    const program = await seedProgram(database)
    const active = await programRepository.activateTemplate(program.template.id)
    await database.activeCycleWorkoutExercises.update(active.exercises[0].id, {
      targetWeight: 185,
    })
    await createSettingsRepository(
      database,
    ).saveSmartProgressionExperienceLevel('novice')
    const repository = createWorkoutRepository(database)

    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await repository.updateWorkoutSet(started.sets[0].id, {
      metricValues: { weight: 185, reps: 10 },
      completed: true,
    })
    await repository.updateWorkoutSet(started.sets[1].id, {
      metricValues: { weight: 185, reps: 10 },
      rir: 3,
      completed: true,
    })
    const completed = await repository.completeWorkout({
      workoutId: started.workout.id,
    })

    // A single qualifying session is enough at the novice cadence.
    expect(completed.detectedChanges).toMatchObject([
      {
        type: 'progression_recommendation',
        recommendationReason: 'repeated_top_range_increase',
      },
    ])

    // Novice is the fastest end of the spectrum; a clean increase keeps it
    // pinned there (score 0) but still writes the per-exercise state.
    const state = await database.exerciseProgressionStates.get(
      active.exercises[0].exerciseId,
    )
    expect(state).toMatchObject({ score: 0 })
  })

  it('intermediate default holds after one top-range session for the same setup', async () => {
    const programRepository = createProgramRepository(database)
    const program = await seedProgram(database)
    const active = await programRepository.activateTemplate(program.template.id)
    await database.activeCycleWorkoutExercises.update(active.exercises[0].id, {
      targetWeight: 185,
    })
    // No baseline chosen: keeps the existing two-session behavior and writes no
    // per-exercise progression state.
    const repository = createWorkoutRepository(database)

    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await repository.updateWorkoutSet(started.sets[0].id, {
      metricValues: { weight: 185, reps: 10 },
      completed: true,
    })
    await repository.updateWorkoutSet(started.sets[1].id, {
      metricValues: { weight: 185, reps: 10 },
      rir: 3,
      completed: true,
    })
    const completed = await repository.completeWorkout({
      workoutId: started.workout.id,
    })

    expect(completed.detectedChanges).toEqual([])
    await expect(database.exerciseProgressionStates.toArray()).resolves.toEqual(
      [],
    )
  })

  it('records neither as an explicit rejected review result', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const repository = createWorkoutRepository(database)
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await repository.updateWorkoutSet(started.sets[0].id, { completed: true })
    await repository.addSet(started.exercises[0].id)
    const completed = await repository.completeWorkout({
      workoutId: started.workout.id,
    })

    await repository.applyDetectedChange(
      completed.detectedChanges[0].id,
      'neither',
    )

    await expect(
      database.detectedWorkoutChanges.get(completed.detectedChanges[0].id),
    ).resolves.toMatchObject({
      status: 'rejected',
      selectedDestination: 'neither',
      appliedDestination: 'neither',
    })
    await expect(
      database.activeCycleWorkoutExercises.get(active.exercises[0].id),
    ).resolves.toMatchObject({ targetSetCount: 2 })
  })

  it('keeps history with review results after reloading', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const repository = createWorkoutRepository(database)
    const started = await repository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await repository.updateWorkoutSet(started.sets[0].id, { completed: true })
    await repository.addSet(started.exercises[0].id)
    const completed = await repository.completeWorkout({
      workoutId: started.workout.id,
    })
    await repository.applyDetectedChange(
      completed.detectedChanges[0].id,
      'cycle_only',
    )

    const reloadedRepository = createWorkoutRepository(database)
    const [history, changes] = await Promise.all([
      reloadedRepository.getWorkoutHistoryStructure(completed.history.id),
      reloadedRepository.listDetectedChanges(completed.history.id),
    ])

    expect(history.workout.id).toBe(completed.history.id)
    expect(changes).toMatchObject([
      {
        status: 'applied',
        selectedDestination: 'cycle_only',
        appliedDestination: 'cycle_only',
      },
    ])
  })

  it('keeps workout and history source labels after source records are renamed or deleted', async () => {
    const programRepository = createProgramRepository(database)
    const program = await seedProgram(database)
    const active = await programRepository.activateTemplate(program.template.id)
    const workoutRepository = createWorkoutRepository(database)
    const started = await workoutRepository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await workoutRepository.updateWorkoutSet(started.sets[0].id, {
      completed: true,
    })

    await programRepository.updateProgramTemplate(program.template.id, {
      name: 'Renamed template',
    })
    await database.activeProgramCycles.update(active.cycle.id, {
      name: 'Renamed cycle',
      status: 'inactive',
    })
    await programRepository.deleteProgramTemplate(program.template.id)

    const completed = await workoutRepository.completeWorkout({
      workoutId: started.workout.id,
      completedAt: new Date(
        Date.parse(started.workout.startedAt) + 30 * 60 * 1000,
      ).toISOString(),
    })

    expect(started.workout.workoutSnapshot).toMatchObject({
      activeCycleName: 'Upper Lower',
      templateName: 'Upper Lower',
      dayName: 'Upper',
    })
    expect(completed.history.workoutSnapshot).toMatchObject({
      activeCycleName: 'Upper Lower',
      templateName: 'Upper Lower',
      dayName: 'Upper',
    })
  })

  it('stores completed exercise snapshots independently of later exercise edits', async () => {
    const program = await seedProgram(database)
    const exercise = await database.exercises.toCollection().first()
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const workoutRepository = createWorkoutRepository(database)
    const started = await workoutRepository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await workoutRepository.updateWorkoutSet(started.sets[0].id, {
      completed: true,
    })

    const completed = await workoutRepository.completeWorkout({
      workoutId: started.workout.id,
      completedAt: new Date(
        Date.parse(started.workout.startedAt) + 30 * 60 * 1000,
      ).toISOString(),
    })
    if (!exercise) {
      throw new Error('Seed exercise was not created.')
    }

    await createExerciseRepository(database).updateExercise(exercise.id, {
      name: 'Renamed bench',
      trackingMethodId: 'reps_only',
    })

    const history = await workoutRepository.getWorkoutHistoryStructure(
      completed.history.id,
    )

    expect(history.exercises[0].exerciseSnapshot).toMatchObject({
      exerciseName: 'Bench press',
      trackingMethodId: 'weight_reps',
    })
    expect(history.exercises[0].exerciseSnapshot.trackingMetrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'weight' }),
        expect.objectContaining({ key: 'reps' }),
      ]),
    )
  })

  it('rolls back workout start when the transaction fails after creating the workout', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const repository = createWorkoutRepository(database, {
      afterWorkoutAdded: () => {
        throw new Error('forced workout start failure')
      },
    })

    await expect(
      repository.startWorkout({
        activeCycleId: active.cycle.id,
        dayId: active.days[0].id,
        localDate: testLocalDate,
      }),
    ).rejects.toThrow('forced workout start failure')

    await expect(database.workouts.toArray()).resolves.toEqual([])
    await expect(database.workoutExercises.toArray()).resolves.toEqual([])
  })

  it('rolls back workout completion when the transaction fails after writing history', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const setupRepository = createWorkoutRepository(database)
    const started = await setupRepository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await setupRepository.updateWorkoutSet(started.sets[0].id, {
      completed: true,
    })
    const repository = createWorkoutRepository(database, {
      afterHistoryAdded: () => {
        throw new Error('forced completion failure')
      },
    })

    await expect(
      repository.completeWorkout({
        workoutId: started.workout.id,
        completedAt: new Date(
          Date.parse(started.workout.startedAt) + 30 * 60 * 1000,
        ).toISOString(),
      }),
    ).rejects.toThrow('forced completion failure')

    await expect(database.workoutHistoryEntries.toArray()).resolves.toEqual([])
    await expect(database.workouts.toArray()).resolves.toHaveLength(1)
  })

  it('rolls back structural change application when destination application fails', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const setupRepository = createWorkoutRepository(database)
    const started = await setupRepository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await setupRepository.updateWorkoutSet(started.sets[0].id, {
      completed: true,
    })
    const completed = await setupRepository.completeWorkout({
      workoutId: started.workout.id,
      completedAt: new Date(
        Date.parse(started.workout.startedAt) + 30 * 60 * 1000,
      ).toISOString(),
      detectedChanges: [
        {
          type: 'set_added',
          description: 'Added set',
          sourcePath: 'cycle',
          performedPath: 'workout',
        },
      ],
    })
    const repository = createWorkoutRepository(
      database,
      {},
      {
        applyToActiveCycle: async () => {
          await database.activeProgramCycles.update(active.cycle.id, {
            notes: 'partial update',
          })
          throw new Error('forced structural failure')
        },
      },
    )

    await expect(
      repository.applyDetectedChange(
        completed.detectedChanges[0].id,
        'cycle_only',
      ),
    ).rejects.toThrow('forced structural failure')

    await expect(database.appliedWorkoutChanges.toArray()).resolves.toEqual([])
    await expect(
      database.detectedWorkoutChanges.get(completed.detectedChanges[0].id),
    ).resolves.toMatchObject({
      status: 'failed',
      selectedDestination: 'cycle_only',
      failureReason: 'forced structural failure',
    })
    await expect(
      database.activeProgramCycles.get(active.cycle.id),
    ).resolves.toMatchObject({ notes: '' })
  })

  it('rolls back both cycle and template structural destinations together', async () => {
    const program = await seedProgram(database)
    const active = await createProgramRepository(database).activateTemplate(
      program.template.id,
    )
    const setupRepository = createWorkoutRepository(database)
    const started = await setupRepository.startWorkout({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      localDate: testLocalDate,
    })
    await setupRepository.updateWorkoutSet(started.sets[0].id, {
      completed: true,
    })
    const completed = await setupRepository.completeWorkout({
      workoutId: started.workout.id,
      completedAt: new Date(
        Date.parse(started.workout.startedAt) + 30 * 60 * 1000,
      ).toISOString(),
      detectedChanges: [
        {
          type: 'exercise_order_changed',
          description: 'Moved exercise',
          sourcePath: 'cycle',
          performedPath: 'workout',
        },
      ],
    })
    const repository = createWorkoutRepository(
      database,
      {},
      {
        applyToActiveCycle: async () => {
          await database.activeProgramCycles.update(active.cycle.id, {
            notes: 'cycle partial update',
          })
        },
        applyToTemplate: async () => {
          await database.programTemplates.update(program.template.id, {
            notes: 'template partial update',
          })
          throw new Error('forced both-destination failure')
        },
      },
    )

    await expect(
      repository.applyDetectedChange(completed.detectedChanges[0].id, 'both'),
    ).rejects.toThrow('forced both-destination failure')

    await expect(database.appliedWorkoutChanges.toArray()).resolves.toEqual([])
    await expect(
      database.detectedWorkoutChanges.get(completed.detectedChanges[0].id),
    ).resolves.toMatchObject({
      status: 'failed',
      selectedDestination: 'both',
      failureReason: 'forced both-destination failure',
    })
    await expect(
      database.activeProgramCycles.get(active.cycle.id),
    ).resolves.toMatchObject({ notes: '' })
    await expect(
      database.programTemplates.get(program.template.id),
    ).resolves.toMatchObject({ notes: '' })
  })
})
