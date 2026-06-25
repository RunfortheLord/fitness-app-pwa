import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  BACKUP_SCHEMA_VERSION,
  DATABASE_SCHEMA_VERSION,
  TrainingLogDatabase,
} from '@db/database'
import { diagnoseDatabaseHealth } from '@db/health'
import { mealTypeForHour } from '@domain/meals'
import { createAppMetadataRepository } from '@repositories/appMetadataRepository'
import { createTestDatabase, destroyTestDatabase } from '@test/database'

describe('database', () => {
  let database: TrainingLogDatabase

  beforeEach(() => {
    database = createTestDatabase()
  })

  afterEach(async () => {
    await destroyTestDatabase(database)
  })

  it('reports healthy schema diagnostics', async () => {
    await createAppMetadataRepository(database).ensureAppMetadata()

    const diagnostic = await diagnoseDatabaseHealth(database)

    expect(diagnostic).toMatchObject({
      ok: true,
      databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
      backupSchemaVersion: BACKUP_SCHEMA_VERSION,
    })
    expect(diagnostic.storesChecked).toContain('appliedWorkoutChanges')
  })

  it('migrates v1 metadata to the current schema version', async () => {
    const name = `training-log-migration-${crypto.randomUUID()}`
    const oldDatabase = new Dexie(name)
    oldDatabase.version(1).stores({
      appMetadata: '&id',
      userSettings: '&id',
    })
    await oldDatabase.table('appMetadata').put({
      id: 'app',
      databaseSchemaVersion: 1,
      backupSchemaVersion: 1,
      createdAt: '2026-06-18T12:00:00.000Z',
      updatedAt: '2026-06-18T12:00:00.000Z',
    })
    await oldDatabase.table('userSettings').put({
      id: 'settings',
      weightUnit: 'lb',
      energyUnit: 'kcal',
      createdAt: '2026-06-18T12:01:00.000Z',
      updatedAt: '2026-06-18T12:01:00.000Z',
    })
    oldDatabase.close()

    const migratedDatabase = new TrainingLogDatabase(name)
    const metadata = await migratedDatabase.appMetadata.get('app')
    const settings = await migratedDatabase.userSettings.get('settings')

    expect(metadata).toMatchObject({
      id: 'app',
      databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
      backupSchemaVersion: BACKUP_SCHEMA_VERSION,
    })
    expect(settings).toMatchObject({
      id: 'settings',
      weightUnit: 'lb',
      energyUnit: 'kcal',
      nutritionTargets: {
        calories: 0,
        proteinGrams: 0,
        carbohydrateGrams: 0,
        fatGrams: 0,
      },
      createdAt: '2026-06-18T12:01:00.000Z',
    })
    expect(migratedDatabase.tables.map((table) => table.name)).toContain(
      'backupMetadata',
    )

    await destroyTestDatabase(migratedDatabase)
  })

  it('migrates v2 exercises without changing program, active-workout, or history references', async () => {
    const name = `training-log-v2-exercise-migration-${crypto.randomUUID()}`
    const oldDatabase = new Dexie(name)
    oldDatabase.version(2).stores(v2Stores)
    await oldDatabase.table('appMetadata').put({
      id: 'app',
      databaseSchemaVersion: 2,
      backupSchemaVersion: 1,
      createdAt: '2026-06-18T12:00:00.000Z',
      updatedAt: '2026-06-18T12:00:00.000Z',
    })
    await oldDatabase.table('exercises').put({
      id: 'custom-bench',
      name: 'Custom Bench',
      notes: '',
      defaultRestSeconds: 120,
      trackingMethodId: 'weight_reps',
      trackingMetrics: [
        {
          key: 'weight',
          label: 'Weight',
          valueType: 'number',
          unit: 'lb',
          requiredForCompletion: true,
        },
        {
          key: 'reps',
          label: 'Reps',
          valueType: 'integer',
          unit: null,
          requiredForCompletion: true,
        },
      ],
      status: 'active',
      createdAt: '2026-06-18T12:00:00.000Z',
      updatedAt: '2026-06-18T12:00:00.000Z',
    })
    await oldDatabase.table('programTemplates').put({
      id: 'template-1',
      name: 'Program',
      notes: '',
      status: 'active',
      createdAt: '2026-06-18T12:00:00.000Z',
      updatedAt: '2026-06-18T12:00:00.000Z',
    })
    await oldDatabase.table('templateWorkoutDays').put({
      id: 'template-day-1',
      templateId: 'template-1',
      name: 'Day',
      notes: '',
      orderIndex: 0,
      createdAt: '2026-06-18T12:00:00.000Z',
      updatedAt: '2026-06-18T12:00:00.000Z',
    })
    await oldDatabase.table('templateWorkoutExercises').put({
      id: 'template-exercise-1',
      templateId: 'template-1',
      dayId: 'template-day-1',
      exerciseId: 'custom-bench',
      exerciseSnapshot: {
        exerciseName: 'Custom Bench',
        notes: '',
        defaultRestSeconds: 120,
        trackingMethodId: 'weight_reps',
        trackingMetrics: [],
      },
      orderIndex: 0,
      targetSetCount: 3,
      targetRepsMin: null,
      targetRepsMax: null,
      targetRir: null,
      restSecondsOverride: null,
      notes: '',
      createdAt: '2026-06-18T12:00:00.000Z',
      updatedAt: '2026-06-18T12:00:00.000Z',
    })
    await oldDatabase.table('activeProgramCycles').put({
      id: 'cycle-1',
      sourceTemplateId: 'template-1',
      name: 'Program',
      notes: '',
      status: 'active',
      activatedAt: '2026-06-18T12:00:00.000Z',
      createdAt: '2026-06-18T12:00:00.000Z',
      updatedAt: '2026-06-18T12:00:00.000Z',
    })
    await oldDatabase.table('activeCycleWorkoutDays').put({
      id: 'active-day-1',
      activeCycleId: 'cycle-1',
      sourceTemplateDayId: 'template-day-1',
      name: 'Day',
      notes: '',
      orderIndex: 0,
      createdAt: '2026-06-18T12:00:00.000Z',
      updatedAt: '2026-06-18T12:00:00.000Z',
    })
    await oldDatabase.table('activeCycleWorkoutExercises').put({
      id: 'active-exercise-1',
      activeCycleId: 'cycle-1',
      dayId: 'active-day-1',
      sourceTemplateExerciseId: 'template-exercise-1',
      exerciseId: 'custom-bench',
      exerciseSnapshot: {
        exerciseName: 'Custom Bench',
        notes: '',
        defaultRestSeconds: 120,
        trackingMethodId: 'weight_reps',
        trackingMetrics: [],
      },
      orderIndex: 0,
      targetSetCount: 3,
      targetRepsMin: null,
      targetRepsMax: null,
      targetRir: null,
      restSecondsOverride: null,
      notes: '',
      createdAt: '2026-06-18T12:00:00.000Z',
      updatedAt: '2026-06-18T12:00:00.000Z',
    })
    await oldDatabase.table('workouts').put({
      id: 'workout-1',
      sourceActiveCycleId: 'cycle-1',
      sourceTemplateId: 'template-1',
      sourceDayId: 'active-day-1',
      localDate: '2026-06-18',
      name: 'Day',
      workoutSnapshot: {
        activeCycleName: 'Program',
        templateName: 'Program',
        dayName: 'Day',
        dayNotes: '',
      },
      notes: '',
      startedAt: '2026-06-18T12:00:00.000Z',
      completedAt: null,
      durationSeconds: null,
      elapsedPausedSeconds: 0,
      activeRestTimer: null,
      status: 'active',
      createdAt: '2026-06-18T12:00:00.000Z',
      updatedAt: '2026-06-18T12:00:00.000Z',
    })
    await oldDatabase.table('workoutExercises').put({
      id: 'workout-exercise-1',
      workoutId: 'workout-1',
      exerciseId: 'custom-bench',
      exerciseSnapshot: {
        exerciseName: 'Custom Bench',
        notes: '',
        defaultRestSeconds: 120,
        trackingMethodId: 'weight_reps',
        trackingMetrics: [],
      },
      sourcePrescribedExerciseId: 'active-exercise-1',
      orderIndex: 0,
      notes: '',
      skipped: false,
      replacementOfExerciseId: null,
      createdAt: '2026-06-18T12:00:00.000Z',
      updatedAt: '2026-06-18T12:00:00.000Z',
    })
    await oldDatabase.table('workoutHistoryEntries').put({
      id: 'history-1',
      sourceActiveCycleId: 'cycle-1',
      sourceTemplateId: 'template-1',
      sourceDayId: 'active-day-1',
      localDate: '2026-06-18',
      name: 'Day',
      workoutSnapshot: {
        activeCycleName: 'Program',
        templateName: 'Program',
        dayName: 'Day',
        dayNotes: '',
      },
      notes: '',
      startedAt: '2026-06-18T12:00:00.000Z',
      completedAt: '2026-06-18T13:00:00.000Z',
      durationSeconds: 3600,
      elapsedPausedSeconds: 0,
      activeRestTimer: null,
      status: 'completed',
      createdAt: '2026-06-18T13:00:00.000Z',
      updatedAt: '2026-06-18T13:00:00.000Z',
    })
    await oldDatabase.table('workoutHistoryExercises').put({
      id: 'history-exercise-1',
      workoutId: 'history-1',
      exerciseId: 'custom-bench',
      exerciseSnapshot: {
        exerciseName: 'Custom Bench',
        notes: '',
        defaultRestSeconds: 120,
        trackingMethodId: 'weight_reps',
        trackingMetrics: [],
      },
      sourcePrescribedExerciseId: 'active-exercise-1',
      orderIndex: 0,
      notes: '',
      skipped: false,
      replacementOfExerciseId: null,
      createdAt: '2026-06-18T13:00:00.000Z',
      updatedAt: '2026-06-18T13:00:00.000Z',
    })
    oldDatabase.close()

    const migratedDatabase = new TrainingLogDatabase(name)

    await expect(
      migratedDatabase.exercises.get('custom-bench'),
    ).resolves.toMatchObject({
      id: 'custom-bench',
      origin: 'custom',
      seedDataVersion: null,
      equipmentType: 'barbell',
      defaultWeightIncrement: 5,
      recordsRepsPerSide: false,
    })
    await expect(
      migratedDatabase.templateWorkoutExercises.get('template-exercise-1'),
    ).resolves.toMatchObject({ exerciseId: 'custom-bench' })
    await expect(
      migratedDatabase.workoutExercises.get('workout-exercise-1'),
    ).resolves.toMatchObject({ exerciseId: 'custom-bench' })
    await expect(
      migratedDatabase.workoutHistoryExercises.get('history-exercise-1'),
    ).resolves.toMatchObject({ exerciseId: 'custom-bench' })

    await destroyTestDatabase(migratedDatabase)
  })

  it('migrates bodyweight entries to allow multiple records per local date', async () => {
    const name = `training-log-v3-bodyweight-migration-${crypto.randomUUID()}`
    const oldDatabase = new Dexie(name)
    oldDatabase.version(3).stores(v3Stores)
    await oldDatabase.table('appMetadata').put({
      id: 'app',
      databaseSchemaVersion: 3,
      backupSchemaVersion: 1,
      createdAt: '2026-06-18T12:00:00.000Z',
      updatedAt: '2026-06-18T12:00:00.000Z',
    })
    await oldDatabase.table('bodyweightEntries').put({
      id: 'bodyweight-a',
      localDate: '2026-06-18',
      weight: 188,
      unit: 'lb',
      notes: '',
      createdAt: '2026-06-18T12:00:00.000Z',
      updatedAt: '2026-06-18T12:00:00.000Z',
    })
    oldDatabase.close()

    const migratedDatabase = new TrainingLogDatabase(name)
    await migratedDatabase.bodyweightEntries.add({
      id: 'bodyweight-b',
      localDate: '2026-06-18',
      weight: 189,
      unit: 'lb',
      notes: '',
      createdAt: '2026-06-18T23:00:00.000Z',
      updatedAt: '2026-06-18T23:00:00.000Z',
    })

    await expect(
      migratedDatabase.bodyweightEntries
        .where({ localDate: '2026-06-18' })
        .toArray(),
    ).resolves.toHaveLength(2)
    await expect(
      migratedDatabase.appMetadata.get('app'),
    ).resolves.toMatchObject({
      databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
    })

    await destroyTestDatabase(migratedDatabase)
  })

  it('migrates v6 workout sets with empty metric value source metadata', async () => {
    const name = `training-log-v6-set-source-migration-${crypto.randomUUID()}`
    const oldDatabase = new Dexie(name)
    oldDatabase.version(6).stores(v6Stores)
    await oldDatabase.table('appMetadata').put({
      id: 'app',
      databaseSchemaVersion: 6,
      backupSchemaVersion: 1,
      createdAt: '2026-06-18T12:00:00.000Z',
      updatedAt: '2026-06-18T12:00:00.000Z',
    })
    await oldDatabase.table('workoutSets').put({
      id: 'set-1',
      workoutId: 'workout-1',
      workoutExerciseId: 'workout-exercise-1',
      setNumber: 1,
      targetSnapshot: null,
      targetRecommendation: null,
      metricValues: { weight: 185, reps: 5 },
      rir: null,
      completed: false,
      completedAt: null,
      restSecondsUsed: null,
      createdAt: '2026-06-18T12:00:00.000Z',
      updatedAt: '2026-06-18T12:00:00.000Z',
    })
    await oldDatabase.table('workoutHistorySets').put({
      id: 'history-set-1',
      workoutId: 'history-1',
      workoutExerciseId: 'history-exercise-1',
      setNumber: 1,
      targetSnapshot: null,
      targetRecommendation: null,
      metricValues: { weight: 185, reps: 5 },
      rir: 1,
      completed: true,
      completedAt: '2026-06-18T12:05:00.000Z',
      restSecondsUsed: 120,
    })
    oldDatabase.close()

    const migratedDatabase = new TrainingLogDatabase(name)

    await expect(
      migratedDatabase.workoutSets.get('set-1'),
    ).resolves.toMatchObject({
      metricValues: { weight: 185, reps: 5 },
      metricValueSources: {},
    })
    await expect(
      migratedDatabase.workoutHistorySets.get('history-set-1'),
    ).resolves.toMatchObject({
      metricValues: { weight: 185, reps: 5 },
      metricValueSources: {},
    })
    await expect(
      migratedDatabase.appMetadata.get('app'),
    ).resolves.toMatchObject({
      databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
    })

    await destroyTestDatabase(migratedDatabase)
  })

  it('migrates legacy program archive, notes, and duration targets into the library model', async () => {
    const name = `training-log-v9-program-migration-${crypto.randomUUID()}`
    const oldDatabase = new Dexie(name)
    oldDatabase.version(6).stores(v6Stores)
    await oldDatabase.table('appMetadata').put({
      id: 'app',
      databaseSchemaVersion: 6,
      backupSchemaVersion: 1,
      createdAt: '2026-06-18T12:00:00.000Z',
      updatedAt: '2026-06-18T12:00:00.000Z',
    })
    await oldDatabase.table('programTemplates').put({
      id: 'template-1',
      name: 'Archived Program',
      notes: 'legacy note',
      status: 'archived',
      createdAt: '2026-06-18T12:00:00.000Z',
      updatedAt: '2026-06-18T12:00:00.000Z',
    })
    await oldDatabase.table('templateWorkoutDays').put({
      id: 'day-1',
      templateId: 'template-1',
      name: 'Day',
      notes: 'legacy day note',
      orderIndex: 0,
      createdAt: '2026-06-18T12:00:00.000Z',
      updatedAt: '2026-06-18T12:00:00.000Z',
    })
    await oldDatabase.table('templateWorkoutExercises').put({
      id: 'exercise-1',
      templateId: 'template-1',
      dayId: 'day-1',
      exerciseId: 'custom-exercise',
      exerciseSnapshot: {
        exerciseName: 'Timed Plank',
        notes: '',
        defaultRestSeconds: 60,
        trackingMethodId: 'duration',
        trackingMetrics: [],
      },
      orderIndex: 0,
      targetSetCount: 1,
      targetDurationSeconds: 60,
      targetRepsMin: null,
      targetRepsMax: null,
      targetRir: null,
      restSecondsOverride: null,
      notes: 'legacy prescription note',
      createdAt: '2026-06-18T12:00:00.000Z',
      updatedAt: '2026-06-18T12:00:00.000Z',
    })
    await oldDatabase.table('activeProgramCycles').put({
      id: 'cycle-1',
      sourceTemplateId: 'template-1',
      name: 'Archived Program',
      notes: 'legacy cycle note',
      status: 'archived',
      activatedAt: '2026-06-19T12:00:00.000Z',
      createdAt: '2026-06-19T12:00:00.000Z',
      updatedAt: '2026-06-19T12:00:00.000Z',
    })
    await oldDatabase.table('workoutHistoryEntries').put({
      id: 'history-1',
      sourceActiveCycleId: 'cycle-1',
      sourceTemplateId: 'template-1',
      sourceDayId: 'day-1',
      localDate: '2026-06-19',
      name: 'Day',
      workoutSnapshot: {
        activeCycleName: 'Archived Program',
        templateName: 'Archived Program',
        dayName: 'Day',
        dayNotes: 'legacy day note',
      },
      notes: '',
      startedAt: '2026-06-19T12:00:00.000Z',
      completedAt: '2026-06-19T12:30:00.000Z',
      durationSeconds: 1800,
      elapsedPausedSeconds: 0,
      activeRestTimer: null,
      status: 'completed',
      createdAt: '2026-06-19T12:30:00.000Z',
      updatedAt: '2026-06-19T12:30:00.000Z',
    })
    oldDatabase.close()

    const migratedDatabase = new TrainingLogDatabase(name)

    await expect(
      migratedDatabase.programTemplates.get('template-1'),
    ).resolves.toMatchObject({
      notes: '',
      status: 'active',
      lastActiveAt: '2026-06-19T12:00:00.000Z',
    })
    await expect(
      migratedDatabase.templateWorkoutDays.get('day-1'),
    ).resolves.toMatchObject({ notes: '' })
    await expect(
      migratedDatabase.templateWorkoutExercises.get('exercise-1'),
    ).resolves.toMatchObject({
      targetDurationSeconds: null,
      notes: '',
    })
    await expect(
      migratedDatabase.activeProgramCycles.get('cycle-1'),
    ).resolves.toMatchObject({ notes: '', status: 'inactive' })
    await expect(
      migratedDatabase.workoutHistoryEntries.get('history-1'),
    ).resolves.toMatchObject({
      workoutSnapshot: {
        templateName: 'Archived Program',
        dayName: 'Day',
      },
    })

    await destroyTestDatabase(migratedDatabase)
  })

  it('backfills a meal on existing food logs when migrating to v10', async () => {
    const name = `training-log-v10-meal-migration-${crypto.randomUUID()}`
    const oldDatabase = new Dexie(name)
    oldDatabase.version(9).stores(v9Stores)
    await oldDatabase.table('appMetadata').put({
      id: 'app',
      databaseSchemaVersion: 9,
      backupSchemaVersion: 1,
      createdAt: '2026-06-18T12:00:00.000Z',
      updatedAt: '2026-06-18T12:00:00.000Z',
    })
    const legacyCreatedAt = '2026-06-18T08:30:00.000Z'
    // The backfill infers the meal from the log's local time of day, so derive
    // the expectation the same way to stay timezone-independent.
    const expectedInferredMeal = mealTypeForHour(
      new Date(legacyCreatedAt).getHours(),
    )
    await oldDatabase.table('foodLogEntries').put({
      id: 'legacy-log',
      localDate: '2026-06-18',
      foodId: 'food-1',
      foodSnapshot: {
        foodName: 'Oats',
        servingQuantity: 1,
        servingUnit: 'cup',
        servingDescription: '',
        caloriesPerServing: 150,
        proteinGramsPerServing: 5,
        carbohydrateGramsPerServing: 27,
        fatGramsPerServing: 3,
        notes: '',
      },
      servingMultiplier: 1,
      computedCalories: 150,
      computedProteinGrams: 5,
      computedCarbohydrateGrams: 27,
      computedFatGrams: 3,
      notes: '',
      createdAt: legacyCreatedAt,
      updatedAt: legacyCreatedAt,
    })
    await oldDatabase.table('foodLogEntries').put({
      id: 'already-tagged-log',
      localDate: '2026-06-18',
      foodId: 'food-2',
      foodSnapshot: {
        foodName: 'Steak',
        servingQuantity: 4,
        servingUnit: 'oz',
        servingDescription: '',
        caloriesPerServing: 200,
        proteinGramsPerServing: 30,
        carbohydrateGramsPerServing: 0,
        fatGramsPerServing: 9,
        notes: '',
      },
      mealType: 'dinner',
      servingMultiplier: 1,
      computedCalories: 200,
      computedProteinGrams: 30,
      computedCarbohydrateGrams: 0,
      computedFatGrams: 9,
      notes: '',
      createdAt: '2026-06-18T19:00:00.000Z',
      updatedAt: '2026-06-18T19:00:00.000Z',
    })
    oldDatabase.close()

    const migratedDatabase = new TrainingLogDatabase(name)

    await expect(
      migratedDatabase.foodLogEntries.get('legacy-log'),
    ).resolves.toMatchObject({ mealType: expectedInferredMeal })
    await expect(
      migratedDatabase.foodLogEntries.get('already-tagged-log'),
    ).resolves.toMatchObject({ mealType: 'dinner' })
    await expect(
      migratedDatabase.appMetadata.get('app'),
    ).resolves.toMatchObject({
      databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
    })

    await destroyTestDatabase(migratedDatabase)
  })
})

const v2Stores = {
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
  workoutHistoryExercises: '&id, workoutId, exerciseId, [workoutId+orderIndex]',
  workoutHistorySets:
    '&id, workoutId, workoutExerciseId, [workoutExerciseId+setNumber]',
  detectedWorkoutChanges: '&id, workoutId, status, type, createdAt',
  appliedWorkoutChanges: '&id, detectedChangeId, workoutId, appliedAt',
  backupMetadata: '&id, createdAt',
}

const v3Stores = {
  ...v2Stores,
  exercises:
    '&id, status, origin, seedDataVersion, name, trackingMethodId, updatedAt',
}

const v6Stores = {
  ...v3Stores,
  bodyweightEntries: '&id, localDate, createdAt, updatedAt',
  runs: '&id, status, localDate, startedAt, completedAt',
  runSamples:
    '&id, runId, timestamp, decision, rejectionReason, [runId+timestamp]',
  runPauses: '&id, runId, startedAt, endedAt',
  runSplits: '&id, runId, mileNumber, completedAt',
  runClassifications: '&id, runId, type, startedAt',
  apiKeyIntegrationSettings: '&id, status, updatedAt',
}

const v9Stores = {
  ...v6Stores,
  foodUnitPreferences: '&id, foodId, updatedAt',
  barcodeProductCache: '&id, &barcode, foodId, updatedAt',
  programTemplates: '&id, status, name, lastActiveAt, updatedAt',
  activeProgramCycles: '&id, sourceTemplateId, status, activatedAt, updatedAt',
}
