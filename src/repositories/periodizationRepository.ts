import { db, type TrainingLogDatabase } from '@db/database'
import { createProgramRepository } from './programRepository'
import { createExerciseRepository } from './exerciseRepository'
import {
  februaryDays,
  februaryProgramName,
  createFebruaryPlan,
  prescriptionSet,
} from '@domain/februaryPeak'
import {
  periodizedPlanSchema,
  prescriptionKey,
  type PeriodizedPlan,
  type ExercisePrescription,
  resolvePrescription,
} from '@domain/periodization'
import { createStrengthGraphPoints } from '@domain/strengthProgress'
import { BUILT_IN_EXERCISES } from '@domain/exerciseLibrary'
import type { WorkoutHistorySet } from '@shared-types/app'

export function createPeriodizationRepository(
  database: TrainingLogDatabase = db,
) {
  const programs = createProgramRepository(database)
  return {
    async performance(cycleId?: string) {
      const [workouts, exercises, sets] = await Promise.all([
        database.workoutHistoryEntries.toArray(),
        database.workoutHistoryExercises.toArray(),
        database.workoutHistorySets.toArray(),
      ])
      const eligible = new Set(
        workouts
          .filter((workout) => !workout.isDeload)
          .map((workout) => workout.id),
      )
      const historyByExercise: Record<string, WorkoutHistorySet[]> = {}
      const latestPerformanceByExercise: Record<
        string,
        { date: string; sets: WorkoutHistorySet[] }
      > = {}
      for (const exercise of exercises.filter(
        (exercise) => !exercise.skipped && eligible.has(exercise.workoutId),
      )) {
        if (!exercise.exerciseId) continue
        const completed = sets.filter(
          (set) => set.workoutExerciseId === exercise.id && set.completed,
        )
        const date =
          workouts.find((workout) => workout.id === exercise.workoutId)
            ?.localDate ?? ''
        if (
          completed.length &&
          (!latestPerformanceByExercise[exercise.exerciseId] ||
            date >= latestPerformanceByExercise[exercise.exerciseId].date)
        )
          latestPerformanceByExercise[exercise.exerciseId] = {
            date,
            sets: completed,
          }
        const existing = historyByExercise[exercise.exerciseId]
        if (
          completed.some(
            (set) =>
              !['warm-up', 'technique set'].includes(
                set.plannedSet?.kind ?? '',
              ),
          ) &&
          (!existing?.length ||
            (completed[0]?.completedAt ?? '') >
              (existing[0]?.completedAt ?? ''))
        )
          historyByExercise[exercise.exerciseId] = completed
      }
      return {
        historyByExercise,
        latestPerformanceByExercise,
        completed: workouts.filter(
          (workout) => workout.sourceActiveCycleId === cycleId,
        ),
        trends: createStrengthGraphPoints(
          workouts.map((workout) => ({
            workout,
            exercises: exercises.filter(
              (exercise) => exercise.workoutId === workout.id,
            ),
            setsByExercise: Object.fromEntries(
              exercises
                .filter((exercise) => exercise.workoutId === workout.id)
                .map((exercise) => [
                  exercise.id,
                  sets.filter((set) => set.workoutExerciseId === exercise.id),
                ]),
            ),
          })),
        ),
      }
    },
    async seedFebruaryProgram() {
      return database.transaction(
        'rw',
        [
          database.programTemplates,
          database.templateWorkoutDays,
          database.templateWorkoutExercises,
          database.exercises,
        ],
        async () => {
          // The name is only a lookup for the first install; user edits are never re-seeded.
          if (await database.programTemplates.get('february-2027-peak')) return
          const library = await database.exercises.toArray()
          const exerciseIds: string[][] = []
          const aliases: Record<string, string[]> = {
            'Barbell bench press': [
              'Bench Press (Barbell)',
              'Barbell Bench Press',
            ],
            'Low-bar squat': [
              'Low Bar Back Squat',
              'Low-Bar Back Squat',
              'Squat (Low Bar)',
            ],
            'Sumo deadlift': ['Sumo Deadlift (Barbell)'],
            'Paused barbell bench press': [
              'Paused Bench Press',
              'Paused Bench Press (Barbell)',
            ],
            'Pull-up': ['Pull Up', 'Pull-ups'],
            'Low-incline barbell press': ['Low-Incline Barbell Bench Press'],
            'Single-arm kneeling lat pulldown': ['Single-Arm Lat Pulldown'],
            'Ab wheel': ['Ab Wheel Rollout'],
          }
          const normalize = (name: string) =>
            name.toLowerCase().replace(/[^a-z0-9]/g, '')
          for (const day of februaryDays) {
            const ids: string[] = []
            for (const [name] of day.exercises) {
              const names = [name, ...(aliases[name] ?? [])].map(normalize)
              let match =
                library.find(
                  (exercise) => normalize(exercise.name) === names[0],
                ) ??
                library.find((exercise) =>
                  names.includes(normalize(exercise.name)),
                )
              if (!match) {
                const builtIn = BUILT_IN_EXERCISES.find((exercise) =>
                  names.includes(normalize(exercise.name)),
                )
                if (builtIn) {
                  await database.exercises.add(builtIn)
                  match = builtIn
                  library.push(builtIn)
                }
              }
              if (!match) {
                match = await createExerciseRepository(database).createExercise(
                  {
                    name,
                    defaultRestSeconds: 120,
                    trackingMethodId:
                      name === 'Ab wheel'
                        ? 'reps_only'
                        : name === 'Pull-up'
                          ? 'bodyweight_reps'
                          : 'weight_reps',
                  },
                )
                library.push(match)
              }
              ids.push(match.id)
            }
            exerciseIds.push(ids)
          }
          await database.transaction(
            'rw',
            [
              database.programTemplates,
              database.templateWorkoutDays,
              database.templateWorkoutExercises,
              database.exercises,
            ],
            async () => {
              if (await database.programTemplates.get('february-2027-peak'))
                return
              const created = await programs.createProgramTemplate({
                name: februaryProgramName,
                days: februaryDays.map((day, dayIndex) => ({
                  name: day.name,
                  exercises: day.exercises.map((entry, index) => ({
                    exerciseId: exerciseIds[dayIndex][index],
                    targetSetCount: entry[1],
                    targetRepsMin: entry[2],
                    targetRepsMax: entry[3],
                    targetRir: 2,
                  })),
                })),
              })
              const plan = createFebruaryPlan(
                created.days.map((day) =>
                  created.exercises
                    .filter((exercise) => exercise.dayId === day.id)
                    .map((exercise) => exercise.id),
                ),
                created.days.map((day) => day.id),
                exerciseIds,
              )
              await database.programTemplates.delete(created.template.id)
              await database.programTemplates.add({
                ...created.template,
                id: 'february-2027-peak',
                periodization: plan,
                durationWeeks: 14,
                trackRirEverySet: true,
                deloadSchedulingEnabled: false,
              })
              await database.templateWorkoutDays
                .where({ templateId: created.template.id })
                .modify({ templateId: 'february-2027-peak' })
              await database.templateWorkoutExercises
                .where({ templateId: created.template.id })
                .modify({ templateId: 'february-2027-peak' })
            },
          )
        },
      )
    },
    async editWeeks(
      id: string,
      mode: 'template' | 'cycle',
      change: (plan: PeriodizedPlan) => void,
    ) {
      const table =
        mode === 'template'
          ? database.programTemplates
          : database.activeProgramCycles
      return database.transaction('rw', table, async () => {
        const record = await table.get(id)
        if (!record?.periodization?.enabled)
          throw new Error('Enable asymmetrical weeks first.')
        const plan = record.periodization
        change(plan)
        return this.savePlan(id, mode, plan)
      })
    },
    async selectWeek(id: string, week: number) {
      return this.editWeeks(id, 'cycle', (plan) => {
        if (!plan.weeks[week - 1]) throw new Error('Choose an existing week.')
        plan.selectedWeek = week
      })
    },
    async saveWeekExercise(
      id: string,
      mode: 'template' | 'cycle',
      weeks: number[],
      key: string,
      base: ExercisePrescription,
      patch: Partial<ExercisePrescription>,
      maxes: Record<string, number | null> = {},
    ) {
      return database.transaction(
        'rw',
        [
          database.programTemplates,
          database.activeProgramCycles,
          database.exercises,
        ],
        async () => {
          for (const [lift, value] of Object.entries(maxes)) {
            if (value !== null && (!Number.isFinite(value) || value <= 0))
              throw new Error('Enter a positive one-rep max.')
            if (
              !(await database.exercises.update(lift, {
                savedOneRepMax: value,
                updatedAt: new Date().toISOString(),
              }))
            )
              throw new Error('Reference lift was not found.')
          }
          return this.editWeeks(id, mode, (plan) => {
            plan.defaults[key] ??= structuredClone(base)
            for (const week of weeks) {
              const assigned = plan.weeks[week - 1]
              if (!assigned) throw new Error('Choose an existing week.')
              const changes = structuredClone(patch)
              // If group structure is stable, carry only the edited fields into
              // another week. Its other weight and rep targets stay independent.
              const other = resolvePrescription(plan, week, key)
              if (
                week !== weeks[0] &&
                changes.sets &&
                other &&
                changes.sets.length === base.sets.length &&
                other.sets.length === base.sets.length
              ) {
                changes.sets = changes.sets.map((group, i) => {
                  const changed = Object.fromEntries(
                    Object.entries({ ...base.sets[i], ...group })
                      .filter(
                        ([field]) =>
                          group[field as keyof typeof group] !==
                          base.sets[i][field as keyof typeof group],
                      )
                      .map(([field]) => [
                        field,
                        group[field as keyof typeof group],
                      ]),
                  )
                  return { ...other.sets[i], ...changed }
                })
              }
              assigned.overrides[key] = {
                ...assigned.overrides[key],
                ...changes,
              }
            }
          })
        },
      )
    },
    async addWeekExercise(
      id: string,
      mode: 'template' | 'cycle',
      dayId: string,
      week: number,
      exerciseId: string,
      copy?: ExercisePrescription,
    ) {
      return database.transaction(
        'rw',
        [
          database.programTemplates,
          database.activeProgramCycles,
          database.templateWorkoutDays,
          database.templateWorkoutExercises,
          database.activeCycleWorkoutDays,
          database.activeCycleWorkoutExercises,
          database.exercises,
        ],
        async () => {
          const input = { exerciseId, targetSetCount: 3 }
          const row =
            mode === 'template'
              ? await programs.addTemplateExercise(dayId, input)
              : await programs.addActiveCycleExercise(dayId, input)
          const value: ExercisePrescription = copy ?? {
            included: true,
            optional: false,
            progression: 'hold',
            notes: '',
            sets: [
              prescriptionSet('straight set', 3, 8, 12, null, {
                loadMode: 'fixed',
              }),
            ],
          }
          return this.editWeeks(id, mode, (plan) => {
            plan.defaults[row.id] = { ...value, included: false }
            plan.weeks[week - 1].overrides[row.id] = {
              ...value,
              included: true,
            }
          })
        },
      )
    },
    async savePlan(
      id: string,
      mode: 'template' | 'cycle',
      input: PeriodizedPlan,
    ) {
      const validation = periodizedPlanSchema.safeParse(input)
      if (!validation.success)
        throw new Error(
          `Check the program settings: ${validation.error.issues[0]?.message ?? 'A prescription is invalid.'}`,
        )
      const plan = validation.data
      const table =
        mode === 'template'
          ? database.programTemplates
          : database.activeProgramCycles
      if (!(await table.get(id))) throw new Error('Program was not found.')
      await table.update(id, {
        periodization: plan,
        ...(plan.enabled
          ? {
              durationWeeks: plan.weeks.length,
            }
          : {}),
        updatedAt: new Date().toISOString(),
      })
      return plan
    },
    async fromRepeatingTemplate(
      templateId: string,
      startDate: string,
      duration: number,
      mode: 'template' | 'cycle' = 'template',
    ) {
      if (!Number.isInteger(duration) || duration < 1 || duration > 104)
        throw new Error('Choose 1–104 weeks.')
      const source =
        mode === 'template'
          ? await programs.getTemplateStructure(templateId)
          : await programs.getActiveCycleStructure(templateId)
      const defaults: PeriodizedPlan['defaults'] = {}
      for (const exercise of Object.values(source.exercisesByDay).flat()) {
        defaults[
          'sourceTemplateExerciseId' in exercise
            ? prescriptionKey(exercise)
            : exercise.id
        ] = {
          included: true,
          optional: false,
          progression: 'double progression',
          notes: exercise.notes,
          sets: [
            prescriptionSet(
              'straight set',
              Math.max(1, exercise.targetSetCount),
              exercise.targetRepsMin ?? 8,
              exercise.targetRepsMax ?? exercise.targetRepsMin ?? 8,
              exercise.targetRir,
              {
                loadMode: 'fixed',
                startingWeight: exercise.targetWeight ?? undefined,
                restSeconds: exercise.restSecondsOverride ?? 120,
              },
            ),
          ],
        }
      }
      return this.savePlan(templateId, mode, {
        version: 1,
        enabled: true,
        startDate,
        defaults,
        dayOffsets: Object.fromEntries(
          source.days.map((day, index) => [
            'sourceTemplateDayId' in day
              ? (day.sourceTemplateDayId ?? day.id)
              : day.id,
            Math.min(6, index),
          ]),
        ),
        phases: [
          {
            id: 'phase-1',
            name: 'Strength + hypertrophy',
            startWeek: 1,
            endWeek: duration,
            overrides: {},
          },
        ],
        weeks: Array.from({ length: duration }, () => ({
          phaseId: 'phase-1',
          name: 'Training',
          overrides: {},
        })),
      })
    },
  }
}
export const periodizationRepository = createPeriodizationRepository()
