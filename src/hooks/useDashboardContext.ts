import { useContext } from 'react'

import { DashboardContext } from '@components/dashboardContextValue'

export function useDashboardContext() {
  const context = useContext(DashboardContext)
  if (!context) {
    throw new Error('Dashboard context is not available.')
  }
  return context
}
