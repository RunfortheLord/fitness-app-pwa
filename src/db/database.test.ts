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

  it('exposes the saved meals store at the current schema version', async () => {
    const database = createTestDatabase()
    expect(database.tables.map((table) => table.name)).toContain('savedMeals')
    await destroyTestDatabase(database)
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

  it('backfills GPS tracking metadata on existing runs when migrating to v13', async () => {
    const name = `training-log-v13-run-migration-${crypto.randomUUID()}`
    const oldDatabase = new Dexie(name)
    oldDatabase.version(12).stores({
      appMetadata: '&id',
      runs: '&id, status, localDate, startedAt, completedAt',
    })
    await oldDatabase.table('appMetadata').put({
      id: 'app',
      databaseSchemaVersion: 12,
      backupSchemaVersion: 1,
      createdAt: '2026-06-18T12:00:00.000Z',
      updatedAt: '2026-06-18T12:00:00.000Z',
    })
    await oldDatabase.table('runs').put({
      id: 'legacy-run',
      localDate: '2026-06-18',
      status: 'completed',
      startedAt: '2026-06-18T12:00:00.000Z',
      completedAt: '2026-06-18T12:30:00.000Z',
      elapsedSeconds: 1800,
      movingSeconds: 1700,
      distanceMeters: 5000,
      currentPaceSecondsPerMile: null,
      averageMovingPaceSecondsPerMile: 547,
      hasGpsGap: false,
      lowPaceAlertedAt: null,
      notes: '',
      createdAt: '2026-06-18T12:00:00.000Z',
      updatedAt: '2026-06-18T12:30:00.000Z',
    })
    oldDatabase.close()

    const migratedDatabase = new TrainingLogDatabase(name)

    await expect(
      migratedDatabase.runs.get('legacy-run'),
    ).resolves.toMatchObject({
      trackingMode: 'gps',
      treadmillStepCount: 0,
      treadmillStrideMeters: null,
    })
    await expect(
      migratedDatabase.appMetadata.get('app'),
    ).resolves.toMatchObject({
      databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
    })

    await destroyTestDatabase(migratedDatabase)
  })

  it('backfills blank active-cycle exercise notes from source template exercises when migrating to v14', async () => {
    const name = `training-log-v14-active-exercise-notes-${crypto.randomUUID()}`
    const oldDatabase = new Dexie(name)
    oldDatabase.version(13).stores({
      appMetadata: '&id',
      templateWorkoutExercises:
        '&id, templateId, dayId, exerciseId, [dayId+orderIndex]',
      activeCycleWorkoutExercises:
        '&id, activeCycleId, dayId, exerciseId, sourceTemplateExerciseId, [dayId+orderIndex]',
      runs: '&id, status, localDate, startedAt, completedAt',
    })
    await oldDatabase.table('appMetadata').put({
      id: 'app',
      databaseSchemaVersion: 13,
      backupSchemaVersion: 1,
      createdAt: '2026-06-18T12:00:00.000Z',
      updatedAt: '2026-06-18T12:00:00.000Z',
    })
    await oldDatabase.table('templateWorkoutExercises').bulkPut([
      {
        id: 'template-exercise-with-notes',
        templateId: 'template-1',
        dayId: 'template-day-1',
        exerciseId: 'exercise-1',
        exerciseSnapshot: {},
        orderIndex: 0,
        targetSetCount: 2,
        targetWeight: null,
        targetDurationSeconds: null,
        targetDistance: null,
        targetRepsMin: 5,
        targetRepsMax: 8,
        targetRir: 2,
        restSecondsOverride: null,
        notes: 'Use a full pause.',
        createdAt: '2026-06-18T12:00:00.000Z',
        updatedAt: '2026-06-18T12:00:00.000Z',
      },
      {
        id: 'template-exercise-without-notes',
        templateId: 'template-1',
        dayId: 'template-day-1',
        exerciseId: 'exercise-2',
        exerciseSnapshot: {},
        orderIndex: 1,
        targetSetCount: 2,
        targetWeight: null,
        targetDurationSeconds: null,
        targetDistance: null,
        targetRepsMin: 5,
        targetRepsMax: 8,
        targetRir: 2,
        restSecondsOverride: null,
        notes: '',
        createdAt: '2026-06-18T12:00:00.000Z',
        updatedAt: '2026-06-18T12:00:00.000Z',
      },
    ])
    await oldDatabase.table('activeCycleWorkoutExercises').bulkPut([
      {
        id: 'active-exercise-blank',
        activeCycleId: 'cycle-1',
        dayId: 'active-day-1',
        sourceTemplateExerciseId: 'template-exercise-with-notes',
        exerciseId: 'exercise-1',
        exerciseSnapshot: {},
        orderIndex: 0,
        targetSetCount: 2,
        targetWeight: null,
        targetDurationSeconds: null,
        targetDistance: null,
        targetRepsMin: 5,
        targetRepsMax: 8,
        targetRir: 2,
        restSecondsOverride: null,
        notes: '',
        createdAt: '2026-06-18T12:00:00.000Z',
        updatedAt: '2026-06-18T12:00:00.000Z',
      },
      {
        id: 'active-exercise-existing',
        activeCycleId: 'cycle-1',
        dayId: 'active-day-1',
        sourceTemplateExerciseId: 'template-exercise-with-notes',
        exerciseId: 'exercise-1',
        exerciseSnapshot: {},
        orderIndex: 1,
        targetSetCount: 2,
        targetWeight: null,
        targetDurationSeconds: null,
        targetDistance: null,
        targetRepsMin: 5,
        targetRepsMax: 8,
        targetRir: 2,
        restSecondsOverride: null,
        notes: 'Keep this active-cycle note.',
        createdAt: '2026-06-18T12:00:00.000Z',
        updatedAt: '2026-06-18T12:00:00.000Z',
      },
      {
        id: 'active-exercise-no-source-notes',
        activeCycleId: 'cycle-1',
        dayId: 'active-day-1',
        sourceTemplateExerciseId: 'template-exercise-without-notes',
        exerciseId: 'exercise-2',
        exerciseSnapshot: {},
        orderIndex: 2,
        targetSetCount: 2,
        targetWeight: null,
        targetDurationSeconds: null,
        targetDistance: null,
        targetRepsMin: 5,
        targetRepsMax: 8,
        targetRir: 2,
        restSecondsOverride: null,
        notes: '',
        createdAt: '2026-06-18T12:00:00.000Z',
        updatedAt: '2026-06-18T12:00:00.000Z',
      },
    ])
    oldDatabase.close()

    const migratedDatabase = new TrainingLogDatabase(name)

    await expect(
      migratedDatabase.activeCycleWorkoutExercises.get('active-exercise-blank'),
    ).resolves.toMatchObject({ notes: 'Use a full pause.' })
    await expect(
      migratedDatabase.activeCycleWorkoutExercises.get(
        'active-exercise-existing',
      ),
    ).resolves.toMatchObject({ notes: 'Keep this active-cycle note.' })
    await expect(
      migratedDatabase.activeCycleWorkoutExercises.get(
        'active-exercise-no-source-notes',
      ),
    ).resolves.toMatchObject({ notes: '' })
    await expect(
      migratedDatabase.appMetadata.get('app'),
    ).resolves.toMatchObject({
      databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
    })

    await destroyTestDatabase(migratedDatabase)
  })

  it('repairs reusable official restaurant foods without mutating historical snapshots when migrating to v16', async () => {
    const name = `training-log-v16-restaurant-corrections-${crypto.randomUUID()}`
    const oldDatabase = new Dexie(name)
    oldDatabase.version(15).stores({
      appMetadata: '&id',
      foods: '&id, status, name, updatedAt',
      foodLogEntries: '&id, localDate, foodId, createdAt',
      savedMeals: '&id, status, name, updatedAt',
      foodUnitPreferences: '&id, foodId, updatedAt',
    })
    const timestamp = '2026-07-18T12:00:00.000Z'
    await oldDatabase.table('appMetadata').put({
      id: 'app',
      databaseSchemaVersion: 15,
      backupSchemaVersion: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await oldDatabase.table('foods').bulkPut([
      {
        id: 'usda:170790',
        name: 'CHICK-FIL-A, chicken sandwich',
        sourceType: 'provider',
        provider: 'usda',
        providerRecordId: '170790',
        servingQuantity: 1,
        servingUnit: 'sandwich',
        servingDescription: '1 sandwich',
        gramsPerServing: 187,
        ouncesPerServing: 6.596,
        servingConversionReliable: true,
        servingConversionSource: 'provider_portion_weight',
        caloriesPerServing: 465.63,
        proteinGramsPerServing: 30.44,
        carbohydrateGramsPerServing: 39.06,
        fatGramsPerServing: 20.93,
        macroBasis: 'both',
        notes: 'Keep this note.',
        status: 'active',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: 'usda:173297',
        name: "McDONALD'S, Chicken McNUGGETS",
        sourceType: 'provider',
        provider: 'usda',
        providerRecordId: '173297',
        servingQuantity: 6,
        servingUnit: 'pieces',
        servingDescription: '6 pieces',
        gramsPerServing: 95,
        ouncesPerServing: 3.351,
        servingConversionReliable: true,
        servingConversionSource: 'provider_portion_weight',
        caloriesPerServing: 286.9,
        proteinGramsPerServing: 15,
        carbohydrateGramsPerServing: 14.34,
        fatGramsPerServing: 18.82,
        macroBasis: 'both',
        notes: '',
        status: 'active',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: 'usda:other-restaurant',
        name: 'Other restaurant burger',
        sourceType: 'provider',
        provider: 'usda',
        providerRecordId: '999999',
        servingQuantity: 1,
        servingUnit: 'burger',
        servingDescription: '1 burger',
        caloriesPerServing: 500,
        proteinGramsPerServing: 25,
        carbohydrateGramsPerServing: 40,
        fatGramsPerServing: 27,
        notes: '',
        status: 'active',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ])
    await oldDatabase.table('foodUnitPreferences').bulkPut([
      {
        id: 'pref-chick',
        foodId: 'usda:170790',
        unitKey: 'g',
        amount: 187,
        updatedAt: timestamp,
      },
      {
        id: 'pref-mcd',
        foodId: 'usda:173297',
        unitKey: 'g',
        amount: 95,
        updatedAt: timestamp,
      },
    ])
    await oldDatabase.table('foodLogEntries').put({
      id: 'historical-log',
      foodId: 'usda:170790',
      localDate: '2026-07-18',
      foodSnapshot: { caloriesPerServing: 465.63 },
      createdAt: timestamp,
    })
    await oldDatabase.table('savedMeals').put({
      id: 'historical-meal',
      name: 'Saved restaurant meal',
      status: 'active',
      components: [
        { foodSnapshot: { caloriesPerServing: 286.9 }, servingMultiplier: 1 },
      ],
      updatedAt: timestamp,
    })
    oldDatabase.close()

    const migratedDatabase = new TrainingLogDatabase(name)

    await expect(
      migratedDatabase.foods.get('usda:170790'),
    ).resolves.toMatchObject({
      brandName: 'Chick-fil-A',
      servingQuantity: 1,
      servingUnit: 'sandwich',
      gramsPerServing: null,
      servingConversionReliable: false,
      caloriesPerServing: 420,
      proteinGramsPerServing: 29,
      carbohydrateGramsPerServing: 41,
      fatGramsPerServing: 18,
      sourceName: 'Chick-fil-A official U.S. menu',
      normalizerVersion: 2,
      notes: 'Keep this note.',
    })
    await expect(
      migratedDatabase.foods.get('usda:173297'),
    ).resolves.toMatchObject({
      brandName: "McDonald's",
      servingQuantity: 6,
      servingUnit: 'pieces',
      gramsPerServing: null,
      caloriesPerServing: 250,
      proteinGramsPerServing: 14,
      carbohydrateGramsPerServing: 15,
      fatGramsPerServing: 15,
      sourceName: "McDonald's official U.S. menu",
    })
    await expect(
      migratedDatabase.foodUnitPreferences.get('pref-chick'),
    ).resolves.toMatchObject({ unitKey: 'serving', amount: 1 })
    await expect(
      migratedDatabase.foodUnitPreferences.get('pref-mcd'),
    ).resolves.toMatchObject({ unitKey: 'serving', amount: 6 })
    await expect(
      migratedDatabase.foods.get('usda:other-restaurant'),
    ).resolves.toMatchObject({ caloriesPerServing: 500 })
    await expect(
      migratedDatabase.foodLogEntries.get('historical-log'),
    ).resolves.toMatchObject({
      foodSnapshot: { caloriesPerServing: 465.63 },
    })
    await expect(
      migratedDatabase.savedMeals.get('historical-meal'),
    ).resolves.toMatchObject({
      components: [
        { foodSnapshot: { caloriesPerServing: 286.9 }, servingMultiplier: 1 },
      ],
    })
    await expect(
      migratedDatabase.appMetadata.get('app'),
    ).resolves.toMatchObject({
      databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
    })

    await destroyTestDatabase(migratedDatabase)
  })

  it('initializes workout pause state when migrating from v16 to v17', async () => {
    const name = `training-log-v17-workout-pause-${crypto.randomUUID()}`
    const oldDatabase = new Dexie(name)
    oldDatabase.version(16).stores({
      appMetadata: '&id',
      workouts: '&id, status, localDate, sourceActiveCycleId, startedAt',
      workoutHistoryEntries:
        '&id, localDate, sourceActiveCycleId, sourceTemplateId, completedAt',
    })
    const timestamp = '2026-08-03T10:00:00.000Z'
    await oldDatabase.table('appMetadata').put({
      id: 'app',
      databaseSchemaVersion: 16,
      backupSchemaVersion: BACKUP_SCHEMA_VERSION,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await oldDatabase.table('workouts').put({
      id: 'active-workout',
      status: 'active',
      localDate: '2026-08-03',
      sourceActiveCycleId: null,
      startedAt: timestamp,
    })
    await oldDatabase.table('workoutHistoryEntries').put({
      id: 'completed-workout',
      status: 'completed',
      localDate: '2026-08-02',
      sourceActiveCycleId: null,
      sourceTemplateId: null,
      startedAt: '2026-08-02T10:00:00.000Z',
      completedAt: '2026-08-02T11:00:00.000Z',
    })
    oldDatabase.close()

    const migratedDatabase = new TrainingLogDatabase(name)

    await expect(
      migratedDatabase.workouts.get('active-workout'),
    ).resolves.toMatchObject({ pausedAt: null })
    await expect(
      migratedDatabase.workoutHistoryEntries.get('completed-workout'),
    ).resolves.toMatchObject({ pausedAt: null })
    await expect(
      migratedDatabase.appMetadata.get('app'),
    ).resolves.toMatchObject({
      databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
    })

    await destroyTestDatabase(migratedDatabase)
  })

  it('initializes live rep targets when migrating from v17 to v18', async () => {
    const name = `training-log-v18-live-targets-${crypto.randomUUID()}`
    const oldDatabase = new Dexie(name)
    oldDatabase.version(17).stores({
      appMetadata: '&id',
      activeCycleWorkoutExercises: '&id',
      workoutExercises: '&id, workoutId',
      workoutSets: '&id, workoutExerciseId',
    })
    const timestamp = '2026-08-04T10:00:00.000Z'
    await oldDatabase.table('appMetadata').put({
      id: 'app',
      databaseSchemaVersion: 17,
      backupSchemaVersion: BACKUP_SCHEMA_VERSION,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await oldDatabase.table('activeCycleWorkoutExercises').put({
      id: 'source-exercise',
      targetRepsMin: 6,
      targetRepsMax: 9,
    })
    await oldDatabase.table('workoutExercises').put({
      id: 'workout-exercise',
      workoutId: 'workout',
      sourcePrescribedExerciseId: 'source-exercise',
      updatedAt: timestamp,
    })
    oldDatabase.close()

    const migratedDatabase = new TrainingLogDatabase(name)
    await expect(
      migratedDatabase.workoutExercises.get('workout-exercise'),
    ).resolves.toMatchObject({
      sessionTargetRepsMin: 6,
      sessionTargetRepsMax: 9,
    })
    await expect(
      migratedDatabase.appMetadata.get('app'),
    ).resolves.toMatchObject({
      databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
    })

    await destroyTestDatabase(migratedDatabase)
  })

  it('initializes workout preferences when migrating from v18 to v19', async () => {
    const name = `training-log-v19-workout-preferences-${crypto.randomUUID()}`
    const oldDatabase = new Dexie(name)
    oldDatabase.version(18).stores({
      appMetadata: '&id',
      userSettings: '&id',
    })
    const timestamp = '2026-08-13T10:00:00.000Z'
    await oldDatabase.table('appMetadata').put({
      id: 'app',
      databaseSchemaVersion: 18,
      backupSchemaVersion: BACKUP_SCHEMA_VERSION,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await oldDatabase.table('userSettings').put({
      id: 'settings',
      language: 'en',
      weightUnit: 'lb',
      energyUnit: 'kcal',
      nutritionTargets: {
        calories: 0,
        proteinGrams: 0,
        carbohydrateGrams: 0,
        fatGrams: 0,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    oldDatabase.close()

    const migratedDatabase = new TrainingLogDatabase(name)
    await expect(
      migratedDatabase.userSettings.get('settings'),
    ).resolves.toMatchObject({
      rirTrackingEnabled: false,
      workoutAutofillMode: 'history_copy',
    })
    await expect(
      migratedDatabase.appMetadata.get('app'),
    ).resolves.toMatchObject({
      databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
    })

    await destroyTestDatabase(migratedDatabase)
  })

  it('initializes opt-in deload scheduling and History preferences when migrating from v19', async () => {
    const name = `training-log-v20-program-weeks-${crypto.randomUUID()}`
    const oldDatabase = new Dexie(name)
    oldDatabase.version(19).stores({
      appMetadata: '&id',
      userSettings: '&id',
      programTemplates: '&id',
      activeProgramCycles: '&id',
      workouts: '&id',
      workoutHistoryEntries: '&id',
    })
    const timestamp = '2026-08-17T10:00:00.000Z'
    await oldDatabase.table('appMetadata').put({
      id: 'app',
      databaseSchemaVersion: 19,
      backupSchemaVersion: BACKUP_SCHEMA_VERSION,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await oldDatabase.table('userSettings').put({
      id: 'settings',
      weightUnit: 'lb',
      energyUnit: 'kcal',
      nutritionTargets: {
        calories: 0,
        proteinGrams: 0,
        carbohydrateGrams: 0,
        fatGrams: 0,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await oldDatabase.table('programTemplates').put({
      id: 'template',
      name: 'Program',
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await oldDatabase.table('programTemplates').put({
      id: 'scheduled-template',
      name: 'Scheduled Program',
      status: 'active',
      deloadWeekNumbers: [4],
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await oldDatabase.table('activeProgramCycles').put({
      id: 'cycle',
      name: 'Program',
      status: 'active',
      activatedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    oldDatabase.close()

    const migratedDatabase = new TrainingLogDatabase(name)
    await expect(
      migratedDatabase.userSettings.get('settings'),
    ).resolves.toMatchObject({
      historySortMode: 'recent',
      historyProgramId: null,
    })
    await expect(
      migratedDatabase.programTemplates.get('template'),
    ).resolves.toMatchObject({
      deloadSchedulingEnabled: false,
      deloadWeekNumbers: [1],
    })
    await expect(
      migratedDatabase.programTemplates.get('scheduled-template'),
    ).resolves.toMatchObject({
      deloadSchedulingEnabled: true,
      deloadWeekNumbers: [4],
    })
    await expect(
      migratedDatabase.activeProgramCycles.get('cycle'),
    ).resolves.toMatchObject({
      deloadSchedulingEnabled: false,
      deloadWeekNumbers: [1],
    })
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
