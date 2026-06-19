import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { TrainingLogDatabase } from '@db/database'
import { createExerciseRepository } from '@repositories/exerciseRepository'
import { createProgramRepository } from '@repositories/programRepository'
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

    await repository.dismissRestTimer(started.workout.id)
    reloaded = await repository.getActiveWorkoutStructure()
    expect(reloaded?.workout.activeRestTimer).toMatchObject({
      status: 'dismissed',
    })
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
      completedAt: new Date(
        Date.parse(first.workout.startedAt) + 20 * 60 * 1000,
      ).toISOString(),
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

  it('keeps workout and history source labels after source records are renamed or archived', async () => {
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
    await programRepository.archiveProgramTemplate(program.template.id)
    await database.activeProgramCycles.update(active.cycle.id, {
      name: 'Renamed cycle',
      status: 'archived',
    })

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
