self.addEventListener('push', (event) => {
  event.waitUntil(handleTimerPush(event))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/workout'
  event.waitUntil(openOrFocusApp(targetUrl))
})

async function handleTimerPush(event) {
  const windows = await self.clients.matchAll({
    includeUncontrolled: true,
    type: 'window',
  })
  if (windows.some((client) => client.visibilityState === 'visible')) {
    return
  }

  let payload = {}
  try {
    payload = event.data?.json() || {}
  } catch {
    payload = {}
  }

  await self.registration.showNotification(payload.title || 'NutriFit Timer', {
    body: payload.body || 'Rest complete. Your next set is ready.',
    data: { url: payload.url || '/workout' },
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    renotify: false,
    tag: payload.tag || 'nutrifit-rest-timer',
  })
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
