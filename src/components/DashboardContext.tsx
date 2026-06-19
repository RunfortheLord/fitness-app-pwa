import { useCallback, useMemo, useState, type ReactNode } from 'react'

import {
  DashboardContext,
  type BodyweightSheetState,
} from '@components/dashboardContextValue'
import { formatLocalDate, type LocalDateString } from '@domain/dates'

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDate] = useState(() =>
    formatLocalDate(new Date()),
  )
  const [bodyweightSheet, setBodyweightSheet] =
    useState<BodyweightSheetState | null>(null)
  const [dashboardRevision, setDashboardRevision] = useState(0)

  const openBodyweightSheet = useCallback(
    (input?: LocalDateString | BodyweightSheetState) => {
      if (typeof input === 'object') {
        setBodyweightSheet(input)
        return
      }
      setBodyweightSheet({ localDate: input ?? selectedDate })
    },
    [selectedDate],
  )

  const value = useMemo(
    () => ({
      selectedDate,
      setSelectedDate,
      bodyweightSheet,
      dashboardRevision,
      openBodyweightSheet,
      closeBodyweightSheet: () => setBodyweightSheet(null),
      refreshDashboard: () => setDashboardRevision((revision) => revision + 1),
    }),
    [bodyweightSheet, dashboardRevision, openBodyweightSheet, selectedDate],
  )

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  )
}
