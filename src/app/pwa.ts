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

  const workbox = new Workbox('/sw.js')

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

  function checkForUpdate() {
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
    },
  }

  return handle
}
