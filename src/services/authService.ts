import type { Session, User } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'

import {
  clearPendingAuthRelay,
  createPendingAuthRelay,
  pollPendingAuthRelay,
  shouldUseAuthRelay,
} from '@services/authRelayClient'
import { getSupabaseClient } from '@services/supabaseClient'

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut'

export type AuthStateChangeCallback = (session: Session | null) => void
export type AuthProvider = 'apple' | 'google'

const NATIVE_AUTH_RETURN_URL = 'vigorune://auth-complete'

async function signInWithProvider(provider: AuthProvider) {
  const usesRelay = typeof window !== 'undefined' && shouldUseAuthRelay()
  const isNative = Capacitor.isNativePlatform()
  const relay = usesRelay ? await createPendingAuthRelay() : undefined
  const configuredPublicOrigin = import.meta.env.VITE_PUBLIC_APP_ORIGIN?.trim()
  if (isNative && !configuredPublicOrigin) {
    clearPendingAuthRelay()
    throw new Error(
      'Native sign-in is not configured. Set VITE_PUBLIC_APP_ORIGIN before building the iOS app.',
    )
  }
  const redirectOrigin = isNative
    ? configuredPublicOrigin?.replace(/\/+$/, '')
    : typeof window === 'undefined'
      ? undefined
      : window.location.origin
  const redirectTo = !redirectOrigin
    ? undefined
    : relay
      ? `${redirectOrigin}/auth/callback/${encodeURIComponent(relay.relayId)}${isNative ? '?native=1' : ''}`
      : `${redirectOrigin}/settings`
  try {
    const { data, error } = await getSupabaseClient().auth.signInWithOAuth({
      provider,
      options: {
        ...(provider === 'google'
          ? { queryParams: { prompt: 'select_account' } }
          : {}),
        ...(redirectTo ? { redirectTo } : {}),
        skipBrowserRedirect: isNative,
      },
    })

    if (error) {
      throw new Error(
        error.message || `${providerName(provider)} sign-in could not start.`,
      )
    }
    if (isNative) {
      if (!data.url) {
        throw new Error(`${providerName(provider)} sign-in could not start.`)
      }
      await Browser.open({ presentationStyle: 'popover', url: data.url })
    }
  } catch (caught) {
    if (relay) {
      clearPendingAuthRelay()
    }
    throw caught
  }
}

export const authService = {
  async signInWithGoogle() {
    await signInWithProvider('google')
  },

  async signInWithApple() {
    await signInWithProvider('apple')
  },

  async completePendingGoogleSignIn(maxWaitMs = 0) {
    const result = await pollPendingAuthRelay({ maxWaitMs })
    if (!result || result.status === 'pending') {
      return false
    }
    if (result.status !== 'ready') {
      throw new Error('Sign-in was not completed. Please try again.')
    }
    const { error } = await getSupabaseClient().auth.exchangeCodeForSession(
      result.code,
    )
    if (error) {
      throw new Error(error.message || 'Sign-in could not be completed.')
    }
    return true
  },

  async signOut() {
    clearPendingAuthRelay()
    const { error } = await getSupabaseClient().auth.signOut()
    if (error) {
      throw new Error(error.message || 'Sign-out failed.')
    }
  },

  async clearLocalSession() {
    clearPendingAuthRelay()
    const { error } = await getSupabaseClient().auth.signOut({ scope: 'local' })
    if (error && !/session.*missing|invalid.*token/i.test(error.message)) {
      throw new Error(error.message || 'Local session could not be cleared.')
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

  onNativeAuthReturn(callback: () => void) {
    if (!Capacitor.isNativePlatform()) {
      return () => undefined
    }
    let active = true
    let removeListener: (() => Promise<void>) | undefined
    void App.addListener('appUrlOpen', ({ url }) => {
      if (url.toLowerCase().startsWith(NATIVE_AUTH_RETURN_URL)) {
        void Browser.close().catch(() => undefined)
        callback()
      }
    }).then((handle) => {
      if (!active) {
        void handle.remove()
        return
      }
      removeListener = handle.remove
    })
    return () => {
      active = false
      void removeListener?.()
    }
  },
}

function providerName(provider: AuthProvider) {
  return provider === 'apple' ? 'Apple' : 'Google'
}
