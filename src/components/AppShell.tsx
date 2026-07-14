import {
  Dumbbell,
  Footprints,
  Minus,
  NotebookPen,
  Scale,
  Sparkles,
  SquarePen,
  Settings,
  Utensils,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
  SecondaryButton,
  StatusMessage,
  ValidationMessage,
} from '@components/ui'
import { useDashboardContext } from '@hooks/useDashboardContext'
import { useAuth } from '@hooks/useAuth'
import { useKeyboardInset } from '@hooks/useKeyboardInset'
import { useTabSwipeNavigation } from '@hooks/useTabSwipeNavigation'
import { runRepository } from '@repositories/runRepository'
import { automaticCloudBackupService } from '@services/automaticCloudBackupService'
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
  const location = useLocation()
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
  const [hasDismissedSignInPrompt, setHasDismissedSignInPrompt] =
    useState(false)
  const [offerSignInOnLaunch] = useState(() => location.pathname === '/')
  const [signInError, setSignInError] = useState<string | null>(null)
  const [automaticBackupError, setAutomaticBackupError] = useState<
    string | null
  >(null)
  const [automaticBackupBlocked, setAutomaticBackupBlocked] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const previousPathRef = useRef(location.pathname)
  const {
    bodyweightSheet,
    closeBodyweightSheet,
    openBodyweightSheet,
    refreshDashboard,
  } = useDashboardContext()
  const { signIn, status: authStatus } = useAuth()
  const navigate = useNavigate()

  useKeyboardInset()
  useTabSwipeNavigation(mainRef, location.pathname, navigate)

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

    function refreshActiveActivity() {
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
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur()
        }
        return
      }

      refreshDashboard()
      refreshActiveActivity()
    }

    function handlePageShow() {
      refreshDashboard()
      refreshActiveActivity()
    }

    refreshActiveActivity()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pageshow', handlePageShow)

    return () => {
      isCurrent = false
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [location.pathname, refreshDashboard])

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

  useEffect(() => {
    if (previousPathRef.current === location.pathname) {
      return
    }

    previousPathRef.current = location.pathname
    mainRef.current?.focus({ preventScroll: true })
  }, [location.pathname])

  useEffect(() => {
    if (authStatus !== 'signedIn') {
      return
    }

    return automaticCloudBackupService.start({
      onBlocked: () => {
        setAutomaticBackupBlocked(true)
        setAutomaticBackupError(null)
      },
      onError: () => {
        setAutomaticBackupBlocked(false)
        setAutomaticBackupError(
          "Your data hasn't been backed up to the cloud in a few days. It's still safe on this device, and the app will keep retrying.",
        )
      },
      onSuccess: () => {
        setAutomaticBackupBlocked(false)
        setAutomaticBackupError(null)
      },
    })
  }, [authStatus])

  const routeTitle = getRouteTitle(location.pathname)
  const hasUpdateReady = pendingUpdate !== null
  const isHomeRoute = location.pathname === '/'
  const latestChangelogEntry = LATEST_CHANGELOG_ENTRY
  const showSignInPrompt =
    offerSignInOnLaunch &&
    authStatus === 'signedOut' &&
    isHomeRoute &&
    !hasDismissedSignInPrompt
  const showWhatsNewBanner =
    showWhatsNew &&
    latestChangelogEntry &&
    isHomeRoute &&
    !activeActivity &&
    !showSignInPrompt

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

  async function signInForAutomaticBackup() {
    setSignInError(null)
    try {
      await signIn()
    } catch (caught) {
      setSignInError(
        caught instanceof Error
          ? caught.message
          : 'Google sign-in could not start.',
      )
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t('Skip to content')}
      </a>
      <RestTimerMonitor />
      <AppHeader
        title={routeTitle}
        action={
          location.pathname.startsWith('/settings') ? undefined : (
            <div className="live-workout-header-actions">
              {location.pathname.startsWith('/workout') ? (
                <button
                  className="icon-link"
                  type="button"
                  aria-label={t('Minimize workout')}
                  onClick={() => void navigate('/training')}
                >
                  <Minus aria-hidden="true" size={22} />
                </button>
              ) : null}
              <Link
                className="icon-link"
                aria-label={t('Settings')}
                to="/settings"
              >
                <Settings aria-hidden="true" size={22} />
              </Link>
            </div>
          )
        }
      />

      <OfflineIndicator isOffline={isOffline} />

      {automaticBackupError ? (
        <StatusMessage tone="warning">{t(automaticBackupError)}</StatusMessage>
      ) : null}

      {automaticBackupBlocked ? (
        <StatusMessage tone="warning">
          {t(
            'A cloud backup already exists. Restore it or choose Back up now in Settings before automatic backups start on this device.',
          )}
        </StatusMessage>
      ) : null}

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

      {showWhatsNewBanner ? (
        <div className="whats-new-banner">
          <Sparkles aria-hidden="true" size={18} />
          <span className="whats-new-banner-text">
            {t('New')}: {latestChangelogEntry.title}
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

      {showSignInPrompt ? (
        <aside
          aria-labelledby="backup-prompt-title"
          className="backup-sign-in-prompt"
        >
          <div className="backup-sign-in-copy">
            <strong id="backup-prompt-title">{t('Prevent data loss')}</strong>
            <p>
              {t(
                'Sign in with Google to automatically back up your fitness data. You can keep using the app offline, and your data stays available on this device.',
              )}
            </p>
            {signInError ? <ValidationMessage message={signInError} /> : null}
          </div>
          <div className="backup-sign-in-actions">
            <PrimaryButton type="button" onClick={signInForAutomaticBackup}>
              {t('Sign in with Google')}
            </PrimaryButton>
            <SecondaryButton
              type="button"
              onClick={() => {
                setSignInError(null)
                setHasDismissedSignInPrompt(true)
              }}
            >
              {t('Not now')}
            </SecondaryButton>
          </div>
        </aside>
      ) : null}

      {activeActivity &&
      !isHomeRoute &&
      !isActiveActivityRoute(location.pathname) ? (
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

      <main
        aria-label={t(routeTitle)}
        className="app-main"
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
      >
        <div className="route-transition" key={location.pathname}>
          {children}
        </div>
      </main>
      <BottomNavigation
        onAdd={() => setIsQuickActionOpen(true)}
        trainingTo={
          activeActivity?.type === 'workout' ? '/workout' : '/training'
        }
      />
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
