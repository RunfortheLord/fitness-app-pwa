import type {
  Exercise,
  ExerciseSnapshot,
  Food,
  FoodSnapshot,
} from '@shared-types/app'

export function snapshotFood(food: Food): FoodSnapshot {
  return {
    snapshotId: crypto.randomUUID(),
    foodName: food.name,
    brandName: food.brandName ?? null,
    sourceType: food.sourceType ?? 'local',
    provider: food.provider ?? null,
    providerRecordId: food.providerRecordId ?? null,
    providerDataType: food.providerDataType ?? null,
    servingQuantity: food.servingQuantity,
    servingUnit: food.servingUnit,
    servingDescription: food.servingDescription,
    gramsPerServing: food.gramsPerServing ?? null,
    ouncesPerServing: food.ouncesPerServing ?? null,
    servingConversionReliable: food.servingConversionReliable ?? false,
    servingConversionSource: food.servingConversionSource ?? 'none',
    caloriesPerServing: food.caloriesPerServing,
    proteinGramsPerServing: food.proteinGramsPerServing,
    carbohydrateGramsPerServing: food.carbohydrateGramsPerServing,
    fatGramsPerServing: food.fatGramsPerServing,
    macroBasis: food.macroBasis ?? 'per_serving',
    rawCookedStatus: food.rawCookedStatus ?? 'unknown',
    sourceUpdatedAt: food.sourceUpdatedAt ?? null,
    providerIngestedAt: food.providerIngestedAt ?? null,
    normalizerVersion: food.normalizerVersion ?? null,
    notes: food.notes,
  }
}

export function snapshotExercise(exercise: Exercise): ExerciseSnapshot {
  return {
    exerciseName: exercise.name,
    notes: exercise.notes,
    defaultRestSeconds: exercise.defaultRestSeconds,
    trackingMethodId: exercise.trackingMethodId,
    trackingMetrics: exercise.trackingMetrics,
    bodyweightLoadMode: exercise.bodyweightLoadMode ?? 'external_weight_only',
    bodyweightPercentage: exercise.bodyweightPercentage ?? null,
    recordsRepsPerSide: exercise.recordsRepsPerSide,
  }
}
