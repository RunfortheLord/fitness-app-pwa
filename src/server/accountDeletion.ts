import type { User } from '@supabase/supabase-js'

import {
  evaluateRateLimit,
  type ServerRateLimiter,
} from './serverRateLimiter.js'
import {
  decryptProviderToken,
  linkedOAuthProviders,
  type OAuthProvider,
  type ProviderCredentialGateway,
  type ProviderCredentialReadResult,
  type ProviderRevokers,
} from './providerCredentials.js'

export type AccountDeletionAuthClient = {
  auth: {
    admin: {
      deleteUser(
        userId: string,
      ): Promise<{ error: { message?: string } | null }>
    }
    getUser(accessToken: string): Promise<{
      data: { user: User | null }
      error: { message?: string } | null
    }>
  }
}

export type AccountDeletionResult =
  | {
      code: 'deleted'
      providerCleanup: Record<
        OAuthProvider,
        'manual_required' | 'not_linked' | 'revoked'
      >
      status: 200
    }
  | {
      code: 'rate_limited' | 'service_unavailable'
      retryAfterSeconds: number
      status: 429 | 503
    }
  | { code: 'unauthorized'; status: 401 }
  | {
      code: 'deletion_failed' | 'provider_revocation_failed'
      provider?: OAuthProvider
      status: 502
    }

export async function deleteAuthenticatedAccount({
  accessToken,
  authClient,
  encryptionKey,
  limiter,
  providerCredentialGateway,
  providerRevokers = {},
}: {
  accessToken: string
  authClient: AccountDeletionAuthClient
  encryptionKey?: string
  limiter: ServerRateLimiter | undefined
  providerCredentialGateway?: ProviderCredentialGateway
  providerRevokers?: ProviderRevokers
}): Promise<AccountDeletionResult> {
  if (!isAccessToken(accessToken)) {
    return { code: 'unauthorized', status: 401 }
  }

  const { data, error } = await authClient.auth.getUser(accessToken)
  if (error || !data.user) {
    return { code: 'unauthorized', status: 401 }
  }

  const rateLimit = await evaluateRateLimit({
    failClosed: true,
    key: data.user.id,
    limit: 3,
    limiter,
    scope: 'account-delete',
    windowMs: 60 * 60 * 1_000,
  })
  if (!rateLimit.allowed) {
    return {
      code: rateLimit.available ? 'rate_limited' : 'service_unavailable',
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      status: rateLimit.available ? 429 : 503,
    }
  }

  const linkedProviders = linkedOAuthProviders(data.user)
  const providerCleanup: AccountDeletionResult & { code: 'deleted' } = {
    code: 'deleted',
    providerCleanup: { apple: 'not_linked', google: 'not_linked' },
    status: 200,
  }
  for (const provider of linkedProviders) {
    const revoker = providerRevokers[provider]
    if (!providerCredentialGateway || !encryptionKey || !revoker) {
      return {
        code: 'service_unavailable',
        retryAfterSeconds: 60,
        status: 503,
      }
    }
    let storedCredential: ProviderCredentialReadResult
    try {
      storedCredential = await providerCredentialGateway.read(
        data.user.id,
        provider,
      )
    } catch {
      return {
        code: 'service_unavailable',
        retryAfterSeconds: 60,
        status: 503,
      }
    }
    if (storedCredential.status === 'unavailable') {
      return {
        code: 'service_unavailable',
        retryAfterSeconds: 60,
        status: 503,
      }
    }
    if (storedCredential.status === 'missing') {
      providerCleanup.providerCleanup[provider] = 'manual_required'
      continue
    }
    try {
      const token = await decryptProviderToken({
        encryptedToken: storedCredential.credential.encryptedToken,
        encryptionKey,
        provider,
        tokenType: storedCredential.credential.tokenType,
        userId: data.user.id,
      })
      const revoked = await revoker({
        token,
        tokenType: storedCredential.credential.tokenType,
      })
      if (!revoked) {
        return { code: 'provider_revocation_failed', provider, status: 502 }
      }
      providerCleanup.providerCleanup[provider] = 'revoked'
    } catch {
      return { code: 'provider_revocation_failed', provider, status: 502 }
    }
  }
  const deletion = await authClient.auth.admin.deleteUser(data.user.id)
  if (deletion.error) {
    return { code: 'deletion_failed', status: 502 }
  }
  return providerCleanup
}

export function readBearerToken(authorization: string | undefined) {
  const match = /^Bearer ([A-Za-z0-9._~-]{20,8192})$/.exec(
    authorization?.trim() ?? '',
  )
  return match?.[1]
}

export function isAllowedAppOrigin({
  host,
  origin,
  publicAppOrigin,
}: {
  host: string | undefined
  origin: string | undefined
  publicAppOrigin: string | undefined
}) {
  if (!origin) {
    return true
  }
  if (origin === 'capacitor://localhost') {
    return true
  }
  const allowed = new Set<string>()
  const requestUrl = parseRequestHost(host)
  if (requestUrl) {
    allowed.add(requestUrl.httpsOrigin)
    if (requestUrl.isLocal) {
      allowed.add(requestUrl.httpOrigin)
    }
  }
  if (publicAppOrigin) {
    try {
      allowed.add(new URL(publicAppOrigin).origin)
    } catch {
      return false
    }
  }
  return allowed.has(origin)
}

function parseRequestHost(host: string | undefined): {
  httpOrigin: string
  httpsOrigin: string
  isLocal: boolean
} | null {
  if (!host || host.length > 253) {
    return null
  }
  try {
    const httpsUrl = new URL(`https://${host}`)
    if (
      httpsUrl.host.toLowerCase() !== host.toLowerCase() ||
      httpsUrl.pathname !== '/' ||
      httpsUrl.search ||
      httpsUrl.hash
    ) {
      return null
    }
    return {
      httpOrigin: `http://${httpsUrl.host}`,
      httpsOrigin: httpsUrl.origin,
      isLocal:
        httpsUrl.hostname === 'localhost' || httpsUrl.hostname === '127.0.0.1',
    }
  } catch {
    return null
  }
}

function isAccessToken(value: string) {
  return value.length >= 20 && value.length <= 8192 && !/\s/.test(value)
}
