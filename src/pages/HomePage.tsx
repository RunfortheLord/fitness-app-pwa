import { History, LineChart, Scale } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  Card,
  DateSelector,
  LoadingState,
  MetricCard,
  PageContainer,
  PrimaryButton,
  SecondaryButton,
  StatusMessage,
} from '@components/ui'
import { CalorieHistoryChart } from '@components/CalorieHistoryChart'
import { useLanguage } from '@components/languageContextValue'
import {
  addLocalDays,
  formatLocalDate,
  formatSelectedDateLabel,
  type LocalDateString,
} from '@domain/dates'
import { currentTimeAwareTrendWeight } from '@domain/bodyweightTrend'
import { formatWeight as formatWeightWithUnit } from '@domain/weightUnits'
import type { BodyweightEntry } from '@shared-types/app'
import { useDashboardContext } from '@hooks/useDashboardContext'
import { useWeightUnit } from '@hooks/useWeightUnit'
import { workoutRepository } from '@repositories/workoutRepository'
import {
  dashboardService,
  type DashboardData,
} from '@services/dashboardService'

type DashboardLoadState =
  | { status: 'loading'; selectedDate: null }
  | { status: 'error'; selectedDate: LocalDateString }
  | {
      status: 'ready'
      selectedDate: LocalDateString
      dashboard: DashboardData
    }

export function HomePage() {
  const { language, t } = useLanguage()
  const {
    dashboardRevision,
    openBodyweightSheet,
    selectedDate,
    setSelectedDate,
  } = useDashboardContext()
  const navigate = useNavigate()
  const today = formatLocalDate(new Date())
  const [dashboardState, setDashboardState] = useState<DashboardLoadState>(
    () => {
      const cached = dashboardService.getCachedDashboardData(selectedDate)
      return cached
        ? { status: 'ready', selectedDate, dashboard: cached }
        : { status: 'loading', selectedDate: null }
    },
  )
  const [isStartingWorkout, setIsStartingWorkout] = useState(false)
  const [startWorkoutError, setStartWorkoutError] = useState<string | null>(
    null,
  )

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
      : dashboardService.getCachedDashboardData(selectedDate)
  const isDashboardLoading = !dashboard

  const caloriesConsumed = Math.round(dashboard?.nutrition.totals.calories ?? 0)
  const calorieTarget = Math.round(dashboard?.nutrition.targets.calories ?? 0)
  const caloriesRemaining = Math.round(
    dashboard?.nutrition.remainingCalories ?? 0,
  )
  const trendWeight = dashboard
    ? currentTimeAwareTrendWeight(dashboard.bodyweightEntries)
    : null

  async function startNextWorkout() {
    const activeProgram = dashboard?.activeProgram
    if (!activeProgram?.nextDay) {
      return
    }
    setIsStartingWorkout(true)
    setStartWorkoutError(null)
    try {
      await workoutRepository.startWorkout({
        activeCycleId: activeProgram.cycle.id,
        dayId: activeProgram.nextDay.id,
        localDate: selectedDate,
      })
      await navigate('/workout')
    } catch (caught) {
      setStartWorkoutError(
        caught instanceof Error ? caught.message : 'Workout could not start.',
      )
      setIsStartingWorkout(false)
    }
  }

  return (
    <PageContainer>
      <DateSelector
        dateLabel={formatSelectedDateLabel(selectedDate, language)}
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
          {t('Dashboard ready')}
        </div>
      ) : null}
      {dashboardState.status === 'error' ? (
        <StatusMessage tone="warning">
          Dashboard data could not be loaded.
        </StatusMessage>
      ) : null}
      {startWorkoutError ? (
        <StatusMessage tone="warning">{startWorkoutError}</StatusMessage>
      ) : null}

      {dashboard ? (
        <>
          <Card
            className="home-action-card home-workout-card"
            title={
              dashboard?.activeWorkout
                ? 'Workout in progress'
                : (dashboard?.activeProgram?.cycle.name ?? 'No active program')
            }
          >
            <div className="dashboard-shortcuts">
              {dashboard?.activeWorkout ? (
                <>
                  <PrimaryButton
                    type="button"
                    onClick={() => void navigate('/workout')}
                  >
                    Resume workout
                  </PrimaryButton>
                  <p className="home-action-meta">
                    {dashboard.activeWorkout.name} -{' '}
                    {t('Started {date}', {
                      date: dashboard.activeWorkout.localDate,
                    })}
                  </p>
                </>
              ) : dashboard.activeProgram?.nextDay ? (
                <>
                  <PrimaryButton
                    disabled={isStartingWorkout}
                    type="button"
                    onClick={() => void startNextWorkout()}
                  >
                    {isStartingWorkout
                      ? t('Starting...')
                      : t('Start {day}', {
                          day: dashboard.activeProgram.nextDay.name,
                        })}
                  </PrimaryButton>
                  <p className="home-action-meta">
                    {t('Week {week} · Next workout', {
                      week: dashboard.activeProgram.weekNumber,
                    })}
                  </p>
                </>
              ) : (
                <PrimaryButton
                  type="button"
                  onClick={() => void navigate('/training?createProgram=1')}
                >
                  Create program
                </PrimaryButton>
              )}
            </div>
          </Card>

          <section className="home-utility-nav" aria-label="Home shortcuts">
            <SecondaryButton
              type="button"
              onClick={() => void navigate('/history?source=home')}
            >
              <History aria-hidden="true" size={18} />
              View all history
            </SecondaryButton>
            <SecondaryButton
              type="button"
              onClick={() => void navigate('/history?view=graphs')}
            >
              <LineChart aria-hidden="true" size={18} />
              {t('Graphs')}
            </SecondaryButton>
            <SecondaryButton
              type="button"
              onClick={() => void navigate('/history?view=bodyweight')}
            >
              <Scale aria-hidden="true" size={18} />
              {t('Bodyweight')}
            </SecondaryButton>
          </section>

          <section className="metric-grid" aria-label="Daily summary">
            <HomeBodyweightSummary
              trendWeight={trendWeight}
              lastRecorded={dashboard?.currentBodyweight}
              onLog={() => openBodyweightSheet(selectedDate)}
              onView={() => void navigate('/history?view=bodyweight')}
            />
            <MetricCard
              label="Calories remaining"
              onClick={() => void navigate('/nutrition?tab=day')}
              value={`${caloriesRemaining}`}
              detail={
                calorieTarget > 0
                  ? `${calorieTarget} kcal target`
                  : 'Target not set'
              }
            />
          </section>

          <Card className="home-calories-card" title="Calories">
            <CalorieHistoryChart
              compact
              history={dashboard?.calorieHistory ?? []}
            />
            {caloriesConsumed === 0 ? (
              <div className="button-row">
                <SecondaryButton
                  type="button"
                  onClick={() => void navigate('/nutrition?logFood=1')}
                >
                  Log food
                </SecondaryButton>
              </div>
            ) : null}
          </Card>

          {dashboard.metadata ? (
            <div className="visually-hidden">
              Local database schema {dashboard.metadata.databaseSchemaVersion};
              backup schema {dashboard.metadata.backupSchemaVersion}.
            </div>
          ) : null}
        </>
      ) : null}
    </PageContainer>
  )
}

function HomeBodyweightSummary({
  trendWeight,
  lastRecorded,
  onLog,
  onView,
}: {
  trendWeight: number | null
  lastRecorded: BodyweightEntry | undefined
  onLog: () => void
  onView: () => void
}) {
  const { t } = useLanguage()
  const weightUnit = useWeightUnit()
  return (
    <Card
      aria-label={t('Bodyweight')}
      className="metric-card home-bodyweight-summary"
    >
      <div className="home-bw-metric">
        <div className="home-bw-stat">
          <span className="home-bw-value">
            {trendWeight !== null
              ? formatWeightWithUnit(trendWeight, weightUnit, 'bodyweight')
              : '—'}
          </span>
          <span className="home-bw-caption">{t('Trend weight')}</span>
        </div>
        <div className="home-bw-stat">
          <span className="home-bw-value home-bw-value-secondary">
            {lastRecorded
              ? formatWeightWithUnit(
                  lastRecorded.weight,
                  weightUnit,
                  'bodyweight',
                )
              : t('No entry')}
          </span>
          <span className="home-bw-caption">{t('Last recorded')}</span>
        </div>
      </div>
      <div className="button-row home-bodyweight-actions">
        <PrimaryButton type="button" onClick={onLog}>
          Log bodyweight
        </PrimaryButton>
        <SecondaryButton type="button" onClick={onView}>
          View graph
        </SecondaryButton>
      </div>
    </Card>
  )
}
