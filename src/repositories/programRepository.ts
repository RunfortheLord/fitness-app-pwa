import { db, type TrainingLogDatabase } from '@db/database'
import { createId } from '@domain/ids'
import {
  BUILT_IN_PROGRAMS,
  BUILT_IN_PROGRAM_SEED_VERSION,
} from '@domain/programLibrarySeed'
import { snapshotExercise } from '@domain/snapshots'
import {
  clampProgramDurationWeeks,
  DEFAULT_PROGRAM_DURATION_WEEKS,
} from '@domain/programWeeks'
import type { ExerciseUsageSummary } from '@domain/exerciseSearch'
import type {
  ActiveCycleDayCheck,
  ActiveCycleWorkoutDay,
  ActiveCycleWorkoutExercise,
  ActiveProgramCycle,
  ProgramTemplate,
  ProgramTemplateDay,
  TemplateWorkoutExercise,
} from '@shared-types/app'

export type CreateTemplateExerciseInput = {
  exerciseId: string
  targetSetCount: number
  targetWeight?: number | null
  targetDurationSeconds?: number | null
  targetDistance?: number | null
  targetRepsMin?: number | null
  targetRepsMax?: number | null
  targetRir?: number | null
  restSecondsOverride?: number | null
  notes?: string
}

export type CreateTemplateDayInput = {
  name: string
  notes?: string
  exercises: CreateTemplateExerciseInput[]
}

export type CreateProgramTemplateInput = {
  name: string
  notes?: string
  durationWeeks?: number | null
  days: CreateTemplateDayInput[]
}

export type UpdatePrescribedExerciseInput = Partial<
  Pick<
    TemplateWorkoutExercise,
    | 'targetSetCount'
    | 'targetWeight'
    | 'targetDurationSeconds'
    | 'targetDistance'
    | 'targetRepsMin'
    | 'targetRepsMax'
    | 'targetRir'
    | 'restSecondsOverride'
    | 'notes'
  >
>

export type ProgramRepositoryTestHooks = {
  afterTemplateAdded?: () => void | Promise<void>
  afterActiveCycleAdded?: () => void | Promise<void>
}

// Fixed timestamp so re-seeding a built-in program is deterministic.
const BUILT_IN_PROGRAM_CREATED_AT = '2026-06-19T00:00:00.000Z'

export function builtInProgramTemplateId(slug: string) {
  return `builtin-program:${slug}`
}

export function createProgramRepository(
  database: TrainingLogDatabase = db,
  testHooks: ProgramRepositoryTestHooks = {},
) {
  async function assertTemplateEditable(templateId: string) {
    const template = await database.programTemplates.get(templateId)
    if (template?.isBuiltIn) {
      throw new Error(
        'Built-in programs are read-only. Duplicate the program to make changes.',
      )
    }
  }

  return {
    /**
     * Idempotently seeds the built-in program library. Built-in templates use
     * stable IDs and a seed version, so re-running never duplicates them and
     * never touches user-owned templates, active cycles, or workout history.
     */
    async seedBuiltInPrograms() {
      await database.transaction(
        'rw',
        database.programTemplates,
        database.templateWorkoutDays,
        database.templateWorkoutExercises,
        database.exercises,
        async () => {
          // Load the exercise library once instead of per-prescription so seeding
          // stays fast (hundreds of prescriptions reference it).
          const exerciseById = new Map(
            (await database.exercises.toArray()).map((exercise) => [
              exercise.id,
              exercise,
            ]),
          )

          // Built-in programs reference built-in exercises by id. If the exercise
          // library has not been seeded yet there is nothing valid to seed
          // against, so skip instead of throwing. In normal startup
          // seedBuiltInExercises() runs (and is awaited) before this, so the
          // library is always present; an empty table only happens when a stale,
          // in-flight seed call races a database reset (e.g. between tests).
          if (exerciseById.size === 0) {
            return
          }

          const existingTemplates = new Map(
            (await database.programTemplates.toArray()).map((template) => [
              template.id,
              template,
            ]),
          )

          const templatesToSeed: ProgramTemplate[] = []
          const daysToSeed: ProgramTemplateDay[] = []
          const exercisesToSeed: TemplateWorkoutExercise[] = []

          for (const program of BUILT_IN_PROGRAMS) {
            const templateId = builtInProgramTemplateId(program.slug)
            const existing = existingTemplates.get(templateId)
            if (
              existing &&
              (existing.builtInSeedVersion ?? 0) >=
                BUILT_IN_PROGRAM_SEED_VERSION
            ) {
              continue
            }

            // Replace an existing built-in's own source definition; on a fresh
            // database there is nothing to delete, so skip the extra queries.
            if (existing) {
              await database.templateWorkoutExercises
                .where({ templateId })
                .delete()
              await database.templateWorkoutDays.where({ templateId }).delete()
            }

            templatesToSeed.push({
              id: templateId,
              name: program.name,
              notes: program.notes ?? '',
              status: 'active',
              lastActiveAt: existing?.lastActiveAt ?? null,
              isBuiltIn: true,
              level: program.level,
              goal: program.goal,
              durationWeeks:
                program.durationWeeks ?? DEFAULT_PROGRAM_DURATION_WEEKS,
              builtInSeedVersion: BUILT_IN_PROGRAM_SEED_VERSION,
              createdAt: existing?.createdAt ?? BUILT_IN_PROGRAM_CREATED_AT,
              updatedAt: BUILT_IN_PROGRAM_CREATED_AT,
            })

            for (const [dayIndex, day] of program.days.entries()) {
              const dayId = `${templateId}::d${dayIndex}`
              daysToSeed.push({
                id: dayId,
                templateId,
                name: day.name,
                notes: day.notes ?? '',
                orderIndex: dayIndex,
                createdAt: BUILT_IN_PROGRAM_CREATED_AT,
                updatedAt: BUILT_IN_PROGRAM_CREATED_AT,
              })

              for (const [exIndex, ex] of day.exercises.entries()) {
                const exercise = exerciseById.get(ex.exerciseId)
                if (!exercise) {
                  throw new Error(
                    `Built-in program exercise ${ex.exerciseId} was not found in the exercise library.`,
                  )
                }
                exercisesToSeed.push({
                  id: `${dayId}::e${exIndex}`,
                  templateId,
                  dayId,
                  exerciseId: exercise.id,
                  exerciseSnapshot: snapshotExercise(exercise),
                  orderIndex: exIndex,
                  targetSetCount: ex.targetSetCount,
                  targetWeight: null,
                  targetDurationSeconds: null,
                  targetDistance: null,
                  targetRepsMin: ex.targetRepsMin,
                  targetRepsMax: ex.targetRepsMax,
                  targetRir: ex.targetRir,
                  restSecondsOverride: null,
                  notes: ex.notes ?? '',
                  createdAt: BUILT_IN_PROGRAM_CREATED_AT,
                  updatedAt: BUILT_IN_PROGRAM_CREATED_AT,
                })
              }
            }
          }

          if (templatesToSeed.length) {
            await database.programTemplates.bulkPut(templatesToSeed)
            await database.templateWorkoutDays.bulkPut(daysToSeed)
            await database.templateWorkoutExercises.bulkPut(exercisesToSeed)
          }
        },
      )
    },

    async createProgramTemplate(input: CreateProgramTemplateInput) {
      const now = new Date().toISOString()
      const template: ProgramTemplate = {
        id: createId(),
        name: input.name,
        notes: '',
        status: 'active',
        lastActiveAt: null,
        durationWeeks: clampProgramDurationWeeks(
          input.durationWeeks ?? DEFAULT_PROGRAM_DURATION_WEEKS,
        ),
        createdAt: now,
        updatedAt: now,
      }

      const days: ProgramTemplateDay[] = []
      const prescribedExercises: TemplateWorkoutExercise[] = []

      await database.transaction(
        'rw',
        database.programTemplates,
        database.templateWorkoutDays,
        database.templateWorkoutExercises,
        database.exercises,
        async () => {
          await database.programTemplates.add(template)
          await testHooks.afterTemplateAdded?.()

          for (const [dayIndex, dayInput] of input.days.entries()) {
            const day: ProgramTemplateDay = {
              id: createId(),
              templateId: template.id,
              name: dayInput.name,
              notes: dayInput.notes ?? '',
              orderIndex: dayIndex,
              createdAt: now,
              updatedAt: now,
            }
            days.push(day)
            await database.templateWorkoutDays.add(day)

            for (const [
              exerciseIndex,
              exerciseInput,
            ] of dayInput.exercises.entries()) {
              const exercise = await database.exercises.get(
                exerciseInput.exerciseId,
              )
              if (!exercise) {
                throw new Error(
                  `Exercise ${exerciseInput.exerciseId} was not found.`,
                )
              }

              const prescribed: TemplateWorkoutExercise = {
                id: createId(),
                templateId: template.id,
                dayId: day.id,
                exerciseId: exercise.id,
                exerciseSnapshot: snapshotExercise(exercise),
                orderIndex: exerciseIndex,
                targetSetCount: exerciseInput.targetSetCount,
                targetWeight: exerciseInput.targetWeight ?? null,
                targetDurationSeconds: null,
                targetDistance: exerciseInput.targetDistance ?? null,
                targetRepsMin: exerciseInput.targetRepsMin ?? null,
                targetRepsMax: exerciseInput.targetRepsMax ?? null,
                targetRir: exerciseInput.targetRir ?? null,
                restSecondsOverride: exerciseInput.restSecondsOverride ?? null,
                notes: exerciseInput.notes ?? '',
                createdAt: now,
                updatedAt: now,
              }
              prescribedExercises.push(prescribed)
              await database.templateWorkoutExercises.add(prescribed)
            }
          }
        },
      )

      return { template, days, exercises: prescribedExercises }
    },

    async activateTemplate(templateId: string) {
      const now = new Date().toISOString()
      return database.transaction(
        'rw',
        [
          database.programTemplates,
          database.templateWorkoutDays,
          database.templateWorkoutExercises,
          database.activeProgramCycles,
          database.activeCycleWorkoutDays,
          database.activeCycleWorkoutExercises,
        ],
        async () => {
          const template = await database.programTemplates.get(templateId)
          if (!template) {
            throw new Error(`Program template ${templateId} was not found.`)
          }
          const currentCycles = await database.activeProgramCycles
            .where({ status: 'active' })
            .toArray()
          await Promise.all(
            currentCycles.map((currentCycle) =>
              database.activeProgramCycles.update(currentCycle.id, {
                status: 'inactive',
                updatedAt: now,
              }),
            ),
          )

          const cycle: ActiveProgramCycle = {
            id: createId(),
            sourceTemplateId: template.id,
            name: template.name,
            notes: '',
            status: 'active',
            activatedAt: now,
            durationWeeks:
              template.durationWeeks ?? DEFAULT_PROGRAM_DURATION_WEEKS,
            createdAt: now,
            updatedAt: now,
          }
          await database.activeProgramCycles.add(cycle)
          await database.programTemplates.update(template.id, {
            lastActiveAt: now,
            updatedAt: now,
          })
          await testHooks.afterActiveCycleAdded?.()

          const sourceDays = await database.templateWorkoutDays
            .where({ templateId })
            .sortBy('orderIndex')
          const activeDays: ActiveCycleWorkoutDay[] = []
          const activeExercises: ActiveCycleWorkoutExercise[] = []

          for (const sourceDay of sourceDays) {
            const activeDay: ActiveCycleWorkoutDay = {
              id: createId(),
              activeCycleId: cycle.id,
              sourceTemplateDayId: sourceDay.id,
              name: sourceDay.name,
              notes: '',
              orderIndex: sourceDay.orderIndex,
              createdAt: now,
              updatedAt: now,
            }
            activeDays.push(activeDay)
            await database.activeCycleWorkoutDays.add(activeDay)

            const sourceExercises = await database.templateWorkoutExercises
              .where({ dayId: sourceDay.id })
              .sortBy('orderIndex')
            for (const sourceExercise of sourceExercises) {
              const activeExercise: ActiveCycleWorkoutExercise = {
                id: createId(),
                activeCycleId: cycle.id,
                dayId: activeDay.id,
                sourceTemplateExerciseId: sourceExercise.id,
                exerciseId: sourceExercise.exerciseId,
                exerciseSnapshot: sourceExercise.exerciseSnapshot,
                orderIndex: sourceExercise.orderIndex,
                targetSetCount: sourceExercise.targetSetCount,
                targetWeight: sourceExercise.targetWeight ?? null,
                targetDurationSeconds: null,
                targetDistance: sourceExercise.targetDistance ?? null,
                targetRepsMin: sourceExercise.targetRepsMin,
                targetRepsMax: sourceExercise.targetRepsMax,
                targetRir: sourceExercise.targetRir,
                restSecondsOverride: sourceExercise.restSecondsOverride,
                notes: '',
                createdAt: now,
                updatedAt: now,
              }
              activeExercises.push(activeExercise)
              await database.activeCycleWorkoutExercises.add(activeExercise)
            }
          }

          return { cycle, days: activeDays, exercises: activeExercises }
        },
      )
    },

    async deactivateActiveCycle(activeCycleId: string) {
      const cycle = await database.activeProgramCycles.get(activeCycleId)
      if (!cycle) {
        throw new Error(`Active program cycle ${activeCycleId} was not found.`)
      }
      await database.activeProgramCycles.update(activeCycleId, {
        status: 'inactive',
        updatedAt: new Date().toISOString(),
      })
    },

    getTemplate(id: string) {
      return database.programTemplates.get(id)
    },

    async listProgramTemplates() {
      const [templates, activeCycle] = await Promise.all([
        database.programTemplates.toArray(),
        database.activeProgramCycles.where({ status: 'active' }).last(),
      ])
      const activeTemplateId = activeCycle?.sourceTemplateId ?? null

      return templates
        .filter((template) => template.id !== activeTemplateId)
        .sort(compareProgramLibraryRecords)
    },

    async updateProgramTemplate(
      id: string,
      input: Partial<Pick<ProgramTemplate, 'name' | 'durationWeeks'>>,
    ) {
      const template = await database.programTemplates.get(id)
      if (!template) {
        throw new Error(`Program template ${id} was not found.`)
      }
      if (template.isBuiltIn) {
        throw new Error(
          'Built-in programs are read-only. Duplicate the program to make changes.',
        )
      }

      const durationWeeks =
        input.durationWeeks != null
          ? clampProgramDurationWeeks(input.durationWeeks)
          : (template.durationWeeks ?? DEFAULT_PROGRAM_DURATION_WEEKS)
      const updated: ProgramTemplate = {
        ...template,
        ...input,
        durationWeeks,
        notes: '',
        updatedAt: new Date().toISOString(),
      }
      await database.programTemplates.put(updated)
      return updated
    },

    async deleteProgramTemplate(id: string) {
      const now = new Date().toISOString()
      return database.transaction(
        'rw',
        database.programTemplates,
        database.templateWorkoutDays,
        database.templateWorkoutExercises,
        database.activeProgramCycles,
        async () => {
          const template = await database.programTemplates.get(id)
          if (!template) {
            throw new Error(`Program template ${id} was not found.`)
          }
          if (template.isBuiltIn) {
            throw new Error(
              'Built-in programs cannot be deleted. Duplicate the program to customize it.',
            )
          }
          const activeCycle = await database.activeProgramCycles
            .where({ status: 'active' })
            .last()
          if (activeCycle?.sourceTemplateId === id) {
            throw new Error(
              'The active program cannot be deleted. Activate another program first.',
            )
          }
          const activeCopies = await database.activeProgramCycles
            .where({ sourceTemplateId: id })
            .toArray()
          if (activeCopies.some((cycle) => cycle.status === 'active')) {
            throw new Error(
              'The active program cannot be deleted. Activate another program first.',
            )
          }
          await Promise.all(
            activeCopies.map((cycle) =>
              database.activeProgramCycles.update(cycle.id, {
                sourceTemplateId: null,
                updatedAt: now,
              }),
            ),
          )
          await database.templateWorkoutExercises
            .where({ templateId: id })
            .delete()
          await database.templateWorkoutDays.where({ templateId: id }).delete()
          await database.programTemplates.delete(id)
        },
      )
    },

    async cloneProgramTemplate(id: string) {
      const source = await this.getTemplateStructure(id)
      return this.createProgramTemplate({
        name: `${source.template.name} copy`,
        notes: '',
        durationWeeks: source.template.durationWeeks ?? null,
        days: source.days.map((day) => ({
          name: day.name,
          notes: '',
          exercises: source.exercisesByDay[day.id].map((exercise) => ({
            exerciseId: exercise.exerciseId,
            targetSetCount: exercise.targetSetCount,
            targetWeight: exercise.targetWeight ?? null,
            targetDurationSeconds: null,
            targetDistance: exercise.targetDistance ?? null,
            targetRepsMin: exercise.targetRepsMin,
            targetRepsMax: exercise.targetRepsMax,
            targetRir: exercise.targetRir,
            restSecondsOverride: exercise.restSecondsOverride,
            notes: '',
          })),
        })),
      })
    },

    async addTemplateDay(
      templateId: string,
      input: { name: string; notes?: string },
    ) {
      const now = new Date().toISOString()
      return database.transaction(
        'rw',
        database.programTemplates,
        database.templateWorkoutDays,
        async () => {
          const template = await database.programTemplates.get(templateId)
          if (!template) {
            throw new Error(`Program template ${templateId} was not found.`)
          }
          if (template.isBuiltIn) {
            throw new Error(
              'Built-in programs are read-only. Duplicate the program to make changes.',
            )
          }
          const existingDays = await database.templateWorkoutDays
            .where({ templateId })
            .toArray()
          const day: ProgramTemplateDay = {
            id: createId(),
            templateId,
            name: input.name,
            notes: '',
            orderIndex: existingDays.length,
            createdAt: now,
            updatedAt: now,
          }
          await database.templateWorkoutDays.add(day)
          await database.programTemplates.update(templateId, { updatedAt: now })
          return day
        },
      )
    },

    async updateTemplateDay(
      dayId: string,
      input: Partial<Pick<ProgramTemplateDay, 'name'>>,
    ) {
      const day = await database.templateWorkoutDays.get(dayId)
      if (!day) {
        throw new Error(`Program template day ${dayId} was not found.`)
      }
      const now = new Date().toISOString()
      const updated = { ...day, ...input, notes: '', updatedAt: now }
      await database.transaction(
        'rw',
        database.programTemplates,
        database.templateWorkoutDays,
        async () => {
          await database.templateWorkoutDays.put(updated)
          await database.programTemplates.update(day.templateId, {
            updatedAt: now,
          })
        },
      )
      return updated
    },

    async removeTemplateDay(dayId: string) {
      const day = await database.templateWorkoutDays.get(dayId)
      if (!day) {
        throw new Error(`Program template day ${dayId} was not found.`)
      }
      await assertTemplateEditable(day.templateId)
      const now = new Date().toISOString()
      await database.transaction(
        'rw',
        database.programTemplates,
        database.templateWorkoutDays,
        database.templateWorkoutExercises,
        async () => {
          await database.templateWorkoutExercises.where({ dayId }).delete()
          await database.templateWorkoutDays.delete(dayId)
          await reindexTemplateDays(database, day.templateId, now)
          await database.programTemplates.update(day.templateId, {
            updatedAt: now,
          })
        },
      )
    },

    async reorderTemplateDays(templateId: string, orderedDayIds: string[]) {
      const now = new Date().toISOString()
      await database.transaction(
        'rw',
        database.programTemplates,
        database.templateWorkoutDays,
        async () => {
          const days = await database.templateWorkoutDays
            .where({ templateId })
            .toArray()
          assertSameIds(
            days.map((day) => day.id),
            orderedDayIds,
            'Template day order did not match existing days.',
          )
          await Promise.all(
            orderedDayIds.map((id, orderIndex) =>
              database.templateWorkoutDays.update(id, {
                orderIndex,
                updatedAt: now,
              }),
            ),
          )
          await database.programTemplates.update(templateId, { updatedAt: now })
        },
      )
    },

    async duplicateTemplateDay(dayId: string) {
      const sourceDay = await database.templateWorkoutDays.get(dayId)
      if (!sourceDay) {
        throw new Error(`Program template day ${dayId} was not found.`)
      }
      const now = new Date().toISOString()
      return database.transaction(
        'rw',
        database.programTemplates,
        database.templateWorkoutDays,
        database.templateWorkoutExercises,
        async () => {
          const copy: ProgramTemplateDay = {
            ...sourceDay,
            id: createId(),
            name: `${sourceDay.name} copy`,
            orderIndex: sourceDay.orderIndex + 1,
            createdAt: now,
            updatedAt: now,
          }
          await shiftTemplateDays(
            database,
            sourceDay.templateId,
            copy.orderIndex,
            now,
          )
          await database.templateWorkoutDays.add(copy)

          const sourceExercises = await database.templateWorkoutExercises
            .where({ dayId })
            .sortBy('orderIndex')
          await database.templateWorkoutExercises.bulkAdd(
            sourceExercises.map((exercise) => ({
              ...exercise,
              id: createId(),
              dayId: copy.id,
              orderIndex: exercise.orderIndex,
              createdAt: now,
              updatedAt: now,
            })),
          )
          await database.programTemplates.update(sourceDay.templateId, {
            updatedAt: now,
          })
          return copy
        },
      )
    },

    async addTemplateExercise(
      dayId: string,
      input: CreateTemplateExerciseInput,
    ) {
      const now = new Date().toISOString()
      return database.transaction(
        'rw',
        database.programTemplates,
        database.templateWorkoutDays,
        database.templateWorkoutExercises,
        database.exercises,
        async () => {
          const day = await database.templateWorkoutDays.get(dayId)
          if (!day) {
            throw new Error(`Program template day ${dayId} was not found.`)
          }
          await assertTemplateEditable(day.templateId)
          const exercise = await database.exercises.get(input.exerciseId)
          if (!exercise) {
            throw new Error(`Exercise ${input.exerciseId} was not found.`)
          }
          const existing = await database.templateWorkoutExercises
            .where({ dayId })
            .toArray()
          const prescribed: TemplateWorkoutExercise = {
            id: createId(),
            templateId: day.templateId,
            dayId,
            exerciseId: exercise.id,
            exerciseSnapshot: snapshotExercise(exercise),
            orderIndex: existing.length,
            targetSetCount: input.targetSetCount,
            targetWeight: input.targetWeight ?? null,
            targetDurationSeconds: null,
            targetDistance: input.targetDistance ?? null,
            targetRepsMin: input.targetRepsMin ?? null,
            targetRepsMax: input.targetRepsMax ?? null,
            targetRir: input.targetRir ?? null,
            restSecondsOverride: input.restSecondsOverride ?? null,
            notes: '',
            createdAt: now,
            updatedAt: now,
          }
          await database.templateWorkoutExercises.add(prescribed)
          await database.programTemplates.update(day.templateId, {
            updatedAt: now,
          })
          return prescribed
        },
      )
    },

    async updateTemplateExercise(
      prescribedExerciseId: string,
      input: UpdatePrescribedExerciseInput & { exerciseId?: string },
    ) {
      const now = new Date().toISOString()
      return database.transaction(
        'rw',
        database.programTemplates,
        database.templateWorkoutExercises,
        database.exercises,
        async () => {
          const prescribed =
            await database.templateWorkoutExercises.get(prescribedExerciseId)
          if (!prescribed) {
            throw new Error(
              `Template exercise ${prescribedExerciseId} was not found.`,
            )
          }
          await assertTemplateEditable(prescribed.templateId)
          const replacement = input.exerciseId
            ? await database.exercises.get(input.exerciseId)
            : undefined
          if (input.exerciseId && !replacement) {
            throw new Error(`Exercise ${input.exerciseId} was not found.`)
          }
          const updated: TemplateWorkoutExercise = {
            ...prescribed,
            ...input,
            exerciseId: replacement?.id ?? prescribed.exerciseId,
            exerciseSnapshot: replacement
              ? snapshotExercise(replacement)
              : prescribed.exerciseSnapshot,
            targetRepsMin: hasField(input, 'targetRepsMin')
              ? (input.targetRepsMin ?? null)
              : prescribed.targetRepsMin,
            targetRepsMax: hasField(input, 'targetRepsMax')
              ? (input.targetRepsMax ?? null)
              : prescribed.targetRepsMax,
            targetWeight: hasField(input, 'targetWeight')
              ? (input.targetWeight ?? null)
              : (prescribed.targetWeight ?? null),
            targetDurationSeconds: null,
            targetDistance: hasField(input, 'targetDistance')
              ? (input.targetDistance ?? null)
              : (prescribed.targetDistance ?? null),
            targetRir: hasField(input, 'targetRir')
              ? (input.targetRir ?? null)
              : prescribed.targetRir,
            restSecondsOverride: hasField(input, 'restSecondsOverride')
              ? (input.restSecondsOverride ?? null)
              : prescribed.restSecondsOverride,
            notes: '',
            updatedAt: now,
          }
          await database.templateWorkoutExercises.put(updated)
          await database.programTemplates.update(prescribed.templateId, {
            updatedAt: now,
          })
          return updated
        },
      )
    },

    async removeTemplateExercise(prescribedExerciseId: string) {
      const prescribed =
        await database.templateWorkoutExercises.get(prescribedExerciseId)
      if (!prescribed) {
        throw new Error(
          `Template exercise ${prescribedExerciseId} was not found.`,
        )
      }
      await assertTemplateEditable(prescribed.templateId)
      const now = new Date().toISOString()
      await database.transaction(
        'rw',
        database.programTemplates,
        database.templateWorkoutExercises,
        async () => {
          await database.templateWorkoutExercises.delete(prescribedExerciseId)
          await reindexTemplateExercises(database, prescribed.dayId, now)
          await database.programTemplates.update(prescribed.templateId, {
            updatedAt: now,
          })
        },
      )
    },

    async reorderTemplateExercises(
      dayId: string,
      orderedExerciseIds: string[],
    ) {
      const now = new Date().toISOString()
      await database.transaction(
        'rw',
        database.programTemplates,
        database.templateWorkoutDays,
        database.templateWorkoutExercises,
        async () => {
          const day = await database.templateWorkoutDays.get(dayId)
          if (!day) {
            throw new Error(`Program template day ${dayId} was not found.`)
          }
          const exercises = await database.templateWorkoutExercises
            .where({ dayId })
            .toArray()
          assertSameIds(
            exercises.map((exercise) => exercise.id),
            orderedExerciseIds,
            'Template exercise order did not match existing exercises.',
          )
          await Promise.all(
            orderedExerciseIds.map((id, orderIndex) =>
              database.templateWorkoutExercises.update(id, {
                orderIndex,
                updatedAt: now,
              }),
            ),
          )
          await database.programTemplates.update(day.templateId, {
            updatedAt: now,
          })
        },
      )
    },

    async getTemplateStructure(templateId: string) {
      const template = await database.programTemplates.get(templateId)
      if (!template) {
        throw new Error(`Program template ${templateId} was not found.`)
      }
      const days = await database.templateWorkoutDays
        .where({ templateId })
        .sortBy('orderIndex')
      const exercises = await database.templateWorkoutExercises
        .where({ templateId })
        .toArray()

      return {
        template,
        days,
        exercisesByDay: Object.fromEntries(
          days.map((day) => [
            day.id,
            exercises
              .filter((exercise) => exercise.dayId === day.id)
              .sort((first, second) => first.orderIndex - second.orderIndex),
          ]),
        ),
      }
    },

    async getActiveCycleStructure(activeCycleId: string) {
      const cycle = await database.activeProgramCycles.get(activeCycleId)
      if (!cycle) {
        throw new Error(`Active program cycle ${activeCycleId} was not found.`)
      }
      const days = await database.activeCycleWorkoutDays
        .where({ activeCycleId })
        .sortBy('orderIndex')
      const exercises = await database.activeCycleWorkoutExercises
        .where({ activeCycleId })
        .toArray()

      return {
        cycle,
        days,
        exercisesByDay: Object.fromEntries(
          days.map((day) => [
            day.id,
            exercises
              .filter((exercise) => exercise.dayId === day.id)
              .sort((first, second) => first.orderIndex - second.orderIndex),
          ]),
        ),
      }
    },

    async getCurrentActiveCycleStructure() {
      const cycle = await database.activeProgramCycles
        .where({ status: 'active' })
        .last()

      if (!cycle) {
        return undefined
      }

      return this.getActiveCycleStructure(cycle.id)
    },

    async listActiveCycleDayChecks(activeCycleId: string, weekNumber: number) {
      return database.activeCycleDayChecks
        .where('[activeCycleId+weekNumber]')
        .equals([activeCycleId, weekNumber])
        .toArray()
    },

    // Manual toggle from the dashboard check-box. Upserts the per-week record so
    // a completed-then-unchecked day stays unchecked until toggled again.
    async setActiveCycleDayCheck(input: {
      activeCycleId: string
      dayId: string
      weekNumber: number
      checked: boolean
    }) {
      const now = new Date().toISOString()
      const existing = await database.activeCycleDayChecks
        .where('[activeCycleId+dayId+weekNumber]')
        .equals([input.activeCycleId, input.dayId, input.weekNumber])
        .first()
      if (existing) {
        const updated: ActiveCycleDayCheck = {
          ...existing,
          checked: input.checked,
          updatedAt: now,
        }
        await database.activeCycleDayChecks.put(updated)
        return updated
      }
      const record: ActiveCycleDayCheck = {
        id: createId(),
        activeCycleId: input.activeCycleId,
        dayId: input.dayId,
        weekNumber: input.weekNumber,
        checked: input.checked,
        createdAt: now,
        updatedAt: now,
      }
      await database.activeCycleDayChecks.add(record)
      return record
    },

    async getExerciseUsageSummary(): Promise<ExerciseUsageSummary> {
      const usage: ExerciseUsageSummary = {}
      const noteUsage = (exerciseId: string | null, timestamp: string) => {
        if (!exerciseId) {
          return
        }
        const current = usage[exerciseId] ?? { count: 0, lastUsedAt: null }
        usage[exerciseId] = {
          count: current.count + 1,
          lastUsedAt:
            current.lastUsedAt && current.lastUsedAt > timestamp
              ? current.lastUsedAt
              : timestamp,
        }
      }

      const [
        templateExercises,
        activeExercises,
        workoutExercises,
        historyExercises,
        workouts,
        historyWorkouts,
      ] = await Promise.all([
        database.templateWorkoutExercises.toArray(),
        database.activeCycleWorkoutExercises.toArray(),
        database.workoutExercises.toArray(),
        database.workoutHistoryExercises.toArray(),
        database.workouts.toArray(),
        database.workoutHistoryEntries.toArray(),
      ])
      const workoutTimes = new Map(
        workouts.map((workout) => [workout.id, workout.updatedAt]),
      )
      const historyTimes = new Map(
        historyWorkouts.map((workout) => [workout.id, workout.completedAt]),
      )

      for (const exercise of templateExercises) {
        noteUsage(exercise.exerciseId, exercise.updatedAt)
      }
      for (const exercise of activeExercises) {
        noteUsage(exercise.exerciseId, exercise.updatedAt)
      }
      for (const exercise of workoutExercises) {
        noteUsage(
          exercise.exerciseId,
          workoutTimes.get(exercise.workoutId) ?? exercise.updatedAt,
        )
      }
      for (const exercise of historyExercises) {
        noteUsage(
          exercise.exerciseId,
          historyTimes.get(exercise.workoutId) ?? exercise.updatedAt,
        )
      }

      return usage
    },

    async updateActiveCycle(
      id: string,
      input: Partial<Pick<ActiveProgramCycle, 'name' | 'durationWeeks'>>,
    ) {
      const cycle = await database.activeProgramCycles.get(id)
      if (!cycle) {
        throw new Error(`Active program cycle ${id} was not found.`)
      }
      const durationWeeks =
        input.durationWeeks != null
          ? clampProgramDurationWeeks(input.durationWeeks)
          : (cycle.durationWeeks ?? DEFAULT_PROGRAM_DURATION_WEEKS)
      const updated = {
        ...cycle,
        ...input,
        durationWeeks,
        notes: '',
        updatedAt: new Date().toISOString(),
      }
      await database.activeProgramCycles.put(updated)
      return updated
    },

    async addActiveCycleDay(
      activeCycleId: string,
      input: { name: string; notes?: string },
    ) {
      const now = new Date().toISOString()
      return database.transaction(
        'rw',
        database.activeProgramCycles,
        database.activeCycleWorkoutDays,
        async () => {
          const cycle = await database.activeProgramCycles.get(activeCycleId)
          if (!cycle) {
            throw new Error(
              `Active program cycle ${activeCycleId} was not found.`,
            )
          }
          const days = await database.activeCycleWorkoutDays
            .where({ activeCycleId })
            .toArray()
          const day: ActiveCycleWorkoutDay = {
            id: createId(),
            activeCycleId,
            sourceTemplateDayId: null,
            name: input.name,
            notes: '',
            orderIndex: days.length,
            createdAt: now,
            updatedAt: now,
          }
          await database.activeCycleWorkoutDays.add(day)
          await database.activeProgramCycles.update(activeCycleId, {
            updatedAt: now,
          })
          return day
        },
      )
    },

    async updateActiveCycleDay(
      dayId: string,
      input: Partial<Pick<ActiveCycleWorkoutDay, 'name'>>,
    ) {
      const day = await database.activeCycleWorkoutDays.get(dayId)
      if (!day) {
        throw new Error(`Active cycle day ${dayId} was not found.`)
      }
      const now = new Date().toISOString()
      const updated = { ...day, ...input, notes: '', updatedAt: now }
      await database.transaction(
        'rw',
        database.activeProgramCycles,
        database.activeCycleWorkoutDays,
        async () => {
          await database.activeCycleWorkoutDays.put(updated)
          await database.activeProgramCycles.update(day.activeCycleId, {
            updatedAt: now,
          })
        },
      )
      return updated
    },

    async removeActiveCycleDay(dayId: string) {
      const day = await database.activeCycleWorkoutDays.get(dayId)
      if (!day) {
        throw new Error(`Active cycle day ${dayId} was not found.`)
      }
      const now = new Date().toISOString()
      await database.transaction(
        'rw',
        database.activeProgramCycles,
        database.activeCycleWorkoutDays,
        database.activeCycleWorkoutExercises,
        async () => {
          await database.activeCycleWorkoutExercises.where({ dayId }).delete()
          await database.activeCycleWorkoutDays.delete(dayId)
          await reindexActiveDays(database, day.activeCycleId, now)
          await database.activeProgramCycles.update(day.activeCycleId, {
            updatedAt: now,
          })
        },
      )
    },

    async reorderActiveCycleDays(
      activeCycleId: string,
      orderedDayIds: string[],
    ) {
      const now = new Date().toISOString()
      await database.transaction(
        'rw',
        database.activeProgramCycles,
        database.activeCycleWorkoutDays,
        async () => {
          const days = await database.activeCycleWorkoutDays
            .where({ activeCycleId })
            .toArray()
          assertSameIds(
            days.map((day) => day.id),
            orderedDayIds,
            'Active cycle day order did not match existing days.',
          )
          await Promise.all(
            orderedDayIds.map((id, orderIndex) =>
              database.activeCycleWorkoutDays.update(id, {
                orderIndex,
                updatedAt: now,
              }),
            ),
          )
          await database.activeProgramCycles.update(activeCycleId, {
            updatedAt: now,
          })
        },
      )
    },

    async duplicateActiveCycleDay(dayId: string) {
      const sourceDay = await database.activeCycleWorkoutDays.get(dayId)
      if (!sourceDay) {
        throw new Error(`Active cycle day ${dayId} was not found.`)
      }
      const now = new Date().toISOString()
      return database.transaction(
        'rw',
        database.activeProgramCycles,
        database.activeCycleWorkoutDays,
        database.activeCycleWorkoutExercises,
        async () => {
          const copy: ActiveCycleWorkoutDay = {
            ...sourceDay,
            id: createId(),
            sourceTemplateDayId: sourceDay.sourceTemplateDayId,
            name: `${sourceDay.name} copy`,
            orderIndex: sourceDay.orderIndex + 1,
            createdAt: now,
            updatedAt: now,
          }
          await shiftActiveDays(
            database,
            sourceDay.activeCycleId,
            copy.orderIndex,
            now,
          )
          await database.activeCycleWorkoutDays.add(copy)

          const sourceExercises = await database.activeCycleWorkoutExercises
            .where({ dayId })
            .sortBy('orderIndex')
          await database.activeCycleWorkoutExercises.bulkAdd(
            sourceExercises.map((exercise) => ({
              ...exercise,
              id: createId(),
              dayId: copy.id,
              sourceTemplateExerciseId: exercise.sourceTemplateExerciseId,
              orderIndex: exercise.orderIndex,
              createdAt: now,
              updatedAt: now,
            })),
          )
          await database.activeProgramCycles.update(sourceDay.activeCycleId, {
            updatedAt: now,
          })
          return copy
        },
      )
    },

    async addActiveCycleExercise(
      dayId: string,
      input: CreateTemplateExerciseInput,
    ) {
      const now = new Date().toISOString()
      return database.transaction(
        'rw',
        database.activeProgramCycles,
        database.activeCycleWorkoutDays,
        database.activeCycleWorkoutExercises,
        database.exercises,
        async () => {
          const day = await database.activeCycleWorkoutDays.get(dayId)
          if (!day) {
            throw new Error(`Active cycle day ${dayId} was not found.`)
          }
          const exercise = await database.exercises.get(input.exerciseId)
          if (!exercise) {
            throw new Error(`Exercise ${input.exerciseId} was not found.`)
          }
          const existing = await database.activeCycleWorkoutExercises
            .where({ dayId })
            .toArray()
          const prescribed: ActiveCycleWorkoutExercise = {
            id: createId(),
            activeCycleId: day.activeCycleId,
            dayId,
            sourceTemplateExerciseId: null,
            exerciseId: exercise.id,
            exerciseSnapshot: snapshotExercise(exercise),
            orderIndex: existing.length,
            targetSetCount: input.targetSetCount,
            targetWeight: input.targetWeight ?? null,
            targetDurationSeconds: null,
            targetDistance: input.targetDistance ?? null,
            targetRepsMin: input.targetRepsMin ?? null,
            targetRepsMax: input.targetRepsMax ?? null,
            targetRir: input.targetRir ?? null,
            restSecondsOverride: input.restSecondsOverride ?? null,
            notes: '',
            createdAt: now,
            updatedAt: now,
          }
          await database.activeCycleWorkoutExercises.add(prescribed)
          await database.activeProgramCycles.update(day.activeCycleId, {
            updatedAt: now,
          })
          return prescribed
        },
      )
    },

    async updateActiveCycleExercise(
      prescribedExerciseId: string,
      input: UpdatePrescribedExerciseInput & { exerciseId?: string },
    ) {
      const now = new Date().toISOString()
      return database.transaction(
        'rw',
        database.activeProgramCycles,
        database.activeCycleWorkoutExercises,
        database.exercises,
        async () => {
          const prescribed =
            await database.activeCycleWorkoutExercises.get(prescribedExerciseId)
          if (!prescribed) {
            throw new Error(
              `Active cycle exercise ${prescribedExerciseId} was not found.`,
            )
          }
          const replacement = input.exerciseId
            ? await database.exercises.get(input.exerciseId)
            : undefined
          if (input.exerciseId && !replacement) {
            throw new Error(`Exercise ${input.exerciseId} was not found.`)
          }
          const updated: ActiveCycleWorkoutExercise = {
            ...prescribed,
            ...input,
            exerciseId: replacement?.id ?? prescribed.exerciseId,
            exerciseSnapshot: replacement
              ? snapshotExercise(replacement)
              : prescribed.exerciseSnapshot,
            targetRepsMin: hasField(input, 'targetRepsMin')
              ? (input.targetRepsMin ?? null)
              : prescribed.targetRepsMin,
            targetRepsMax: hasField(input, 'targetRepsMax')
              ? (input.targetRepsMax ?? null)
              : prescribed.targetRepsMax,
            targetWeight: hasField(input, 'targetWeight')
              ? (input.targetWeight ?? null)
              : (prescribed.targetWeight ?? null),
            targetDurationSeconds: null,
            targetDistance: hasField(input, 'targetDistance')
              ? (input.targetDistance ?? null)
              : (prescribed.targetDistance ?? null),
            targetRir: hasField(input, 'targetRir')
              ? (input.targetRir ?? null)
              : prescribed.targetRir,
            restSecondsOverride: hasField(input, 'restSecondsOverride')
              ? (input.restSecondsOverride ?? null)
              : prescribed.restSecondsOverride,
            notes: '',
            updatedAt: now,
          }
          await database.activeCycleWorkoutExercises.put(updated)
          await database.activeProgramCycles.update(prescribed.activeCycleId, {
            updatedAt: now,
          })
          return updated
        },
      )
    },

    async removeActiveCycleExercise(prescribedExerciseId: string) {
      const prescribed =
        await database.activeCycleWorkoutExercises.get(prescribedExerciseId)
      if (!prescribed) {
        throw new Error(
          `Active cycle exercise ${prescribedExerciseId} was not found.`,
        )
      }
      const now = new Date().toISOString()
      await database.transaction(
        'rw',
        database.activeProgramCycles,
        database.activeCycleWorkoutExercises,
        async () => {
          await database.activeCycleWorkoutExercises.delete(
            prescribedExerciseId,
          )
          await reindexActiveExercises(database, prescribed.dayId, now)
          await database.activeProgramCycles.update(prescribed.activeCycleId, {
            updatedAt: now,
          })
        },
      )
    },

    async reorderActiveCycleExercises(
      dayId: string,
      orderedExerciseIds: string[],
    ) {
      const now = new Date().toISOString()
      await database.transaction(
        'rw',
        database.activeProgramCycles,
        database.activeCycleWorkoutDays,
        database.activeCycleWorkoutExercises,
        async () => {
          const day = await database.activeCycleWorkoutDays.get(dayId)
          if (!day) {
            throw new Error(`Active cycle day ${dayId} was not found.`)
          }
          const exercises = await database.activeCycleWorkoutExercises
            .where({ dayId })
            .toArray()
          assertSameIds(
            exercises.map((exercise) => exercise.id),
            orderedExerciseIds,
            'Active cycle exercise order did not match existing exercises.',
          )
          await Promise.all(
            orderedExerciseIds.map((id, orderIndex) =>
              database.activeCycleWorkoutExercises.update(id, {
                orderIndex,
                updatedAt: now,
              }),
            ),
          )
          await database.activeProgramCycles.update(day.activeCycleId, {
            updatedAt: now,
          })
        },
      )
    },
  }
}

function compareProgramLibraryRecords(
  first: ProgramTemplate,
  second: ProgramTemplate,
) {
  const firstRecency = first.lastActiveAt ?? first.createdAt
  const secondRecency = second.lastActiveAt ?? second.createdAt
  return firstRecency === secondRecency
    ? first.name.localeCompare(second.name)
    : secondRecency.localeCompare(firstRecency)
}

function assertSameIds(
  existingIds: string[],
  orderedIds: string[],
  message: string,
) {
  const existing = [...existingIds].sort()
  const ordered = [...orderedIds].sort()
  if (
    existing.length !== ordered.length ||
    existing.some((id, index) => id !== ordered[index])
  ) {
    throw new Error(message)
  }
}

function hasField<T extends object, K extends PropertyKey>(
  value: T,
  key: K,
): value is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(value, key)
}

async function shiftTemplateDays(
  database: TrainingLogDatabase,
  templateId: string,
  fromIndex: number,
  updatedAt: string,
) {
  const days = await database.templateWorkoutDays
    .where({ templateId })
    .filter((day) => day.orderIndex >= fromIndex)
    .toArray()
  await Promise.all(
    days.map((day) =>
      database.templateWorkoutDays.update(day.id, {
        orderIndex: day.orderIndex + 1,
        updatedAt,
      }),
    ),
  )
}

async function shiftActiveDays(
  database: TrainingLogDatabase,
  activeCycleId: string,
  fromIndex: number,
  updatedAt: string,
) {
  const days = await database.activeCycleWorkoutDays
    .where({ activeCycleId })
    .filter((day) => day.orderIndex >= fromIndex)
    .toArray()
  await Promise.all(
    days.map((day) =>
      database.activeCycleWorkoutDays.update(day.id, {
        orderIndex: day.orderIndex + 1,
        updatedAt,
      }),
    ),
  )
}

async function reindexTemplateDays(
  database: TrainingLogDatabase,
  templateId: string,
  updatedAt: string,
) {
  const days = await database.templateWorkoutDays
    .where({ templateId })
    .sortBy('orderIndex')
  await Promise.all(
    days.map((day, orderIndex) =>
      database.templateWorkoutDays.update(day.id, { orderIndex, updatedAt }),
    ),
  )
}

async function reindexActiveDays(
  database: TrainingLogDatabase,
  activeCycleId: string,
  updatedAt: string,
) {
  const days = await database.activeCycleWorkoutDays
    .where({ activeCycleId })
    .sortBy('orderIndex')
  await Promise.all(
    days.map((day, orderIndex) =>
      database.activeCycleWorkoutDays.update(day.id, { orderIndex, updatedAt }),
    ),
  )
}

async function reindexTemplateExercises(
  database: TrainingLogDatabase,
  dayId: string,
  updatedAt: string,
) {
  const exercises = await database.templateWorkoutExercises
    .where({ dayId })
    .sortBy('orderIndex')
  await Promise.all(
    exercises.map((exercise, orderIndex) =>
      database.templateWorkoutExercises.update(exercise.id, {
        orderIndex,
        updatedAt,
      }),
    ),
  )
}

async function reindexActiveExercises(
  database: TrainingLogDatabase,
  dayId: string,
  updatedAt: string,
) {
  const exercises = await database.activeCycleWorkoutExercises
    .where({ dayId })
    .sortBy('orderIndex')
  await Promise.all(
    exercises.map((exercise, orderIndex) =>
      database.activeCycleWorkoutExercises.update(exercise.id, {
        orderIndex,
        updatedAt,
      }),
    ),
  )
}

export const programRepository = createProgramRepository()
