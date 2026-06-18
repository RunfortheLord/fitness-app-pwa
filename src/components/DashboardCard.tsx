type DashboardCardProps = {
  title: string
  children: React.ReactNode
}

export function DashboardCard({ title, children }: DashboardCardProps) {
  const titleId = `${title.replaceAll(' ', '-')}-title`

  return (
    <section className="dashboard-card" aria-labelledby={titleId}>
      <h2 id={titleId}>{title}</h2>
      {children}
    </section>
  )
}
