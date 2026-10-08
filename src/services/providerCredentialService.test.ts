import type { Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { providerCredentialService } from '@services/providerCredentialService'

const mocks = vi.hoisted(() => ({ isNativePlatform: vi.fn() }))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: mocks.isNativePlatform },
}))

beforeEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  mocks.isNativePlatform.mockReset()
  mocks.isNativePlatform.mockReturnValue(false)
})

describe('providerCredentialService', () => {
  it('sends an Apple refresh token to the authenticated server route', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      providerCredentialService.captureFromSession(
        sessionFor('apple', {
          provider_refresh_token: 'apple-provider-refresh-token',
          provider_token: 'apple-provider-access-token',
        }),
      ),
    ).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/provider-credential',
      expect.objectContaining({
        body: JSON.stringify({
          provider: 'apple',
          token: 'apple-provider-refresh-token',
          tokenType: 'refresh_token',
        }),
        headers: expect.objectContaining({
          Authorization: 'Bearer supabase-access-token',
        }),
        method: 'POST',
      }),
    )
  })

  it('uses the configured production origin from a native app', async () => {
    mocks.isNativePlatform.mockReturnValue(true)
    vi.stubEnv('VITE_PUBLIC_APP_ORIGIN', 'https://app.example.com/')
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await providerCredentialService.captureFromSession(
      sessionFor('google', {
        provider_token: 'google-provider-access-token',
      }),
    )
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://app.example.com/api/auth/provider-credential',
    )
  })

  it('stores the same provider credential only once per app session', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const session = sessionFor('google', {
      provider_token: 'deduplicated-google-provider-token',
    })

    await providerCredentialService.captureFromSession(session)
    await providerCredentialService.captureFromSession(session)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does nothing when the session has no provider credential', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      providerCredentialService.captureFromSession(sessionFor('apple')),
    ).resolves.toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails sign-in finalization when secure storage is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 503 })),
    )
    await expect(
      providerCredentialService.captureFromSession(
        sessionFor('apple', {
          provider_token: 'apple-provider-access-token',
        }),
      ),
    ).rejects.toThrow('could not be secured for account deletion')
  })
})

function sessionFor(
  provider: 'apple' | 'google',
  tokens: {
    provider_refresh_token?: string
    provider_token?: string
  } = {},
) {
  return {
    access_token: 'supabase-access-token',
    expires_in: 3600,
    refresh_token: 'supabase-refresh-token',
    token_type: 'bearer',
    user: {
      app_metadata: { provider, providers: [provider] },
      aud: 'authenticated',
      created_at: '2026-10-08T00:00:00.000Z',
      id: 'user-1',
      user_metadata: {},
    },
    ...tokens,
  } as Session
}
