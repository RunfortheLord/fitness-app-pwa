import type { User } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import {
  deleteAuthenticatedAccount,
  isAllowedAppOrigin,
  readBearerToken,
  type AccountDeletionAuthClient,
} from './accountDeletion'
import {
  encryptProviderToken,
  type OAuthProvider,
  type ProviderCredentialGateway,
} from './providerCredentials'
import { createMemoryServerRateLimiter } from './serverRateLimiter'

const TEST_ENCRYPTION_KEY = encodeBase64Url(new Uint8Array(32).fill(9))

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

    const providerCredentialGateway = await gatewayWithCredential(
      'google',
      'google-provider-token-value',
    )
    const revokeGoogle = vi.fn().mockResolvedValue(true)
    await expect(
      deleteAuthenticatedAccount({
        accessToken: 'verified.access.token.value',
        authClient: client,
        encryptionKey: TEST_ENCRYPTION_KEY,
        limiter: createMemoryServerRateLimiter(),
        providerCredentialGateway,
        providerRevokers: { google: revokeGoogle },
      }),
    ).resolves.toEqual({
      code: 'deleted',
      providerCleanup: { apple: 'not_linked', google: 'revoked' },
      status: 200,
    })
    expect(getUser).toHaveBeenCalledWith('verified.access.token.value')
    expect(deleteUser).toHaveBeenCalledWith('user-owned-by-token')
    expect(revokeGoogle).toHaveBeenCalledWith({
      token: 'google-provider-token-value',
      tokenType: 'refresh_token',
    })
  })

  it('uses manual Apple cleanup only for a legacy account with no credential', async () => {
    const { client } = authClientFor(userWithProvider('apple'))
    await expect(
      deleteAuthenticatedAccount({
        accessToken: 'verified.apple.token.value',
        authClient: client,
        encryptionKey: TEST_ENCRYPTION_KEY,
        limiter: createMemoryServerRateLimiter(),
        providerCredentialGateway: missingCredentialGateway(),
        providerRevokers: { apple: vi.fn().mockResolvedValue(true) },
      }),
    ).resolves.toEqual({
      code: 'deleted',
      providerCleanup: {
        apple: 'manual_required',
        google: 'not_linked',
      },
      status: 200,
    })
  })

  it('does not delete the account when Apple revocation fails', async () => {
    const { client, deleteUser } = authClientFor(userWithProvider('apple'))
    const providerCredentialGateway = await gatewayWithCredential(
      'apple',
      'apple-provider-token-value',
    )
    await expect(
      deleteAuthenticatedAccount({
        accessToken: 'verified.apple.token.value',
        authClient: client,
        encryptionKey: TEST_ENCRYPTION_KEY,
        limiter: createMemoryServerRateLimiter(),
        providerCredentialGateway,
        providerRevokers: { apple: vi.fn().mockResolvedValue(false) },
      }),
    ).resolves.toEqual({
      code: 'provider_revocation_failed',
      provider: 'apple',
      status: 502,
    })
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('does not delete the account when provider credential storage is unavailable', async () => {
    const { client, deleteUser } = authClientFor(userWithProvider('apple'))
    const providerCredentialGateway: ProviderCredentialGateway = {
      read: vi.fn().mockRejectedValue(new Error('database unavailable')),
      save: vi.fn(),
    }

    await expect(
      deleteAuthenticatedAccount({
        accessToken: 'verified.apple.token.value',
        authClient: client,
        encryptionKey: TEST_ENCRYPTION_KEY,
        limiter: createMemoryServerRateLimiter(),
        providerCredentialGateway,
        providerRevokers: { apple: vi.fn().mockResolvedValue(true) },
      }),
    ).resolves.toEqual({
      code: 'service_unavailable',
      retryAfterSeconds: 60,
      status: 503,
    })
    expect(deleteUser).not.toHaveBeenCalled()
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

async function gatewayWithCredential(
  provider: OAuthProvider,
  token: string,
): Promise<ProviderCredentialGateway> {
  const encryptedToken = await encryptProviderToken({
    encryptionKey: TEST_ENCRYPTION_KEY,
    provider,
    token,
    tokenType: 'refresh_token',
    userId: 'user-owned-by-token',
  })
  return {
    read: vi.fn().mockResolvedValue({
      credential: { encryptedToken, tokenType: 'refresh_token' },
      status: 'found',
    }),
    save: vi.fn(),
  }
}

function missingCredentialGateway(): ProviderCredentialGateway {
  return {
    read: vi.fn().mockResolvedValue({ status: 'missing' }),
    save: vi.fn(),
  }
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '')
}
