import { Workbox } from 'workbox-window'

export type ServiceWorkerUpdateHandler = () => void

export function registerServiceWorkerUpdateHandler(
  onUpdateReady: ServiceWorkerUpdateHandler,
) {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return
  }

  const workbox = new Workbox('/sw.js')

  workbox.addEventListener('waiting', () => {
    onUpdateReady()
  })

  void workbox.register()
}
