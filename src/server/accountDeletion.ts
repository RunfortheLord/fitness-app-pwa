import type { User } from '@supabase/supabase-js'

import {
  evaluateRateLimit,
  type ServerRateLimiter,
} from './serverRateLimiter.js'

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
      providerRevocation: 'manual_apple' | 'not_required'
      status: 200
    }
  | {
      code: 'rate_limited' | 'service_unavailable'
      retryAfterSeconds: number
      status: 429 | 503
    }
  | { code: 'unauthorized'; status: 401 }
  | { code: 'deletion_failed'; status: 502 }

export async function deleteAuthenticatedAccount({
  accessToken,
  authClient,
  limiter,
}: {
  accessToken: string
  authClient: AccountDeletionAuthClient
  limiter: ServerRateLimiter | undefined
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

  const providerRevocation = hasAppleIdentity(data.user)
    ? 'manual_apple'
    : 'not_required'
  const deletion = await authClient.auth.admin.deleteUser(data.user.id)
  if (deletion.error) {
    return { code: 'deletion_failed', status: 502 }
  }
  return { code: 'deleted', providerRevocation, status: 200 }
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
  if (host && /^[a-zA-Z0-9.-]+(?::\d{1,5})?$/.test(host)) {
    allowed.add(`https://${host}`)
    if (/^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(host)) {
      allowed.add(`http://${host}`)
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

function hasAppleIdentity(user: User) {
  const providers = user.app_metadata.providers
  return (
    user.app_metadata.provider === 'apple' ||
    (Array.isArray(providers) && providers.includes('apple')) ||
    user.identities?.some((identity) => identity.provider === 'apple') === true
  )
}

function isAccessToken(value: string) {
  return value.length >= 20 && value.length <= 8192 && !/\s/.test(value)
}
