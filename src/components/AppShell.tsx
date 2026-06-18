import { Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { registerServiceWorkerUpdateHandler } from '@app/pwa'
import { BottomNavigation } from '@components/BottomNavigation'

type AppShellProps = {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [isUpdateReady, setIsUpdateReady] = useState(false)

  useEffect(() => {
    registerServiceWorkerUpdateHandler(() => {
      setIsUpdateReady(true)
    })
  }, [])

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Local-first fitness PWA</p>
          <h1>Training Log</h1>
        </div>
        <Link className="icon-link" aria-label="Settings" to="/settings">
          <Settings aria-hidden="true" size={22} />
        </Link>
      </header>

      {isUpdateReady ? (
        <aside className="status-banner" role="status">
          A new app version is ready. Refresh when you are not logging.
        </aside>
      ) : null}

      <main className="app-main">{children}</main>
      <BottomNavigation />
    </div>
  )
}
