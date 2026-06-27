import {
  Dumbbell,
  Footprints,
  NotebookPen,
  Plus,
  Scale,
  Sparkles,
  SquarePen,
  Settings,
  Utensils,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import {
  LATEST_CHANGELOG_ENTRY,
  hasUnseenChangelog,
  markChangelogSeen,
} from '@domain/changelog'

import {
  registerServiceWorkerUpdateHandler,
  type ServiceWorkerUpdate,
} from '@app/pwa'
import { BodyweightEntrySheet } from '@components/BodyweightEntrySheet'
import { BottomNavigation } from '@components/BottomNavigation'
import { DashboardProvider } from '@components/DashboardContext'
import { useLanguage } from '@components/languageContextValue'
import { RestTimerMonitor } from '@components/RestTimerMonitor'
import {
  AppHeader,
  BottomSheet,
  IconButton,
  OfflineIndicator,
  PrimaryButton,
  StatusMessage,
} from '@components/ui'
import { useDashboardContext } from '@hooks/useDashboardContext'
import { useKeyboardInset } from '@hooks/useKeyboardInset'
import { runRepository } from '@repositories/runRepository'
import { workoutRepository } from '@repositories/workoutRepository'

type ActiveActivity =
  | { type: 'workout'; id: string }
  | { type: 'run'; id: string }
  | null

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
  const { t } = useLanguage()
  const [pendingUpdate, setPendingUpdate] =
    useState<ServiceWorkerUpdate | null>(null)
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false)
  const [updateInstruction, setUpdateInstruction] = useState<string | null>(
    null,
  )
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine)
  const [showWhatsNew, setShowWhatsNew] = useState(() => hasUnseenChangelog())
  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false)
  const [activeActivity, setActiveActivity] = useState<ActiveActivity>(null)
  const { bodyweightSheet, closeBodyweightSheet, openBodyweightSheet } =
    useDashboardContext()
  const location = useLocation()
  const navigate = useNavigate()

  useKeyboardInset()

  useEffect(() => {
    const update = registerServiceWorkerUpdateHandler((nextUpdate) => {
      setPendingUpdate(nextUpdate)
      setUpdateInstruction(null)
    })

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
      update?.cleanup()
      window.removeEventListener(
        'fitness-log:pwa-update-ready',
        handlePwaTestUpdate,
      )
    }
  }, [])

  useEffect(() => {
    let isCurrent = true
    void Promise.all([
      workoutRepository.getActiveWorkout(),
      runRepository.getActiveRun(),
    ]).then(([workout, run]) => {
      if (!isCurrent) {
        return
      }
      setActiveActivity(
        workout
          ? { type: 'workout', id: workout.id }
          : run
            ? { type: 'run', id: run.id }
            : null,
      )
    })
    return () => {
      isCurrent = false
    }
  }, [location.pathname])

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

  function dismissWhatsNew() {
    markChangelogSeen()
    setShowWhatsNew(false)
  }

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
      <RestTimerMonitor />
      <AppHeader
        title={routeTitle}
        action={
          <Link className="icon-link" aria-label={t('Settings')} to="/settings">
            <Settings aria-hidden="true" size={22} />
          </Link>
        }
      />

      <OfflineIndicator isOffline={isOffline} />

      {hasUpdateReady ? (
        <StatusMessage tone="warning">
          <div className="status-message-content">
            <span>
              {t(
                'Update available. Finish any active logging first; updating will reopen the app shell.',
              )}
            </span>
            <PrimaryButton
              disabled={isApplyingUpdate}
              type="button"
              onClick={applyUpdate}
            >
              {isApplyingUpdate ? t('Updating') : t('Update now')}
            </PrimaryButton>
          </div>
          {updateInstruction ? <p>{updateInstruction}</p> : null}
        </StatusMessage>
      ) : null}

      {showWhatsNew && LATEST_CHANGELOG_ENTRY ? (
        <div className="whats-new-banner">
          <Sparkles aria-hidden="true" size={18} />
          <span className="whats-new-banner-text">
            {t('New')}: {LATEST_CHANGELOG_ENTRY.title}
          </span>
          <Link
            className="whats-new-banner-link"
            to="/settings?section=whats-new"
            onClick={dismissWhatsNew}
          >
            {t("See what's new")}
          </Link>
          <IconButton
            aria-label={t("Dismiss what's new")}
            className="whats-new-banner-dismiss"
            onClick={dismissWhatsNew}
          >
            <X aria-hidden="true" size={18} />
          </IconButton>
        </div>
      ) : null}

      {activeActivity && !isActiveActivityRoute(location.pathname) ? (
        <button
          className="active-activity-banner"
          type="button"
          onClick={() =>
            void navigate(
              activeActivity.type === 'workout' ? '/workout' : '/run',
            )
          }
        >
          {t('Active')}{' '}
          {t(activeActivity.type === 'workout' ? 'Workout' : 'Run')} -{' '}
          {t('Tap to Resume')}
        </button>
      ) : null}

      <main className="app-main">{children}</main>
      <BottomNavigation onAdd={() => setIsQuickActionOpen(true)} />
      <BottomSheet
        isOpen={isQuickActionOpen}
        onClose={() => setIsQuickActionOpen(false)}
        title={t('Quick actions')}
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
              <strong>{t('Log food')}</strong>
              <small>{t('Search recent foods or create a food')}</small>
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
              <strong>{t('Log bodyweight')}</strong>
              <small>{t('Save pounds for the selected date')}</small>
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
              <strong>{t('Start or resume workout')}</strong>
              <small>
                {t('Open active workout or choose a day from Training')}
              </small>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsQuickActionOpen(false)
              void navigate('/run')
            }}
          >
            <span className="quick-action-icon">
              <Footprints aria-hidden="true" size={20} />
            </span>
            <span>
              <strong>{t('Start or resume run')}</strong>
              <small>{t('Track GPS distance, time, and mile splits')}</small>
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
              <strong>{t('Create exercise')}</strong>
              <small>{t('Add a custom exercise to the library')}</small>
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
              <strong>{t('Create program')}</strong>
              <small>{t('Build reusable workout days')}</small>
            </span>
          </button>
          <IconButton
            aria-label={t('Close quick actions')}
            className="quick-action-add"
            onClick={() => setIsQuickActionOpen(false)}
          >
            <Plus aria-hidden="true" size={22} />
          </IconButton>
        </div>
      </BottomSheet>
      <BodyweightEntrySheet
        entryId={bodyweightSheet?.entryId}
        isOpen={bodyweightSheet !== null}
        localDate={bodyweightSheet?.localDate ?? null}
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

  if (pathname.startsWith('/run')) {
    return 'Run'
  }

  if (pathname.startsWith('/history')) {
    return 'History'
  }

  if (pathname.startsWith('/graphs')) {
    return 'Graphs'
  }

  if (pathname.startsWith('/settings')) {
    return 'Settings'
  }

  return 'Home'
}

function isActiveActivityRoute(pathname: string) {
  return pathname.startsWith('/workout') || pathname.startsWith('/run')
}
