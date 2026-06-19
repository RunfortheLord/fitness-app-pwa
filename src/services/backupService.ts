import { z } from 'zod'

import {
  BACKUP_SCHEMA_VERSION,
  DATABASE_SCHEMA_VERSION,
  db,
  type TrainingLogDatabase,
} from '@db/database'
import { getTrackingMethod } from '@domain/trackingMethods'
import { createExerciseRepository } from '@repositories/exerciseRepository'
import type {
  ActiveCycleWorkoutDay,
  ActiveCycleWorkoutExercise,
  ActiveProgramCycle,
  AppMetadata,
  AppliedWorkoutChange,
  BodyweightEntry,
  DetectedWorkoutChange,
  Exercise,
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

export const BACKUP_FORMAT_VERSION = 1
export const APPLICATION_VERSION = '0.0.0'
export const MAX_BACKUP_FILE_BYTES = 20 * 1024 * 1024

const tableNames = [
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
] as const

type DataTableName = (typeof tableNames)[number]

export type BackupData = {
  userSettings: UserSettings[]
  nutritionTargets: NutritionTarget[]
  foods: Food[]
  foodLogEntries: FoodLogEntry[]
  bodyweightEntries: BodyweightEntry[]
  exercises: Exercise[]
  programTemplates: ProgramTemplate[]
  templateWorkoutDays: ProgramTemplateDay[]
  templateWorkoutExercises: TemplateWorkoutExercise[]
  activeProgramCycles: ActiveProgramCycle[]
  activeCycleWorkoutDays: ActiveCycleWorkoutDay[]
  activeCycleWorkoutExercises: ActiveCycleWorkoutExercise[]
  workouts: Workout[]
  workoutExercises: WorkoutExercise[]
  workoutSets: WorkoutSet[]
  workoutHistoryEntries: WorkoutHistoryEntry[]
  workoutHistoryExercises: WorkoutHistoryExercise[]
  workoutHistorySets: WorkoutHistorySet[]
  detectedWorkoutChanges: DetectedWorkoutChange[]
  appliedWorkoutChanges: AppliedWorkoutChange[]
}

export type JsonBackup = {
  backupFormatVersion: number
  databaseSchemaVersion: number
  applicationVersion: string
  exportedAt: string
  data: BackupData
}

export type BackupPreview = {
  filename: string
  exportedAt: string
  backupFormatVersion: number
  databaseSchemaVersion: number
  applicationVersion: string
  restoreMode: 'replace'
  currentDataWillBeReplaced: boolean
  totalRecordCount: number
  counts: Record<DataTableName, number>
  warnings: string[]
  errors: string[]
}

export type ParsedBackupResult =
  | { ok: true; backup: JsonBackup; preview: BackupPreview }
  | { ok: false; preview: BackupPreview }

const isoTimestampSchema = z.string().datetime()
const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`)
    return (
      !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
    )
  }, 'Invalid local date')
const idSchema = z.string().trim().min(1)
const nonNegativeNumber = z.number().finite().min(0)
const nonNegativeInteger = z.number().int().min(0)
const nullableId = z.union([idSchema, z.null()])
const entityStatusSchema = z.enum(['active', 'archived'])
const exerciseStatusSchema = z.enum(['active', 'archived', 'hidden'])
const exerciseOriginSchema = z.enum(['built_in', 'custom'])
const exerciseEquipmentTypeSchema = z.enum([
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
])
const muscleGroupSchema = z.enum([
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'core',
  'traps',
  'hip abductors',
  'hip adductors',
])
const weightUnitSchema = z.literal('lb')
const energyUnitSchema = z.literal('kcal')
const trackingMethodIdSchema = z.enum([
  'weight_reps',
  'bodyweight_reps',
  'assisted_weight_reps',
  'added_weight_reps',
  'reps_only',
  'duration',
  'distance_duration',
])
const trackingMetricSchema = z.object({
  key: idSchema,
  label: z.string(),
  valueType: z.enum(['number', 'integer', 'durationSeconds', 'boolean']),
  unit: z.union([z.string(), z.null()]),
  requiredForCompletion: z.boolean(),
})
const nutritionTargetValuesSchema = z.object({
  calories: nonNegativeNumber,
  proteinGrams: nonNegativeNumber,
  carbohydrateGrams: nonNegativeNumber,
  fatGrams: nonNegativeNumber,
})
const userSettingsSchema = z.object({
  id: z.literal('settings'),
  weightUnit: weightUnitSchema,
  energyUnit: energyUnitSchema,
  nutritionTargets: nutritionTargetValuesSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})
const nutritionTargetSchema = nutritionTargetValuesSchema.extend({
  id: idSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})
const foodSnapshotSchema = z.object({
  foodName: z.string(),
  servingQuantity: nonNegativeNumber,
  servingUnit: z.string(),
  servingDescription: z.string(),
  caloriesPerServing: nonNegativeNumber,
  proteinGramsPerServing: nonNegativeNumber,
  carbohydrateGramsPerServing: nonNegativeNumber,
  fatGramsPerServing: nonNegativeNumber,
  notes: z.string(),
})
const foodSchema = foodSnapshotSchema.omit({ foodName: true }).extend({
  id: idSchema,
  name: z.string().min(1),
  status: entityStatusSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})
const foodLogEntrySchema = z.object({
  id: idSchema,
  localDate: localDateSchema,
  foodId: nullableId,
  foodSnapshot: foodSnapshotSchema,
  servingMultiplier: nonNegativeNumber,
  computedCalories: nonNegativeNumber,
  computedProteinGrams: nonNegativeNumber,
  computedCarbohydrateGrams: nonNegativeNumber,
  computedFatGrams: nonNegativeNumber,
  notes: z.string(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})
const bodyweightEntrySchema = z.object({
  id: idSchema,
  localDate: localDateSchema,
  weight: z.number().finite().positive(),
  unit: weightUnitSchema,
  notes: z.string(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})
const exerciseSnapshotSchema = z.object({
  exerciseName: z.string(),
  notes: z.string(),
  defaultRestSeconds: nonNegativeInteger,
  trackingMethodId: trackingMethodIdSchema,
  trackingMetrics: z.array(trackingMetricSchema),
  recordsRepsPerSide: z.boolean().default(false),
})
const exerciseSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  notes: z.string(),
  defaultRestSeconds: nonNegativeInteger,
  defaultWeightIncrement: z
    .union([z.number().finite().positive(), z.null()])
    .default(null),
  trackingMethodId: trackingMethodIdSchema,
  trackingMetrics: z.array(trackingMetricSchema),
  primaryMuscleGroups: z.array(muscleGroupSchema).default([]),
  secondaryMuscleGroups: z.array(muscleGroupSchema).default([]),
  equipmentType: exerciseEquipmentTypeSchema.default('barbell'),
  recordsRepsPerSide: z.boolean().default(false),
  origin: exerciseOriginSchema.default('custom'),
  seedDataVersion: z.union([nonNegativeInteger, z.null()]).default(null),
  status: exerciseStatusSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})
const programTemplateSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  notes: z.string(),
  status: entityStatusSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})
const programTemplateDaySchema = z.object({
  id: idSchema,
  templateId: idSchema,
  name: z.string().min(1),
  notes: z.string(),
  orderIndex: nonNegativeInteger,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})
const prescribedExerciseSchema = z.object({
  id: idSchema,
  templateId: idSchema,
  dayId: idSchema,
  exerciseId: idSchema,
  exerciseSnapshot: exerciseSnapshotSchema,
  orderIndex: nonNegativeInteger,
  targetSetCount: nonNegativeInteger,
  targetWeight: z.union([nonNegativeNumber, z.null()]).optional(),
  targetDurationSeconds: z.union([nonNegativeNumber, z.null()]).optional(),
  targetDistance: z.union([nonNegativeNumber, z.null()]).optional(),
  targetRepsMin: z.union([nonNegativeInteger, z.null()]),
  targetRepsMax: z.union([nonNegativeInteger, z.null()]),
  targetRir: z.union([nonNegativeNumber, z.null()]),
  restSecondsOverride: z.union([nonNegativeInteger, z.null()]),
  notes: z.string(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})
const activeProgramCycleSchema = z.object({
  id: idSchema,
  sourceTemplateId: nullableId,
  name: z.string().min(1),
  notes: z.string(),
  status: z.enum(['active', 'inactive', 'archived']),
  activatedAt: isoTimestampSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})
const activeCycleWorkoutDaySchema = z.object({
  id: idSchema,
  activeCycleId: idSchema,
  sourceTemplateDayId: nullableId,
  name: z.string().min(1),
  notes: z.string(),
  orderIndex: nonNegativeInteger,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})
const activeCycleWorkoutExerciseSchema = z.object({
  id: idSchema,
  activeCycleId: idSchema,
  dayId: idSchema,
  sourceTemplateExerciseId: nullableId,
  exerciseId: idSchema,
  exerciseSnapshot: exerciseSnapshotSchema,
  orderIndex: nonNegativeInteger,
  targetSetCount: nonNegativeInteger,
  targetWeight: z.union([nonNegativeNumber, z.null()]).optional(),
  targetDurationSeconds: z.union([nonNegativeNumber, z.null()]).optional(),
  targetDistance: z.union([nonNegativeNumber, z.null()]).optional(),
  targetRepsMin: z.union([nonNegativeInteger, z.null()]),
  targetRepsMax: z.union([nonNegativeInteger, z.null()]),
  targetRir: z.union([nonNegativeNumber, z.null()]),
  restSecondsOverride: z.union([nonNegativeInteger, z.null()]),
  notes: z.string(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})
const restTimerStateSchema = z.object({
  id: idSchema,
  startedAt: isoTimestampSchema,
  durationSeconds: nonNegativeInteger,
  pausedAt: z.union([isoTimestampSchema, z.null()]),
  accumulatedPausedSeconds: nonNegativeInteger,
  status: z.enum(['running', 'paused', 'dismissed', 'completed']),
})
const workoutSourceSnapshotSchema = z.object({
  activeCycleName: z.union([z.string(), z.null()]),
  templateName: z.union([z.string(), z.null()]),
  dayName: z.string(),
  dayNotes: z.string(),
})
const workoutSchema = z.object({
  id: idSchema,
  sourceActiveCycleId: nullableId,
  sourceTemplateId: nullableId,
  sourceDayId: nullableId,
  localDate: localDateSchema,
  name: z.string().min(1),
  workoutSnapshot: workoutSourceSnapshotSchema,
  notes: z.string(),
  startedAt: isoTimestampSchema,
  completedAt: z.union([isoTimestampSchema, z.null()]),
  durationSeconds: z.union([nonNegativeInteger, z.null()]),
  elapsedPausedSeconds: nonNegativeInteger,
  activeRestTimer: z.union([restTimerStateSchema, z.null()]),
  status: z.enum(['active', 'completed', 'cancelled']),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})
const workoutExerciseSchema = z.object({
  id: idSchema,
  workoutId: idSchema,
  exerciseId: nullableId,
  exerciseSnapshot: exerciseSnapshotSchema,
  sourcePrescribedExerciseId: nullableId,
  orderIndex: nonNegativeInteger,
  notes: z.string(),
  skipped: z.boolean(),
  replacementOfExerciseId: nullableId,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})
const metricValuesSchema = z.record(
  z.string(),
  z.union([z.number().finite(), z.boolean(), z.null()]),
)
const workoutSetSchema = z.object({
  id: idSchema,
  workoutId: idSchema,
  workoutExerciseId: idSchema,
  setNumber: nonNegativeInteger,
  metricValues: metricValuesSchema,
  rir: z.union([nonNegativeNumber, z.null()]),
  completed: z.boolean(),
  completedAt: z.union([isoTimestampSchema, z.null()]),
  restSecondsUsed: z.union([nonNegativeInteger, z.null()]),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})
const workoutHistoryEntrySchema = workoutSchema.extend({
  completedAt: isoTimestampSchema,
  durationSeconds: nonNegativeInteger,
  status: z.literal('completed'),
})
const workoutHistorySetSchema = workoutSetSchema.omit({
  createdAt: true,
  updatedAt: true,
})
const detectedWorkoutChangeSchema = z.object({
  id: idSchema,
  workoutId: idSchema,
  type: z.enum([
    'set_added',
    'set_removed',
    'exercise_added',
    'exercise_skipped_or_removed',
    'exercise_replaced',
    'exercise_order_changed',
  ]),
  description: z.string(),
  sourcePath: z.string(),
  performedPath: z.string(),
  selectedDestination: z.enum([
    'cycle_only',
    'template_only',
    'both',
    'neither',
  ]),
  appliedDestination: z.union([
    z.enum(['cycle_only', 'template_only', 'both', 'neither']),
    z.null(),
  ]),
  status: z.enum(['pending', 'applied', 'rejected', 'failed']),
  failureReason: z.union([z.string(), z.null()]),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})
const appliedWorkoutChangeSchema = z.object({
  id: idSchema,
  detectedChangeId: idSchema,
  workoutId: idSchema,
  destination: z.enum(['cycle_only', 'template_only', 'both', 'neither']),
  appliedAt: isoTimestampSchema,
  createdAt: isoTimestampSchema,
})

const backupDataSchema = z.object({
  userSettings: z.array(userSettingsSchema),
  nutritionTargets: z.array(nutritionTargetSchema),
  foods: z.array(foodSchema),
  foodLogEntries: z.array(foodLogEntrySchema),
  bodyweightEntries: z.array(bodyweightEntrySchema),
  exercises: z.array(exerciseSchema),
  programTemplates: z.array(programTemplateSchema),
  templateWorkoutDays: z.array(programTemplateDaySchema),
  templateWorkoutExercises: z.array(prescribedExerciseSchema),
  activeProgramCycles: z.array(activeProgramCycleSchema),
  activeCycleWorkoutDays: z.array(activeCycleWorkoutDaySchema),
  activeCycleWorkoutExercises: z.array(activeCycleWorkoutExerciseSchema),
  workouts: z.array(workoutSchema),
  workoutExercises: z.array(workoutExerciseSchema),
  workoutSets: z.array(workoutSetSchema),
  workoutHistoryEntries: z.array(workoutHistoryEntrySchema),
  workoutHistoryExercises: z.array(workoutExerciseSchema),
  workoutHistorySets: z.array(workoutHistorySetSchema),
  detectedWorkoutChanges: z.array(detectedWorkoutChangeSchema),
  appliedWorkoutChanges: z.array(appliedWorkoutChangeSchema),
})

const jsonBackupSchema = z.object({
  backupFormatVersion: z.number().int().positive(),
  databaseSchemaVersion: z.number().int().positive(),
  applicationVersion: z.string().min(1),
  exportedAt: isoTimestampSchema,
  data: backupDataSchema,
})

export function createBackupService(database: TrainingLogDatabase = db) {
  return {
    async createJsonBackup(now = new Date()) {
      const exportedAt = now.toISOString()
      const data = await readBackupData(database)
      const backup: JsonBackup = {
        backupFormatVersion: BACKUP_FORMAT_VERSION,
        databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
        applicationVersion: APPLICATION_VERSION,
        exportedAt,
        data,
      }

      await database.backupMetadata.put({
        id: `export-${exportedAt}`,
        backupSchemaVersion: BACKUP_FORMAT_VERSION,
        databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
        exportedAt,
        importedAt: null,
        mode: 'export',
        summary: `${countRecords(data)} records exported`,
        createdAt: exportedAt,
        updatedAt: exportedAt,
      })

      return {
        backup,
        filename: createReadableFilename(
          'training-log-backup',
          exportedAt,
          'json',
        ),
        json: `${JSON.stringify(backup, null, 2)}\n`,
      }
    },

    async parseBackupFile(file: File): Promise<ParsedBackupResult> {
      if (!file.name.toLowerCase().endsWith('.json')) {
        return invalidPreview(file.name, ['Select a JSON backup file.'])
      }

      if (file.size === 0) {
        return invalidPreview(file.name, ['The selected file is empty.'])
      }

      if (file.size > MAX_BACKUP_FILE_BYTES) {
        return invalidPreview(file.name, ['The selected file is too large.'])
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(await file.text())
      } catch {
        return invalidPreview(file.name, [
          'The selected file is not valid JSON.',
        ])
      }

      return validateBackup(parsed, file.name)
    },

    validateBackup,

    async restoreReplace(backup: JsonBackup, now = new Date()) {
      const validation = validateBackup(backup, 'selected backup')
      if (!validation.ok) {
        throw new Error(
          validation.preview.errors.join(' ') || 'Backup is invalid.',
        )
      }

      const importedAt = now.toISOString()
      await database.transaction('rw', writableTables(database), async () => {
        await Promise.all(
          tableNames.map((tableName) => database[tableName].clear()),
        )
        await putBackupData(database, validation.backup.data)
        const existingMetadata = await database.appMetadata.get('app')
        const metadata: AppMetadata = {
          id: 'app',
          databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
          backupSchemaVersion: BACKUP_SCHEMA_VERSION,
          createdAt: existingMetadata?.createdAt ?? importedAt,
          updatedAt: importedAt,
        }
        await database.appMetadata.put(metadata)
        await database.backupMetadata.put({
          id: `import-${importedAt}`,
          backupSchemaVersion: BACKUP_FORMAT_VERSION,
          databaseSchemaVersion: validation.backup.databaseSchemaVersion,
          exportedAt: validation.backup.exportedAt,
          importedAt,
          mode: 'import',
          summary: `${countRecords(validation.backup.data)} records imported`,
          createdAt: importedAt,
          updatedAt: importedAt,
        })
      })
      await createExerciseRepository(database).seedBuiltInExercises()
    },

    async clearAllData(now = new Date()) {
      const clearedAt = now.toISOString()
      await database.transaction('rw', writableTables(database), async () => {
        await Promise.all(
          tableNames.map((tableName) => database[tableName].clear()),
        )
        await database.appMetadata.put({
          id: 'app',
          databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
          backupSchemaVersion: BACKUP_SCHEMA_VERSION,
          createdAt: clearedAt,
          updatedAt: clearedAt,
        })
      })
      await createExerciseRepository(database).seedBuiltInExercises()
    },

    async createCsvArchive(now = new Date()) {
      const exportedAt = now.toISOString()
      const data = await readBackupData(database)
      const files = createCsvFiles(data)
      return {
        blob: createTarArchive(files),
        filename: createReadableFilename(
          'training-log-csv-export',
          exportedAt,
          'tar',
        ),
        files: files.map((file) => file.name),
      }
    },
  }
}

export const backupService = createBackupService()

export function validateBackup(
  input: unknown,
  filename: string,
): ParsedBackupResult {
  const parsed = jsonBackupSchema.safeParse(input)
  if (!parsed.success) {
    return invalidPreview(filename, parsed.error.issues.map(formatZodIssue))
  }

  const backup = normalizeBackup(parsed.data as JsonBackup)
  const errors: string[] = []
  const warnings: string[] = []

  if (backup.backupFormatVersion !== BACKUP_FORMAT_VERSION) {
    errors.push(
      `Backup format version ${backup.backupFormatVersion} is not supported.`,
    )
  }

  if (backup.databaseSchemaVersion > DATABASE_SCHEMA_VERSION) {
    errors.push(
      `Database schema version ${backup.databaseSchemaVersion} is newer than this app supports.`,
    )
  }

  errors.push(...validateRelationshipIntegrity(backup.data))
  const preview = createPreview(filename, backup, warnings, errors)

  return errors.length > 0
    ? { ok: false, preview }
    : { ok: true, backup, preview }
}

async function readBackupData(
  database: TrainingLogDatabase,
): Promise<BackupData> {
  return database.transaction(
    'r',
    tableNames.map((name) => database[name]),
    async () => ({
      userSettings: await sortedTable(database.userSettings),
      nutritionTargets: await sortedTable(database.nutritionTargets),
      foods: await sortedTable(database.foods),
      foodLogEntries: await sortedTable(database.foodLogEntries),
      bodyweightEntries: await sortedTable(database.bodyweightEntries),
      exercises: await sortedTable(database.exercises),
      programTemplates: await sortedTable(database.programTemplates),
      templateWorkoutDays: await sortedTable(database.templateWorkoutDays),
      templateWorkoutExercises: await sortedTable(
        database.templateWorkoutExercises,
      ),
      activeProgramCycles: await sortedTable(database.activeProgramCycles),
      activeCycleWorkoutDays: await sortedTable(
        database.activeCycleWorkoutDays,
      ),
      activeCycleWorkoutExercises: await sortedTable(
        database.activeCycleWorkoutExercises,
      ),
      workouts: await sortedTable(database.workouts),
      workoutExercises: await sortedTable(database.workoutExercises),
      workoutSets: await sortedTable(database.workoutSets),
      workoutHistoryEntries: await sortedTable(database.workoutHistoryEntries),
      workoutHistoryExercises: await sortedTable(
        database.workoutHistoryExercises,
      ),
      workoutHistorySets: await sortedTable(database.workoutHistorySets),
      detectedWorkoutChanges: await sortedTable(
        database.detectedWorkoutChanges,
      ),
      appliedWorkoutChanges: await sortedTable(database.appliedWorkoutChanges),
    }),
  )
}

async function sortedTable<T extends { id: string }>(table: {
  toArray(): Promise<T[]>
}) {
  return (await table.toArray()).toSorted((left, right) =>
    left.id.localeCompare(right.id),
  )
}

async function putBackupData(database: TrainingLogDatabase, data: BackupData) {
  await database.userSettings.bulkPut(data.userSettings)
  await database.nutritionTargets.bulkPut(data.nutritionTargets)
  await database.foods.bulkPut(data.foods)
  await database.foodLogEntries.bulkPut(data.foodLogEntries)
  await database.bodyweightEntries.bulkPut(data.bodyweightEntries)
  await database.exercises.bulkPut(data.exercises)
  await database.programTemplates.bulkPut(data.programTemplates)
  await database.templateWorkoutDays.bulkPut(data.templateWorkoutDays)
  await database.templateWorkoutExercises.bulkPut(data.templateWorkoutExercises)
  await database.activeProgramCycles.bulkPut(data.activeProgramCycles)
  await database.activeCycleWorkoutDays.bulkPut(data.activeCycleWorkoutDays)
  await database.activeCycleWorkoutExercises.bulkPut(
    data.activeCycleWorkoutExercises,
  )
  await database.workouts.bulkPut(data.workouts)
  await database.workoutExercises.bulkPut(data.workoutExercises)
  await database.workoutSets.bulkPut(data.workoutSets)
  await database.workoutHistoryEntries.bulkPut(data.workoutHistoryEntries)
  await database.workoutHistoryExercises.bulkPut(data.workoutHistoryExercises)
  await database.workoutHistorySets.bulkPut(data.workoutHistorySets)
  await database.detectedWorkoutChanges.bulkPut(data.detectedWorkoutChanges)
  await database.appliedWorkoutChanges.bulkPut(data.appliedWorkoutChanges)
}

function writableTables(database: TrainingLogDatabase) {
  return [
    ...tableNames.map((name) => database[name]),
    database.appMetadata,
    database.backupMetadata,
  ]
}

function validateRelationshipIntegrity(data: BackupData) {
  const errors: string[] = []
  for (const tableName of tableNames) {
    errors.push(...findDuplicateIds(data[tableName], tableName))
  }

  const foodIds = idSet(data.foods)
  const exerciseIds = idSet(data.exercises)
  const templateIds = idSet(data.programTemplates)
  const templateDayIds = idSet(data.templateWorkoutDays)
  const templateExerciseIds = idSet(data.templateWorkoutExercises)
  const cycleIds = idSet(data.activeProgramCycles)
  const activeDayIds = idSet(data.activeCycleWorkoutDays)
  const workoutIds = idSet(data.workouts)
  const workoutExerciseIds = idSet(data.workoutExercises)
  const historyWorkoutIds = idSet(data.workoutHistoryEntries)
  const historyExerciseIds = idSet(data.workoutHistoryExercises)
  const detectedChangeIds = idSet(data.detectedWorkoutChanges)

  for (const log of data.foodLogEntries) {
    if (log.foodId && !foodIds.has(log.foodId)) {
      errors.push(`Food log ${log.id} references missing food ${log.foodId}.`)
    }
  }

  for (const day of data.templateWorkoutDays) {
    if (!templateIds.has(day.templateId)) {
      errors.push(
        `Template day ${day.id} references missing program ${day.templateId}.`,
      )
    }
  }

  for (const exercise of data.templateWorkoutExercises) {
    if (!templateIds.has(exercise.templateId)) {
      errors.push(
        `Template exercise ${exercise.id} references missing program ${exercise.templateId}.`,
      )
    }
    if (!templateDayIds.has(exercise.dayId)) {
      errors.push(
        `Template exercise ${exercise.id} references missing day ${exercise.dayId}.`,
      )
    }
    if (!exerciseIds.has(exercise.exerciseId)) {
      errors.push(
        `Template exercise ${exercise.id} references missing exercise ${exercise.exerciseId}.`,
      )
    }
  }

  for (const cycle of data.activeProgramCycles) {
    if (cycle.sourceTemplateId && !templateIds.has(cycle.sourceTemplateId)) {
      errors.push(
        `Active cycle ${cycle.id} references missing source program ${cycle.sourceTemplateId}.`,
      )
    }
  }

  for (const day of data.activeCycleWorkoutDays) {
    if (!cycleIds.has(day.activeCycleId)) {
      errors.push(
        `Active-cycle day ${day.id} references missing cycle ${day.activeCycleId}.`,
      )
    }
    if (
      day.sourceTemplateDayId &&
      !templateDayIds.has(day.sourceTemplateDayId)
    ) {
      errors.push(
        `Active-cycle day ${day.id} references missing template day ${day.sourceTemplateDayId}.`,
      )
    }
  }

  for (const exercise of data.activeCycleWorkoutExercises) {
    if (!cycleIds.has(exercise.activeCycleId)) {
      errors.push(
        `Active-cycle exercise ${exercise.id} references missing cycle ${exercise.activeCycleId}.`,
      )
    }
    if (!activeDayIds.has(exercise.dayId)) {
      errors.push(
        `Active-cycle exercise ${exercise.id} references missing day ${exercise.dayId}.`,
      )
    }
    if (!exerciseIds.has(exercise.exerciseId)) {
      errors.push(
        `Active-cycle exercise ${exercise.id} references missing exercise ${exercise.exerciseId}.`,
      )
    }
    if (
      exercise.sourceTemplateExerciseId &&
      !templateExerciseIds.has(exercise.sourceTemplateExerciseId)
    ) {
      errors.push(
        `Active-cycle exercise ${exercise.id} references missing template exercise ${exercise.sourceTemplateExerciseId}.`,
      )
    }
  }

  for (const workout of data.workouts) {
    if (
      workout.sourceActiveCycleId &&
      !cycleIds.has(workout.sourceActiveCycleId)
    ) {
      errors.push(
        `Workout ${workout.id} references missing cycle ${workout.sourceActiveCycleId}.`,
      )
    }
    if (
      workout.sourceTemplateId &&
      !templateIds.has(workout.sourceTemplateId)
    ) {
      errors.push(
        `Workout ${workout.id} references missing program ${workout.sourceTemplateId}.`,
      )
    }
    if (workout.sourceDayId && !activeDayIds.has(workout.sourceDayId)) {
      errors.push(
        `Workout ${workout.id} references missing active day ${workout.sourceDayId}.`,
      )
    }
  }

  for (const exercise of data.workoutExercises) {
    if (!workoutIds.has(exercise.workoutId)) {
      errors.push(
        `Workout exercise ${exercise.id} references missing workout ${exercise.workoutId}.`,
      )
    }
    if (exercise.exerciseId && !exerciseIds.has(exercise.exerciseId)) {
      errors.push(
        `Workout exercise ${exercise.id} references missing exercise ${exercise.exerciseId}.`,
      )
    }
  }

  for (const set of data.workoutSets) {
    if (!workoutIds.has(set.workoutId)) {
      errors.push(
        `Workout set ${set.id} references missing workout ${set.workoutId}.`,
      )
    }
    if (!workoutExerciseIds.has(set.workoutExerciseId)) {
      errors.push(
        `Workout set ${set.id} references missing workout exercise ${set.workoutExerciseId}.`,
      )
    }
  }

  for (const workout of data.workoutHistoryEntries) {
    if (
      workout.sourceActiveCycleId &&
      !cycleIds.has(workout.sourceActiveCycleId)
    ) {
      errors.push(
        `History workout ${workout.id} references missing cycle ${workout.sourceActiveCycleId}.`,
      )
    }
    if (
      workout.sourceTemplateId &&
      !templateIds.has(workout.sourceTemplateId)
    ) {
      errors.push(
        `History workout ${workout.id} references missing program ${workout.sourceTemplateId}.`,
      )
    }
  }

  for (const exercise of data.workoutHistoryExercises) {
    if (!historyWorkoutIds.has(exercise.workoutId)) {
      errors.push(
        `History exercise ${exercise.id} references missing workout ${exercise.workoutId}.`,
      )
    }
    if (exercise.exerciseId && !exerciseIds.has(exercise.exerciseId)) {
      errors.push(
        `History exercise ${exercise.id} references missing exercise ${exercise.exerciseId}.`,
      )
    }
  }

  for (const set of data.workoutHistorySets) {
    if (!historyWorkoutIds.has(set.workoutId)) {
      errors.push(
        `History set ${set.id} references missing workout ${set.workoutId}.`,
      )
    }
    if (!historyExerciseIds.has(set.workoutExerciseId)) {
      errors.push(
        `History set ${set.id} references missing history exercise ${set.workoutExerciseId}.`,
      )
    }
  }

  for (const change of data.detectedWorkoutChanges) {
    if (!historyWorkoutIds.has(change.workoutId)) {
      errors.push(
        `Detected change ${change.id} references missing history workout ${change.workoutId}.`,
      )
    }
  }

  for (const change of data.appliedWorkoutChanges) {
    if (!historyWorkoutIds.has(change.workoutId)) {
      errors.push(
        `Applied change ${change.id} references missing history workout ${change.workoutId}.`,
      )
    }
    if (!detectedChangeIds.has(change.detectedChangeId)) {
      errors.push(
        `Applied change ${change.id} references missing detected change ${change.detectedChangeId}.`,
      )
    }
  }

  return errors
}

function normalizeBackup(backup: JsonBackup): JsonBackup {
  return {
    ...backup,
    data: {
      ...backup.data,
      exercises: backup.data.exercises.map((exercise) => {
        const trackingMethod = getTrackingMethod(exercise.trackingMethodId)
        return {
          ...exercise,
          defaultWeightIncrement:
            exercise.defaultWeightIncrement ??
            defaultWeightIncrementForTracking(exercise.trackingMethodId),
          trackingMetrics: exercise.trackingMetrics.length
            ? exercise.trackingMetrics
            : (trackingMethod?.metrics ?? []),
          equipmentType:
            exercise.equipmentType ??
            defaultEquipmentForTracking(exercise.trackingMethodId),
          origin: exercise.origin ?? 'custom',
          seedDataVersion: exercise.seedDataVersion ?? null,
        }
      }),
    },
  }
}

function defaultWeightIncrementForTracking(trackingMethodId: string) {
  if (
    trackingMethodId === 'weight_reps' ||
    trackingMethodId === 'assisted_weight_reps' ||
    trackingMethodId === 'added_weight_reps'
  ) {
    return 5
  }
  return null
}

function defaultEquipmentForTracking(trackingMethodId: string) {
  if (
    trackingMethodId === 'reps_only' ||
    trackingMethodId === 'bodyweight_reps' ||
    trackingMethodId === 'added_weight_reps'
  ) {
    return 'bodyweight'
  }
  return 'barbell'
}

function findDuplicateIds(records: Array<{ id: string }>, tableName: string) {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const record of records) {
    if (seen.has(record.id)) {
      duplicates.add(record.id)
    }
    seen.add(record.id)
  }
  return [...duplicates].map(
    (id) => `${tableName} contains duplicate ID ${id}.`,
  )
}

function idSet(records: Array<{ id: string }>) {
  return new Set(records.map((record) => record.id))
}

function createPreview(
  filename: string,
  backup: JsonBackup,
  warnings: string[],
  errors: string[],
): BackupPreview {
  const counts = Object.fromEntries(
    tableNames.map((tableName) => [tableName, backup.data[tableName].length]),
  ) as Record<DataTableName, number>

  return {
    filename,
    exportedAt: backup.exportedAt,
    backupFormatVersion: backup.backupFormatVersion,
    databaseSchemaVersion: backup.databaseSchemaVersion,
    applicationVersion: backup.applicationVersion,
    restoreMode: 'replace',
    currentDataWillBeReplaced: true,
    totalRecordCount: Object.values(counts).reduce(
      (sum, count) => sum + count,
      0,
    ),
    counts,
    warnings,
    errors,
  }
}

function invalidPreview(
  filename: string,
  errors: string[],
): ParsedBackupResult {
  const backup: JsonBackup = {
    backupFormatVersion: 0,
    databaseSchemaVersion: 0,
    applicationVersion: 'unknown',
    exportedAt: 'unknown',
    data: emptyBackupData(),
  }
  return { ok: false, preview: createPreview(filename, backup, [], errors) }
}

function emptyBackupData(): BackupData {
  return Object.fromEntries(
    tableNames.map((tableName) => [tableName, []]),
  ) as unknown as BackupData
}

function countRecords(data: BackupData) {
  return tableNames.reduce((sum, tableName) => sum + data[tableName].length, 0)
}

function formatZodIssue(issue: z.core.$ZodIssue) {
  const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
  return `${path}${issue.message}`
}

export function createReadableFilename(
  prefix: string,
  isoTimestamp: string,
  extension: string,
) {
  const safeTimestamp = isoTimestamp.replaceAll(':', '-').replaceAll('.', '-')
  return `${prefix}-${safeTimestamp}.${extension}`
}

export function createCsvFiles(data: BackupData) {
  return tableNames.map((tableName) => ({
    name: `${tableName}.csv`,
    content: toCsv(data[tableName]),
  }))
}

function toCsv(records: Array<Record<string, unknown>>) {
  const headers = [
    ...records.reduce<Set<string>>(
      (keys, record) => {
        Object.keys(record).forEach((key) => keys.add(key))
        return keys
      },
      new Set(['id']),
    ),
  ]

  return `${headers.join(',')}\n${records
    .map((record) =>
      headers
        .map((header) => csvEscape(normalizeCsvValue(record[header])))
        .join(','),
    )
    .join('\n')}${records.length > 0 ? '\n' : ''}`
}

function normalizeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

export function csvEscape(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

function createTarArchive(files: Array<{ name: string; content: string }>) {
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  for (const file of files) {
    const bytes = encoder.encode(file.content)
    chunks.push(createTarHeader(file.name, bytes.length))
    chunks.push(bytes)
    chunks.push(new Uint8Array((512 - (bytes.length % 512)) % 512))
  }
  chunks.push(new Uint8Array(1024))
  return new Blob(chunks.map(toBlobPart), { type: 'application/x-tar' })
}

function toBlobPart(chunk: Uint8Array) {
  const copy = new Uint8Array(chunk.byteLength)
  copy.set(chunk)
  return copy.buffer
}

function createTarHeader(filename: string, size: number) {
  const header = new Uint8Array(512)
  writeTarField(header, 0, 100, filename)
  writeTarField(header, 100, 8, '0000644')
  writeTarField(header, 108, 8, '0000000')
  writeTarField(header, 116, 8, '0000000')
  writeTarField(header, 124, 12, size.toString(8).padStart(11, '0'))
  writeTarField(
    header,
    136,
    12,
    Math.floor(Date.now() / 1000)
      .toString(8)
      .padStart(11, '0'),
  )
  header.fill(32, 148, 156)
  header[156] = '0'.charCodeAt(0)
  writeTarField(header, 257, 6, 'ustar')
  writeTarField(header, 263, 2, '00')
  const checksum = header.reduce((sum, value) => sum + value, 0)
  writeTarField(header, 148, 8, checksum.toString(8).padStart(6, '0'))
  header[154] = 0
  header[155] = 32
  return header
}

function writeTarField(
  header: Uint8Array,
  offset: number,
  length: number,
  value: string,
) {
  const bytes = new TextEncoder().encode(value)
  header.set(bytes.slice(0, length - 1), offset)
}
