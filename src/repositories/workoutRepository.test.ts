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
    const completed = await repository.completeWorkout({
      workoutId: started.workout.id,
      completedAt: new Date(
        Date.parse(started.workout.startedAt) + 30 * 60 * 1000,
      ).toISOString(),
      detectedChanges: [
        {
          type: 'exercise_order_changed',
          description: 'Moved exercise',
          sourcePath: 'cycle.days[0]',
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
    ).resolves.toMatchObject({ status: 'pending' })
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
      database.activeProgramCycles.get(active.cycle.id),
    ).resolves.toMatchObject({ notes: '' })
    await expect(
      database.programTemplates.get(program.template.id),
    ).resolves.toMatchObject({ notes: '' })
  })
})
