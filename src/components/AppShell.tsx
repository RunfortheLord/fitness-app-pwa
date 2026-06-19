import {
  Dumbbell,
  NotebookPen,
  Plus,
  Scale,
  SquarePen,
  Settings,
  Utensils,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

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
  const navigate = useNavigate()

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
          <button
            type="button"
            onClick={() => {
              setIsQuickActionOpen(false)
              void navigate('/nutrition?logFood=1')
            }}
          >
            <span className="quick-action-icon">
              <Utensils aria-hidden="true" size={20} />
            </span>
            <span>
              <strong>Log food</strong>
              <small>Search recent foods or create a food</small>
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
          <button
            type="button"
            onClick={() => {
              setIsQuickActionOpen(false)
              void navigate('/workout')
            }}
          >
            <span className="quick-action-icon">
              <Dumbbell aria-hidden="true" size={20} />
            </span>
            <span>
              <strong>Start or resume workout</strong>
              <small>Open active workout or choose a day from Training</small>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsQuickActionOpen(false)
              void navigate('/training?createExercise=1')
            }}
          >
            <span className="quick-action-icon">
              <NotebookPen aria-hidden="true" size={20} />
            </span>
            <span>
              <strong>Create exercise</strong>
              <small>Add a custom exercise to the library</small>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsQuickActionOpen(false)
              void navigate('/training?createProgram=1')
            }}
          >
            <span className="quick-action-icon">
              <SquarePen aria-hidden="true" size={20} />
            </span>
            <span>
              <strong>Create program</strong>
              <small>Build reusable workout days</small>
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

  if (pathname.startsWith('/workout')) {
    return 'Live Workout'
  }

  if (pathname.startsWith('/history')) {
    return 'History'
  }

  if (pathname.startsWith('/settings')) {
    return 'Settings'
  }

  return 'Home'
}
