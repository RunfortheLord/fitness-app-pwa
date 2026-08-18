import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { authService } from '@services/authService'
import {
  createPendingAuthRelay,
  pollPendingAuthRelay,
  shouldUseAuthRelay,
} from '@services/authRelayClient'
import { getSupabaseClient } from '@services/supabaseClient'

const supabaseMocks = vi.hoisted(() => ({
  addListener: vi.fn(),
  browserOpen: vi.fn(),
  browserClose: vi.fn(),
  getSupabaseClient: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
  clearPendingAuthRelay: vi.fn(),
  createPendingAuthRelay: vi.fn(),
  pollPendingAuthRelay: vi.fn(),
  shouldUseAuthRelay: vi.fn(),
  isNativePlatform: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: supabaseMocks.isNativePlatform },
}))
vi.mock('@capacitor/app', () => ({
  App: { addListener: supabaseMocks.addListener },
}))
vi.mock('@capacitor/browser', () => ({
  Browser: {
    close: supabaseMocks.browserClose,
    open: supabaseMocks.browserOpen,
  },
}))

vi.mock('@services/supabaseClient', () => ({
  getSupabaseClient: supabaseMocks.getSupabaseClient,
}))

vi.mock('@services/authRelayClient', () => ({
  clearPendingAuthRelay: supabaseMocks.clearPendingAuthRelay,
  createPendingAuthRelay: supabaseMocks.createPendingAuthRelay,
  pollPendingAuthRelay: supabaseMocks.pollPendingAuthRelay,
  shouldUseAuthRelay: supabaseMocks.shouldUseAuthRelay,
}))

beforeEach(() => {
  supabaseMocks.addListener.mockReset()
  supabaseMocks.browserOpen.mockReset()
  supabaseMocks.browserClose.mockReset()
  supabaseMocks.isNativePlatform.mockReset()
  supabaseMocks.isNativePlatform.mockReturnValue(false)
  supabaseMocks.getSession.mockReset()
  supabaseMocks.getUser.mockReset()
  supabaseMocks.exchangeCodeForSession.mockReset()
  supabaseMocks.onAuthStateChange.mockReset()
  supabaseMocks.signInWithOAuth.mockReset()
  supabaseMocks.signOut.mockReset()
  supabaseMocks.unsubscribe.mockReset()
  supabaseMocks.clearPendingAuthRelay.mockReset()
  supabaseMocks.createPendingAuthRelay.mockReset()
  supabaseMocks.pollPendingAuthRelay.mockReset()
  supabaseMocks.shouldUseAuthRelay.mockReset()
  supabaseMocks.shouldUseAuthRelay.mockReturnValue(false)
  supabaseMocks.pollPendingAuthRelay.mockResolvedValue(undefined)
  supabaseMocks.getSupabaseClient.mockReturnValue({
    auth: {
      exchangeCodeForSession: supabaseMocks.exchangeCodeForSession,
      getSession: supabaseMocks.getSession,
      getUser: supabaseMocks.getUser,
      onAuthStateChange: supabaseMocks.onAuthStateChange,
      signInWithOAuth: supabaseMocks.signInWithOAuth,
      signOut: supabaseMocks.signOut,
    },
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('authService', () => {
  it('starts Google OAuth through the Supabase client', async () => {
    supabaseMocks.signInWithOAuth.mockResolvedValue({ error: null })

    await authService.signInWithGoogle()

    expect(getSupabaseClient).toHaveBeenCalled()
    expect(supabaseMocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        queryParams: { prompt: 'select_account' },
        redirectTo: 'http://localhost:3000/settings',
        skipBrowserRedirect: false,
      },
    })
  })

  it('starts standalone Google OAuth through a one-time relay', async () => {
    supabaseMocks.shouldUseAuthRelay.mockReturnValue(true)
    supabaseMocks.createPendingAuthRelay.mockResolvedValue({
      expiresAt: Date.now() + 300_000,
      relayId: '123e4567-e89b-42d3-a456-426614174000',
      retrievalSecret: 'A'.repeat(43),
    })
    supabaseMocks.signInWithOAuth.mockResolvedValue({ error: null })

    await authService.signInWithGoogle()

    expect(shouldUseAuthRelay).toHaveBeenCalled()
    expect(createPendingAuthRelay).toHaveBeenCalled()
    expect(supabaseMocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        queryParams: { prompt: 'select_account' },
        redirectTo:
          'http://localhost:3000/auth/callback/123e4567-e89b-42d3-a456-426614174000',
        skipBrowserRedirect: false,
      },
    })
  })

  it('starts Apple OAuth without Google-specific query parameters', async () => {
    supabaseMocks.signInWithOAuth.mockResolvedValue({ error: null })

    await authService.signInWithApple()

    expect(supabaseMocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'apple',
      options: {
        redirectTo: 'http://localhost:3000/settings',
        skipBrowserRedirect: false,
      },
    })
  })

  it('opens native Apple OAuth in the system browser with a return marker', async () => {
    vi.stubEnv('VITE_PUBLIC_APP_ORIGIN', 'https://app.vigorune.example')
    supabaseMocks.isNativePlatform.mockReturnValue(true)
    supabaseMocks.shouldUseAuthRelay.mockReturnValue(true)
    supabaseMocks.createPendingAuthRelay.mockResolvedValue({
      expiresAt: Date.now() + 300_000,
      relayId: '123e4567-e89b-42d3-a456-426614174000',
      retrievalSecret: 'A'.repeat(43),
    })
    supabaseMocks.signInWithOAuth.mockResolvedValue({
      data: { url: 'https://appleid.apple.com/auth/authorize' },
      error: null,
    })

    await authService.signInWithApple()

    expect(supabaseMocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'apple',
      options: {
        redirectTo:
          'https://app.vigorune.example/auth/callback/123e4567-e89b-42d3-a456-426614174000?native=1',
        skipBrowserRedirect: true,
      },
    })
    expect(supabaseMocks.browserOpen).toHaveBeenCalledWith({
      presentationStyle: 'popover',
      url: 'https://appleid.apple.com/auth/authorize',
    })
  })

  it('exchanges a relayed PKCE code only inside the initiating app', async () => {
    supabaseMocks.pollPendingAuthRelay.mockResolvedValue({
      code: 'one-time-code',
      status: 'ready',
    })
    supabaseMocks.exchangeCodeForSession.mockResolvedValue({ error: null })

    await expect(authService.completePendingGoogleSignIn(15_000)).resolves.toBe(
      true,
    )

    expect(pollPendingAuthRelay).toHaveBeenCalledWith({ maxWaitMs: 15_000 })
    expect(supabaseMocks.exchangeCodeForSession).toHaveBeenCalledWith(
      'one-time-code',
    )
  })

  it('clears the pending relay when OAuth cannot start', async () => {
    supabaseMocks.shouldUseAuthRelay.mockReturnValue(true)
    supabaseMocks.createPendingAuthRelay.mockResolvedValue({
      expiresAt: Date.now() + 300_000,
      relayId: '123e4567-e89b-42d3-a456-426614174000',
      retrievalSecret: 'A'.repeat(43),
    })
    supabaseMocks.signInWithOAuth.mockResolvedValue({
      error: { message: 'provider failed' },
    })

    await expect(authService.signInWithGoogle()).rejects.toThrow(
      'provider failed',
    )
    expect(supabaseMocks.clearPendingAuthRelay).toHaveBeenCalled()
  })

  it('returns the current session and user', async () => {
    const session = {
      user: { email: 'person@example.com', id: 'user-1' },
    }
    const user = { email: 'person@example.com', id: 'user-1' }
    supabaseMocks.getSession.mockResolvedValue({
      data: { session },
      error: null,
    })
    supabaseMocks.getUser.mockResolvedValue({ data: { user }, error: null })

    await expect(authService.getSession()).resolves.toBe(session)
    await expect(authService.getUser()).resolves.toBe(user)
  })

  it('signs out and exposes auth-state cleanup', async () => {
    supabaseMocks.signOut.mockResolvedValue({ error: null })
    supabaseMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: supabaseMocks.unsubscribe } },
    })

    await authService.signOut()
    const unsubscribe = authService.onAuthStateChange(vi.fn())
    unsubscribe()

    expect(supabaseMocks.signOut).toHaveBeenCalled()
    expect(supabaseMocks.unsubscribe).toHaveBeenCalled()
  })

  it('throws clear errors when Supabase returns an auth error', async () => {
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'session failed' },
    })

    await expect(authService.getSession()).rejects.toThrow('session failed')
  })
})
