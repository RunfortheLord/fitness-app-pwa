import { createContext } from 'react'

import type { LocalDateString } from '@domain/dates'

export type BodyweightSheetState = {
  entryId?: string
  localDate: LocalDateString
}

export type DashboardContextValue = {
  selectedDate: LocalDateString
  setSelectedDate: (localDate: LocalDateString) => void
  bodyweightSheet: BodyweightSheetState | null
  dashboardRevision: number
  openBodyweightSheet: (input?: LocalDateString | BodyweightSheetState) => void
  closeBodyweightSheet: () => void
  refreshDashboard: () => void
}

export const DashboardContext = createContext<
  DashboardContextValue | undefined
>(undefined)
