import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuth } from '@hooks/useAuth'

const authMocks = vi.hoisted(() => ({
  completePendingGoogleSignIn: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  onNativeAuthReturn: vi.fn(),
  signInWithApple: vi.fn(),
  signInWithGoogle: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
}))

vi.mock('@services/authService', () => ({
  authService: {
    completePendingGoogleSignIn: authMocks.completePendingGoogleSignIn,
    getSession: authMocks.getSession,
    onAuthStateChange: authMocks.onAuthStateChange,
    onNativeAuthReturn: authMocks.onNativeAuthReturn,
    signInWithApple: authMocks.signInWithApple,
    signInWithGoogle: authMocks.signInWithGoogle,
    signOut: authMocks.signOut,
  },
}))

beforeEach(() => {
  authMocks.completePendingGoogleSignIn.mockReset()
  authMocks.getSession.mockReset()
  authMocks.onAuthStateChange.mockReset()
  authMocks.onNativeAuthReturn.mockReset()
  authMocks.unsubscribe.mockReset()
  authMocks.completePendingGoogleSignIn.mockResolvedValue(false)
  authMocks.getSession.mockResolvedValue(null)
  authMocks.onAuthStateChange.mockReturnValue(authMocks.unsubscribe)
  authMocks.onNativeAuthReturn.mockReturnValue(vi.fn())
})

describe('useAuth', () => {
  it('checks the relay when the installed app regains focus', async () => {
    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.status).toBe('signedOut'))
    expect(authMocks.completePendingGoogleSignIn).toHaveBeenCalledWith(0)
    authMocks.completePendingGoogleSignIn.mockClear()

    act(() => window.dispatchEvent(new Event('focus')))

    await waitFor(() =>
      expect(authMocks.completePendingGoogleSignIn).toHaveBeenCalledWith(
        15_000,
      ),
    )
    expect(authMocks.onAuthStateChange).toHaveBeenCalledTimes(1)
  })

  it('preserves an existing session when the relay is temporarily unavailable', async () => {
    const existingUser = { id: 'existing-user' }
    authMocks.completePendingGoogleSignIn.mockRejectedValue(
      new Error('Relay unavailable'),
    )
    authMocks.getSession.mockResolvedValue({ user: existingUser })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.status).toBe('signedIn'))
    expect(result.current.user).toBe(existingUser)
    expect(authMocks.getSession).toHaveBeenCalledTimes(1)
  })
})
