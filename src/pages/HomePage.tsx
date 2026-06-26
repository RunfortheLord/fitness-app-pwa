import { LineChart, Scale } from 'lucide-react'
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
import { currentTrendWeight } from '@domain/bodyweightTrend'
import type { BodyweightEntry } from '@shared-types/app'
import { useDashboardContext } from '@hooks/useDashboardContext'
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
              Graphs
            </SecondaryButton>
            <SecondaryButton
              type="button"
              onClick={() => void navigate('/history?view=bodyweight')}
            >
              <Scale aria-hidden="true" size={18} />
              Bodyweight
            </SecondaryButton>
          </div>
        </Card>

        <Card
          className="home-action-card"
          title={dashboard?.activeProgram?.cycle.name ?? 'No active program'}
        >
          <div className="dashboard-shortcuts">
            <PrimaryButton
              type="button"
              disabled={!dashboard?.activeProgram?.days.length}
              onClick={() => void navigate('/training')}
            >
              Start workout
            </PrimaryButton>
            {dashboard?.activeProgram?.days.length ? (
              <SecondaryButton type="button">
                {`Next: ${
                  dashboard.activeProgram.nextDay?.name ??
                  dashboard.activeProgram.days[0]?.name
                }`}
              </SecondaryButton>
            ) : (
              <SecondaryButton type="button">Create program</SecondaryButton>
            )}
          </div>
        </Card>
      </section>

      <section className="metric-grid" aria-label="Daily summary">
        <HomeBodyweightMetric
          trendWeight={trendWeight}
          lastRecorded={dashboard?.currentBodyweight}
        />
        <MetricCard
          label="Calories remaining"
          value={`${caloriesRemaining}`}
          detail={
            calorieTarget > 0
              ? `${calorieTarget} kcal target`
              : 'Target not set'
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

      {dashboard?.metadata ? (
        <div className="visually-hidden">
          Local database schema {dashboard.metadata.databaseSchemaVersion};
          backup schema {dashboard.metadata.backupSchemaVersion}.
        </div>
      ) : null}
    </PageContainer>
  )
}

function HomeBodyweightMetric({
  trendWeight,
  lastRecorded,
}: {
  trendWeight: number | null
  lastRecorded: BodyweightEntry | undefined
}) {
  const unit = lastRecorded?.unit ?? 'lb'
  return (
    <Card className="metric-card">
      <p className="metric-label">Bodyweight</p>
      <div className="home-bw-metric">
        <div className="home-bw-stat">
          <span className="home-bw-value">
            {trendWeight !== null
              ? `${formatWeight(trendWeight)} ${unit}`
              : '—'}
          </span>
          <span className="home-bw-caption">Trend weight</span>
        </div>
        <div className="home-bw-stat">
          <span className="home-bw-value home-bw-value-secondary">
            {lastRecorded
              ? `${formatWeight(lastRecorded.weight)} ${unit}`
              : '—'}
          </span>
          <span className="home-bw-caption">Last recorded</span>
        </div>
      </div>
    </Card>
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
