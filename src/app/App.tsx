import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'

import { AppShell } from '@components/AppShell'
import { LanguageProvider } from '@components/LanguageContext'
import { LoadingState } from '@components/ui'

export function App() {
  return (
    <LanguageProvider>
      <AppShell>
        <Suspense fallback={<LoadingState label="Loading page" />}>
          <Outlet />
        </Suspense>
      </AppShell>
    </LanguageProvider>
  )
}
