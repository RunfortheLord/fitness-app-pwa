import { db, type TrainingLogDatabase } from '@db/database'
import type { LocalDateString } from '@domain/dates'
import {
  filterBodyweightEntriesForRange,
  latestBodyweight,
  summarizeBodyweightTrend,
  type BodyweightTrendSummary,
} from '@domain/bodyweightProgress'
import { createBodyweightRepository } from '@repositories/bodyweightRepository'
import { createFoodRepository } from '@repositories/foodRepository'
import { createProgramRepository } from '@repositories/programRepository'
import { createWorkoutRepository } from '@repositories/workoutRepository'
import {
  createNutritionSummaryService,
  type DailyNutritionSummary,
} from '@services/nutritionSummaryService'
import type {
  ActiveCycleWorkoutDay,
  ActiveCycleWorkoutExercise,
  ActiveProgramCycle,
  AppMetadata,
  BodyweightEntry,
  FoodLogEntry,
  Workout,
  WorkoutHistoryEntry,
} from '@shared-types/app'

export type DashboardData = {
  selectedDate: LocalDateString
  metadata: AppMetadata | undefined
  nutrition: DailyNutritionSummary
  bodyweight: BodyweightEntry | undefined
  currentBodyweight: BodyweightEntry | undefined
  bodyweightEntries: BodyweightEntry[]
  bodyweightTrend: BodyweightTrendSummary
  activeProgram:
    | {
        cycle: ActiveProgramCycle
        days: ActiveCycleWorkoutDay[]
        exerciseCount: number
        exercisesByDay: Record<string, ActiveCycleWorkoutExercise[]>
      }
    | undefined
  activeWorkout: Workout | undefined
  mostRecentCompletedWorkout: WorkoutHistoryEntry | undefined
  mostRecentCompletedWorkoutSummary:
    | {
        completedSetCount: number
        exerciseCount: number
      }
    | undefined
  recentActivity: Array<
    | {
        id: string
        type: 'bodyweight'
        localDate: LocalDateString
        label: string
      }
    | { id: string; type: 'food'; localDate: LocalDateString; label: string }
    | {
        id: string
        type: 'workout'
        localDate: LocalDateString
        label: string
      }
  >
}

export function createDashboardService(database: TrainingLogDatabase = db) {
  const bodyweightRepository = createBodyweightRepository(database)
  const foodRepository = createFoodRepository(database)
  const programRepository = createProgramRepository(database)
  const workoutRepository = createWorkoutRepository(database)
  const nutritionSummaryService = createNutritionSummaryService(database)

  return {
    async getDashboardData(
      selectedDate: LocalDateString,
    ): Promise<DashboardData> {
      const [
        nutrition,
        bodyweight,
        activeProgramStructure,
        activeWorkout,
        mostRecentCompletedWorkout,
        metadata,
        bodyweightEntries,
        foodLogs,
        completedWorkouts,
      ] = await Promise.all([
        nutritionSummaryService.getDailySummary(selectedDate),
        bodyweightRepository.listBodyweightEntriesForDate(selectedDate),
        programRepository.getCurrentActiveCycleStructure(),
        workoutRepository.getActiveWorkout(),
        workoutRepository.getMostRecentCompletedWorkout(),
        database.appMetadata.get('app'),
        bodyweightRepository.listBodyweightEntries(),
        foodRepository.listRecentFoodLogs(5),
        workoutRepository.listRecentCompletedWorkouts(5),
      ])

      const selectedDateBodyweight = latestBodyweight(bodyweight)
      const currentBodyweight = latestBodyweight(bodyweightEntries)
      const bodyweightTrend = summarizeBodyweightTrend(
        filterBodyweightEntriesForRange({
          entries: bodyweightEntries,
          range: '1m',
          today: selectedDate,
        }),
      )
      const mostRecentCompletedWorkoutSummary = mostRecentCompletedWorkout
        ? await getWorkoutSummary(database, mostRecentCompletedWorkout.id)
        : undefined

      return {
        selectedDate,
        metadata,
        nutrition,
        bodyweight: selectedDateBodyweight,
        currentBodyweight,
        bodyweightEntries,
        bodyweightTrend,
        activeProgram: activeProgramStructure
          ? {
              ...activeProgramStructure,
              exerciseCount: Object.values(
                activeProgramStructure.exercisesByDay,
              ).reduce((count, exercises) => count + exercises.length, 0),
            }
          : undefined,
        activeWorkout,
        mostRecentCompletedWorkout,
        mostRecentCompletedWorkoutSummary,
        recentActivity: buildRecentActivity(
          bodyweightEntries,
          foodLogs,
          completedWorkouts,
        ),
      }
    },
  }
}

async function getWorkoutSummary(
  database: TrainingLogDatabase,
  workoutId: string,
) {
  const [exercises, sets] = await Promise.all([
    database.workoutHistoryExercises.where({ workoutId }).toArray(),
    database.workoutHistorySets.where({ workoutId }).toArray(),
  ])
  return {
    exerciseCount: exercises.filter((exercise) => !exercise.skipped).length,
    completedSetCount: sets.filter((set) => set.completed).length,
  }
}

function buildRecentActivity(
  bodyweightEntries: BodyweightEntry[],
  foodLogs: FoodLogEntry[],
  completedWorkouts: WorkoutHistoryEntry[],
): DashboardData['recentActivity'] {
  return [
    ...bodyweightEntries.map((entry) => ({
      id: entry.id,
      type: 'bodyweight' as const,
      localDate: entry.localDate,
      label: `${entry.weight} ${entry.unit}`,
      sortDate: entry.updatedAt,
    })),
    ...foodLogs.map((entry) => ({
      id: entry.id,
      type: 'food' as const,
      localDate: entry.localDate,
      label: `${entry.foodSnapshot.foodName} ${Math.round(
        entry.computedCalories,
      )} kcal`,
      sortDate: entry.createdAt,
    })),
    ...completedWorkouts.map((workout) => ({
      id: workout.id,
      type: 'workout' as const,
      localDate: workout.localDate,
      label: workout.name,
      sortDate: workout.completedAt,
    })),
  ]
    .sort(
      (first, second) =>
        Date.parse(second.sortDate) - Date.parse(first.sortDate),
    )
    .slice(0, 5)
    .map((activity) => ({
      id: activity.id,
      type: activity.type,
      localDate: activity.localDate,
      label: activity.label,
    }))
}

export const dashboardService = createDashboardService()
