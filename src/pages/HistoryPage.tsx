import { ChevronDown, Trash2 } from 'lucide-react'
import { useContext, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import {
  Card,
  EmptyState,
  FormField,
  LoadingState,
  ModalConfirmationDialog,
  NumericInput,
  PageContainer,
  PrimaryButton,
  SegmentedControl,
  SecondaryButton,
  SectionHeader,
  StatusMessage,
  ValidationMessage,
} from '@components/ui'
import { DashboardContext } from '@components/dashboardContextValue'
import { formatLocalDate } from '@domain/dates'
import {
  createBodyweightChartModel,
  filterBodyweightEntriesForRange,
  formatWeight,
  type BodyweightRange,
} from '@domain/bodyweightProgress'
import {
  createStrengthGraphModel,
  createStrengthGraphPoints,
  filterStrengthPointsForRange,
  formatEstimatedMax,
  listStrengthExerciseOptions,
  strengthEstimateLimitText,
  type StrengthGraphPoint,
  type StrengthRange,
} from '@domain/strengthProgress'
import {
  formatDistance,
  formatDuration as formatRunDuration,
  formatPace,
} from '@domain/runFormatting'
import {
  exerciseHistorySummary,
  formatHistoryDate,
  formatHistoryDuration,
  formatHistorySetMetric,
  historyMetricsForExercise,
  summarizeHistoryWorkout,
  workoutHistoryType,
} from '@domain/historyDisplay'
import { bodyweightRepository } from '@repositories/bodyweightRepository'
import { runRepository, type RunStructure } from '@repositories/runRepository'
import { workoutRepository } from '@repositories/workoutRepository'
import type {
  BodyweightEntry,
  DetectedWorkoutChange,
  Run,
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
      runs: Run[]
      summaries: Record<string, WorkoutSummary>
      selected: WorkoutHistoryEntry | null
      selectedRun: RunStructure | null
      exercises: WorkoutHistoryExercise[]
      setsByExercise: Record<string, WorkoutHistorySet[]>
      changes: DetectedWorkoutChange[]
    }
  | { status: 'error'; message: string }

const destinations: Array<{
  label: string
  value: StructuralChangeDestination
}> = [
  { label: 'Active Cycle Only', value: 'cycle_only' },
  { label: 'Template Only', value: 'template_only' },
  { label: 'Both', value: 'both' },
]

const bodyweightRangeOptions: Array<{
  label: string
  value: BodyweightRange
}> = [
  { label: '1M', value: '1m' },
  { label: '3M', value: '3m' },
  { label: '6M', value: '6m' },
  { label: 'All', value: 'all' },
]

const strengthRangeOptions: Array<{
  label: string
  value: StrengthRange
}> = [
  { label: '1M', value: '1m' },
  { label: '3M', value: '3m' },
  { label: '6M', value: '6m' },
  { label: '1Y', value: '1y' },
  { label: 'All', value: 'all' },
]

export function HistoryPage() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
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
    if (
      location.pathname.startsWith('/graphs') ||
      searchParams.get('view') === 'bodyweight' ||
      searchParams.get('view') === 'graphs'
    ) {
      return
    }

    let isCurrent = true
    void workoutRepository
      .listRecentCompletedWorkouts(5000)
      .then(async (workouts) => {
        const runs = await runRepository.listRecentCompletedRuns(5000)
        if (!isCurrent) {
          return
        }
        if (!workouts.length && !runs.length) {
          setState({ status: 'empty' })
          return
        }

        const requestedId = searchParams.get('workout')
        const requestedRunId = searchParams.get('run')
        const requested =
          workouts.find((workout) => workout.id === requestedId) ?? workouts[0]
        const selectedRun = requestedRunId
          ? await runRepository
              .getRunStructure(requestedRunId)
              .catch(() => null)
          : !requested && runs[0]
            ? await runRepository.getRunStructure(runs[0].id)
            : null
        const structures = await Promise.all(
          workouts.map((workout) =>
            workoutRepository.getWorkoutHistoryStructure(workout.id),
          ),
        )
        const selectedStructure =
          requested && !selectedRun
            ? (structures.find(
                (structure) => structure.workout.id === requested.id,
              ) ?? structures[0])
            : null
        const changes = selectedStructure
          ? await workoutRepository.listDetectedChanges(
              selectedStructure.workout.id,
            )
          : []
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
          runs,
          summaries,
          selected: selectedStructure?.workout ?? null,
          selectedRun,
          exercises: selectedStructure?.exercises ?? [],
          setsByExercise: selectedStructure?.setsByExercise ?? {},
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
  }, [location.pathname, revision, searchParams])

  const summary = useMemo(() => {
    if (state.status !== 'ready' || !state.selected) {
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
    if (!state.selected) {
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

  function resumeSelectedWorkout() {
    if (state.status !== 'ready' || !state.selected) {
      return
    }
    void workoutRepository
      .resumeCompletedWorkout(state.selected.id)
      .then(() => {
        void navigate('/workout')
      })
      .catch((caught: unknown) => {
        setEditError(
          caught instanceof Error
            ? caught.message
            : 'Workout could not be resumed.',
        )
      })
  }

  if (
    location.pathname.startsWith('/graphs') ||
    searchParams.get('view') === 'bodyweight'
  ) {
    return (
      <BodyweightProgressView
        onShowWorkouts={() => {
          setSearchParams({})
          setRevision((current) => current + 1)
        }}
      />
    )
  }

  if (searchParams.get('view') === 'graphs') {
    return (
      <StrengthGraphsView
        onShowWorkouts={() => {
          setSearchParams({})
          setRevision((current) => current + 1)
        }}
      />
    )
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

  const selectedWorkout = state.selected

  return (
    <PageContainer>
      <SectionHeader
        title="History"
        action={
          <div className="button-row">
            <SecondaryButton
              type="button"
              onClick={() => setSearchParams({ view: 'graphs' })}
            >
              Graphs
            </SecondaryButton>
            <SecondaryButton
              type="button"
              onClick={() => setSearchParams({ view: 'bodyweight' })}
            >
              Bodyweight
            </SecondaryButton>
          </div>
        }
      />
      {editError ? <ValidationMessage message={editError} /> : null}
      <div className="history-layout">
        <Card title="History">
          <div className="history-list">
            {groupHistoryItemsByDate(state.workouts, state.runs).map(
              (group) => (
                <section key={group.localDate} className="history-date-group">
                  <h3>{group.localDate}</h3>
                  {group.items.map((item) =>
                    item.type === 'run' ? (
                      <button
                        aria-current={item.run.id === state.selectedRun?.run.id}
                        key={item.run.id}
                        onClick={() => setSearchParams({ run: item.run.id })}
                        type="button"
                      >
                        <strong>Run</strong>
                        <small>GPS run</small>
                        <small>
                          {formatDistance(item.run.distanceMeters)} -{' '}
                          {formatRunDuration(item.run.elapsedSeconds)}
                        </small>
                      </button>
                    ) : (
                      <WorkoutHistoryListAccordion
                        exercises={
                          item.workout.id === state.selected?.id
                            ? state.exercises
                            : []
                        }
                        isExpanded={item.workout.id === state.selected?.id}
                        key={item.workout.id}
                        onOpen={() =>
                          setSearchParams({ workout: item.workout.id })
                        }
                        setsByExercise={
                          item.workout.id === state.selected?.id
                            ? state.setsByExercise
                            : {}
                        }
                        summary={state.summaries[item.workout.id]}
                        workout={item.workout}
                      />
                    ),
                  )}
                </section>
              ),
            )}
          </div>
        </Card>

        {state.selectedRun ? (
          <RunHistoryDetail structure={state.selectedRun} />
        ) : null}

        {selectedWorkout ? (
          <Card title={selectedWorkout.name}>
            {summary ? (
              <div className="summary-grid">
                <span>
                  <strong>{selectedWorkout.localDate}</strong>
                  <small>Local date</small>
                </span>
                <span>
                  <strong>
                    {formatDuration(selectedWorkout.durationSeconds)}
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
                <dd>{formatTimestamp(selectedWorkout.startedAt)}</dd>
              </div>
              <div>
                <dt>Completed</dt>
                <dd>{formatTimestamp(selectedWorkout.completedAt)}</dd>
              </div>
              <div>
                <dt>Program snapshot</dt>
                <dd>
                  {selectedWorkout.workoutSnapshot.templateName ??
                    selectedWorkout.workoutSnapshot.activeCycleName ??
                    'No program source'}
                </dd>
              </div>
              <div>
                <dt>Workout-day snapshot</dt>
                <dd>
                  {selectedWorkout.workoutSnapshot.dayName}
                  {selectedWorkout.workoutSnapshot.dayNotes
                    ? ` - ${selectedWorkout.workoutSnapshot.dayNotes}`
                    : ''}
                </dd>
              </div>
            </dl>

            <FormField id={`${selectedWorkout.id}-notes`} label="Workout notes">
              <textarea
                defaultValue={selectedWorkout.notes}
                id={`${selectedWorkout.id}-notes`}
                onBlur={(event) =>
                  runEdit(
                    workoutRepository.updateWorkoutHistoryNotes(
                      selectedWorkout.id,
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
              <PrimaryButton type="button" onClick={resumeSelectedWorkout}>
                Resume Workout
              </PrimaryButton>
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
        ) : null}

        {selectedWorkout ? (
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
        ) : null}

        {selectedWorkout ? (
          <ChangeReview
            changes={state.changes}
            error={reviewError}
            hasTemplate={Boolean(selectedWorkout.sourceTemplateId)}
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
        ) : null}
      </div>

      <ModalConfirmationDialog
        confirmLabel="Delete"
        isOpen={deleteRequested && state.selected !== null}
        onCancel={() => setDeleteRequested(false)}
        onConfirm={deleteSelectedWorkout}
        title="Delete workout history?"
      >
        <p>
          Delete {state.selected?.name} from {state.selected?.localDate}. This
          removes only this historical workout snapshot and cannot be undone.
        </p>
      </ModalConfirmationDialog>
    </PageContainer>
  )
}

function WorkoutHistoryListAccordion({
  exercises,
  isExpanded,
  onOpen,
  setsByExercise,
  summary,
  workout,
}: {
  exercises: WorkoutHistoryExercise[]
  isExpanded: boolean
  onOpen: () => void
  setsByExercise: Record<string, WorkoutHistorySet[]>
  summary: WorkoutSummary | undefined
  workout: WorkoutHistoryEntry
}) {
  const [openExercises, setOpenExercises] = useState<Set<string>>(new Set())
  const panelId = `history-list-panel-${workout.id}`
  const duration = formatHistoryDuration(workout.durationSeconds)

  return (
    <article className="history-accordion-item">
      <button
        aria-controls={panelId}
        aria-current={isExpanded}
        aria-expanded={isExpanded}
        className="history-accordion-trigger"
        onClick={onOpen}
        type="button"
      >
        <span className="history-accordion-main">
          <strong>{formatHistoryDate(workout.localDate)}</strong>
          <small>
            {workout.name} - {workoutHistoryType(workout)}
          </small>
          <small>
            {[duration, `${summary?.exerciseCount ?? 0} exercises`]
              .filter(Boolean)
              .join(' - ')}
          </small>
        </span>
        <ChevronDown aria-hidden="true" className="accordion-chevron" />
      </button>
      {isExpanded ? (
        <div className="history-accordion-panel" id={panelId}>
          <dl className="history-detail-list">
            <div>
              <dt>Workout</dt>
              <dd>{workout.name}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{workoutHistoryType(workout)}</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{formatHistoryDate(workout.localDate)}</dd>
            </div>
            {duration ? (
              <div>
                <dt>Duration</dt>
                <dd>{duration}</dd>
              </div>
            ) : null}
            {workout.notes ? (
              <div>
                <dt>Notes</dt>
                <dd>{workout.notes}</dd>
              </div>
            ) : null}
            <div>
              <dt>Exercises</dt>
              <dd>
                {
                  summarizeHistoryWorkout({
                    workout,
                    exercises,
                    setsByExercise,
                  }).exerciseCount
                }
              </dd>
            </div>
          </dl>
          <div className="history-exercise-accordion-list">
            {exercises.map((exercise) => {
              const sets = setsByExercise[exercise.id] ?? []
              const exerciseExpanded = openExercises.has(exercise.id)
              const exercisePanelId = `history-list-exercise-${exercise.id}`
              return (
                <article
                  className="history-exercise-accordion"
                  key={exercise.id}
                >
                  <button
                    aria-controls={exercisePanelId}
                    aria-expanded={exerciseExpanded}
                    className="history-exercise-trigger"
                    onClick={() =>
                      setOpenExercises((current) => {
                        const next = new Set(current)
                        if (next.has(exercise.id)) {
                          next.delete(exercise.id)
                        } else {
                          next.add(exercise.id)
                        }
                        return next
                      })
                    }
                    type="button"
                  >
                    <span>
                      <strong>{exercise.exerciseSnapshot.exerciseName}</strong>
                      <small>{exerciseHistorySummary(exercise, sets)}</small>
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className="accordion-chevron"
                    />
                  </button>
                  {exerciseExpanded ? (
                    <div
                      className="history-exercise-panel"
                      id={exercisePanelId}
                    >
                      {exercise.notes ? (
                        <p className="muted">{exercise.notes}</p>
                      ) : null}
                      {sets.map((set) => (
                        <div className="history-readonly-set" key={set.id}>
                          <strong>Set {set.setNumber}</strong>
                          <small>
                            {set.completed ? 'Completed' : 'Not completed'}
                          </small>
                          {exercise.skipped ? <small>Skipped</small> : null}
                          {historyMetricsForExercise(exercise)
                            .map((metric) =>
                              formatHistorySetMetric(
                                metric,
                                set.metricValues[metric.key],
                              ),
                            )
                            .filter(Boolean)
                            .map((label) => (
                              <small key={label}>{label}</small>
                            ))}
                          {typeof set.rir === 'number' ? (
                            <small>RIR: {set.rir}</small>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        </div>
      ) : null}
    </article>
  )
}

function BodyweightProgressView({
  onShowWorkouts,
}: {
  onShowWorkouts: () => void
}) {
  const [range, setRange] = useState<BodyweightRange>('3m')
  const [graphCategory, setGraphCategory] = useState('bodyweight')
  const [entries, setEntries] = useState<BodyweightEntry[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const dashboardContext = useContext(DashboardContext)
  const dashboardRevision = dashboardContext?.dashboardRevision ?? 0
  const openBodyweightSheet = dashboardContext?.openBodyweightSheet
  const today = formatLocalDate(new Date())

  useEffect(() => {
    let isCurrent = true
    void bodyweightRepository
      .listBodyweightEntries()
      .then((nextEntries) => {
        if (!isCurrent) {
          return
        }
        setEntries(nextEntries)
        setStatus('ready')
        setSelectedEntryId(
          (current) => current ?? nextEntries.at(-1)?.id ?? null,
        )
      })
      .catch(() => {
        if (isCurrent) {
          setStatus('error')
        }
      })

    return () => {
      isCurrent = false
    }
  }, [dashboardRevision])

  const rangedEntries = filterBodyweightEntriesForRange({
    entries,
    range,
    today,
  })
  const model = createBodyweightChartModel(rangedEntries)
  const selectedEntry =
    rangedEntries.find((entry) => entry.id === selectedEntryId) ??
    rangedEntries.at(-1) ??
    null

  return (
    <PageContainer>
      <SectionHeader
        title="Graphs"
        action={
          <SecondaryButton type="button" onClick={onShowWorkouts}>
            History
          </SecondaryButton>
        }
      />
      <SegmentedControl
        label="Graph category"
        onChange={setGraphCategory}
        options={[
          { label: 'Body Weight', value: 'bodyweight' },
          { label: 'Exercises', value: 'exercises' },
          { label: 'Running', value: 'running' },
          { label: 'All', value: 'all' },
        ]}
        value={graphCategory}
      />
      {graphCategory === 'exercises' ? (
        <Card title="Exercise graphs">
          <SecondaryButton type="button" onClick={() => onShowWorkouts()}>
            Open exercise graphs
          </SecondaryButton>
        </Card>
      ) : null}
      {graphCategory === 'running' ? (
        <Card title="Running">
          <EmptyState
            title="No running graph selected"
            message="Completed runs remain available from History."
          />
        </Card>
      ) : null}
      {graphCategory === 'all' ? (
        <Card title="View everything">
          <FormField id="all-dashboard-filter" label="Dashboard filter">
            <select id="all-dashboard-filter" defaultValue="bodyweight">
              <option value="bodyweight">Body weight</option>
              <option value="exercises">Exercises</option>
              <option value="running">Running</option>
              <option value="nutrition">Nutrition</option>
              <option value="history">History</option>
            </select>
          </FormField>
        </Card>
      ) : null}
      {graphCategory === 'bodyweight' ? (
        <Card title="Bodyweight progress">
          <div className="button-row">
            <SecondaryButton
              disabled={!openBodyweightSheet}
              type="button"
              onClick={() => openBodyweightSheet?.(today)}
            >
              Log Bodyweight
            </SecondaryButton>
            {selectedEntry && openBodyweightSheet ? (
              <SecondaryButton
                type="button"
                onClick={() =>
                  openBodyweightSheet({
                    entryId: selectedEntry.id,
                    localDate: selectedEntry.localDate,
                  })
                }
              >
                Edit Selected
              </SecondaryButton>
            ) : null}
          </div>
          <SegmentedControl
            label="Bodyweight range"
            onChange={(value) => {
              setRange(value as BodyweightRange)
              setSelectedEntryId(null)
            }}
            options={bodyweightRangeOptions}
            value={range}
          />
          {status === 'loading' ? (
            <LoadingState label="Loading bodyweight progress" />
          ) : null}
          {status === 'error' ? (
            <StatusMessage tone="warning">
              Bodyweight progress could not load.
            </StatusMessage>
          ) : null}
          {status === 'ready' ? (
            <BodyweightChart
              model={model}
              onSelect={(entry) => setSelectedEntryId(entry.id)}
              selectedEntry={selectedEntry}
            />
          ) : null}
        </Card>
      ) : null}
    </PageContainer>
  )
}

function StrengthGraphsView({
  onShowWorkouts,
}: {
  onShowWorkouts: () => void
}) {
  const [range, setRange] = useState<StrengthRange>('3m')
  const [points, setPoints] = useState<StrengthGraphPoint[]>([])
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const today = formatLocalDate(new Date())

  useEffect(() => {
    let isCurrent = true
    void workoutRepository
      .listRecentCompletedWorkouts(500)
      .then(async (workouts) => {
        const structures = await Promise.all(
          workouts.map((workout) =>
            workoutRepository.getWorkoutHistoryStructure(workout.id),
          ),
        )
        if (!isCurrent) {
          return
        }
        const nextPoints = createStrengthGraphPoints(structures)
        const options = listStrengthExerciseOptions(nextPoints)
        setPoints(nextPoints)
        setSelectedExerciseId(
          (current) => current || options[0]?.exerciseId || '',
        )
        setSelectedPointId(
          (current) => current ?? nextPoints.at(-1)?.id ?? null,
        )
        setStatus('ready')
      })
      .catch(() => {
        if (isCurrent) {
          setStatus('error')
        }
      })

    return () => {
      isCurrent = false
    }
  }, [])

  const options = listStrengthExerciseOptions(points)
  const selectedExercise = selectedExerciseId || options[0]?.exerciseId || ''
  const exercisePoints = points.filter(
    (point) => point.exerciseId === selectedExercise,
  )
  const rangedPoints = filterStrengthPointsForRange({
    points: exercisePoints,
    range,
    today,
  })
  const model = createStrengthGraphModel(rangedPoints)
  const selectedPoint =
    model.status === 'empty'
      ? null
      : (model.points.find((point) => point.id === selectedPointId) ??
        model.points.at(-1) ??
        null)

  return (
    <PageContainer>
      <SectionHeader
        title="Strength graphs"
        action={
          <SecondaryButton type="button" onClick={onShowWorkouts}>
            Workouts
          </SecondaryButton>
        }
      />
      <Card title="Estimated 1RM">
        <SegmentedControl
          label="Strength graph range"
          onChange={(value) => {
            setRange(value as StrengthRange)
            setSelectedPointId(null)
          }}
          options={strengthRangeOptions}
          value={range}
        />
        {status === 'loading' ? (
          <LoadingState label="Loading strength graphs" />
        ) : null}
        {status === 'error' ? (
          <StatusMessage tone="warning">
            Strength graphs could not load.
          </StatusMessage>
        ) : null}
        {status === 'ready' && options.length ? (
          <>
            <FormField id="strength-exercise" label="Exercise">
              <select
                id="strength-exercise"
                onChange={(event) => {
                  setSelectedExerciseId(event.target.value)
                  setSelectedPointId(null)
                }}
                value={selectedExercise}
              >
                {options.map((option) => (
                  <option key={option.exerciseId} value={option.exerciseId}>
                    {option.exerciseName}
                  </option>
                ))}
              </select>
            </FormField>
            <StrengthChart
              model={model}
              onSelect={(point) => setSelectedPointId(point.id)}
              selectedPoint={selectedPoint}
            />
            <p className="muted">{strengthEstimateLimitText()}</p>
          </>
        ) : null}
        {status === 'ready' && !options.length ? (
          <EmptyState
            title="No weighted exercise history"
            message="Complete weighted-repetition workout sets to build estimated 1RM graphs."
          />
        ) : null}
      </Card>
    </PageContainer>
  )
}

function StrengthChart({
  model,
  onSelect,
  selectedPoint,
}: {
  model: ReturnType<typeof createStrengthGraphModel>
  onSelect: (point: StrengthGraphPoint) => void
  selectedPoint: StrengthGraphPoint | null
}) {
  if (model.status === 'empty') {
    return (
      <EmptyState
        title="No points in range"
        message="Choose a longer range or complete another weighted workout."
      />
    )
  }

  const path = model.points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')

  return (
    <div className="bodyweight-chart-panel">
      <p className="visually-hidden" aria-live="polite">
        {model.summary}
      </p>
      <div className="bodyweight-chart-summary" aria-label="Strength summary">
        <span>
          <strong>
            {formatEstimatedMax(model.latest.estimatedOneRepMax)} lb
          </strong>
          <small>Latest - {model.latest.localDate}</small>
        </span>
        <span>
          <strong>
            {formatEstimatedMax(model.allTimeBest.estimatedOneRepMax)} lb
          </strong>
          <small>Best - {model.allTimeBest.localDate}</small>
        </span>
        <span>
          <strong>
            {formatEstimatedMax(model.minEstimate)}-
            {formatEstimatedMax(model.maxEstimate)} lb
          </strong>
          <small>Range</small>
        </span>
      </div>
      <div className="bodyweight-chart" aria-label="Estimated 1RM graph">
        <span className="chart-axis-label chart-axis-label-x">Date</span>
        <span className="chart-axis-label chart-axis-label-y">
          Estimated 1RM (lb)
        </span>
        <svg
          aria-hidden="true"
          focusable="false"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <line x1="0" x2="100" y1="100" y2="100" />
          {model.status === 'ready' ? <path d={path} /> : null}
          {model.points.map((point) => (
            <circle cx={point.x} cy={point.y} key={point.id} r="1.8" />
          ))}
        </svg>
        {model.points.map((point) => (
          <button
            aria-label={`${point.localDate} ${formatEstimatedMax(
              point.estimatedOneRepMax,
            )} lb estimated one-repetition maximum`}
            className="bodyweight-point-button"
            key={point.id}
            onClick={() => onSelect(point)}
            style={{
              left: `${point.x}%`,
              top: `${point.y}%`,
            }}
            type="button"
          />
        ))}
      </div>
      <p className="muted">{model.summary}</p>
      {model.status === 'single' ? (
        <StatusMessage>
          One estimated 1RM point is saved. Add another workout to show a line.
        </StatusMessage>
      ) : null}
      {selectedPoint ? (
        <dl className="history-detail-list bodyweight-detail">
          <div>
            <dt>Date</dt>
            <dd>{selectedPoint.localDate}</dd>
          </div>
          <div>
            <dt>Completed set</dt>
            <dd>
              {formatEstimatedMax(selectedPoint.weight)} lb x{' '}
              {selectedPoint.repetitions}
            </dd>
          </div>
          <div>
            <dt>Estimated 1RM</dt>
            <dd>{formatEstimatedMax(selectedPoint.estimatedOneRepMax)} lb</dd>
          </div>
        </dl>
      ) : null}
    </div>
  )
}

function RunHistoryDetail({ structure }: { structure: RunStructure }) {
  const { run, splits, classifications } = structure
  return (
    <Card title="Run detail">
      <div className="summary-grid">
        <span>
          <strong>{run.localDate}</strong>
          <small>Date</small>
        </span>
        <span>
          <strong>{formatDistance(run.distanceMeters)}</strong>
          <small>Distance</small>
        </span>
        <span>
          <strong>{formatRunDuration(run.elapsedSeconds)}</strong>
          <small>Elapsed</small>
        </span>
        <span>
          <strong>{formatRunDuration(run.movingSeconds)}</strong>
          <small>Moving</small>
        </span>
        <span>
          <strong>{formatPace(run.averageMovingPaceSecondsPerMile)}</strong>
          <small>Average pace</small>
        </span>
        <span>
          <strong>{run.hasGpsGap ? 'Yes' : 'No'}</strong>
          <small>GPS gap</small>
        </span>
      </div>
      <dl className="history-detail-list">
        <div>
          <dt>Started</dt>
          <dd>{formatTimestamp(run.startedAt)}</dd>
        </div>
        <div>
          <dt>Completed</dt>
          <dd>
            {run.completedAt ? formatTimestamp(run.completedAt) : 'Active'}
          </dd>
        </div>
      </dl>
      <h3>Mile splits</h3>
      {splits.length ? (
        <div className="run-split-list">
          {splits.map((split) => (
            <div key={split.id}>
              <strong>Mile {split.mileNumber}</strong>
              <span>{formatPace(split.paceSecondsPerMile)}</span>
              <small>
                {formatRunDuration(split.movingSeconds)} moving -{' '}
                {formatRunDuration(split.elapsedSeconds)} elapsed
              </small>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No completed mile splits.</p>
      )}
      <h3>Walking and rest</h3>
      {classifications.length ? (
        <ul className="compact-list">
          {classifications.map((classification) => (
            <li key={classification.id}>
              <span>{classification.type}</span>
              <strong>{formatTimestamp(classification.startedAt)}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No walking or rest classifications recorded.</p>
      )}
    </Card>
  )
}

function BodyweightChart({
  model,
  onSelect,
  selectedEntry,
}: {
  model: ReturnType<typeof createBodyweightChartModel>
  onSelect: (entry: BodyweightEntry) => void
  selectedEntry: BodyweightEntry | null
}) {
  if (model.status === 'empty') {
    return (
      <EmptyState
        title="No bodyweight data"
        message="Log bodyweight from Home to build a progress graph."
      />
    )
  }

  const path = model.points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')
  const first = model.entries[0]
  const latest = model.entries.at(-1) ?? first

  return (
    <div className="bodyweight-chart-panel">
      {model.summary.status !== 'empty' ? (
        <p className="visually-hidden" aria-live="polite">
          {model.summary.text}
        </p>
      ) : null}
      <div className="bodyweight-chart-summary" aria-label="Graph summary">
        <span>
          <strong>
            {formatWeight(first.weight)} {first.unit}
          </strong>
          <small>First - {first.localDate}</small>
        </span>
        <span>
          <strong>
            {formatWeight(latest.weight)} {latest.unit}
          </strong>
          <small>Latest - {latest.localDate}</small>
        </span>
        <span>
          <strong>
            {formatWeight(model.minWeight)}-{formatWeight(model.maxWeight)}{' '}
            {latest.unit}
          </strong>
          <small>Range</small>
        </span>
      </div>
      <div className="bodyweight-chart" aria-label="Bodyweight graph">
        <span className="chart-axis-label chart-axis-label-x">Date</span>
        <span className="chart-axis-label chart-axis-label-y">
          Bodyweight ({latest.unit})
        </span>
        <svg
          aria-hidden="true"
          focusable="false"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <line x1="0" x2="100" y1="100" y2="100" />
          {model.status === 'ready' ? <path d={path} /> : null}
          {model.points.map((point) => (
            <circle cx={point.x} cy={point.y} key={point.entry.id} r="1.8" />
          ))}
        </svg>
        {model.points.map((point) => (
          <button
            aria-label={`${point.entry.localDate} ${formatWeight(
              point.entry.weight,
            )} ${point.entry.unit}`}
            className="bodyweight-point-button"
            key={point.entry.id}
            onClick={() => onSelect(point.entry)}
            style={{
              left: `${point.x}%`,
              top: `${point.y}%`,
            }}
            type="button"
          />
        ))}
      </div>
      {model.summary.status !== 'empty' ? (
        <p className="muted">{model.summary.text}</p>
      ) : null}
      {model.status === 'single' ? (
        <StatusMessage>
          One bodyweight entry is saved. Add another entry to show a line.
        </StatusMessage>
      ) : null}
      {selectedEntry ? (
        <dl className="history-detail-list bodyweight-detail">
          <div>
            <dt>Selected</dt>
            <dd>
              {formatWeight(selectedEntry.weight)} {selectedEntry.unit}
            </dd>
          </div>
          <div>
            <dt>Local date</dt>
            <dd>{selectedEntry.localDate}</dd>
          </div>
          <div>
            <dt>Timestamp</dt>
            <dd>{formatTimestamp(selectedEntry.updatedAt)}</dd>
          </div>
        </dl>
      ) : null}
    </div>
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
          No program changes detected
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
                {change.recommendationReason ? (
                  <div>
                    <dt>Reason</dt>
                    <dd>{change.recommendationReason}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Selected</dt>
                  <dd>{formatChangeDestination(change.selectedDestination)}</dd>
                </div>
                <div>
                  <dt>Result</dt>
                  <dd>{change.status}</dd>
                </div>
                <div>
                  <dt>Applied</dt>
                  <dd>
                    {change.appliedDestination
                      ? formatChangeDestination(change.appliedDestination)
                      : 'Not applied'}
                  </dd>
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
              {change.recommendationSummary ? (
                <small className="muted">{change.recommendationSummary}</small>
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

function groupHistoryItemsByDate(workouts: WorkoutHistoryEntry[], runs: Run[]) {
  const items = [
    ...workouts.map((workout) => ({
      type: 'workout' as const,
      localDate: workout.localDate,
      completedAt: workout.completedAt,
      workout,
    })),
    ...runs.map((run) => ({
      type: 'run' as const,
      localDate: run.localDate,
      completedAt: run.completedAt ?? run.startedAt,
      run,
    })),
  ].sort((left, right) => right.completedAt.localeCompare(left.completedAt))

  const groups = new Map<string, typeof items>()
  for (const item of items) {
    groups.set(item.localDate, [...(groups.get(item.localDate) ?? []), item])
  }
  return [...groups.entries()].map(([localDate, groupItems]) => ({
    localDate,
    items: groupItems,
  }))
}

function formatChangeDestination(destination: StructuralChangeDestination) {
  if (destination === 'cycle_only') {
    return 'Active Cycle Only'
  }
  if (destination === 'template_only') {
    return 'Template Only'
  }
  if (destination === 'both') {
    return 'Both'
  }
  return 'Not applied'
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
