import { useCallback, useMemo, useState, type ReactNode } from 'react'

import { DashboardContext } from '@components/dashboardContextValue'
import { formatLocalDate, type LocalDateString } from '@domain/dates'

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDate] = useState(() =>
    formatLocalDate(new Date()),
  )
  const [bodyweightSheetDate, setBodyweightSheetDate] =
    useState<LocalDateString | null>(null)
  const [dashboardRevision, setDashboardRevision] = useState(0)

  const openBodyweightSheet = useCallback(
    (localDate?: LocalDateString) => {
      setBodyweightSheetDate(localDate ?? selectedDate)
    },
    [selectedDate],
  )

  const value = useMemo(
    () => ({
      selectedDate,
      setSelectedDate,
      bodyweightSheetDate,
      dashboardRevision,
      openBodyweightSheet,
      closeBodyweightSheet: () => setBodyweightSheetDate(null),
      refreshDashboard: () => setDashboardRevision((revision) => revision + 1),
    }),
    [bodyweightSheetDate, dashboardRevision, openBodyweightSheet, selectedDate],
  )

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  )
}
