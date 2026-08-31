import { Workbox } from 'workbox-window'

const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000

export type ServiceWorkerUpdate = {
  applyUpdate: () => void
  checkForUpdate: () => Promise<void>
}

export type ServiceWorkerUpdateHandler = (update: ServiceWorkerUpdate) => void

export type ServiceWorkerRegistrationHandle = ServiceWorkerUpdate & {
  cleanup: () => void
}

export function registerServiceWorkerUpdateHandler(
  onUpdateReady: ServiceWorkerUpdateHandler,
): ServiceWorkerRegistrationHandle | undefined {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return undefined
  }

  // `updateViaCache: 'none'` forces the browser to revalidate sw.js from the
  // network on every update check instead of serving a stale HTTP-cached copy.
  // Without it, iOS can keep handing back an old sw.js and never notice a new
  // deployment, leaving the app on stale code even though a build is live.
  const workbox = new Workbox('/sw.js', { updateViaCache: 'none' })

  const update: ServiceWorkerUpdate = {
    applyUpdate() {
      workbox.messageSkipWaiting()
    },
    checkForUpdate() {
      return workbox.update()
    },
  }

  workbox.addEventListener('waiting', () => {
    onUpdateReady(update)
  })

  // When an updated worker takes control of this page, reload once so the app
  // is actually running the freshly deployed assets — this is what makes a
  // deploy land without the user force-quitting and relaunching. Guarded so it
  // only fires for real updates (never the first install) and never loops.
  // A reload is deferred while a live workout is open so a mid-set update can
  // never interrupt logging; it is applied at the next safe checkpoint instead
  // (workout state persists to IndexedDB regardless, so nothing is lost).
  let hasReloadedForUpdate = false
  let updateReloadPending = false

  function isLiveWorkoutOpen() {
    return document.body.classList.contains('live-workout-open')
  }

  function reloadForUpdateIfSafe() {
    if (hasReloadedForUpdate || !updateReloadPending) {
      return
    }
    if (isLiveWorkoutOpen()) {
      return
    }
    hasReloadedForUpdate = true
    window.location.reload()
  }

  workbox.addEventListener('controlling', (event) => {
    if (event.isUpdate || event.isExternal) {
      updateReloadPending = true
      reloadForUpdateIfSafe()
    }
  })

  function checkForUpdate() {
    reloadForUpdateIfSafe()
    if (navigator.onLine) {
      void update.checkForUpdate().catch(() => undefined)
    }
  }

  function checkForUpdateWhenVisible() {
    if (document.visibilityState === 'visible') {
      checkForUpdate()
    }
  }

  document.addEventListener('visibilitychange', checkForUpdateWhenVisible)
  window.addEventListener('online', checkForUpdate)
  window.addEventListener('pageshow', checkForUpdate)
  const intervalId = window.setInterval(
    checkForUpdateWhenVisible,
    UPDATE_CHECK_INTERVAL_MS,
  )

  // Apply a deferred update reload the instant the live workout screen closes,
  // rather than waiting for the next visibility/interval checkpoint.
  const bodyClassObserver =
    typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(() => reloadForUpdateIfSafe())
  bodyClassObserver?.observe(document.body, {
    attributeFilter: ['class'],
    attributes: true,
  })

  void workbox
    .register()
    .then(() => workbox.update())
    .catch(() => undefined)

  const handle: ServiceWorkerRegistrationHandle = {
    applyUpdate: update.applyUpdate,
    checkForUpdate: update.checkForUpdate,
    cleanup() {
      document.removeEventListener(
        'visibilitychange',
        checkForUpdateWhenVisible,
      )
      window.removeEventListener('online', checkForUpdate)
      window.removeEventListener('pageshow', checkForUpdate)
      window.clearInterval(intervalId)
      bodyClassObserver?.disconnect()
    },
  }

  return handle
}
