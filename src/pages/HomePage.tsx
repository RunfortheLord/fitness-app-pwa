import { useLiveQuery } from 'dexie-react-hooks'
import { Activity, Dumbbell, Scale } from 'lucide-react'

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
} from '@domain/dates'
import { useAppMetadata } from '@hooks/useAppMetadata'
import { useDashboardContext } from '@hooks/useDashboardContext'
import { dashboardService } from '@services/dashboardService'

export function HomePage() {
  const metadata = useAppMetadata()
  const { openBodyweightSheet, selectedDate, setSelectedDate } =
    useDashboardContext()
  const today = formatLocalDate(new Date())
  const dashboard = useLiveQuery(
    () => dashboardService.getDashboardData(selectedDate),
    [selectedDate],
  )

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
            action={<SecondaryButton type="button">Log food</SecondaryButton>}
          />
        ) : null}
      </Card>

      <Card title="Bodyweight">
        <div className="card-row">
          <span className="quick-action-icon">
            <Scale aria-hidden="true" size={20} />
          </span>
          <div>
            {dashboard?.bodyweight ? (
              <>
                <p className="metric-value metric-value-small">
                  {dashboard.bodyweight.weight} {dashboard.bodyweight.unit}
                </p>
                <p className="muted">Saved for {selectedDate}</p>
              </>
            ) : (
              <>
                <p className="metric-value metric-value-small">No entry</p>
                <p className="muted">
                  Add one bodyweight record for this date.
                </p>
              </>
            )}
          </div>
        </div>
        <div className="button-row">
          <PrimaryButton
            type="button"
            onClick={() => openBodyweightSheet(selectedDate)}
          >
            {dashboard?.bodyweight ? 'Edit bodyweight' : 'Add bodyweight'}
          </PrimaryButton>
        </div>
      </Card>

      {dashboard?.activeWorkout ? (
        <Card title="Resume workout">
          <p className="metric-value metric-value-small">
            {dashboard.activeWorkout.name}
          </p>
          <p className="muted">Started {dashboard.activeWorkout.localDate}</p>
          <div className="button-row">
            <PrimaryButton type="button">Resume workout</PrimaryButton>
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

      <Card title="Most recent workout">
        {dashboard?.mostRecentCompletedWorkout ? (
          <div className="card-row">
            <span className="quick-action-icon">
              <Dumbbell aria-hidden="true" size={20} />
            </span>
            <div>
              <p className="metric-value metric-value-small">
                {dashboard.mostRecentCompletedWorkout.name}
              </p>
              <p className="muted">
                {dashboard.mostRecentCompletedWorkout.localDate} ·{' '}
                {Math.round(
                  dashboard.mostRecentCompletedWorkout.durationSeconds / 60,
                )}{' '}
                min
              </p>
            </div>
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
                    {activity.type} · {activity.localDate}
                  </small>
                </div>
              </li>
            ))}
          </ol>
        ) : metadata ? (
          <StatusMessage tone="success">
            Local database schema {metadata.databaseSchemaVersion}; backup
            schema {metadata.backupSchemaVersion}.
          </StatusMessage>
        ) : (
          <LoadingState label="Loading local metadata" />
        )}
      </Card>
    </PageContainer>
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
