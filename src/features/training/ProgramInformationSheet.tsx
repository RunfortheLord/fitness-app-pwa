import { BottomSheet, EmptyState, LoadingState } from '@components/ui'
import { DEFAULT_PROGRAM_DURATION_WEEKS } from '@domain/programWeeks'
import type {
  ActiveCycleWorkoutDay,
  ActiveCycleWorkoutExercise,
  ActiveProgramCycle,
  Exercise,
  MuscleGroup,
  ProgramTemplate,
  ProgramTemplateDay,
  TemplateWorkoutExercise,
} from '@shared-types/app'

import { formatTimestamp } from './exerciseMetadata'
import type { BuilderMode } from './types'

export type ProgramInformationStructure = {
  record: ProgramTemplate | ActiveProgramCycle
  days: Array<ProgramTemplateDay | ActiveCycleWorkoutDay>
  exercisesByDay: Record<
    string,
    Array<TemplateWorkoutExercise | ActiveCycleWorkoutExercise>
  >
}

function formatMuscleGroup(muscle: MuscleGroup) {
  return muscle
    .split(' ')
    .map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1))
    .join(' ')
}

function getProgramInformation(
  structure: ProgramInformationStructure,
  exercises: Exercise[],
) {
  const prescriptions = structure.days.flatMap(
    (day) => structure.exercisesByDay[day.id] ?? [],
  )
  const exerciseById = new Map(
    exercises.map((exercise) => [exercise.id, exercise]),
  )
  const directSetsByMuscle = new Map<MuscleGroup, number>()
  let untaggedSets = 0

  for (const prescription of prescriptions) {
    const muscles = [
      ...new Set(
        exerciseById.get(prescription.exerciseId)?.primaryMuscleGroups ?? [],
      ),
    ]
    if (!muscles.length) {
      untaggedSets += prescription.targetSetCount
      continue
    }
    for (const muscle of muscles) {
      directSetsByMuscle.set(
        muscle,
        (directSetsByMuscle.get(muscle) ?? 0) + prescription.targetSetCount,
      )
    }
  }

  const updatedTimestamps = [
    structure.record.updatedAt,
    ...structure.days.map((day) => day.updatedAt),
    ...prescriptions.map((exercise) => exercise.updatedAt),
  ]

  return {
    exerciseCount: prescriptions.length,
    programmedSetCount: prescriptions.reduce(
      (total, exercise) => total + exercise.targetSetCount,
      0,
    ),
    perDay: structure.days.map((day) => {
      const dayExercises = structure.exercisesByDay[day.id] ?? []
      return {
        id: day.id,
        name: day.name,
        exerciseCount: dayExercises.length,
        setCount: dayExercises.reduce(
          (total, exercise) => total + exercise.targetSetCount,
          0,
        ),
      }
    }),
    directSetsByMuscle: [...directSetsByMuscle.entries()].sort(
      ([leftMuscle, leftSets], [rightMuscle, rightSets]) =>
        rightSets - leftSets || leftMuscle.localeCompare(rightMuscle),
    ),
    untaggedSets,
    lastEditedAt: updatedTimestamps.sort((left, right) =>
      right.localeCompare(left),
    )[0],
  }
}

export function ProgramInformationSheet({
  exercises,
  isLoading = false,
  isOpen,
  mode,
  onClose,
  structure,
}: {
  exercises: Exercise[]
  isLoading?: boolean
  isOpen: boolean
  mode: BuilderMode
  onClose: () => void
  structure: ProgramInformationStructure | null
}) {
  const information = structure
    ? getProgramInformation(structure, exercises)
    : null
  const trackRirEverySet = structure?.record.trackRirEverySet ?? false
  const deloadSchedulingEnabled =
    structure?.record.deloadSchedulingEnabled ?? false

  return (
    <BottomSheet
      className="bottom-sheet--app-background"
      isOpen={isOpen}
      onClose={onClose}
      title="Program information"
      variant="page"
    >
      {isLoading ? <LoadingState label="Loading program information" /> : null}
      {!isLoading && !structure ? (
        <EmptyState
          title="No active program"
          message="Activate a program to see its current details and weekly muscle-set totals."
        />
      ) : null}
      {structure && information ? (
        <div className="program-information">
          <div>
            <h3>{structure.record.name}</h3>
            {'level' in structure.record && structure.record.level ? (
              <p className="muted">{structure.record.level}</p>
            ) : null}
            {'goal' in structure.record && structure.record.goal ? (
              <p>{structure.record.goal}</p>
            ) : null}
            {structure.record.notes ? <p>{structure.record.notes}</p> : null}
          </div>

          <dl className="program-information-list">
            <div>
              <dt>Program type</dt>
              <dd>
                {mode === 'cycle'
                  ? structure.record.status === 'active'
                    ? 'Current active program'
                    : 'Saved program cycle'
                  : 'isBuiltIn' in structure.record &&
                      structure.record.isBuiltIn
                    ? 'Built-in template'
                    : 'Reusable template'}
              </dd>
            </div>
            {'currentWeekNumber' in structure.record ? (
              <div>
                <dt>Current week</dt>
                <dd>{`${structure.record.currentWeekNumber ?? 1} of ${structure.record.durationWeeks ?? DEFAULT_PROGRAM_DURATION_WEEKS}`}</dd>
              </div>
            ) : null}
            <div>
              <dt>Program length</dt>
              <dd>{`${structure.record.durationWeeks ?? DEFAULT_PROGRAM_DURATION_WEEKS} weeks`}</dd>
            </div>
            <div>
              <dt>Workout days</dt>
              <dd>{structure.days.length}</dd>
            </div>
            <div>
              <dt>Exercise slots</dt>
              <dd>{information.exerciseCount}</dd>
            </div>
            <div>
              <dt>Programmed sets</dt>
              <dd>{information.programmedSetCount}</dd>
            </div>
            <div>
              <dt>Deload schedule</dt>
              <dd>
                {deloadSchedulingEnabled
                  ? structure.record.deloadWeekNumbers?.length
                    ? `Weeks ${structure.record.deloadWeekNumbers.join(', ')}`
                    : 'On — no weeks selected'
                  : 'Off'}
              </dd>
            </div>
            <div>
              <dt>RIR entry</dt>
              <dd>
                {trackRirEverySet ? 'Every set' : 'Final set of each exercise'}
              </dd>
            </div>
          </dl>

          <section>
            <h3>Weekly structure</h3>
            <ul className="program-information-rows">
              {information.perDay.map((day) => (
                <li key={day.id}>
                  <span>{day.name}</span>
                  <small>{`${day.exerciseCount} ${day.exerciseCount === 1 ? 'exercise' : 'exercises'} · ${day.setCount} ${day.setCount === 1 ? 'set' : 'sets'}`}</small>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3>Direct sets per week</h3>
            <p className="muted program-information-explanation">
              Each programmed set counts for every primary muscle tagged on that
              exercise. Secondary-muscle work is not estimated.
            </p>
            {information.directSetsByMuscle.length ? (
              <ul className="program-muscle-sets">
                {information.directSetsByMuscle.map(([muscle, setCount]) => (
                  <li key={muscle}>
                    <span>{formatMuscleGroup(muscle)}</span>
                    <strong>{`${setCount} ${setCount === 1 ? 'set' : 'sets'}`}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                No exercises in this program have primary-muscle tags.
              </p>
            )}
            {information.untaggedSets ? (
              <p className="muted program-information-explanation">
                {`${information.untaggedSets} programmed ${information.untaggedSets === 1 ? 'set is' : 'sets are'} excluded because the exercise has no primary-muscle tag.`}
              </p>
            ) : null}
          </section>

          <small className="program-information-updated">
            {`Last edited ${formatTimestamp(information.lastEditedAt)}`}
          </small>
        </div>
      ) : null}
    </BottomSheet>
  )
}
