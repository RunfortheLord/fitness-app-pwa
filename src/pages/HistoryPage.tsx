import { DashboardCard } from '@components/DashboardCard'

export function HistoryPage() {
  return (
    <div className="page-stack">
      <DashboardCard title="History">
        <p className="muted">Completed workout history will live here.</p>
      </DashboardCard>
    </div>
  )
}
