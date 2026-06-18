import type {
  Exercise,
  ExerciseSnapshot,
  Food,
  FoodSnapshot,
} from '@shared-types/app'

export function snapshotFood(food: Food): FoodSnapshot {
  return {
    foodName: food.name,
    servingQuantity: food.servingQuantity,
    servingUnit: food.servingUnit,
    servingDescription: food.servingDescription,
    caloriesPerServing: food.caloriesPerServing,
    proteinGramsPerServing: food.proteinGramsPerServing,
    carbohydrateGramsPerServing: food.carbohydrateGramsPerServing,
    fatGramsPerServing: food.fatGramsPerServing,
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
  }
}
