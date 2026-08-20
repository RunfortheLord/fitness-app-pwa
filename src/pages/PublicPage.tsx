import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function PublicPage({
  children,
  className,
  title,
}: {
  children: ReactNode
  className?: string
  title?: string
}) {
  const cardClassName = ['public-info-card', className]
    .filter(Boolean)
    .join(' ')

  return (
    <main className="public-info-page">
      <article className={cardClassName}>
        <p className="eyebrow">Vigorune</p>
        {title ? <h1>{title}</h1> : null}
        {children}
        <nav className="public-info-links" aria-label="Legal and support">
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/consumer-health-data-privacy">Health data privacy</Link>
          <Link to="/account-deletion">Account deletion</Link>
          <Link to="/support">Support</Link>
          <Link to="/settings?section=about">Open Vigorune</Link>
        </nav>
      </article>
    </main>
  )
}
