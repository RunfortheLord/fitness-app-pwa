import type { SetPrescription } from '@domain/periodization'
import type {
  ActiveCycleWorkoutDay,
  ActiveCycleWorkoutExercise,
  ActiveProgramCycle,
} from '@shared-types/app'

export type LoadStatus = 'loading' | 'ready' | 'error'
export type ExerciseView = 'active' | 'hidden'
export type BuilderMode = 'template' | 'cycle'
export type ProgramSheetTarget =
  | { mode: 'template'; templateId: string }
  | { mode: 'cycle'; cycleId: string }
export type SelectedDay = {
  cycle: ActiveProgramCycle
  day: ActiveCycleWorkoutDay
  exercises: (ActiveCycleWorkoutExercise & {
    plannedGroups?: SetPrescription[]
  })[]
}
export type CurrentCycleStructure = {
  cycle: ActiveProgramCycle
  days: ActiveCycleWorkoutDay[]
  exercisesByDay: Record<string, ActiveCycleWorkoutExercise[]>
}
