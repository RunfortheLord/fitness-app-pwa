import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DATABASE_SCHEMA_VERSION, type TrainingLogDatabase } from '@db/database'
import { BUILT_IN_EXERCISES } from '@domain/exerciseLibrary'
import { BUILT_IN_PROGRAMS } from '@domain/programLibrarySeed'
import { createExerciseRepository } from '@repositories/exerciseRepository'
import { createFoodRepository } from '@repositories/foodRepository'
import { createProgramRepository } from '@repositories/programRepository'
import { createSettingsRepository } from '@repositories/settingsRepository'
import {
  createBackupService,
  createCsvFiles,
  csvEscape,
  validateBackup,
  validateCloudSnapshot,
} from '@services/backupService'
import { createTestDatabase, destroyTestDatabase } from '@test/database'
import {
  seedExercise,
  seedFood,
  seedProgram,
  testLocalDate,
} from '@test/seedFactories'
import type { Exercise } from '@shared-types/app'
import type { JsonBackup } from './backupService'

describe('backupService', () => {
  let database: TrainingLogDatabase

  beforeEach(async () => {
    database = createTestDatabase()
    await database.open()
  })

  afterEach(async () => {
    await destroyTestDatabase(database)
  })

  it('creates deterministic full-fidelity JSON backup metadata and table coverage', async () => {
    const food = await seedFood(database)
    await seedProgram(database)
    const settings = createSettingsRepository(database)
    await settings.saveNutritionTargets({
      calories: 2400,
      proteinGrams: 180,
      carbohydrateGrams: 250,
      fatGrams: 70,
    })
    await settings.saveLanguage('es')
    await database.foodLogEntries.add({
      id: 'food-log-1',
      localDate: testLocalDate,
      foodId: food.id,
      mealType: 'lunch',
      foodSnapshot: {
        foodName: food.name,
        servingQuantity: food.servingQuantity,
        servingUnit: food.servingUnit,
        servingDescription: food.servingDescription,
        caloriesPerServing: food.caloriesPerServing,
        proteinGramsPerServing: food.proteinGramsPerServing,
        carbohydrateGramsPerServing: food.carbohydrateGramsPerServing,
        fatGramsPerServing: food.fatGramsPerServing,
        notes: food.notes,
      },
      servingMultiplier: 1.5,
      computedCalories: 300,
      computedProteinGrams: 6,
      computedCarbohydrateGrams: 67.5,
      computedFatGrams: 1.5,
      notes: 'comma, quote " and\nline',
      createdAt: '2026-06-18T12:00:00.000Z',
      updatedAt: '2026-06-18T12:00:00.000Z',
    })
    await database.bodyweightEntries.add({
      id: 'bodyweight-1',
      localDate: testLocalDate,
      weight: 188.4,
      unit: 'lb',
      notes: 'morning',
      createdAt: '2026-06-18T12:00:00.000Z',
      updatedAt: '2026-06-18T12:00:00.000Z',
    })
    await database.workoutHistoryEntries.add({
      id: 'history-1',
      sourceActiveCycleId: null,
      sourceTemplateId: null,
      sourceDayId: null,
      localDate: testLocalDate,
      name: 'History',
      workoutSnapshot: {
        activeCycleName: null,
        templateName: null,
        dayName: 'Ad hoc',
        dayNotes: '',
      },
      notes: 'snapshot',
      startedAt: '2026-06-18T12:00:00.000Z',
      completedAt: '2026-06-18T13:00:00.000Z',
      durationSeconds: 3600,
      elapsedPausedSeconds: 0,
      activeRestTimer: null,
      status: 'completed',
      createdAt: '2026-06-18T13:00:00.000Z',
      updatedAt: '2026-06-18T13:00:00.000Z',
    })
    const historyExercise = resultExerciseSnapshot(
      await database.exercises.toArray(),
    )
    await database.workoutHistoryExercises.add({
      id: 'history-exercise-1',
      workoutId: 'history-1',
      exerciseId: historyExercise.id,
      exerciseSnapshot: {
        exerciseName: historyExercise.name,
        notes: historyExercise.notes,
        defaultRestSeconds: historyExercise.defaultRestSeconds,
        trackingMethodId: historyExercise.trackingMethodId,
        trackingMetrics: historyExercise.trackingMetrics,
      },
      sourcePrescribedExerciseId: null,
      orderIndex: 0,
      notes: '',
      skipped: false,
      replacementOfExerciseId: null,
      createdAt: '2026-06-18T13:00:00.000Z',
      updatedAt: '2026-06-18T13:00:00.000Z',
    })
    await database.workoutHistorySets.add({
      id: 'history-set-1',
      workoutId: 'history-1',
      workoutExerciseId: 'history-exercise-1',
      setNumber: 1,
      metricValues: { weight: 95, reps: 10 },
      rir: 2,
      completed: true,
      completedAt: '2026-06-18T12:30:00.000Z',
      restSecondsUsed: 120,
    })

    const result = await createBackupService(database).createJsonBackup(
      new Date('2026-06-19T14:15:16.000Z'),
    )

    expect(result.filename).toBe(
      'training-log-backup-2026-06-19T14-15-16-000Z.json',
    )
    expect(result.backup).toMatchObject({
      backupFormatVersion: 1,
      databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
      applicationVersion: '1.0.0',
      exportedAt: '2026-06-19T14:15:16.000Z',
    })
    expect(Object.keys(result.backup.data)).toEqual([
      'userSettings',
      'nutritionTargets',
      'foods',
      'foodLogEntries',
      'savedMeals',
      'foodUnitPreferences',
      'barcodeProductCache',
      'bodyweightEntries',
      'exercises',
      'programTemplates',
      'templateWorkoutDays',
      'templateWorkoutExercises',
      'activeProgramCycles',
      'activeCycleWorkoutDays',
      'activeCycleWorkoutExercises',
      'workouts',
      'workoutExercises',
      'workoutSets',
      'workoutHistoryEntries',
      'workoutHistoryExercises',
      'workoutHistorySets',
      'detectedWorkoutChanges',
      'appliedWorkoutChanges',
      'runs',
      'runSamples',
      'runPauses',
      'runSplits',
      'runClassifications',
    ])
    expect(result.backup.data.foods[0]?.id).toBe(food.id)
    expect(result.backup.data.userSettings[0]?.language).toBe('es')
    expect(result.backup.data.foodLogEntries[0]).toMatchObject({
      id: 'food-log-1',
      foodId: food.id,
      localDate: testLocalDate,
    })
    expect(result.backup.data.templateWorkoutExercises[0]).toMatchObject({
      orderIndex: 0,
      exerciseId: historyExercise.id,
    })
    expect(result.backup.data.workoutHistorySets[0]).toMatchObject({
      id: 'history-set-1',
      workoutExerciseId: 'history-exercise-1',
    })
    expect(JSON.parse(result.json)).toEqual(result.backup)
  })

  it('exports and restores multiple same-day bodyweight entries without collapsing them', async () => {
    await database.bodyweightEntries.bulkAdd([
      {
        id: 'bodyweight-a',
        localDate: testLocalDate,
        weight: 188,
        unit: 'lb',
        notes: 'morning',
        createdAt: '2026-06-18T12:00:00.000Z',
        updatedAt: '2026-06-18T12:00:00.000Z',
      },
      {
        id: 'bodyweight-b',
        localDate: testLocalDate,
        weight: 189,
        unit: 'lb',
        notes: 'night',
        createdAt: '2026-06-18T23:00:00.000Z',
        updatedAt: '2026-06-18T23:00:00.000Z',
      },
    ])

    const service = createBackupService(database)
    const result = await service.createJsonBackup(
      new Date('2026-06-19T12:00:00.000Z'),
    )
    const bodyweightCsv = createCsvFiles(result.backup.data).find(
      (file) => file.name === 'bodyweightEntries.csv',
    )

    expect(result.backup.data.bodyweightEntries).toHaveLength(2)
    expect(bodyweightCsv?.content).toContain('bodyweight-a')
    expect(bodyweightCsv?.content).toContain('bodyweight-b')

    await database.bodyweightEntries.clear()
    await service.restoreReplace(
      result.backup,
      new Date('2026-06-19T13:00:00.000Z'),
    )

    await expect(database.bodyweightEntries.toArray()).resolves.toHaveLength(2)
  })

  it('exports and restores run samples, splits, pauses, and classifications', async () => {
    await database.runs.add({
      id: 'run-1',
      localDate: testLocalDate,
      status: 'completed',
      startedAt: '2026-06-19T12:00:00.000Z',
      completedAt: '2026-06-19T12:30:00.000Z',
      elapsedSeconds: 1800,
      movingSeconds: 1500,
      distanceMeters: 3218.688,
      currentPaceSecondsPerMile: null,
      averageMovingPaceSecondsPerMile: 750,
      trackingMode: 'treadmill',
      treadmillStepCount: 4100,
      treadmillStrideMeters: 0.75,
      hasGpsGap: true,
      lowPaceAlertedAt: '2026-06-19T12:12:00.000Z',
      notes: '',
      createdAt: '2026-06-19T12:00:00.000Z',
      updatedAt: '2026-06-19T12:30:00.000Z',
    })
    await database.runSamples.add({
      id: 'sample-1',
      runId: 'run-1',
      latitude: 41.88,
      longitude: -87.63,
      timestamp: '2026-06-19T12:00:00.000Z',
      accuracyMeters: 8,
      altitudeMeters: null,
      decision: 'accepted',
      rejectionReason: 'first_sample',
      segmentDistanceMeters: 0,
      createdAt: '2026-06-19T12:00:00.000Z',
    })
    await database.runPauses.add({
      id: 'pause-1',
      runId: 'run-1',
      startedAt: '2026-06-19T12:10:00.000Z',
      endedAt: '2026-06-19T12:11:00.000Z',
      createdAt: '2026-06-19T12:10:00.000Z',
      updatedAt: '2026-06-19T12:11:00.000Z',
    })
    await database.runSplits.add({
      id: 'split-1',
      runId: 'run-1',
      mileNumber: 1,
      distanceMeters: 1609.344,
      elapsedSeconds: 800,
      movingSeconds: 750,
      paceSecondsPerMile: 750,
      completedAt: '2026-06-19T12:13:20.000Z',
      createdAt: '2026-06-19T12:13:20.000Z',
    })
    await database.runClassifications.add({
      id: 'classification-1',
      runId: 'run-1',
      type: 'walking',
      response: 'walking',
      startedAt: '2026-06-19T12:12:00.000Z',
      endedAt: null,
      createdAt: '2026-06-19T12:12:00.000Z',
    })

    const service = createBackupService(database)
    const result = await service.createJsonBackup(
      new Date('2026-06-19T14:00:00.000Z'),
    )
    expect(result.backup.data.runSamples[0]).toMatchObject({
      id: 'sample-1',
      latitude: 41.88,
      decision: 'accepted',
    })
    expect(result.backup.data.runs[0]).toMatchObject({
      trackingMode: 'treadmill',
      treadmillStepCount: 4100,
      treadmillStrideMeters: 0.75,
    })
    expect(
      createCsvFiles(result.backup.data).map((file) => file.name),
    ).toContain('runSamples.csv')

    await database.runs.clear()
    await database.runSamples.clear()
    await database.runPauses.clear()
    await database.runSplits.clear()
    await database.runClassifications.clear()
    await service.restoreReplace(
      result.backup,
      new Date('2026-06-19T15:00:00.000Z'),
    )

    await expect(database.runs.toArray()).resolves.toEqual([
      expect.objectContaining({
        trackingMode: 'treadmill',
        treadmillStepCount: 4100,
        treadmillStrideMeters: 0.75,
      }),
    ])
    await expect(database.runSamples.count()).resolves.toBe(1)
    await expect(database.runSplits.count()).resolves.toBe(1)
    await expect(database.runClassifications.count()).resolves.toBe(1)
  })

  it('omits high-volume GPS samples from cloud backups without changing manual backups', async () => {
    await database.runs.add({
      id: 'run-1',
      localDate: testLocalDate,
      status: 'completed',
      startedAt: '2026-06-19T12:00:00.000Z',
      completedAt: '2026-06-19T12:30:00.000Z',
      elapsedSeconds: 1800,
      movingSeconds: 1500,
      distanceMeters: 3218.688,
      currentPaceSecondsPerMile: null,
      averageMovingPaceSecondsPerMile: 750,
      trackingMode: 'gps',
      hasGpsGap: false,
      lowPaceAlertedAt: null,
      notes: '',
      createdAt: '2026-06-19T12:00:00.000Z',
      updatedAt: '2026-06-19T12:30:00.000Z',
    })
    await database.runSamples.add({
      id: 'sample-1',
      runId: 'run-1',
      latitude: 41.88,
      longitude: -87.63,
      timestamp: '2026-06-19T12:00:00.000Z',
      accuracyMeters: 8,
      altitudeMeters: null,
      decision: 'accepted',
      rejectionReason: 'first_sample',
      segmentDistanceMeters: 0,
      createdAt: '2026-06-19T12:00:00.000Z',
    })

    const service = createBackupService(database)
    const manual = await service.createJsonBackup(
      new Date('2026-06-19T14:00:00.000Z'),
    )
    const cloud = await service.createCloudBackup(
      new Date('2026-06-19T14:05:00.000Z'),
    )

    expect(manual.backup.data.runSamples).toHaveLength(1)
    expect(cloud.backup.data.runs).toHaveLength(1)
    expect(cloud.backup.data.runSamples).toEqual([])
    expect(validateCloudSnapshot(cloud.backup, cloud.filename).ok).toBe(true)
  })

  it('compacts exact deterministic seeds and expands to equivalent user-visible data', async () => {
    await createExerciseRepository(database).seedBuiltInExercises()
    await createProgramRepository(database).seedBuiltInPrograms()
    const customProgram = await seedProgram(database)
    const customExercise = (
      await database.exercises.where({ origin: 'custom' }).toArray()
    )[0]
    if (!customExercise) {
      throw new Error('Expected a custom exercise.')
    }
    await seedCompletedHistory(database, customExercise)

    const service = createBackupService(database)
    const exportedAt = new Date('2026-06-19T14:05:00.000Z')
    const manual = await service.createJsonBackup(exportedAt)
    const cloud = await service.createCloudBackup(exportedAt)

    expect(cloud.backup).toMatchObject({
      cloudSnapshotFormatVersion: 1,
      sourceBackupFormatVersion: 1,
    })
    expect(cloud.backup.data.exercises).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: customExercise.id }),
      ]),
    )
    expect(
      cloud.backup.data.exercises.some((exercise) =>
        exercise.id.startsWith('builtin:'),
      ),
    ).toBe(false)
    expect(
      cloud.backup.data.programTemplates.some((program) => program.isBuiltIn),
    ).toBe(false)

    const validation = validateCloudSnapshot(cloud.backup, cloud.filename)
    const normalizedManual = validateBackup(manual.backup, manual.filename)
    expect(validation.ok).toBe(true)
    expect(normalizedManual.ok).toBe(true)
    if (!validation.ok) {
      throw new Error('Expected compact cloud snapshot to validate.')
    }
    if (!normalizedManual.ok) {
      throw new Error('Expected manual backup to validate.')
    }
    expect(validation.backup.data).toEqual(normalizedManual.backup.data)
    expect(validation.backup.data.workoutHistoryEntries).toEqual(
      normalizedManual.backup.data.workoutHistoryEntries,
    )
    expect(validation.backup.data.workoutHistoryExercises).toEqual(
      normalizedManual.backup.data.workoutHistoryExercises,
    )
    expect(validation.backup.data.workoutHistorySets).toEqual(
      normalizedManual.backup.data.workoutHistorySets,
    )

    await service.clearAllData()
    await service.restoreReplace(validation.backup)

    await expect(
      database.exercises.get(customExercise.id),
    ).resolves.toMatchObject({
      name: customExercise.name,
      origin: 'custom',
    })
    await expect(
      database.programTemplates.get(customProgram.template.id),
    ).resolves.toMatchObject({
      name: customProgram.template.name,
    })
    await expect(
      database.workoutHistorySets.get('compact-history-set'),
    ).resolves.toEqual(normalizedManual.backup.data.workoutHistorySets[0])
    await expect(
      database.exercises.where({ origin: 'built_in' }).count(),
    ).resolves.toBe(BUILT_IN_EXERCISES.length)
    await expect(
      database.programTemplates
        .filter((program) => Boolean(program.isBuiltIn))
        .count(),
    ).resolves.toBe(BUILT_IN_PROGRAMS.length)
  })

  it('preserves modified built-in records instead of treating their IDs as reconstructible', async () => {
    const exercises = createExerciseRepository(database)
    await exercises.seedBuiltInExercises()
    await createProgramRepository(database).seedBuiltInPrograms()
    const modifiedAt = '2026-06-20T00:00:00.000Z'
    await database.exercises.update('builtin:barbell-bench-press', {
      defaultRestSeconds: 999,
      updatedAt: modifiedAt,
    })
    const builtInProgram = await database.programTemplates
      .filter((program) => Boolean(program.isBuiltIn))
      .first()
    if (!builtInProgram) {
      throw new Error('Expected a built-in program.')
    }
    await database.programTemplates.update(builtInProgram.id, {
      lastActiveAt: modifiedAt,
    })

    const compact = await createBackupService(database).createCloudBackup()
    expect(compact.backup.data.exercises).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          defaultRestSeconds: 999,
          id: 'builtin:barbell-bench-press',
        }),
      ]),
    )
    expect(compact.backup.data.programTemplates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: builtInProgram.id,
          lastActiveAt: modifiedAt,
        }),
      ]),
    )

    const validation = validateCloudSnapshot(compact.backup, compact.filename)
    expect(validation.ok).toBe(true)
    if (!validation.ok) {
      throw new Error('Expected modified built-ins to validate.')
    }
    expect(
      validation.backup.data.exercises.filter(
        (exercise) => exercise.id === 'builtin:barbell-bench-press',
      ),
    ).toEqual([
      expect.objectContaining({
        defaultRestSeconds: 999,
        updatedAt: modifiedAt,
      }),
    ])
  })

  it('rejects unsupported compact versions and GPS-bearing compact snapshots', async () => {
    const compact = await createBackupService(database).createCloudBackup()
    expect(
      validateCloudSnapshot(
        { ...compact.backup, cloudSnapshotFormatVersion: 999 },
        'future-cloud.json',
      ).preview.errors[0],
    ).toMatch(/not supported/)
    expect(
      validateCloudSnapshot(
        {
          ...compact.backup,
          seedManifest: {
            ...compact.backup.seedManifest,
            builtInExerciseSeedVersion: 999,
          },
        },
        'future-seed-cloud.json',
      ).preview.errors[0],
    ).toMatch(/newer/)
    expect(
      validateCloudSnapshot(
        {
          ...compact.backup,
          data: {
            ...compact.backup.data,
            runSamples: [
              {
                id: 'sample-1',
                runId: 'missing-run',
                latitude: 41.88,
                longitude: -87.63,
                timestamp: '2026-06-19T12:00:00.000Z',
                accuracyMeters: 8,
                altitudeMeters: null,
                decision: 'accepted',
                rejectionReason: 'first_sample',
                segmentDistanceMeters: 0,
                createdAt: '2026-06-19T12:00:00.000Z',
              },
            ],
          },
        },
        'gps-cloud.json',
      ).ok,
    ).toBe(false)
  })

  it('exports provider food log snapshots in JSON and CSV without refetching providers', async () => {
    await database.foodLogEntries.add({
      id: 'provider-log-1',
      localDate: testLocalDate,
      foodId: 'usda:123',
      mealType: 'dinner',
      foodSnapshot: {
        snapshotId: 'snapshot-1',
        foodName: 'Chicken breast cooked',
        brandName: 'USDA Test Kitchen',
        sourceType: 'provider',
        provider: 'usda',
        providerRecordId: '123',
        providerDataType: 'Foundation',
        servingQuantity: 120,
        servingUnit: 'g',
        servingDescription: '120 g',
        gramsPerServing: 120,
        ouncesPerServing: 4.232875,
        servingConversionReliable: true,
        servingConversionSource: 'provider_serving_weight',
        caloriesPerServing: 198,
        proteinGramsPerServing: 37.2,
        carbohydrateGramsPerServing: 0,
        fatGramsPerServing: 4.32,
        macroBasis: 'both',
        rawCookedStatus: 'cooked',
        sourceUpdatedAt: '2026-01-01T00:00:00.000Z',
        providerIngestedAt: '2026-06-19T00:00:00.000Z',
        normalizerVersion: 1,
        notes: '',
      },
      servingMultiplier: 0.5,
      computedCalories: 99,
      computedProteinGrams: 18.6,
      computedCarbohydrateGrams: 0,
      computedFatGrams: 2.16,
      notes: '',
      createdAt: '2026-06-19T12:00:00.000Z',
      updatedAt: '2026-06-19T12:00:00.000Z',
    })

    const result = await createBackupService(database).createJsonBackup(
      new Date('2026-06-19T14:15:16.000Z'),
    )
    expect(result.backup.data.foodLogEntries[0]).toMatchObject({
      id: 'provider-log-1',
      foodSnapshot: {
        brandName: 'USDA Test Kitchen',
        provider: 'usda',
        providerRecordId: '123',
        gramsPerServing: 120,
      },
      computedCalories: 99,
      computedProteinGrams: 18.6,
    })

    const foodLogCsv = createCsvFiles(result.backup.data).find(
      (file) => file.name === 'foodLogEntries.csv',
    )
    expect(foodLogCsv?.content).toContain('Chicken breast cooked')
    expect(foodLogCsv?.content).toContain('USDA Test Kitchen')
    expect(foodLogCsv?.content).toContain('providerRecordId')
    expect(foodLogCsv?.content).toContain('computedCalories')
  })

  it('validates backups with progression recommendation metadata', async () => {
    const backup = (await createBackupService(database).createJsonBackup())
      .backup
    const withRecommendation = {
      ...backup,
      data: {
        ...backup.data,
        workoutHistorySets: [
          {
            id: 'set-1',
            workoutId: 'history-1',
            workoutExerciseId: 'history-exercise-1',
            setNumber: 1,
            targetSnapshot: {
              trackingMethodId: 'weight_reps',
              targetWeight: 185,
              targetRepsMin: 5,
              targetRepsMax: 10,
            },
            targetRecommendation: {
              version: 1,
              originalTarget: {
                trackingMethodId: 'weight_reps',
                targetWeight: 185,
                targetRepsMin: 5,
                targetRepsMax: 10,
              },
              suggestedTarget: {
                trackingMethodId: 'weight_reps',
                targetWeight: 190,
                targetRepsMin: 5,
                targetRepsMax: 5,
              },
              userEditedTarget: {
                trackingMethodId: 'weight_reps',
                targetWeight: 187.5,
                targetRepsMin: 5,
                targetRepsMax: 5,
              },
              reason: 'manual_target_retained',
              explanation: 'Your edited target is retained.',
              sourceSetId: 'set-0',
              generatedAt: '2026-06-19T12:00:00.000Z',
            },
            metricValues: {},
            rir: null,
            completed: false,
            completedAt: null,
            restSecondsUsed: null,
          },
        ],
        detectedWorkoutChanges: [
          {
            id: 'change-1',
            workoutId: 'history-1',
            type: 'progression_recommendation',
            description: 'Progress bench',
            sourcePath: 'cycle:cycle;day:day;exercise:source',
            performedPath:
              'workout:history-1;exercise:history-exercise;recommendedWeight:190',
            recommendationReason: 'repeated_top_range_increase',
            recommendationSummary: 'Suggested next-workout target: 190 lb.',
            selectedDestination: 'neither',
            appliedDestination: null,
            status: 'pending',
            failureReason: null,
            createdAt: '2026-06-19T12:00:00.000Z',
            updatedAt: '2026-06-19T12:00:00.000Z',
          },
        ],
        workoutHistoryEntries: [
          {
            id: 'history-1',
            sourceActiveCycleId: null,
            sourceTemplateId: null,
            sourceDayId: null,
            localDate: testLocalDate,
            name: 'History',
            workoutSnapshot: {
              activeCycleName: null,
              templateName: null,
              dayName: 'Ad hoc',
              dayNotes: '',
            },
            notes: '',
            startedAt: '2026-06-19T11:00:00.000Z',
            completedAt: '2026-06-19T12:00:00.000Z',
            durationSeconds: 3600,
            elapsedPausedSeconds: 0,
            activeRestTimer: null,
            status: 'completed',
            createdAt: '2026-06-19T12:00:00.000Z',
            updatedAt: '2026-06-19T12:00:00.000Z',
          },
        ],
        workoutHistoryExercises: [
          {
            id: 'history-exercise-1',
            workoutId: 'history-1',
            exerciseId: null,
            exerciseSnapshot: {
              exerciseName: 'Bench press',
              notes: '',
              defaultRestSeconds: 120,
              trackingMethodId: 'weight_reps',
              trackingMetrics: [],
              recordsRepsPerSide: false,
            },
            sourcePrescribedExerciseId: null,
            orderIndex: 0,
            notes: '',
            skipped: false,
            replacementOfExerciseId: null,
            createdAt: '2026-06-19T12:00:00.000Z',
            updatedAt: '2026-06-19T12:00:00.000Z',
          },
        ],
      },
    }

    expect(validateBackup(withRecommendation, 'progression.json').ok).toBe(true)
  })

  it('restores replace mode transactionally while preserving stable IDs and relationships', async () => {
    const service = createBackupService(database)
    const food = await seedFood(database)
    const backup = (await service.createJsonBackup()).backup

    await seedExercise(database)
    expect(await database.exercises.count()).toBe(1)

    await service.restoreReplace(backup, new Date('2026-06-19T16:00:00.000Z'))

    expect(await database.foods.get(food.id)).toMatchObject({ id: food.id })
    expect(await database.exercises.count()).toBe(BUILT_IN_EXERCISES.length)
    expect(
      await database.exercises.get('builtin:barbell-bench-press'),
    ).toMatchObject({ origin: 'built_in' })
    await expect(
      database.backupMetadata
        .toArray()
        .then(
          (records) =>
            records.filter((record) => record.mode === 'import').length,
        ),
    ).resolves.toBe(1)
  })

  it('round-trips provider food categories while accepting legacy backups without them', async () => {
    const service = createBackupService(database)
    const repository = createFoodRepository(database)
    const food = await seedFood(database)
    await database.foods.update(food.id, {
      foodCategory: 'Restaurant Foods',
    })
    await repository.logFood({
      foodId: food.id,
      localDate: testLocalDate,
      servingMultiplier: 1,
    })

    const backup = (await service.createJsonBackup()).backup
    expect(backup.data.foods[0]?.foodCategory).toBe('Restaurant Foods')
    expect(backup.data.foodLogEntries[0]?.foodSnapshot.foodCategory).toBe(
      'Restaurant Foods',
    )

    const legacyBackup = structuredClone(backup)
    delete legacyBackup.data.foods[0]?.foodCategory
    delete legacyBackup.data.foodLogEntries[0]?.foodSnapshot.foodCategory
    const legacyValidation = validateBackup(legacyBackup, 'legacy-food.json')
    expect(legacyValidation.ok).toBe(true)
    if (!legacyValidation.ok) {
      throw new Error('Expected legacy food backup to validate.')
    }
    expect(legacyValidation.backup.data.foods[0]?.foodCategory).toBeNull()
    expect(
      legacyValidation.backup.data.foodLogEntries[0]?.foodSnapshot.foodCategory,
    ).toBeNull()

    await database.foods.clear()
    await database.foodLogEntries.clear()
    await service.restoreReplace(backup)

    await expect(database.foods.get(food.id)).resolves.toMatchObject({
      foodCategory: 'Restaurant Foods',
    })
    await expect(database.foodLogEntries.toArray()).resolves.toEqual([
      expect.objectContaining({
        foodSnapshot: expect.objectContaining({
          foodCategory: 'Restaurant Foods',
        }),
      }),
    ])
  })

  it('preserves original data when restore transaction fails', async () => {
    const service = createBackupService(database)
    const originalFood = await seedFood(database)
    const backup = (await service.createJsonBackup()).backup
    const invalidButParseable: JsonBackup = {
      ...backup,
      data: {
        ...backup.data,
        bodyweightEntries: [
          {
            id: 'bodyweight-a',
            localDate: testLocalDate,
            weight: 180,
            unit: 'lb',
            notes: '',
            createdAt: '2026-06-18T12:00:00.000Z',
            updatedAt: '2026-06-18T12:00:00.000Z',
          },
          {
            id: 'bodyweight-a',
            localDate: testLocalDate,
            weight: 181,
            unit: 'lb',
            notes: '',
            createdAt: '2026-06-18T12:00:00.000Z',
            updatedAt: '2026-06-18T12:00:00.000Z',
          },
        ],
      },
    }

    await expect(service.restoreReplace(invalidButParseable)).rejects.toThrow()
    await expect(database.foods.get(originalFood.id)).resolves.toMatchObject({
      id: originalFood.id,
    })
    await expect(database.bodyweightEntries.count()).resolves.toBe(0)
  })

  it('reports validation problems before restore writes', async () => {
    await seedFood(database)
    const backup = (await createBackupService(database).createJsonBackup())
      .backup

    expect(validateBackup('{', 'broken.json').ok).toBe(false)
    expect(
      validateBackup({ ...backup, backupFormatVersion: 999 }, 'future.json')
        .preview.errors[0],
    ).toMatch(/not supported/)
    expect(
      validateBackup(
        { ...backup, databaseSchemaVersion: 999 },
        'future-db.json',
      ).preview.errors[0],
    ).toMatch(/newer/)
    expect(
      validateBackup(
        {
          ...backup,
          data: {
            ...backup.data,
            foods: [
              { ...backup.data.foods[0], id: 'duplicate' },
              { ...backup.data.foods[0], id: 'duplicate' },
            ],
          },
        },
        'duplicate.json',
      ).preview.errors,
    ).toContain('foods contains duplicate ID duplicate.')
    expect(
      validateBackup(
        {
          ...backup,
          data: {
            ...backup.data,
            foodLogEntries: [
              {
                id: 'log-1',
                localDate: '2026-99-99',
                foodId: 'missing-food',
                foodSnapshot: {
                  foodName: 'Missing',
                  servingQuantity: 1,
                  servingUnit: 'serving',
                  servingDescription: '',
                  caloriesPerServing: 1,
                  proteinGramsPerServing: 0,
                  carbohydrateGramsPerServing: 0,
                  fatGramsPerServing: 0,
                  notes: '',
                },
                servingMultiplier: 1,
                computedCalories: 1,
                computedProteinGrams: 0,
                computedCarbohydrateGrams: 0,
                computedFatGrams: 0,
                notes: '',
                createdAt: '2026-06-18T12:00:00.000Z',
                updatedAt: '2026-06-18T12:00:00.000Z',
              },
            ],
          },
        },
        'bad-date.json',
      ).preview.errors.join(' '),
    ).toMatch(/Invalid local date/)
  })

  it('normalizes older exercise backups with missing built-in library fields', async () => {
    const exercise = await seedExercise(database)
    const backup = (await createBackupService(database).createJsonBackup())
      .backup
    const legacyExercise = {
      id: exercise.id,
      name: exercise.name,
      notes: exercise.notes,
      defaultRestSeconds: exercise.defaultRestSeconds,
      trackingMethodId: exercise.trackingMethodId,
      trackingMetrics: exercise.trackingMetrics,
      status: exercise.status,
      createdAt: exercise.createdAt,
      updatedAt: exercise.updatedAt,
    }

    const result = validateBackup(
      {
        ...backup,
        databaseSchemaVersion: 2,
        data: {
          ...backup.data,
          exercises: [legacyExercise],
        },
      },
      'legacy.json',
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error('Expected legacy backup to validate.')
    }
    expect(result.backup.data.exercises[0]).toMatchObject({
      id: exercise.id,
      origin: 'custom',
      seedDataVersion: null,
      defaultWeightIncrement: 5,
      equipmentType: 'barbell',
      recordsRepsPerSide: false,
    })
  })

  it('clears all user data transactionally and leaves app metadata', async () => {
    await seedFood(database)
    await seedExercise(database)

    await createBackupService(database).clearAllData(
      new Date('2026-06-19T17:00:00.000Z'),
    )

    await expect(database.foods.count()).resolves.toBe(0)
    await expect(database.exercises.count()).resolves.toBe(
      BUILT_IN_EXERCISES.length,
    )
    await expect(
      database.exercises.get('builtin:barbell-bench-press'),
    ).resolves.toMatchObject({ origin: 'built_in' })
    await expect(database.workouts.count()).resolves.toBe(0)
    await expect(database.workoutHistoryEntries.count()).resolves.toBe(0)
    await expect(database.appMetadata.get('app')).resolves.toMatchObject({
      databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
    })
  })

  it('escapes CSV commas, quotation marks, line breaks, and empty values', () => {
    expect(csvEscape('plain')).toBe('plain')
    expect(csvEscape('comma,value')).toBe('"comma,value"')
    expect(csvEscape('quote " value')).toBe('"quote "" value"')
    expect(csvEscape('line\nbreak')).toBe('"line\nbreak"')
    expect(csvEscape('')).toBe('')
  })
})

function resultExerciseSnapshot(exercises: Exercise[]) {
  const exercise = exercises[0]
  if (!exercise) {
    throw new Error('Expected seeded exercise.')
  }
  return exercise
}

async function seedCompletedHistory(
  database: TrainingLogDatabase,
  exercise: Exercise,
) {
  const timestamp = '2026-06-18T13:00:00.000Z'
  await database.workoutHistoryEntries.add({
    id: 'compact-history',
    sourceActiveCycleId: null,
    sourceTemplateId: null,
    sourceDayId: null,
    localDate: testLocalDate,
    name: 'Completed history',
    workoutSnapshot: {
      activeCycleName: null,
      templateName: null,
      dayName: 'Ad hoc',
      dayNotes: '',
    },
    notes: 'immutable snapshot',
    startedAt: '2026-06-18T12:00:00.000Z',
    completedAt: timestamp,
    durationSeconds: 3_600,
    elapsedPausedSeconds: 0,
    activeRestTimer: null,
    status: 'completed',
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  await database.workoutHistoryExercises.add({
    id: 'compact-history-exercise',
    workoutId: 'compact-history',
    exerciseId: exercise.id,
    exerciseSnapshot: {
      exerciseName: exercise.name,
      notes: exercise.notes,
      defaultRestSeconds: exercise.defaultRestSeconds,
      trackingMethodId: exercise.trackingMethodId,
      trackingMetrics: exercise.trackingMetrics,
    },
    sourcePrescribedExerciseId: null,
    orderIndex: 0,
    notes: '',
    skipped: false,
    replacementOfExerciseId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  await database.workoutHistorySets.add({
    id: 'compact-history-set',
    workoutId: 'compact-history',
    workoutExerciseId: 'compact-history-exercise',
    setNumber: 1,
    metricValues: { reps: 8, weight: 135 },
    rir: 2,
    completed: true,
    completedAt: '2026-06-18T12:30:00.000Z',
    restSecondsUsed: 120,
  })
}
