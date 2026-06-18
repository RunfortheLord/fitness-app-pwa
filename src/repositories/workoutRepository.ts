import { db, type TrainingLogDatabase } from '@db/database'
import { createId } from '@domain/ids'
import type { LocalDateString } from '@domain/dates'
import type {
  ActiveCycleWorkoutExercise,
  AppliedWorkoutChange,
  DetectedWorkoutChange,
  StructuralChangeDestination,
  Workout,
  WorkoutExercise,
  WorkoutHistoryEntry,
  WorkoutHistoryExercise,
  WorkoutHistorySet,
  WorkoutSet,
} from '@shared-types/app'

export type StartWorkoutInput = {
  activeCycleId: string
  dayId: string
  localDate: LocalDateString
}

export type CompleteWorkoutInput = {
  workoutId: string
  completedAt?: string
  detectedChanges?: Omit<
    DetectedWorkoutChange,
    | 'id'
    | 'workoutId'
    | 'selectedDestination'
    | 'appliedDestination'
    | 'status'
    | 'createdAt'
    | 'updatedAt'
  >[]
}

export type WorkoutRepositoryTestHooks = {
  afterWorkoutAdded?: () => void | Promise<void>
  afterHistoryAdded?: () => void | Promise<void>
  afterAppliedChangeAdded?: () => void | Promise<void>
}

export type StructuralChangeAppliers = {
  applyToActiveCycle?: (
    database: TrainingLogDatabase,
    change: DetectedWorkoutChange,
  ) => Promise<void>
  applyToTemplate?: (
    database: TrainingLogDatabase,
    change: DetectedWorkoutChange,
  ) => Promise<void>
}

export function createWorkoutRepository(
  database: TrainingLogDatabase = db,
  testHooks: WorkoutRepositoryTestHooks = {},
  structuralChangeAppliers: StructuralChangeAppliers = {},
) {
  return {
    async startWorkout(input: StartWorkoutInput) {
      const now = new Date().toISOString()
      return database.transaction(
        'rw',
        [
          database.activeProgramCycles,
          database.activeCycleWorkoutDays,
          database.activeCycleWorkoutExercises,
          database.programTemplates,
          database.workouts,
          database.workoutExercises,
          database.workoutSets,
        ],
        async () => {
          const cycle = await database.activeProgramCycles.get(
            input.activeCycleId,
          )
          const day = await database.activeCycleWorkoutDays.get(input.dayId)
          const template = cycle?.sourceTemplateId
            ? await database.programTemplates.get(cycle.sourceTemplateId)
            : undefined
          if (!cycle || !day || day.activeCycleId !== cycle.id) {
            throw new Error('Active cycle workout day was not found.')
          }

          const workout: Workout = {
            id: createId(),
            sourceActiveCycleId: cycle.id,
            sourceTemplateId: cycle.sourceTemplateId,
            sourceDayId: day.id,
            localDate: input.localDate,
            name: day.name,
            workoutSnapshot: {
              activeCycleName: cycle.name,
              templateName: template?.name ?? null,
              dayName: day.name,
              dayNotes: day.notes,
            },
            notes: '',
            startedAt: now,
            completedAt: null,
            durationSeconds: null,
            elapsedPausedSeconds: 0,
            activeRestTimer: null,
            status: 'active',
            createdAt: now,
            updatedAt: now,
          }
          await database.workouts.add(workout)
          await testHooks.afterWorkoutAdded?.()

          const sourceExercises = await database.activeCycleWorkoutExercises
            .where({ dayId: day.id })
            .sortBy('orderIndex')
          const workoutExercises: WorkoutExercise[] = []
          const workoutSets: WorkoutSet[] = []

          for (const sourceExercise of sourceExercises) {
            const workoutExercise = createWorkoutExercise(
              workout.id,
              sourceExercise,
              now,
            )
            workoutExercises.push(workoutExercise)
            await database.workoutExercises.add(workoutExercise)

            for (
              let setNumber = 1;
              setNumber <= sourceExercise.targetSetCount;
              setNumber += 1
            ) {
              const set: WorkoutSet = {
                id: createId(),
                workoutId: workout.id,
                workoutExerciseId: workoutExercise.id,
                setNumber,
                metricValues: {},
                rir: sourceExercise.targetRir,
                completed: false,
                completedAt: null,
                restSecondsUsed: sourceExercise.restSecondsOverride,
                createdAt: now,
                updatedAt: now,
              }
              workoutSets.push(set)
              await database.workoutSets.add(set)
            }
          }

          return { workout, exercises: workoutExercises, sets: workoutSets }
        },
      )
    },

    async completeWorkout(input: CompleteWorkoutInput) {
      const completedAt = input.completedAt ?? new Date().toISOString()
      return database.transaction(
        'rw',
        [
          database.workouts,
          database.workoutExercises,
          database.workoutSets,
          database.workoutHistoryEntries,
          database.workoutHistoryExercises,
          database.workoutHistorySets,
          database.detectedWorkoutChanges,
        ],
        async () => {
          const workout = await database.workouts.get(input.workoutId)
          if (!workout || workout.status !== 'active') {
            throw new Error(`Active workout ${input.workoutId} was not found.`)
          }

          const durationSeconds = Math.max(
            0,
            Math.round(
              (Date.parse(completedAt) - Date.parse(workout.startedAt)) / 1000,
            ) - workout.elapsedPausedSeconds,
          )
          const history: WorkoutHistoryEntry = {
            ...workout,
            status: 'completed',
            completedAt,
            durationSeconds,
            updatedAt: completedAt,
          }
          await database.workoutHistoryEntries.add(history)
          await testHooks.afterHistoryAdded?.()

          const exercises = await database.workoutExercises
            .where({ workoutId: workout.id })
            .toArray()
          const sets = await database.workoutSets
            .where({ workoutId: workout.id })
            .toArray()

          for (const exercise of exercises) {
            await database.workoutHistoryExercises.add({
              ...exercise,
            } satisfies WorkoutHistoryExercise)
          }
          for (const set of sets) {
            const historySet: WorkoutHistorySet = {
              id: set.id,
              workoutId: set.workoutId,
              workoutExerciseId: set.workoutExerciseId,
              setNumber: set.setNumber,
              metricValues: set.metricValues,
              rir: set.rir,
              completed: set.completed,
              completedAt: set.completedAt,
              restSecondsUsed: set.restSecondsUsed,
            }
            await database.workoutHistorySets.add(historySet)
          }

          const changes = (input.detectedChanges ?? []).map((change) => ({
            id: createId(),
            workoutId: workout.id,
            ...change,
            selectedDestination: 'neither' as const,
            appliedDestination: null,
            status: 'pending' as const,
            createdAt: completedAt,
            updatedAt: completedAt,
          }))
          await database.detectedWorkoutChanges.bulkAdd(changes)

          await database.workoutSets.where({ workoutId: workout.id }).delete()
          await database.workoutExercises
            .where({ workoutId: workout.id })
            .delete()
          await database.workouts.delete(workout.id)

          return { history, detectedChanges: changes }
        },
      )
    },

    async applyDetectedChange(
      changeId: string,
      destination: StructuralChangeDestination,
    ) {
      const now = new Date().toISOString()
      return database.transaction(
        'rw',
        [
          database.detectedWorkoutChanges,
          database.appliedWorkoutChanges,
          database.programTemplates,
          database.templateWorkoutDays,
          database.templateWorkoutExercises,
          database.activeProgramCycles,
          database.activeCycleWorkoutDays,
          database.activeCycleWorkoutExercises,
        ],
        async () => {
          const change = await database.detectedWorkoutChanges.get(changeId)
          if (!change) {
            throw new Error(
              `Detected workout change ${changeId} was not found.`,
            )
          }

          const applied: AppliedWorkoutChange = {
            id: createId(),
            detectedChangeId: change.id,
            workoutId: change.workoutId,
            destination,
            appliedAt: now,
            createdAt: now,
          }
          await database.appliedWorkoutChanges.add(applied)
          await testHooks.afterAppliedChangeAdded?.()

          if (destination === 'cycle_only' || destination === 'both') {
            await structuralChangeAppliers.applyToActiveCycle?.(
              database,
              change,
            )
          }
          if (destination === 'template_only' || destination === 'both') {
            await structuralChangeAppliers.applyToTemplate?.(database, change)
          }

          await database.detectedWorkoutChanges.put({
            ...change,
            selectedDestination: destination,
            appliedDestination: destination,
            status: destination === 'neither' ? 'rejected' : 'applied',
            updatedAt: now,
          })
          return applied
        },
      )
    },

    async getWorkoutHistoryStructure(workoutId: string) {
      const workout = await database.workoutHistoryEntries.get(workoutId)
      if (!workout) {
        throw new Error(`Workout history ${workoutId} was not found.`)
      }
      const exercises = await database.workoutHistoryExercises
        .where({ workoutId })
        .sortBy('orderIndex')
      const sets = await database.workoutHistorySets
        .where({ workoutId })
        .toArray()

      return {
        workout,
        exercises,
        setsByExercise: Object.fromEntries(
          exercises.map((exercise) => [
            exercise.id,
            sets
              .filter((set) => set.workoutExerciseId === exercise.id)
              .sort((first, second) => first.setNumber - second.setNumber),
          ]),
        ),
      }
    },
  }
}

function createWorkoutExercise(
  workoutId: string,
  sourceExercise: ActiveCycleWorkoutExercise,
  timestamp: string,
): WorkoutExercise {
  return {
    id: createId(),
    workoutId,
    exerciseId: sourceExercise.exerciseId,
    exerciseSnapshot: sourceExercise.exerciseSnapshot,
    sourcePrescribedExerciseId: sourceExercise.id,
    orderIndex: sourceExercise.orderIndex,
    notes: sourceExercise.notes,
    skipped: false,
    replacementOfExerciseId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export const workoutRepository = createWorkoutRepository()
