import type { ExerciseUsageSummary } from '@domain/exerciseSearch'
import type {
  CurrentCycleStructure,
  LoadStatus,
} from '@features/training/types'
import type { Exercise, ProgramTemplate } from '@shared-types/app'

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
