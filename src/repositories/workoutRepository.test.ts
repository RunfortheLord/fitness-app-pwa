import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { TrainingLogDatabase } from '@db/database'
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
})
