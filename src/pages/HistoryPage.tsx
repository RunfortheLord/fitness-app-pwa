import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  Card,
  EmptyState,
  FormField,
  LoadingState,
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
  WorkoutHistoryEntry,
  WorkoutHistoryExercise,
  WorkoutHistorySet,
} from '@shared-types/app'

type HistoryState =
  | { status: 'loading' }
  | { status: 'empty' }
  | {
      status: 'ready'
      workouts: WorkoutHistoryEntry[]
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
        const selected =
          workouts.find((workout) => workout.id === requestedId) ?? workouts[0]
        const [structure, changes] = await Promise.all([
          workoutRepository.getWorkoutHistoryStructure(selected.id),
          workoutRepository.listDetectedChanges(selected.id),
        ])
        if (!isCurrent) {
          return
        }
        setState({
          status: 'ready',
          workouts,
          selected,
          exercises: structure.exercises,
          setsByExercise: structure.setsByExercise,
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
      <div className="history-layout">
        <Card title="History">
          <div className="history-list">
            {state.workouts.map((workout) => (
              <button
                aria-current={workout.id === state.selected.id}
                key={workout.id}
                onClick={() => setSearchParams({ workout: workout.id })}
                type="button"
              >
                <strong>{workout.name}</strong>
                <small>
                  {workout.localDate} -{' '}
                  {formatDuration(workout.durationSeconds)}
                </small>
              </button>
            ))}
          </div>
        </Card>

        <Card title={state.selected.name}>
          {summary ? (
            <div className="summary-grid">
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
                <small>Sets</small>
              </span>
              <span>
                <strong>{summary.reviewStatus}</strong>
                <small>Review</small>
              </span>
            </div>
          ) : null}
          <p className="muted">
            {state.selected.workoutSnapshot.activeCycleName ?? 'Program'} -{' '}
            {state.selected.workoutSnapshot.dayName}
          </p>
          {state.selected.notes ? <p>{state.selected.notes}</p> : null}
          {summary?.skipped.length ? (
            <p className="muted">
              Skipped:{' '}
              {summary.skipped
                .map((exercise) => exercise.exerciseSnapshot.exerciseName)
                .join(', ')}
            </p>
          ) : null}
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
                setRevision((current) => current + 1)
              })
              .catch((caught: unknown) => {
                setReviewError(
                  caught instanceof Error
                    ? caught.message
                    : 'Change review could not be saved.',
                )
                setRevision((current) => current + 1)
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
    </PageContainer>
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
              {selected ? (
                <FormField
                  id={`${change.id}-destination`}
                  label="Destination"
                  helpText={
                    !hasTemplate && templateDestination
                      ? 'This workout has no reusable template source.'
                      : undefined
                  }
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
              {change.status !== 'pending' ? (
                <small className="muted">
                  {change.status}
                  {change.failureReason ? `: ${change.failureReason}` : ''}
                </small>
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

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
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
