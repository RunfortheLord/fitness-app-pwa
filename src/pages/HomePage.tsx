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
import { formatLocalDate } from '@domain/dates'
import { useAppMetadata } from '@hooks/useAppMetadata'

export function HomePage() {
  const metadata = useAppMetadata()
  const today = formatLocalDate(new Date())

  return (
    <PageContainer>
      <DateSelector
        dateLabel={today}
        onNext={() => undefined}
        onPrevious={() => undefined}
        onToday={() => undefined}
      />

      <section className="metric-grid" aria-label="Daily summary">
        <MetricCard label="Calories" value="0" detail="Target not set" />
        <MetricCard label="Protein" value="0 g" detail="0 g target" />
      </section>

      <Card title="Nutrition">
        <div className="macro-row">
          <span>Carbs 0 g</span>
          <span>Fat 0 g</span>
          <span>Remaining --</span>
        </div>
        <EmptyState
          title="No foods logged"
          message="Food logging will connect here in a later workflow."
          action={<SecondaryButton type="button">Log food</SecondaryButton>}
        />
      </Card>

      <Card title="Training">
        <p className="metric-value metric-value-small">No active program</p>
        <p className="muted">
          Program setup and active workout persistence arrive later.
        </p>
        <div className="button-row">
          <PrimaryButton type="button">Start workout</PrimaryButton>
          <SecondaryButton type="button">Resume</SecondaryButton>
        </div>
      </Card>

      <SectionHeader title="Recent activity" />
      <Card>
        {metadata ? (
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
