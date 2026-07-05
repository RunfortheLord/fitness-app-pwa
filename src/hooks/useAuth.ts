import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'

import { authService, type AuthStatus } from '@services/authService'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    let isCurrent = true
    let unsubscribe: (() => void) | undefined

    async function loadSession() {
      try {
        const session = await authService.getSession()
        if (!isCurrent) {
          return
        }
        setUser(session?.user ?? null)
        setStatus(session?.user ? 'signedIn' : 'signedOut')
        unsubscribe = authService.onAuthStateChange((nextSession) => {
          setUser(nextSession?.user ?? null)
          setStatus(nextSession?.user ? 'signedIn' : 'signedOut')
        })
      } catch {
        if (isCurrent) {
          setUser(null)
          setStatus('signedOut')
        }
      }
    }

    void loadSession()

    return () => {
      isCurrent = false
      unsubscribe?.()
    }
  }, [])

  return {
    user,
    status,
    signIn: authService.signInWithGoogle,
    signOut: authService.signOut,
  }
}
