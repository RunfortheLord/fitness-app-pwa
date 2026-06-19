import { db, type TrainingLogDatabase } from '@db/database'
import { createId } from '@domain/ids'
import { snapshotExercise } from '@domain/snapshots'
import type { LocalDateString } from '@domain/dates'
import type {
  ActiveCycleWorkoutExercise,
  AppliedWorkoutChange,
  DetectedWorkoutChange,
  Exercise,
  RestTimerState,
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

export type WorkoutSetMetricValue = number | boolean | null

export type UpdateWorkoutSetInput = {
  metricValues?: Record<string, WorkoutSetMetricValue>
  rir?: number | null
  completed?: boolean
}

export type AddWorkoutExerciseInput = {
  workoutId: string
  exerciseId: string
  notes?: string
}

export type ReplaceWorkoutExerciseInput = {
  workoutExerciseId: string
  exerciseId: string
  keepCompatibleSetValues?: boolean
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
          const existingActive = await database.workouts
            .where({ status: 'active' })
            .first()
          if (existingActive) {
            throw new Error('An active workout already exists.')
          }

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

    async getActiveWorkoutStructure() {
      const workout = await database.workouts
        .where({ status: 'active' })
        .first()
      if (!workout) {
        return undefined
      }
      return this.getWorkoutStructure(workout.id)
    },

    async getWorkoutStructure(workoutId: string) {
      const workout = await database.workouts.get(workoutId)
      if (!workout || workout.status !== 'active') {
        throw new Error(`Active workout ${workoutId} was not found.`)
      }
      const exercises = await database.workoutExercises
        .where({ workoutId })
        .sortBy('orderIndex')
      const sets = await database.workoutSets.where({ workoutId }).toArray()

      return {
        workout,
        exercises,
        setsByExercise: mapSetsByExercise(exercises, sets),
      }
    },

    async getPreviousPerformance(exerciseId: string, beforeStartedAt: string) {
      const previousExercise = await database.workoutHistoryExercises
        .where({ exerciseId })
        .toArray()
        .then(async (historyExercises) => {
          const candidates = await Promise.all(
            historyExercises.map(async (exercise) => ({
              exercise,
              workout: await database.workoutHistoryEntries.get(
                exercise.workoutId,
              ),
            })),
          )
          return candidates
            .filter(
              (candidate) =>
                candidate.workout &&
                candidate.workout.completedAt < beforeStartedAt,
            )
            .sort((first, second) =>
              second.workout!.completedAt.localeCompare(
                first.workout!.completedAt,
              ),
            )[0]?.exercise
        })

      if (!previousExercise) {
        return []
      }

      return database.workoutHistorySets
        .where({ workoutExerciseId: previousExercise.id })
        .sortBy('setNumber')
    },

    async updateWorkoutNotes(workoutId: string, notes: string) {
      const now = new Date().toISOString()
      await database.workouts.update(workoutId, { notes, updatedAt: now })
    },

    async updateWorkoutExerciseNotes(workoutExerciseId: string, notes: string) {
      const now = new Date().toISOString()
      await database.workoutExercises.update(workoutExerciseId, {
        notes,
        updatedAt: now,
      })
    },

    async updateWorkoutSet(setId: string, input: UpdateWorkoutSetInput) {
      const now = new Date().toISOString()
      return database.transaction(
        'rw',
        [database.workouts, database.workoutSets],
        async () => {
          const set = await database.workoutSets.get(setId)
          if (!set) {
            throw new Error(`Workout set ${setId} was not found.`)
          }
          const completed = input.completed ?? set.completed
          const updated: WorkoutSet = {
            ...set,
            metricValues: input.metricValues ?? set.metricValues,
            rir: hasOwn(input, 'rir') ? (input.rir ?? null) : set.rir,
            completed,
            completedAt:
              completed && !set.completed
                ? now
                : completed
                  ? set.completedAt
                  : null,
            updatedAt: now,
          }
          await database.workoutSets.put(updated)
          await database.workouts.update(set.workoutId, { updatedAt: now })
          return updated
        },
      )
    },

    async addSet(workoutExerciseId: string) {
      const now = new Date().toISOString()
      return database.transaction(
        'rw',
        [database.workouts, database.workoutExercises, database.workoutSets],
        async () => {
          const exercise =
            await database.workoutExercises.get(workoutExerciseId)
          if (!exercise) {
            throw new Error(
              `Workout exercise ${workoutExerciseId} was not found.`,
            )
          }
          const existing = await database.workoutSets
            .where({ workoutExerciseId })
            .toArray()
          const set: WorkoutSet = {
            id: createId(),
            workoutId: exercise.workoutId,
            workoutExerciseId,
            setNumber: existing.length + 1,
            metricValues: {},
            rir: null,
            completed: false,
            completedAt: null,
            restSecondsUsed: null,
            createdAt: now,
            updatedAt: now,
          }
          await database.workoutSets.add(set)
          await database.workouts.update(exercise.workoutId, { updatedAt: now })
          return set
        },
      )
    },

    async deleteSet(setId: string) {
      const now = new Date().toISOString()
      await database.transaction(
        'rw',
        [database.workouts, database.workoutSets],
        async () => {
          const set = await database.workoutSets.get(setId)
          if (!set) {
            throw new Error(`Workout set ${setId} was not found.`)
          }
          await database.workoutSets.delete(setId)
          const remaining = await database.workoutSets
            .where({ workoutExerciseId: set.workoutExerciseId })
            .sortBy('setNumber')
          await Promise.all(
            remaining.map((remainingSet, index) =>
              database.workoutSets.update(remainingSet.id, {
                setNumber: index + 1,
                updatedAt: now,
              }),
            ),
          )
          await database.workouts.update(set.workoutId, { updatedAt: now })
        },
      )
    },

    async skipExercise(workoutExerciseId: string, skipped: boolean) {
      const now = new Date().toISOString()
      return database.transaction(
        'rw',
        [database.workouts, database.workoutExercises],
        async () => {
          const exercise =
            await database.workoutExercises.get(workoutExerciseId)
          if (!exercise) {
            throw new Error(
              `Workout exercise ${workoutExerciseId} was not found.`,
            )
          }
          const updated = { ...exercise, skipped, updatedAt: now }
          await database.workoutExercises.put(updated)
          await database.workouts.update(exercise.workoutId, { updatedAt: now })
          return updated
        },
      )
    },

    async addExercise(input: AddWorkoutExerciseInput) {
      const now = new Date().toISOString()
      return database.transaction(
        'rw',
        [
          database.workouts,
          database.workoutExercises,
          database.workoutSets,
          database.exercises,
        ],
        async () => {
          const workout = await database.workouts.get(input.workoutId)
          const exercise = await database.exercises.get(input.exerciseId)
          if (!workout || workout.status !== 'active') {
            throw new Error(`Active workout ${input.workoutId} was not found.`)
          }
          if (!exercise) {
            throw new Error(`Exercise ${input.exerciseId} was not found.`)
          }
          const existing = await database.workoutExercises
            .where({ workoutId: workout.id })
            .toArray()
          const workoutExercise = createWorkoutExerciseFromExercise(
            workout.id,
            exercise,
            existing.length,
            input.notes ?? '',
            now,
          )
          await database.workoutExercises.add(workoutExercise)
          await database.workouts.update(workout.id, { updatedAt: now })
          return workoutExercise
        },
      )
    },

    async replaceExercise(input: ReplaceWorkoutExerciseInput) {
      const now = new Date().toISOString()
      return database.transaction(
        'rw',
        [
          database.workouts,
          database.workoutExercises,
          database.workoutSets,
          database.exercises,
        ],
        async () => {
          const current = await database.workoutExercises.get(
            input.workoutExerciseId,
          )
          const replacement = await database.exercises.get(input.exerciseId)
          if (!current) {
            throw new Error(
              `Workout exercise ${input.workoutExerciseId} was not found.`,
            )
          }
          if (!replacement) {
            throw new Error(`Exercise ${input.exerciseId} was not found.`)
          }
          const previousExerciseId = current.exerciseId
          const updated: WorkoutExercise = {
            ...current,
            exerciseId: replacement.id,
            exerciseSnapshot: snapshotExercise(replacement),
            replacementOfExerciseId:
              current.replacementOfExerciseId ?? previousExerciseId,
            updatedAt: now,
          }
          await database.workoutExercises.put(updated)

          if (!input.keepCompatibleSetValues) {
            const allowedKeys = new Set(
              replacement.trackingMetrics.map((metric) => metric.key),
            )
            const sets = await database.workoutSets
              .where({ workoutExerciseId: current.id })
              .toArray()
            await Promise.all(
              sets.map((set) =>
                database.workoutSets.update(set.id, {
                  metricValues: Object.fromEntries(
                    Object.entries(set.metricValues).filter(([key]) =>
                      allowedKeys.has(key),
                    ),
                  ),
                  updatedAt: now,
                }),
              ),
            )
          }

          await database.workouts.update(current.workoutId, { updatedAt: now })
          return updated
        },
      )
    },

    async setRestTimer(workoutId: string, durationSeconds: number) {
      const now = new Date().toISOString()
      const timer: RestTimerState = {
        id: createId(),
        startedAt: now,
        durationSeconds,
        pausedAt: null,
        accumulatedPausedSeconds: 0,
        status: 'running',
      }
      await database.workouts.update(workoutId, {
        activeRestTimer: timer,
        updatedAt: now,
      })
      return timer
    },

    async pauseRestTimer(workoutId: string) {
      return updateRestTimer(database, workoutId, (timer, now) =>
        timer.status === 'running'
          ? { ...timer, pausedAt: now, status: 'paused' }
          : timer,
      )
    },

    async resumeRestTimer(workoutId: string) {
      return updateRestTimer(database, workoutId, (timer, now) => {
        if (timer.status !== 'paused' || !timer.pausedAt) {
          return timer
        }
        return {
          ...timer,
          accumulatedPausedSeconds:
            timer.accumulatedPausedSeconds +
            Math.max(
              0,
              Math.round((Date.parse(now) - Date.parse(timer.pausedAt)) / 1000),
            ),
          pausedAt: null,
          status: 'running',
        }
      })
    },

    async addRestTimerSeconds(workoutId: string, seconds: number) {
      return updateRestTimer(database, workoutId, (timer) => ({
        ...timer,
        durationSeconds: Math.max(0, timer.durationSeconds + seconds),
      }))
    },

    async dismissRestTimer(workoutId: string) {
      return updateRestTimer(database, workoutId, (timer) => ({
        ...timer,
        pausedAt: null,
        status: 'dismissed',
      }))
    },

    async cancelWorkout(workoutId: string) {
      await database.transaction(
        'rw',
        [database.workouts, database.workoutExercises, database.workoutSets],
        async () => {
          const workout = await database.workouts.get(workoutId)
          if (!workout || workout.status !== 'active') {
            throw new Error(`Active workout ${workoutId} was not found.`)
          }
          await database.workoutSets.where({ workoutId }).delete()
          await database.workoutExercises.where({ workoutId }).delete()
          await database.workouts.delete(workoutId)
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
          const exercises = await database.workoutExercises
            .where({ workoutId: workout.id })
            .toArray()
          const sets = await database.workoutSets
            .where({ workoutId: workout.id })
            .toArray()
          const hasPerformedWork = sets.some((set) => set.completed)
          const hasSkippedExercise = exercises.some(
            (exercise) => exercise.skipped,
          )
          if (!hasPerformedWork && !hasSkippedExercise) {
            throw new Error(
              'Complete at least one set or skip an exercise before finishing.',
            )
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

    getActiveWorkout() {
      return database.workouts.where({ status: 'active' }).first()
    },

    getMostRecentCompletedWorkout() {
      return database.workoutHistoryEntries
        .orderBy('completedAt')
        .reverse()
        .first()
    },

    listRecentCompletedWorkouts(limit = 5) {
      return database.workoutHistoryEntries
        .orderBy('completedAt')
        .reverse()
        .limit(limit)
        .toArray()
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

function createWorkoutExerciseFromExercise(
  workoutId: string,
  exercise: Exercise,
  orderIndex: number,
  notes: string,
  timestamp: string,
): WorkoutExercise {
  return {
    id: createId(),
    workoutId,
    exerciseId: exercise.id,
    exerciseSnapshot: snapshotExercise(exercise),
    sourcePrescribedExerciseId: null,
    orderIndex,
    notes,
    skipped: false,
    replacementOfExerciseId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function mapSetsByExercise(exercises: WorkoutExercise[], sets: WorkoutSet[]) {
  return Object.fromEntries(
    exercises.map((exercise) => [
      exercise.id,
      sets
        .filter((set) => set.workoutExerciseId === exercise.id)
        .sort((first, second) => first.setNumber - second.setNumber),
    ]),
  )
}

function hasOwn<T extends object, K extends PropertyKey>(
  value: T,
  key: K,
): value is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(value, key)
}

async function updateRestTimer(
  database: TrainingLogDatabase,
  workoutId: string,
  updater: (timer: RestTimerState, now: string) => RestTimerState,
) {
  const now = new Date().toISOString()
  return database.transaction('rw', database.workouts, async () => {
    const workout = await database.workouts.get(workoutId)
    if (!workout || workout.status !== 'active' || !workout.activeRestTimer) {
      throw new Error(
        `Active rest timer for workout ${workoutId} was not found.`,
      )
    }
    const activeRestTimer = updater(workout.activeRestTimer, now)
    await database.workouts.update(workoutId, {
      activeRestTimer,
      updatedAt: now,
    })
    return activeRestTimer
  })
}

export const workoutRepository = createWorkoutRepository()
