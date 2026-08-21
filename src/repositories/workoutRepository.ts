import { db, type TrainingLogDatabase } from '@db/database'
import {
  qualifiesForWorkoutHistory,
  type WorkoutHistoryStructure,
} from '@domain/historyDisplay'
import { createId } from '@domain/ids'
import { buildSetMetricPropagationUpdates } from '@domain/setPropagation'
import {
  buildSetRecommendation,
  createOriginalTargetSnapshot,
  evaluateNextWorkoutRecommendation,
  type NextWorkoutPerformance,
} from '@domain/progressionRecommendations'
import { snapshotExercise } from '@domain/snapshots'
import {
  currentProgramWeek,
  DEFAULT_PROGRAM_DURATION_WEEKS,
  deloadTargetRir,
  deloadTargetSetCount,
  isDeloadWeek,
  nextProgramWeekAfterCompletion,
} from '@domain/programWeeks'
import { updateRestTimerDuration } from '@domain/restTimer'
import {
  buildDeloadPrefillPlan,
  buildWorkoutPrefillPlan,
  loadMetricKey,
} from '@domain/workoutPrefill'
import { detectWorkoutStructuralChanges } from '@domain/workoutChanges'
import { canSkipWorkoutExercise } from '@domain/workoutSkip'
import {
  accumulatedWorkoutPauseSeconds,
  workoutElapsedSeconds,
} from '@domain/workoutTiming'
import type { LocalDateString } from '@domain/dates'
import type {
  ActiveCycleWorkoutExercise,
  AppliedWorkoutChange,
  DetectedWorkoutChange,
  Exercise,
  RestTimerState,
  StructuralChangeDestination,
  TemplateWorkoutExercise,
  TrackingMethodId,
  Workout,
  WorkoutExercise,
  WorkoutHistoryEntry,
  WorkoutHistoryExercise,
  WorkoutHistorySet,
  WorkoutSet,
  WorkoutSetTargetSnapshot,
  WorkoutAutofillMode,
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
    | 'failureReason'
    | 'createdAt'
    | 'updatedAt'
  >[]
}

export type WorkoutSetMetricValue = number | boolean | null

export type UpdateWorkoutSetInput = {
  metricValues?: Record<string, WorkoutSetMetricValue>
  metricValueSources?: NonNullable<WorkoutSet['metricValueSources']>
  rir?: number | null
  completed?: boolean
}

export type UpdateWorkoutSetTargetInput = {
  targetWeight?: number | null
  targetRepsMin?: number | null
  targetRepsMax?: number | null
  restoreOriginal?: boolean
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

export type UpdateLiveExercisePrescriptionInput = {
  workoutExerciseId: string
  targetSetCount: number
  targetRepsMin: number | null
  targetRepsMax: number | null
}

export type WorkoutRepositoryTestHooks = {
  afterWorkoutAdded?: () => void | Promise<void>
  afterHistoryAdded?: () => void | Promise<void>
  afterAppliedChangeAdded?: () => void | Promise<void>
  afterStructuralDestinationApplied?: () => void | Promise<void>
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
          database.userSettings,
          database.exercises,
          database.workouts,
          database.workoutExercises,
          database.workoutSets,
          database.runs,
          database.workoutHistoryEntries,
          database.workoutHistoryExercises,
          database.workoutHistorySets,
        ],
        async () => {
          const existingActive = await database.workouts
            .where({ status: 'active' })
            .first()
          if (existingActive) {
            throw new Error('An active workout already exists.')
          }
          const existingRun = await database.runs
            .where('status')
            .anyOf('active', 'paused')
            .first()
          if (existingRun) {
            throw new Error('An active run already exists.')
          }

          const cycle = await database.activeProgramCycles.get(
            input.activeCycleId,
          )
          const day = await database.activeCycleWorkoutDays.get(input.dayId)
          const template = cycle?.sourceTemplateId
            ? await database.programTemplates.get(cycle.sourceTemplateId)
            : undefined
          const settings = await database.userSettings.get('settings')
          const workoutAutofillMode =
            settings?.workoutAutofillMode ?? 'history_copy'
          const rirTrackingEnabled = settings?.rirTrackingEnabled ?? false
          if (!cycle || !day || day.activeCycleId !== cycle.id) {
            throw new Error('Active cycle workout day was not found.')
          }
          const programWeekNumber = Math.min(
            cycle.durationWeeks ?? DEFAULT_PROGRAM_DURATION_WEEKS,
            currentProgramWeek(cycle.currentWeekNumber, [], []),
          )
          const deload =
            (cycle.deloadSchedulingEnabled ?? false) &&
            isDeloadWeek(programWeekNumber, cycle.deloadWeekNumbers)
          const sessionRirEnabled = rirTrackingEnabled || deload

          const workout: Workout = {
            id: createId(),
            sourceActiveCycleId: cycle.id,
            sourceTemplateId: cycle.sourceTemplateId,
            sourceDayId: day.id,
            localDate: input.localDate,
            name: deload ? `Deload ${day.name}` : day.name,
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
            pausedAt: null,
            activeRestTimer: null,
            status: 'active',
            trackRirEverySet: cycle.trackRirEverySet ?? false,
            programWeekNumber,
            isDeload: deload,
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
            const currentExercise = await database.exercises.get(
              sourceExercise.exerciseId,
            )
            let exerciseSnapshot = sourceExercise.exerciseSnapshot
            if (currentExercise?.origin === 'built_in') {
              exerciseSnapshot = snapshotExercise(currentExercise)
            } else if (
              currentExercise &&
              sourceExercise.restSecondsOverride === null
            ) {
              exerciseSnapshot = {
                ...exerciseSnapshot,
                defaultRestSeconds: currentExercise.defaultRestSeconds,
              }
            }
            if (sourceExercise.restSecondsOverride !== null) {
              exerciseSnapshot = {
                ...exerciseSnapshot,
                defaultRestSeconds: sourceExercise.restSecondsOverride,
              }
            }
            const sourceForWorkout: ActiveCycleWorkoutExercise = {
              ...sourceExercise,
              exerciseSnapshot,
              targetSetCount: deload
                ? deloadTargetSetCount(sourceExercise.targetSetCount)
                : sourceExercise.targetSetCount,
              targetRir: deload
                ? deloadTargetRir(sourceExercise.targetRir)
                : sourceExercise.targetRir,
            }
            const workoutExercise = createWorkoutExercise(
              workout.id,
              sourceForWorkout,
              now,
            )
            workoutExercises.push(workoutExercise)
            await database.workoutExercises.add(workoutExercise)
            const trackingMethodId =
              sourceForWorkout.exerciseSnapshot.trackingMethodId
            const sameDayPreviousSets = await getPreviousCompletedExerciseSets({
              database,
              exerciseId: sourceForWorkout.exerciseId,
              exerciseName: sourceForWorkout.exerciseSnapshot.exerciseName,
              trackingMethodId,
              beforeStartedAt: now,
              sourceDayId: day.id,
              excludeDeload: deload,
            })
            const previousSets = sameDayPreviousSets.length
              ? sameDayPreviousSets
              : await getPreviousCompletedExerciseSets({
                  database,
                  exerciseId: sourceForWorkout.exerciseId,
                  exerciseName: sourceForWorkout.exerciseSnapshot.exerciseName,
                  trackingMethodId,
                  beforeStartedAt: now,
                  excludeDeload: deload,
                })
            const performancePrefill =
              deload && repBasedTrackingMethod(trackingMethodId)
                ? buildDeloadPrefillPlan({
                    previousSets: previousSets
                      .filter(
                        (set) =>
                          set.completed && set.metricValues.failed !== true,
                      )
                      .flatMap((set) => {
                        const reps = set.metricValues.reps
                        if (
                          typeof reps !== 'number' ||
                          !Number.isFinite(reps) ||
                          reps <= 0
                        ) {
                          return []
                        }
                        const metricKey = loadMetricKey(trackingMethodId)
                        const load = metricKey
                          ? set.metricValues[metricKey]
                          : null
                        if (
                          metricKey &&
                          (typeof load !== 'number' || !Number.isFinite(load))
                        ) {
                          return []
                        }
                        return [
                          {
                            id: set.id,
                            setNumber: set.setNumber,
                            load: typeof load === 'number' ? load : null,
                            reps,
                            rir: set.rir,
                          },
                        ]
                      }),
                    targetSetCount: sourceForWorkout.targetSetCount,
                    targetRepsMin: sourceForWorkout.targetRepsMin,
                    targetRepsMax: sourceForWorkout.targetRepsMax,
                    targetRir: sourceExercise.targetRir,
                    trackingMethodId,
                  })
                : workoutAutofillMode === 'smart_progression' &&
                    repBasedTrackingMethod(trackingMethodId)
                  ? buildWorkoutPrefillPlan({
                      previousSets: previousSets
                        .filter(
                          (set) =>
                            set.completed && set.metricValues.failed !== true,
                        )
                        .flatMap((set) => {
                          const reps = set.metricValues.reps
                          if (
                            typeof reps !== 'number' ||
                            !Number.isFinite(reps) ||
                            reps <= 0
                          ) {
                            return []
                          }
                          const metricKey = loadMetricKey(trackingMethodId)
                          const load = metricKey
                            ? set.metricValues[metricKey]
                            : null
                          if (
                            metricKey &&
                            (typeof load !== 'number' || !Number.isFinite(load))
                          ) {
                            return []
                          }
                          return [
                            {
                              id: set.id,
                              setNumber: set.setNumber,
                              load: typeof load === 'number' ? load : null,
                              reps,
                              rir: sessionRirEnabled ? set.rir : null,
                            },
                          ]
                        }),
                      targetSetCount: sourceForWorkout.targetSetCount,
                      targetRepsMin: sourceForWorkout.targetRepsMin,
                      targetRepsMax: sourceForWorkout.targetRepsMax,
                      targetRir: rirTrackingEnabled
                        ? sourceExercise.targetRir
                        : null,
                      trackingMethodId,
                      sameProgramDay: sameDayPreviousSets.length > 0,
                    })
                  : null

            for (
              let setNumber = 1;
              setNumber <= sourceForWorkout.targetSetCount;
              setNumber += 1
            ) {
              const originalTarget = createOriginalTargetSnapshot(
                sourceForWorkout,
                sourceForWorkout.exerciseSnapshot.trackingMethodId,
              )
              const plannedSet = performancePrefill?.sets[setNumber - 1]
              const metricKey = loadMetricKey(trackingMethodId)
              const prefill = plannedSet
                ? {
                    suggestedLoad: plannedSet.load,
                    sourceSetId: plannedSet.sourceSetId,
                    sourceSetNumber: plannedSet.sourceSetNumber,
                    metricValues: {
                      ...(metricKey && plannedSet.load !== null
                        ? { [metricKey]: plannedSet.load }
                        : {}),
                      reps: plannedSet.reps,
                    },
                  }
                : workoutAutofillMode === 'history_copy' ||
                    !repBasedTrackingMethod(trackingMethodId)
                  ? preloggedMetricValuesForSet({ previousSets, setNumber })
                  : null
              const set: WorkoutSet = {
                id: createId(),
                workoutId: workout.id,
                workoutExerciseId: workoutExercise.id,
                setNumber,
                targetSnapshot: originalTarget,
                targetRecommendation:
                  prefill?.suggestedLoad !== null &&
                  prefill?.suggestedLoad !== undefined &&
                  originalTarget
                    ? {
                        version: 1,
                        originalTarget,
                        suggestedTarget: {
                          ...originalTarget,
                          targetWeight: prefill.suggestedLoad,
                        },
                        userEditedTarget: null,
                        reason: performancePrefill?.loadProgressed
                          ? 'above_range_increase_difficulty'
                          : 'within_range_hold',
                        explanation: `${performancePrefill?.loadProgressed ? 'Progressed' : 'Estimated'} from your most recent ${sameDayPreviousSets.length ? 'same-day ' : ''}completed ${sourceForWorkout.exerciseSnapshot.exerciseName} set sequence.`,
                        sourceSetId: prefill.sourceSetId,
                        generatedAt: now,
                      }
                    : null,
                metricValues:
                  prefill?.metricValues ?? initialMetricValuesForSet(),
                metricValueSources: prefill
                  ? Object.fromEntries(
                      Object.keys(prefill.metricValues).map((key) => [
                        key,
                        'auto',
                      ]),
                    )
                  : {},
                // Current prescribed RIR is the estimate target. Historical RIR
                // informs load/repetition capacity but is not copied as though
                // it were the current workout's observed result.
                rir: !sessionRirEnabled
                  ? null
                  : workout.trackRirEverySet &&
                      sourceForWorkout.targetRir !== null
                    ? sourceForWorkout.targetRir +
                      (sourceForWorkout.targetSetCount - setNumber)
                    : setNumber === sourceForWorkout.targetSetCount
                      ? sourceForWorkout.targetRir
                      : null,
                completed: false,
                completedAt: null,
                restSecondsUsed: sourceForWorkout.restSecondsOverride,
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
      const sourcePrescriptions = await Promise.all(
        exercises.map(async (exercise) => [
          exercise.id,
          exercise.sourcePrescribedExerciseId
            ? await database.activeCycleWorkoutExercises
                .get(exercise.sourcePrescribedExerciseId)
                .then((source) =>
                  source && workout.isDeload
                    ? {
                        ...source,
                        targetSetCount: deloadTargetSetCount(
                          source.targetSetCount,
                        ),
                        targetRir: deloadTargetRir(source.targetRir),
                      }
                    : source,
                )
            : undefined,
        ]),
      )

      return {
        workout,
        exercises,
        setsByExercise: mapSetsByExercise(exercises, sets),
        sourcePrescriptionsByExercise: Object.fromEntries(
          sourcePrescriptions.filter(
            (entry): entry is [string, ActiveCycleWorkoutExercise] =>
              Boolean(entry[1]),
          ),
        ),
      }
    },

    async getPreviousPerformance(exerciseId: string, beforeStartedAt: string) {
      const exercise = await database.exercises.get(exerciseId)
      const previousExercise = await getPreviousCompletedExercise({
        database,
        exerciseId,
        exerciseName: exercise?.name ?? '',
        trackingMethodId: exercise?.trackingMethodId ?? 'weight_reps',
        beforeStartedAt,
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

    async pauseWorkout(workoutId: string, pausedAt = new Date().toISOString()) {
      return database.transaction('rw', database.workouts, async () => {
        const workout = await database.workouts.get(workoutId)
        if (!workout || workout.status !== 'active') {
          throw new Error(`Active workout ${workoutId} was not found.`)
        }
        if (workout.pausedAt) {
          return workout
        }
        const updated = { ...workout, pausedAt, updatedAt: pausedAt }
        await database.workouts.put(updated)
        return updated
      })
    },

    async resumeWorkout(
      workoutId: string,
      resumedAt = new Date().toISOString(),
    ) {
      return database.transaction('rw', database.workouts, async () => {
        const workout = await database.workouts.get(workoutId)
        if (!workout || workout.status !== 'active') {
          throw new Error(`Active workout ${workoutId} was not found.`)
        }
        if (!workout.pausedAt) {
          return workout
        }
        const updated = {
          ...workout,
          elapsedPausedSeconds: accumulatedWorkoutPauseSeconds(
            workout,
            resumedAt,
          ),
          pausedAt: null,
          updatedAt: resumedAt,
        }
        await database.workouts.put(updated)
        return updated
      })
    },

    async updateWorkoutExerciseNotes(workoutExerciseId: string, notes: string) {
      const now = new Date().toISOString()
      await database.workoutExercises.update(workoutExerciseId, {
        notes,
        updatedAt: now,
      })
    },

    async updateWorkoutExerciseDefaultRest(
      workoutExerciseId: string,
      defaultRestSeconds: number,
    ) {
      if (
        defaultRestSeconds < 0 ||
        !Number.isFinite(defaultRestSeconds) ||
        !Number.isInteger(defaultRestSeconds)
      ) {
        throw new Error('Default rest time must be a whole number of seconds.')
      }
      const now = new Date().toISOString()
      return database.transaction(
        'rw',
        [database.workouts, database.workoutExercises, database.workoutSets],
        async () => {
          const workoutExercise =
            await database.workoutExercises.get(workoutExerciseId)
          if (!workoutExercise) {
            throw new Error(
              `Workout exercise ${workoutExerciseId} was not found.`,
            )
          }
          const updated: WorkoutExercise = {
            ...workoutExercise,
            exerciseSnapshot: {
              ...workoutExercise.exerciseSnapshot,
              defaultRestSeconds,
            },
            updatedAt: now,
          }
          await database.workoutExercises.put(updated)
          const upcomingSets = await database.workoutSets
            .where({ workoutExerciseId })
            .filter((set) => !set.completed)
            .toArray()
          await database.workoutSets.bulkPut(
            upcomingSets.map((set) => ({
              ...set,
              restSecondsUsed: defaultRestSeconds,
              updatedAt: now,
            })),
          )
          await database.workouts.update(workoutExercise.workoutId, {
            updatedAt: now,
          })
          return updated
        },
      )
    },

    async updateWorkoutSet(setId: string, input: UpdateWorkoutSetInput) {
      const now = new Date().toISOString()
      return database.transaction(
        'rw',
        [
          database.workouts,
          database.workoutExercises,
          database.workoutSets,
          database.activeCycleWorkoutExercises,
          database.exercises,
        ],
        async () => {
          const set = await database.workoutSets.get(setId)
          if (!set) {
            throw new Error(`Workout set ${setId} was not found.`)
          }
          const completed = input.completed ?? set.completed
          const updated: WorkoutSet = {
            ...set,
            metricValues: input.metricValues
              ? { ...set.metricValues, ...input.metricValues }
              : set.metricValues,
            metricValueSources: input.metricValueSources
              ? {
                  ...(set.metricValueSources ?? {}),
                  ...input.metricValueSources,
                }
              : (set.metricValueSources ?? {}),
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
          await recomputeWorkoutExerciseRecommendations(
            database,
            updated.workoutExerciseId,
            now,
          )
          await database.workouts.update(set.workoutId, { updatedAt: now })
          return updated
        },
      )
    },

    async updateWorkoutSetMetricAndPropagate(
      setId: string,
      metricKey: string,
      value: WorkoutSetMetricValue,
    ) {
      const now = new Date().toISOString()
      return database.transaction(
        'rw',
        [
          database.workouts,
          database.workoutExercises,
          database.workoutSets,
          database.activeCycleWorkoutExercises,
          database.exercises,
        ],
        async () => {
          const set = await database.workoutSets.get(setId)
          if (!set) {
            throw new Error(`Workout set ${setId} was not found.`)
          }
          const exercise = await database.workoutExercises.get(
            set.workoutExerciseId,
          )
          if (!exercise) {
            throw new Error(
              `Workout exercise ${set.workoutExerciseId} was not found.`,
            )
          }
          if (exercise.skipped) {
            throw new Error('Skipped exercises cannot be edited.')
          }

          const allSets = await database.workoutSets
            .where({ workoutExerciseId: set.workoutExerciseId })
            .sortBy('setNumber')
          const updates = buildSetMetricPropagationUpdates({
            allSets,
            sourceSet: set,
            metricKey,
            value,
          })

          for (const update of updates) {
            await database.workoutSets.update(update.setId, {
              metricValues: update.metricValues,
              metricValueSources: update.metricValueSources,
              updatedAt: now,
            })
          }

          await recomputeWorkoutExerciseRecommendations(
            database,
            set.workoutExerciseId,
            now,
          )
          await database.workouts.update(set.workoutId, { updatedAt: now })
          return updates
        },
      )
    },

    async updateWorkoutSetTarget(
      setId: string,
      input: UpdateWorkoutSetTargetInput,
    ) {
      const now = new Date().toISOString()
      return database.transaction(
        'rw',
        [database.workouts, database.workoutSets],
        async () => {
          const set = await database.workoutSets.get(setId)
          if (!set) {
            throw new Error(`Workout set ${setId} was not found.`)
          }
          const recommendation = set.targetRecommendation
          if (!recommendation) {
            throw new Error('This set has no editable target recommendation.')
          }
          const original = recommendation.originalTarget
          const userEditedTarget: WorkoutSetTargetSnapshot | null =
            input.restoreOriginal
              ? null
              : {
                  ...original,
                  targetWeight:
                    input.targetWeight === undefined
                      ? original.targetWeight
                      : input.targetWeight,
                  targetRepsMin:
                    input.targetRepsMin === undefined
                      ? original.targetRepsMin
                      : input.targetRepsMin,
                  targetRepsMax:
                    input.targetRepsMax === undefined
                      ? original.targetRepsMax
                      : input.targetRepsMax,
                }
          const updated: WorkoutSet = {
            ...set,
            targetRecommendation: {
              ...recommendation,
              userEditedTarget,
              reason: userEditedTarget
                ? 'manual_target_retained'
                : recommendation.reason,
              generatedAt: now,
            },
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
        [
          database.workouts,
          database.workoutExercises,
          database.workoutSets,
          database.activeCycleWorkoutExercises,
          database.userSettings,
          database.exercises,
          database.workoutHistoryEntries,
          database.workoutHistoryExercises,
          database.workoutHistorySets,
        ],
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
            .sortBy('setNumber')
          const settings = await database.userSettings.get('settings')
          const workoutAutofillMode =
            settings?.workoutAutofillMode ?? 'history_copy'
          const rirTrackingEnabled = settings?.rirTrackingEnabled ?? false
          // Inherit the previous set's current values as "auto" so the new set
          // keeps receiving live propagation until edited manually. Reps step
          // down once so consecutive auto-filled sets are not duplicates.
          const previous = existing.at(-1)
          const inheritedValues: WorkoutSet['metricValues'] = {}
          const inheritedSources: NonNullable<
            WorkoutSet['metricValueSources']
          > = {}
          if (previous) {
            for (const [key, value] of Object.entries(previous.metricValues)) {
              if (value !== null && value !== undefined) {
                inheritedValues[key] =
                  workoutAutofillMode === 'smart_progression' &&
                  key === 'reps' &&
                  typeof value === 'number'
                    ? Math.max(1, value - 1)
                    : value
                inheritedSources[key] = 'auto'
              }
            }
          } else if (exercise.exerciseId) {
            const trackingMethodId = exercise.exerciseSnapshot.trackingMethodId
            const previousSets = await getPreviousCompletedExerciseSets({
              database,
              exerciseId: exercise.exerciseId,
              exerciseName: exercise.exerciseSnapshot.exerciseName,
              trackingMethodId,
              beforeStartedAt: now,
            })
            const prefill = initialAddedSetPrefill({
              previousSets,
              trackingMethodId,
              workoutAutofillMode,
              rirTrackingEnabled,
            })
            if (prefill) {
              Object.assign(inheritedValues, prefill)
              for (const key of Object.keys(prefill)) {
                inheritedSources[key] = 'auto'
              }
            }
          }
          const set: WorkoutSet = {
            id: createId(),
            workoutId: exercise.workoutId,
            workoutExerciseId,
            setNumber: existing.length + 1,
            targetSnapshot: null,
            targetRecommendation: null,
            metricValues: inheritedValues,
            metricValueSources: inheritedSources,
            rir: null,
            completed: false,
            completedAt: null,
            restSecondsUsed: previous?.restSecondsUsed ?? null,
            createdAt: now,
            updatedAt: now,
          }
          await database.workoutSets.add(set)
          await recomputeWorkoutExerciseRecommendations(
            database,
            workoutExerciseId,
            now,
          )
          await database.workouts.update(exercise.workoutId, { updatedAt: now })
          return set
        },
      )
    },

    async updateLiveExercisePrescription(
      input: UpdateLiveExercisePrescriptionInput,
    ) {
      validateLiveExercisePrescription(input)
      const now = new Date().toISOString()
      return database.transaction(
        'rw',
        [
          database.workouts,
          database.workoutExercises,
          database.workoutSets,
          database.activeCycleWorkoutExercises,
          database.exercises,
        ],
        async () => {
          const exercise = await database.workoutExercises.get(
            input.workoutExerciseId,
          )
          if (!exercise) {
            throw new Error(
              `Workout exercise ${input.workoutExerciseId} was not found.`,
            )
          }
          const workout = await database.workouts.get(exercise.workoutId)
          if (!workout || workout.status !== 'active') {
            throw new Error(
              `Active workout ${exercise.workoutId} was not found.`,
            )
          }

          const sets = await database.workoutSets
            .where({ workoutExerciseId: exercise.id })
            .sortBy('setNumber')
          const completedCount = sets.filter((set) => set.completed).length
          if (input.targetSetCount < completedCount) {
            throw new Error(
              `Set count cannot be lower than the ${completedCount} completed ${completedCount === 1 ? 'set' : 'sets'}.`,
            )
          }

          while (sets.length > input.targetSetCount) {
            const removableIndex = sets.findLastIndex((set) => !set.completed)
            if (removableIndex < 0) {
              break
            }
            const [removed] = sets.splice(removableIndex, 1)
            await database.workoutSets.delete(removed.id)
          }

          const trackingMethodId = exercise.exerciseSnapshot.trackingMethodId
          const fallbackWeight =
            sets.find((set) => set.targetSnapshot)?.targetSnapshot
              ?.targetWeight ?? null
          while (sets.length < input.targetSetCount) {
            sets.push({
              id: createId(),
              workoutId: workout.id,
              workoutExerciseId: exercise.id,
              setNumber: sets.length + 1,
              targetSnapshot: {
                trackingMethodId,
                targetWeight: fallbackWeight,
                targetRepsMin: input.targetRepsMin,
                targetRepsMax: input.targetRepsMax,
              },
              targetRecommendation: null,
              metricValues: {},
              metricValueSources: {},
              rir: null,
              completed: false,
              completedAt: null,
              restSecondsUsed: null,
              createdAt: now,
              updatedAt: now,
            })
          }

          for (const [index, set] of sets.entries()) {
            const targetSnapshot: WorkoutSetTargetSnapshot = {
              trackingMethodId,
              targetWeight: set.targetSnapshot?.targetWeight ?? fallbackWeight,
              targetRepsMin: input.targetRepsMin,
              targetRepsMax: input.targetRepsMax,
            }
            const updatedSet: WorkoutSet = {
              ...set,
              setNumber: index + 1,
              targetSnapshot,
              targetRecommendation: set.targetRecommendation
                ? {
                    ...set.targetRecommendation,
                    userEditedTarget: targetSnapshot,
                    reason: 'manual_target_retained',
                    generatedAt: now,
                  }
                : null,
              updatedAt: now,
            }
            sets[index] = updatedSet
            await database.workoutSets.put(updatedSet)
          }

          const updatedExercise: WorkoutExercise = {
            ...exercise,
            sessionTargetRepsMin: input.targetRepsMin,
            sessionTargetRepsMax: input.targetRepsMax,
            updatedAt: now,
          }
          await database.workoutExercises.put(updatedExercise)
          await recomputeWorkoutExerciseRecommendations(
            database,
            exercise.id,
            now,
          )
          await database.workouts.update(workout.id, { updatedAt: now })
          return { exercise: updatedExercise, sets }
        },
      )
    },

    async deleteSet(setId: string) {
      const now = new Date().toISOString()
      await database.transaction(
        'rw',
        [
          database.workouts,
          database.workoutExercises,
          database.workoutSets,
          database.activeCycleWorkoutExercises,
          database.exercises,
        ],
        async () => {
          const set = await database.workoutSets.get(setId)
          if (!set) {
            return
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
          await recomputeWorkoutExerciseRecommendations(
            database,
            set.workoutExerciseId,
            now,
          )
          await database.workouts.update(set.workoutId, { updatedAt: now })
        },
      )
    },

    async skipExercise(workoutExerciseId: string, skipped: boolean) {
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
          if (skipped) {
            const sets = await database.workoutSets
              .where({ workoutExerciseId })
              .toArray()
            if (!canSkipWorkoutExercise(sets, exercise.skipped)) {
              throw new Error('A fully completed exercise cannot be skipped.')
            }
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
          database.userSettings,
          database.workoutHistoryEntries,
          database.workoutHistoryExercises,
          database.workoutHistorySets,
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
          if (existing.some((item) => item.exerciseId === exercise.id)) {
            throw new Error('That exercise is already in this workout.')
          }
          const workoutExercise = createWorkoutExerciseFromExercise(
            workout.id,
            exercise,
            existing.length,
            input.notes ?? '',
            now,
          )
          await database.workoutExercises.add(workoutExercise)
          const set = await createInitialLiveExerciseSet({
            database,
            workout,
            workoutExercise,
            timestamp: now,
          })
          await database.workoutSets.add(set)
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
          database.workoutHistoryEntries,
          database.workoutHistoryExercises,
          database.workoutHistorySets,
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
          const workout = await database.workouts.get(current.workoutId)
          if (!workout || workout.status !== 'active') {
            throw new Error(
              `Active workout ${current.workoutId} was not found.`,
            )
          }
          const previousExerciseId = current.exerciseId
          const updated: WorkoutExercise = {
            ...current,
            exerciseId: replacement.id,
            exerciseSnapshot: snapshotExercise(replacement),
            replacementOfExerciseId:
              current.replacementOfExerciseId ?? previousExerciseId,
            sessionTargetRepsMin: null,
            sessionTargetRepsMax: null,
            updatedAt: now,
          }
          await database.workoutExercises.put(updated)

          if (!input.keepCompatibleSetValues) {
            const sets = await database.workoutSets
              .where({ workoutExerciseId: current.id })
              .sortBy('setNumber')
            const replacementSets = await createLiveExerciseSetsFromHistory({
              database,
              workout,
              workoutExercise: updated,
              fallbackSetCount: Math.max(1, sets.length),
              timestamp: now,
            })
            await database.workoutSets
              .where({ workoutExerciseId: current.id })
              .delete()
            await database.workoutSets.bulkAdd(replacementSets)
          }

          await database.workouts.update(current.workoutId, { updatedAt: now })
          return updated
        },
      )
    },

    async removeExerciseFromLiveWorkout(workoutExerciseId: string) {
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
          await database.workoutSets.where({ workoutExerciseId }).delete()
          await database.workoutExercises.delete(workoutExerciseId)
          await reindexWorkoutExercises(database, exercise.workoutId, now)
          await database.workouts.update(exercise.workoutId, { updatedAt: now })
        },
      )
    },

    async reorderWorkoutExercises(
      workoutId: string,
      orderedWorkoutExerciseIds: string[],
    ) {
      const now = new Date().toISOString()
      await database.transaction(
        'rw',
        [database.workouts, database.workoutExercises],
        async () => {
          const workout = await database.workouts.get(workoutId)
          if (!workout || workout.status !== 'active') {
            throw new Error(`Active workout ${workoutId} was not found.`)
          }
          const exercises = await database.workoutExercises
            .where({ workoutId })
            .toArray()
          assertSameIds(
            exercises.map((exercise) => exercise.id),
            orderedWorkoutExerciseIds,
            'Workout exercise order did not match existing exercises.',
          )
          await Promise.all(
            orderedWorkoutExerciseIds.map((id, orderIndex) =>
              database.workoutExercises.update(id, {
                orderIndex,
                updatedAt: now,
              }),
            ),
          )
          await database.workouts.update(workoutId, { updatedAt: now })
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
      return updateRestTimer(database, workoutId, (timer, now) => {
        if (timer.status === 'completed' && seconds > 0) {
          return {
            ...timer,
            startedAt: now,
            durationSeconds: seconds,
            pausedAt: null,
            accumulatedPausedSeconds: 0,
            status: 'running',
          }
        }
        return {
          ...timer,
          durationSeconds: Math.max(0, timer.durationSeconds + seconds),
        }
      })
    },

    async setRestTimerDuration(workoutId: string, durationSeconds: number) {
      return updateRestTimer(database, workoutId, (timer, now) =>
        updateRestTimerDuration(timer, durationSeconds, now),
      )
    },

    async completeRestTimer(workoutId: string) {
      return updateRestTimer(database, workoutId, (timer) =>
        timer.status === 'running'
          ? { ...timer, pausedAt: null, status: 'completed' }
          : timer,
      )
    },

    async dismissRestTimer(workoutId: string) {
      const now = new Date().toISOString()
      return database.transaction('rw', database.workouts, async () => {
        const workout = await database.workouts.get(workoutId)
        if (!workout || workout.status !== 'active') {
          throw new Error(`Active workout ${workoutId} was not found.`)
        }
        if (!workout.activeRestTimer) {
          return null
        }
        const activeRestTimer: RestTimerState = {
          ...workout.activeRestTimer,
          pausedAt: null,
          status: 'dismissed',
        }
        await database.workouts.update(workoutId, {
          activeRestTimer,
          updatedAt: now,
        })
        return activeRestTimer
      })
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
          await Promise.all([
            database.workoutSets.where({ workoutId }).delete(),
            database.workoutExercises.where({ workoutId }).delete(),
          ])
          await database.workouts.delete(workoutId)
        },
      )
    },

    async discardWorkout(workoutId: string) {
      return this.cancelWorkout(workoutId)
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
          database.activeCycleWorkoutDays,
          database.activeCycleWorkoutExercises,
          database.activeProgramCycles,
          database.activeCycleDayChecks,
          database.exercises,
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
          const hasPerformedWork = sets.some(
            (set) =>
              set.completed ||
              set.rir !== null ||
              Object.values(set.metricValues).some(
                (value) => value !== null && value !== undefined,
              ),
          )
          const hasSkippedExercise = exercises.some(
            (exercise) => exercise.skipped,
          )
          if (!hasPerformedWork && !hasSkippedExercise) {
            throw new Error(
              'Record at least one set or skip an exercise before finishing.',
            )
          }

          const elapsedPausedSeconds = accumulatedWorkoutPauseSeconds(
            workout,
            completedAt,
          )
          const durationSeconds = workoutElapsedSeconds(
            {
              ...workout,
              elapsedPausedSeconds,
              pausedAt: null,
            },
            completedAt,
          )
          const history: WorkoutHistoryEntry = {
            ...workout,
            status: 'completed',
            completedAt,
            durationSeconds,
            elapsedPausedSeconds,
            pausedAt: null,
            updatedAt: completedAt,
          }
          await database.workoutHistoryEntries.add(history)
          await testHooks.afterHistoryAdded?.()

          await database.workoutHistoryExercises.bulkAdd(
            exercises.map(
              (exercise) => ({ ...exercise }) satisfies WorkoutHistoryExercise,
            ),
          )
          await database.workoutHistorySets.bulkAdd(
            sets.map((set) => {
              const historySet: WorkoutHistorySet = {
                id: set.id,
                workoutId: set.workoutId,
                workoutExerciseId: set.workoutExerciseId,
                setNumber: set.setNumber,
                targetSnapshot: set.targetSnapshot ?? null,
                targetRecommendation: set.targetRecommendation ?? null,
                metricValues: set.metricValues,
                metricValueSources: set.metricValueSources ?? {},
                rir: set.rir,
                completed: set.completed,
                completedAt: set.completedAt,
                restSecondsUsed: set.restSecondsUsed,
              }
              return historySet
            }),
          )

          const storedSourceExercises = workout.sourceDayId
            ? await database.activeCycleWorkoutExercises
                .where({ dayId: workout.sourceDayId })
                .toArray()
            : []
          const sourceExercises = workout.isDeload
            ? storedSourceExercises.map((source) => ({
                ...source,
                targetSetCount: deloadTargetSetCount(source.targetSetCount),
                targetRir: deloadTargetRir(source.targetRir),
              }))
            : storedSourceExercises
          const detectedDrafts: NonNullable<
            CompleteWorkoutInput['detectedChanges']
          > = input.detectedChanges
            ? [...input.detectedChanges]
            : detectWorkoutStructuralChanges({
                sourceExercises,
                workout,
                performedExercises: exercises,
                performedSetsByExercise: mapSetsByExercise(exercises, sets),
              })
          if (!input.detectedChanges && !workout.isDeload) {
            detectedDrafts.push(
              ...(await detectProgressionRecommendationChanges(
                database,
                history,
                exercises,
                sets,
                sourceExercises,
              )),
            )
          }

          const changes = detectedDrafts.map((change) => ({
            id: createId(),
            workoutId: workout.id,
            ...change,
            selectedDestination: 'neither' as const,
            appliedDestination: null,
            status: 'pending' as const,
            failureReason: null,
            createdAt: completedAt,
            updatedAt: completedAt,
          }))
          await database.detectedWorkoutChanges.bulkAdd(changes)

          // Check the program day off for the week snapshotted at start. If it
          // is still selected, completing every day advances to the next
          // incomplete higher week without clearing any check history.
          if (workout.sourceActiveCycleId && workout.sourceDayId) {
            const cycle = await database.activeProgramCycles.get(
              workout.sourceActiveCycleId,
            )
            if (cycle && cycle.status === 'active') {
              const cycleDays = await database.activeCycleWorkoutDays
                .where({ activeCycleId: cycle.id })
                .toArray()
              const cycleChecks = await database.activeCycleDayChecks
                .where({ activeCycleId: cycle.id })
                .toArray()
              const weekNumber =
                workout.programWeekNumber ??
                currentProgramWeek(
                  cycle.currentWeekNumber,
                  cycleChecks,
                  cycleDays.map((day) => day.id),
                )
              const existing = await database.activeCycleDayChecks
                .where('[activeCycleId+dayId+weekNumber]')
                .equals([cycle.id, workout.sourceDayId, weekNumber])
                .first()
              if (existing) {
                if (!existing.checked) {
                  await database.activeCycleDayChecks.put({
                    ...existing,
                    checked: true,
                    updatedAt: completedAt,
                  })
                }
              } else {
                await database.activeCycleDayChecks.add({
                  id: createId(),
                  activeCycleId: cycle.id,
                  dayId: workout.sourceDayId,
                  weekNumber,
                  checked: true,
                  createdAt: completedAt,
                  updatedAt: completedAt,
                })
              }
              const updatedChecks = await database.activeCycleDayChecks
                .where({ activeCycleId: cycle.id })
                .toArray()
              const selectedWeekNumber = currentProgramWeek(
                cycle.currentWeekNumber,
                updatedChecks,
                cycleDays.map((day) => day.id),
              )
              const nextWeekNumber =
                selectedWeekNumber === weekNumber
                  ? nextProgramWeekAfterCompletion({
                      checks: updatedChecks,
                      dayIds: cycleDays.map((day) => day.id),
                      durationWeeks:
                        cycle.durationWeeks ?? DEFAULT_PROGRAM_DURATION_WEEKS,
                      weekNumber,
                    })
                  : selectedWeekNumber
              if (nextWeekNumber !== selectedWeekNumber) {
                await database.activeProgramCycles.update(cycle.id, {
                  currentWeekNumber: nextWeekNumber,
                  updatedAt: completedAt,
                })
              }
            }
          }

          await database.workoutSets.where({ workoutId: workout.id }).delete()
          await database.workoutExercises
            .where({ workoutId: workout.id })
            .delete()
          await database.workouts.delete(workout.id)

          return { history, detectedChanges: changes }
        },
      )
    },

    async resumeCompletedWorkout(workoutId: string) {
      const now = new Date().toISOString()
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
          database.appliedWorkoutChanges,
        ],
        async () => {
          const existingActive = await database.workouts
            .where({ status: 'active' })
            .first()
          if (existingActive) {
            throw new Error('Discard or finish the active workout first.')
          }
          const history = await database.workoutHistoryEntries.get(workoutId)
          if (!history) {
            throw new Error(`Workout history ${workoutId} was not found.`)
          }
          const appliedChange = await database.appliedWorkoutChanges
            .where({ workoutId })
            .filter((change) => change.destination !== 'neither')
            .first()
          if (appliedChange) {
            throw new Error(
              'Applied workout changes must stay in history. Delete or adjust the program manually instead of resuming this workout.',
            )
          }
          const exercises = await database.workoutHistoryExercises
            .where({ workoutId })
            .toArray()
          const sets = await database.workoutHistorySets
            .where({ workoutId })
            .toArray()
          const workout: Workout = {
            ...history,
            status: 'active',
            completedAt: null,
            pausedAt: null,
            updatedAt: now,
          }
          await database.workouts.put(workout)
          await database.workoutExercises.bulkPut(exercises)
          await database.workoutSets.bulkPut(
            sets.map((set) => ({
              ...set,
              createdAt: now,
              updatedAt: now,
            })),
          )
          const changes = await database.detectedWorkoutChanges
            .where({ workoutId })
            .toArray()
          await database.appliedWorkoutChanges
            .where('detectedChangeId')
            .anyOf(changes.map((change) => change.id))
            .delete()
          await database.detectedWorkoutChanges.where({ workoutId }).delete()
          await database.workoutHistorySets.where({ workoutId }).delete()
          await database.workoutHistoryExercises.where({ workoutId }).delete()
          await database.workoutHistoryEntries.delete(workoutId)
          return workout
        },
      )
    },

    async applyDetectedChanges(
      selections: Array<{
        changeId: string
        destination: StructuralChangeDestination
      }>,
    ) {
      const now = new Date().toISOString()
      try {
        return await database.transaction(
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
            database.workoutHistoryEntries,
            database.workoutHistoryExercises,
            database.workoutHistorySets,
            database.exercises,
          ],
          async () => {
            const appliedRecords: AppliedWorkoutChange[] = []
            for (const selection of selections) {
              const change = await database.detectedWorkoutChanges.get(
                selection.changeId,
              )
              if (!change) {
                throw new Error(
                  `Detected workout change ${selection.changeId} was not found.`,
                )
              }
              if (change.status !== 'pending') {
                continue
              }
              await applySingleDetectedChange(
                change,
                selection.destination,
                now,
              )
              const applied: AppliedWorkoutChange = {
                id: createId(),
                detectedChangeId: change.id,
                workoutId: change.workoutId,
                destination: selection.destination,
                appliedAt: now,
                createdAt: now,
              }
              await database.appliedWorkoutChanges.add(applied)
              await testHooks.afterAppliedChangeAdded?.()
              await database.detectedWorkoutChanges.put({
                ...change,
                selectedDestination: selection.destination,
                appliedDestination: selection.destination,
                status:
                  selection.destination === 'neither' ? 'rejected' : 'applied',
                failureReason: null,
                updatedAt: now,
              })
              appliedRecords.push(applied)
            }
            return appliedRecords
          },
        )
      } catch (caught) {
        const failureReason =
          caught instanceof Error
            ? caught.message
            : 'Change application failed.'
        await Promise.all(
          selections.map((selection) =>
            database.detectedWorkoutChanges.update(selection.changeId, {
              selectedDestination: selection.destination,
              status: 'failed',
              failureReason,
              updatedAt: now,
            }),
          ),
        )
        throw caught
      }

      async function applySingleDetectedChange(
        change: DetectedWorkoutChange,
        destination: StructuralChangeDestination,
        appliedAt: string,
      ) {
        if (destination === 'neither') {
          return
        }
        if (destination === 'cycle_only' || destination === 'both') {
          if (structuralChangeAppliers.applyToActiveCycle) {
            await structuralChangeAppliers.applyToActiveCycle(database, change)
          } else {
            await applyChangeToActiveCycle(database, change, appliedAt)
          }
          await testHooks.afterStructuralDestinationApplied?.()
        }
        if (destination === 'template_only' || destination === 'both') {
          if (structuralChangeAppliers.applyToTemplate) {
            await structuralChangeAppliers.applyToTemplate(database, change)
          } else {
            await applyChangeToTemplate(database, change, appliedAt)
          }
          await testHooks.afterStructuralDestinationApplied?.()
        }
      }
    },

    async applyDetectedChange(
      changeId: string,
      destination: StructuralChangeDestination,
    ) {
      const applied = await this.applyDetectedChanges([
        { changeId, destination },
      ])
      return applied[0]
    },

    async listDetectedChanges(workoutId: string) {
      return database.detectedWorkoutChanges
        .where({ workoutId })
        .sortBy('createdAt')
    },

    async updateWorkoutHistoryNotes(workoutId: string, notes: string) {
      const now = new Date().toISOString()
      const updated = await database.workoutHistoryEntries.update(workoutId, {
        notes,
        updatedAt: now,
      })
      if (!updated) {
        throw new Error(`Workout history ${workoutId} was not found.`)
      }
    },

    async updateWorkoutHistoryExerciseNotes(
      workoutExerciseId: string,
      notes: string,
    ) {
      const now = new Date().toISOString()
      return database.transaction(
        'rw',
        [database.workoutHistoryEntries, database.workoutHistoryExercises],
        async () => {
          const exercise =
            await database.workoutHistoryExercises.get(workoutExerciseId)
          if (!exercise) {
            throw new Error(
              `Workout history exercise ${workoutExerciseId} was not found.`,
            )
          }
          await database.workoutHistoryExercises.update(workoutExerciseId, {
            notes,
            updatedAt: now,
          })
          await database.workoutHistoryEntries.update(exercise.workoutId, {
            updatedAt: now,
          })
        },
      )
    },

    async updateWorkoutHistorySet(setId: string, input: UpdateWorkoutSetInput) {
      const now = new Date().toISOString()
      return database.transaction(
        'rw',
        [database.workoutHistoryEntries, database.workoutHistorySets],
        async () => {
          const set = await database.workoutHistorySets.get(setId)
          if (!set) {
            throw new Error(`Workout history set ${setId} was not found.`)
          }
          const updated: WorkoutHistorySet = {
            ...set,
            metricValues: input.metricValues ?? set.metricValues,
            rir: hasOwn(input, 'rir') ? (input.rir ?? null) : set.rir,
            completed: input.completed ?? set.completed,
          }
          await database.workoutHistorySets.put(updated)
          await database.workoutHistoryEntries.update(set.workoutId, {
            updatedAt: now,
          })
          return updated
        },
      )
    },

    async getWorkoutHistoryStructure(workoutId: string) {
      return loadWorkoutHistoryStructure(database, workoutId)
    },

    getActiveWorkout() {
      return database.workouts.where({ status: 'active' }).first()
    },

    async getMostRecentCompletedWorkout() {
      const workouts = await this.listRecentCompletedWorkouts(1)
      return workouts[0]
    },

    async listRecentCompletedWorkouts(limit = 5) {
      const workouts = await database.workoutHistoryEntries.toArray()
      const structures = await Promise.all(
        workouts.map((workout) =>
          loadWorkoutHistoryStructure(database, workout.id),
        ),
      )
      return structures
        .filter(qualifiesForWorkoutHistory)
        .map((structure) => structure.workout)
        .sort(
          (first, second) =>
            second.localDate.localeCompare(first.localDate) ||
            second.completedAt.localeCompare(first.completedAt),
        )
        .slice(0, limit)
    },

    async deleteWorkoutHistory(workoutId: string) {
      await database.transaction(
        'rw',
        [
          database.workoutHistoryEntries,
          database.workoutHistoryExercises,
          database.workoutHistorySets,
          database.detectedWorkoutChanges,
          database.appliedWorkoutChanges,
        ],
        async () => {
          const workout = await database.workoutHistoryEntries.get(workoutId)
          if (!workout) {
            throw new Error(`Workout history ${workoutId} was not found.`)
          }
          await database.workoutHistorySets.where({ workoutId }).delete()
          await database.workoutHistoryExercises.where({ workoutId }).delete()
          await database.detectedWorkoutChanges.where({ workoutId }).delete()
          await database.appliedWorkoutChanges.where({ workoutId }).delete()
          await database.workoutHistoryEntries.delete(workoutId)
        },
      )
    },
  }
}

async function recomputeWorkoutExerciseRecommendations(
  database: TrainingLogDatabase,
  workoutExerciseId: string,
  generatedAt: string,
) {
  const exercise = await database.workoutExercises.get(workoutExerciseId)
  if (!exercise) {
    return
  }
  const prescription = exercise.sourcePrescribedExerciseId
    ? await database.activeCycleWorkoutExercises.get(
        exercise.sourcePrescribedExerciseId,
      )
    : undefined
  const exerciseRecord = exercise.exerciseId
    ? await database.exercises.get(exercise.exerciseId)
    : undefined
  const sets = await database.workoutSets
    .where({ workoutExerciseId })
    .sortBy('setNumber')
  const programmedSets = sets.filter(
    (set) => prescription && set.setNumber <= prescription.targetSetCount,
  )

  for (const set of programmedSets) {
    if (set.completed) {
      continue
    }
    const sourceSet = [...programmedSets]
      .filter((candidate) => candidate.setNumber < set.setNumber)
      .reverse()
      .find((candidate) => candidate.completed)
    const userEditedTarget = set.targetRecommendation?.userEditedTarget ?? null
    const originalTarget =
      set.targetRecommendation?.originalTarget ??
      set.targetSnapshot ??
      createOriginalTargetSnapshot(
        prescription,
        exercise.exerciseSnapshot.trackingMethodId,
      )
    const targetRecommendation = sourceSet
      ? buildSetRecommendation({
          trackingMethodId: exercise.exerciseSnapshot.trackingMethodId,
          exerciseName: exercise.exerciseSnapshot.exerciseName,
          sourceSet,
          nextSet: set,
          originalTarget,
          userEditedTarget,
          increment: exerciseRecord?.defaultWeightIncrement,
          generatedAt,
          exerciseSkipped: exercise.skipped,
        })
      : userEditedTarget && originalTarget
        ? {
            version: 1 as const,
            originalTarget,
            suggestedTarget: null,
            userEditedTarget,
            reason: 'manual_target_retained' as const,
            explanation:
              'Your edited target is retained; no completed source set currently drives a suggestion.',
            sourceSetId: null,
            generatedAt,
          }
        : set.targetRecommendation?.sourceSetId === null
          ? set.targetRecommendation
          : null
    await database.workoutSets.update(set.id, {
      targetRecommendation,
      updatedAt: generatedAt,
    })
  }
}

function initialMetricValuesForSet() {
  return {}
}

async function detectProgressionRecommendationChanges(
  database: TrainingLogDatabase,
  workout: WorkoutHistoryEntry,
  exercises: WorkoutExercise[],
  sets: WorkoutSet[],
  sourceExercises: ActiveCycleWorkoutExercise[],
): Promise<NonNullable<CompleteWorkoutInput['detectedChanges']>> {
  const sourceById = new Map(
    sourceExercises.map((source) => [source.id, source]),
  )
  type DetectedChangeDraft = NonNullable<
    CompleteWorkoutInput['detectedChanges']
  >[number]
  const results: Array<DetectedChangeDraft | null> = await Promise.all(
    exercises.map(async (exercise) => {
      if (!exercise.sourcePrescribedExerciseId || !exercise.exerciseId) {
        return null
      }
      const currentPrescription = sourceById.get(
        exercise.sourcePrescribedExerciseId,
      )
      if (!currentPrescription) {
        return null
      }
      const exerciseRecord = await database.exercises.get(exercise.exerciseId)
      const currentPerformance: NextWorkoutPerformance = {
        workout,
        exercise,
        prescription: currentPrescription,
        sets: sets
          .filter((set) => set.workoutExerciseId === exercise.id)
          .sort((left, right) => left.setNumber - right.setNumber),
      }
      const previousPerformance = await findPreviousComparablePerformance(
        database,
        currentPerformance,
      )
      const recommendation = evaluateNextWorkoutRecommendation({
        current: currentPerformance,
        previous: previousPerformance,
        increment: exerciseRecord?.defaultWeightIncrement,
      })
      if (
        !recommendation.materialChange ||
        recommendation.recommendedTargetWeight === null
      ) {
        return null
      }
      return {
        type: 'progression_recommendation',
        description: recommendation.description,
        sourcePath: repositorySourceExercisePath(workout, currentPrescription),
        performedPath: `workout:${workout.id};exercise:${exercise.id};recommendedWeight:${recommendation.recommendedTargetWeight}`,
        recommendationReason: recommendation.reason,
        recommendationSummary: recommendation.summary,
      } satisfies DetectedChangeDraft
    }),
  )

  return results.filter(
    (result): result is DetectedChangeDraft => result !== null,
  )
}

function repositorySourceExercisePath(
  workout: Workout,
  exercise: ActiveCycleWorkoutExercise,
) {
  return `cycle:${workout.sourceActiveCycleId ?? ''};day:${exercise.dayId};exercise:${exercise.id};template:${workout.sourceTemplateId ?? ''};templateExercise:${exercise.sourceTemplateExerciseId ?? ''}`
}

async function findPreviousComparablePerformance(
  database: TrainingLogDatabase,
  current: NextWorkoutPerformance,
): Promise<NextWorkoutPerformance | undefined> {
  const exerciseId = current.exercise.exerciseId
  if (!exerciseId) {
    return undefined
  }
  const historyExercises = await database.workoutHistoryExercises
    .where({ exerciseId })
    .toArray()
  const candidates = await Promise.all(
    historyExercises
      .filter(
        (exercise) =>
          exercise.workoutId !== current.workout.id &&
          exercise.exerciseSnapshot.trackingMethodId ===
            current.exercise.exerciseSnapshot.trackingMethodId,
      )
      .map(async (exercise) => ({
        exercise,
        workout: await database.workoutHistoryEntries.get(exercise.workoutId),
        sets: await database.workoutHistorySets
          .where({ workoutExerciseId: exercise.id })
          .sortBy('setNumber'),
        prescription: exercise.sourcePrescribedExerciseId
          ? await database.activeCycleWorkoutExercises.get(
              exercise.sourcePrescribedExerciseId,
            )
          : undefined,
      })),
  )
  return candidates
    .filter(
      (candidate) =>
        candidate.workout &&
        candidate.workout.isDeload !== true &&
        candidate.workout.completedAt < current.workout.completedAt,
    )
    .sort((left, right) => {
      const leftContextScore = comparableContextScore(
        current,
        left.workout!,
        left.exercise,
      )
      const rightContextScore = comparableContextScore(
        current,
        right.workout!,
        right.exercise,
      )
      return (
        rightContextScore - leftContextScore ||
        right.workout!.completedAt.localeCompare(left.workout!.completedAt)
      )
    })
    .map((candidate) =>
      candidate.workout
        ? ({
            workout: candidate.workout,
            exercise: candidate.exercise,
            prescription: candidate.prescription,
            sets: candidate.sets,
          } satisfies NextWorkoutPerformance)
        : undefined,
    )[0]
}

function comparableContextScore(
  current: NextWorkoutPerformance,
  workout: Workout,
  exercise: WorkoutExercise,
) {
  let score = 0
  if (workout.sourceTemplateId === current.workout.sourceTemplateId) {
    score += 3
  }
  if (workout.sourceDayId === current.workout.sourceDayId) {
    score += 2
  }
  if (
    exercise.sourcePrescribedExerciseId ===
    current.exercise.sourcePrescribedExerciseId
  ) {
    score += 1
  }
  return score
}

function validateLiveExercisePrescription(
  input: UpdateLiveExercisePrescriptionInput,
) {
  if (
    !Number.isInteger(input.targetSetCount) ||
    input.targetSetCount < 1 ||
    input.targetSetCount > 99
  ) {
    throw new Error('Target sets must be a whole number from 1 to 99.')
  }
  for (const value of [input.targetRepsMin, input.targetRepsMax]) {
    if (
      value !== null &&
      (!Number.isInteger(value) || value < 1 || value > 999)
    ) {
      throw new Error('Rep targets must be whole numbers from 1 to 999.')
    }
  }
  if (
    input.targetRepsMin !== null &&
    input.targetRepsMax !== null &&
    input.targetRepsMin > input.targetRepsMax
  ) {
    throw new Error('Minimum reps cannot be greater than maximum reps.')
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
    sessionTargetRepsMin: sourceExercise.targetRepsMin,
    sessionTargetRepsMax: sourceExercise.targetRepsMax,
    sessionTargetRir: sourceExercise.targetRir,
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
    sessionTargetRepsMin: null,
    sessionTargetRepsMax: null,
    sessionTargetRir: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

async function createInitialLiveExerciseSet({
  database,
  timestamp,
  workout,
  workoutExercise,
}: {
  database: TrainingLogDatabase
  timestamp: string
  workout: Workout
  workoutExercise: WorkoutExercise
}) {
  const settings = await database.userSettings.get('settings')
  const trackingMethodId = workoutExercise.exerciseSnapshot.trackingMethodId
  const previousSets = workoutExercise.exerciseId
    ? await getPreviousCompletedExerciseSets({
        database,
        exerciseId: workoutExercise.exerciseId,
        exerciseName: workoutExercise.exerciseSnapshot.exerciseName,
        trackingMethodId,
        beforeStartedAt: workout.startedAt,
      })
    : []
  const metricValues =
    initialAddedSetPrefill({
      previousSets,
      trackingMethodId,
      workoutAutofillMode: settings?.workoutAutofillMode ?? 'history_copy',
      rirTrackingEnabled: settings?.rirTrackingEnabled ?? false,
    }) ?? {}

  return {
    id: createId(),
    workoutId: workout.id,
    workoutExerciseId: workoutExercise.id,
    setNumber: 1,
    targetSnapshot: null,
    targetRecommendation: null,
    metricValues,
    metricValueSources: Object.fromEntries(
      Object.keys(metricValues).map((key) => [key, 'auto' as const]),
    ),
    rir: null,
    completed: false,
    completedAt: null,
    restSecondsUsed: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  } satisfies WorkoutSet
}

async function createLiveExerciseSetsFromHistory({
  database,
  fallbackSetCount,
  timestamp,
  workout,
  workoutExercise,
}: {
  database: TrainingLogDatabase
  fallbackSetCount: number
  timestamp: string
  workout: Workout
  workoutExercise: WorkoutExercise
}) {
  const previousSets = workoutExercise.exerciseId
    ? await getPreviousCompletedExerciseSets({
        database,
        exerciseId: workoutExercise.exerciseId,
        exerciseName: workoutExercise.exerciseSnapshot.exerciseName,
        trackingMethodId: workoutExercise.exerciseSnapshot.trackingMethodId,
        beforeStartedAt: workout.startedAt,
      })
    : []
  const historicalSets = previousSets.filter((set) =>
    usableHistoricalSet(set, workoutExercise.exerciseSnapshot.trackingMethodId),
  )
  const setCount = historicalSets.length || Math.max(1, fallbackSetCount)

  return Array.from({ length: setCount }, (_, index) => {
    const historicalSet = historicalSets[index]
    const metricValues = historicalSet
      ? numericMetricValues(historicalSet.metricValues)
      : {}
    return {
      id: createId(),
      workoutId: workout.id,
      workoutExerciseId: workoutExercise.id,
      setNumber: index + 1,
      targetSnapshot: null,
      targetRecommendation: null,
      metricValues,
      metricValueSources: Object.fromEntries(
        Object.keys(metricValues).map((key) => [key, 'auto' as const]),
      ),
      rir: null,
      completed: false,
      completedAt: null,
      restSecondsUsed: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    } satisfies WorkoutSet
  })
}

function numericMetricValues(values: WorkoutSet['metricValues']) {
  return Object.fromEntries(
    Object.entries(values).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === 'number' && Number.isFinite(entry[1]),
    ),
  )
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

async function getPreviousCompletedExerciseSets({
  database,
  exerciseId,
  exerciseName,
  trackingMethodId,
  beforeStartedAt,
  sourceDayId,
  excludeDeload = false,
}: {
  database: TrainingLogDatabase
  exerciseId: string
  exerciseName: string
  trackingMethodId: TrackingMethodId
  beforeStartedAt: string
  sourceDayId?: string | null
  excludeDeload?: boolean
}) {
  let searchBefore = beforeStartedAt
  while (true) {
    const previousExercise = await getPreviousCompletedExercise({
      database,
      exerciseId,
      exerciseName,
      trackingMethodId,
      beforeStartedAt: searchBefore,
      sourceDayId,
      excludeDeload,
    })
    if (!previousExercise) {
      return []
    }
    const previousWorkout = await database.workoutHistoryEntries.get(
      previousExercise.workoutId,
    )
    if (!previousWorkout) {
      return []
    }
    const sets = await database.workoutHistorySets
      .where({ workoutExerciseId: previousExercise.id })
      .sortBy('setNumber')
    if (
      !previousExercise.skipped &&
      sets.some((set) => usableHistoricalSet(set, trackingMethodId))
    ) {
      return sets
    }
    searchBefore = previousWorkout.completedAt
  }
}

function usableHistoricalSet(
  set: WorkoutHistorySet,
  trackingMethodId: TrackingMethodId,
) {
  if (!set.completed || set.metricValues.failed === true) {
    return false
  }
  if (!repBasedTrackingMethod(trackingMethodId)) {
    return Object.values(set.metricValues).some(
      (value) => typeof value === 'number' && Number.isFinite(value),
    )
  }
  const reps = set.metricValues.reps
  if (typeof reps !== 'number' || !Number.isFinite(reps) || reps <= 0) {
    return false
  }
  const metricKey = loadMetricKey(trackingMethodId)
  if (!metricKey) {
    return true
  }
  const load = set.metricValues[metricKey]
  return (
    typeof load === 'number' &&
    Number.isFinite(load) &&
    (trackingMethodId === 'weight_reps' ? load > 0 : load >= 0)
  )
}

async function getPreviousCompletedExercise({
  database,
  exerciseId,
  exerciseName,
  trackingMethodId,
  beforeStartedAt,
  sourceDayId,
  excludeDeload = false,
}: {
  database: TrainingLogDatabase
  exerciseId: string
  exerciseName: string
  trackingMethodId: TrackingMethodId
  beforeStartedAt: string
  sourceDayId?: string | null
  excludeDeload?: boolean
}) {
  const exactIdMatches = await database.workoutHistoryExercises
    .where({ exerciseId })
    .toArray()
  const legacySnapshotMatches = isBuiltInExerciseId(exerciseId)
    ? (await database.workoutHistoryExercises.toArray()).filter(
        (exercise) =>
          (!exercise.exerciseId || exercise.exerciseId !== exerciseId) &&
          exercise.exerciseSnapshot.exerciseName === exerciseName,
      )
    : []
  const candidates = await Promise.all(
    [...exactIdMatches, ...legacySnapshotMatches]
      .filter(
        (exercise) =>
          exercise.exerciseSnapshot.trackingMethodId === trackingMethodId,
      )
      .map(async (exercise) => ({
        exercise,
        workout: await database.workoutHistoryEntries.get(exercise.workoutId),
      })),
  )
  return candidates
    .filter(
      (candidate) =>
        candidate.workout &&
        candidate.workout.completedAt < beforeStartedAt &&
        (!excludeDeload || candidate.workout.isDeload !== true) &&
        // When a day is provided, only consider prior workouts of that same
        // program day, so an exercise shared by multiple days pre-fills from
        // the correct day's last performance.
        (sourceDayId == null || candidate.workout.sourceDayId === sourceDayId),
    )
    .sort((first, second) =>
      second.workout!.completedAt.localeCompare(first.workout!.completedAt),
    )[0]?.exercise
}

/**
 * Numeric metric values (weight, reps, ...) from the most recent comparable
 * completed set, to pre-log when repeating a day. Returns null when there is no
 * usable prior set. Boolean flags such as `failed` are intentionally dropped.
 */
function preloggedMetricValuesForSet({
  previousSets,
  setNumber,
}: {
  previousSets: WorkoutHistorySet[]
  setNumber: number
}): {
  suggestedLoad: null
  sourceSetId: string
  sourceSetNumber: number
  metricValues: WorkoutSet['metricValues']
} | null {
  const usable = previousSets.filter(
    (set) => set.completed && set.metricValues.failed !== true,
  )
  const corresponding = usable.find((set) => set.setNumber === setNumber)
  const fallback = usable.filter((set) => set.setNumber < setNumber).at(-1)
  const source = corresponding ?? fallback
  if (!source) {
    return null
  }
  const values: WorkoutSet['metricValues'] = {}
  for (const [key, value] of Object.entries(source.metricValues)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      values[key] = value
    }
  }
  return Object.keys(values).length
    ? {
        suggestedLoad: null,
        sourceSetId: source.id,
        sourceSetNumber: source.setNumber,
        metricValues: values,
      }
    : null
}

function initialAddedSetPrefill({
  previousSets,
  trackingMethodId,
  workoutAutofillMode,
  rirTrackingEnabled,
}: {
  previousSets: WorkoutHistorySet[]
  trackingMethodId: TrackingMethodId
  workoutAutofillMode: WorkoutAutofillMode
  rirTrackingEnabled: boolean
}): WorkoutSet['metricValues'] | null {
  if (
    workoutAutofillMode === 'history_copy' ||
    !repBasedTrackingMethod(trackingMethodId)
  ) {
    return (
      preloggedMetricValuesForSet({ previousSets, setNumber: 1 })
        ?.metricValues ?? null
    )
  }

  const prefillPlan = buildWorkoutPrefillPlan({
    previousSets: previousSets
      .filter((set) => usableHistoricalSet(set, trackingMethodId))
      .flatMap((set) => {
        const reps = set.metricValues.reps
        if (typeof reps !== 'number') {
          return []
        }
        const metricKey = loadMetricKey(trackingMethodId)
        const load = metricKey ? set.metricValues[metricKey] : null
        return [
          {
            id: set.id,
            setNumber: set.setNumber,
            load: typeof load === 'number' ? load : null,
            reps,
            rir: rirTrackingEnabled ? set.rir : null,
          },
        ]
      }),
    targetSetCount: 1,
    targetRepsMin: null,
    targetRepsMax: null,
    targetRir: null,
    trackingMethodId,
    sameProgramDay: false,
  })
  const plan = prefillPlan?.sets[0]
  if (!plan) {
    return null
  }
  const metricKey = loadMetricKey(trackingMethodId)
  return {
    ...(metricKey && plan.load !== null ? { [metricKey]: plan.load } : {}),
    reps: plan.reps,
  }
}

function repBasedTrackingMethod(trackingMethodId: TrackingMethodId) {
  return (
    trackingMethodId === 'weight_reps' ||
    trackingMethodId === 'bodyweight_reps' ||
    trackingMethodId === 'assisted_weight_reps' ||
    trackingMethodId === 'added_weight_reps' ||
    trackingMethodId === 'reps_only'
  )
}

function isBuiltInExerciseId(exerciseId: string) {
  return exerciseId.startsWith('builtin:')
}

function hasOwn<T extends object, K extends PropertyKey>(
  value: T,
  key: K,
): value is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(value, key)
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

async function applyChangeToActiveCycle(
  database: TrainingLogDatabase,
  change: DetectedWorkoutChange,
  now: string,
) {
  const source = parseChangePath(change.sourcePath)
  const performed = parseChangePath(change.performedPath)
  const sourceExerciseId = source.exercise
  const performedExerciseId = performed.exercise

  if (change.type === 'exercise_order_changed') {
    const historyExercises = await database.workoutHistoryExercises
      .where({ workoutId: change.workoutId })
      .sortBy('orderIndex')
    const orderedSourceIds = historyExercises
      .map((exercise) => exercise.sourcePrescribedExerciseId)
      .filter((id): id is string => Boolean(id))
    await updateActiveExerciseOrder(database, source.day, orderedSourceIds, now)
    return
  }

  if (change.type === 'progression_recommendation') {
    const recommendedWeight = parseNumericPathValue(
      change.performedPath,
      'recommendedWeight',
    )
    if (recommendedWeight === null) {
      throw new Error('Progression recommendation is missing target weight.')
    }
    if (!sourceExerciseId) {
      throw new Error('Progression recommendation is missing source exercise.')
    }
    const sourceExercise =
      await database.activeCycleWorkoutExercises.get(sourceExerciseId)
    if (!sourceExercise) {
      throw new Error('Active cycle exercise was not found.')
    }
    await database.activeCycleWorkoutExercises.update(sourceExercise.id, {
      targetWeight: recommendedWeight,
      updatedAt: now,
    })
    await database.activeProgramCycles.update(sourceExercise.activeCycleId, {
      updatedAt: now,
    })
    return
  }

  if (!source.day) {
    throw new Error('Detected change is missing the source workout day.')
  }

  if (change.type === 'exercise_added') {
    if (!performedExerciseId) {
      throw new Error(
        'Detected exercise addition is missing performed exercise.',
      )
    }
    const performedExercise =
      await database.workoutHistoryExercises.get(performedExerciseId)
    if (!performedExercise?.exerciseId) {
      throw new Error('Performed exercise was not found.')
    }
    const day = await database.activeCycleWorkoutDays.get(source.day)
    if (!day) {
      throw new Error('Active cycle day was not found.')
    }
    const existing = await database.activeCycleWorkoutExercises
      .where({ dayId: day.id })
      .toArray()
    await database.activeCycleWorkoutExercises.add({
      id: createId(),
      activeCycleId: day.activeCycleId,
      dayId: day.id,
      sourceTemplateExerciseId: null,
      exerciseId: performedExercise.exerciseId,
      exerciseSnapshot: performedExercise.exerciseSnapshot,
      orderIndex: performedExercise.orderIndex,
      targetSetCount: await getHistorySetCount(database, performedExercise.id),
      targetWeight: null,
      targetDurationSeconds: null,
      targetDistance: null,
      targetRepsMin: null,
      targetRepsMax: null,
      targetRir: null,
      restSecondsOverride: null,
      notes: performedExercise.notes,
      createdAt: now,
      updatedAt: now,
    })
    await normalizeActiveExerciseOrder(
      database,
      day.id,
      existing.length + 1,
      now,
    )
    await database.activeProgramCycles.update(day.activeCycleId, {
      updatedAt: now,
    })
    return
  }

  if (!sourceExerciseId) {
    throw new Error('Detected change is missing the source exercise.')
  }

  if (change.type === 'exercise_skipped_or_removed') {
    const sourceExercise =
      await database.activeCycleWorkoutExercises.get(sourceExerciseId)
    if (!sourceExercise) {
      throw new Error('Active cycle exercise was not found.')
    }
    await database.activeCycleWorkoutExercises.delete(sourceExerciseId)
    await normalizeActiveExerciseOrder(
      database,
      sourceExercise.dayId,
      undefined,
      now,
    )
    await database.activeProgramCycles.update(sourceExercise.activeCycleId, {
      updatedAt: now,
    })
    return
  }

  const sourceExercise =
    await database.activeCycleWorkoutExercises.get(sourceExerciseId)
  if (!sourceExercise) {
    throw new Error('Active cycle exercise was not found.')
  }

  if (change.type === 'set_added' || change.type === 'set_removed') {
    if (!performedExerciseId) {
      throw new Error('Detected set change is missing performed exercise.')
    }
    await database.activeCycleWorkoutExercises.update(sourceExercise.id, {
      targetSetCount: await getHistorySetCount(database, performedExerciseId),
      updatedAt: now,
    })
    await database.activeProgramCycles.update(sourceExercise.activeCycleId, {
      updatedAt: now,
    })
    return
  }

  if (change.type === 'exercise_replaced') {
    if (!performedExerciseId) {
      throw new Error('Detected replacement is missing performed exercise.')
    }
    const performedExercise =
      await database.workoutHistoryExercises.get(performedExerciseId)
    if (!performedExercise?.exerciseId) {
      throw new Error('Replacement exercise was not found.')
    }
    await database.activeCycleWorkoutExercises.update(sourceExercise.id, {
      exerciseId: performedExercise.exerciseId,
      exerciseSnapshot: performedExercise.exerciseSnapshot,
      updatedAt: now,
    })
    await database.activeProgramCycles.update(sourceExercise.activeCycleId, {
      updatedAt: now,
    })
  }
}

async function applyChangeToTemplate(
  database: TrainingLogDatabase,
  change: DetectedWorkoutChange,
  now: string,
) {
  const source = parseChangePath(change.sourcePath)
  const performed = parseChangePath(change.performedPath)
  if (!source.template) {
    throw new Error('This workout has no reusable template destination.')
  }

  if (change.type === 'exercise_order_changed') {
    if (!source.day) {
      throw new Error('Detected order change is missing the source day.')
    }
    const sourceDay = await database.activeCycleWorkoutDays.get(source.day)
    if (!sourceDay?.sourceTemplateDayId) {
      throw new Error('Template workout day was not found.')
    }
    const historyExercises = await database.workoutHistoryExercises
      .where({ workoutId: change.workoutId })
      .sortBy('orderIndex')
    const orderedTemplateIds = historyExercises
      .map((exercise) => exercise.sourcePrescribedExerciseId)
      .filter((id): id is string => Boolean(id))
      .map((activeExerciseId) =>
        sourceTemplateExerciseIdFromActivePath(database, activeExerciseId),
      )
    await updateTemplateExerciseOrder(
      database,
      sourceDay.sourceTemplateDayId,
      await Promise.all(orderedTemplateIds),
      now,
    )
    return
  }

  const templateExerciseId =
    source.templateExercise ||
    (source.exercise
      ? (await database.activeCycleWorkoutExercises.get(source.exercise))
          ?.sourceTemplateExerciseId
      : null)
  const templateDayId = source.day
    ? (await database.activeCycleWorkoutDays.get(source.day))
        ?.sourceTemplateDayId
    : null

  if (change.type === 'progression_recommendation') {
    const recommendedWeight = parseNumericPathValue(
      change.performedPath,
      'recommendedWeight',
    )
    if (recommendedWeight === null) {
      throw new Error('Progression recommendation is missing target weight.')
    }
    if (!templateExerciseId) {
      throw new Error('Template exercise was not found.')
    }
    const templateExercise =
      await database.templateWorkoutExercises.get(templateExerciseId)
    if (!templateExercise) {
      throw new Error('Template exercise was not found.')
    }
    await database.templateWorkoutExercises.update(templateExercise.id, {
      targetWeight: recommendedWeight,
      updatedAt: now,
    })
    await database.programTemplates.update(templateExercise.templateId, {
      updatedAt: now,
    })
    return
  }

  if (change.type === 'exercise_added') {
    if (!templateDayId) {
      throw new Error('Template workout day was not found.')
    }
    const performedExerciseId = performed.exercise
    const performedExercise = performedExerciseId
      ? await database.workoutHistoryExercises.get(performedExerciseId)
      : undefined
    if (!performedExercise?.exerciseId) {
      throw new Error('Performed exercise was not found.')
    }
    const existing = await database.templateWorkoutExercises
      .where({ dayId: templateDayId })
      .toArray()
    await database.templateWorkoutExercises.add({
      id: createId(),
      templateId: source.template,
      dayId: templateDayId,
      exerciseId: performedExercise.exerciseId,
      exerciseSnapshot: performedExercise.exerciseSnapshot,
      orderIndex: performedExercise.orderIndex,
      targetSetCount: await getHistorySetCount(database, performedExercise.id),
      targetWeight: null,
      targetDurationSeconds: null,
      targetDistance: null,
      targetRepsMin: null,
      targetRepsMax: null,
      targetRir: null,
      restSecondsOverride: null,
      notes: performedExercise.notes,
      createdAt: now,
      updatedAt: now,
    })
    await normalizeTemplateExerciseOrder(
      database,
      templateDayId,
      existing.length + 1,
      now,
    )
    await database.programTemplates.update(source.template, { updatedAt: now })
    return
  }

  if (!templateExerciseId) {
    throw new Error('Template exercise was not found.')
  }

  if (change.type === 'exercise_skipped_or_removed') {
    const templateExercise =
      await database.templateWorkoutExercises.get(templateExerciseId)
    if (!templateExercise) {
      throw new Error('Template exercise was not found.')
    }
    await database.templateWorkoutExercises.delete(templateExerciseId)
    await normalizeTemplateExerciseOrder(
      database,
      templateExercise.dayId,
      undefined,
      now,
    )
    await database.programTemplates.update(templateExercise.templateId, {
      updatedAt: now,
    })
    return
  }

  const templateExercise =
    await database.templateWorkoutExercises.get(templateExerciseId)
  if (!templateExercise) {
    throw new Error('Template exercise was not found.')
  }

  if (change.type === 'set_added' || change.type === 'set_removed') {
    if (!performed.exercise) {
      throw new Error('Detected set change is missing performed exercise.')
    }
    await database.templateWorkoutExercises.update(templateExercise.id, {
      targetSetCount: await getHistorySetCount(database, performed.exercise),
      updatedAt: now,
    })
    await database.programTemplates.update(templateExercise.templateId, {
      updatedAt: now,
    })
    return
  }

  if (change.type === 'exercise_replaced') {
    if (!performed.exercise) {
      throw new Error('Detected replacement is missing performed exercise.')
    }
    const performedExercise = await database.workoutHistoryExercises.get(
      performed.exercise,
    )
    if (!performedExercise?.exerciseId) {
      throw new Error('Replacement exercise was not found.')
    }
    await database.templateWorkoutExercises.update(templateExercise.id, {
      exerciseId: performedExercise.exerciseId,
      exerciseSnapshot: performedExercise.exerciseSnapshot,
      updatedAt: now,
    })
    await database.programTemplates.update(templateExercise.templateId, {
      updatedAt: now,
    })
  }
}

function parseChangePath(path: string) {
  return Object.fromEntries(
    path
      .split(';')
      .map((part) => part.split(':'))
      .filter(([key]) => key),
  ) as Partial<Record<string, string>>
}

function parseNumericPathValue(path: string, key: string) {
  const raw = parseChangePath(path)[key]
  if (raw === undefined) {
    return null
  }
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

async function getHistorySetCount(
  database: TrainingLogDatabase,
  workoutExerciseId: string,
) {
  return database.workoutHistorySets
    .where({ workoutExerciseId })
    .count()
    .then((count) => Math.max(0, count))
}

async function updateActiveExerciseOrder(
  database: TrainingLogDatabase,
  dayId: string | undefined,
  orderedSourceIds: string[],
  now: string,
) {
  if (!dayId) {
    throw new Error('Detected order change is missing the source day.')
  }
  const exercises = await database.activeCycleWorkoutExercises
    .where({ dayId })
    .toArray()
  const orderedSet = new Set(orderedSourceIds)
  const ordered = [
    ...orderedSourceIds
      .map((id) => exercises.find((exercise) => exercise.id === id))
      .filter((exercise): exercise is ActiveCycleWorkoutExercise =>
        Boolean(exercise),
      ),
    ...exercises
      .filter((exercise) => !orderedSet.has(exercise.id))
      .sort((first, second) => first.orderIndex - second.orderIndex),
  ]
  await Promise.all(
    ordered.map((exercise, orderIndex) =>
      database.activeCycleWorkoutExercises.update(exercise.id, {
        orderIndex,
        updatedAt: now,
      }),
    ),
  )
  if (ordered[0]) {
    await database.activeProgramCycles.update(ordered[0].activeCycleId, {
      updatedAt: now,
    })
  }
}

async function updateTemplateExerciseOrder(
  database: TrainingLogDatabase,
  dayId: string,
  orderedTemplateExerciseIds: string[],
  now: string,
) {
  const exercises = await database.templateWorkoutExercises
    .where({ dayId })
    .toArray()
  const orderedSet = new Set(orderedTemplateExerciseIds)
  const ordered = [
    ...orderedTemplateExerciseIds
      .map((id) => exercises.find((exercise) => exercise.id === id))
      .filter((exercise): exercise is TemplateWorkoutExercise =>
        Boolean(exercise),
      ),
    ...exercises
      .filter((exercise) => !orderedSet.has(exercise.id))
      .sort((first, second) => first.orderIndex - second.orderIndex),
  ]
  await Promise.all(
    ordered.map((exercise, orderIndex) =>
      database.templateWorkoutExercises.update(exercise.id, {
        orderIndex,
        updatedAt: now,
      }),
    ),
  )
  if (ordered[0]) {
    await database.programTemplates.update(ordered[0].templateId, {
      updatedAt: now,
    })
  }
}

async function reindexWorkoutExercises(
  database: TrainingLogDatabase,
  workoutId: string,
  now: string,
) {
  const exercises = await database.workoutExercises
    .where({ workoutId })
    .sortBy('orderIndex')
  await Promise.all(
    exercises.map((exercise, orderIndex) =>
      database.workoutExercises.update(exercise.id, {
        orderIndex,
        updatedAt: now,
      }),
    ),
  )
}

async function sourceTemplateExerciseIdFromActivePath(
  database: TrainingLogDatabase,
  activeExerciseId: string,
) {
  const activeExercise =
    await database.activeCycleWorkoutExercises.get(activeExerciseId)
  return activeExercise?.sourceTemplateExerciseId ?? ''
}

async function normalizeActiveExerciseOrder(
  database: TrainingLogDatabase,
  dayId: string,
  expectedLength: number | undefined,
  now: string,
) {
  const exercises = await database.activeCycleWorkoutExercises
    .where({ dayId })
    .sortBy('orderIndex')
  await Promise.all(
    exercises.map((exercise, orderIndex) =>
      database.activeCycleWorkoutExercises.update(exercise.id, {
        orderIndex,
        updatedAt: now,
      }),
    ),
  )
  if (expectedLength !== undefined && exercises.length !== expectedLength) {
    throw new Error('Active cycle exercise order could not be normalized.')
  }
}

async function normalizeTemplateExerciseOrder(
  database: TrainingLogDatabase,
  dayId: string,
  expectedLength: number | undefined,
  now: string,
) {
  const exercises = await database.templateWorkoutExercises
    .where({ dayId })
    .sortBy('orderIndex')
  await Promise.all(
    exercises.map((exercise, orderIndex) =>
      database.templateWorkoutExercises.update(exercise.id, {
        orderIndex,
        updatedAt: now,
      }),
    ),
  )
  if (expectedLength !== undefined && exercises.length !== expectedLength) {
    throw new Error('Template exercise order could not be normalized.')
  }
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

async function loadWorkoutHistoryStructure(
  database: TrainingLogDatabase,
  workoutId: string,
): Promise<WorkoutHistoryStructure> {
  const workout = await database.workoutHistoryEntries.get(workoutId)
  if (!workout) {
    throw new Error(`Workout history ${workoutId} was not found.`)
  }
  const exercises = await database.workoutHistoryExercises
    .where({ workoutId })
    .sortBy('orderIndex')
  const sets = await database.workoutHistorySets.where({ workoutId }).toArray()

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
}

export const workoutRepository = createWorkoutRepository()
