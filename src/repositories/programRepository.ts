import { db, type TrainingLogDatabase } from '@db/database'
import { createId } from '@domain/ids'
import { snapshotExercise } from '@domain/snapshots'
import type {
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
  days: CreateTemplateDayInput[]
}

export type UpdatePrescribedExerciseInput = Partial<
  Pick<
    TemplateWorkoutExercise,
    | 'targetSetCount'
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

export function createProgramRepository(
  database: TrainingLogDatabase = db,
  testHooks: ProgramRepositoryTestHooks = {},
) {
  return {
    async createProgramTemplate(input: CreateProgramTemplateInput) {
      const now = new Date().toISOString()
      const template: ProgramTemplate = {
        id: createId(),
        name: input.name,
        notes: input.notes ?? '',
        status: 'active',
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
          if (template.status === 'archived') {
            throw new Error('Archived program templates cannot be activated.')
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
            notes: template.notes,
            status: 'active',
            activatedAt: now,
            createdAt: now,
            updatedAt: now,
          }
          await database.activeProgramCycles.add(cycle)
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
              notes: sourceDay.notes,
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
                targetRepsMin: sourceExercise.targetRepsMin,
                targetRepsMax: sourceExercise.targetRepsMax,
                targetRir: sourceExercise.targetRir,
                restSecondsOverride: sourceExercise.restSecondsOverride,
                notes: sourceExercise.notes,
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

    getTemplate(id: string) {
      return database.programTemplates.get(id)
    },

    async listProgramTemplates(options: { includeArchived?: boolean } = {}) {
      const templates = options.includeArchived
        ? await database.programTemplates.toArray()
        : await database.programTemplates.where({ status: 'active' }).toArray()

      return templates.sort((first, second) =>
        first.updatedAt === second.updatedAt
          ? first.name.localeCompare(second.name)
          : second.updatedAt.localeCompare(first.updatedAt),
      )
    },

    async updateProgramTemplate(
      id: string,
      input: Partial<Pick<ProgramTemplate, 'name' | 'notes'>>,
    ) {
      const template = await database.programTemplates.get(id)
      if (!template) {
        throw new Error(`Program template ${id} was not found.`)
      }

      const updated: ProgramTemplate = {
        ...template,
        ...input,
        updatedAt: new Date().toISOString(),
      }
      await database.programTemplates.put(updated)
      return updated
    },

    archiveProgramTemplate(id: string) {
      return database.programTemplates.update(id, {
        status: 'archived',
        updatedAt: new Date().toISOString(),
      })
    },

    async cloneProgramTemplate(id: string) {
      const source = await this.getTemplateStructure(id)
      return this.createProgramTemplate({
        name: `${source.template.name} copy`,
        notes: source.template.notes,
        days: source.days.map((day) => ({
          name: day.name,
          notes: day.notes,
          exercises: source.exercisesByDay[day.id].map((exercise) => ({
            exerciseId: exercise.exerciseId,
            targetSetCount: exercise.targetSetCount,
            targetRepsMin: exercise.targetRepsMin,
            targetRepsMax: exercise.targetRepsMax,
            targetRir: exercise.targetRir,
            restSecondsOverride: exercise.restSecondsOverride,
            notes: exercise.notes,
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
          const existingDays = await database.templateWorkoutDays
            .where({ templateId })
            .toArray()
          const day: ProgramTemplateDay = {
            id: createId(),
            templateId,
            name: input.name,
            notes: input.notes ?? '',
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
      input: Partial<Pick<ProgramTemplateDay, 'name' | 'notes'>>,
    ) {
      const day = await database.templateWorkoutDays.get(dayId)
      if (!day) {
        throw new Error(`Program template day ${dayId} was not found.`)
      }
      const now = new Date().toISOString()
      const updated = { ...day, ...input, updatedAt: now }
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
            targetRepsMin: input.targetRepsMin ?? null,
            targetRepsMax: input.targetRepsMax ?? null,
            targetRir: input.targetRir ?? null,
            restSecondsOverride: input.restSecondsOverride ?? null,
            notes: input.notes ?? '',
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
            targetRir: hasField(input, 'targetRir')
              ? (input.targetRir ?? null)
              : prescribed.targetRir,
            restSecondsOverride: hasField(input, 'restSecondsOverride')
              ? (input.restSecondsOverride ?? null)
              : prescribed.restSecondsOverride,
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

    async updateActiveCycle(
      id: string,
      input: Partial<Pick<ActiveProgramCycle, 'name' | 'notes'>>,
    ) {
      const cycle = await database.activeProgramCycles.get(id)
      if (!cycle) {
        throw new Error(`Active program cycle ${id} was not found.`)
      }
      const updated = {
        ...cycle,
        ...input,
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
            notes: input.notes ?? '',
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
      input: Partial<Pick<ActiveCycleWorkoutDay, 'name' | 'notes'>>,
    ) {
      const day = await database.activeCycleWorkoutDays.get(dayId)
      if (!day) {
        throw new Error(`Active cycle day ${dayId} was not found.`)
      }
      const now = new Date().toISOString()
      const updated = { ...day, ...input, updatedAt: now }
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
            targetRepsMin: input.targetRepsMin ?? null,
            targetRepsMax: input.targetRepsMax ?? null,
            targetRir: input.targetRir ?? null,
            restSecondsOverride: input.restSecondsOverride ?? null,
            notes: input.notes ?? '',
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
            targetRir: hasField(input, 'targetRir')
              ? (input.targetRir ?? null)
              : prescribed.targetRir,
            restSecondsOverride: hasField(input, 'restSecondsOverride')
              ? (input.restSecondsOverride ?? null)
              : prescribed.restSecondsOverride,
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
