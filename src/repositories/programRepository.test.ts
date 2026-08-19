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
    await database.templateWorkoutExercises.update(sourceExercise.id, {
      notes: 'Pause the first rep.',
    })

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
    expect(activeExercise?.notes).toBe('Pause the first rep.')
  })

  it('defaults program length to 10 weeks, accepts a custom length, and snapshots it on activation', async () => {
    const repository = createProgramRepository(database)

    const defaulted = await repository.createProgramTemplate({
      name: 'Default length',
      days: [],
    })
    expect(defaulted.template.durationWeeks).toBe(10)
    expect(defaulted.template).toMatchObject({
      deloadSchedulingEnabled: false,
      deloadWeekNumbers: [1],
    })

    const custom = await repository.createProgramTemplate({
      name: 'Six weeks',
      durationWeeks: 6,
      days: [],
    })
    expect(custom.template.durationWeeks).toBe(6)

    // Out-of-range values are clamped.
    const updated = await repository.updateProgramTemplate(custom.template.id, {
      durationWeeks: 999,
    })
    expect(updated.durationWeeks).toBe(104)

    const active = await repository.activateTemplate(custom.template.id)
    expect(active.cycle.durationWeeks).toBe(104)
    expect(active.cycle).toMatchObject({
      deloadSchedulingEnabled: false,
      deloadWeekNumbers: [1],
    })
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
      database.programTemplates.get(first.template.id),
    ).resolves.toMatchObject({ lastActiveAt: firstActive.cycle.activatedAt })
    await expect(
      database.programTemplates.get(second.template.id),
    ).resolves.toMatchObject({ lastActiveAt: secondActive.cycle.activatedAt })
    await expect(
      repository.getCurrentActiveCycleStructure(),
    ).resolves.toMatchObject({
      cycle: { id: secondActive.cycle.id },
    })
  })

  it('does not deactivate or recreate the active cycle when activating the same template again', async () => {
    const program = await seedProgram(database)
    const repository = createProgramRepository(database)

    const firstActive = await repository.activateTemplate(program.template.id)
    const secondActive = await repository.activateTemplate(program.template.id)

    expect(secondActive.cycle.id).toBe(firstActive.cycle.id)
    await expect(
      database.activeProgramCycles.where({ status: 'active' }).toArray(),
    ).resolves.toHaveLength(1)
    await expect(
      database.activeProgramCycles.get(firstActive.cycle.id),
    ).resolves.toMatchObject({ status: 'active' })
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

  it('manually changes the selected week without clearing any week history', async () => {
    const program = await seedProgram(database)
    const repository = createProgramRepository(database)
    const active = await repository.activateTemplate(program.template.id)
    await repository.setActiveCycleDayCheck({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      weekNumber: 2,
      checked: true,
    })
    await repository.setActiveCycleDayCheck({
      activeCycleId: active.cycle.id,
      dayId: active.days[0].id,
      weekNumber: 5,
      checked: true,
    })

    const updated = await repository.updateActiveCycle(active.cycle.id, {
      currentWeekNumber: 4,
    })

    expect(updated.currentWeekNumber).toBe(4)
    await expect(
      database.activeCycleDayChecks
        .where({ activeCycleId: active.cycle.id })
        .toArray(),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ weekNumber: 2, checked: true }),
        expect.objectContaining({ weekNumber: 5, checked: true }),
      ]),
    )
  })

  it('keeps the current active cycle active when templates and active cycles are updated', async () => {
    const program = await seedProgram(database)
    const repository = createProgramRepository(database)
    const active = await repository.activateTemplate(program.template.id)

    await repository.updateProgramTemplate(program.template.id, {
      name: 'Template update',
    })
    await repository.updateTemplateDay(program.days[0].id, {
      name: 'Template day update',
    })
    await repository.updateActiveCycle(active.cycle.id, {
      name: 'Active update',
    })
    await repository.updateActiveCycleDay(active.days[0].id, {
      name: 'Active day update',
    })

    await expect(
      database.activeProgramCycles.get(active.cycle.id),
    ).resolves.toMatchObject({ status: 'active', name: 'Active update' })
    await expect(
      database.activeCycleWorkoutDays.get(active.days[0].id),
    ).resolves.toMatchObject({ name: 'Active day update' })
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

  it('lists inactive programs by effective recency and excludes the active template', async () => {
    const repository = createProgramRepository(database)
    const program = await seedProgram(database)
    const second = await repository.createProgramTemplate({
      name: 'Never active',
      days: [],
    })
    await repository.activateTemplate(program.template.id)

    const library = await repository.listProgramTemplates()

    expect(library.map((template) => template.id)).toEqual([second.template.id])
  })

  it('deactivates the current cycle and returns its template to the library', async () => {
    const repository = createProgramRepository(database)
    const program = await seedProgram(database)
    const active = await repository.activateTemplate(program.template.id)

    await repository.deactivateActiveCycle(active.cycle.id)

    await expect(
      repository.getCurrentActiveCycleStructure(),
    ).resolves.toBeUndefined()
    await expect(repository.listProgramTemplates()).resolves.toMatchObject([
      { id: program.template.id, name: program.template.name },
    ])
  })

  it('permanently deletes inactive program definitions while preserving workout history', async () => {
    const repository = createProgramRepository(database)
    const program = await seedProgram(database)
    await database.workoutHistoryEntries.add({
      id: 'history-1',
      sourceActiveCycleId: null,
      sourceTemplateId: program.template.id,
      sourceDayId: program.days[0].id,
      localDate: '2026-06-18',
      name: 'Upper',
      workoutSnapshot: {
        activeCycleName: null,
        templateName: 'Upper Lower',
        dayName: 'Upper',
        dayNotes: '',
      },
      notes: '',
      startedAt: '2026-06-18T12:00:00.000Z',
      completedAt: '2026-06-18T12:30:00.000Z',
      durationSeconds: 1800,
      elapsedPausedSeconds: 0,
      activeRestTimer: null,
      status: 'completed',
      createdAt: '2026-06-18T12:30:00.000Z',
      updatedAt: '2026-06-18T12:30:00.000Z',
    })

    await repository.deleteProgramTemplate(program.template.id)

    await expect(
      repository.getTemplate(program.template.id),
    ).resolves.toBeUndefined()
    await expect(database.templateWorkoutDays.toArray()).resolves.toEqual([])
    await expect(database.templateWorkoutExercises.toArray()).resolves.toEqual(
      [],
    )
    await expect(
      database.workoutHistoryEntries.get('history-1'),
    ).resolves.toMatchObject({
      workoutSnapshot: { templateName: 'Upper Lower', dayName: 'Upper' },
    })
  })

  it('blocks deleting the currently active program template', async () => {
    const repository = createProgramRepository(database)
    const program = await seedProgram(database)
    await repository.activateTemplate(program.template.id)

    await expect(
      repository.deleteProgramTemplate(program.template.id),
    ).rejects.toThrow('The active program cannot be deleted')
  })

  it('defaults track-RIR-every-set off, persists updates, and copies it on activation', async () => {
    const repository = createProgramRepository(database)
    const created = await repository.createProgramTemplate({
      name: 'RIR every set',
      days: [],
    })
    expect(created.template.trackRirEverySet).toBe(false)

    const updated = await repository.updateProgramTemplate(
      created.template.id,
      {
        trackRirEverySet: true,
      },
    )
    expect(updated.trackRirEverySet).toBe(true)

    const active = await repository.activateTemplate(created.template.id)
    expect(active.cycle.trackRirEverySet).toBe(true)

    const toggledOff = await repository.updateActiveCycle(active.cycle.id, {
      trackRirEverySet: false,
    })
    expect(toggledOff.trackRirEverySet).toBe(false)
  })

  it('moves a template exercise to another day and reindexes both days', async () => {
    const program = await seedProgram(database)
    const repository = createProgramRepository(database)
    const exerciseRepository = createExerciseRepository(database)
    const row = await exerciseRepository.createExercise({
      name: 'Row',
      defaultRestSeconds: 90,
      trackingMethodId: 'weight_reps',
      notes: '',
    })
    const second = await repository.addTemplateExercise(program.days[0].id, {
      exerciseId: row.id,
      targetSetCount: 3,
    })
    const lower = await repository.addTemplateDay(program.template.id, {
      name: 'Lower',
    })

    const moved = await repository.moveTemplateExercise(
      program.exercises[0].id,
      lower.id,
    )

    expect(moved).toMatchObject({ dayId: lower.id, orderIndex: 0 })
    const structure = await repository.getTemplateStructure(program.template.id)
    expect(structure.exercisesByDay[program.days[0].id]).toEqual([
      expect.objectContaining({ id: second.id, orderIndex: 0 }),
    ])
    expect(structure.exercisesByDay[lower.id]).toEqual([
      expect.objectContaining({ id: program.exercises[0].id, orderIndex: 0 }),
    ])

    // Moving to the day it is already on is a no-op.
    const unchanged = await repository.moveTemplateExercise(
      program.exercises[0].id,
      lower.id,
    )
    expect(unchanged).toMatchObject({ dayId: lower.id, orderIndex: 0 })

    // Days of a different program are rejected.
    const other = await repository.createProgramTemplate({
      name: 'Other program',
      days: [{ name: 'Solo', exercises: [] }],
    })
    await expect(
      repository.moveTemplateExercise(
        program.exercises[0].id,
        other.days[0].id,
      ),
    ).rejects.toThrow('same program')
  })

  it('restores a removed template exercise at its original position', async () => {
    const program = await seedProgram(database)
    const repository = createProgramRepository(database)
    const exerciseRepository = createExerciseRepository(database)
    const row = await exerciseRepository.createExercise({
      name: 'Row',
      defaultRestSeconds: 90,
      trackingMethodId: 'weight_reps',
      notes: '',
    })
    const middle = await repository.addTemplateExercise(program.days[0].id, {
      exerciseId: row.id,
      targetSetCount: 3,
    })
    const last = await repository.addTemplateExercise(program.days[0].id, {
      exerciseId: row.id,
      targetSetCount: 4,
    })

    const removed = await database.templateWorkoutExercises.get(middle.id)
    await repository.removeTemplateExercise(middle.id)
    if (!removed) {
      throw new Error('Removed exercise was not captured.')
    }

    const restored = await repository.restoreTemplateExercise(removed)

    expect(restored.id).toBe(middle.id)
    const structure = await repository.getTemplateStructure(program.template.id)
    expect(
      structure.exercisesByDay[program.days[0].id].map((exercise) => [
        exercise.id,
        exercise.orderIndex,
      ]),
    ).toEqual([
      [program.exercises[0].id, 0],
      [middle.id, 1],
      [last.id, 2],
    ])

    // Restoring twice is idempotent.
    await repository.restoreTemplateExercise(removed)
    await expect(
      database.templateWorkoutExercises
        .where({ dayId: program.days[0].id })
        .count(),
    ).resolves.toBe(3)
  })

  it('duplicates a template exercise directly after the original', async () => {
    const program = await seedProgram(database)
    const repository = createProgramRepository(database)
    const exerciseRepository = createExerciseRepository(database)
    const row = await exerciseRepository.createExercise({
      name: 'Row',
      defaultRestSeconds: 90,
      trackingMethodId: 'weight_reps',
      notes: '',
    })
    const last = await repository.addTemplateExercise(program.days[0].id, {
      exerciseId: row.id,
      targetSetCount: 4,
    })

    const copy = await repository.duplicateTemplateExercise(
      program.exercises[0].id,
    )

    expect(copy.id).not.toBe(program.exercises[0].id)
    expect(copy).toMatchObject({
      dayId: program.days[0].id,
      exerciseId: program.exercises[0].exerciseId,
      targetSetCount: program.exercises[0].targetSetCount,
    })
    const structure = await repository.getTemplateStructure(program.template.id)
    expect(
      structure.exercisesByDay[program.days[0].id].map((exercise) => [
        exercise.id,
        exercise.orderIndex,
      ]),
    ).toEqual([
      [program.exercises[0].id, 0],
      [copy.id, 1],
      [last.id, 2],
    ])
  })

  it('duplicates an active-cycle exercise without a template source link', async () => {
    const program = await seedProgram(database)
    const repository = createProgramRepository(database)
    const active = await repository.activateTemplate(program.template.id)

    const copy = await repository.duplicateActiveCycleExercise(
      active.exercises[0].id,
    )

    expect(copy.sourceTemplateExerciseId).toBeNull()
    const structure = await repository.getActiveCycleStructure(active.cycle.id)
    expect(
      structure.exercisesByDay[active.days[0].id].map((exercise) => [
        exercise.id,
        exercise.orderIndex,
      ]),
    ).toEqual([
      [active.exercises[0].id, 0],
      [copy.id, 1],
    ])
  })

  it('moves and restores active-cycle exercises across cycle days', async () => {
    const program = await seedProgram(database)
    const repository = createProgramRepository(database)
    const active = await repository.activateTemplate(program.template.id)
    const lower = await repository.addActiveCycleDay(active.cycle.id, {
      name: 'Lower',
    })

    const moved = await repository.moveActiveCycleExercise(
      active.exercises[0].id,
      lower.id,
    )
    expect(moved).toMatchObject({ dayId: lower.id, orderIndex: 0 })

    const removed = await database.activeCycleWorkoutExercises.get(moved.id)
    await repository.removeActiveCycleExercise(moved.id)
    if (!removed) {
      throw new Error('Removed exercise was not captured.')
    }

    const restored = await repository.restoreActiveCycleExercise(removed)

    expect(restored.id).toBe(moved.id)
    const structure = await repository.getActiveCycleStructure(active.cycle.id)
    expect(structure.exercisesByDay[lower.id]).toEqual([
      expect.objectContaining({ id: moved.id, orderIndex: 0 }),
    ])
    expect(structure.exercisesByDay[active.days[0].id] ?? []).toHaveLength(0)
  })
})
