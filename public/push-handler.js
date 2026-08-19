self.REST_TIMER_NOTIFICATION_TAG = 'nutrifit-rest-timer'
self.REST_TIMER_NOTIFICATION_LIFETIME_MILLISECONDS = 6_000

self.addEventListener('push', (event) => {
  event.waitUntil(handleTimerPush(event))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/workout'
  event.waitUntil(openOrFocusApp(targetUrl))
})

async function handleTimerPush(event) {
  let payload = {}
  try {
    payload = event.data?.json() || {}
  } catch {
    payload = {}
  }

  await closeTimerNotifications()

  await self.registration.showNotification(payload.title || 'NutriFit Timer', {
    body: payload.body || 'Rest complete. Your next set is ready.',
    data: { url: payload.url || '/workout' },
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    renotify: false,
    tag: self.REST_TIMER_NOTIFICATION_TAG,
  })

  await delay(self.REST_TIMER_NOTIFICATION_LIFETIME_MILLISECONDS)
  await closeTimerNotifications()
}

async function closeTimerNotifications() {
  const notifications = await self.registration.getNotifications()
  notifications
    .filter(
      (notification) =>
        notification.tag === self.REST_TIMER_NOTIFICATION_TAG ||
        notification.tag === 'rest-timer-alert-preview' ||
        notification.tag.startsWith('rest-timer-'),
    )
    .forEach((notification) => notification.close())
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function openOrFocusApp(targetUrl) {
  const target = new URL(targetUrl, self.location.origin).href
  const windows = await self.clients.matchAll({
    includeUncontrolled: true,
    type: 'window',
  })
  for (const client of windows) {
    if ('focus' in client) {
      await client.navigate(target)
      return client.focus()
    }
  }
  return self.clients.openWindow(target)
}
