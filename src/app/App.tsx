import { Suspense, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'

import { AppLaunchScreen } from '@app/AppLaunchScreen'
import { preloadInitialPageData } from '@app/preloadInitialPageData'
import { preloadRoutePages } from '@app/preloadRoutePages'
import { AppShell } from '@components/AppShell'
import { LanguageProvider } from '@components/LanguageContext'
import { LoadingState } from '@components/ui'

export function App() {
  const [isLaunchReady, setIsLaunchReady] = useState(
    () => import.meta.env.MODE === 'test',
  )

  useEffect(() => {
    const preload = Promise.all([
      preloadRoutePages(),
      preloadInitialPageData(),
    ]).then(() => undefined)
    if (import.meta.env.MODE === 'test') {
      return
    }

    let isCurrent = true
    let minimumTimeoutId: number | undefined
    let maximumTimeoutId: number | undefined
    const minimumVisible = new Promise<void>((resolve) => {
      minimumTimeoutId = window.setTimeout(resolve, 400)
    })
    const failOpen = new Promise<void>((resolve) => {
      maximumTimeoutId = window.setTimeout(resolve, 30000)
    })

    void Promise.race([
      Promise.all([preload, minimumVisible]).then(() => undefined),
      failOpen,
    ]).then(() => {
      if (!isCurrent) {
        return
      }
      window.clearTimeout(minimumTimeoutId)
      window.clearTimeout(maximumTimeoutId)
      setIsLaunchReady(true)
    })

    return () => {
      isCurrent = false
      window.clearTimeout(minimumTimeoutId)
      window.clearTimeout(maximumTimeoutId)
    }
  }, [])

  if (!isLaunchReady) {
    return <AppLaunchScreen />
  }

  return (
    <LanguageProvider>
      <AppShell>
        <Suspense
          fallback={<LoadingState label="Loading page" variant="cards" />}
        >
          <Outlet />
        </Suspense>
      </AppShell>
    </LanguageProvider>
  )
}
