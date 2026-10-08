import type { User } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import {
  createAppleClientSecret,
  createAppleProviderRevoker,
  createGoogleProviderRevoker,
  decryptProviderToken,
  encryptProviderToken,
  registerAuthenticatedProviderCredential,
  type AppleRevocationConfig,
  type ProviderCredentialAuthClient,
  type ProviderCredentialGateway,
} from './providerCredentials'

const TEST_ENCRYPTION_KEY = encodeBase64Url(new Uint8Array(32).fill(7))

describe('provider credentials', () => {
  it('encrypts tokens with bound AES-GCM context and decrypts them', async () => {
    const encryptedToken = await encryptProviderToken({
      encryptionKey: TEST_ENCRYPTION_KEY,
      provider: 'apple',
      token: 'apple-provider-token-value',
      tokenType: 'refresh_token',
      userId: 'user-1',
    })

    await expect(
      decryptProviderToken({
        encryptedToken,
        encryptionKey: TEST_ENCRYPTION_KEY,
        provider: 'apple',
        tokenType: 'refresh_token',
        userId: 'user-1',
      }),
    ).resolves.toBe('apple-provider-token-value')
    await expect(
      decryptProviderToken({
        encryptedToken,
        encryptionKey: TEST_ENCRYPTION_KEY,
        provider: 'google',
        tokenType: 'refresh_token',
        userId: 'user-1',
      }),
    ).rejects.toThrow()
  })

  it('stores only a credential belonging to the verified provider identity', async () => {
    const save = vi
      .fn<ProviderCredentialGateway['save']>()
      .mockResolvedValue(true)
    const gateway: ProviderCredentialGateway = {
      read: vi.fn(),
      save,
    }
    const authClient = authClientFor(userWithProvider('apple'))

    await expect(
      registerAuthenticatedProviderCredential({
        accessToken: 'verified-supabase-access-token',
        authClient,
        encryptionKey: TEST_ENCRYPTION_KEY,
        gateway,
        provider: 'apple',
        token: 'apple-provider-token-value',
        tokenType: 'refresh_token',
      }),
    ).resolves.toEqual({ code: 'stored', status: 204 })
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'apple',
        tokenType: 'refresh_token',
        userId: 'user-1',
      }),
    )
    expect(JSON.stringify(save.mock.calls)).not.toContain(
      'apple-provider-token-value',
    )

    await expect(
      registerAuthenticatedProviderCredential({
        accessToken: 'verified-supabase-access-token',
        authClient,
        encryptionKey: TEST_ENCRYPTION_KEY,
        gateway,
        provider: 'google',
        token: 'google-provider-token-value',
        tokenType: 'access_token',
      }),
    ).resolves.toEqual({ code: 'unauthorized', status: 401 })
  })

  it('creates a short-lived Apple client secret and revokes with a form request', async () => {
    const config = await appleConfig()
    const now = Date.UTC(2026, 9, 8, 12)
    const clientSecret = await createAppleClientSecret(config, now)
    const [encodedHeader, encodedPayload, signature] = clientSecret.split('.')
    expect(readJwtPart(encodedHeader)).toMatchObject({
      alg: 'ES256',
      kid: 'KEYID12345',
    })
    expect(readJwtPart(encodedPayload)).toMatchObject({
      aud: 'https://appleid.apple.com',
      exp: Math.floor(now / 1_000) + 300,
      iss: 'TEAMID1234',
      sub: 'com.example.web',
    })
    expect(signature).toMatch(/^[A-Za-z0-9_-]+$/u)

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 200 }))
    const revoke = createAppleProviderRevoker({
      config,
      fetchImpl: fetchMock,
      now: () => now,
    })
    await expect(
      revoke({
        token: 'apple-provider-refresh-token',
        tokenType: 'refresh_token',
      }),
    ).resolves.toBe(true)
    const request = fetchMock.mock.calls[0]
    expect(request?.[0]).toBe('https://appleid.apple.com/auth/revoke')
    expect(String(request?.[1]?.body)).toContain(
      'token=apple-provider-refresh-token',
    )
    expect(String(request?.[1]?.body)).not.toContain(config.privateKey)
  })

  it('treats provider revocation network and HTTP failures as retryable failures', async () => {
    const googleFailure = createGoogleProviderRevoker({
      fetchImpl: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 400 })),
    })
    await expect(
      googleFailure({
        token: 'google-provider-access-token',
        tokenType: 'access_token',
      }),
    ).resolves.toBe(false)

    const googleSuccess = createGoogleProviderRevoker({
      fetchImpl: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 200 })),
    })
    await expect(
      googleSuccess({
        token: 'google-provider-access-token',
        tokenType: 'access_token',
      }),
    ).resolves.toBe(true)
  })

  it('treats an expired or already revoked Google token as cleaned up', async () => {
    const revoke = createGoogleProviderRevoker({
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(
        Response.json(
          {
            error: 'invalid_token',
            error_description: 'Token expired or revoked',
          },
          { status: 400 },
        ),
      ),
    })

    await expect(
      revoke({
        token: 'google-provider-access-token',
        tokenType: 'access_token',
      }),
    ).resolves.toBe(true)
  })

  it('does not accept a malformed Google revocation request as success', async () => {
    const revoke = createGoogleProviderRevoker({
      fetchImpl: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json({ error: 'invalid_request' }, { status: 400 }),
        ),
    })

    await expect(
      revoke({
        token: 'google-provider-access-token',
        tokenType: 'access_token',
      }),
    ).resolves.toBe(false)
  })
})

function authClientFor(user: User): ProviderCredentialAuthClient {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  }
}

function userWithProvider(provider: 'apple' | 'google'): User {
  return {
    app_metadata: { provider, providers: [provider] },
    aud: 'authenticated',
    created_at: '2026-10-08T00:00:00.000Z',
    id: 'user-1',
    user_metadata: {},
  }
}

async function appleConfig(): Promise<AppleRevocationConfig> {
  const keys = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  )
  if (!('privateKey' in keys)) {
    throw new Error('Expected an ECDSA key pair.')
  }
  const pkcs8 = new Uint8Array(
    await crypto.subtle.exportKey('pkcs8', keys.privateKey),
  )
  const begin = ['-----BEGIN ', 'PRIVATE KEY-----'].join('')
  const end = ['-----END ', 'PRIVATE KEY-----'].join('')
  return {
    clientId: 'com.example.web',
    keyId: 'KEYID12345',
    privateKey: `${begin}\n${encodeBase64(pkcs8)}\n${end}`,
    teamId: 'TEAMID1234',
  }
}

function readJwtPart(value: string | undefined) {
  if (!value) {
    throw new Error('Missing JWT part.')
  }
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  return JSON.parse(atob(normalized)) as unknown
}

function encodeBase64Url(bytes: Uint8Array) {
  return encodeBase64(bytes)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '')
}

function encodeBase64(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}
