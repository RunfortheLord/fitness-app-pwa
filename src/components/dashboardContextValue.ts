import { createContext } from 'react'

import type { LocalDateString } from '@domain/dates'

export type DashboardContextValue = {
  selectedDate: LocalDateString
  setSelectedDate: (localDate: LocalDateString) => void
  bodyweightSheetDate: LocalDateString | null
  dashboardRevision: number
  openBodyweightSheet: (localDate?: LocalDateString) => void
  closeBodyweightSheet: () => void
  refreshDashboard: () => void
}

export const DashboardContext = createContext<
  DashboardContextValue | undefined
>(undefined)
