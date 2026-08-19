import { runRepository, type RunStructure } from '@repositories/runRepository'
import { workoutRepository } from '@repositories/workoutRepository'

export type RunPageLoadedState =
  | { status: 'idle' }
  | { status: 'ready'; structure: RunStructure }

export type CachedRunPageData = {
  activeWorkoutId: string | null
  state: RunPageLoadedState
}

let cachedRunPageData: CachedRunPageData | undefined

export function getCachedRunPageData() {
  return cachedRunPageData
}

export function setCachedRunPageData(data: CachedRunPageData) {
  cachedRunPageData = data
}

export function clearCachedRunPageData() {
  cachedRunPageData = undefined
}

export async function preloadRunPageData() {
  const [run, workout] = await Promise.all([
    runRepository.getActiveRun(),
    workoutRepository.getActiveWorkout(),
  ])
  const data: CachedRunPageData = {
    activeWorkoutId: workout?.id ?? null,
    state: run
      ? {
          status: 'ready',
          structure: await runRepository.getRunStructure(run.id),
        }
      : { status: 'idle' },
  }
  setCachedRunPageData(data)
  return data
}
