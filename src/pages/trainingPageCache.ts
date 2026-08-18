import type { ExerciseUsageSummary } from '@domain/exerciseSearch'
import type {
  CurrentCycleStructure,
  LoadStatus,
} from '@features/training/types'
import type { Exercise, ProgramTemplate } from '@shared-types/app'
import { exerciseRepository } from '@repositories/exerciseRepository'
import { programRepository } from '@repositories/programRepository'

export type TrainingPageLoadState = {
  exercises: Exercise[]
  templates: ProgramTemplate[]
  exerciseUsage: ExerciseUsageSummary
  currentCycle: CurrentCycleStructure | undefined
  status: LoadStatus
}

let cachedTrainingLoadState: TrainingPageLoadState | undefined

export function getCachedTrainingPageData() {
  return cachedTrainingLoadState
}

export function setCachedTrainingPageData(loadState: TrainingPageLoadState) {
  cachedTrainingLoadState = loadState
}

export function clearCachedTrainingPageData() {
  cachedTrainingLoadState = undefined
}

export async function preloadTrainingPageData() {
  const [exercises, templates, currentCycle, exerciseUsage] = await Promise.all(
    [
      exerciseRepository.searchExercises({
        includeArchived: false,
        query: '',
      }),
      programRepository.listProgramTemplates(),
      programRepository.getCurrentActiveCycleStructure(),
      programRepository.getExerciseUsageSummary(),
    ],
  )

  const loadState: TrainingPageLoadState = {
    exercises,
    templates,
    exerciseUsage,
    currentCycle,
    status: 'ready',
  }
  setCachedTrainingPageData(loadState)
  return loadState
}
