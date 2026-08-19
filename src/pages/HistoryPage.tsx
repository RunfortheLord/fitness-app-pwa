import {
  ArrowLeft,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  Search,
  Square,
} from 'lucide-react'
import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import {
  Card,
  EmptyState,
  FormField,
  IconButton,
  LoadingState,
  ModalConfirmationDialog,
  PageContainer,
  SegmentedControl,
  SecondaryButton,
  SectionHeader,
  StatusMessage,
} from '@components/ui'
import { CalorieHistoryChart } from '@components/CalorieHistoryChart'
import { DashboardContext } from '@components/dashboardContextValue'
import { useLanguage } from '@components/languageContextValue'
import { formatLocalDate } from '@domain/dates'
import { formatClockDuration as formatDuration } from '@domain/workoutTiming'
import { currentTrendWeight } from '@domain/bodyweightTrend'
import {
  createBodyweightChartModel,
  filterBodyweightEntriesForRange,
  type BodyweightRange,
} from '@domain/bodyweightProgress'
import {
  createStrengthGraphModel,
  createStrengthGraphPoints,
  filterStrengthPointsForRange,
  formatEstimatedMax,
  formatEstimatedWeight,
  formatTotalVolume,
  formatTotalVolumeNumber,
  listStrengthExerciseOptions,
  strengthEstimateLimitText,
  strengthVolumeDescriptionText,
  type StrengthExerciseOption,
  type StrengthGraphPoint,
  type StrengthMetric,
  type StrengthRange,
} from '@domain/strengthProgress'
import {
  formatWeight as formatWeightWithUnit,
  weightDisplayNumber,
  weightUnitSuffix,
} from '@domain/weightUnits'
import { useWeightUnit } from '@hooks/useWeightUnit'
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
import {
  calorieHistoryService,
  type CalorieHistoryRange,
  type DailyCalorieHistory,
} from '@services/calorieHistoryService'
import { runRepository, type RunStructure } from '@repositories/runRepository'
import { workoutRepository } from '@repositories/workoutRepository'
import { settingsRepository } from '@repositories/settingsRepository'
import {
  getCachedHistoryPageData,
  setCachedHistoryPageData,
  type HistoryPageState,
} from '@pages/historyPageCache'
import type {
  BodyweightEntry,
  Run,
  TrackingMetric,
  WorkoutHistoryEntry,
  WorkoutHistoryExercise,
  WorkoutHistorySet,
  HistorySortMode,
} from '@shared-types/app'

type HistorySelection = { type: 'workout' | 'run'; id: string } | null

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

const calorieRangeOptions: Array<{
  label: string
  value: CalorieHistoryRange
}> = [
  { label: '1W', value: '1w' },
  { label: '1M', value: '1m' },
  { label: '3M', value: '3m' },
]

export function HistoryPage() {
  const { t } = useLanguage()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [state, setState] = useState<HistoryPageState>(
    () => getCachedHistoryPageData() ?? { status: 'loading' },
  )
  const [revision, setRevision] = useState(0)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedHistory, setSelectedHistory] = useState<HistorySelection>(null)
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [historySortMode, setHistorySortMode] =
    useState<HistorySortMode>('recent')
  const [historyProgramId, setHistoryProgramId] = useState<string | null>(null)
  const historyScrollPositionRef = useRef<number | null>(null)

  useEffect(() => {
    let isCurrent = true
    void settingsRepository.ensureSettings().then((settings) => {
      if (!isCurrent) {
        return
      }
      setHistorySortMode(settings.historySortMode ?? 'recent')
      setHistoryProgramId(settings.historyProgramId ?? null)
    })
    return () => {
      isCurrent = false
    }
  }, [])

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
          const nextState = { status: 'empty' } as const
          setCachedHistoryPageData(nextState)
          setState(nextState)
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
        const nextState: HistoryPageState = {
          status: 'ready',
          workouts,
          runs,
          selected: selectedStructure?.workout ?? null,
          selectedRun,
          exercises: selectedStructure?.exercises ?? [],
          setsByExercise: selectedStructure?.setsByExercise ?? {},
        }
        if (!requestedId && !requestedRunId) {
          setCachedHistoryPageData(nextState)
        }
        setState(nextState)
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

  useLayoutEffect(() => {
    if (
      state.status !== 'ready' ||
      state.selected ||
      state.selectedRun ||
      searchParams.has('workout') ||
      searchParams.has('run') ||
      historyScrollPositionRef.current === null
    ) {
      return
    }
    const scrollTop = historyScrollPositionRef.current
    historyScrollPositionRef.current = null
    window.scrollTo({ top: scrollTop, left: 0, behavior: 'auto' })
  }, [searchParams, state])

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

  function saveHistoryPreference(
    sortMode: HistorySortMode,
    programId: string | null,
  ) {
    setHistorySortMode(sortMode)
    setHistoryProgramId(programId)
    void settingsRepository.saveHistoryPreference({ sortMode, programId })
  }

  function toggleSelectionMode() {
    setDeleteError(null)
    if (selectedHistory) {
      setDeleteConfirmationOpen(true)
      return
    }
    setSelectionMode((current) => {
      if (current) {
        setSelectedHistory(null)
      }
      return !current
    })
  }

  function selectHistoryEntry(nextSelection: Exclude<HistorySelection, null>) {
    setDeleteError(null)
    setSelectedHistory((current) =>
      current?.type === nextSelection.type && current.id === nextSelection.id
        ? null
        : nextSelection,
    )
  }

  async function deleteSelectedHistoryEntry() {
    if (!selectedHistory) {
      setDeleteConfirmationOpen(false)
      return
    }

    try {
      if (selectedHistory.type === 'workout') {
        await workoutRepository.deleteWorkoutHistory(selectedHistory.id)
      } else {
        await runRepository.deleteCompletedRun(selectedHistory.id)
      }
      setDeleteConfirmationOpen(false)
      setSelectedHistory(null)
      setSelectionMode(false)
      setDeleteError(null)
      reload()
    } catch (caught) {
      setDeleteConfirmationOpen(false)
      setDeleteError(
        caught instanceof Error ? caught.message : 'History could not delete.',
      )
    }
  }

  if (
    location.pathname.startsWith('/graphs') ||
    searchParams.get('view') === 'bodyweight'
  ) {
    return (
      <BodyweightProgressView
        onShowExerciseGraphs={() => {
          setSearchParams({ view: 'graphs' })
        }}
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
        <LoadingState label="Loading workout history" variant="cards" />
      </PageContainer>
    )
  }

  if (state.status === 'empty') {
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
        <Card>
          <EmptyState
            title="No completed activity"
            message="Completed workouts and runs will appear here."
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
  const showAllHomeHistory = () => {
    if (selectedWorkout || state.selectedRun) {
      setSearchParams({ source: 'home' })
      return
    }

    void navigate('/')
  }
  const setHistoryParams = (params: Record<string, string>) => {
    setSearchParams(isHomeHistory ? { ...params, source: 'home' } : params)
  }
  const openHistoryDetail = (params: Record<string, string>) => {
    historyScrollPositionRef.current = window.scrollY
    setHistoryParams(params)
  }
  const selectedItemLabel = selectedHistory
    ? historySelectionLabel(selectedHistory, state.workouts, state.runs)
    : 'this day'
  const programGroups = groupWorkoutHistoryByProgram(state.workouts)
  const selectedProgram = historyProgramId
    ? (programGroups.find((group) => group.id === historyProgramId) ?? null)
    : null

  return (
    <PageContainer>
      {isHomeHistory ? (
        <div className="button-row">
          <SecondaryButton type="button" onClick={showAllHomeHistory}>
            Back
          </SecondaryButton>
          {!selectedWorkout && !state.selectedRun ? (
            <SecondaryButton
              className={selectedHistory ? 'button-danger' : ''}
              type="button"
              onClick={toggleSelectionMode}
            >
              {selectedHistory ? 'Delete' : selectionMode ? 'Cancel' : 'Select'}
            </SecondaryButton>
          ) : null}
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
              {!selectedWorkout && !state.selectedRun ? (
                <SecondaryButton
                  className={selectedHistory ? 'button-danger' : ''}
                  type="button"
                  onClick={toggleSelectionMode}
                >
                  {selectedHistory
                    ? 'Delete'
                    : selectionMode
                      ? 'Cancel'
                      : 'Select'}
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
      {deleteError ? (
        <StatusMessage tone="warning">{deleteError}</StatusMessage>
      ) : null}
      {searchParams.get('changeSave') === 'failed' ? (
        <StatusMessage tone="warning">
          Workout saved, but live workout changes could not be saved to your
          program.
        </StatusMessage>
      ) : null}
      <div className="history-layout">
        {!selectedWorkout && !state.selectedRun ? (
          <section aria-label="History" className="history-card-section">
            {!isHomeHistory ? <h2>Completed activity</h2> : null}
            <SegmentedControl
              label="History sort"
              onChange={(value) =>
                saveHistoryPreference(
                  value === 'program' ? 'program' : 'recent',
                  historyProgramId,
                )
              }
              options={[
                { label: 'Most recent', value: 'recent' },
                { label: 'By program', value: 'program' },
              ]}
              value={historySortMode}
            />
            {historySortMode === 'program' && selectedProgram ? (
              <div className="history-program-heading">
                <SecondaryButton
                  type="button"
                  onClick={() => saveHistoryPreference('program', null)}
                >
                  All programs
                </SecondaryButton>
                <h3>{selectedProgram.name}</h3>
              </div>
            ) : null}
            <div className="history-list history-card-list">
              {historySortMode === 'program' && !selectedProgram
                ? programGroups.map((group) => (
                    <button
                      aria-label={`View ${group.name} history`}
                      className="history-item-card history-program-card"
                      key={group.id}
                      onClick={() => saveHistoryPreference('program', group.id)}
                      type="button"
                    >
                      <span className="history-item-main">
                        <strong>{group.name}</strong>
                        <span>
                          {group.workouts.length}{' '}
                          {group.workouts.length === 1 ? 'workout' : 'workouts'}
                        </span>
                      </span>
                      <small>
                        Latest {formatHistoryDate(group.workouts[0].localDate)}
                      </small>
                    </button>
                  ))
                : listHistoryItems(
                    selectedProgram?.workouts ?? state.workouts,
                    historySortMode === 'program' ? [] : state.runs,
                  ).map((item) =>
                    item.type === 'run' ? (
                      <button
                        aria-label={`${formatHistoryDate(item.run.localDate)} Run`}
                        aria-pressed={
                          selectionMode
                            ? selectedHistory?.type === 'run' &&
                              selectedHistory.id === item.run.id
                            : undefined
                        }
                        className={`history-item-card history-run-card${
                          selectionMode ? ' history-item-selectable' : ''
                        }`}
                        key={item.run.id}
                        onClick={() =>
                          selectionMode
                            ? selectHistoryEntry({
                                type: 'run',
                                id: item.run.id,
                              })
                            : openHistoryDetail({ run: item.run.id })
                        }
                        type="button"
                      >
                        <span>
                          <strong>
                            {formatHistoryDate(item.run.localDate)}
                          </strong>
                          <small>{formatRunType(item.run)}</small>
                        </span>
                        <span>
                          <strong>
                            {formatDistance(item.run.distanceMeters)}
                          </strong>
                          <small>
                            {formatRunDuration(item.run.elapsedSeconds)} ·{' '}
                            {formatPace(
                              item.run.averageMovingPaceSecondsPerMile,
                            )}
                          </small>
                        </span>
                        {selectionMode ? (
                          <span
                            aria-hidden="true"
                            className="history-selection-check"
                          >
                            {selectedHistory?.type === 'run' &&
                            selectedHistory.id === item.run.id
                              ? 'x'
                              : ''}
                          </span>
                        ) : null}
                      </button>
                    ) : (
                      <button
                        aria-label={`${formatHistoryDate(
                          item.workout.localDate,
                        )} ${item.workout.name}`}
                        aria-pressed={
                          selectionMode
                            ? selectedHistory?.type === 'workout' &&
                              selectedHistory.id === item.workout.id
                            : undefined
                        }
                        className={`history-item-card${
                          selectionMode ? ' history-item-selectable' : ''
                        }`}
                        key={item.workout.id}
                        onClick={() =>
                          selectionMode
                            ? selectHistoryEntry({
                                type: 'workout',
                                id: item.workout.id,
                              })
                            : openHistoryDetail({
                                workout: item.workout.id,
                              })
                        }
                        type="button"
                      >
                        <span className="history-item-main">
                          <strong>
                            {formatHistoryDate(item.workout.localDate)}
                          </strong>
                          <span>{item.workout.name}</span>
                        </span>
                        {selectionMode ? (
                          <span
                            aria-hidden="true"
                            className="history-selection-check"
                          >
                            {selectedHistory?.type === 'workout' &&
                            selectedHistory.id === item.workout.id
                              ? 'x'
                              : ''}
                          </span>
                        ) : null}
                      </button>
                    ),
                  )}
            </div>
          </section>
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
                  <small>{t('Date completed')}</small>
                </span>
                <span>
                  <strong>
                    {formatDuration(selectedWorkout.durationSeconds)}
                  </strong>
                  <small>{t('Duration')}</small>
                </span>
                <span>
                  <strong>{summary.exercisesCompleted}</strong>
                  <small>{t('Exercises')}</small>
                </span>
                <span>
                  <strong>{summary.setsCompleted}</strong>
                  <small>{t('Completed sets')}</small>
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
                  sets={state.setsByExercise[exercise.id] ?? []}
                />
              ))}
            </div>
          </Card>
        ) : null}
      </div>
      <ModalConfirmationDialog
        confirmLabel="Delete day"
        isOpen={deleteConfirmationOpen}
        onCancel={() => setDeleteConfirmationOpen(false)}
        onConfirm={deleteSelectedHistoryEntry}
        title="Delete day permanently?"
      >
        <p>Delete {selectedItemLabel} permanently? This cannot be undone.</p>
      </ModalConfirmationDialog>
    </PageContainer>
  )
}

function BodyweightProgressView({
  onShowExerciseGraphs,
  onShowWorkouts,
}: {
  onShowExerciseGraphs: () => void
  onShowWorkouts: () => void
}) {
  const { t } = useLanguage()
  const [range, setRange] = useState<BodyweightRange>('3m')
  const [graphCategory, setGraphCategory] = useState('bodyweight')
  const [entries, setEntries] = useState<BodyweightEntry[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const weightUnit = useWeightUnit()
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
  const model = createBodyweightChartModel(rangedEntries, weightUnit, entries)
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
        onChange={(value) => {
          if (value === 'exercises') {
            onShowExerciseGraphs()
            return
          }
          setGraphCategory(value)
        }}
        options={[
          { label: 'Body Weight', value: 'bodyweight' },
          { label: 'Exercises', value: 'exercises' },
          { label: 'Running', value: 'running' },
        ]}
        value={graphCategory}
      />
      {graphCategory === 'running' ? (
        <Card title="Running">
          <EmptyState
            title="No running graph selected"
            message="Completed runs remain available from History."
          />
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
              {t('Bodyweight progress could not load.')}
            </StatusMessage>
          ) : null}
          {status === 'ready' ? (
            <BodyweightChart
              model={model}
              trendWeight={currentTrendWeight(entries)}
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
  const [graphCategory, setGraphCategory] = useState<'strength' | 'calories'>(
    'strength',
  )
  const [strengthMetric, setStrengthMetric] =
    useState<StrengthMetric>('estimated_1rm')
  const [range, setRange] = useState<StrengthRange>('3m')
  const [calorieRange, setCalorieRange] = useState<CalorieHistoryRange>('1w')
  const [calorieHistory, setCalorieHistory] = useState<DailyCalorieHistory[]>(
    [],
  )
  const [calorieStatus, setCalorieStatus] = useState<
    'loading' | 'ready' | 'error'
  >('loading')
  const [points, setPoints] = useState<StrengthGraphPoint[]>([])
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const weightUnit = useWeightUnit()
  const today = formatLocalDate(new Date())

  useEffect(() => {
    if (graphCategory !== 'calories') {
      return
    }
    let isCurrent = true
    void calorieHistoryService
      .getHistory(today, calorieRange)
      .then((history) => {
        if (isCurrent) {
          setCalorieHistory(history)
          setCalorieStatus('ready')
        }
      })
      .catch(() => {
        if (isCurrent) {
          setCalorieStatus('error')
        }
      })
    return () => {
      isCurrent = false
    }
  }, [calorieRange, graphCategory, today])

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
        const latestExerciseId =
          [...nextPoints].sort(
            (left, right) =>
              right.completedAt.localeCompare(left.completedAt) ||
              right.localDate.localeCompare(left.localDate),
          )[0]?.exerciseId ?? ''
        setPoints(nextPoints)
        setSelectedExerciseId(
          (current) =>
            current || latestExerciseId || options[0]?.exerciseId || '',
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

  const options = listStrengthExerciseOptions(points, strengthMetric)
  const latestMetricExerciseId =
    [...points]
      .filter((point) =>
        options.some((option) => option.exerciseId === point.exerciseId),
      )
      .sort(
        (left, right) =>
          right.completedAt.localeCompare(left.completedAt) ||
          right.localDate.localeCompare(left.localDate),
      )[0]?.exerciseId ?? ''
  const selectedExercise = options.some(
    (option) => option.exerciseId === selectedExerciseId,
  )
    ? selectedExerciseId
    : latestMetricExerciseId || options[0]?.exerciseId || ''
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
  const model = createStrengthGraphModel(
    rangedPoints,
    weightUnit,
    strengthMetric,
  )
  const selectedPoint =
    model.status === 'empty'
      ? null
      : (model.points.find((point) => point.id === selectedPointId) ?? null)

  if (pickerOpen) {
    return (
      <StrengthExercisePicker
        metric={strengthMetric}
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
        title="Graphs"
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
      <SegmentedControl
        label="Graph category"
        onChange={(value) => {
          if (value === 'calories') {
            setCalorieStatus('loading')
          }
          setGraphCategory(value as 'strength' | 'calories')
        }}
        options={[
          { label: 'Strength', value: 'strength' },
          { label: 'Calories', value: 'calories' },
        ]}
        value={graphCategory}
      />
      {graphCategory === 'calories' ? (
        <Card title="Calories">
          <SegmentedControl
            label="Calorie graph range"
            onChange={(value) => {
              setCalorieStatus('loading')
              setCalorieRange(value as CalorieHistoryRange)
            }}
            options={calorieRangeOptions}
            value={calorieRange}
          />
          {calorieStatus === 'loading' ? (
            <LoadingState label="Loading calorie history" />
          ) : null}
          {calorieStatus === 'error' ? (
            <StatusMessage tone="warning">
              Calorie history could not load.
            </StatusMessage>
          ) : null}
          {calorieStatus === 'ready' ? (
            <CalorieHistoryChart history={calorieHistory} />
          ) : null}
        </Card>
      ) : null}
      {graphCategory === 'strength' ? (
        <Card title="Strength Progress">
          {status === 'loading' ? (
            <LoadingState label="Loading strength graphs" />
          ) : null}
          {status === 'error' ? (
            <StatusMessage tone="warning">
              Strength graphs could not load.
            </StatusMessage>
          ) : null}
          {status === 'ready' ? (
            <SegmentedControl
              label="Strength graph metric"
              onChange={(value) => {
                setStrengthMetric(value as StrengthMetric)
                setSelectedPointId(null)
              }}
              options={[
                { label: 'Estimated 1RM', value: 'estimated_1rm' },
                { label: 'Total volume', value: 'volume' },
              ]}
              value={strengthMetric}
            />
          ) : null}
          {status === 'ready' && options.length ? (
            <>
              <FormField id="strength-exercise" label="Exercise">
                <button
                  aria-label={`Select exercise: ${
                    selectedExerciseName || 'Select exercise'
                  }`}
                  id="strength-exercise"
                  className="exercise-select-trigger"
                  type="button"
                  onClick={() => setPickerOpen(true)}
                >
                  <Search aria-hidden="true" size={18} />
                  <span>{selectedExerciseName || 'Select exercise'}</span>
                </button>
              </FormField>
              <SegmentedControl
                label="Strength graph range"
                onChange={(value) => {
                  setRange(value as StrengthRange)
                  setSelectedPointId(null)
                }}
                options={strengthRangeOptions}
                value={range}
              />
              <StrengthChart
                model={model}
                onSelect={(point) =>
                  setSelectedPointId((current) =>
                    current === point.id ? null : point.id,
                  )
                }
                selectedPoint={selectedPoint}
              />
              <p className="muted">
                {strengthMetric === 'volume'
                  ? strengthVolumeDescriptionText()
                  : strengthEstimateLimitText()}
              </p>
            </>
          ) : null}
          {status === 'ready' && !options.length ? (
            <EmptyState
              title="No weighted exercise history"
              message={
                strengthMetric === 'volume'
                  ? 'Complete weighted-repetition workout sets to build total volume graphs.'
                  : 'Complete weighted-repetition workout sets to build estimated 1RM graphs.'
              }
            />
          ) : null}
        </Card>
      ) : null}
    </PageContainer>
  )
}

function StrengthExercisePicker({
  metric,
  options,
  selectedExerciseId,
  onBack,
  onSelect,
}: {
  metric: StrengthMetric
  options: StrengthExerciseOption[]
  selectedExerciseId: string
  onBack: () => void
  onSelect: (exerciseId: string) => void
}) {
  const [query, setQuery] = useState('')
  const weightUnit = useWeightUnit()
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filtered = normalizedQuery
    ? options.filter((option) =>
        option.exerciseName.toLocaleLowerCase().includes(normalizedQuery),
      )
    : options

  return (
    <PageContainer>
      <div className="exercise-picker subpage-enter">
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
                    {metric === 'volume'
                      ? formatTotalVolume(
                          option.allTimeBest.totalVolume,
                          weightUnit,
                        )
                      : formatEstimatedWeight(
                          option.allTimeBest.estimatedOneRepMax!,
                          weightUnit,
                        )}
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
  const weightUnit = useWeightUnit()
  const unitSuffix = weightUnitSuffix(weightUnit)
  const formatAxisWeight = (value: number) =>
    weightUnit === 'kg'
      ? weightDisplayNumber(value, 'kg', 'lifting')
      : formatEstimatedMax(value)
  if (model.status === 'empty') {
    return (
      <EmptyState
        title="No points in range"
        message="Choose a longer range or complete another weighted workout."
      />
    )
  }

  const isVolume = model.metric === 'volume'
  const path = model.points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${projectChartX(point.x)} ${projectChartY(point.y)}`,
    )
    .join(' ')
  const yTicks = projectAxisTicks(
    buildValueAxisTicks(model.chartMin, model.chartMax, (value) =>
      isVolume
        ? formatTotalVolumeNumber(value, weightUnit)
        : formatAxisWeight(value),
    ),
    projectChartY,
  )
  const xTicks = projectAxisTicks(
    buildDateAxisTicks(model.points),
    projectChartX,
  )
  const tooltipPoint = tooltipId
    ? (model.points.find((point) => point.id === tooltipId) ?? null)
    : null

  return (
    <div className="bodyweight-chart-panel">
      <p className="visually-hidden" aria-live="polite">
        {model.summary}
      </p>
      <div
        className="bodyweight-chart"
        aria-label={
          isVolume ? 'Total volume graph' : 'Estimated 1 Rep Max graph'
        }
      >
        <span className="chart-axis-label chart-axis-label-x">Date</span>
        <span className="chart-axis-label chart-axis-label-y">
          {isVolume ? 'Total volume' : 'Estimated 1RM'} ({unitSuffix})
        </span>
        <ChartAxisTicks yTicks={yTicks} xTicks={xTicks} />
        <svg
          aria-hidden="true"
          focusable="false"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <line
            x1={projectChartX(0)}
            x2={projectChartX(100)}
            y1={CHART_BASELINE_Y}
            y2={CHART_BASELINE_Y}
          />
          {model.status === 'ready' ? <path d={path} /> : null}
          {model.points.map((point) => (
            <circle
              cx={projectChartX(point.x)}
              cy={projectChartY(point.y)}
              key={point.id}
              r="1.3"
            />
          ))}
        </svg>
        {model.points.map((point) => (
          <button
            aria-label={
              isVolume
                ? `${point.localDate} ${formatTotalVolume(
                    point.totalVolume,
                    weightUnit,
                  )} total volume`
                : `${point.localDate} ${formatEstimatedWeight(
                    point.estimatedOneRepMax!,
                    weightUnit,
                  )} estimated one-repetition maximum`
            }
            aria-pressed={selectedPoint?.id === point.id}
            className="bodyweight-point-button"
            key={point.id}
            onClick={() => {
              onSelect(point)
              setTooltipId(point.id)
            }}
            style={{
              left: `${projectChartX(point.x)}%`,
              top: `${projectChartY(point.y)}%`,
            }}
            type="button"
          />
        ))}
        {tooltipPoint ? (
          <span
            aria-hidden="true"
            className={`bodyweight-point-value chart-point-tooltip${
              projectChartY(tooltipPoint.y) < 18
                ? ' chart-point-tooltip-below'
                : ''
            }`}
            key={tooltipPoint.id}
            style={{
              left: `${projectChartX(tooltipPoint.x)}%`,
              top: `${projectChartY(tooltipPoint.y)}%`,
            }}
          >
            {isVolume
              ? formatTotalVolume(tooltipPoint.totalVolume, weightUnit)
              : formatEstimatedWeight(
                  tooltipPoint.estimatedOneRepMax!,
                  weightUnit,
                )}
          </span>
        ) : null}
      </div>
      <p className="muted">{model.summary}</p>
      {model.status === 'single' ? (
        <StatusMessage>
          One {isVolume ? 'total volume' : 'estimated 1RM'} point is saved. Add
          another workout to show a line.
        </StatusMessage>
      ) : null}
      {selectedPoint ? (
        <dl className="history-detail-list bodyweight-detail">
          <div>
            <dt>Date</dt>
            <dd>{selectedPoint.localDate}</dd>
          </div>
          {isVolume ? (
            <>
              <div>
                <dt>Completed sets</dt>
                <dd>{selectedPoint.completedSetCount}</dd>
              </div>
              <div>
                <dt>Total volume</dt>
                <dd>
                  {formatTotalVolume(selectedPoint.totalVolume, weightUnit)}
                </dd>
              </div>
            </>
          ) : (
            <>
              <div>
                <dt>Completed set</dt>
                <dd>
                  {formatEstimatedWeight(selectedPoint.weight, weightUnit)} x{' '}
                  {selectedPoint.repetitions}
                </dd>
              </div>
              <div>
                <dt>Estimated 1RM</dt>
                <dd>
                  {formatEstimatedWeight(
                    selectedPoint.estimatedOneRepMax!,
                    weightUnit,
                  )}
                </dd>
              </div>
            </>
          )}
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
          <strong>{formatRunType(run)}</strong>
          <small>Tracking</small>
        </span>
        {run.trackingMode === 'treadmill' ? (
          <span>
            <strong>{run.treadmillStepCount ?? 0}</strong>
            <small>Steps sensed</small>
          </span>
        ) : null}
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
      {run.notes ? <p>{run.notes}</p> : null}
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
  trendWeight,
  onSelect,
  selectedEntry,
}: {
  model: ReturnType<typeof createBodyweightChartModel>
  trendWeight: number | null
  onSelect: (entry: BodyweightEntry) => void
  selectedEntry: BodyweightEntry | null
}) {
  const { t } = useLanguage()
  const [tooltipId, setTooltipId] = useFadingTooltip()
  const weightUnit = useWeightUnit()
  const unitSuffix = weightUnitSuffix(weightUnit)
  if (model.status === 'empty') {
    return (
      <EmptyState
        title="No bodyweight data"
        message="Log bodyweight from Home to build a progress graph."
      />
    )
  }

  const measurementPath = model.points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${projectChartX(point.x)} ${projectChartY(point.y)}`,
    )
    .join(' ')
  const trendPath = model.trendPoints
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${projectChartX(point.x)} ${projectChartY(point.y)}`,
    )
    .join(' ')
  const latest = model.entries.at(-1) ?? model.entries[0]
  const yTicks = projectAxisTicks(
    buildValueAxisTicks(model.chartMin, model.chartMax, (value) =>
      weightDisplayNumber(value, weightUnit, 'bodyweight'),
    ),
    projectChartY,
  )
  const xTicks = projectAxisTicks(
    buildDateAxisTicks(
      model.points.map((point) => ({
        x: point.x,
        localDate: point.entry.localDate,
      })),
    ),
    projectChartX,
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
      <div className="bodyweight-chart-summary" aria-label={t('Graph summary')}>
        {trendWeight !== null ? (
          <span className="bodyweight-chart-summary-primary">
            <strong>
              {formatWeightWithUnit(trendWeight, weightUnit, 'bodyweight')}
            </strong>
            <small>{t('Trend weight')}</small>
          </span>
        ) : null}
        <span>
          <strong>
            {formatWeightWithUnit(latest.weight, weightUnit, 'bodyweight')}
          </strong>
          <small>
            {t('Last recorded')} - {latest.localDate}
          </small>
        </span>
      </div>
      {model.trendPoints.length ? (
        <div className="bodyweight-chart-legend">
          <span className="bodyweight-measurement-legend">
            {t('Bodyweight')}
          </span>
          <span className="bodyweight-trend-legend">{t('Trend weight')}</span>
        </div>
      ) : null}
      <div className="bodyweight-chart" aria-label={t('Bodyweight graph')}>
        <span className="chart-axis-label chart-axis-label-x">{t('Date')}</span>
        <span className="chart-axis-label chart-axis-label-y">
          {t('Bodyweight')} ({unitSuffix})
        </span>
        <ChartAxisTicks yTicks={yTicks} xTicks={xTicks} />
        <svg
          aria-hidden="true"
          focusable="false"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <line
            x1={projectChartX(0)}
            x2={projectChartX(100)}
            y1={CHART_BASELINE_Y}
            y2={CHART_BASELINE_Y}
          />
          {model.status === 'ready' ? (
            <path className="bodyweight-measurement-line" d={measurementPath} />
          ) : null}
          {model.trendPoints.length ? (
            <path className="bodyweight-trend-line" d={trendPath} />
          ) : null}
          {model.points.map((point) => (
            <circle
              cx={projectChartX(point.x)}
              cy={projectChartY(point.y)}
              key={point.entry.id}
              r="0.9"
            />
          ))}
        </svg>
        {model.points.map((point) => (
          <button
            aria-label={`${point.entry.localDate} ${formatWeightWithUnit(
              point.entry.weight,
              weightUnit,
              'bodyweight',
            )}`}
            className="bodyweight-point-button"
            key={point.entry.id}
            onClick={() => {
              onSelect(point.entry)
              setTooltipId(point.entry.id)
            }}
            style={{
              left: `${projectChartX(point.x)}%`,
              top: `${projectChartY(point.y)}%`,
            }}
            type="button"
          />
        ))}
        {tooltipPoint ? (
          <span
            aria-hidden="true"
            className={`bodyweight-point-value chart-point-tooltip${
              projectChartY(tooltipPoint.y) < 18
                ? ' chart-point-tooltip-below'
                : ''
            }`}
            key={tooltipPoint.entry.id}
            style={{
              left: `${projectChartX(tooltipPoint.x)}%`,
              top: `${projectChartY(tooltipPoint.y)}%`,
            }}
          >
            {formatWeightWithUnit(
              tooltipPoint.entry.weight,
              weightUnit,
              'bodyweight',
            )}
          </span>
        ) : null}
      </div>
      {model.summary.status !== 'empty' ? (
        <p className="muted">{t(model.summary.text)}</p>
      ) : null}
      {model.status === 'single' ? (
        <StatusMessage>
          {t(
            'One bodyweight entry is saved. Add another entry to show a line.',
          )}
        </StatusMessage>
      ) : null}
      {selectedEntry ? (
        <dl className="history-detail-list bodyweight-detail">
          <div>
            <dt>{t('Selected')}</dt>
            <dd>
              {formatWeightWithUnit(
                selectedEntry.weight,
                weightUnit,
                'bodyweight',
              )}
            </dd>
          </div>
          <div>
            <dt>{t('Local date')}</dt>
            <dd>{selectedEntry.localDate}</dd>
          </div>
          <div>
            <dt>{t('Timestamp')}</dt>
            <dd>{formatTimestamp(selectedEntry.updatedAt)}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  )
}

function HistoryExerciseAccordion({
  exercise,
  sets,
}: {
  exercise: WorkoutHistoryExercise
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
          {exercise.skipped ? <p className="muted">Skipped</p> : null}

          <div className="set-list">
            {sets.length ? (
              sets.map((set) => (
                <HistorySetRow key={set.id} metrics={metrics} set={set} />
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
  set,
}: {
  metrics: TrackingMetric[]
  set: WorkoutHistorySet
}) {
  const weightUnit = useWeightUnit()
  return (
    <div className="set-row history-set-row">
      <div className="set-number">
        <strong>Set {set.setNumber}</strong>
      </div>
      {metrics.map((metric) => {
        const isWeightMetric = metric.unit === 'lb'
        const storedValue = set.metricValues[metric.key]
        return (
          <span className="history-readonly-metric" key={metric.key}>
            <span>{metric.label}</span>
            <strong>
              {typeof storedValue === 'number'
                ? isWeightMetric
                  ? formatWeightWithUnit(storedValue, weightUnit, 'lifting')
                  : formatMetricInput(storedValue)
                : '-'}
            </strong>
          </span>
        )
      })}
      {usesRir(metrics) ? (
        <span className="history-readonly-metric">
          <span>RIR</span>
          <strong>{set.rir ?? '-'}</strong>
        </span>
      ) : null}
      <span
        aria-label={`Set ${set.setNumber} ${
          set.completed ? 'complete' : 'incomplete'
        }`}
        className={`history-readonly-status ${
          set.completed ? 'completed' : 'incomplete'
        }`}
        role="img"
      >
        {set.completed ? (
          <CheckSquare aria-hidden="true" size={20} strokeWidth={2.4} />
        ) : (
          <Square aria-hidden="true" size={20} strokeWidth={2.4} />
        )}
      </span>
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

function groupWorkoutHistoryByProgram(workouts: WorkoutHistoryEntry[]) {
  const groups = new Map<
    string,
    { id: string; name: string; workouts: WorkoutHistoryEntry[] }
  >()
  for (const workout of workouts) {
    const id =
      workout.sourceTemplateId ??
      workout.sourceActiveCycleId ??
      `program-name:${workout.workoutSnapshot.activeCycleName ?? 'other'}`
    const name =
      workout.workoutSnapshot.activeCycleName ??
      workout.workoutSnapshot.templateName ??
      'Other workouts'
    const existing = groups.get(id)
    if (existing) {
      existing.workouts.push(workout)
    } else {
      groups.set(id, { id, name, workouts: [workout] })
    }
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      workouts: [...group.workouts].sort((left, right) =>
        right.completedAt.localeCompare(left.completedAt),
      ),
    }))
    .sort((left, right) =>
      right.workouts[0].completedAt.localeCompare(left.workouts[0].completedAt),
    )
}

function formatRunType(run: Run) {
  if (run.trackingMode === 'treadmill') {
    return 'Treadmill run'
  }
  if (run.trackingMode === 'manual') {
    return 'Manual run'
  }
  return 'Outdoor GPS run'
}

function historySelectionLabel(
  selection: Exclude<HistorySelection, null>,
  workouts: WorkoutHistoryEntry[],
  runs: Run[],
) {
  if (selection.type === 'run') {
    const run = runs.find((candidate) => candidate.id === selection.id)
    return run ? `${formatHistoryDate(run.localDate)} run` : 'this day'
  }

  const workout = workouts.find((candidate) => candidate.id === selection.id)
  return workout
    ? `${formatHistoryDate(workout.localDate)} ${workout.name}`
    : 'this day'
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

// Reserve a margin (in 0-100 chart units) around the plotted data so points and
// the trend line never sit on top of the axis baseline or the chart border, and
// so the first/last date labels clear the y-axis value column. Model coordinates
// arrive as a raw 0-100 range; these helpers remap them into the inset band that
// every renderer (line, points, tap targets, tooltips, axis ticks) shares.
const CHART_PLOT_INSET = { top: 8, bottom: 8, left: 20, right: 5 }

// The axis baseline sits below the lowest plottable point (at the bottom inset
// edge, ~92) so chart-minimum points float just above it instead of on it.
const CHART_BASELINE_Y = 96

function projectChartX(x: number): number {
  const span = 100 - CHART_PLOT_INSET.left - CHART_PLOT_INSET.right
  return CHART_PLOT_INSET.left + (x / 100) * span
}

function projectChartY(y: number): number {
  const span = 100 - CHART_PLOT_INSET.top - CHART_PLOT_INSET.bottom
  return CHART_PLOT_INSET.top + (y / 100) * span
}

function projectAxisTicks(
  ticks: ChartAxisTick[],
  project: (position: number) => number,
): ChartAxisTick[] {
  return ticks.map((tick) => ({ ...tick, position: project(tick.position) }))
}

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
        {xTicks.map((tick, index) => {
          const edgeClass =
            index === 0
              ? ' chart-axis-tick-first'
              : index === xTicks.length - 1
                ? ' chart-axis-tick-last'
                : ''
          return (
            <span
              className={`chart-axis-tick${edgeClass}`}
              key={tick.key}
              style={{ left: `${tick.position}%` }}
            >
              {tick.label}
            </span>
          )
        })}
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

function formatMetricInput(value: WorkoutHistorySet['metricValues'][string]) {
  return typeof value === 'number' ? String(value) : ''
}

function usesRir(metrics: TrackingMetric[]) {
  return metrics.some((metric) =>
    ['weight', 'reps', 'assistedWeight'].includes(metric.key),
  )
}
