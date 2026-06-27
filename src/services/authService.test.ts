import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { authService } from '@services/authService'
import { getSupabaseClient } from '@services/supabaseClient'

const supabaseMocks = vi.hoisted(() => ({
  getSupabaseClient: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
}))

vi.mock('@services/supabaseClient', () => ({
  getSupabaseClient: supabaseMocks.getSupabaseClient,
}))

beforeEach(() => {
  supabaseMocks.getSession.mockReset()
  supabaseMocks.getUser.mockReset()
  supabaseMocks.onAuthStateChange.mockReset()
  supabaseMocks.signInWithOAuth.mockReset()
  supabaseMocks.signOut.mockReset()
  supabaseMocks.unsubscribe.mockReset()
  supabaseMocks.getSupabaseClient.mockReturnValue({
    auth: {
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
})

describe('authService', () => {
  it('starts Google OAuth through the Supabase client', async () => {
    supabaseMocks.signInWithOAuth.mockResolvedValue({ error: null })

    await authService.signInWithGoogle()

    expect(getSupabaseClient).toHaveBeenCalled()
    expect(supabaseMocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'http://localhost:3000/settings' },
    })
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
