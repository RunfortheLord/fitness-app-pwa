import { LineChart, Scale } from 'lucide-react'
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
import {
  formatBodyweightChange,
  type BodyweightTrendSummary,
} from '@domain/bodyweightProgress'
import { currentTrendWeight } from '@domain/bodyweightTrend'
import { formatWeight as formatWeightWithUnit } from '@domain/weightUnits'
import type { BodyweightEntry } from '@shared-types/app'
import { useDashboardContext } from '@hooks/useDashboardContext'
import { useWeightUnit } from '@hooks/useWeightUnit'
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
  const [dashboardState, setDashboardState] = useState<DashboardLoadState>({
    status: 'loading',
    selectedDate: null,
  })

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
      : undefined
  const isDashboardLoading = !dashboard

  const caloriesConsumed = Math.round(dashboard?.nutrition.totals.calories ?? 0)
  const calorieTarget = Math.round(dashboard?.nutrition.targets.calories ?? 0)
  const caloriesRemaining = Math.round(
    dashboard?.nutrition.remainingCalories ?? 0,
  )
  const trendWeight = dashboard
    ? currentTrendWeight(dashboard.bodyweightEntries)
    : null

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
          ) : dashboard?.activeProgram?.days.length ? (
            <>
              <PrimaryButton
                type="button"
                onClick={() => void navigate('/training')}
              >
                Start workout
              </PrimaryButton>
              <p className="home-action-meta">
                {`${t('Next')}: ${
                  dashboard.activeProgram.nextDay?.name ??
                  dashboard.activeProgram.days[0]?.name
                }`}
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

      <section className="home-action-grid" aria-label="Home shortcuts">
        <Card className="home-action-card">
          <div className="dashboard-shortcuts">
            <SecondaryButton
              type="button"
              onClick={() => void navigate('/history?source=home')}
            >
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
          </div>
        </Card>
      </section>

      <section className="metric-grid" aria-label="Daily summary">
        <HomeBodyweightSummary
          trend={dashboard?.bodyweightTrend}
          trendWeight={trendWeight}
          lastRecorded={dashboard?.currentBodyweight}
          selectedEntry={dashboard?.bodyweight}
          onEdit={() =>
            openBodyweightSheet({
              entryId: dashboard?.bodyweight?.id,
              localDate: selectedDate,
            })
          }
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

      {dashboard?.metadata ? (
        <div className="visually-hidden">
          Local database schema {dashboard.metadata.databaseSchemaVersion};
          backup schema {dashboard.metadata.backupSchemaVersion}.
        </div>
      ) : null}
    </PageContainer>
  )
}

function HomeBodyweightSummary({
  trend,
  trendWeight,
  lastRecorded,
  selectedEntry,
  onEdit,
  onLog,
  onView,
}: {
  trend: BodyweightTrendSummary | undefined
  trendWeight: number | null
  lastRecorded: BodyweightEntry | undefined
  selectedEntry: BodyweightEntry | undefined
  onEdit: () => void
  onLog: () => void
  onView: () => void
}) {
  const { t } = useLanguage()
  const weightUnit = useWeightUnit()
  return (
    <Card className="metric-card home-bodyweight-summary">
      <button
        aria-label={t('Open bodyweight log')}
        className="home-bodyweight-summary-trigger"
        onClick={onLog}
        type="button"
      >
        <span className="home-bodyweight-title">
          <Scale aria-hidden="true" size={18} />
          {t('Bodyweight')}
        </span>
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
        {lastRecorded ? (
          <span className="home-bw-current-date">
            {t('Current from {date}', { date: lastRecorded.localDate })}
          </span>
        ) : null}
      </button>
      {selectedEntry ? (
        <p className="muted">
          Selected date:{' '}
          {formatWeightWithUnit(selectedEntry.weight, weightUnit, 'bodyweight')}
        </p>
      ) : (
        <p className="muted">{t('Selected date: no bodyweight entry')}</p>
      )}
      <HomeBodyweightTrend trend={trend} />
      <div className="button-row home-bodyweight-actions">
        <PrimaryButton type="button" onClick={onLog}>
          Log bodyweight
        </PrimaryButton>
        {selectedEntry ? (
          <SecondaryButton type="button" onClick={onEdit}>
            Edit latest
          </SecondaryButton>
        ) : null}
        <SecondaryButton type="button" onClick={onView}>
          View graph
        </SecondaryButton>
      </div>
    </Card>
  )
}

function HomeBodyweightTrend({
  trend,
}: {
  trend: BodyweightTrendSummary | undefined
}) {
  const { t } = useLanguage()
  const weightUnit = useWeightUnit()
  if (!trend || trend.status === 'empty') {
    return (
      <div className="home-trend" aria-label={t('Bodyweight trend')}>
        <span>{t('No trend yet')}</span>
        <small>{t('Add at least two entries to show change.')}</small>
      </div>
    )
  }

  if (trend.status === 'single') {
    return (
      <div className="home-trend" aria-label={t('Bodyweight trend')}>
        <span>{t('One entry')}</span>
        <small>{t(trend.text)}</small>
      </div>
    )
  }

  return (
    <div className="home-trend" aria-label={t('Bodyweight trend')}>
      <span>{formatBodyweightChange(trend.change, weightUnit)}</span>
      <small>{t(trend.text)}</small>
    </div>
  )
}
