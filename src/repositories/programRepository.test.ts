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

  it('marks only the latest activated cycle current', async () => {
    const first = await seedProgram(database)
    const second = await seedProgram(database)
    const repository = createProgramRepository(database)

    const firstActive = await repository.activateTemplate(first.template.id)
    const secondActive = await repository.activateTemplate(second.template.id)

    await expect(
      database.activeProgramCycles.get(firstActive.cycle.id),
    ).resolves.toMatchObject({ status: 'inactive' })
    await expect(
      database.activeProgramCycles.get(secondActive.cycle.id),
    ).resolves.toMatchObject({ status: 'active' })
    await expect(
      repository.getCurrentActiveCycleStructure(),
    ).resolves.toMatchObject({
      cycle: { id: secondActive.cycle.id },
    })
  })

  it('adds, renames, reorders, duplicates, and removes template days', async () => {
    const program = await seedProgram(database)
    const repository = createProgramRepository(database)

    const lower = await repository.addTemplateDay(program.template.id, {
      name: 'Lower',
    })
    await repository.updateTemplateDay(lower.id, { name: 'Legs' })
    await repository.reorderTemplateDays(program.template.id, [
      lower.id,
      program.days[0].id,
    ])
    const copy = await repository.duplicateTemplateDay(lower.id)
    await repository.removeTemplateDay(program.days[0].id)

    const structure = await repository.getTemplateStructure(program.template.id)

    expect(structure.days.map((day) => day.name)).toEqual(['Legs', 'Legs copy'])
    expect(structure.days.map((day) => day.orderIndex)).toEqual([0, 1])
    expect(copy.id).not.toBe(lower.id)
  })

  it('adds, reorders, replaces, and removes prescribed exercises', async () => {
    const program = await seedProgram(database)
    const repository = createProgramRepository(database)
    const exerciseRepository = createExerciseRepository(database)
    const row = await exerciseRepository.createExercise({
      name: 'Row',
      defaultRestSeconds: 90,
      trackingMethodId: 'weight_reps',
      notes: '',
    })
    const pulldown = await exerciseRepository.createExercise({
      name: 'Pulldown',
      defaultRestSeconds: 90,
      trackingMethodId: 'weight_reps',
      notes: '',
    })

    const added = await repository.addTemplateExercise(program.days[0].id, {
      exerciseId: row.id,
      targetSetCount: 3,
      targetRepsMin: 10,
    })
    await repository.reorderTemplateExercises(program.days[0].id, [
      added.id,
      program.exercises[0].id,
    ])
    await repository.updateTemplateExercise(added.id, {
      exerciseId: pulldown.id,
      targetRepsMin: null,
      targetRepsMax: 12,
    })
    await repository.removeTemplateExercise(program.exercises[0].id)

    const structure = await repository.getTemplateStructure(program.template.id)
    const exercises = structure.exercisesByDay[program.days[0].id]

    expect(exercises).toHaveLength(1)
    expect(exercises[0]).toMatchObject({
      exerciseId: pulldown.id,
      orderIndex: 0,
      targetRepsMin: null,
      targetRepsMax: 12,
    })
  })

  it('keeps template and active-cycle edits independent after activation', async () => {
    const program = await seedProgram(database)
    const repository = createProgramRepository(database)
    const active = await repository.activateTemplate(program.template.id)

    await repository.updateProgramTemplate(program.template.id, {
      name: 'Template edited',
    })
    await repository.updateActiveCycle(active.cycle.id, {
      name: 'Cycle edited',
    })
    await repository.updateActiveCycleDay(active.days[0].id, {
      name: 'Cycle day',
    })
    await repository.updateTemplateDay(program.days[0].id, {
      name: 'Template day',
    })

    await expect(
      repository.getTemplateStructure(program.template.id),
    ).resolves.toMatchObject({
      template: { name: 'Template edited' },
      days: [{ name: 'Template day' }],
    })
    await expect(
      repository.getActiveCycleStructure(active.cycle.id),
    ).resolves.toMatchObject({
      cycle: { name: 'Cycle edited' },
      days: [{ name: 'Cycle day' }],
    })
  })

  it('clones a program template as a separate reusable template', async () => {
    const program = await seedProgram(database)
    const repository = createProgramRepository(database)

    const clone = await repository.cloneProgramTemplate(program.template.id)
    await repository.updateTemplateDay(program.days[0].id, { name: 'Changed' })

    const cloneStructure = await repository.getTemplateStructure(
      clone.template.id,
    )

    expect(clone.template.id).not.toBe(program.template.id)
    expect(cloneStructure.template.name).toBe('Upper Lower copy')
    expect(cloneStructure.days[0]).toMatchObject({ name: 'Upper' })
    expect(
      cloneStructure.exercisesByDay[cloneStructure.days[0].id],
    ).toHaveLength(1)
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
