import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'

import { AuthRelayCallbackPage } from '@app/AuthRelayCallbackPage'
import { router } from '@app/router'
import {
  readAuthRelayCallback,
  scrubAuthRelayCallbackUrl,
} from '@services/authRelayClient'
import {
  initializeAppDataOnce,
  initializeNonCriticalAppDataOnce,
} from '@services/appStartupService'
import {
  registerAnalyticsAutoFlush,
  trackAnalyticsEvent,
} from '@services/analyticsService'
import '@styles/global.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element was not found.')
}

const authRelayCallback = readAuthRelayCallback(window.location)

if (authRelayCallback) {
  scrubAuthRelayCallbackUrl(window.history)
  createRoot(rootElement).render(
    <StrictMode>
      <AuthRelayCallbackPage callback={authRelayCallback} />
    </StrictMode>,
  )
} else {
  void initializeAppDataOnce()
  void initializeNonCriticalAppDataOnce()
  // Anonymous, opt-out, off-by-default launch metric: one app-open signal plus a
  // reconnect flush for anything queued while offline. See docs/ANALYTICS.md.
  registerAnalyticsAutoFlush()
  trackAnalyticsEvent('app_opened')
  createRoot(rootElement).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}
