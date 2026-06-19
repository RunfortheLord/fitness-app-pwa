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

import {
  registerServiceWorkerUpdateHandler,
  type ServiceWorkerUpdate,
} from '@app/pwa'
import { BodyweightEntrySheet } from '@components/BodyweightEntrySheet'
import { BottomNavigation } from '@components/BottomNavigation'
import { DashboardProvider } from '@components/DashboardContext'
import {
  AppHeader,
  BottomSheet,
  IconButton,
  OfflineIndicator,
  PrimaryButton,
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
  const [pendingUpdate, setPendingUpdate] =
    useState<ServiceWorkerUpdate | null>(null)
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false)
  const [updateInstruction, setUpdateInstruction] = useState<string | null>(
    null,
  )
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine)
  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false)
  const { bodyweightSheetDate, closeBodyweightSheet, openBodyweightSheet } =
    useDashboardContext()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const update = registerServiceWorkerUpdateHandler((nextUpdate) => {
      setPendingUpdate(nextUpdate)
      setUpdateInstruction(null)
    })

    function checkForUpdateWhenVisible() {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void update?.checkForUpdate()
      }
    }

    document.addEventListener('visibilitychange', checkForUpdateWhenVisible)

    function handlePwaTestUpdate(event: Event) {
      if (!window.location.search.includes('pwaTest=1')) {
        return
      }

      const detail = event instanceof CustomEvent ? event.detail : undefined
      const applyUpdate =
        detail &&
        typeof detail === 'object' &&
        'applyUpdate' in detail &&
        typeof detail.applyUpdate === 'function'
          ? detail.applyUpdate
          : () => undefined

      setPendingUpdate({
        applyUpdate,
        checkForUpdate: () => Promise.resolve(),
      })
    }

    window.addEventListener('fitness-log:pwa-update-ready', handlePwaTestUpdate)

    return () => {
      document.removeEventListener(
        'visibilitychange',
        checkForUpdateWhenVisible,
      )
      window.removeEventListener(
        'fitness-log:pwa-update-ready',
        handlePwaTestUpdate,
      )
    }
  }, [])

  useEffect(() => {
    function updateOnlineStatus() {
      setIsOffline(!navigator.onLine)
    }

    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)

    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
    }
  }, [])

  const routeTitle = getRouteTitle(location.pathname)
  const hasUpdateReady = pendingUpdate !== null

  function applyUpdate() {
    if (!pendingUpdate) {
      return
    }

    setIsApplyingUpdate(true)
    pendingUpdate.applyUpdate()
    window.setTimeout(() => {
      setUpdateInstruction(
        'Update started. If this screen does not reopen automatically, close the app and open it again.',
      )
    }, 1500)
  }

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

      <OfflineIndicator isOffline={isOffline} />

      {hasUpdateReady ? (
        <StatusMessage tone="warning">
          <div className="status-message-content">
            <span>
              Update available. Finish any active logging first; updating will
              reopen the app shell.
            </span>
            <PrimaryButton
              disabled={isApplyingUpdate}
              type="button"
              onClick={applyUpdate}
            >
              {isApplyingUpdate ? 'Updating' : 'Update now'}
            </PrimaryButton>
          </div>
          {updateInstruction ? <p>{updateInstruction}</p> : null}
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
