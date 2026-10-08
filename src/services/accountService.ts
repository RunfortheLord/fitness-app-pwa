import { authService } from '@services/authService'

export type AccountDeletionResult = {
  providerCleanup: {
    apple: 'manual_required' | 'not_linked' | 'revoked'
    google: 'manual_required' | 'not_linked' | 'revoked'
  }
}

export const accountService = {
  async deleteAccount(): Promise<AccountDeletionResult> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error('Account deletion requires an internet connection.')
    }
    const session = await authService.getSession()
    if (!session?.access_token) {
      throw new Error('Sign in again before deleting your account.')
    }
    const response = await fetch(accountDeletionEndpoint(), {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })
    const payload = await readPayload(response)
    if (!response.ok) {
      throw new Error(errorMessage(response.status, payload))
    }
    const providerCleanup = readProviderCleanup(payload)
    if (!providerCleanup) {
      throw new Error('The account deletion response was invalid.')
    }
    await authService.clearLocalSession()
    return { providerCleanup }
  },
}

function accountDeletionEndpoint() {
  const configuredOrigin = import.meta.env.VITE_PUBLIC_APP_ORIGIN?.trim()
  if (!configuredOrigin) {
    return '/api/account/delete'
  }
  return `${configuredOrigin.replace(/\/+$/, '')}/api/account/delete`
}

async function readPayload(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

function errorMessage(status: number, payload: unknown) {
  const code =
    isRecord(payload) && isRecord(payload.error)
      ? payload.error.code
      : undefined
  if (status === 401) {
    return 'Your session expired. Sign in again before deleting your account.'
  }
  if (status === 429 || code === 'rate_limited') {
    return 'Too many deletion attempts. Wait before trying again.'
  }
  if (status === 503) {
    return 'Account deletion is temporarily unavailable. Try again later.'
  }
  if (status === 502 && code === 'provider_revocation_failed') {
    const provider =
      isRecord(payload) &&
      isRecord(payload.error) &&
      payload.error.provider === 'google'
        ? 'Google'
        : 'Apple'
    return `${provider} authorization could not be revoked. Your Vigorune account and cloud data were not deleted. Try again, or use the provider's account settings as a recovery step.`
  }
  return 'The account could not be deleted. No local data was changed.'
}

function readProviderCleanup(
  payload: unknown,
): AccountDeletionResult['providerCleanup'] | undefined {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    return undefined
  }
  const value = payload.data.providerCleanup
  if (!isRecord(value)) {
    return undefined
  }
  const apple = readCleanupStatus(value.apple)
  const google = readCleanupStatus(value.google)
  return apple && google ? { apple, google } : undefined
}

function readCleanupStatus(value: unknown) {
  return value === 'manual_required' ||
    value === 'not_linked' ||
    value === 'revoked'
    ? value
    : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
