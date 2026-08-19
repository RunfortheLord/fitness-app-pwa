import { Capacitor } from '@capacitor/core'

import { formatLocalDate } from '@domain/dates'
import {
  MAX_ANALYTICS_QUEUE,
  isValidInstallId,
  resolveAnalyticsActive,
  sanitizeAnalyticsEvents,
  type AnalyticsBatch,
  type AnalyticsEventName,
  type QueuedAnalyticsEvent,
} from '@domain/analytics'

// Privacy-first, best-effort analytics transport. Everything here is designed so
// that analytics can NEVER break the app: every entry point swallows its own
// errors, nothing is awaited by callers, and no event is ever emitted unless the
// build opted in AND the user has not signalled Do-Not-Track or opted out.
//
// Events are queued locally (survives offline / app restart) and flushed to the
// first-party endpoint when possible. The stored payload is only ever an event
// name + coarse day tagged with a random, account-less install id.

const INSTALL_ID_KEY = 'vigorune.analytics.installId'
const QUEUE_KEY = 'vigorune.analytics.queue'
const OPT_OUT_KEY = 'vigorune.analytics.optOut'

type SimpleStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type AnalyticsServiceDependencies = {
  /** True when the build has analytics enabled (VITE_ANALYTICS_ENABLED). */
  getEnabled: () => boolean
  /** True when the browser/OS signals Do-Not-Track or Global Privacy Control. */
  getDoNotTrack: () => boolean
  storage: SimpleStorage
  fetchImpl: typeof fetch
  now: () => Date
  isOnline: () => boolean
  /** The first-party endpoint, or null when it cannot be resolved (then flush
   * simply keeps queuing so nothing is lost). */
  resolveEndpoint: () => string | null
  generateId: () => string
}

export type AnalyticsService = {
  track: (name: AnalyticsEventName) => void
  flush: () => Promise<void>
  isActive: () => boolean
  isOptedOut: () => boolean
  setOptOut: (optedOut: boolean) => void
}

export function createAnalyticsService(
  deps: AnalyticsServiceDependencies,
): AnalyticsService {
  let flushing = false

  function isOptedOut(): boolean {
    try {
      return deps.storage.getItem(OPT_OUT_KEY) === 'true'
    } catch {
      return false
    }
  }

  function isActive(): boolean {
    try {
      return resolveAnalyticsActive({
        enabled: deps.getEnabled(),
        doNotTrack: deps.getDoNotTrack(),
        optedOut: isOptedOut(),
      })
    } catch {
      return false
    }
  }

  function readQueue(): QueuedAnalyticsEvent[] {
    try {
      const raw = deps.storage.getItem(QUEUE_KEY)
      if (!raw) {
        return []
      }
      return sanitizeAnalyticsEvents(JSON.parse(raw))
    } catch {
      return []
    }
  }

  function writeQueue(events: QueuedAnalyticsEvent[]): void {
    try {
      const bounded = events.slice(-MAX_ANALYTICS_QUEUE)
      if (bounded.length === 0) {
        deps.storage.removeItem(QUEUE_KEY)
        return
      }
      deps.storage.setItem(QUEUE_KEY, JSON.stringify(bounded))
    } catch {
      // Storage may be unavailable (private mode / quota). Losing a best-effort
      // analytics event is acceptable; the app must keep working.
    }
  }

  function ensureInstallId(): string | null {
    try {
      const existing = deps.storage.getItem(INSTALL_ID_KEY)
      if (isValidInstallId(existing)) {
        return existing
      }
      const created = deps.generateId()
      if (!isValidInstallId(created)) {
        return null
      }
      deps.storage.setItem(INSTALL_ID_KEY, created)
      return created
    } catch {
      return null
    }
  }

  function readInstallId(): string | null {
    try {
      const existing = deps.storage.getItem(INSTALL_ID_KEY)
      return isValidInstallId(existing) ? existing : null
    } catch {
      return null
    }
  }

  function track(name: AnalyticsEventName): void {
    try {
      if (!isActive()) {
        return
      }
      const installId = ensureInstallId()
      if (!installId) {
        return
      }
      const day = formatLocalDate(deps.now())
      const queue = readQueue()
      queue.push({ name, day })
      writeQueue(queue)
      void flush()
    } catch {
      // Analytics must never throw into a caller (a log action, app startup...).
    }
  }

  async function flush(): Promise<void> {
    if (flushing) {
      return
    }
    try {
      if (!isActive() || !deps.isOnline()) {
        return
      }
      const endpoint = deps.resolveEndpoint()
      if (!endpoint) {
        return
      }
      const installId = readInstallId()
      if (!installId) {
        return
      }
      const pending = readQueue()
      if (pending.length === 0) {
        return
      }
      flushing = true
      const batch: AnalyticsBatch = { installId, events: pending }
      const response = await deps.fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(batch),
        keepalive: true,
      })
      if (!response.ok) {
        // Leave the queue intact and try again later (rate-limited, offline,
        // endpoint unavailable, misconfigured, etc.).
        return
      }
      // Drop exactly the events we sent; anything queued during the request
      // (appended at the end) is preserved for the next flush.
      writeQueue(readQueue().slice(pending.length))
    } catch {
      // Network/endpoint failure is swallowed; queued events remain for retry.
    } finally {
      flushing = false
    }
  }

  function setOptOut(optedOut: boolean): void {
    try {
      if (optedOut) {
        deps.storage.setItem(OPT_OUT_KEY, 'true')
        // Honour the opt-out fully: forget the queue and the install id so no
        // anonymous identifier lingers on the device.
        deps.storage.removeItem(QUEUE_KEY)
        deps.storage.removeItem(INSTALL_ID_KEY)
      } else {
        deps.storage.removeItem(OPT_OUT_KEY)
      }
    } catch {
      // Ignore storage failures.
    }
  }

  return { track, flush, isActive, isOptedOut, setOptOut }
}

// ---------------------------------------------------------------------------
// Default browser-wired singleton.
// ---------------------------------------------------------------------------

function safeLocalStorage(): SimpleStorage {
  const noop: SimpleStorage = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  }
  try {
    const store = globalThis.localStorage
    if (!store) {
      return noop
    }
    return {
      getItem: (key) => {
        try {
          return store.getItem(key)
        } catch {
          return null
        }
      },
      setItem: (key, value) => {
        try {
          store.setItem(key, value)
        } catch {
          // ignore
        }
      },
      removeItem: (key) => {
        try {
          store.removeItem(key)
        } catch {
          // ignore
        }
      },
    }
  } catch {
    return noop
  }
}

function browserDoNotTrack(): boolean {
  try {
    const nav = globalThis.navigator as
      | (Navigator & {
          msDoNotTrack?: string
          globalPrivacyControl?: boolean
        })
      | undefined
    const globalDnt = (globalThis as { doNotTrack?: string }).doNotTrack
    const signal = nav?.doNotTrack ?? globalDnt ?? nav?.msDoNotTrack
    if (signal === '1' || signal === 'yes') {
      return true
    }
    if (nav?.globalPrivacyControl === true) {
      return true
    }
    return false
  } catch {
    return false
  }
}

function analyticsEnabledForBuild(): boolean {
  return import.meta.env.VITE_ANALYTICS_ENABLED?.trim().toLowerCase() === 'true'
}

function resolveBrowserEndpoint(): string | null {
  if (!Capacitor.isNativePlatform()) {
    return '/api/analytics'
  }
  const origin = import.meta.env.VITE_PUBLIC_APP_ORIGIN?.trim()
  if (!origin) {
    return null
  }
  return `${origin.replace(/\/+$/, '')}/api/analytics`
}

export const analytics = createAnalyticsService({
  getEnabled: analyticsEnabledForBuild,
  getDoNotTrack: browserDoNotTrack,
  storage: safeLocalStorage(),
  fetchImpl: (...args) => fetch(...args),
  now: () => new Date(),
  isOnline: () => globalThis.navigator?.onLine ?? true,
  resolveEndpoint: resolveBrowserEndpoint,
  generateId: () => globalThis.crypto.randomUUID(),
})

/** Fire an analytics event. Safe to call from anywhere; never throws, never
 * blocks, and does nothing unless analytics is active. */
export function trackAnalyticsEvent(name: AnalyticsEventName): void {
  analytics.track(name)
}

/** Wire up automatic flushing on reconnect. Returns a cleanup function. */
export function registerAnalyticsAutoFlush(): () => void {
  const onOnline = () => void analytics.flush()
  try {
    globalThis.addEventListener?.('online', onOnline)
  } catch {
    // ignore
  }
  // Attempt an initial flush for anything queued while the app was closed.
  void analytics.flush()
  return () => {
    try {
      globalThis.removeEventListener?.('online', onOnline)
    } catch {
      // ignore
    }
  }
}

export function setAnalyticsOptOut(optedOut: boolean): void {
  analytics.setOptOut(optedOut)
}

export function isAnalyticsOptedOut(): boolean {
  return analytics.isOptedOut()
}
