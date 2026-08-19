import { runRepository, type RunStructure } from '@repositories/runRepository'
import { workoutRepository } from '@repositories/workoutRepository'
import type {
  Run,
  WorkoutHistoryEntry,
  WorkoutHistoryExercise,
  WorkoutHistorySet,
} from '@shared-types/app'

export type HistoryPageState =
  | { status: 'loading' }
  | { status: 'empty' }
  | {
      status: 'ready'
      workouts: WorkoutHistoryEntry[]
      runs: Run[]
      selected: WorkoutHistoryEntry | null
      selectedRun: RunStructure | null
      exercises: WorkoutHistoryExercise[]
      setsByExercise: Record<string, WorkoutHistorySet[]>
    }
  | { status: 'error'; message: string }

let cachedHistoryPageData: HistoryPageState | undefined

export function getCachedHistoryPageData() {
  return cachedHistoryPageData
}

export function setCachedHistoryPageData(state: HistoryPageState) {
  cachedHistoryPageData = state
}

export function clearCachedHistoryPageData() {
  cachedHistoryPageData = undefined
}

export async function preloadHistoryPageData() {
  const [workouts, runs] = await Promise.all([
    workoutRepository.listRecentCompletedWorkouts(5000),
    runRepository.listRecentCompletedRuns(5000),
  ])
  const state: HistoryPageState =
    !workouts.length && !runs.length
      ? { status: 'empty' }
      : {
          status: 'ready',
          workouts,
          runs,
          selected: null,
          selectedRun: null,
          exercises: [],
          setsByExercise: {},
        }
  setCachedHistoryPageData(state)
  return state
}
