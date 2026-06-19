import { Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  Card,
  EmptyState,
  FormField,
  LoadingState,
  ModalConfirmationDialog,
  NumericInput,
  PageContainer,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  StatusMessage,
  ValidationMessage,
} from '@components/ui'
import { workoutRepository } from '@repositories/workoutRepository'
import type {
  DetectedWorkoutChange,
  StructuralChangeDestination,
  TrackingMetric,
  WorkoutHistoryEntry,
  WorkoutHistoryExercise,
  WorkoutHistorySet,
} from '@shared-types/app'

type WorkoutSummary = {
  completedSetCount: number
  exerciseCount: number
}

type HistorySetInput = Parameters<
  typeof workoutRepository.updateWorkoutHistorySet
>[1]

type HistoryState =
  | { status: 'loading' }
  | { status: 'empty' }
  | {
      status: 'ready'
      workouts: WorkoutHistoryEntry[]
      summaries: Record<string, WorkoutSummary>
      selected: WorkoutHistoryEntry
      exercises: WorkoutHistoryExercise[]
      setsByExercise: Record<string, WorkoutHistorySet[]>
      changes: DetectedWorkoutChange[]
    }
  | { status: 'error'; message: string }

const destinations: Array<{
  label: string
  value: StructuralChangeDestination
}> = [
  { label: 'Active cycle only', value: 'cycle_only' },
  { label: 'Template only', value: 'template_only' },
  { label: 'Both', value: 'both' },
  { label: 'Neither', value: 'neither' },
]

export function HistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [state, setState] = useState<HistoryState>({ status: 'loading' })
  const [revision, setRevision] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedDestinations, setSelectedDestinations] = useState<
    Record<string, StructuralChangeDestination>
  >({})
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [deleteRequested, setDeleteRequested] = useState(false)

  useEffect(() => {
    let isCurrent = true
    void workoutRepository
      .listRecentCompletedWorkouts(25)
      .then(async (workouts) => {
        if (!isCurrent) {
          return
        }
        if (!workouts.length) {
          setState({ status: 'empty' })
          return
        }

        const requestedId = searchParams.get('workout')
        const requested =
          workouts.find((workout) => workout.id === requestedId) ?? workouts[0]
        const structures = await Promise.all(
          workouts.map((workout) =>
            workoutRepository.getWorkoutHistoryStructure(workout.id),
          ),
        )
        const selectedStructure =
          structures.find(
            (structure) => structure.workout.id === requested.id,
          ) ?? structures[0]
        const changes = await workoutRepository.listDetectedChanges(
          selectedStructure.workout.id,
        )
        const summaries = Object.fromEntries(
          structures.map((structure) => {
            const sets = Object.values(structure.setsByExercise).flat()
            return [
              structure.workout.id,
              {
                exerciseCount: structure.exercises.filter(
                  (exercise) => !exercise.skipped,
                ).length,
                completedSetCount: sets.filter((set) => set.completed).length,
              },
            ]
          }),
        )

        if (!isCurrent) {
          return
        }
        setState({
          status: 'ready',
          workouts,
          summaries,
          selected: selectedStructure.workout,
          exercises: selectedStructure.exercises,
          setsByExercise: selectedStructure.setsByExercise,
          changes,
        })
        setSelectedIds(
          new Set(
            changes
              .filter((change) => ['applied', 'failed'].includes(change.status))
              .map((change) => change.id),
          ),
        )
        setSelectedDestinations(
          Object.fromEntries(
            changes.map((change) => [
              change.id,
              change.selectedDestination === 'neither' &&
              change.status === 'pending'
                ? 'cycle_only'
                : change.selectedDestination,
            ]),
          ),
        )
      })
      .catch((caught: unknown) => {
        if (!isCurrent) {
          return
        }
        setState({
          status: 'error',
          message:
            caught instanceof Error
              ? caught.message
              : 'Workout history could not load.',
        })
      })

    return () => {
      isCurrent = false
    }
  }, [revision, searchParams])

  const summary = useMemo(() => {
    if (state.status !== 'ready') {
      return null
    }
    const sets = Object.values(state.setsByExercise).flat()
    const skipped = state.exercises.filter((exercise) => exercise.skipped)
    return {
      exercisesCompleted: state.exercises.filter(
        (exercise) => !exercise.skipped,
      ).length,
      setsCompleted: sets.filter((set) => set.completed).length,
      skipped,
      reviewStatus: formatReviewStatus(state.changes),
    }
  }, [state])

  function reload() {
    setRevision((current) => current + 1)
  }

  function runEdit(action: Promise<unknown>) {
    void action
      .then(() => {
        setEditError(null)
        reload()
      })
      .catch((caught: unknown) => {
        setEditError(
          caught instanceof Error ? caught.message : 'History edit failed.',
        )
      })
  }

  function deleteSelectedWorkout() {
    if (state.status !== 'ready') {
      return
    }
    const deletedId = state.selected.id
    void workoutRepository
      .deleteWorkoutHistory(deletedId)
      .then(() => {
        setDeleteRequested(false)
        setEditError(null)
        const nextWorkout = state.workouts.find(
          (workout) => workout.id !== deletedId,
        )
        setSearchParams(nextWorkout ? { workout: nextWorkout.id } : {})
        reload()
      })
      .catch((caught: unknown) => {
        setDeleteRequested(false)
        setEditError(
          caught instanceof Error
            ? caught.message
            : 'Workout history could not be deleted.',
        )
      })
  }

  if (state.status === 'loading') {
    return (
      <PageContainer>
        <LoadingState label="Loading workout history" />
      </PageContainer>
    )
  }

  if (state.status === 'empty') {
    return (
      <PageContainer>
        <SectionHeader title="Completed workouts" />
        <Card>
          <EmptyState
            title="No workout history"
            message="Completed workout snapshots appear here after live logging."
          />
        </Card>
      </PageContainer>
    )
  }

  if (state.status === 'error') {
    return (
      <PageContainer>
        <StatusMessage tone="warning">{state.message}</StatusMessage>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <SectionHeader title="Completed workouts" />
      {editError ? <ValidationMessage message={editError} /> : null}
      <div className="history-layout">
        <Card title="History">
          <div className="history-list">
            {state.workouts.map((workout) => {
              const workoutSummary = state.summaries[workout.id]
              return (
                <button
                  aria-current={workout.id === state.selected.id}
                  key={workout.id}
                  onClick={() => setSearchParams({ workout: workout.id })}
                  type="button"
                >
                  <strong>{workout.name}</strong>
                  <small>{formatSourceLabel(workout)}</small>
                  <small>
                    {workout.localDate} -{' '}
                    {formatDuration(workout.durationSeconds)} -{' '}
                    {workoutSummary?.exerciseCount ?? 0} exercises -{' '}
                    {workoutSummary?.completedSetCount ?? 0} completed sets
                  </small>
                </button>
              )
            })}
          </div>
        </Card>

        <Card title={state.selected.name}>
          {summary ? (
            <div className="summary-grid">
              <span>
                <strong>{state.selected.localDate}</strong>
                <small>Local date</small>
              </span>
              <span>
                <strong>
                  {formatDuration(state.selected.durationSeconds)}
                </strong>
                <small>Duration</small>
              </span>
              <span>
                <strong>{summary.exercisesCompleted}</strong>
                <small>Exercises</small>
              </span>
              <span>
                <strong>{summary.setsCompleted}</strong>
                <small>Completed sets</small>
              </span>
              <span>
                <strong>{summary.reviewStatus}</strong>
                <small>Review</small>
              </span>
            </div>
          ) : null}

          <dl className="history-detail-list">
            <div>
              <dt>Started</dt>
              <dd>{formatTimestamp(state.selected.startedAt)}</dd>
            </div>
            <div>
              <dt>Completed</dt>
              <dd>{formatTimestamp(state.selected.completedAt)}</dd>
            </div>
            <div>
              <dt>Program snapshot</dt>
              <dd>
                {state.selected.workoutSnapshot.templateName ??
                  state.selected.workoutSnapshot.activeCycleName ??
                  'No program source'}
              </dd>
            </div>
            <div>
              <dt>Workout-day snapshot</dt>
              <dd>
                {state.selected.workoutSnapshot.dayName}
                {state.selected.workoutSnapshot.dayNotes
                  ? ` - ${state.selected.workoutSnapshot.dayNotes}`
                  : ''}
              </dd>
            </div>
          </dl>

          <FormField id={`${state.selected.id}-notes`} label="Workout notes">
            <textarea
              defaultValue={state.selected.notes}
              id={`${state.selected.id}-notes`}
              onBlur={(event) =>
                runEdit(
                  workoutRepository.updateWorkoutHistoryNotes(
                    state.selected.id,
                    event.currentTarget.value,
                  ),
                )
              }
              placeholder="Session notes"
            />
          </FormField>

          {summary?.skipped.length ? (
            <p className="muted">
              Skipped:{' '}
              {summary.skipped
                .map((exercise) => exercise.exerciseSnapshot.exerciseName)
                .join(', ')}
            </p>
          ) : null}

          <div className="button-row">
            <SecondaryButton
              className="button-danger"
              onClick={() => setDeleteRequested(true)}
              type="button"
            >
              <Trash2 aria-hidden="true" size={18} />
              Delete workout
            </SecondaryButton>
          </div>
        </Card>

        <Card title="Exercises">
          <div className="history-exercise-list">
            {state.exercises.map((exercise) => (
              <HistoryExerciseCard
                exercise={exercise}
                key={exercise.id}
                onExerciseNotes={(notes) =>
                  runEdit(
                    workoutRepository.updateWorkoutHistoryExerciseNotes(
                      exercise.id,
                      notes,
                    ),
                  )
                }
                onSetChange={(set, input) =>
                  runEdit(
                    workoutRepository.updateWorkoutHistorySet(set.id, input),
                  )
                }
                sets={state.setsByExercise[exercise.id] ?? []}
              />
            ))}
          </div>
        </Card>

        <ChangeReview
          changes={state.changes}
          error={reviewError}
          hasTemplate={Boolean(state.selected.sourceTemplateId)}
          onDestinationChange={(changeId, destination) =>
            setSelectedDestinations((current) => ({
              ...current,
              [changeId]: destination,
            }))
          }
          onSave={(applySelected) => {
            const selections = state.changes.map((change) => ({
              changeId: change.id,
              destination:
                applySelected && selectedIds.has(change.id)
                  ? (selectedDestinations[change.id] ?? 'cycle_only')
                  : ('neither' as const),
            }))
            void workoutRepository
              .applyDetectedChanges(selections)
              .then(() => {
                setReviewError(null)
                reload()
              })
              .catch((caught: unknown) => {
                setReviewError(
                  caught instanceof Error
                    ? caught.message
                    : 'Change review could not be saved.',
                )
                reload()
              })
          }}
          onToggle={(changeId) => {
            setSelectedIds((current) => {
              const next = new Set(current)
              if (next.has(changeId)) {
                next.delete(changeId)
              } else {
                next.add(changeId)
              }
              return next
            })
          }}
          selectedDestinations={selectedDestinations}
          selectedIds={selectedIds}
        />
      </div>

      <ModalConfirmationDialog
        confirmLabel="Delete"
        isOpen={deleteRequested}
        onCancel={() => setDeleteRequested(false)}
        onConfirm={deleteSelectedWorkout}
        title="Delete workout history?"
      >
        <p>
          Delete {state.selected.name} from {state.selected.localDate}. This
          removes only this historical workout snapshot and cannot be undone.
        </p>
      </ModalConfirmationDialog>
    </PageContainer>
  )
}

function HistoryExerciseCard({
  exercise,
  onExerciseNotes,
  onSetChange,
  sets,
}: {
  exercise: WorkoutHistoryExercise
  onExerciseNotes: (notes: string) => void
  onSetChange: (set: WorkoutHistorySet, input: HistorySetInput) => void
  sets: WorkoutHistorySet[]
}) {
  const metrics = exercise.exerciseSnapshot.trackingMetrics

  return (
    <article
      className={
        exercise.skipped ? 'history-exercise skipped' : 'history-exercise'
      }
    >
      <div className="exercise-card-header">
        <div>
          <h3>{exercise.exerciseSnapshot.exerciseName}</h3>
          <p className="muted">
            {exercise.skipped ? 'Skipped' : 'Performed'} -{' '}
            {exercise.exerciseSnapshot.trackingMethodId}
          </p>
        </div>
      </div>

      <FormField id={`${exercise.id}-notes`} label="Exercise notes">
        <textarea
          defaultValue={exercise.notes}
          id={`${exercise.id}-notes`}
          onBlur={(event) => onExerciseNotes(event.currentTarget.value)}
        />
      </FormField>

      <div className="set-list">
        {sets.length ? (
          sets.map((set) => (
            <HistorySetRow
              key={set.id}
              metrics={metrics}
              onSetChange={(input) => onSetChange(set, input)}
              set={set}
            />
          ))
        ) : (
          <p className="muted">No performed sets recorded.</p>
        )}
      </div>
    </article>
  )
}

function HistorySetRow({
  metrics,
  onSetChange,
  set,
}: {
  metrics: TrackingMetric[]
  onSetChange: (input: HistorySetInput) => void
  set: WorkoutHistorySet
}) {
  return (
    <div className="set-row history-set-row">
      <div className="set-number">
        <strong>Set {set.setNumber}</strong>
        <small>{set.completed ? 'Completed' : 'Incomplete'}</small>
      </div>
      {metrics.map((metric) => (
        <label key={metric.key}>
          <span>{metric.label}</span>
          <NumericInput
            aria-label={`Set ${set.setNumber} ${metric.label}`}
            defaultValue={formatMetricInput(set.metricValues[metric.key])}
            onBlur={(event) =>
              onSetChange({
                metricValues: {
                  ...set.metricValues,
                  [metric.key]: parseMetricValue(event.currentTarget.value),
                },
              })
            }
          />
        </label>
      ))}
      {usesRir(metrics) ? (
        <label>
          <span>RIR</span>
          <NumericInput
            aria-label={`Set ${set.setNumber} RIR`}
            defaultValue={set.rir?.toString() ?? ''}
            onBlur={(event) =>
              onSetChange({
                rir: parseNullableNumber(event.currentTarget.value),
              })
            }
          />
        </label>
      ) : null}
      <label className="checkbox-row history-complete-toggle">
        <input
          checked={set.completed}
          onChange={(event) =>
            onSetChange({ completed: event.currentTarget.checked })
          }
          type="checkbox"
        />
        Complete
      </label>
    </div>
  )
}

function ChangeReview({
  changes,
  error,
  hasTemplate,
  onDestinationChange,
  onSave,
  onToggle,
  selectedDestinations,
  selectedIds,
}: {
  changes: DetectedWorkoutChange[]
  error: string | null
  hasTemplate: boolean
  onDestinationChange: (
    changeId: string,
    destination: StructuralChangeDestination,
  ) => void
  onSave: (applySelected: boolean) => void
  onToggle: (changeId: string) => void
  selectedDestinations: Record<string, StructuralChangeDestination>
  selectedIds: Set<string>
}) {
  if (!changes.length) {
    return (
      <Card title="Changes detected">
        <StatusMessage tone="success">
          No structural changes detected.
        </StatusMessage>
      </Card>
    )
  }

  const reviewLocked = changes.every((change) => change.status !== 'pending')

  return (
    <Card title="Changes detected">
      <div className="change-review-list">
        {changes.map((change) => {
          const selected = selectedIds.has(change.id)
          const destination = selectedDestinations[change.id] ?? 'cycle_only'
          const templateDestination =
            destination === 'template_only' || destination === 'both'
          return (
            <div className="change-review-item" key={change.id}>
              <label className="checkbox-row">
                <input
                  checked={selected}
                  disabled={change.status !== 'pending'}
                  onChange={() => onToggle(change.id)}
                  type="checkbox"
                />
                <span>{change.description}</span>
              </label>
              <dl className="history-detail-list">
                <div>
                  <dt>Selected</dt>
                  <dd>{change.selectedDestination}</dd>
                </div>
                <div>
                  <dt>Result</dt>
                  <dd>{change.status}</dd>
                </div>
                <div>
                  <dt>Applied</dt>
                  <dd>{change.appliedDestination ?? 'Not applied'}</dd>
                </div>
              </dl>
              {selected ? (
                <FormField
                  helpText={
                    !hasTemplate && templateDestination
                      ? 'This workout has no reusable template source.'
                      : undefined
                  }
                  id={`${change.id}-destination`}
                  label="Destination"
                >
                  <select
                    disabled={change.status !== 'pending'}
                    id={`${change.id}-destination`}
                    onChange={(event) =>
                      onDestinationChange(
                        change.id,
                        event.target.value as StructuralChangeDestination,
                      )
                    }
                    value={destination}
                  >
                    {destinations.map((option) => (
                      <option
                        disabled={
                          !hasTemplate &&
                          (option.value === 'template_only' ||
                            option.value === 'both')
                        }
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FormField>
              ) : null}
              {change.failureReason ? (
                <small className="muted">{change.failureReason}</small>
              ) : null}
            </div>
          )
        })}
      </div>
      {error ? <ValidationMessage message={error} /> : null}
      {!reviewLocked ? (
        <div className="button-row">
          <SecondaryButton type="button" onClick={() => onSave(false)}>
            Save without applying
          </SecondaryButton>
          <PrimaryButton type="button" onClick={() => onSave(true)}>
            Apply selected
          </PrimaryButton>
        </div>
      ) : null}
    </Card>
  )
}

function formatSourceLabel(workout: WorkoutHistoryEntry) {
  const program =
    workout.workoutSnapshot.templateName ??
    workout.workoutSnapshot.activeCycleName
  return program
    ? `${program} - ${workout.workoutSnapshot.dayName}`
    : 'No program source'
}

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp))
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function parseMetricValue(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function parseNullableNumber(value: string) {
  const parsed = parseMetricValue(value)
  return typeof parsed === 'number' ? parsed : null
}

function formatMetricInput(value: WorkoutHistorySet['metricValues'][string]) {
  return typeof value === 'number' ? String(value) : ''
}

function usesRir(metrics: TrackingMetric[]) {
  return metrics.some((metric) =>
    ['weight', 'reps', 'assistedWeight'].includes(metric.key),
  )
}

function formatReviewStatus(changes: DetectedWorkoutChange[]) {
  if (!changes.length) {
    return 'None'
  }
  if (changes.some((change) => change.status === 'failed')) {
    return 'Failed'
  }
  if (changes.some((change) => change.status === 'pending')) {
    return 'Pending'
  }
  return 'Reviewed'
}
