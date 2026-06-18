import { createContext } from 'react'

import type { LocalDateString } from '@domain/dates'

export type DashboardContextValue = {
  selectedDate: LocalDateString
  setSelectedDate: (localDate: LocalDateString) => void
  bodyweightSheetDate: LocalDateString | null
  openBodyweightSheet: (localDate?: LocalDateString) => void
  closeBodyweightSheet: () => void
}

export const DashboardContext = createContext<
  DashboardContextValue | undefined
>(undefined)
