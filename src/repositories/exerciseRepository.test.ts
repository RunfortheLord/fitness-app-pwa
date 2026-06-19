import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { TrainingLogDatabase } from '@db/database'
import { TRACKING_METHODS } from '@domain/trackingMethods'
import { createExerciseRepository } from '@repositories/exerciseRepository'
import { createProgramRepository } from '@repositories/programRepository'
import { createWorkoutRepository } from '@repositories/workoutRepository'
import { createTestDatabase, destroyTestDatabase } from '@test/database'
import { seedExercise, seedProgram, testLocalDate } from '@test/seedFactories'

let database: TrainingLogDatabase

beforeEach(() => {
  database = createTestDatabase()
})

afterEach(async () => {
  await destroyTestDatabase(database)
})

describe('exerciseRepository', () => {
  it('creates every configured tracking preset with its supported metrics', async () => {
    const repository = createExerciseRepository(database)

    for (const method of TRACKING_METHODS) {
      const exercise = await repository.createExercise({
        name: method.name,
        defaultRestSeconds: 90,
        trackingMethodId: method.id,
      })

      expect(exercise).toMatchObject({
        name: method.name,
        trackingMethodId: method.id,
        trackingMetrics: method.metrics,
        status: 'active',
      })
    }

    await expect(database.exercises.toArray()).resolves.toHaveLength(
      TRACKING_METHODS.length,
    )
  })

  it('validates required names, rest time, and tracking presets', async () => {
    const repository = createExerciseRepository(database)

    await expect(
      repository.createExercise({
        name: '   ',
        defaultRestSeconds: 90,
        trackingMethodId: 'weight_reps',
      }),
    ).rejects.toThrow('Exercise name is required.')

    await expect(
      repository.createExercise({
        name: 'Pull-up',
        defaultRestSeconds: 30.5,
        trackingMethodId: 'bodyweight_reps',
      }),
    ).rejects.toThrow('Default rest time must be a whole number of seconds.')

    await expect(
      repository.createExercise({
        name: 'Run',
        defaultRestSeconds: 60,
        trackingMethodId: 'missing' as 'weight_reps',
      }),
    ).rejects.toThrow('Tracking method missing was not found.')
  })

  it('persists, searches, archives, and restores exercises', async () => {
    const repository = createExerciseRepository(database)
    const bench = await repository.createExercise({
      name: 'Bench press',
      defaultRestSeconds: 120,
      trackingMethodId: 'weight_reps',
    })
    await repository.createExercise({
      name: 'Pull-up',
      defaultRestSeconds: 90,
      trackingMethodId: 'bodyweight_reps',
    })

    await expect(
      repository.searchExercises({ query: 'bench' }),
    ).resolves.toEqual([expect.objectContaining({ id: bench.id })])

    await repository.archiveExercise(bench.id)
    await expect(
      repository.searchExercises({ query: 'bench' }),
    ).resolves.toEqual([])
    await expect(
      repository.searchExercises({ includeArchived: true, query: 'bench' }),
    ).resolves.toEqual([expect.objectContaining({ status: 'archived' })])

    await repository.restoreExercise(bench.id)
    await expect(repository.getExercise(bench.id)).resolves.toMatchObject({
      status: 'active',
    })
  })

  it('archives referenced exercises instead of permanently deleting them', async () => {
    const repository = createExerciseRepository(database)
    const program = await seedProgram(database)
    const exercise = await database.exercises.get(
      program.exercises[0].exerciseId,
    )

    if (!exercise) {
      throw new Error('Seed exercise was not created.')
    }

    await expect(repository.deleteExercise(exercise.id)).resolves.toBe(
      'archived',
    )
    await expect(repository.getExercise(exercise.id)).resolves.toMatchObject({
      id: exercise.id,
      status: 'archived',
    })
  })

  it('deletes unreferenced exercises only when there are no stored references', async () => {
    const repository = createExerciseRepository(database)
    const exercise = await seedExercise(database)

    await expect(repository.deleteExercise(exercise.id)).resolves.toBe(
      'deleted',
    )
    await expect(repository.getExercise(exercise.id)).resolves.toBeUndefined()
  })

  it('keeps completed workout history snapshots after exercise edits', async () => {
    const program = await seedProgram(database)
    const exercise = await database.exercises.get(
      program.exercises[0].exerciseId,
    )
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
      TRACKING_METHODS.find((method) => method.id === 'weight_reps')?.metrics,
    )
  })
})
