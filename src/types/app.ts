import type { LocalDateString } from '@domain/dates'

export type IsoTimestamp = string
export type EntityStatus = 'active' | 'archived'
export type ExerciseStatus = EntityStatus | 'hidden'
export type WeightUnit = 'lb'
export type EnergyUnit = 'kcal'
export type FoodSourceType = 'local' | 'provider'
export type FoodProviderId = 'usda' | 'open_food_facts'
export type RawCookedStatus = 'raw' | 'cooked' | 'unknown'
export type FoodMacroBasis = 'per_serving' | 'per_100g' | 'both'
export type FoodConversionSource =
  | 'provider_serving_weight'
  | 'provider_portion_weight'
  | 'per_100g'
  | 'none'
export type ExerciseOrigin = 'built_in' | 'custom'
export type ExerciseEquipmentType =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quadriceps'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'traps'
  | 'hip abductors'
  | 'hip adductors'

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
  brandName?: string | null
  servingQuantity: number
  servingUnit: string
  servingDescription: string
  gramsPerServing?: number | null
  ouncesPerServing?: number | null
  servingConversionReliable?: boolean
  servingConversionSource?: FoodConversionSource
  caloriesPerServing: number
  proteinGramsPerServing: number
  carbohydrateGramsPerServing: number
  fatGramsPerServing: number
  sourceType?: FoodSourceType
  provider?: FoodProviderId | null
  providerRecordId?: string | null
  providerDataType?: string | null
  sourceName?: string | null
  sourceUrl?: string | null
  barcode?: string | null
  sourceUpdatedAt?: IsoTimestamp | null
  providerIngestedAt?: IsoTimestamp | null
  normalizerVersion?: number | null
  rawCookedStatus?: RawCookedStatus
  macroBasis?: FoodMacroBasis
  notes: string
  status: EntityStatus
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type FoodSnapshot = {
  snapshotId?: string
  foodName: string
  brandName?: string | null
  sourceType?: FoodSourceType
  provider?: FoodProviderId | null
  providerRecordId?: string | null
  providerDataType?: string | null
  servingQuantity: number
  servingUnit: string
  servingDescription: string
  gramsPerServing?: number | null
  ouncesPerServing?: number | null
  servingConversionReliable?: boolean
  servingConversionSource?: FoodConversionSource
  caloriesPerServing: number
  proteinGramsPerServing: number
  carbohydrateGramsPerServing: number
  fatGramsPerServing: number
  macroBasis?: FoodMacroBasis
  rawCookedStatus?: RawCookedStatus
  sourceUpdatedAt?: IsoTimestamp | null
  providerIngestedAt?: IsoTimestamp | null
  normalizerVersion?: number | null
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
  | 'added_weight_reps'
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
  defaultWeightIncrement: number | null
  trackingMethodId: TrackingMethodId
  trackingMetrics: TrackingMetric[]
  primaryMuscleGroups: MuscleGroup[]
  secondaryMuscleGroups: MuscleGroup[]
  equipmentType: ExerciseEquipmentType
  recordsRepsPerSide: boolean
  origin: ExerciseOrigin
  seedDataVersion: number | null
  status: ExerciseStatus
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type ExerciseSnapshot = {
  exerciseName: string
  notes: string
  defaultRestSeconds: number
  trackingMethodId: TrackingMethodId
  trackingMetrics: TrackingMetric[]
  recordsRepsPerSide?: boolean
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
  targetWeight?: number | null
  targetDurationSeconds?: number | null
  targetDistance?: number | null
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
  targetWeight?: number | null
  targetDurationSeconds?: number | null
  targetDistance?: number | null
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
  targetSnapshot?: WorkoutSetTargetSnapshot | null
  targetRecommendation?: WorkoutSetTargetRecommendation | null
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

export type WorkoutSetTargetSnapshot = {
  trackingMethodId: TrackingMethodId
  targetWeight: number | null
  targetRepsMin: number | null
  targetRepsMax: number | null
}

export type WorkoutSetTargetRecommendation = {
  version: 1
  originalTarget: WorkoutSetTargetSnapshot
  suggestedTarget: WorkoutSetTargetSnapshot | null
  userEditedTarget: WorkoutSetTargetSnapshot | null
  reason: CurrentWorkoutProgressionReason
  explanation: string
  sourceSetId: string | null
  generatedAt: IsoTimestamp
}

export type CurrentWorkoutProgressionReason =
  | 'above_range_increase_difficulty'
  | 'exactly_at_maximum_hold'
  | 'within_range_hold'
  | 'below_minimum_without_failure_hold'
  | 'below_minimum_failed_reduce_difficulty'
  | 'skipped_no_progression'
  | 'missing_rep_range'
  | 'missing_target'
  | 'invalid_increment'
  | 'unsupported_tracking_method'
  | 'manual_target_retained'

export type NextWorkoutProgressionReason =
  | 'repeated_top_range_increase'
  | 'top_range_insufficient_history_hold'
  | 'insufficient_final_rir_hold'
  | 'missing_final_rir_hold'
  | 'normal_in_range_hold'
  | 'repeated_missed_minimums_reduce'
  | 'repeated_failed_performance_reduce'
  | 'skipped_programmed_set_hold'
  | 'no_comparable_previous_performance_hold'
  | 'unsupported_tracking_method'
  | 'no_material_prescription_change'

export type DetectedStructuralChangeType =
  | 'set_added'
  | 'set_removed'
  | 'exercise_added'
  | 'exercise_skipped_or_removed'
  | 'exercise_replaced'
  | 'exercise_order_changed'
  | 'progression_recommendation'

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
  recommendationReason?: NextWorkoutProgressionReason | null
  recommendationSummary?: string | null
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
