import {
  Dumbbell,
  NotebookPen,
  Plus,
  Scale,
  Settings,
  Utensils,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { registerServiceWorkerUpdateHandler } from '@app/pwa'
import { BodyweightEntrySheet } from '@components/BodyweightEntrySheet'
import { BottomNavigation } from '@components/BottomNavigation'
import { DashboardProvider } from '@components/DashboardContext'
import {
  AppHeader,
  BottomSheet,
  IconButton,
  OfflineIndicator,
  StatusMessage,
} from '@components/ui'
import { useDashboardContext } from '@hooks/useDashboardContext'

type AppShellProps = {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <DashboardProvider>
      <AppShellContent>{children}</AppShellContent>
    </DashboardProvider>
  )
}

function AppShellContent({ children }: AppShellProps) {
  const [isUpdateReady, setIsUpdateReady] = useState(false)
  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false)
  const { bodyweightSheetDate, closeBodyweightSheet, openBodyweightSheet } =
    useDashboardContext()
  const location = useLocation()

  useEffect(() => {
    registerServiceWorkerUpdateHandler(() => {
      setIsUpdateReady(true)
    })
  }, [])

  const routeTitle = getRouteTitle(location.pathname)

  return (
    <div className="app-shell">
      <AppHeader
        eyebrow="Local-first fitness"
        title={routeTitle}
        action={
          <Link className="icon-link" aria-label="Settings" to="/settings">
            <Settings aria-hidden="true" size={22} />
          </Link>
        }
      />

      <OfflineIndicator isOffline={false} />

      {isUpdateReady ? (
        <StatusMessage>
          A new app version is ready. Refresh when you are not logging.
        </StatusMessage>
      ) : null}

      <main className="app-main">{children}</main>
      <BottomNavigation onAdd={() => setIsQuickActionOpen(true)} />
      <BottomSheet
        isOpen={isQuickActionOpen}
        onClose={() => setIsQuickActionOpen(false)}
        title="Quick actions"
      >
        <div className="quick-action-list">
          <button type="button">
            <span className="quick-action-icon">
              <Utensils aria-hidden="true" size={20} />
            </span>
            <span>
              <strong>Log food</strong>
              <small>Placeholder for manual food logging</small>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsQuickActionOpen(false)
              openBodyweightSheet()
            }}
          >
            <span className="quick-action-icon">
              <Scale aria-hidden="true" size={20} />
            </span>
            <span>
              <strong>Log bodyweight</strong>
              <small>Save pounds for the selected date</small>
            </span>
          </button>
          <button type="button">
            <span className="quick-action-icon">
              <Dumbbell aria-hidden="true" size={20} />
            </span>
            <span>
              <strong>Start workout</strong>
              <small>Placeholder for a selected workout day</small>
            </span>
          </button>
          <button type="button">
            <span className="quick-action-icon">
              <NotebookPen aria-hidden="true" size={20} />
            </span>
            <span>
              <strong>Create item</strong>
              <small>Placeholder for future food and training forms</small>
            </span>
          </button>
          <IconButton
            aria-label="Close quick actions"
            className="quick-action-add"
            onClick={() => setIsQuickActionOpen(false)}
          >
            <Plus aria-hidden="true" size={22} />
          </IconButton>
        </div>
      </BottomSheet>
      <BodyweightEntrySheet
        isOpen={bodyweightSheetDate !== null}
        localDate={bodyweightSheetDate}
        onClose={closeBodyweightSheet}
      />
    </div>
  )
}

function getRouteTitle(pathname: string) {
  if (pathname.startsWith('/nutrition')) {
    return 'Nutrition'
  }

  if (pathname.startsWith('/training')) {
    return 'Training'
  }

  if (pathname.startsWith('/history')) {
    return 'History'
  }

  if (pathname.startsWith('/settings')) {
    return 'Settings'
  }

  return 'Home'
}
