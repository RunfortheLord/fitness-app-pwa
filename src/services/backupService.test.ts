import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DATABASE_SCHEMA_VERSION, type TrainingLogDatabase } from '@db/database'
import { BUILT_IN_EXERCISES } from '@domain/exerciseLibrary'
import { createSettingsRepository } from '@repositories/settingsRepository'
import {
  createBackupService,
  csvEscape,
  validateBackup,
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
    await createSettingsRepository(database).saveNutritionTargets({
      calories: 2400,
      proteinGrams: 180,
      carbohydrateGrams: 250,
      fatGrams: 70,
    })
    await database.foodLogEntries.add({
      id: 'food-log-1',
      localDate: testLocalDate,
      foodId: food.id,
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
      applicationVersion: '0.0.0',
      exportedAt: '2026-06-19T14:15:16.000Z',
    })
    expect(Object.keys(result.backup.data)).toEqual([
      'userSettings',
      'nutritionTargets',
      'foods',
      'foodLogEntries',
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
    ])
    expect(result.backup.data.foods[0]?.id).toBe(food.id)
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
            id: 'bodyweight-b',
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
