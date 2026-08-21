import {
  Minus,
  NotebookPen,
  Scale,
  Sparkles,
  SquarePen,
  Settings,
  Utensils,
  X,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import {
  LATEST_CHANGELOG_ENTRY,
  hasUnseenChangelog,
  markChangelogSeen,
} from '@domain/changelog'
import {
  inactivityPauseAt,
  WORKOUT_INACTIVITY_PAUSE_MS,
} from '@domain/workoutTiming'

import { registerServiceWorkerUpdateHandler } from '@app/pwa'
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
  ValidationMessage,
} from '@components/ui'
import { useDashboardContext } from '@hooks/useDashboardContext'
import { useAuth } from '@hooks/useAuth'
import { useTabSwipeNavigation } from '@hooks/useTabSwipeNavigation'
import { runRepository } from '@repositories/runRepository'
import { automaticCloudBackupService } from '@services/automaticCloudBackupService'
import { workoutRepository } from '@repositories/workoutRepository'

type ActiveActivity =
  | {
      type: 'workout'
      dayName: string
      id: string
      pausedAt: string | null
      updatedAt: string
    }
  | { type: 'run'; id: string }
  | null

type AppShellProps = {
  children: React.ReactNode
}

const ONBOARDING_SEEN_STORAGE_KEY = 'fitness-log.onboarding-seen'

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
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine)
  const [showWhatsNew, setShowWhatsNew] = useState(() => hasUnseenChangelog())
  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false)
  const [activeActivity, setActiveActivity] = useState<ActiveActivity>(null)
  const [hasDismissedSignInPrompt, setHasDismissedSignInPrompt] = useState(
    () => window.localStorage.getItem(ONBOARDING_SEEN_STORAGE_KEY) === 'true',
  )
  const [offerSignInOnLaunch] = useState(() => location.pathname === '/')
  const [signInError, setSignInError] = useState<string | null>(null)
  const mainRef = useRef<HTMLElement>(null)
  const pendingQuickActionRef = useRef<(() => void) | null>(null)
  const previousPathRef = useRef(location.pathname)
  const {
    bodyweightSheet,
    closeBodyweightSheet,
    openBodyweightSheet,
    refreshDashboard,
  } = useDashboardContext()
  const { signIn, signInWithApple, status: authStatus } = useAuth()
  const navigate = useNavigate()

  function runAfterQuickActionsClose(action: () => void) {
    pendingQuickActionRef.current = action
    setIsQuickActionOpen(false)
  }

  useTabSwipeNavigation(mainRef, location.pathname, navigate)

  useEffect(() => {
    const update = registerServiceWorkerUpdateHandler((nextUpdate) => {
      nextUpdate.applyUpdate()
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

      applyUpdate()
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
            ? {
                type: 'workout',
                dayName: workout.workoutSnapshot.dayName,
                id: workout.id,
                pausedAt: workout.pausedAt ?? null,
                updatedAt: workout.updatedAt,
              }
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
    window.addEventListener(
      'fitness-log:workout-pause-changed',
      refreshActiveActivity,
    )

    return () => {
      isCurrent = false
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pageshow', handlePageShow)
      window.removeEventListener(
        'fitness-log:workout-pause-changed',
        refreshActiveActivity,
      )
    }
  }, [location.pathname, refreshDashboard])

  useEffect(() => {
    if (activeActivity?.type !== 'workout' || activeActivity.pausedAt) {
      return
    }

    const activity = activeActivity
    const storageKey = workoutActivityStorageKey(activity.id)
    const backgroundStorageKey = workoutBackgroundStorageKey(activity.id)
    let lastActivityAt = readWorkoutActivity(storageKey, activity.updatedAt)
    let pauseTimeoutId: number | null = null
    let pauseInFlight = false

    function clearPauseTimeout() {
      if (pauseTimeoutId !== null) {
        window.clearTimeout(pauseTimeoutId)
        pauseTimeoutId = null
      }
    }

    function pauseWorkoutAt(pausedAt: string) {
      if (pauseInFlight) {
        return
      }
      pauseInFlight = true
      clearPauseTimeout()
      void workoutRepository
        .pauseWorkout(activity.id, pausedAt)
        .then(() => {
          window.localStorage.removeItem(backgroundStorageKey)
          setActiveActivity((current) =>
            current?.type === 'workout' && current.id === activity.id
              ? { ...current, pausedAt, updatedAt: pausedAt }
              : current,
          )
          window.dispatchEvent(
            new CustomEvent('fitness-log:workout-pause-changed'),
          )
        })
        .catch(() => {
          pauseInFlight = false
          schedulePause()
        })
    }

    function schedulePause() {
      clearPauseTimeout()
      const overduePauseAt = inactivityPauseAt(lastActivityAt, Date.now())
      if (overduePauseAt) {
        pauseWorkoutAt(overduePauseAt)
        return
      }
      const remaining = Math.max(
        0,
        lastActivityAt + WORKOUT_INACTIVITY_PAUSE_MS - Date.now(),
      )
      pauseTimeoutId = window.setTimeout(
        () =>
          pauseWorkoutAt(
            new Date(
              lastActivityAt + WORKOUT_INACTIVITY_PAUSE_MS,
            ).toISOString(),
          ),
        remaining,
      )
    }

    function recordActivity() {
      if (document.visibilityState === 'hidden') {
        return
      }
      lastActivityAt = Date.now()
      window.localStorage.setItem(storageKey, String(lastActivityAt))
      schedulePause()
    }

    function pauseForBackground() {
      const backgroundedAt = Date.now()
      window.localStorage.setItem(backgroundStorageKey, String(backgroundedAt))
      pauseWorkoutAt(new Date(backgroundedAt).toISOString())
    }

    const backgroundedAt = readStoredTimestamp(backgroundStorageKey)
    if (backgroundedAt) {
      pauseWorkoutAt(new Date(backgroundedAt).toISOString())
    } else {
      schedulePause()
    }
    window.addEventListener('pointerdown', recordActivity, true)
    window.addEventListener('keydown', recordActivity, true)
    window.addEventListener('input', recordActivity, true)
    window.addEventListener('change', recordActivity, true)
    window.addEventListener('pagehide', pauseForBackground)

    return () => {
      clearPauseTimeout()
      window.removeEventListener('pointerdown', recordActivity, true)
      window.removeEventListener('keydown', recordActivity, true)
      window.removeEventListener('input', recordActivity, true)
      window.removeEventListener('change', recordActivity, true)
      window.removeEventListener('pagehide', pauseForBackground)
    }
  }, [activeActivity])

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

  useLayoutEffect(() => {
    if (previousPathRef.current === location.pathname) {
      return
    }

    previousPathRef.current = location.pathname
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    window.scrollTo(0, 0)
    mainRef.current?.focus({ preventScroll: true })
  }, [location.pathname])

  useEffect(() => {
    if (authStatus !== 'signedIn') {
      return
    }

    return automaticCloudBackupService.start()
  }, [authStatus])

  const routeTitle =
    location.pathname.startsWith('/workout') &&
    activeActivity?.type === 'workout'
      ? activeActivity.dayName
      : getRouteTitle(location.pathname, location.search)
  const isHomeRoute = location.pathname === '/'
  const latestChangelogEntry = LATEST_CHANGELOG_ENTRY
  const showSignInPrompt =
    offerSignInOnLaunch &&
    authStatus === 'signedOut' &&
    isHomeRoute &&
    !hasDismissedSignInPrompt
  const showWhatsNewBanner =
    showWhatsNew && latestChangelogEntry && isHomeRoute && !showSignInPrompt

  function dismissWhatsNew() {
    markChangelogSeen()
    setShowWhatsNew(false)
  }

  async function signInForAutomaticBackup(provider: 'apple' | 'google') {
    setSignInError(null)
    try {
      await (provider === 'apple' ? signInWithApple() : signIn())
    } catch (caught) {
      setSignInError(
        caught instanceof Error ? caught.message : 'Sign-in could not start.',
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
                <>
                  <button
                    className="icon-link"
                    type="button"
                    aria-label={t('Minimize workout')}
                    onClick={() => void navigate('/training')}
                  >
                    <Minus aria-hidden="true" size={22} />
                  </button>
                </>
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
            <strong id="backup-prompt-title">
              {t('Your data stays local')}
            </strong>
            <p>
              {t(
                'Start offline with no account, or sign in with Apple or Google for an optional encrypted connection to your private cloud backup.',
              )}
            </p>
            {signInError ? <ValidationMessage message={signInError} /> : null}
          </div>
          <div className="backup-sign-in-actions">
            <PrimaryButton
              type="button"
              onClick={() => void signInForAutomaticBackup('apple')}
            >
              {t('Sign in with Apple')}
            </PrimaryButton>
            <SecondaryButton
              type="button"
              onClick={() => void signInForAutomaticBackup('google')}
            >
              {t('Sign in with Google')}
            </SecondaryButton>
            <SecondaryButton
              type="button"
              onClick={() => {
                setSignInError(null)
                window.localStorage.setItem(ONBOARDING_SEEN_STORAGE_KEY, 'true')
                setHasDismissedSignInPrompt(true)
              }}
            >
              {t('Continue offline')}
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
          {activeActivity.type === 'workout' && activeActivity.pausedAt
            ? t('Paused')
            : t(activeActivity.type === 'workout' ? 'Workout' : 'Run')}{' '}
          - {t('Tap to Resume')}
        </button>
      ) : null}

      <main
        aria-label={t(routeTitle ?? 'Training')}
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
        onAfterClose={() => {
          const action = pendingQuickActionRef.current
          pendingQuickActionRef.current = null
          action?.()
        }}
        onClose={() => setIsQuickActionOpen(false)}
        title={t('Quick actions')}
      >
        <div className="quick-action-list">
          <button
            type="button"
            onClick={() => {
              runAfterQuickActionsClose(() => {
                void navigate('/nutrition?logFood=1')
              })
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
              runAfterQuickActionsClose(openBodyweightSheet)
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
              runAfterQuickActionsClose(() => {
                void navigate('/training?createExercise=1')
              })
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
              runAfterQuickActionsClose(() => {
                void navigate('/training?createProgram=1')
              })
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

function workoutActivityStorageKey(workoutId: string) {
  return `fitness-log.workout-activity.${workoutId}`
}

function workoutBackgroundStorageKey(workoutId: string) {
  return `fitness-log.workout-backgrounded.${workoutId}`
}

function readStoredTimestamp(storageKey: string) {
  const stored = Number(window.localStorage.getItem(storageKey))
  return Number.isFinite(stored) && stored > 0 ? stored : null
}

function readWorkoutActivity(storageKey: string, fallbackTimestamp: string) {
  const stored = readStoredTimestamp(storageKey)
  if (stored) {
    return stored
  }
  const fallback = Date.parse(fallbackTimestamp)
  return Number.isFinite(fallback) ? fallback : Date.now()
}

function getRouteTitle(pathname: string, search = ''): string | null {
  if (pathname.startsWith('/calories')) {
    return 'Calories'
  }

  if (pathname.startsWith('/nutrition')) {
    return 'Nutrition'
  }

  if (pathname.startsWith('/training')) {
    if (new URLSearchParams(search).get('programView') === 'browse') {
      return null
    }
    return 'Current Program'
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
