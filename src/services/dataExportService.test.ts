import { strFromU8, unzipSync } from 'fflate'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  BACKUP_TABLE_NAMES,
  createBackupService,
  type JsonBackup,
  validateBackup,
} from '@services/backupService'
import {
  createCsv,
  createFitnessDataExport,
  protectCsvText,
  csvEscape,
} from '@services/dataExportService'
import { createSettingsRepository } from '@repositories/settingsRepository'
import { createExerciseRepository } from '@repositories/exerciseRepository'
import { createTestDatabase, destroyTestDatabase } from '@test/database'
import { seedExercise, seedFood, testLocalDate } from '@test/seedFactories'
import type { TrainingLogDatabase } from '@db/database'
import type {
  ExerciseSnapshot,
  TrackingMethodId,
  WorkoutHistorySet,
} from '@shared-types/app'

const exportTime = new Date('2026-07-30T18:15:16.000Z')

describe('fitness data ZIP export', () => {
  let database: TrainingLogDatabase

  beforeEach(async () => {
    database = createTestDatabase()
    await database.open()
  })

  afterEach(async () => {
    await destroyTestDatabase(database)
  })

  it('exports a completely empty database with every canonical table and full schema metadata', async () => {
    const result =
      await createBackupService(database).createCsvArchive(exportTime)
    const files = await unzip(result.blob)
    const root = result.filename.replace(/\.zip$/, '')
    const manifest = parseJson<{
      exportFormat: string
      databaseSchemaVersion: number
      tables: Array<{
        name: string
        recordCount: number
        file: string
        columns: Array<{ name: string }>
      }>
    }>(files, `${root}/manifest.json`)

    expect(result.filename).toMatch(
      /^fitness-data-export-2026-07-30_\d{2}-15-16\.zip$/,
    )
    expect(result.validation).toEqual({ ok: true })
    expect(manifest.exportFormat).toBe('fitness-app-data-export')
    expect(manifest.tables.map((table) => table.name)).toEqual(
      BACKUP_TABLE_NAMES,
    )
    expect(manifest.tables.every((table) => table.recordCount === 0)).toBe(true)
    expect(
      manifest.tables.find((table) => table.name === 'bodyweightEntries')
        ?.columns,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'localDate' }),
        expect.objectContaining({ name: 'weight' }),
        expect.objectContaining({ name: 'unit' }),
      ]),
    )
    for (const tableName of BACKUP_TABLE_NAMES) {
      expect(parseJson(files, `${root}/backup/${tableName}.json`)).toEqual([])
    }
    expect(text(files, `${root}/reports/workout-history.csv`)).toMatch(
      /^workoutId,localDate,workoutName,/,
    )
    expect(text(files, `${root}/backup/schema.json`)).toContain(
      '"bodyweightEntries"',
    )
  })

  it('exports raw data with a warning file when current validation rejects legacy records', async () => {
    const backup =
      await createBackupService(database).createJsonBackup(exportTime)
    const result = await createFitnessDataExport(backup.backup, {
      now: exportTime,
      timeZone: 'UTC',
      tableNames: [],
      backupJsonSchema: {},
      validateCanonicalBackup: () => ['Legacy record needs normalization.'],
    })
    const files = await unzip(result.blob)
    const root = result.filename.replace(/\.zip$/, '')

    expect(result.validation).toEqual({
      ok: false,
      errors: ['Legacy record needs normalization.'],
    })
    expect(text(files, `${root}/EXPORT_WARNINGS.txt`)).toContain(
      'Legacy record needs normalization.',
    )
    expect(parseJson(files, `${root}/backup/fitness-data-backup.json`)).toEqual(
      backup.backup,
    )
  })

  it('preserves typed canonical data, creates stable analysis reports, validates relationships, and excludes secrets', async () => {
    const service = createBackupService(database)
    const settings = createSettingsRepository(database)
    await settings.saveLanguage('es')
    await settings.saveNutritionTargets({
      calories: 2300,
      proteinGrams: 180,
      carbohydrateGrams: 245,
      fatGrams: 70,
    })
    const target = await database.nutritionTargets.toCollection().first()
    if (!target) {
      throw new Error('Expected saved nutrition target history.')
    }
    await database.nutritionTargets.update(target.id, {
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    await settings.saveUsdaApiKey('configured-usda-secret', 'connected')
    await settings.saveGeminiApiKey('configured-gemini-secret', 'connected')

    const food = await seedFood(database)
    await database.foodLogEntries.add({
      id: 'log-formula',
      localDate: testLocalDate,
      foodId: food.id,
      mealType: 'breakfast',
      foodSnapshot: {
        foodName: '=SUM(1,1) "Café"\nline',
        brandName: '+Danger',
        foodCategory: null,
        sourceType: 'provider',
        provider: 'usda',
        providerRecordId: 'provider-1',
        servingQuantity: 1,
        servingUnit: 'cup',
        servingDescription: '',
        caloriesPerServing: 0,
        proteinGramsPerServing: 12,
        carbohydrateGramsPerServing: 0,
        fatGramsPerServing: 0,
        notes: '',
      },
      servingMultiplier: 1,
      computedCalories: 0,
      computedProteinGrams: 12,
      computedCarbohydrateGrams: 0,
      computedFatGrams: 0,
      notes: '@note',
      createdAt: '2026-06-18T12:00:00.000Z',
      updatedAt: '2026-06-18T12:00:00.000Z',
    })
    await database.bodyweightEntries.add({
      id: 'weight-1',
      localDate: testLocalDate,
      weight: 100,
      unit: 'lb',
      notes: '',
      createdAt: '2026-06-18T08:00:00.000Z',
      updatedAt: '2026-06-18T08:00:00.000Z',
    })
    await createExerciseRepository(database).seedBuiltInExercises()
    const exercise = await seedExercise(database)
    await database.exercises.update(exercise.id, {
      name: '-Custom exercise',
      recordsRepsPerSide: false,
      primaryMuscleGroups: ['chest'],
      secondaryMuscleGroups: [],
    })
    await seedWorkoutHistoryForTrackingMethods(database, exercise.id)
    await seedPrograms(database, exercise.id)

    const before = await service.createJsonBackup(exportTime)
    const first = await service.createCsvArchive(exportTime)
    const second = await service.createCsvArchive(exportTime)
    const files = await unzip(first.blob)
    const secondFiles = await unzip(second.blob)
    const root = first.filename.replace(/\.zip$/, '')
    const fullBackup = parseJson<JsonBackup>(
      files,
      `${root}/backup/fitness-data-backup.json`,
    )
    const foodLogs = parseJson<
      Array<{
        foodSnapshot: {
          foodCategory: null
          caloriesPerServing: number
        }
        notes: string
      }>
    >(files, `${root}/backup/foodLogEntries.json`)
    const exercises = parseJson<
      Array<{
        id: string
        recordsRepsPerSide: boolean
        secondaryMuscleGroups: string[]
      }>
    >(files, `${root}/backup/exercises.json`)
    const customExercise = exercises.find(
      (candidate) => candidate.id === exercise.id,
    )
    const manifest = parseJson<{
      tables: Array<{ name: string; recordCount: number; sha256?: string }>
      reports: Array<{ name: string; rowCount: number }>
    }>(files, `${root}/manifest.json`)
    const archiveText = Object.values(files)
      .map((file) => strFromU8(file))
      .join('\n')

    expect(first.filename).toMatch(
      /^fitness-data-export-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.zip$/,
    )
    expect(first.files.every((path) => path.startsWith(`${root}/`))).toBe(true)
    expect(first.files).toContain(`${root}/README.txt`)
    expect(first.files).toContain(`${root}/reports/export-summary.csv`)
    expect(fullBackup).toEqual(before.backup)
    expect(foodLogs[0]?.foodSnapshot.foodCategory).toBeNull()
    expect(foodLogs[0]?.foodSnapshot.caloriesPerServing).toBe(0)
    expect(foodLogs[0]?.notes).toBe('@note')
    expect(customExercise?.recordsRepsPerSide).toBe(false)
    expect(customExercise?.secondaryMuscleGroups).toEqual([])
    expect(
      manifest.tables.every(
        (table) =>
          table.recordCount ===
          fullBackup.data[table.name as keyof JsonBackup['data']].length,
      ),
    ).toBe(true)
    expect(manifest.tables.some((table) => table.sha256?.length === 64)).toBe(
      true,
    )
    expect(
      manifest.reports.find((report) => report.name === 'workout-history')
        ?.rowCount,
    ).toBe(7)
    expect(archiveText).not.toContain('configured-usda-secret')
    expect(archiveText).not.toContain('configured-gemini-secret')

    const foodLogCsv = text(files, `${root}/reports/food-log.csv`)
    expect(foodLogCsv).toContain(`"'=SUM(1,1) ""Café""\nline"`)
    expect(foodLogCsv).toContain(`'+Danger`)
    expect(foodLogCsv).toContain(`'@note`)
    const workoutCsv = text(files, `${root}/reports/workout-history.csv`)
    expect(workoutCsv).toContain('customBalance')
    expect(workoutCsv).toContain('assisted_weight_reps')
    expect(workoutCsv).toContain('distance_duration')
    const programsCsv = text(files, `${root}/reports/programs.csv`)
    expect(programsCsv).toContain('archived')
    expect(programsCsv).toContain('active_cycle')
    const nutritionCsv = text(files, `${root}/reports/daily-nutrition.csv`)
    expect(nutritionCsv).toContain('2300')
    expect(text(files, `${root}/README.txt`)).toContain('PRIVACY WARNING')
    expect(text(files, `${root}/reports/export-summary.csv`)).toContain(
      'canonical_table',
    )

    for (const path of first.files) {
      expect(files[path]).toEqual(secondFiles[path])
    }
    const after = await service.createJsonBackup(exportTime)
    expect(after.backup.data).toEqual(before.backup.data)

    await database.transaction(
      'rw',
      BACKUP_TABLE_NAMES.map((name) => database[name]),
      async () => {
        await Promise.all(
          BACKUP_TABLE_NAMES.map((name) => database[name].clear()),
        )
      },
    )
    await service.restoreReplace(fullBackup)
    const restored = await service.createJsonBackup(exportTime)
    const normalized = validateBackup(fullBackup, 'round-trip.json')
    if (!normalized.ok) {
      throw new Error('Expected the exported canonical backup to validate.')
    }
    expect(restored.backup.data).toEqual(normalized.backup.data)
  }, 20_000)
})

describe('human-readable CSV safety', () => {
  it('quotes RFC 4180 values and protects leading spreadsheet formulas', () => {
    expect(csvEscape('comma,value')).toBe('"comma,value"')
    expect(csvEscape('quote "value"')).toBe('"quote ""value"""')
    expect(csvEscape('line\nvalue')).toBe('"line\nvalue"')
    expect(protectCsvText('=1+1')).toBe("'=1+1")
    expect(protectCsvText('+1')).toBe("'+1")
    expect(protectCsvText('-1')).toBe("'-1")
    expect(protectCsvText('@cmd')).toBe("'@cmd")
    expect(
      createCsv(
        ['text', 'number', 'false', 'empty'],
        [
          {
            text: '=SUM(1,2), "Café"\nnext',
            number: 0,
            false: false,
            empty: '',
          },
        ],
      ),
    ).toBe(
      'text,number,false,empty\r\n' +
        `"'=SUM(1,2), ""Café""\nnext",0,false,\r\n`,
    )
  })
})

async function seedWorkoutHistoryForTrackingMethods(
  database: TrainingLogDatabase,
  exerciseId: string,
) {
  await database.workoutHistoryEntries.add({
    id: 'history-1',
    sourceActiveCycleId: null,
    sourceTemplateId: null,
    sourceDayId: null,
    localDate: testLocalDate,
    name: 'All tracking',
    workoutSnapshot: {
      activeCycleName: 'Cycle',
      templateName: 'Template',
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
  const tracking: Array<{
    id: TrackingMethodId
    metrics: WorkoutHistorySet['metricValues']
  }> = [
    { id: 'weight_reps', metrics: { weight: 95, reps: 10 } },
    { id: 'reps_only', metrics: { reps: 12 } },
    { id: 'duration', metrics: { durationSeconds: 45 } },
    { id: 'distance_duration', metrics: { distance: 100 } },
    {
      id: 'assisted_weight_reps',
      metrics: { assistedWeight: 30, reps: 8 },
    },
    { id: 'bodyweight_reps', metrics: { reps: 15 } },
    {
      id: 'added_weight_reps',
      metrics: { addedWeight: 20, reps: 6, customBalance: false },
    },
  ]
  await database.workoutHistoryExercises.bulkAdd(
    tracking.map((item, index) => ({
      id: `history-exercise-${index}`,
      workoutId: 'history-1',
      exerciseId,
      exerciseSnapshot: exerciseSnapshot(item.id),
      sourcePrescribedExerciseId: null,
      orderIndex: index,
      notes: index === 0 ? '=exercise note' : '',
      skipped: false,
      replacementOfExerciseId: null,
      createdAt: '2026-06-18T12:00:00.000Z',
      updatedAt: '2026-06-18T13:00:00.000Z',
    })),
  )
  await database.workoutHistorySets.bulkAdd(
    tracking.map((item, index) => ({
      id: `history-set-${index}`,
      workoutId: 'history-1',
      workoutExerciseId: `history-exercise-${index}`,
      setNumber: 1,
      metricValues: item.metrics,
      rir: index === 0 ? 0 : null,
      completed: index !== 1,
      completedAt:
        index === 1
          ? null
          : `2026-06-18T12:${String(index).padStart(2, '0')}:00.000Z`,
      restSecondsUsed: index === 0 ? 0 : null,
    })),
  )
}

async function seedPrograms(database: TrainingLogDatabase, exerciseId: string) {
  await database.programTemplates.add({
    id: 'template-archived',
    name: 'Archived plan',
    notes: '',
    status: 'archived',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  })
  await database.templateWorkoutDays.add({
    id: 'template-day',
    templateId: 'template-archived',
    name: 'Day one',
    notes: '',
    orderIndex: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  })
  await database.templateWorkoutExercises.add({
    id: 'template-exercise',
    templateId: 'template-archived',
    dayId: 'template-day',
    exerciseId,
    exerciseSnapshot: exerciseSnapshot('weight_reps'),
    orderIndex: 0,
    targetSetCount: 3,
    targetWeight: 100,
    targetDurationSeconds: null,
    targetDistance: null,
    targetRepsMin: 8,
    targetRepsMax: 10,
    targetRir: 2,
    restSecondsOverride: 90,
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  })
  await database.activeProgramCycles.add({
    id: 'cycle-active',
    sourceTemplateId: 'template-archived',
    name: 'Active cycle',
    notes: '',
    status: 'active',
    activatedAt: '2026-02-01T00:00:00.000Z',
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
  })
  await database.activeCycleWorkoutDays.add({
    id: 'cycle-day',
    activeCycleId: 'cycle-active',
    sourceTemplateDayId: 'template-day',
    name: 'Cycle day',
    notes: '',
    orderIndex: 0,
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
  })
  await database.activeCycleWorkoutExercises.add({
    id: 'cycle-exercise',
    activeCycleId: 'cycle-active',
    dayId: 'cycle-day',
    sourceTemplateExerciseId: 'template-exercise',
    exerciseId,
    exerciseSnapshot: exerciseSnapshot('weight_reps'),
    orderIndex: 0,
    targetSetCount: 3,
    targetWeight: 105,
    targetDurationSeconds: null,
    targetDistance: null,
    targetRepsMin: 8,
    targetRepsMax: 10,
    targetRir: 2,
    restSecondsOverride: null,
    notes: '',
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
  })
}

function exerciseSnapshot(
  trackingMethodId: TrackingMethodId,
): ExerciseSnapshot {
  return {
    exerciseName: `${trackingMethodId} exercise`,
    notes: '',
    defaultRestSeconds: 90,
    trackingMethodId,
    trackingMetrics: [
      {
        key: 'customBalance',
        label: 'Balance',
        valueType: 'boolean',
        unit: null,
        requiredForCompletion: false,
      },
    ],
    recordsRepsPerSide: false,
  }
}

async function unzip(blob: Blob) {
  return unzipSync(new Uint8Array(await blob.arrayBuffer()))
}

function text(files: Record<string, Uint8Array>, path: string) {
  const file = files[path]
  if (!file) {
    throw new Error(`Missing ZIP entry: ${path}`)
  }
  return strFromU8(file)
}

function parseJson<T = unknown>(
  files: Record<string, Uint8Array>,
  path: string,
): T {
  return JSON.parse(text(files, path)) as T
}
