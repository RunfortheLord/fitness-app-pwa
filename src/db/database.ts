import Dexie, { type EntityTable } from 'dexie'

import { getTrackingMethod } from '@domain/trackingMethods'
import type {
  ActiveCycleWorkoutDay,
  ActiveCycleWorkoutExercise,
  ActiveProgramCycle,
  AppMetadata,
  AppliedWorkoutChange,
  BackupMetadata,
  BodyweightEntry,
  DetectedWorkoutChange,
  Exercise,
  ExerciseEquipmentType,
  Food,
  FoodLogEntry,
  NutritionTarget,
  ProgramTemplate,
  ProgramTemplateDay,
  TemplateWorkoutExercise,
  UserSettings,
  Workout,
  WorkoutExercise,
  WorkoutHistoryEntry,
  WorkoutHistoryExercise,
  WorkoutHistorySet,
  WorkoutSet,
} from '@shared-types/app'

export const DATABASE_SCHEMA_VERSION = 3
export const BACKUP_SCHEMA_VERSION = 1
export const DATABASE_NAME = 'training-log'

export class TrainingLogDatabase extends Dexie {
  appMetadata!: EntityTable<AppMetadata, 'id'>
  userSettings!: EntityTable<UserSettings, 'id'>
  nutritionTargets!: EntityTable<NutritionTarget, 'id'>
  foods!: EntityTable<Food, 'id'>
  foodLogEntries!: EntityTable<FoodLogEntry, 'id'>
  bodyweightEntries!: EntityTable<BodyweightEntry, 'id'>
  exercises!: EntityTable<Exercise, 'id'>
  programTemplates!: EntityTable<ProgramTemplate, 'id'>
  templateWorkoutDays!: EntityTable<ProgramTemplateDay, 'id'>
  templateWorkoutExercises!: EntityTable<TemplateWorkoutExercise, 'id'>
  activeProgramCycles!: EntityTable<ActiveProgramCycle, 'id'>
  activeCycleWorkoutDays!: EntityTable<ActiveCycleWorkoutDay, 'id'>
  activeCycleWorkoutExercises!: EntityTable<ActiveCycleWorkoutExercise, 'id'>
  workouts!: EntityTable<Workout, 'id'>
  workoutExercises!: EntityTable<WorkoutExercise, 'id'>
  workoutSets!: EntityTable<WorkoutSet, 'id'>
  workoutHistoryEntries!: EntityTable<WorkoutHistoryEntry, 'id'>
  workoutHistoryExercises!: EntityTable<WorkoutHistoryExercise, 'id'>
  workoutHistorySets!: EntityTable<WorkoutHistorySet, 'id'>
  detectedWorkoutChanges!: EntityTable<DetectedWorkoutChange, 'id'>
  appliedWorkoutChanges!: EntityTable<AppliedWorkoutChange, 'id'>
  backupMetadata!: EntityTable<BackupMetadata, 'id'>

  constructor(name = DATABASE_NAME) {
    super(name)

    this.version(1).stores({
      appMetadata: '&id',
      userSettings: '&id',
    })

    this.version(2)
      .stores({
        appMetadata: '&id',
        userSettings: '&id',
        nutritionTargets: '&id, updatedAt',
        foods: '&id, status, name, updatedAt',
        foodLogEntries: '&id, localDate, foodId, createdAt',
        bodyweightEntries: '&id, &localDate, createdAt',
        exercises: '&id, status, name, trackingMethodId, updatedAt',
        programTemplates: '&id, status, name, updatedAt',
        templateWorkoutDays: '&id, templateId, [templateId+orderIndex]',
        templateWorkoutExercises:
          '&id, templateId, dayId, exerciseId, [dayId+orderIndex]',
        activeProgramCycles: '&id, sourceTemplateId, status, activatedAt',
        activeCycleWorkoutDays:
          '&id, activeCycleId, sourceTemplateDayId, [activeCycleId+orderIndex]',
        activeCycleWorkoutExercises:
          '&id, activeCycleId, dayId, exerciseId, sourceTemplateExerciseId, [dayId+orderIndex]',
        workouts: '&id, status, localDate, sourceActiveCycleId, startedAt',
        workoutExercises: '&id, workoutId, exerciseId, [workoutId+orderIndex]',
        workoutSets:
          '&id, workoutId, workoutExerciseId, [workoutExerciseId+setNumber]',
        workoutHistoryEntries:
          '&id, localDate, sourceActiveCycleId, sourceTemplateId, completedAt',
        workoutHistoryExercises:
          '&id, workoutId, exerciseId, [workoutId+orderIndex]',
        workoutHistorySets:
          '&id, workoutId, workoutExerciseId, [workoutExerciseId+setNumber]',
        detectedWorkoutChanges: '&id, workoutId, status, type, createdAt',
        appliedWorkoutChanges: '&id, detectedChangeId, workoutId, appliedAt',
        backupMetadata: '&id, createdAt',
      })
      .upgrade(async (tx) => {
        const metadata = await tx.table<AppMetadata>('appMetadata').get('app')
        const userSettings = await tx
          .table<Partial<UserSettings> & { id: string }>('userSettings')
          .get('settings')
        const now = new Date().toISOString()

        if (metadata) {
          await tx.table<AppMetadata>('appMetadata').put({
            ...metadata,
            databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
            backupSchemaVersion: BACKUP_SCHEMA_VERSION,
            updatedAt: now,
          })
        }

        if (userSettings) {
          await tx.table<UserSettings>('userSettings').put({
            id: 'settings',
            weightUnit: 'lb',
            energyUnit: 'kcal',
            nutritionTargets: userSettings.nutritionTargets ?? {
              calories: 0,
              proteinGrams: 0,
              carbohydrateGrams: 0,
              fatGrams: 0,
            },
            createdAt: userSettings.createdAt ?? now,
            updatedAt: now,
          })
        }
      })

    this.version(DATABASE_SCHEMA_VERSION)
      .stores({
        appMetadata: '&id',
        userSettings: '&id',
        nutritionTargets: '&id, updatedAt',
        foods: '&id, status, name, updatedAt',
        foodLogEntries: '&id, localDate, foodId, createdAt',
        bodyweightEntries: '&id, &localDate, createdAt',
        exercises:
          '&id, status, origin, seedDataVersion, name, trackingMethodId, updatedAt',
        programTemplates: '&id, status, name, updatedAt',
        templateWorkoutDays: '&id, templateId, [templateId+orderIndex]',
        templateWorkoutExercises:
          '&id, templateId, dayId, exerciseId, [dayId+orderIndex]',
        activeProgramCycles: '&id, sourceTemplateId, status, activatedAt',
        activeCycleWorkoutDays:
          '&id, activeCycleId, sourceTemplateDayId, [activeCycleId+orderIndex]',
        activeCycleWorkoutExercises:
          '&id, activeCycleId, dayId, exerciseId, sourceTemplateExerciseId, [dayId+orderIndex]',
        workouts: '&id, status, localDate, sourceActiveCycleId, startedAt',
        workoutExercises: '&id, workoutId, exerciseId, [workoutId+orderIndex]',
        workoutSets:
          '&id, workoutId, workoutExerciseId, [workoutExerciseId+setNumber]',
        workoutHistoryEntries:
          '&id, localDate, sourceActiveCycleId, sourceTemplateId, completedAt',
        workoutHistoryExercises:
          '&id, workoutId, exerciseId, [workoutId+orderIndex]',
        workoutHistorySets:
          '&id, workoutId, workoutExerciseId, [workoutExerciseId+setNumber]',
        detectedWorkoutChanges: '&id, workoutId, status, type, createdAt',
        appliedWorkoutChanges: '&id, detectedChangeId, workoutId, appliedAt',
        backupMetadata: '&id, createdAt',
      })
      .upgrade(async (tx) => {
        const now = new Date().toISOString()
        const exercises = await tx
          .table<Partial<Exercise>>('exercises')
          .toArray()
        await tx
          .table<Exercise>('exercises')
          .bulkPut(
            exercises.map((exercise) => normalizeExerciseRecord(exercise, now)),
          )
        const metadata = await tx.table<AppMetadata>('appMetadata').get('app')
        if (metadata) {
          await tx.table<AppMetadata>('appMetadata').put({
            ...metadata,
            databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
            backupSchemaVersion: BACKUP_SCHEMA_VERSION,
            updatedAt: now,
          })
        }
      })
  }
}

export const db = new TrainingLogDatabase()

function normalizeExerciseRecord(
  exercise: Partial<Exercise>,
  timestamp: string,
): Exercise {
  const trackingMethodId = exercise.trackingMethodId ?? 'weight_reps'
  const trackingMethod = getTrackingMethod(trackingMethodId)
  const createdAt = exercise.createdAt ?? timestamp
  const updatedAt = exercise.updatedAt ?? timestamp

  return {
    id: exercise.id ?? crypto.randomUUID(),
    name: exercise.name?.trim() || 'Untitled exercise',
    notes: exercise.notes ?? '',
    defaultRestSeconds: exercise.defaultRestSeconds ?? 120,
    defaultWeightIncrement: exercise.defaultWeightIncrement ?? 5,
    trackingMethodId,
    trackingMetrics: exercise.trackingMetrics ?? trackingMethod?.metrics ?? [],
    primaryMuscleGroups: exercise.primaryMuscleGroups ?? [],
    secondaryMuscleGroups: exercise.secondaryMuscleGroups ?? [],
    equipmentType:
      exercise.equipmentType ?? defaultEquipmentForTracking(trackingMethodId),
    recordsRepsPerSide: exercise.recordsRepsPerSide ?? false,
    origin: exercise.origin ?? 'custom',
    seedDataVersion: exercise.seedDataVersion ?? null,
    status: exercise.status ?? 'active',
    createdAt,
    updatedAt,
  }
}

function defaultEquipmentForTracking(
  trackingMethodId: Exercise['trackingMethodId'],
): ExerciseEquipmentType {
  if (
    trackingMethodId === 'bodyweight_reps' ||
    trackingMethodId === 'reps_only' ||
    trackingMethodId === 'added_weight_reps'
  ) {
    return 'bodyweight'
  }
  return 'barbell'
}
