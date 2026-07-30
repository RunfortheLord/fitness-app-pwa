import { zip, type AsyncZippable } from 'fflate'

import { DATABASE_NAME, DATABASE_SCHEMA_VERSION } from '@db/database'
import type {
  AppLanguage,
  EnergyUnit,
  NutritionTargetValues,
  WeightUnit,
} from '@shared-types/app'
import type { BackupData, JsonBackup } from '@services/backupService'

export const FITNESS_DATA_EXPORT_FORMAT = 'fitness-app-data-export'
export const FITNESS_DATA_EXPORT_VERSION = 1

const encoder = new TextEncoder()
const knownWorkoutMetricKeys = new Set([
  'weight',
  'reps',
  'durationSeconds',
  'distance',
  'assistedWeight',
  'assistanceWeight',
  'addedWeight',
  'bodyweight',
])

type BackupTableName = keyof BackupData
type CsvValue = string | number | boolean | null | undefined
type CsvRow = Record<string, CsvValue>

export type ExportColumn = {
  name: string
  type: string
  nullable: boolean
}

export type ExportManifestTable = {
  name: string
  description: string
  recordCount: number
  file: string
  sha256?: string
  columns: ExportColumn[]
}

export type ExportManifestReport = {
  name: string
  purpose: string
  rowCount: number
  file: string
}

export type FitnessDataExportManifest = {
  exportFormat: typeof FITNESS_DATA_EXPORT_FORMAT
  exportFormatVersion: number
  generatedAtUtc: string
  generatedAtLocal: string
  timeZone: string
  appVersion: string
  appBuild?: string
  databaseName: string
  databaseSchemaVersion: number
  language: AppLanguage
  weightUnit: WeightUnit
  energyUnit: EnergyUnit
  canonicalBackupFile: string
  schemaFile: string
  tables: ExportManifestTable[]
  reports: ExportManifestReport[]
}

export type ExportValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] }

export type FitnessDataExportResult = {
  blob: Blob
  filename: string
  files: string[]
  fileCount: number
  totalRecordCount: number
  byteSize: number
  manifest: FitnessDataExportManifest
  validation: ExportValidationResult
}

type CreateExportOptions = {
  now: Date
  timeZone: string
  tableNames: readonly BackupTableName[]
  backupJsonSchema: unknown
  validateCanonicalBackup: (backup: JsonBackup) => string[]
  appBuild?: string
}

type ExportFile = {
  path: string
  content: string
}

type ReportDefinition = {
  name: string
  purpose: string
  columns: readonly string[]
  rows: CsvRow[]
}

const tableDescriptions: Record<BackupTableName, string> = {
  userSettings: 'User preferences and configured local units.',
  nutritionTargets: 'Timestamped nutrition-target history.',
  foods: 'Local and cached provider food records.',
  foodLogEntries: 'Historical food logs with immutable nutrition snapshots.',
  savedMeals: 'Reusable meals with component snapshots.',
  foodUnitPreferences: 'Remembered serving-unit choices.',
  barcodeProductCache: 'Device-local barcode-to-food associations.',
  bodyweightEntries: 'Bodyweight history, including same-day entries.',
  exercises: 'Built-in and custom exercise definitions.',
  programTemplates: 'Program template metadata.',
  templateWorkoutDays: 'Workout days belonging to program templates.',
  templateWorkoutExercises: 'Prescribed exercises belonging to template days.',
  activeProgramCycles: 'Activated program-cycle snapshots.',
  activeCycleWorkoutDays: 'Workout days belonging to active cycles.',
  activeCycleWorkoutExercises:
    'Prescribed exercises belonging to active-cycle days.',
  workouts: 'Active, completed, or cancelled workout records.',
  workoutExercises: 'Exercises belonging to workout records.',
  workoutSets: 'Sets belonging to workout exercises.',
  workoutHistoryEntries: 'Immutable completed-workout history.',
  workoutHistoryExercises: 'Exercises belonging to completed history.',
  workoutHistorySets: 'Sets belonging to completed history exercises.',
  detectedWorkoutChanges: 'Individually reviewable detected workout changes.',
  appliedWorkoutChanges: 'Audit records for explicitly applied changes.',
  runs: 'Active and completed running-session summaries.',
  runSamples: 'Raw running GPS samples and acceptance decisions.',
  runPauses: 'Running-session pause intervals.',
  runSplits: 'Running-session mile splits.',
  runClassifications: 'Walking and resting classifications for runs.',
}

export async function createFitnessDataExport(
  backup: JsonBackup,
  options: CreateExportOptions,
): Promise<FitnessDataExportResult> {
  const folderName = createLocalExportStem(options.now, options.timeZone)
  const canonicalBackupFile = 'backup/fitness-data-backup.json'
  const schemaFile = 'backup/schema.json'
  const settings = backup.data.userSettings[0]
  const language = settings?.language ?? 'en'
  const weightUnit = settings?.weightUnit ?? 'lb'
  const energyUnit = settings?.energyUnit ?? 'kcal'
  const tableFiles = await Promise.all(
    options.tableNames.map(async (name) => {
      const content = stringifyJson(backup.data[name])
      const checksum = await sha256(content)
      const columns = columnsForTable(options.backupJsonSchema, name)
      return {
        file: {
          path: `backup/${name}.json`,
          content,
        },
        manifest: {
          name,
          description: tableDescriptions[name],
          recordCount: backup.data[name].length,
          file: `backup/${name}.json`,
          ...(checksum ? { sha256: checksum } : {}),
          columns,
        } satisfies ExportManifestTable,
      }
    }),
  )
  const reports = createReports(backup.data, weightUnit, energyUnit)
  const reportManifests: ExportManifestReport[] = reports.map((report) => ({
    name: report.name,
    purpose: report.purpose,
    rowCount: report.rows.length,
    file: `reports/${report.name}.csv`,
  }))
  const summaryRows = createSummaryRows(
    tableFiles.map((entry) => entry.manifest),
    reportManifests,
  )
  const summaryReport = reports.find(
    (report) => report.name === 'export-summary',
  )
  if (!summaryReport) {
    throw new Error('The export summary report definition is missing.')
  }
  summaryReport.rows = summaryRows
  const summaryManifest = reportManifests.find(
    (report) => report.name === 'export-summary',
  )
  if (summaryManifest) {
    summaryManifest.rowCount = summaryRows.length
  }

  const manifest: FitnessDataExportManifest = {
    exportFormat: FITNESS_DATA_EXPORT_FORMAT,
    exportFormatVersion: FITNESS_DATA_EXPORT_VERSION,
    generatedAtUtc: options.now.toISOString(),
    generatedAtLocal: formatLocalIso(options.now, options.timeZone),
    timeZone: options.timeZone,
    appVersion: backup.applicationVersion,
    ...(options.appBuild ? { appBuild: options.appBuild } : {}),
    databaseName: DATABASE_NAME,
    databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
    language,
    weightUnit,
    energyUnit,
    canonicalBackupFile,
    schemaFile,
    tables: tableFiles.map((entry) => entry.manifest),
    reports: reportManifests,
  }

  const files: ExportFile[] = [
    { path: 'README.txt', content: createReadme(manifest) },
    { path: 'manifest.json', content: stringifyJson(manifest) },
    { path: canonicalBackupFile, content: stringifyJson(backup) },
    { path: schemaFile, content: stringifyJson(options.backupJsonSchema) },
    ...tableFiles.map((entry) => entry.file),
    ...reports.map((report) => ({
      path: `reports/${report.name}.csv`,
      content: createCsv(report.columns, report.rows),
    })),
  ]
  const validation = await validateFitnessDataExport({
    backup,
    files,
    manifest,
    tableNames: options.tableNames,
    validateCanonicalBackup: options.validateCanonicalBackup,
  })
  if (!validation.ok) {
    throw new Error(`Export validation failed: ${validation.errors.join(' ')}`)
  }

  const archiveBytes = await createZip(folderName, files, options.now)
  const blob = new Blob([toArrayBuffer(archiveBytes)], {
    type: 'application/zip',
  })
  return {
    blob,
    filename: `${folderName}.zip`,
    files: files.map((file) => `${folderName}/${file.path}`),
    fileCount: files.length,
    totalRecordCount: manifest.tables.reduce(
      (sum, table) => sum + table.recordCount,
      0,
    ),
    byteSize: blob.size,
    manifest,
    validation,
  }
}

export async function validateFitnessDataExport(input: {
  backup: JsonBackup
  files: ExportFile[]
  manifest: FitnessDataExportManifest
  tableNames: readonly BackupTableName[]
  validateCanonicalBackup: (backup: JsonBackup) => string[]
}): Promise<ExportValidationResult> {
  const errors: string[] = []
  const paths = input.files.map((file) => file.path)
  const uniquePaths = new Set(paths)
  if (uniquePaths.size !== paths.length) {
    errors.push('Every export file must have a unique path.')
  }

  const requiredPaths = [
    'README.txt',
    'manifest.json',
    input.manifest.canonicalBackupFile,
    input.manifest.schemaFile,
    ...input.tableNames.map((name) => `backup/${name}.json`),
    ...input.manifest.reports.map((report) => report.file),
  ]
  for (const requiredPath of requiredPaths) {
    if (!uniquePaths.has(requiredPath)) {
      errors.push(`Required file is missing: ${requiredPath}.`)
    }
  }

  const canonicalErrors = input.validateCanonicalBackup(input.backup)
  errors.push(...canonicalErrors)
  for (const file of input.files.filter((candidate) =>
    candidate.path.endsWith('.json'),
  )) {
    try {
      JSON.parse(file.content)
    } catch {
      errors.push(`${file.path} does not contain valid JSON.`)
    }
  }
  for (const table of input.manifest.tables) {
    const file = input.files.find((candidate) => candidate.path === table.file)
    if (!file) {
      continue
    }
    try {
      const parsed: unknown = JSON.parse(file.content)
      if (!Array.isArray(parsed)) {
        errors.push(`${table.file} must contain a JSON array.`)
      } else if (parsed.length !== table.recordCount) {
        errors.push(`${table.file} record count does not match the manifest.`)
      }
    } catch {
      errors.push(`${table.file} does not contain valid JSON.`)
    }
    if (table.sha256) {
      const actualChecksum = await sha256(file.content)
      if (actualChecksum && actualChecksum !== table.sha256) {
        errors.push(`${table.file} checksum does not match the manifest.`)
      }
    }
  }
  for (const report of input.manifest.reports) {
    const file = input.files.find((candidate) => candidate.path === report.file)
    if (file && countCsvDataRows(file.content) !== report.rowCount) {
      errors.push(`${report.file} row count does not match the manifest.`)
    }
  }
  if (findDisallowedSecretFields(input.backup).length > 0) {
    errors.push('Canonical backup contains a disallowed secret field.')
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true }
}

export function createCsv(
  columns: readonly string[],
  rows: readonly CsvRow[],
): string {
  const lines = [
    columns.map(csvEscape).join(','),
    ...rows.map((row) =>
      columns.map((column) => csvEscape(formatCsvValue(row[column]))).join(','),
    ),
  ]
  return `${lines.join('\r\n')}\r\n`
}

export function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

export function protectCsvText(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value
}

function createReports(
  data: BackupData,
  weightUnit: WeightUnit,
  energyUnit: EnergyUnit,
): ReportDefinition[] {
  return [
    workoutHistoryReport(data, weightUnit),
    dailyNutritionReport(data, energyUnit),
    foodLogReport(data, energyUnit),
    bodyweightReport(data),
    programsReport(data, weightUnit),
    exerciseLibraryReport(data),
    {
      name: 'export-summary',
      purpose: 'Inventory of canonical tables and human-readable reports.',
      columns: ['kind', 'name', 'purpose', 'rowCount', 'relativePath'],
      rows: [],
    },
  ]
}

function workoutHistoryReport(
  data: BackupData,
  weightUnit: WeightUnit,
): ReportDefinition {
  const workouts = new Map(
    data.workoutHistoryEntries.map((workout) => [workout.id, workout]),
  )
  const exercises = new Map(
    data.workoutHistoryExercises.map((exercise) => [exercise.id, exercise]),
  )
  const rows = [...data.workoutHistorySets]
    .sort((left, right) => {
      const leftWorkout = workouts.get(left.workoutId)
      const rightWorkout = workouts.get(right.workoutId)
      return (
        (leftWorkout?.localDate ?? '').localeCompare(
          rightWorkout?.localDate ?? '',
        ) ||
        (exercises.get(left.workoutExerciseId)?.orderIndex ?? 0) -
          (exercises.get(right.workoutExerciseId)?.orderIndex ?? 0) ||
        left.setNumber - right.setNumber ||
        left.id.localeCompare(right.id)
      )
    })
    .map((set) => {
      const workout = workouts.get(set.workoutId)
      const exercise = exercises.get(set.workoutExerciseId)
      const metrics = set.metricValues
      const distanceMetric = exercise?.exerciseSnapshot.trackingMetrics.find(
        (metric) => metric.key === 'distance',
      )
      const fallbackMetrics = Object.fromEntries(
        Object.entries(metrics)
          .filter(([key]) => !knownWorkoutMetricKeys.has(key))
          .sort(([left], [right]) => left.localeCompare(right)),
      )
      return {
        workoutId: set.workoutId,
        localDate: workout?.localDate,
        workoutName: workout?.name,
        programName: workout?.workoutSnapshot.templateName,
        cycleName: workout?.workoutSnapshot.activeCycleName,
        startedAt: workout?.startedAt,
        completedAt: workout?.completedAt,
        workoutDurationSeconds: workout?.durationSeconds,
        exerciseOrder:
          exercise === undefined ? undefined : exercise.orderIndex + 1,
        exerciseId: exercise?.exerciseId,
        exerciseName: exercise?.exerciseSnapshot.exerciseName,
        trackingMethod: exercise?.exerciseSnapshot.trackingMethodId,
        setNumber: set.setNumber,
        completed: set.completed,
        weight: numberMetric(metrics.weight),
        weightUnit:
          metrics.weight === undefined || metrics.weight === null
            ? ''
            : weightUnit,
        reps: numberMetric(metrics.reps),
        rir: set.rir,
        durationSeconds: numberMetric(metrics.durationSeconds),
        distance: numberMetric(metrics.distance),
        distanceUnit:
          metrics.distance === undefined || metrics.distance === null
            ? ''
            : (distanceMetric?.unit ?? ''),
        assistedWeight:
          numberMetric(metrics.assistedWeight) ??
          numberMetric(metrics.assistanceWeight),
        addedWeight: numberMetric(metrics.addedWeight),
        bodyweight: numberMetric(metrics.bodyweight),
        loadUnit:
          metrics.assistedWeight !== undefined ||
          metrics.assistanceWeight !== undefined ||
          metrics.addedWeight !== undefined ||
          metrics.bodyweight !== undefined
            ? weightUnit
            : '',
        restSeconds: set.restSecondsUsed,
        exerciseNotes: exercise?.notes,
        otherMetrics:
          Object.keys(fallbackMetrics).length > 0
            ? JSON.stringify(fallbackMetrics)
            : '',
        setCompletedAt: set.completedAt,
        setId: set.id,
        workoutExerciseId: set.workoutExerciseId,
      }
    })

  return {
    name: 'workout-history',
    purpose: 'One row per recorded set in completed workout history.',
    columns: [
      'workoutId',
      'localDate',
      'workoutName',
      'programName',
      'cycleName',
      'startedAt',
      'completedAt',
      'workoutDurationSeconds',
      'exerciseOrder',
      'exerciseId',
      'exerciseName',
      'trackingMethod',
      'setNumber',
      'completed',
      'weight',
      'weightUnit',
      'reps',
      'rir',
      'durationSeconds',
      'distance',
      'distanceUnit',
      'assistedWeight',
      'addedWeight',
      'bodyweight',
      'loadUnit',
      'restSeconds',
      'exerciseNotes',
      'otherMetrics',
      'setCompletedAt',
      'setId',
      'workoutExerciseId',
    ],
    rows,
  }
}

function dailyNutritionReport(
  data: BackupData,
  energyUnit: EnergyUnit,
): ReportDefinition {
  const dates = [
    ...new Set(data.foodLogEntries.map((entry) => entry.localDate)),
  ].sort()
  const sortedTargets = [...data.nutritionTargets].sort(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id),
  )
  const currentTargets = data.userSettings[0]?.nutritionTargets
  const rows = dates.map((localDate) => {
    const entries = data.foodLogEntries.filter(
      (entry) => entry.localDate === localDate,
    )
    const totals = entries.reduce<NutritionTargetValues>(
      (sum, entry) => ({
        calories: sum.calories + entry.computedCalories,
        proteinGrams: sum.proteinGrams + entry.computedProteinGrams,
        carbohydrateGrams:
          sum.carbohydrateGrams + entry.computedCarbohydrateGrams,
        fatGrams: sum.fatGrams + entry.computedFatGrams,
      }),
      zeroNutrition(),
    )
    const target = targetForLocalDate(localDate, sortedTargets, currentTargets)
    return {
      localDate,
      caloriesConsumed: totals.calories,
      energyUnit,
      proteinGramsConsumed: totals.proteinGrams,
      carbohydrateGramsConsumed: totals.carbohydrateGrams,
      fatGramsConsumed: totals.fatGrams,
      calorieTarget: target.calories,
      proteinGramsTarget: target.proteinGrams,
      carbohydrateGramsTarget: target.carbohydrateGrams,
      fatGramsTarget: target.fatGrams,
      calorieDifference: totals.calories - target.calories,
      proteinGramsDifference: totals.proteinGrams - target.proteinGrams,
      carbohydrateGramsDifference:
        totals.carbohydrateGrams - target.carbohydrateGrams,
      fatGramsDifference: totals.fatGrams - target.fatGrams,
      loggedFoodEntryCount: entries.length,
    }
  })
  return {
    name: 'daily-nutrition',
    purpose: 'Daily consumed nutrition compared with the historical target.',
    columns: [
      'localDate',
      'caloriesConsumed',
      'energyUnit',
      'proteinGramsConsumed',
      'carbohydrateGramsConsumed',
      'fatGramsConsumed',
      'calorieTarget',
      'proteinGramsTarget',
      'carbohydrateGramsTarget',
      'fatGramsTarget',
      'calorieDifference',
      'proteinGramsDifference',
      'carbohydrateGramsDifference',
      'fatGramsDifference',
      'loggedFoodEntryCount',
    ],
    rows,
  }
}

function foodLogReport(
  data: BackupData,
  energyUnit: EnergyUnit,
): ReportDefinition {
  const rows = [...data.foodLogEntries]
    .sort(
      (left, right) =>
        left.localDate.localeCompare(right.localDate) ||
        left.createdAt.localeCompare(right.createdAt) ||
        left.id.localeCompare(right.id),
    )
    .map((entry) => ({
      localDate: entry.localDate,
      mealType: entry.mealType,
      foodName: entry.foodSnapshot.foodName,
      brandName: entry.foodSnapshot.brandName,
      servingAmount:
        entry.foodSnapshot.servingQuantity * entry.servingMultiplier,
      servingUnit: entry.foodSnapshot.servingUnit,
      servingMultiplier: entry.servingMultiplier,
      calories: entry.computedCalories,
      energyUnit,
      proteinGrams: entry.computedProteinGrams,
      carbohydrateGrams: entry.computedCarbohydrateGrams,
      fatGrams: entry.computedFatGrams,
      source:
        entry.foodSnapshot.provider ?? entry.foodSnapshot.sourceType ?? 'local',
      providerRecordId: entry.foodSnapshot.providerRecordId,
      notes: entry.notes,
      foodLogEntryId: entry.id,
      foodId: entry.foodId,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }))
  return {
    name: 'food-log',
    purpose: 'One row per logged food component using immutable snapshots.',
    columns: [
      'localDate',
      'mealType',
      'foodName',
      'brandName',
      'servingAmount',
      'servingUnit',
      'servingMultiplier',
      'calories',
      'energyUnit',
      'proteinGrams',
      'carbohydrateGrams',
      'fatGrams',
      'source',
      'providerRecordId',
      'notes',
      'foodLogEntryId',
      'foodId',
      'createdAt',
      'updatedAt',
    ],
    rows,
  }
}

function bodyweightReport(data: BackupData): ReportDefinition {
  return {
    name: 'bodyweight',
    purpose: 'Bodyweight entries sorted by local date and timestamp.',
    columns: [
      'localDate',
      'weight',
      'weightUnit',
      'notes',
      'bodyweightEntryId',
      'createdAt',
      'updatedAt',
    ],
    rows: [...data.bodyweightEntries]
      .sort(
        (left, right) =>
          left.localDate.localeCompare(right.localDate) ||
          left.createdAt.localeCompare(right.createdAt) ||
          left.id.localeCompare(right.id),
      )
      .map((entry) => ({
        localDate: entry.localDate,
        weight: entry.weight,
        weightUnit: entry.unit,
        notes: entry.notes,
        bodyweightEntryId: entry.id,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      })),
  }
}

function programsReport(
  data: BackupData,
  weightUnit: WeightUnit,
): ReportDefinition {
  const rows: CsvRow[] = []
  const templateDays = [...data.templateWorkoutDays].sort(
    (left, right) =>
      left.templateId.localeCompare(right.templateId) ||
      left.orderIndex - right.orderIndex ||
      left.id.localeCompare(right.id),
  )
  const templateExercises = [...data.templateWorkoutExercises].sort(
    (left, right) =>
      left.dayId.localeCompare(right.dayId) ||
      left.orderIndex - right.orderIndex ||
      left.id.localeCompare(right.id),
  )
  for (const template of [...data.programTemplates].sort(byNameThenId)) {
    const days = templateDays.filter((day) => day.templateId === template.id)
    appendProgramRows(
      rows,
      'template',
      template.id,
      template.name,
      template.status,
      days,
      templateExercises,
      weightUnit,
    )
  }

  const cycleDays = [...data.activeCycleWorkoutDays].sort(
    (left, right) =>
      left.activeCycleId.localeCompare(right.activeCycleId) ||
      left.orderIndex - right.orderIndex ||
      left.id.localeCompare(right.id),
  )
  const cycleExercises = [...data.activeCycleWorkoutExercises].sort(
    (left, right) =>
      left.dayId.localeCompare(right.dayId) ||
      left.orderIndex - right.orderIndex ||
      left.id.localeCompare(right.id),
  )
  for (const cycle of [...data.activeProgramCycles].sort(byNameThenId)) {
    const days = cycleDays.filter((day) => day.activeCycleId === cycle.id)
    appendProgramRows(
      rows,
      'active_cycle',
      cycle.id,
      cycle.name,
      cycle.status,
      days,
      cycleExercises,
      weightUnit,
      cycle.sourceTemplateId,
    )
  }
  return {
    name: 'programs',
    purpose: 'Flattened program templates and active program cycles.',
    columns: [
      'recordType',
      'programId',
      'sourceTemplateId',
      'programName',
      'status',
      'dayId',
      'dayName',
      'dayOrder',
      'prescribedExerciseId',
      'exerciseId',
      'exerciseName',
      'trackingMethod',
      'exerciseOrder',
      'prescribedSets',
      'targetRepsMin',
      'targetRepsMax',
      'targetRir',
      'targetWeight',
      'weightUnit',
      'targetDurationSeconds',
      'targetDistance',
      'restSecondsOverride',
      'notes',
    ],
    rows,
  }
}

function exerciseLibraryReport(data: BackupData): ReportDefinition {
  return {
    name: 'exercise-library',
    purpose: 'Exercise library with custom exercises listed first.',
    columns: [
      'exerciseId',
      'name',
      'origin',
      'isCustom',
      'status',
      'trackingMethod',
      'trackingMetrics',
      'defaultRestSeconds',
      'defaultWeightIncrement',
      'equipmentType',
      'primaryMuscleGroups',
      'secondaryMuscleGroups',
      'recordsRepsPerSide',
      'notes',
      'createdAt',
      'updatedAt',
    ],
    rows: [...data.exercises]
      .sort(
        (left, right) =>
          Number(right.origin === 'custom') -
            Number(left.origin === 'custom') ||
          left.name.localeCompare(right.name) ||
          left.id.localeCompare(right.id),
      )
      .map((exercise) => ({
        exerciseId: exercise.id,
        name: exercise.name,
        origin: exercise.origin,
        isCustom: exercise.origin === 'custom',
        status: exercise.status,
        trackingMethod: exercise.trackingMethodId,
        trackingMetrics: exercise.trackingMetrics
          .map(
            (metric) =>
              `${metric.key}${metric.unit ? ` (${metric.unit})` : ''}`,
          )
          .join('; '),
        defaultRestSeconds: exercise.defaultRestSeconds,
        defaultWeightIncrement: exercise.defaultWeightIncrement,
        equipmentType: exercise.equipmentType,
        primaryMuscleGroups: exercise.primaryMuscleGroups.join('; '),
        secondaryMuscleGroups: exercise.secondaryMuscleGroups.join('; '),
        recordsRepsPerSide: exercise.recordsRepsPerSide,
        notes: exercise.notes,
        createdAt: exercise.createdAt,
        updatedAt: exercise.updatedAt,
      })),
  }
}

function appendProgramRows(
  rows: CsvRow[],
  recordType: 'template' | 'active_cycle',
  programId: string,
  programName: string,
  status: string,
  days: Array<{ id: string; name: string; orderIndex: number }>,
  exercises: Array<{
    id: string
    dayId: string
    exerciseId: string
    exerciseSnapshot: {
      exerciseName: string
      trackingMethodId: string
    }
    orderIndex: number
    targetSetCount: number
    targetWeight?: number | null
    targetDurationSeconds?: number | null
    targetDistance?: number | null
    targetRepsMin: number | null
    targetRepsMax: number | null
    targetRir: number | null
    restSecondsOverride: number | null
    notes: string
  }>,
  weightUnit: WeightUnit,
  sourceTemplateId: string | null = null,
) {
  if (days.length === 0) {
    rows.push({
      recordType,
      programId,
      sourceTemplateId,
      programName,
      status,
    })
    return
  }
  for (const day of days) {
    const dayExercises = exercises.filter(
      (exercise) => exercise.dayId === day.id,
    )
    if (dayExercises.length === 0) {
      rows.push({
        recordType,
        programId,
        sourceTemplateId,
        programName,
        status,
        dayId: day.id,
        dayName: day.name,
        dayOrder: day.orderIndex + 1,
      })
      continue
    }
    for (const exercise of dayExercises) {
      rows.push({
        recordType,
        programId,
        sourceTemplateId,
        programName,
        status,
        dayId: day.id,
        dayName: day.name,
        dayOrder: day.orderIndex + 1,
        prescribedExerciseId: exercise.id,
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseSnapshot.exerciseName,
        trackingMethod: exercise.exerciseSnapshot.trackingMethodId,
        exerciseOrder: exercise.orderIndex + 1,
        prescribedSets: exercise.targetSetCount,
        targetRepsMin: exercise.targetRepsMin,
        targetRepsMax: exercise.targetRepsMax,
        targetRir: exercise.targetRir,
        targetWeight: exercise.targetWeight,
        weightUnit:
          exercise.targetWeight === undefined || exercise.targetWeight === null
            ? ''
            : weightUnit,
        targetDurationSeconds: exercise.targetDurationSeconds,
        targetDistance: exercise.targetDistance,
        restSecondsOverride: exercise.restSecondsOverride,
        notes: exercise.notes,
      })
    }
  }
}

function createSummaryRows(
  tables: readonly ExportManifestTable[],
  reports: readonly ExportManifestReport[],
): CsvRow[] {
  return [
    ...tables.map((table) => ({
      kind: 'canonical_table',
      name: table.name,
      purpose: table.description,
      rowCount: table.recordCount,
      relativePath: table.file,
    })),
    ...reports.map((report) => ({
      kind: 'report',
      name: report.name,
      purpose: report.purpose,
      rowCount:
        report.name === 'export-summary'
          ? tables.length + reports.length
          : report.rowCount,
      relativePath: report.file,
    })),
  ]
}

function createReadme(manifest: FitnessDataExportManifest): string {
  const inventory = manifest.tables
    .map(
      (table) =>
        `- ${table.file}: ${table.recordCount} record(s) — ${table.description}`,
    )
    .join('\n')
  const reports = manifest.reports
    .map(
      (report) =>
        `- ${report.file}: ${report.rowCount} row(s) — ${report.purpose}`,
    )
    .join('\n')
  return `FITNESS DATA EXPORT

Generated (UTC): ${manifest.generatedAtUtc}
Generated (local): ${manifest.generatedAtLocal}
Time zone: ${manifest.timeZone}
App version: ${manifest.appVersion}
Export format: ${manifest.exportFormat} version ${manifest.exportFormatVersion}
Database schema version: ${manifest.databaseSchemaVersion}
Weight unit: ${manifest.weightUnit}
Energy unit: ${manifest.energyUnit}

The backup/ directory is the complete machine-readable preservation copy.
Use backup/fitness-data-backup.json with the app's JSON restore feature. The
individual table JSON files preserve JavaScript JSON value types without
double-stringifying arrays or nested objects. backup/schema.json describes the
complete canonical structure, including tables that contain zero records.

The reports/ directory contains spreadsheet-friendly, denormalized CSV files
for human analysis. CSV reports are not intended for restoration.

Timestamps ending in Z are UTC. localDate values are calendar dates in the
user's local context and should not be shifted between time zones.

CANONICAL TABLES
${inventory}

REPORTS
${reports}

PRIVACY WARNING
This package may contain sensitive workout, bodyweight, nutrition, and location
history. Store and share it carefully.
`
}

function targetForLocalDate(
  localDate: string,
  targets: BackupData['nutritionTargets'],
  currentTargets: NutritionTargetValues | undefined,
): NutritionTargetValues {
  const endOfDay = new Date(`${localDate}T23:59:59.999`)
  const historical = targets
    .filter(
      (target) => new Date(target.createdAt).getTime() <= endOfDay.getTime(),
    )
    .at(-1)
  if (historical) {
    return historical
  }
  return targets.length === 0 && currentTargets
    ? currentTargets
    : zeroNutrition()
}

function zeroNutrition(): NutritionTargetValues {
  return {
    calories: 0,
    proteinGrams: 0,
    carbohydrateGrams: 0,
    fatGrams: 0,
  }
}

function formatCsvValue(value: CsvValue): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'string') {
    return protectCsvText(value)
  }
  return String(value)
}

function countCsvDataRows(content: string) {
  let inQuotes = false
  let recordCount = 0
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index]
    if (character === '"') {
      if (inQuotes && content[index + 1] === '"') {
        index += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (character === '\n' && !inQuotes) {
      recordCount += 1
    }
  }
  return Math.max(0, recordCount - 1)
}

function numberMetric(value: number | boolean | null | undefined) {
  return typeof value === 'number' ? value : undefined
}

function byNameThenId(
  left: { name: string; id: string },
  right: { name: string; id: string },
) {
  return left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
}

function stringifyJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`
}

async function sha256(content: string): Promise<string | undefined> {
  if (!globalThis.crypto?.subtle) {
    return undefined
  }
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    encoder.encode(content),
  )
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function columnsForTable(
  backupJsonSchema: unknown,
  tableName: BackupTableName,
): ExportColumn[] {
  const root = asObject(backupJsonSchema)
  const rootProperties = asObject(root?.properties)
  const dataSchema = asObject(rootProperties?.data)
  const dataProperties = asObject(dataSchema?.properties)
  const tableSchema = asObject(dataProperties?.[tableName])
  const itemSchema = asObject(tableSchema?.items)
  const properties = asObject(itemSchema?.properties)
  if (!properties) {
    return []
  }
  const required = new Set(
    Array.isArray(itemSchema?.required)
      ? itemSchema.required.filter(
          (value): value is string => typeof value === 'string',
        )
      : [],
  )
  return Object.entries(properties).map(([name, rawSchema]) => ({
    name,
    type: jsonSchemaType(rawSchema),
    nullable: schemaAllowsNull(rawSchema) || !required.has(name),
  }))
}

function jsonSchemaType(value: unknown): string {
  const schema = asObject(value)
  if (!schema) {
    return 'unknown'
  }
  if (typeof schema.type === 'string') {
    return schema.type
  }
  if (Array.isArray(schema.type)) {
    return schema.type.filter((type) => type !== 'null').join(' | ')
  }
  const alternatives = Array.isArray(schema.anyOf)
    ? schema.anyOf
    : Array.isArray(schema.oneOf)
      ? schema.oneOf
      : []
  const types = alternatives
    .map(jsonSchemaType)
    .filter((type) => type !== 'null' && type !== 'unknown')
  return [...new Set(types)].join(' | ') || 'unknown'
}

function schemaAllowsNull(value: unknown): boolean {
  const schema = asObject(value)
  if (!schema) {
    return false
  }
  if (schema.type === 'null') {
    return true
  }
  if (Array.isArray(schema.type) && schema.type.includes('null')) {
    return true
  }
  const alternatives = [
    ...(Array.isArray(schema.anyOf) ? schema.anyOf : []),
    ...(Array.isArray(schema.oneOf) ? schema.oneOf : []),
  ]
  return alternatives.some(schemaAllowsNull)
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : undefined
}

function findDisallowedSecretFields(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      findDisallowedSecretFields(item, `${path}[${index}]`),
    )
  }
  const object = asObject(value)
  if (!object) {
    return []
  }
  return Object.entries(object).flatMap(([key, child]) => {
    const childPath = path ? `${path}.${key}` : key
    return /^(apiKey|accessToken|refreshToken|authToken|password|secret|objectUrl)$/i.test(
      key,
    )
      ? [childPath]
      : findDisallowedSecretFields(child, childPath)
  })
}

function createLocalExportStem(now: Date, timeZone: string) {
  const parts = localDateTimeParts(now, timeZone)
  return `fitness-data-export-${parts.year}-${parts.month}-${parts.day}_${parts.hour}-${parts.minute}-${parts.second}`
}

function formatLocalIso(now: Date, timeZone: string) {
  const parts = localDateTimeParts(now, timeZone)
  const representedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  )
  const offsetMinutes = Math.round((representedAsUtc - now.getTime()) / 60_000)
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absoluteOffset = Math.abs(offsetMinutes)
  const offsetHours = String(Math.floor(absoluteOffset / 60)).padStart(2, '0')
  const offsetRemainder = String(absoluteOffset % 60).padStart(2, '0')
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${sign}${offsetHours}:${offsetRemainder}`
}

function localDateTimeParts(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '00'
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  }
}

function createZip(
  folderName: string,
  files: readonly ExportFile[],
  modifiedAt: Date,
): Promise<Uint8Array> {
  const input: AsyncZippable = Object.fromEntries(
    files.map((file) => [
      `${folderName}/${file.path}`,
      [encoder.encode(file.content), { mtime: modifiedAt }],
    ]),
  )
  return new Promise((resolve, reject) => {
    zip(input, { level: 6 }, (error, data) => {
      if (error) {
        reject(error)
        return
      }
      resolve(data)
    })
  })
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}
