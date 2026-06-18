import { DashboardCard } from '@components/DashboardCard'

export function SettingsPage() {
  return (
    <div className="page-stack">
      <DashboardCard title="Settings">
        <p className="muted">
          Backup, restore, nutrition targets, and app version controls will live
          here.
        </p>
      </DashboardCard>
    </div>
  )
}
