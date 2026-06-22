import Dexie, { type EntityTable } from 'dexie'

import { getTrackingMethod } from '@domain/trackingMethods'
import type {
  ActiveCycleWorkoutDay,
  ActiveCycleWorkoutExercise,
  ActiveProgramCycle,
  ApiKeyIntegrationSettings,
  AppMetadata,
  AppliedWorkoutChange,
  BarcodeProductCache,
  BackupMetadata,
  BodyweightEntry,
  DetectedWorkoutChange,
  Exercise,
  ExerciseEquipmentType,
  Food,
  FoodLogEntry,
  FoodUnitPreference,
  NutritionTarget,
  ProgramTemplate,
  ProgramTemplateDay,
  Run,
  RunClassification,
  RunPause,
  RunSample,
  RunSplit,
  TemplateWorkoutExercise,
  UserSettings,
  Workout,
  WorkoutExercise,
  WorkoutHistoryEntry,
  WorkoutHistoryExercise,
  WorkoutHistorySet,
  WorkoutSet,
} from '@shared-types/app'

export const DATABASE_SCHEMA_VERSION = 8
export const BACKUP_SCHEMA_VERSION = 1
export const DATABASE_NAME = 'training-log'

export class TrainingLogDatabase extends Dexie {
  appMetadata!: EntityTable<AppMetadata, 'id'>
  userSettings!: EntityTable<UserSettings, 'id'>
  nutritionTargets!: EntityTable<NutritionTarget, 'id'>
  foods!: EntityTable<Food, 'id'>
  foodLogEntries!: EntityTable<FoodLogEntry, 'id'>
  foodUnitPreferences!: EntityTable<FoodUnitPreference, 'id'>
  barcodeProductCache!: EntityTable<BarcodeProductCache, 'id'>
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
  runs!: EntityTable<Run, 'id'>
  runSamples!: EntityTable<RunSample, 'id'>
  runPauses!: EntityTable<RunPause, 'id'>
  runSplits!: EntityTable<RunSplit, 'id'>
  runClassifications!: EntityTable<RunClassification, 'id'>
  apiKeyIntegrationSettings!: EntityTable<ApiKeyIntegrationSettings, 'id'>
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

    this.version(3)
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

    this.version(4)
      .stores({
        appMetadata: '&id',
        userSettings: '&id',
        nutritionTargets: '&id, updatedAt',
        foods: '&id, status, name, updatedAt',
        foodLogEntries: '&id, localDate, foodId, createdAt',
        bodyweightEntries: '&id, localDate, createdAt, updatedAt',
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

    this.version(5)
      .stores({
        appMetadata: '&id',
        userSettings: '&id',
        nutritionTargets: '&id, updatedAt',
        foods: '&id, status, name, updatedAt',
        foodLogEntries: '&id, localDate, foodId, createdAt',
        bodyweightEntries: '&id, localDate, createdAt, updatedAt',
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
        runs: '&id, status, localDate, startedAt, completedAt',
        runSamples:
          '&id, runId, timestamp, decision, rejectionReason, [runId+timestamp]',
        runPauses: '&id, runId, startedAt, endedAt',
        runSplits: '&id, runId, mileNumber, completedAt',
        runClassifications: '&id, runId, type, startedAt',
        backupMetadata: '&id, createdAt',
      })
      .upgrade(async (tx) => {
        const now = new Date().toISOString()
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

    this.version(6)
      .stores({
        appMetadata: '&id',
        userSettings: '&id',
        nutritionTargets: '&id, updatedAt',
        foods: '&id, status, name, updatedAt',
        foodLogEntries: '&id, localDate, foodId, createdAt',
        bodyweightEntries: '&id, localDate, createdAt, updatedAt',
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
        runs: '&id, status, localDate, startedAt, completedAt',
        runSamples:
          '&id, runId, timestamp, decision, rejectionReason, [runId+timestamp]',
        runPauses: '&id, runId, startedAt, endedAt',
        runSplits: '&id, runId, mileNumber, completedAt',
        runClassifications: '&id, runId, type, startedAt',
        apiKeyIntegrationSettings: '&id, status, updatedAt',
        backupMetadata: '&id, createdAt',
      })
      .upgrade(async (tx) => {
        const now = new Date().toISOString()
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

    this.version(DATABASE_SCHEMA_VERSION)
      .stores({
        appMetadata: '&id',
        userSettings: '&id',
        nutritionTargets: '&id, updatedAt',
        foods: '&id, status, name, updatedAt',
        foodLogEntries: '&id, localDate, foodId, createdAt',
        foodUnitPreferences: '&id, foodId, updatedAt',
        barcodeProductCache: '&id, &barcode, foodId, updatedAt',
        bodyweightEntries: '&id, localDate, createdAt, updatedAt',
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
        runs: '&id, status, localDate, startedAt, completedAt',
        runSamples:
          '&id, runId, timestamp, decision, rejectionReason, [runId+timestamp]',
        runPauses: '&id, runId, startedAt, endedAt',
        runSplits: '&id, runId, mileNumber, completedAt',
        runClassifications: '&id, runId, type, startedAt',
        apiKeyIntegrationSettings: '&id, status, updatedAt',
        backupMetadata: '&id, createdAt',
      })
      .upgrade(async (tx) => {
        const now = new Date().toISOString()
        const settings = await tx
          .table<Partial<UserSettings>>('userSettings')
          .get('settings')
        if (settings) {
          await tx.table<UserSettings>('userSettings').put({
            id: 'settings',
            weightUnit: settings.weightUnit ?? 'lb',
            energyUnit: settings.energyUnit ?? 'kcal',
            nutritionTargets: settings.nutritionTargets ?? {
              calories: 0,
              proteinGrams: 0,
              carbohydrateGrams: 0,
              fatGrams: 0,
            },
            timerSoundEnabled: settings.timerSoundEnabled ?? true,
            selectedTimerSoundId:
              settings.selectedTimerSoundId ?? 'rest-complete-chime',
            createdAt: settings.createdAt ?? now,
            updatedAt: now,
          })
        }
        const workoutSets = await tx.table<WorkoutSet>('workoutSets').toArray()
        const workoutHistorySets = await tx
          .table<WorkoutHistorySet>('workoutHistorySets')
          .toArray()

        await tx.table<WorkoutSet>('workoutSets').bulkPut(
          workoutSets.map((set) => ({
            ...set,
            metricValueSources: set.metricValueSources ?? {},
          })),
        )
        await tx.table<WorkoutHistorySet>('workoutHistorySets').bulkPut(
          workoutHistorySets.map((set) => ({
            ...set,
            metricValueSources: set.metricValueSources ?? {},
          })),
        )

        if (
          (await tx.table<WorkoutSet>('workoutSets').count()) !==
            workoutSets.length ||
          (await tx.table<WorkoutHistorySet>('workoutHistorySets').count()) !==
            workoutHistorySets.length
        ) {
          throw new Error('Workout set ownership migration count mismatch.')
        }

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
