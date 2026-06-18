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
  }
}

export const programRepository = createProgramRepository()
