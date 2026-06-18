import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { TrainingLogDatabase } from '@db/database'
import { createExerciseRepository } from '@repositories/exerciseRepository'
import { createProgramRepository } from '@repositories/programRepository'
import { createTestDatabase, destroyTestDatabase } from '@test/database'
import { seedProgram } from '@test/seedFactories'

let database: TrainingLogDatabase

beforeEach(() => {
  database = createTestDatabase()
})

afterEach(async () => {
  await destroyTestDatabase(database)
})

describe('programRepository', () => {
  it('activates a template as an independent active-cycle copy', async () => {
    const programRepository = createProgramRepository(database)
    const exerciseRepository = createExerciseRepository(database)
    const program = await seedProgram(database)
    const sourceExercise = program.exercises[0]

    const active = await programRepository.activateTemplate(program.template.id)
    await exerciseRepository.updateExercise(sourceExercise.exerciseId, {
      name: 'Renamed bench press',
    })

    const activeExercise = await database.activeCycleWorkoutExercises.get(
      active.exercises[0].id,
    )

    expect(active.cycle.sourceTemplateId).toBe(program.template.id)
    expect(activeExercise?.exerciseSnapshot.exerciseName).toBe('Bench press')
    expect(activeExercise?.sourceTemplateExerciseId).toBe(sourceExercise.id)
  })

  it('rolls back template creation when a prescribed exercise is invalid', async () => {
    const repository = createProgramRepository(database)

    await expect(
      repository.createProgramTemplate({
        name: 'Invalid',
        days: [
          {
            name: 'Day 1',
            exercises: [{ exerciseId: 'missing', targetSetCount: 1 }],
          },
        ],
      }),
    ).rejects.toThrow('Exercise missing was not found.')

    await expect(database.programTemplates.toArray()).resolves.toEqual([])
    await expect(database.templateWorkoutDays.toArray()).resolves.toEqual([])
  })
})
