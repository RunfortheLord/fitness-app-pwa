import Dexie, { type EntityTable } from 'dexie'

import { FOOD_NORMALIZER_VERSION } from '@domain/foodProviderModels'
import { officialRestaurantMenuCorrectionFor } from '@domain/officialRestaurantMenuCorrections'
import { getTrackingMethod } from '@domain/trackingMethods'
import { isMealType, mealTypeForHour } from '@domain/meals'
import {
  completionProgramWeek,
  DEFAULT_DELOAD_WEEK_NUMBERS,
  DEFAULT_PROGRAM_DURATION_WEEKS,
} from '@domain/programWeeks'
import type {
  ActiveCycleDayCheck,
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
  ExerciseProgressionState,
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
  SavedMeal,
  TemplateWorkoutExercise,
  UserSettings,
  Workout,
  WorkoutExercise,
  WorkoutHistoryEntry,
  WorkoutHistoryExercise,
  WorkoutHistorySet,
  WorkoutSet,
} from '@shared-types/app'

export const DATABASE_SCHEMA_VERSION = 22
export const BACKUP_SCHEMA_VERSION = 1
export const DATABASE_NAME = 'training-log'

export class TrainingLogDatabase extends Dexie {
  appMetadata!: EntityTable<AppMetadata, 'id'>
  userSettings!: EntityTable<UserSettings, 'id'>
  nutritionTargets!: EntityTable<NutritionTarget, 'id'>
  foods!: EntityTable<Food, 'id'>
  foodLogEntries!: EntityTable<FoodLogEntry, 'id'>
  savedMeals!: EntityTable<SavedMeal, 'id'>
  foodUnitPreferences!: EntityTable<FoodUnitPreference, 'id'>
  barcodeProductCache!: EntityTable<BarcodeProductCache, 'id'>
  bodyweightEntries!: EntityTable<BodyweightEntry, 'id'>
  exercises!: EntityTable<Exercise, 'id'>
  exerciseProgressionStates!: EntityTable<
    ExerciseProgressionState,
    'exerciseId'
  >
  programTemplates!: EntityTable<ProgramTemplate, 'id'>
  templateWorkoutDays!: EntityTable<ProgramTemplateDay, 'id'>
  templateWorkoutExercises!: EntityTable<TemplateWorkoutExercise, 'id'>
  activeProgramCycles!: EntityTable<ActiveProgramCycle, 'id'>
  activeCycleDayChecks!: EntityTable<ActiveCycleDayCheck, 'id'>
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

    this.version(8)
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

    this.version(9)
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
        programTemplates: '&id, status, name, lastActiveAt, updatedAt',
        templateWorkoutDays: '&id, templateId, [templateId+orderIndex]',
        templateWorkoutExercises:
          '&id, templateId, dayId, exerciseId, [dayId+orderIndex]',
        activeProgramCycles:
          '&id, sourceTemplateId, status, activatedAt, updatedAt',
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
        const activeCycles = await tx
          .table<ActiveProgramCycle>('activeProgramCycles')
          .toArray()
        const lastActiveByTemplate = new Map<string, string>()

        await tx.table<ActiveProgramCycle>('activeProgramCycles').bulkPut(
          activeCycles.map((cycle) => {
            if (cycle.sourceTemplateId) {
              const existing = lastActiveByTemplate.get(cycle.sourceTemplateId)
              if (!existing || cycle.activatedAt > existing) {
                lastActiveByTemplate.set(
                  cycle.sourceTemplateId,
                  cycle.activatedAt,
                )
              }
            }
            return {
              ...cycle,
              notes: '',
              status: cycle.status === 'archived' ? 'inactive' : cycle.status,
              updatedAt: now,
            }
          }),
        )

        const templates = await tx
          .table<ProgramTemplate>('programTemplates')
          .toArray()
        await tx.table<ProgramTemplate>('programTemplates').bulkPut(
          templates.map((template) => ({
            ...template,
            notes: '',
            status: 'active',
            lastActiveAt:
              template.lastActiveAt ??
              lastActiveByTemplate.get(template.id) ??
              null,
            updatedAt: now,
          })),
        )

        const templateDays = await tx
          .table<ProgramTemplateDay>('templateWorkoutDays')
          .toArray()
        await tx
          .table<ProgramTemplateDay>('templateWorkoutDays')
          .bulkPut(
            templateDays.map((day) => ({ ...day, notes: '', updatedAt: now })),
          )

        const templateExercises = await tx
          .table<TemplateWorkoutExercise>('templateWorkoutExercises')
          .toArray()
        await tx
          .table<TemplateWorkoutExercise>('templateWorkoutExercises')
          .bulkPut(
            templateExercises.map((exercise) => ({
              ...exercise,
              targetDurationSeconds: null,
              notes: '',
              updatedAt: now,
            })),
          )

        const activeDays = await tx
          .table<ActiveCycleWorkoutDay>('activeCycleWorkoutDays')
          .toArray()
        await tx
          .table<ActiveCycleWorkoutDay>('activeCycleWorkoutDays')
          .bulkPut(
            activeDays.map((day) => ({ ...day, notes: '', updatedAt: now })),
          )

        const activeExercises = await tx
          .table<ActiveCycleWorkoutExercise>('activeCycleWorkoutExercises')
          .toArray()
        await tx
          .table<ActiveCycleWorkoutExercise>('activeCycleWorkoutExercises')
          .bulkPut(
            activeExercises.map((exercise) => ({
              ...exercise,
              targetDurationSeconds: null,
              notes: '',
              updatedAt: now,
            })),
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

    this.version(10)
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
        programTemplates: '&id, status, name, lastActiveAt, updatedAt',
        templateWorkoutDays: '&id, templateId, [templateId+orderIndex]',
        templateWorkoutExercises:
          '&id, templateId, dayId, exerciseId, [dayId+orderIndex]',
        activeProgramCycles:
          '&id, sourceTemplateId, status, activatedAt, updatedAt',
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
        // Backfill a meal on every existing food log. The log time of day is the
        // best available signal for which meal an entry belonged to.
        const entries = await tx.table<FoodLogEntry>('foodLogEntries').toArray()
        await tx.table<FoodLogEntry>('foodLogEntries').bulkPut(
          entries.map((entry) => ({
            ...entry,
            mealType: isMealType(entry.mealType)
              ? entry.mealType
              : mealTypeForHour(new Date(entry.createdAt).getHours()),
          })),
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

    this.version(11)
      .stores({
        appMetadata: '&id',
        userSettings: '&id',
        nutritionTargets: '&id, updatedAt',
        foods: '&id, status, name, updatedAt',
        foodLogEntries: '&id, localDate, foodId, createdAt',
        savedMeals: '&id, status, name, updatedAt',
        foodUnitPreferences: '&id, foodId, updatedAt',
        barcodeProductCache: '&id, &barcode, foodId, updatedAt',
        bodyweightEntries: '&id, localDate, createdAt, updatedAt',
        exercises:
          '&id, status, origin, seedDataVersion, name, trackingMethodId, updatedAt',
        programTemplates: '&id, status, name, lastActiveAt, updatedAt',
        templateWorkoutDays: '&id, templateId, [templateId+orderIndex]',
        templateWorkoutExercises:
          '&id, templateId, dayId, exerciseId, [dayId+orderIndex]',
        activeProgramCycles:
          '&id, sourceTemplateId, status, activatedAt, updatedAt',
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

    this.version(12)
      .stores({
        appMetadata: '&id',
        userSettings: '&id',
        nutritionTargets: '&id, updatedAt',
        foods: '&id, status, name, updatedAt',
        foodLogEntries: '&id, localDate, foodId, createdAt',
        savedMeals: '&id, status, name, updatedAt',
        foodUnitPreferences: '&id, foodId, updatedAt',
        barcodeProductCache: '&id, &barcode, foodId, updatedAt',
        bodyweightEntries: '&id, localDate, createdAt, updatedAt',
        exercises:
          '&id, status, origin, seedDataVersion, name, trackingMethodId, updatedAt',
        programTemplates: '&id, status, name, lastActiveAt, updatedAt',
        templateWorkoutDays: '&id, templateId, [templateId+orderIndex]',
        templateWorkoutExercises:
          '&id, templateId, dayId, exerciseId, [dayId+orderIndex]',
        activeProgramCycles:
          '&id, sourceTemplateId, status, activatedAt, updatedAt',
        activeCycleDayChecks:
          '&id, activeCycleId, dayId, weekNumber, [activeCycleId+weekNumber], [activeCycleId+dayId+weekNumber]',
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

        // Give every existing program a planned length so the active-cycle card
        // can show "Week N". Existing templates (built-in and custom) default to
        // 10 weeks; active cycles inherit their source template's length.
        const templates = await tx
          .table<ProgramTemplate>('programTemplates')
          .toArray()
        const durationByTemplateId = new Map<string, number>()
        await Promise.all(
          templates.map((template) => {
            const durationWeeks =
              template.durationWeeks ?? DEFAULT_PROGRAM_DURATION_WEEKS
            durationByTemplateId.set(template.id, durationWeeks)
            return tx
              .table<ProgramTemplate>('programTemplates')
              .put({ ...template, durationWeeks, updatedAt: now })
          }),
        )

        const cycles = await tx
          .table<ActiveProgramCycle>('activeProgramCycles')
          .toArray()
        await Promise.all(
          cycles.map((cycle) => {
            const durationWeeks =
              cycle.durationWeeks ??
              (cycle.sourceTemplateId
                ? durationByTemplateId.get(cycle.sourceTemplateId)
                : undefined) ??
              DEFAULT_PROGRAM_DURATION_WEEKS
            return tx
              .table<ActiveProgramCycle>('activeProgramCycles')
              .put({ ...cycle, durationWeeks, updatedAt: now })
          }),
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

    this.version(14)
      .stores({
        appMetadata: '&id',
        userSettings: '&id',
        nutritionTargets: '&id, updatedAt',
        foods: '&id, status, name, updatedAt',
        foodLogEntries: '&id, localDate, foodId, createdAt',
        savedMeals: '&id, status, name, updatedAt',
        foodUnitPreferences: '&id, foodId, updatedAt',
        barcodeProductCache: '&id, &barcode, foodId, updatedAt',
        bodyweightEntries: '&id, localDate, createdAt, updatedAt',
        exercises:
          '&id, status, origin, seedDataVersion, name, trackingMethodId, updatedAt',
        programTemplates: '&id, status, name, lastActiveAt, updatedAt',
        templateWorkoutDays: '&id, templateId, [templateId+orderIndex]',
        templateWorkoutExercises:
          '&id, templateId, dayId, exerciseId, [dayId+orderIndex]',
        activeProgramCycles:
          '&id, sourceTemplateId, status, activatedAt, updatedAt',
        activeCycleDayChecks:
          '&id, activeCycleId, dayId, weekNumber, [activeCycleId+weekNumber], [activeCycleId+dayId+weekNumber]',
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
        await tx
          .table<Run>('runs')
          .toCollection()
          .modify((run) => {
            run.trackingMode ??= 'gps'
            run.treadmillStepCount ??= 0
            run.treadmillStrideMeters ??= null
          })
        const templateExerciseNotes = new Map(
          (
            await tx
              .table<TemplateWorkoutExercise>('templateWorkoutExercises')
              .toArray()
          ).map((exercise) => [exercise.id, exercise.notes]),
        )
        await tx
          .table<ActiveCycleWorkoutExercise>('activeCycleWorkoutExercises')
          .toCollection()
          .modify((exercise) => {
            if ((exercise.notes ?? '').trim() !== '') {
              return
            }
            const sourceNotes = exercise.sourceTemplateExerciseId
              ? templateExerciseNotes.get(exercise.sourceTemplateExerciseId)
              : undefined
            if (sourceNotes?.trim()) {
              exercise.notes = sourceNotes
            }
          })
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

    this.version(15)
      .stores({
        appMetadata: '&id',
        userSettings: '&id',
        nutritionTargets: '&id, updatedAt',
        foods: '&id, status, name, updatedAt',
        foodLogEntries: '&id, localDate, foodId, createdAt',
        savedMeals: '&id, status, name, updatedAt',
        foodUnitPreferences: '&id, foodId, updatedAt',
        barcodeProductCache: '&id, &barcode, foodId, updatedAt',
        bodyweightEntries: '&id, localDate, createdAt, updatedAt',
        exercises:
          '&id, status, origin, seedDataVersion, name, trackingMethodId, updatedAt',
        programTemplates: '&id, status, name, lastActiveAt, updatedAt',
        templateWorkoutDays: '&id, templateId, [templateId+orderIndex]',
        templateWorkoutExercises:
          '&id, templateId, dayId, exerciseId, [dayId+orderIndex]',
        activeProgramCycles:
          '&id, sourceTemplateId, status, activatedAt, updatedAt',
        activeCycleDayChecks:
          '&id, activeCycleId, dayId, weekNumber, [activeCycleId+weekNumber], [activeCycleId+dayId+weekNumber]',
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
        const cycles = await tx
          .table<ActiveProgramCycle>('activeProgramCycles')
          .toArray()
        await Promise.all(
          cycles.map(async (cycle) => {
            const [days, checks] = await Promise.all([
              tx
                .table<ActiveCycleWorkoutDay>('activeCycleWorkoutDays')
                .where({ activeCycleId: cycle.id })
                .toArray(),
              tx
                .table<ActiveCycleDayCheck>('activeCycleDayChecks')
                .where({ activeCycleId: cycle.id })
                .toArray(),
            ])
            await tx.table<ActiveProgramCycle>('activeProgramCycles').put({
              ...cycle,
              currentWeekNumber: completionProgramWeek(
                checks,
                days.map((day) => day.id),
              ),
              updatedAt: now,
            })
          }),
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

    this.version(16)
      .stores({
        appMetadata: '&id',
        userSettings: '&id',
        nutritionTargets: '&id, updatedAt',
        foods: '&id, status, name, updatedAt',
        foodLogEntries: '&id, localDate, foodId, createdAt',
        savedMeals: '&id, status, name, updatedAt',
        foodUnitPreferences: '&id, foodId, updatedAt',
        barcodeProductCache: '&id, &barcode, foodId, updatedAt',
        bodyweightEntries: '&id, localDate, createdAt, updatedAt',
        exercises:
          '&id, status, origin, seedDataVersion, name, trackingMethodId, updatedAt',
        programTemplates: '&id, status, name, lastActiveAt, updatedAt',
        templateWorkoutDays: '&id, templateId, [templateId+orderIndex]',
        templateWorkoutExercises:
          '&id, templateId, dayId, exerciseId, [dayId+orderIndex]',
        activeProgramCycles:
          '&id, sourceTemplateId, status, activatedAt, updatedAt',
        activeCycleDayChecks:
          '&id, activeCycleId, dayId, weekNumber, [activeCycleId+weekNumber], [activeCycleId+dayId+weekNumber]',
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
        const correctedServingAmounts = new Map<string, number>()

        await tx
          .table<Food>('foods')
          .toCollection()
          .modify((food) => {
            if (food.sourceType !== 'provider') {
              return
            }
            const correction = officialRestaurantMenuCorrectionFor(food)
            if (!correction) {
              return
            }

            correctedServingAmounts.set(food.id, correction.serving.quantity)
            food.brandName = correction.brandName
            food.foodCategory = 'Restaurant Foods'
            food.servingQuantity = correction.serving.quantity
            food.servingUnit = correction.serving.unit
            food.servingDescription = `${correction.serving.quantity} ${correction.serving.unit}`
            food.gramsPerServing = null
            food.ouncesPerServing = null
            food.servingConversionReliable = false
            food.servingConversionSource = 'none'
            food.caloriesPerServing = correction.macrosPerServing.calories
            food.proteinGramsPerServing =
              correction.macrosPerServing.proteinGrams
            food.carbohydrateGramsPerServing =
              correction.macrosPerServing.carbohydrateGrams
            food.fatGramsPerServing = correction.macrosPerServing.fatGrams
            food.providerDataType = 'Official restaurant menu correction'
            food.sourceName = correction.sourceName
            food.sourceUrl = correction.sourceUrl
            food.sourceUpdatedAt = correction.checkedAt
            food.providerIngestedAt = now
            food.normalizerVersion = FOOD_NORMALIZER_VERSION
            food.macroBasis = 'per_serving'
            food.updatedAt = now
          })

        await tx
          .table<FoodUnitPreference>('foodUnitPreferences')
          .toCollection()
          .modify((preference) => {
            const amount = correctedServingAmounts.get(preference.foodId)
            if (amount === undefined) {
              return
            }
            preference.unitKey = 'serving'
            preference.amount = amount
            preference.updatedAt = now
          })

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

    this.version(17)
      .stores({
        appMetadata: '&id',
        userSettings: '&id',
        nutritionTargets: '&id, updatedAt',
        foods: '&id, status, name, updatedAt',
        foodLogEntries: '&id, localDate, foodId, createdAt',
        savedMeals: '&id, status, name, updatedAt',
        foodUnitPreferences: '&id, foodId, updatedAt',
        barcodeProductCache: '&id, &barcode, foodId, updatedAt',
        bodyweightEntries: '&id, localDate, createdAt, updatedAt',
        exercises:
          '&id, status, origin, seedDataVersion, name, trackingMethodId, updatedAt',
        programTemplates: '&id, status, name, lastActiveAt, updatedAt',
        templateWorkoutDays: '&id, templateId, [templateId+orderIndex]',
        templateWorkoutExercises:
          '&id, templateId, dayId, exerciseId, [dayId+orderIndex]',
        activeProgramCycles:
          '&id, sourceTemplateId, status, activatedAt, updatedAt',
        activeCycleDayChecks:
          '&id, activeCycleId, dayId, weekNumber, [activeCycleId+weekNumber], [activeCycleId+dayId+weekNumber]',
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
        await tx
          .table<Workout>('workouts')
          .toCollection()
          .modify((workout) => {
            workout.pausedAt ??= null
          })
        await tx
          .table<WorkoutHistoryEntry>('workoutHistoryEntries')
          .toCollection()
          .modify((workout) => {
            workout.pausedAt ??= null
          })
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

    this.version(18)
      .stores({
        appMetadata: '&id',
        userSettings: '&id',
        nutritionTargets: '&id, updatedAt',
        foods: '&id, status, name, updatedAt',
        foodLogEntries: '&id, localDate, foodId, createdAt',
        savedMeals: '&id, status, name, updatedAt',
        foodUnitPreferences: '&id, foodId, updatedAt',
        barcodeProductCache: '&id, &barcode, foodId, updatedAt',
        bodyweightEntries: '&id, localDate, createdAt, updatedAt',
        exercises:
          '&id, status, origin, seedDataVersion, name, trackingMethodId, updatedAt',
        programTemplates: '&id, status, name, lastActiveAt, updatedAt',
        templateWorkoutDays: '&id, templateId, [templateId+orderIndex]',
        templateWorkoutExercises:
          '&id, templateId, dayId, exerciseId, [dayId+orderIndex]',
        activeProgramCycles:
          '&id, sourceTemplateId, status, activatedAt, updatedAt',
        activeCycleDayChecks:
          '&id, activeCycleId, dayId, weekNumber, [activeCycleId+weekNumber], [activeCycleId+dayId+weekNumber]',
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
        const workoutExercises = await tx
          .table<WorkoutExercise>('workoutExercises')
          .toArray()
        for (const exercise of workoutExercises) {
          const source = exercise.sourcePrescribedExerciseId
            ? await tx
                .table<ActiveCycleWorkoutExercise>(
                  'activeCycleWorkoutExercises',
                )
                .get(exercise.sourcePrescribedExerciseId)
            : undefined
          const firstSet = await tx
            .table<WorkoutSet>('workoutSets')
            .where({ workoutExerciseId: exercise.id })
            .first()
          await tx
            .table<WorkoutExercise>('workoutExercises')
            .update(exercise.id, {
              sessionTargetRepsMin:
                source?.targetRepsMin ??
                firstSet?.targetSnapshot?.targetRepsMin ??
                null,
              sessionTargetRepsMax:
                source?.targetRepsMax ??
                firstSet?.targetSnapshot?.targetRepsMax ??
                null,
              updatedAt: now,
            })
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

    this.version(19)
      .stores({
        appMetadata: '&id',
        userSettings: '&id',
        nutritionTargets: '&id, updatedAt',
        foods: '&id, status, name, updatedAt',
        foodLogEntries: '&id, localDate, foodId, createdAt',
        savedMeals: '&id, status, name, updatedAt',
        foodUnitPreferences: '&id, foodId, updatedAt',
        barcodeProductCache: '&id, &barcode, foodId, updatedAt',
        bodyweightEntries: '&id, localDate, createdAt, updatedAt',
        exercises:
          '&id, status, origin, seedDataVersion, name, trackingMethodId, updatedAt',
        programTemplates: '&id, status, name, lastActiveAt, updatedAt',
        templateWorkoutDays: '&id, templateId, [templateId+orderIndex]',
        templateWorkoutExercises:
          '&id, templateId, dayId, exerciseId, [dayId+orderIndex]',
        activeProgramCycles:
          '&id, sourceTemplateId, status, activatedAt, updatedAt',
        activeCycleDayChecks:
          '&id, activeCycleId, dayId, weekNumber, [activeCycleId+weekNumber], [activeCycleId+dayId+weekNumber]',
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
          await tx.table<UserSettings>('userSettings').update('settings', {
            rirTrackingEnabled: settings.rirTrackingEnabled ?? false,
            workoutAutofillMode: settings.workoutAutofillMode ?? 'history_copy',
            updatedAt: now,
          })
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

    this.version(20)
      .stores({
        appMetadata: '&id',
        userSettings: '&id',
        nutritionTargets: '&id, updatedAt',
        foods: '&id, status, name, updatedAt',
        foodLogEntries: '&id, localDate, foodId, createdAt',
        savedMeals: '&id, status, name, updatedAt',
        foodUnitPreferences: '&id, foodId, updatedAt',
        barcodeProductCache: '&id, &barcode, foodId, updatedAt',
        bodyweightEntries: '&id, localDate, createdAt, updatedAt',
        exercises:
          '&id, status, origin, seedDataVersion, name, trackingMethodId, updatedAt',
        programTemplates: '&id, status, name, lastActiveAt, updatedAt',
        templateWorkoutDays: '&id, templateId, [templateId+orderIndex]',
        templateWorkoutExercises:
          '&id, templateId, dayId, exerciseId, [dayId+orderIndex]',
        activeProgramCycles:
          '&id, sourceTemplateId, status, activatedAt, updatedAt',
        activeCycleDayChecks:
          '&id, activeCycleId, dayId, weekNumber, [activeCycleId+weekNumber], [activeCycleId+dayId+weekNumber]',
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
          await tx.table<UserSettings>('userSettings').update('settings', {
            historySortMode: settings.historySortMode ?? 'recent',
            historyProgramId: settings.historyProgramId ?? null,
            updatedAt: now,
          })
        }
        const templates = await tx
          .table<ProgramTemplate>('programTemplates')
          .toArray()
        for (const template of templates) {
          await tx
            .table<ProgramTemplate>('programTemplates')
            .update(template.id, {
              deloadWeekNumbers: template.deloadWeekNumbers ?? [],
              updatedAt: now,
            })
        }
        const cycles = await tx
          .table<ActiveProgramCycle>('activeProgramCycles')
          .toArray()
        for (const cycle of cycles) {
          await tx
            .table<ActiveProgramCycle>('activeProgramCycles')
            .update(cycle.id, {
              deloadWeekNumbers: cycle.deloadWeekNumbers ?? [],
              updatedAt: now,
            })
        }
        for (const tableName of [
          'workouts',
          'workoutHistoryEntries',
        ] as const) {
          const workouts = await tx.table<Workout>(tableName).toArray()
          for (const workout of workouts) {
            await tx.table<Workout>(tableName).update(workout.id, {
              programWeekNumber: workout.programWeekNumber ?? null,
              isDeload: workout.isDeload ?? false,
            })
          }
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

    this.version(21).upgrade(async (tx) => {
      const templates = await tx
        .table<ProgramTemplate>('programTemplates')
        .toArray()
      for (const template of templates) {
        const existingWeeks = template.deloadWeekNumbers ?? []
        await tx
          .table<ProgramTemplate>('programTemplates')
          .update(template.id, {
            deloadSchedulingEnabled:
              template.deloadSchedulingEnabled ?? existingWeeks.length > 0,
            deloadWeekNumbers: existingWeeks.length
              ? existingWeeks
              : [...DEFAULT_DELOAD_WEEK_NUMBERS],
          })
      }

      const cycles = await tx
        .table<ActiveProgramCycle>('activeProgramCycles')
        .toArray()
      for (const cycle of cycles) {
        const existingWeeks = cycle.deloadWeekNumbers ?? []
        await tx
          .table<ActiveProgramCycle>('activeProgramCycles')
          .update(cycle.id, {
            deloadSchedulingEnabled:
              cycle.deloadSchedulingEnabled ?? existingWeeks.length > 0,
            deloadWeekNumbers: existingWeeks.length
              ? existingWeeks
              : [...DEFAULT_DELOAD_WEEK_NUMBERS],
          })
      }

      const metadata = await tx.table<AppMetadata>('appMetadata').get('app')
      if (metadata) {
        await tx.table<AppMetadata>('appMetadata').put({
          ...metadata,
          databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
          backupSchemaVersion: BACKUP_SCHEMA_VERSION,
          updatedAt: new Date().toISOString(),
        })
      }
    })

    // Per-exercise smart-progression state. The store starts empty; states are
    // created lazily the first time an exercise is progressed, seeded from the
    // user's chosen baseline experience level.
    this.version(22)
      .stores({
        exerciseProgressionStates: '&exerciseId, updatedAt',
      })
      .upgrade(async (tx) => {
        const metadata = await tx.table<AppMetadata>('appMetadata').get('app')
        if (metadata) {
          await tx.table<AppMetadata>('appMetadata').put({
            ...metadata,
            databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
            backupSchemaVersion: BACKUP_SCHEMA_VERSION,
            updatedAt: new Date().toISOString(),
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
    bodyweightLoadMode: exercise.bodyweightLoadMode ?? 'external_weight_only',
    bodyweightPercentage: exercise.bodyweightPercentage ?? null,
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
