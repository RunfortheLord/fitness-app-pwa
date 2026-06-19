import { Workbox } from 'workbox-window'

export type ServiceWorkerUpdate = {
  applyUpdate: () => void
  checkForUpdate: () => Promise<void>
}

export type ServiceWorkerUpdateHandler = (update: ServiceWorkerUpdate) => void

export function registerServiceWorkerUpdateHandler(
  onUpdateReady: ServiceWorkerUpdateHandler,
) {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return undefined
  }

  const workbox = new Workbox('/sw.js')
  let reloadForConfirmedUpdate = false

  const update: ServiceWorkerUpdate = {
    applyUpdate() {
      reloadForConfirmedUpdate = true
      workbox.messageSkipWaiting()
    },
    checkForUpdate() {
      return workbox.update()
    },
  }

  workbox.addEventListener('waiting', () => {
    onUpdateReady(update)
  })

  workbox.addEventListener('controlling', () => {
    if (reloadForConfirmedUpdate) {
      window.location.reload()
    }
  })

  void workbox
    .register()
    .then(() => workbox.update())
    .catch(() => undefined)

  return update
}
