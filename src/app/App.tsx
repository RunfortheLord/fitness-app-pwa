import { Outlet } from 'react-router-dom'

import { AppShell } from '@components/AppShell'
import { LanguageProvider } from '@components/LanguageContext'

export function App() {
  return (
    <LanguageProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </LanguageProvider>
  )
}
