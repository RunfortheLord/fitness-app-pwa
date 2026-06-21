import { Activity, ChevronDown, LineChart, Scale, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  Card,
  DateSelector,
  EmptyState,
  LoadingState,
  MetricCard,
  PageContainer,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  StatusMessage,
} from '@components/ui'
import {
  addLocalDays,
  formatLocalDate,
  formatSelectedDateLabel,
  type LocalDateString,
} from '@domain/dates'
import {
  formatBodyweightChange,
  formatWeight,
  type BodyweightTrendSummary,
} from '@domain/bodyweightProgress'
import {
  exerciseHistorySummary,
  formatHistoryDate,
  formatHistoryDuration,
  formatHistorySetMetric,
  historyMetricsForExercise,
  summarizeHistoryWorkout,
  workoutHistoryType,
  type WorkoutHistoryStructure,
} from '@domain/historyDisplay'
import { useDashboardContext } from '@hooks/useDashboardContext'
import { workoutRepository } from '@repositories/workoutRepository'
import {
  dashboardService,
  type DashboardData,
} from '@services/dashboardService'
import type { WorkoutHistoryEntry } from '@shared-types/app'

type DashboardLoadState =
  | { status: 'loading'; selectedDate: null }
  | { status: 'error'; selectedDate: LocalDateString }
  | {
      status: 'ready'
      selectedDate: LocalDateString
      dashboard: DashboardData
    }

export function HomePage() {
  const {
    dashboardRevision,
    openBodyweightSheet,
    selectedDate,
    setSelectedDate,
  } = useDashboardContext()
  const navigate = useNavigate()
  const today = formatLocalDate(new Date())
  const [dashboardState, setDashboardState] = useState<DashboardLoadState>({
    status: 'loading',
    selectedDate: null,
  })
  const [expandedWorkoutId, setExpandedWorkoutId] = useState<string | null>(
    null,
  )
  const [expandedStructure, setExpandedStructure] =
    useState<WorkoutHistoryStructure | null>(null)

  useEffect(() => {
    let isCurrent = true

    void dashboardService
      .getDashboardData(selectedDate)
      .then((dashboard) => {
        if (!isCurrent) {
          return
        }

        setDashboardState({
          status: 'ready',
          selectedDate,
          dashboard,
        })
        setExpandedWorkoutId(null)
        setExpandedStructure(null)
      })
      .catch(() => {
        if (!isCurrent) {
          return
        }

        setDashboardState({
          status: 'error',
          selectedDate,
        })
      })

    return () => {
      isCurrent = false
    }
  }, [dashboardRevision, selectedDate])

  const dashboard =
    dashboardState.status === 'ready' &&
    dashboardState.selectedDate === selectedDate
      ? dashboardState.dashboard
      : undefined
  const isDashboardLoading = !dashboard

  const caloriesConsumed = Math.round(dashboard?.nutrition.totals.calories ?? 0)
  const calorieTarget = Math.round(dashboard?.nutrition.targets.calories ?? 0)
  const caloriesRemaining = Math.round(
    dashboard?.nutrition.remainingCalories ?? 0,
  )

  return (
    <PageContainer>
      <DateSelector
        dateLabel={formatSelectedDateLabel(selectedDate)}
        onNext={() => setSelectedDate(addLocalDays(selectedDate, 1))}
        onPrevious={() => setSelectedDate(addLocalDays(selectedDate, -1))}
        onToday={() => setSelectedDate(today)}
      />

      {isDashboardLoading ? <LoadingState label="Loading dashboard" /> : null}
      {dashboard ? (
        <div
          aria-label="Dashboard ready"
          className="visually-hidden"
          role="status"
        >
          Dashboard ready
        </div>
      ) : null}
      {dashboardState.status === 'error' ? (
        <StatusMessage tone="warning">
          Dashboard data could not be loaded.
        </StatusMessage>
      ) : null}

      <section className="metric-grid" aria-label="Daily summary">
        <MetricCard
          label="Calories consumed"
          value={`${caloriesConsumed}`}
          detail={`${calorieTarget} kcal target`}
        />
        <MetricCard
          label="Calories remaining"
          value={`${caloriesRemaining}`}
          detail={
            calorieTarget > 0 ? 'Based on current target' : 'Target not set'
          }
        />
      </section>

      <Card title="Nutrition">
        <div className="macro-progress-list">
          <MacroProgress
            label="Protein"
            value={dashboard?.nutrition.totals.proteinGrams ?? 0}
            target={dashboard?.nutrition.targets.proteinGrams ?? 0}
          />
          <MacroProgress
            label="Carbohydrates"
            value={dashboard?.nutrition.totals.carbohydrateGrams ?? 0}
            target={dashboard?.nutrition.targets.carbohydrateGrams ?? 0}
          />
          <MacroProgress
            label="Fat"
            value={dashboard?.nutrition.totals.fatGrams ?? 0}
            target={dashboard?.nutrition.targets.fatGrams ?? 0}
          />
        </div>
        {caloriesConsumed === 0 ? (
          <EmptyState
            title="No foods logged"
            message="Daily totals are ready for manual nutrition logs."
            action={
              <SecondaryButton
                type="button"
                onClick={() => void navigate('/nutrition?logFood=1')}
              >
                Log food
              </SecondaryButton>
            }
          />
        ) : null}
      </Card>

      <Card title="Bodyweight">
        <div className="card-row">
          <span className="quick-action-icon">
            <Scale aria-hidden="true" size={20} />
          </span>
          <div>
            {dashboard?.currentBodyweight ? (
              <>
                <p className="metric-value metric-value-small">
                  {formatWeight(dashboard.currentBodyweight.weight)}{' '}
                  {dashboard.currentBodyweight.unit}
                </p>
                <p className="muted">
                  Current from {dashboard.currentBodyweight.localDate}
                </p>
              </>
            ) : (
              <>
                <p className="metric-value metric-value-small">No entry</p>
                <p className="muted">Log bodyweight to start a trend.</p>
              </>
            )}
          </div>
        </div>
        {dashboard?.bodyweight ? (
          <p className="muted">
            Selected date: {formatWeight(dashboard.bodyweight.weight)}{' '}
            {dashboard.bodyweight.unit}
          </p>
        ) : (
          <p className="muted">Selected date: no bodyweight entry</p>
        )}
        <HomeBodyweightTrend trend={dashboard?.bodyweightTrend} />
        <div className="button-row">
          <PrimaryButton
            type="button"
            onClick={() => openBodyweightSheet(selectedDate)}
          >
            Log bodyweight
          </PrimaryButton>
          {dashboard?.bodyweight ? (
            <SecondaryButton
              type="button"
              onClick={() =>
                openBodyweightSheet({
                  entryId: dashboard.bodyweight?.id,
                  localDate: selectedDate,
                })
              }
            >
              Edit latest
            </SecondaryButton>
          ) : null}
          <SecondaryButton
            type="button"
            onClick={() => void navigate('/history?view=bodyweight')}
          >
            View graph
          </SecondaryButton>
        </div>
      </Card>

      {dashboard?.activeWorkout ? (
        <Card title="Resume workout">
          <p className="metric-value metric-value-small">
            {dashboard.activeWorkout.name}
          </p>
          <p className="muted">Started {dashboard.activeWorkout.localDate}</p>
          <div className="button-row">
            <PrimaryButton
              type="button"
              onClick={() => void navigate('/workout')}
            >
              Resume workout
            </PrimaryButton>
          </div>
        </Card>
      ) : null}

      <Card title="Current program">
        {dashboard?.activeProgram ? (
          <>
            <p className="metric-value metric-value-small">
              {dashboard.activeProgram.cycle.name}
            </p>
            <p className="muted">
              {dashboard.activeProgram.days.length} workout days,{' '}
              {dashboard.activeProgram.exerciseCount} exercises
            </p>
          </>
        ) : (
          <EmptyState
            title="No active program"
            message="Create and activate a program before starting program-based workouts."
            action={
              <SecondaryButton type="button">Create program</SecondaryButton>
            }
          />
        )}
      </Card>

      <Card title="Start workout">
        <div className="button-row">
          <PrimaryButton
            type="button"
            disabled={!dashboard?.activeProgram?.days.length}
            onClick={() => void navigate('/training')}
          >
            Start workout
          </PrimaryButton>
          {dashboard?.activeProgram?.days.length ? (
            <SecondaryButton type="button">
              {dashboard.activeProgram.days[0]?.name}
            </SecondaryButton>
          ) : null}
        </div>
      </Card>

      <Card title="Workout history">
        {dashboard?.recentCompletedWorkouts.length ? (
          <div className="history-accordion-list">
            {dashboard.recentCompletedWorkouts.map((workout) => (
              <WorkoutHistoryAccordionRow
                expanded={expandedWorkoutId === workout.id}
                key={workout.id}
                onToggle={() => {
                  const nextId =
                    expandedWorkoutId === workout.id ? null : workout.id
                  setExpandedWorkoutId(nextId)
                  setExpandedStructure(null)
                  if (nextId) {
                    void workoutRepository
                      .getWorkoutHistoryStructure(nextId)
                      .then(setExpandedStructure)
                  }
                }}
                structure={
                  expandedWorkoutId === workout.id ? expandedStructure : null
                }
                summary={dashboard.recentCompletedWorkoutSummaries[workout.id]}
                workout={workout}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No completed workouts"
            message="Completed workouts will appear here after training history exists."
          />
        )}
      </Card>

      <SectionHeader title="Recent activity" />
      <Card>
        {dashboard?.recentActivity.length ? (
          <ol className="activity-list" aria-label="Recent activity">
            {dashboard.recentActivity.map((activity) => (
              <li key={`${activity.type}-${activity.id}`}>
                <span className="quick-action-icon">
                  <Activity aria-hidden="true" size={18} />
                </span>
                <div>
                  <strong>{activity.label}</strong>
                  <small>
                    {activity.type} - {activity.localDate}
                  </small>
                </div>
              </li>
            ))}
          </ol>
        ) : dashboard?.metadata ? (
          <StatusMessage tone="success">
            Local database schema {dashboard.metadata.databaseSchemaVersion};
            backup schema {dashboard.metadata.backupSchemaVersion}.
          </StatusMessage>
        ) : (
          <LoadingState label="Loading local metadata" />
        )}
      </Card>

      <Card title="Home links">
        <div className="quick-action-list">
          <button type="button" onClick={() => void navigate('/history')}>
            <span className="quick-action-icon">
              <Activity aria-hidden="true" size={20} />
            </span>
            <span>
              <strong>View All History</strong>
              <small>Open the compact workout and run history list</small>
            </span>
          </button>
          <button
            type="button"
            onClick={() => void navigate('/history?view=graphs')}
          >
            <span className="quick-action-icon">
              <LineChart aria-hidden="true" size={20} />
            </span>
            <span>
              <strong>Graphs</strong>
              <small>Open bodyweight and strength graph views</small>
            </span>
          </button>
          <button
            type="button"
            onClick={() => void navigate('/history?view=bodyweight')}
          >
            <span className="quick-action-icon">
              <Scale aria-hidden="true" size={20} />
            </span>
            <span>
              <strong>Bodyweight</strong>
              <small>Open the full bodyweight history and logging page</small>
            </span>
          </button>
          <button
            type="button"
            onClick={() => void navigate('/settings?section=usda')}
          >
            <span className="quick-action-icon">
              <Settings aria-hidden="true" size={20} />
            </span>
            <span>
              <strong>Settings</strong>
              <small>Integrations - USDA FoodData Central</small>
            </span>
          </button>
        </div>
      </Card>
    </PageContainer>
  )
}

function WorkoutHistoryAccordionRow({
  expanded,
  onToggle,
  structure,
  summary,
  workout,
}: {
  expanded: boolean
  onToggle: () => void
  structure: WorkoutHistoryStructure | null
  summary: { completedSetCount: number; exerciseCount: number } | undefined
  workout: WorkoutHistoryEntry
}) {
  const panelId = `home-history-${workout.id}`
  const duration = formatHistoryDuration(workout.durationSeconds)

  return (
    <article className="history-accordion-item">
      <button
        aria-controls={panelId}
        aria-expanded={expanded}
        className="history-accordion-trigger"
        onClick={onToggle}
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
      {expanded ? (
        <div className="history-accordion-panel" id={panelId}>
          {structure ? (
            <ReadOnlyWorkoutDetails structure={structure} />
          ) : (
            <LoadingState label="Loading workout details" />
          )}
        </div>
      ) : null}
    </article>
  )
}

function ReadOnlyWorkoutDetails({
  structure,
}: {
  structure: WorkoutHistoryStructure
}) {
  const summary = summarizeHistoryWorkout(structure)
  const [openExercises, setOpenExercises] = useState<Set<string>>(new Set())
  return (
    <div className="history-readonly-detail">
      <dl className="history-detail-list">
        <div>
          <dt>Workout</dt>
          <dd>{structure.workout.name}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{workoutHistoryType(structure.workout)}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{formatHistoryDate(structure.workout.localDate)}</dd>
        </div>
        {formatHistoryDuration(structure.workout.durationSeconds) ? (
          <div>
            <dt>Duration</dt>
            <dd>{formatHistoryDuration(structure.workout.durationSeconds)}</dd>
          </div>
        ) : null}
        <div>
          <dt>Exercises</dt>
          <dd>{summary.exerciseCount}</dd>
        </div>
        {structure.workout.notes ? (
          <div>
            <dt>Notes</dt>
            <dd>{structure.workout.notes}</dd>
          </div>
        ) : null}
      </dl>
      <div className="history-exercise-accordion-list">
        {structure.exercises.map((exercise) => {
          const sets = structure.setsByExercise[exercise.id] ?? []
          const expanded = openExercises.has(exercise.id)
          const panelId = `exercise-history-${exercise.id}`
          return (
            <article className="history-exercise-accordion" key={exercise.id}>
              <button
                aria-controls={panelId}
                aria-expanded={expanded}
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
                <ChevronDown aria-hidden="true" className="accordion-chevron" />
              </button>
              {expanded ? (
                <div className="history-exercise-panel" id={panelId}>
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
  )
}

function HomeBodyweightTrend({
  trend,
}: {
  trend: BodyweightTrendSummary | undefined
}) {
  if (!trend || trend.status === 'empty') {
    return (
      <div className="home-trend" aria-label="Bodyweight trend">
        <span>No trend yet</span>
        <small>Add at least two entries to show change.</small>
      </div>
    )
  }

  if (trend.status === 'single') {
    return (
      <div className="home-trend" aria-label="Bodyweight trend">
        <span>One entry</span>
        <small>{trend.text}</small>
      </div>
    )
  }

  return (
    <div className="home-trend" aria-label="Bodyweight trend">
      <span>{formatBodyweightChange(trend.change)}</span>
      <small>{trend.text}</small>
    </div>
  )
}

function MacroProgress({
  label,
  target,
  value,
}: {
  label: string
  target: number
  value: number
}) {
  const roundedValue = Math.round(value)
  const roundedTarget = Math.round(target)
  const percentage =
    roundedTarget > 0 ? Math.min(100, (roundedValue / roundedTarget) * 100) : 0

  return (
    <div className="macro-progress">
      <div>
        <span>{label}</span>
        <strong>
          {roundedValue} g / {roundedTarget} g
        </strong>
      </div>
      <div className="progress-track" aria-hidden="true">
        <span style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}
