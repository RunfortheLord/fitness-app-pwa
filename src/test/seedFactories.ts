import type { LocalDateString } from '@domain/dates'
import { createExerciseRepository } from '@repositories/exerciseRepository'
import { createFoodRepository } from '@repositories/foodRepository'
import { createProgramRepository } from '@repositories/programRepository'
import type { TrainingLogDatabase } from '@db/database'

export async function seedFood(database: TrainingLogDatabase) {
  return createFoodRepository(database).createFood({
    name: 'Rice',
    servingQuantity: 1,
    servingUnit: 'cup',
    servingDescription: 'cooked',
    caloriesPerServing: 200,
    proteinGramsPerServing: 4,
    carbohydrateGramsPerServing: 45,
    fatGramsPerServing: 1,
    notes: 'seed food',
  })
}

export async function seedExercise(database: TrainingLogDatabase) {
  return createExerciseRepository(database).createExercise({
    name: 'Bench press',
    defaultRestSeconds: 120,
    trackingMethodId: 'weight_reps',
    notes: 'seed exercise',
  })
}

export async function seedProgram(database: TrainingLogDatabase) {
  const exercise = await seedExercise(database)
  return createProgramRepository(database).createProgramTemplate({
    name: 'Upper Lower',
    days: [
      {
        name: 'Upper',
        exercises: [
          {
            exerciseId: exercise.id,
            targetSetCount: 2,
            targetRepsMin: 8,
            targetRepsMax: 10,
            targetRir: 2,
            restSecondsOverride: 90,
          },
        ],
      },
    ],
  })
}

export const testLocalDate = '2026-06-18' satisfies LocalDateString
