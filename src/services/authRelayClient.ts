import { Capacitor } from '@capacitor/core'

const AUTH_RELAY_PATH = '/api/auth/relay'
const PENDING_RELAY_STORAGE_KEY = 'vigorune:auth-relay:v1'
const RELAY_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const RETRIEVAL_SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/
const MAX_POLL_WAIT_MS = 15_000
const POLL_INTERVAL_MS = 750

export type PendingAuthRelay = {
  expiresAt: number
  relayId: string
  retrievalSecret: string
}

export type AuthRelayCallback =
  | {
      code: string
      relayId: string
      returnToNativeApp: boolean
      status: 'ready'
    }
  | { relayId: string; returnToNativeApp: boolean; status: 'failed' }

export type AuthRelayPollResult =
  | { status: 'failed' | 'missing' | 'pending' }
  | { code: string; status: 'ready' }

type FetchLike = typeof fetch

export async function createPendingAuthRelay({
  fetchImpl = fetch,
  storage = globalThis.localStorage,
}: {
  fetchImpl?: FetchLike
  storage?: Storage
} = {}) {
  const response = await fetchImpl(authRelayEndpoint(), {
    body: JSON.stringify({ action: 'create' }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  const payload = await readJson(response)
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : null
  if (
    !response.ok ||
    !data ||
    !isRelayId(data.relayId) ||
    !isRetrievalSecret(data.retrievalSecret) ||
    !Number.isFinite(data.expiresInSeconds) ||
    Number(data.expiresInSeconds) < 30 ||
    Number(data.expiresInSeconds) > 600
  ) {
    throw new Error('Secure Google sign-in could not start. Try again shortly.')
  }
  const pending: PendingAuthRelay = {
    expiresAt: Date.now() + Number(data.expiresInSeconds) * 1_000,
    relayId: data.relayId,
    retrievalSecret: data.retrievalSecret,
  }
  storage.setItem(PENDING_RELAY_STORAGE_KEY, JSON.stringify(pending))
  return pending
}

export function readPendingAuthRelay(
  storage: Storage = globalThis.localStorage,
): PendingAuthRelay | undefined {
  const raw = storage.getItem(PENDING_RELAY_STORAGE_KEY)
  if (!raw) {
    return undefined
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (
      !isRecord(parsed) ||
      !isRelayId(parsed.relayId) ||
      !isRetrievalSecret(parsed.retrievalSecret) ||
      typeof parsed.expiresAt !== 'number' ||
      !Number.isFinite(parsed.expiresAt) ||
      parsed.expiresAt <= Date.now()
    ) {
      clearPendingAuthRelay(storage)
      return undefined
    }
    return {
      expiresAt: parsed.expiresAt,
      relayId: parsed.relayId,
      retrievalSecret: parsed.retrievalSecret,
    }
  } catch {
    clearPendingAuthRelay(storage)
    return undefined
  }
}

export function clearPendingAuthRelay(
  storage: Storage = globalThis.localStorage,
) {
  storage.removeItem(PENDING_RELAY_STORAGE_KEY)
}

export function readAuthRelayCallback(
  location: Location,
): AuthRelayCallback | undefined {
  const query = new URLSearchParams(location.search)
  const relayId = readRelayIdFromCallbackPath(location.pathname)
  if (!isRelayId(relayId)) {
    return undefined
  }
  const code = query.get('code')
  const returnToNativeApp = query.get('native') === '1'
  if (isAuthCode(code)) {
    return { code, relayId, returnToNativeApp, status: 'ready' }
  }
  const fragment = new URLSearchParams(location.hash.replace(/^#/, ''))
  if (query.has('error') || fragment.has('error')) {
    return { relayId, returnToNativeApp, status: 'failed' }
  }
  return undefined
}

function readRelayIdFromCallbackPath(pathname: string) {
  const match = /^\/auth\/callback\/([^/]+)\/?$/.exec(pathname)
  if (!match) {
    return null
  }
  try {
    return decodeURIComponent(match[1] ?? '')
  } catch {
    return null
  }
}

export function scrubAuthRelayCallbackUrl(history: History) {
  history.replaceState(null, '', '/settings?auth_relay_callback=received')
}

export async function forwardAuthRelayCallback(
  callback: AuthRelayCallback,
  fetchImpl: FetchLike = fetch,
) {
  const response = await fetchImpl(authRelayEndpoint(), {
    body: JSON.stringify(
      callback.status === 'ready'
        ? {
            action: 'complete',
            code: callback.code,
            relayId: callback.relayId,
          }
        : { action: 'complete', failed: true, relayId: callback.relayId },
    ),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  if (!response.ok && response.status !== 409) {
    throw new Error('The secure sign-in handoff could not be completed.')
  }
}

export async function pollPendingAuthRelay({
  fetchImpl = fetch,
  maxWaitMs = 0,
  storage = globalThis.localStorage,
}: {
  fetchImpl?: FetchLike
  maxWaitMs?: number
  storage?: Storage
} = {}): Promise<AuthRelayPollResult | undefined> {
  const pending = readPendingAuthRelay(storage)
  if (!pending) {
    return undefined
  }
  const boundedWaitMs = Math.max(0, Math.min(maxWaitMs, MAX_POLL_WAIT_MS))
  const deadline = Date.now() + boundedWaitMs
  while (true) {
    const response = await fetchImpl(authRelayEndpoint(), {
      body: JSON.stringify({
        action: 'consume',
        relayId: pending.relayId,
        retrievalSecret: pending.retrievalSecret,
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })
    if (response.status === 404) {
      clearPendingAuthRelay(storage)
      return { status: 'missing' }
    }
    const payload = await readJson(response)
    const data =
      isRecord(payload) && isRecord(payload.data) ? payload.data : null
    if (!response.ok || !data || typeof data.status !== 'string') {
      throw new Error('Secure Google sign-in is temporarily unavailable.')
    }
    if (data.status === 'ready' && isAuthCode(data.code)) {
      clearPendingAuthRelay(storage)
      return { code: data.code, status: 'ready' }
    }
    if (data.status === 'failed') {
      clearPendingAuthRelay(storage)
      return { status: 'failed' }
    }
    if (data.status !== 'pending' || Date.now() >= deadline) {
      return { status: 'pending' }
    }
    await new Promise((resolve) =>
      globalThis.setTimeout(resolve, POLL_INTERVAL_MS),
    )
  }
}

export function shouldUseAuthRelay({
  matchMedia = globalThis.matchMedia,
  navigator = globalThis.navigator,
}: {
  matchMedia?: (query: string) => { matches: boolean }
  navigator?: Navigator
} = {}) {
  const iosNavigator = navigator as Navigator & { standalone?: boolean }
  return (
    Capacitor.isNativePlatform() ||
    iosNavigator.standalone === true ||
    matchMedia?.('(display-mode: standalone)').matches === true
  )
}

function isRelayId(value: unknown): value is string {
  return typeof value === 'string' && RELAY_ID_PATTERN.test(value)
}

function authRelayEndpoint() {
  if (!Capacitor.isNativePlatform()) {
    return AUTH_RELAY_PATH
  }
  const configuredOrigin = import.meta.env.VITE_PUBLIC_APP_ORIGIN?.trim()
  return configuredOrigin
    ? `${configuredOrigin.replace(/\/+$/, '')}${AUTH_RELAY_PATH}`
    : AUTH_RELAY_PATH
}

function isRetrievalSecret(value: unknown): value is string {
  return typeof value === 'string' && RETRIEVAL_SECRET_PATTERN.test(value)
}

function isAuthCode(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 4096 &&
    !/\s/.test(value) &&
    [...value].every((character) => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint > 31 && codePoint !== 127
    })
  )
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
