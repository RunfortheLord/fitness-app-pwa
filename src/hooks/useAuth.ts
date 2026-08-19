import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'

import { authService, type AuthStatus } from '@services/authService'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    let isCurrent = true
    let isRefreshing = false
    let unsubscribe: (() => void) | undefined

    async function loadSession(maxWaitMs = 0) {
      if (isRefreshing) {
        return
      }
      isRefreshing = true
      try {
        try {
          await authService.completePendingGoogleSignIn(maxWaitMs)
        } catch {
          // A temporary relay failure must not hide an existing cloud session.
        }
        const session = await authService.getSession()
        if (!isCurrent) {
          return
        }
        setUser(session?.user ?? null)
        setStatus(session?.user ? 'signedIn' : 'signedOut')
        unsubscribe ??= authService.onAuthStateChange((nextSession) => {
          setUser(nextSession?.user ?? null)
          setStatus(nextSession?.user ? 'signedIn' : 'signedOut')
        })
      } catch {
        if (isCurrent) {
          setUser(null)
          setStatus('signedOut')
        }
      } finally {
        isRefreshing = false
      }
    }

    void loadSession()

    function resumePendingSignIn() {
      if (document.visibilityState === 'visible') {
        void loadSession(15_000)
      }
    }

    document.addEventListener('visibilitychange', resumePendingSignIn)
    window.addEventListener('focus', resumePendingSignIn)
    const unsubscribeNativeReturn =
      authService.onNativeAuthReturn(resumePendingSignIn)

    return () => {
      isCurrent = false
      document.removeEventListener('visibilitychange', resumePendingSignIn)
      window.removeEventListener('focus', resumePendingSignIn)
      unsubscribeNativeReturn()
      unsubscribe?.()
    }
  }, [])

  return {
    user,
    status,
    signIn: authService.signInWithGoogle,
    signInWithApple: authService.signInWithApple,
    signOut: authService.signOut,
  }
}
