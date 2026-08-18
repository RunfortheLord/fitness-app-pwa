import { useEffect, useState } from 'react'

import {
  forwardAuthRelayCallback,
  scrubAuthRelayCallbackUrl,
  shouldUseAuthRelay,
  type AuthRelayCallback,
} from '@services/authRelayClient'

type CallbackStatus = 'forwarding' | 'ready' | 'failed'
const RETURN_TO_APP_DELAY_MS = 400

function returnToSettings() {
  window.location.replace('/settings?auth_relay_callback=received')
}

function returnToNativeApp() {
  window.location.assign('vigorune://auth-complete')
}

export function AuthRelayCallbackPage({
  callback,
  isStandalone = shouldUseAuthRelay(),
  nativeReturnToApp = returnToNativeApp,
  returnToApp = returnToSettings,
}: {
  callback: AuthRelayCallback
  isStandalone?: boolean
  nativeReturnToApp?: () => void
  returnToApp?: () => void
}) {
  const [status, setStatus] = useState<CallbackStatus>('forwarding')
  const shouldReturnToApp = callback.returnToNativeApp || isStandalone
  const returnAction = callback.returnToNativeApp
    ? nativeReturnToApp
    : returnToApp

  useEffect(() => {
    scrubAuthRelayCallbackUrl(window.history)
    let isCurrent = true
    void forwardAuthRelayCallback(callback)
      .then(() => {
        if (isCurrent) {
          setStatus(callback.status === 'ready' ? 'ready' : 'failed')
        }
      })
      .catch(() => {
        if (isCurrent) {
          setStatus('failed')
        }
      })
    return () => {
      isCurrent = false
    }
  }, [callback])

  useEffect(() => {
    if (status !== 'ready' || !shouldReturnToApp) {
      return
    }
    const timeoutId = window.setTimeout(returnAction, RETURN_TO_APP_DELAY_MS)
    return () => window.clearTimeout(timeoutId)
  }, [returnAction, shouldReturnToApp, status])

  return (
    <main className="auth-relay-page">
      <section className="auth-relay-card" aria-live="polite">
        <p className="eyebrow">Vigorune cloud backup</p>
        <h1>
          {status === 'forwarding'
            ? 'Finishing secure sign-in…'
            : status === 'ready'
              ? 'Sign-in approved'
              : 'Sign-in was not completed'}
        </h1>
        <p>
          {status === 'forwarding'
            ? 'Keep this page open for a moment.'
            : status === 'ready'
              ? shouldReturnToApp
                ? 'Returning to Vigorune Settings to finish your session.'
                : 'Close this Safari tab and return to the installed Vigorune app. Your session will finish there.'
              : 'Close this Safari tab, return to the installed Vigorune app, and try again.'}
        </p>
        {status === 'ready' && shouldReturnToApp ? (
          <button
            className="button button-primary auth-relay-return"
            onClick={returnAction}
            type="button"
          >
            Continue to Vigorune
          </button>
        ) : null}
      </section>
    </main>
  )
}
