import type { User } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import {
  deleteAuthenticatedAccount,
  isAllowedAppOrigin,
  readBearerToken,
  type AccountDeletionAuthClient,
} from './accountDeletion'
import { createMemoryServerRateLimiter } from './serverRateLimiter'

function authClientFor(user: User | null) {
  const getUser = vi.fn().mockResolvedValue({ data: { user }, error: null })
  const deleteUser = vi.fn().mockResolvedValue({ error: null })
  const client: AccountDeletionAuthClient = {
    auth: { admin: { deleteUser }, getUser },
  }
  return { client, deleteUser, getUser }
}

function userWithProvider(provider: 'apple' | 'google'): User {
  return {
    app_metadata: { provider, providers: [provider] },
    aud: 'authenticated',
    created_at: '2026-08-18T00:00:00.000Z',
    id: 'user-owned-by-token',
    user_metadata: {},
  }
}

describe('account deletion', () => {
  it('derives the deleted user only from a verified access token', async () => {
    const { client, deleteUser, getUser } = authClientFor(
      userWithProvider('google'),
    )

    await expect(
      deleteAuthenticatedAccount({
        accessToken: 'verified.access.token.value',
        authClient: client,
        limiter: createMemoryServerRateLimiter(),
      }),
    ).resolves.toEqual({
      code: 'deleted',
      providerRevocation: 'not_required',
      status: 200,
    })
    expect(getUser).toHaveBeenCalledWith('verified.access.token.value')
    expect(deleteUser).toHaveBeenCalledWith('user-owned-by-token')
  })

  it('reports the separate Apple authorization cleanup after deletion', async () => {
    const { client } = authClientFor(userWithProvider('apple'))
    await expect(
      deleteAuthenticatedAccount({
        accessToken: 'verified.apple.token.value',
        authClient: client,
        limiter: createMemoryServerRateLimiter(),
      }),
    ).resolves.toMatchObject({
      code: 'deleted',
      providerRevocation: 'manual_apple',
    })
  })

  it('never calls the admin delete API for an invalid session', async () => {
    const { client, deleteUser } = authClientFor(null)
    await expect(
      deleteAuthenticatedAccount({
        accessToken: 'unverified.access.token.value',
        authClient: client,
        limiter: createMemoryServerRateLimiter(),
      }),
    ).resolves.toEqual({ code: 'unauthorized', status: 401 })
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('fails closed when distributed deletion throttling is unavailable', async () => {
    const { client, deleteUser } = authClientFor(userWithProvider('google'))
    await expect(
      deleteAuthenticatedAccount({
        accessToken: 'verified.access.token.value',
        authClient: client,
        limiter: undefined,
      }),
    ).resolves.toMatchObject({ code: 'service_unavailable', status: 503 })
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('accepts only bounded bearer tokens and trusted app origins', () => {
    expect(readBearerToken('Bearer valid.access.token.value')).toBe(
      'valid.access.token.value',
    )
    expect(readBearerToken('Basic credentials')).toBeUndefined()
    expect(
      isAllowedAppOrigin({
        host: 'app.example.com',
        origin: 'https://app.example.com',
        publicAppOrigin: undefined,
      }),
    ).toBe(true)
    expect(
      isAllowedAppOrigin({
        host: 'app.example.com',
        origin: 'https://attacker.example',
        publicAppOrigin: undefined,
      }),
    ).toBe(false)
    expect(
      isAllowedAppOrigin({
        host: 'app.example.com@attacker.example',
        origin: 'https://attacker.example',
        publicAppOrigin: undefined,
      }),
    ).toBe(false)
    expect(
      isAllowedAppOrigin({
        host: 'localhost:5173',
        origin: 'http://localhost:5173',
        publicAppOrigin: undefined,
      }),
    ).toBe(true)
    expect(
      isAllowedAppOrigin({
        host: undefined,
        origin: 'capacitor://localhost',
        publicAppOrigin: undefined,
      }),
    ).toBe(true)
  })
})
