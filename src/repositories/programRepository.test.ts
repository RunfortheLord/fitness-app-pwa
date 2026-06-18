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
    expect(active.cycle.id).not.toBe(program.template.id)
    expect(active.days[0].id).not.toBe(program.days[0].id)
    expect(active.exercises[0].id).not.toBe(sourceExercise.id)
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

  it('rolls back template creation when the transaction fails after writing', async () => {
    const repository = createProgramRepository(database, {
      afterTemplateAdded: () => {
        throw new Error('forced template failure')
      },
    })

    await expect(
      repository.createProgramTemplate({
        name: 'Invalid',
        days: [],
      }),
    ).rejects.toThrow('forced template failure')

    await expect(database.programTemplates.toArray()).resolves.toEqual([])
  })

  it('rolls back activation when the transaction fails after creating the cycle', async () => {
    const program = await seedProgram(database)
    const repository = createProgramRepository(database, {
      afterActiveCycleAdded: () => {
        throw new Error('forced activation failure')
      },
    })

    await expect(
      repository.activateTemplate(program.template.id),
    ).rejects.toThrow('forced activation failure')

    await expect(database.activeProgramCycles.toArray()).resolves.toEqual([])
    await expect(database.activeCycleWorkoutDays.toArray()).resolves.toEqual([])
  })

  it('returns ordered template and active-cycle children deterministically', async () => {
    const program = await seedProgram(database)
    await database.templateWorkoutDays.bulkAdd([
      {
        id: 'later-day',
        templateId: program.template.id,
        name: 'Later',
        notes: '',
        orderIndex: 2,
        createdAt: '2026-06-18T12:00:00.000Z',
        updatedAt: '2026-06-18T12:00:00.000Z',
      },
      {
        id: 'middle-day',
        templateId: program.template.id,
        name: 'Middle',
        notes: '',
        orderIndex: 1,
        createdAt: '2026-06-18T12:00:00.000Z',
        updatedAt: '2026-06-18T12:00:00.000Z',
      },
    ])

    const repository = createProgramRepository(database)
    const templateStructure = await repository.getTemplateStructure(
      program.template.id,
    )
    const active = await repository.activateTemplate(program.template.id)
    const activeStructure = await repository.getActiveCycleStructure(
      active.cycle.id,
    )

    expect(templateStructure.days.map((day) => day.name)).toEqual([
      'Upper',
      'Middle',
      'Later',
    ])
    expect(activeStructure.days.map((day) => day.name)).toEqual([
      'Upper',
      'Middle',
      'Later',
    ])
  })

  it('archives program templates instead of deleting them', async () => {
    const program = await seedProgram(database)
    const repository = createProgramRepository(database)

    await repository.archiveProgramTemplate(program.template.id)

    await expect(
      repository.getTemplate(program.template.id),
    ).resolves.toMatchObject({
      id: program.template.id,
      status: 'archived',
    })
  })
})
