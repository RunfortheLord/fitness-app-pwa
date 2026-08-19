import { authService } from '@services/authService'

export type AccountDeletionResult = {
  providerRevocation: 'manual_apple' | 'not_required'
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
    const providerRevocation =
      isRecord(payload) &&
      isRecord(payload.data) &&
      payload.data.providerRevocation === 'manual_apple'
        ? 'manual_apple'
        : 'not_required'
    await authService.clearLocalSession()
    return { providerRevocation }
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
  return 'The account could not be deleted. No local data was changed.'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
