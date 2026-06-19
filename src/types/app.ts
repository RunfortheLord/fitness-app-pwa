import type { LocalDateString } from '@domain/dates'

export type IsoTimestamp = string
export type EntityStatus = 'active' | 'archived'
export type WeightUnit = 'lb'
export type EnergyUnit = 'kcal'

export type AppMetadata = {
  id: 'app'
  databaseSchemaVersion: number
  backupSchemaVersion: number
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type NutritionTarget = {
  id: string
  calories: number
  proteinGrams: number
  carbohydrateGrams: number
  fatGrams: number
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type UserSettings = {
  id: 'settings'
  weightUnit: WeightUnit
  energyUnit: EnergyUnit
  nutritionTargets: NutritionTargetValues
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type NutritionTargetValues = {
  calories: number
  proteinGrams: number
  carbohydrateGrams: number
  fatGrams: number
}

export type Food = {
  id: string
  name: string
  servingQuantity: number
  servingUnit: string
  servingDescription: string
  caloriesPerServing: number
  proteinGramsPerServing: number
  carbohydrateGramsPerServing: number
  fatGramsPerServing: number
  notes: string
  status: EntityStatus
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type FoodSnapshot = {
  foodName: string
  servingQuantity: number
  servingUnit: string
  servingDescription: string
  caloriesPerServing: number
  proteinGramsPerServing: number
  carbohydrateGramsPerServing: number
  fatGramsPerServing: number
  notes: string
}

export type FoodLogEntry = {
  id: string
  localDate: LocalDateString
  foodId: string | null
  foodSnapshot: FoodSnapshot
  servingMultiplier: number
  computedCalories: number
  computedProteinGrams: number
  computedCarbohydrateGrams: number
  computedFatGrams: number
  notes: string
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type BodyweightEntry = {
  id: string
  localDate: LocalDateString
  weight: number
  unit: WeightUnit
  notes: string
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type TrackingMetricValueType =
  | 'number'
  | 'integer'
  | 'durationSeconds'
  | 'boolean'

export type TrackingMetric = {
  key: string
  label: string
  valueType: TrackingMetricValueType
  unit: string | null
  requiredForCompletion: boolean
}

export type TrackingMethodId =
  | 'weight_reps'
  | 'bodyweight_reps'
  | 'assisted_weight_reps'
  | 'reps_only'
  | 'duration'
  | 'distance_duration'

export type TrackingMethod = {
  id: TrackingMethodId
  name: string
  explanation: string
  metrics: TrackingMetric[]
}

export type Exercise = {
  id: string
  name: string
  notes: string
  defaultRestSeconds: number
  trackingMethodId: TrackingMethodId
  trackingMetrics: TrackingMetric[]
  status: EntityStatus
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type ExerciseSnapshot = {
  exerciseName: string
  notes: string
  defaultRestSeconds: number
  trackingMethodId: TrackingMethodId
  trackingMetrics: TrackingMetric[]
}

export type ProgramTemplate = {
  id: string
  name: string
  notes: string
  status: EntityStatus
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type ProgramTemplateDay = {
  id: string
  templateId: string
  name: string
  notes: string
  orderIndex: number
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type TemplateWorkoutExercise = {
  id: string
  templateId: string
  dayId: string
  exerciseId: string
  exerciseSnapshot: ExerciseSnapshot
  orderIndex: number
  targetSetCount: number
  targetRepsMin: number | null
  targetRepsMax: number | null
  targetRir: number | null
  restSecondsOverride: number | null
  notes: string
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type ActiveProgramCycle = {
  id: string
  sourceTemplateId: string | null
  name: string
  notes: string
  status: 'active' | 'inactive' | 'archived'
  activatedAt: IsoTimestamp
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type ActiveCycleWorkoutDay = {
  id: string
  activeCycleId: string
  sourceTemplateDayId: string | null
  name: string
  notes: string
  orderIndex: number
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type ActiveCycleWorkoutExercise = {
  id: string
  activeCycleId: string
  dayId: string
  sourceTemplateExerciseId: string | null
  exerciseId: string
  exerciseSnapshot: ExerciseSnapshot
  orderIndex: number
  targetSetCount: number
  targetRepsMin: number | null
  targetRepsMax: number | null
  targetRir: number | null
  restSecondsOverride: number | null
  notes: string
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type RestTimerState = {
  id: string
  startedAt: IsoTimestamp
  durationSeconds: number
  pausedAt: IsoTimestamp | null
  accumulatedPausedSeconds: number
  status: 'running' | 'paused' | 'dismissed' | 'completed'
}

export type Workout = {
  id: string
  sourceActiveCycleId: string | null
  sourceTemplateId: string | null
  sourceDayId: string | null
  localDate: LocalDateString
  name: string
  workoutSnapshot: WorkoutSourceSnapshot
  notes: string
  startedAt: IsoTimestamp
  completedAt: IsoTimestamp | null
  durationSeconds: number | null
  elapsedPausedSeconds: number
  activeRestTimer: RestTimerState | null
  status: 'active' | 'completed' | 'cancelled'
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type WorkoutSourceSnapshot = {
  activeCycleName: string | null
  templateName: string | null
  dayName: string
  dayNotes: string
}

export type WorkoutExercise = {
  id: string
  workoutId: string
  exerciseId: string | null
  exerciseSnapshot: ExerciseSnapshot
  sourcePrescribedExerciseId: string | null
  orderIndex: number
  notes: string
  skipped: boolean
  replacementOfExerciseId: string | null
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type WorkoutSet = {
  id: string
  workoutId: string
  workoutExerciseId: string
  setNumber: number
  metricValues: Record<string, number | boolean | null>
  rir: number | null
  completed: boolean
  completedAt: IsoTimestamp | null
  restSecondsUsed: number | null
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type WorkoutHistoryEntry = Workout & {
  status: 'completed'
  completedAt: IsoTimestamp
  durationSeconds: number
}

export type WorkoutHistoryExercise = WorkoutExercise
export type WorkoutHistorySet = Omit<WorkoutSet, 'createdAt' | 'updatedAt'>

export type DetectedStructuralChangeType =
  | 'set_added'
  | 'set_removed'
  | 'exercise_added'
  | 'exercise_skipped_or_removed'
  | 'exercise_replaced'
  | 'exercise_order_changed'

export type StructuralChangeDestination =
  | 'cycle_only'
  | 'template_only'
  | 'both'
  | 'neither'

export type DetectedWorkoutChange = {
  id: string
  workoutId: string
  type: DetectedStructuralChangeType
  description: string
  sourcePath: string
  performedPath: string
  selectedDestination: StructuralChangeDestination
  appliedDestination: StructuralChangeDestination | null
  status: 'pending' | 'applied' | 'rejected' | 'failed'
  failureReason: string | null
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type AppliedWorkoutChange = {
  id: string
  detectedChangeId: string
  workoutId: string
  destination: StructuralChangeDestination
  appliedAt: IsoTimestamp
  createdAt: IsoTimestamp
}

export type BackupMetadata = {
  id: string
  backupSchemaVersion: number
  databaseSchemaVersion: number
  exportedAt: IsoTimestamp | null
  importedAt: IsoTimestamp | null
  mode: 'export' | 'import'
  summary: string
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}
