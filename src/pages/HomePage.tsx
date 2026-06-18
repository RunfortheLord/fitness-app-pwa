import { DashboardCard } from '@components/DashboardCard'
import { formatLocalDate } from '@domain/dates'
import { useAppMetadata } from '@hooks/useAppMetadata'

export function HomePage() {
  const metadata = useAppMetadata()
  const today = formatLocalDate(new Date())

  return (
    <div className="page-stack">
      <section className="date-strip" aria-label="Selected date">
        <button type="button" aria-label="Previous day">
          Previous
        </button>
        <strong>{today}</strong>
        <button type="button" aria-label="Next day">
          Next
        </button>
      </section>

      <DashboardCard title="Nutrition">
        <p className="metric">0 / 0 kcal</p>
        <p className="muted">
          Manual targets and food logs are not implemented yet.
        </p>
      </DashboardCard>

      <DashboardCard title="Bodyweight">
        <p className="muted">No bodyweight logged for this date.</p>
      </DashboardCard>

      <DashboardCard title="Training">
        <p className="muted">No active program yet.</p>
      </DashboardCard>

      <DashboardCard title="Local Data">
        <p className="muted">
          Database schema {metadata?.databaseSchemaVersion ?? 'loading'} ·
          backup schema {metadata?.backupSchemaVersion ?? 'loading'}
        </p>
      </DashboardCard>
    </div>
  )
}
