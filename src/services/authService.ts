import type { Session, User } from '@supabase/supabase-js'

import { getSupabaseClient } from '@services/supabaseClient'

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut'

export type AuthStateChangeCallback = (session: Session | null) => void

export const authService = {
  async signInWithGoogle() {
    const redirectTo =
      typeof window === 'undefined'
        ? undefined
        : `${window.location.origin}/settings`
    const { error } = await getSupabaseClient().auth.signInWithOAuth({
      provider: 'google',
      options: redirectTo ? { redirectTo } : undefined,
    })

    if (error) {
      throw new Error(error.message || 'Google sign-in could not start.')
    }
  },

  async signOut() {
    const { error } = await getSupabaseClient().auth.signOut()
    if (error) {
      throw new Error(error.message || 'Sign-out failed.')
    }
  },

  async getSession(): Promise<Session | null> {
    const { data, error } = await getSupabaseClient().auth.getSession()
    if (error) {
      throw new Error(error.message || 'Session could not be loaded.')
    }
    return data.session
  },

  async getUser(): Promise<User | null> {
    const { data, error } = await getSupabaseClient().auth.getUser()
    if (error) {
      throw new Error(error.message || 'User could not be loaded.')
    }
    return data.user
  },

  onAuthStateChange(callback: AuthStateChangeCallback) {
    const { data } = getSupabaseClient().auth.onAuthStateChange(
      (_event, session) => callback(session),
    )

    return () => data.subscription.unsubscribe()
  },
}
