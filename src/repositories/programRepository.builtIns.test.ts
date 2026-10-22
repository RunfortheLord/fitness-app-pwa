import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { TrainingLogDatabase } from '@db/database'
import {
  BUILT_IN_PROGRAMS,
  BUILT_IN_PROGRAM_SEED_VERSION,
} from '@domain/programLibrarySeed'
import { createExerciseRepository } from '@repositories/exerciseRepository'
import {
  builtInProgramTemplateId,
  createProgramRepository,
} from '@repositories/programRepository'
import { createTestDatabase, destroyTestDatabase } from '@test/database'

let database: TrainingLogDatabase

beforeEach(async () => {
  database = createTestDatabase()
  await createExerciseRepository(database).seedBuiltInExercises()
})

afterEach(async () => {
  await destroyTestDatabase(database)
})

describe('seedBuiltInPrograms', () => {
  it('seeds all 31 immutable built-in templates with days and exercises', async () => {
    const repository = createProgramRepository(database)
    await repository.seedBuiltInPrograms()

    const templates = await database.programTemplates.toArray()
    const builtIns = templates.filter((t) => t.isBuiltIn)
    expect(builtIns).toHaveLength(31)

    const ids = builtIns.map((t) => t.id)
    expect(new Set(ids).size).toBe(31)

    // Every prescription references a real, seeded exercise.
    const prescriptions = await database.templateWorkoutExercises.toArray()
    for (const prescription of prescriptions) {
      const exercise = await database.exercises.get(prescription.exerciseId)
      expect(exercise).toBeDefined()
    }

    // Spot-check the first program's structure.
    const firstId = builtInProgramTemplateId(BUILT_IN_PROGRAMS[0].slug)
    const structure = await repository.getTemplateStructure(firstId)
    expect(structure.days).toHaveLength(BUILT_IN_PROGRAMS[0].days.length)
  })

  it('is idempotent across repeated seeding', async () => {
    const repository = createProgramRepository(database)
    await repository.seedBuiltInPrograms()
    const firstDays = await database.templateWorkoutDays.count()
    const firstExercises = await database.templateWorkoutExercises.count()

    await repository.seedBuiltInPrograms()
    await repository.seedBuiltInPrograms()

    expect(await database.programTemplates.count()).toBe(31)
    expect(await database.templateWorkoutDays.count()).toBe(firstDays)
    expect(await database.templateWorkoutExercises.count()).toBe(firstExercises)
  })

  it('seeds the public block prescriptions and deload schedules without changing an active cycle', async () => {
    const repository = createProgramRepository(database)
    await repository.seedBuiltInPrograms()
    const existing = await repository.cloneProgramTemplate(
      builtInProgramTemplateId('beginner-full-body-a-b'),
    )
    const active = await repository.activateTemplate(existing.template.id)

    await repository.seedBuiltInPrograms()

    for (const [slug, weeks, rowRest] of [
      ['20-week-size-strength-block-a-2026', [4, 8], 150],
      ['20-week-strength-peak-block-b-2027', [7], 120],
    ] as const) {
      const structure = await repository.getTemplateStructure(
        builtInProgramTemplateId(slug),
      )
      expect(structure.template).toMatchObject({
        isBuiltIn: true,
        durationWeeks: 10,
        deloadWeekNumbers: weeks,
        deloadSchedulingEnabled: true,
      })
      const thursday = structure.days[2]
      expect(
        structure.exercisesByDay[thursday.id].find(
          (exercise) => exercise.exerciseId === 'builtin:t-bar-row',
        ),
      ).toMatchObject({ restSecondsOverride: rowRest })
    }
    await expect(
      database.activeProgramCycles.get(active.cycle.id),
    ).resolves.toMatchObject({
      status: 'active',
      sourceTemplateId: existing.template.id,
    })
  })

  it('replaces an older built-in seed while preserving the stable template id', async () => {
    const repository = createProgramRepository(database)
    await repository.seedBuiltInPrograms()
    const templateId = builtInProgramTemplateId('full-body-four-days-per-week')
    await database.programTemplates.update(templateId, {
      name: 'Full Body Four Days per Week',
      notes: '',
      builtInSeedVersion: 1,
    })

    await repository.seedBuiltInPrograms()

    const structure = await repository.getTemplateStructure(templateId)
    expect(structure.template).toMatchObject({
      id: templateId,
      name: 'Powerlifting-Focused Full Body - Four Days per Week',
      builtInSeedVersion: BUILT_IN_PROGRAM_SEED_VERSION,
      notes: expect.stringContaining('Monday, Tuesday, Thursday, Saturday'),
    })
    expect(structure.days.map((day) => day.name)).toEqual([
      'Monday - Squat + Bench',
      'Tuesday - Bench + Deadlift',
      'Thursday - Squat + Bench',
      'Saturday - Bench + Deadlift',
    ])
    expect(structure.exercisesByDay[structure.days[0].id][0].notes).toContain(
      'back-off sets',
    )
  })

  it('refuses to mutate a built-in template', async () => {
    const repository = createProgramRepository(database)
    await repository.seedBuiltInPrograms()
    const templateId = builtInProgramTemplateId(BUILT_IN_PROGRAMS[0].slug)
    const structure = await repository.getTemplateStructure(templateId)

    await expect(
      repository.updateProgramTemplate(templateId, { name: 'Hacked' }),
    ).rejects.toThrow(/read-only/i)
    await expect(repository.deleteProgramTemplate(templateId)).rejects.toThrow(
      /cannot be deleted/i,
    )
    await expect(
      repository.addTemplateDay(templateId, { name: 'Extra day' }),
    ).rejects.toThrow(/read-only/i)
    await expect(
      repository.removeTemplateExercise(
        structure.exercisesByDay[structure.days[0].id][0].id,
      ),
    ).rejects.toThrow(/read-only/i)

    // Nothing changed.
    const after = await repository.getTemplateStructure(templateId)
    expect(after.template.name).toBe(structure.template.name)
    expect(after.days).toHaveLength(structure.days.length)
  })

  it('clones a built-in into an independent editable user copy', async () => {
    const repository = createProgramRepository(database)
    await repository.seedBuiltInPrograms()
    const templateId = builtInProgramTemplateId(BUILT_IN_PROGRAMS[0].slug)

    const copy = await repository.cloneProgramTemplate(templateId)
    expect(copy.template.isBuiltIn).toBeFalsy()
    expect(copy.template.id).not.toBe(templateId)

    // Editing the copy is allowed and does not touch the built-in source.
    await repository.updateProgramTemplate(copy.template.id, {
      name: 'My custom plan',
    })
    const source = await database.programTemplates.get(templateId)
    expect(source?.name).toBe(BUILT_IN_PROGRAMS[0].name)
    expect(copy.days[0].id).not.toBe(`${templateId}::d0`)
  })

  it('preserves built-in exercise notes when cloning into a user copy', async () => {
    const repository = createProgramRepository(database)
    await repository.seedBuiltInPrograms()
    const templateId = builtInProgramTemplateId('full-body-four-days-per-week')

    const copy = await repository.cloneProgramTemplate(templateId)

    expect(copy.exercises[0].notes).toContain('back-off sets')
  })

  it('backfills blank notes in existing built-in user copies and active cycles', async () => {
    const repository = createProgramRepository(database)
    await repository.seedBuiltInPrograms()
    const templateId = builtInProgramTemplateId('full-body-four-days-per-week')
    const copy = await repository.cloneProgramTemplate(templateId)
    await Promise.all(
      copy.exercises.map((exercise) =>
        database.templateWorkoutExercises.update(exercise.id, { notes: '' }),
      ),
    )
    const active = await repository.activateTemplate(copy.template.id)
    await Promise.all(
      active.exercises.map((exercise) =>
        database.activeCycleWorkoutExercises.update(exercise.id, { notes: '' }),
      ),
    )

    await repository.seedBuiltInPrograms()

    await expect(
      database.templateWorkoutExercises.get(copy.exercises[0].id),
    ).resolves.toMatchObject({ notes: expect.stringContaining('back-off') })
    await expect(
      database.activeCycleWorkoutExercises.get(active.exercises[0].id),
    ).resolves.toMatchObject({ notes: expect.stringContaining('back-off') })
  })

  it('keeps the current active cycle active when built-in programs are reseeded', async () => {
    const repository = createProgramRepository(database)
    await repository.seedBuiltInPrograms()
    const templateId = builtInProgramTemplateId('full-body-four-days-per-week')
    const copy = await repository.cloneProgramTemplate(templateId)
    const active = await repository.activateTemplate(copy.template.id)

    await repository.seedBuiltInPrograms()

    await expect(
      database.activeProgramCycles.get(active.cycle.id),
    ).resolves.toMatchObject({ status: 'active' })
    await expect(
      database.activeProgramCycles.where({ status: 'active' }).toArray(),
    ).resolves.toHaveLength(1)
  })

  it('activates a built-in as an isolated snapshot without mutating it', async () => {
    const repository = createProgramRepository(database)
    await repository.seedBuiltInPrograms()
    const templateId = builtInProgramTemplateId(BUILT_IN_PROGRAMS[0].slug)

    const active = await repository.activateTemplate(templateId)
    expect(active.cycle.sourceTemplateId).toBe(templateId)
    expect(active.days[0].id).not.toBe(`${templateId}::d0`)

    const source = await repository.getTemplateStructure(templateId)
    expect(source.template.isBuiltIn).toBe(true)
    expect(source.days).toHaveLength(BUILT_IN_PROGRAMS[0].days.length)
  })
})
