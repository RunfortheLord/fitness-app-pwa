import { ArrowLeft, ChevronDown, ChevronLeft, Search } from 'lucide-react'
import { useContext, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import {
  Card,
  EmptyState,
  FormField,
  IconButton,
  LoadingState,
  NumericInput,
  PageContainer,
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
  type StrengthExerciseOption,
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
} from '@domain/historyDisplay'
import { useSubpageBackGesture } from '@hooks/useSubpageBackGesture'
import { bodyweightRepository } from '@repositories/bodyweightRepository'
import { runRepository, type RunStructure } from '@repositories/runRepository'
import { workoutRepository } from '@repositories/workoutRepository'
import type {
  BodyweightEntry,
  Run,
  TrackingMetric,
  WorkoutHistoryEntry,
  WorkoutHistoryExercise,
  WorkoutHistorySet,
} from '@shared-types/app'

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
      selected: WorkoutHistoryEntry | null
      selectedRun: RunStructure | null
      exercises: WorkoutHistoryExercise[]
      setsByExercise: Record<string, WorkoutHistorySet[]>
    }
  | { status: 'error'; message: string }

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
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [state, setState] = useState<HistoryState>({ status: 'loading' })
  const [revision, setRevision] = useState(0)
  const [editError, setEditError] = useState<string | null>(null)

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
        const requested = requestedId
          ? (workouts.find((workout) => workout.id === requestedId) ?? null)
          : null
        const selectedRun = requestedRunId
          ? await runRepository
              .getRunStructure(requestedRunId)
              .catch(() => null)
          : null
        const selectedStructure =
          requested && !selectedRun
            ? await workoutRepository.getWorkoutHistoryStructure(requested.id)
            : null
        if (!isCurrent) {
          return
        }
        setState({
          status: 'ready',
          workouts,
          runs,
          selected: selectedStructure?.workout ?? null,
          selectedRun,
          exercises: selectedStructure?.exercises ?? [],
          setsByExercise: selectedStructure?.setsByExercise ?? {},
        })
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
  const isHomeHistory = searchParams.get('source') === 'home'
  const setHistoryParams = (params: Record<string, string>) => {
    setSearchParams(isHomeHistory ? { ...params, source: 'home' } : params)
  }

  return (
    <PageContainer>
      {isHomeHistory ? (
        <div className="button-row">
          <SecondaryButton type="button" onClick={() => void navigate('/')}>
            Back
          </SecondaryButton>
        </div>
      ) : (
        <SectionHeader
          title="History"
          action={
            <div className="button-row">
              {selectedWorkout || state.selectedRun ? (
                <SecondaryButton
                  type="button"
                  onClick={() => setSearchParams({})}
                >
                  All history
                </SecondaryButton>
              ) : null}
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
      )}
      {editError ? <ValidationMessage message={editError} /> : null}
      <div className="history-layout">
        {!selectedWorkout && !state.selectedRun ? (
          <Card title={isHomeHistory ? undefined : 'History'}>
            <div className="history-list">
              {listHistoryItems(state.workouts, state.runs).map((item) =>
                item.type === 'run' ? (
                  <button
                    aria-label={`${formatHistoryDate(item.run.localDate)} Run`}
                    key={item.run.id}
                    onClick={() => setHistoryParams({ run: item.run.id })}
                    type="button"
                  >
                    <strong>{formatHistoryDate(item.run.localDate)}</strong>
                    <span>Run</span>
                  </button>
                ) : (
                  <button
                    aria-label={`${formatHistoryDate(
                      item.workout.localDate,
                    )} ${item.workout.name}`}
                    key={item.workout.id}
                    onClick={() =>
                      setHistoryParams({ workout: item.workout.id })
                    }
                    type="button"
                  >
                    <strong>{formatHistoryDate(item.workout.localDate)}</strong>
                    <span>{item.workout.name}</span>
                  </button>
                ),
              )}
            </div>
          </Card>
        ) : null}

        {state.selectedRun ? (
          <RunHistoryDetail structure={state.selectedRun} />
        ) : null}

        {selectedWorkout ? (
          <Card title={selectedWorkout.name}>
            {summary ? (
              <div className="summary-grid">
                <span>
                  <strong>
                    {formatHistoryDetailDate(selectedWorkout.localDate)}
                  </strong>
                  <small>Date completed</small>
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
              </div>
            ) : null}

            {summary?.skipped.length ? (
              <p className="muted">
                Skipped:{' '}
                {summary.skipped
                  .map((exercise) => exercise.exerciseSnapshot.exerciseName)
                  .join(', ')}
              </p>
            ) : null}

            <div className="history-exercise-accordion-list">
              {state.exercises.map((exercise) => (
                <HistoryExerciseAccordion
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
      </div>
    </PageContainer>
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
  const [pickerOpen, setPickerOpen] = useState(false)
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

  useSubpageBackGesture(pickerOpen, () => setPickerOpen(false))

  const options = listStrengthExerciseOptions(points)
  const selectedExercise = selectedExerciseId || options[0]?.exerciseId || ''
  const selectedExerciseName =
    options.find((option) => option.exerciseId === selectedExercise)
      ?.exerciseName ?? ''
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
      : (model.points.find((point) => point.id === selectedPointId) ?? null)

  if (pickerOpen) {
    return (
      <StrengthExercisePicker
        options={options}
        selectedExerciseId={selectedExercise}
        onBack={() => setPickerOpen(false)}
        onSelect={(exerciseId) => {
          setSelectedExerciseId(exerciseId)
          setSelectedPointId(null)
          setPickerOpen(false)
        }}
      />
    )
  }

  return (
    <PageContainer>
      <SectionHeader
        title="Strength graphs"
        action={
          <IconButton
            aria-label="Back to history"
            type="button"
            onClick={onShowWorkouts}
          >
            <ChevronLeft aria-hidden="true" size={20} />
          </IconButton>
        }
      />
      <Card title="Estimated 1 Rep Max">
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
              <button
                id="strength-exercise"
                className="exercise-select-trigger"
                type="button"
                onClick={() => setPickerOpen(true)}
              >
                <span>{selectedExerciseName || 'Select exercise'}</span>
                <ChevronDown aria-hidden="true" size={18} />
              </button>
            </FormField>
            <StrengthChart
              model={model}
              onSelect={(point) =>
                setSelectedPointId((current) =>
                  current === point.id ? null : point.id,
                )
              }
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

function StrengthExercisePicker({
  options,
  selectedExerciseId,
  onBack,
  onSelect,
}: {
  options: StrengthExerciseOption[]
  selectedExerciseId: string
  onBack: () => void
  onSelect: (exerciseId: string) => void
}) {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filtered = normalizedQuery
    ? options.filter((option) =>
        option.exerciseName.toLocaleLowerCase().includes(normalizedQuery),
      )
    : options

  return (
    <PageContainer>
      <div className="exercise-picker">
        <div className="exercise-picker-sticky">
          <div className="exercise-picker-bar">
            <IconButton aria-label="Back to strength graphs" onClick={onBack}>
              <ArrowLeft aria-hidden="true" size={20} />
            </IconButton>
            <div className="input-icon-row">
              <Search aria-hidden="true" size={18} />
              <input
                aria-label="Search exercises"
                autoFocus
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search exercises"
                type="search"
                value={query}
              />
            </div>
          </div>
        </div>
        <div className="exercise-picker-body">
          {filtered.length ? (
            <div className="exercise-picker-list">
              {filtered.map((option) => (
                <button
                  aria-pressed={option.exerciseId === selectedExerciseId}
                  className="exercise-picker-row"
                  key={option.exerciseId}
                  onClick={() => onSelect(option.exerciseId)}
                  type="button"
                >
                  <strong>{option.exerciseName}</strong>
                  <small>
                    {option.pointCount}{' '}
                    {option.pointCount === 1 ? 'session' : 'sessions'} · best{' '}
                    {formatEstimatedMax(option.allTimeBest.estimatedOneRepMax)}{' '}
                    lb
                  </small>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No exercises found"
              message="Only exercises with recorded weighted sets appear here."
            />
          )}
        </div>
      </div>
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
  const [tooltipId, setTooltipId] = useFadingTooltip()
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
  const yTicks = buildValueAxisTicks(
    model.chartMin,
    model.chartMax,
    (value) => `${formatEstimatedMax(value)}`,
  )
  const xTicks = buildDateAxisTicks(model.points)
  const tooltipPoint = tooltipId
    ? (model.points.find((point) => point.id === tooltipId) ?? null)
    : null

  return (
    <div className="bodyweight-chart-panel">
      <p className="visually-hidden" aria-live="polite">
        {model.summary}
      </p>
      <div className="bodyweight-chart" aria-label="Estimated 1 Rep Max graph">
        <span className="chart-axis-label chart-axis-label-x">Date</span>
        <span className="chart-axis-label chart-axis-label-y">
          Estimated 1RM (lb)
        </span>
        <ChartAxisTicks yTicks={yTicks} xTicks={xTicks} />
        <svg
          aria-hidden="true"
          focusable="false"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <line x1="0" x2="100" y1="100" y2="100" />
          {model.status === 'ready' ? <path d={path} /> : null}
          {model.points.map((point) => (
            <circle cx={point.x} cy={point.y} key={point.id} r="2.6" />
          ))}
        </svg>
        {model.points.map((point) => (
          <button
            aria-label={`${point.localDate} ${formatEstimatedMax(
              point.estimatedOneRepMax,
            )} lb estimated one-repetition maximum`}
            aria-pressed={selectedPoint?.id === point.id}
            className="bodyweight-point-button"
            key={point.id}
            onClick={() => {
              onSelect(point)
              setTooltipId(point.id)
            }}
            style={{
              left: `${point.x}%`,
              top: `${point.y}%`,
            }}
            type="button"
          />
        ))}
        {tooltipPoint ? (
          <span
            aria-hidden="true"
            className={`bodyweight-point-value chart-point-tooltip${
              tooltipPoint.y < 18 ? ' chart-point-tooltip-below' : ''
            }`}
            key={tooltipPoint.id}
            style={{
              left: `${tooltipPoint.x}%`,
              top: `${tooltipPoint.y}%`,
            }}
          >
            {formatEstimatedMax(tooltipPoint.estimatedOneRepMax)} lb
          </span>
        ) : null}
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
  const [tooltipId, setTooltipId] = useFadingTooltip()
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
  const yTicks = buildValueAxisTicks(model.chartMin, model.chartMax, (value) =>
    formatWeight(value),
  )
  const xTicks = buildDateAxisTicks(
    model.points.map((point) => ({
      x: point.x,
      localDate: point.entry.localDate,
    })),
  )
  const tooltipPoint = tooltipId
    ? (model.points.find((point) => point.entry.id === tooltipId) ?? null)
    : null

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
        <ChartAxisTicks yTicks={yTicks} xTicks={xTicks} />
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
            onClick={() => {
              onSelect(point.entry)
              setTooltipId(point.entry.id)
            }}
            style={{
              left: `${point.x}%`,
              top: `${point.y}%`,
            }}
            type="button"
          />
        ))}
        {tooltipPoint ? (
          <span
            aria-hidden="true"
            className={`bodyweight-point-value chart-point-tooltip${
              tooltipPoint.y < 18 ? ' chart-point-tooltip-below' : ''
            }`}
            key={tooltipPoint.entry.id}
            style={{
              left: `${tooltipPoint.x}%`,
              top: `${tooltipPoint.y}%`,
            }}
          >
            {formatWeight(tooltipPoint.entry.weight)} {tooltipPoint.entry.unit}
          </span>
        ) : null}
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

function HistoryExerciseAccordion({
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
  const [expanded, setExpanded] = useState(false)
  const panelId = `history-exercise-panel-${exercise.id}`

  return (
    <article
      className={
        exercise.skipped
          ? 'history-exercise-accordion skipped'
          : 'history-exercise-accordion'
      }
    >
      <button
        aria-controls={panelId}
        aria-expanded={expanded}
        className="history-exercise-trigger"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <span>
          <strong>{exercise.exerciseSnapshot.exerciseName}</strong>
          <small>{exerciseHistorySummary(exercise, sets)}</small>
        </span>
        <ChevronDown aria-hidden="true" className="accordion-chevron" />
      </button>

      {expanded ? (
        <div className="history-exercise-panel" id={panelId}>
          <p className="muted">
            {exercise.skipped ? 'Skipped' : 'Performed'} -{' '}
            {exercise.exerciseSnapshot.trackingMethodId}
          </p>
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
        </div>
      ) : null}
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

function listHistoryItems(workouts: WorkoutHistoryEntry[], runs: Run[]) {
  return [
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
}

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp))
}

// Shows a point's value tooltip on tap/click and clears it automatically after
// 5 seconds so it never lingers over the rest of the chart UI.
function useFadingTooltip() {
  const [tooltipId, setTooltipId] = useState<string | null>(null)
  useEffect(() => {
    if (!tooltipId) {
      return
    }
    const timer = window.setTimeout(() => setTooltipId(null), 5000)
    return () => window.clearTimeout(timer)
  }, [tooltipId])
  return [tooltipId, setTooltipId] as const
}

type ChartAxisTick = { key: string; position: number; label: string }

// Evenly spaced Y-axis interval markers running from chartMax (top) to chartMin
// (bottom), matching the value-to-position mapping the plotted points use.
function buildValueAxisTicks(
  chartMin: number,
  chartMax: number,
  format: (value: number) => string,
): ChartAxisTick[] {
  const span = chartMax - chartMin
  if (!(span > 0)) {
    return [{ key: 'mid', position: 50, label: format(chartMin) }]
  }
  const steps = 4
  return Array.from({ length: steps + 1 }, (_, index) => {
    const position = (index / steps) * 100
    const value = chartMax - (index / steps) * span
    return { key: String(index), position, label: format(value) }
  })
}

// X-axis date markers placed at the first, middle, and last data points so the
// time progression is readable without crowding the axis.
function buildDateAxisTicks(
  points: Array<{ x: number; localDate: string }>,
): ChartAxisTick[] {
  if (!points.length) {
    return []
  }
  const lastIndex = points.length - 1
  const candidateIndices =
    points.length <= 2
      ? [0, lastIndex]
      : [0, Math.floor(lastIndex / 2), lastIndex]
  const seen = new Set<number>()
  const ticks: ChartAxisTick[] = []
  for (const index of candidateIndices) {
    if (seen.has(index)) {
      continue
    }
    seen.add(index)
    const point = points[index]
    ticks.push({
      key: String(index),
      position: point.x,
      label: formatShortLocalDate(point.localDate),
    })
  }
  return ticks
}

function formatShortLocalDate(localDate: string) {
  const [year, month, day] = localDate.split('-').map(Number)
  if (!year || !month || !day) {
    return localDate
  }
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function ChartAxisTicks({
  yTicks,
  xTicks,
}: {
  yTicks: ChartAxisTick[]
  xTicks: ChartAxisTick[]
}) {
  return (
    <>
      <div className="chart-axis-ticks chart-axis-ticks-y" aria-hidden="true">
        {yTicks.map((tick) => (
          <span key={tick.key} style={{ top: `${tick.position}%` }}>
            {tick.label}
          </span>
        ))}
      </div>
      <div className="chart-axis-ticks chart-axis-ticks-x" aria-hidden="true">
        {xTicks.map((tick) => (
          <span key={tick.key} style={{ left: `${tick.position}%` }}>
            {tick.label}
          </span>
        ))}
      </div>
    </>
  )
}

function formatHistoryDetailDate(localDate: string) {
  const [year, month, day] = localDate.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const monthName = new Intl.DateTimeFormat(undefined, {
    month: 'long',
  }).format(date)
  return `${monthName} ${day}${ordinalSuffix(day)}, ${year}`
}

function ordinalSuffix(day: number) {
  if (day >= 11 && day <= 13) {
    return 'th'
  }
  switch (day % 10) {
    case 1:
      return 'st'
    case 2:
      return 'nd'
    case 3:
      return 'rd'
    default:
      return 'th'
  }
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
