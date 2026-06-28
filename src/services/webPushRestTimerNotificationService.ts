import { getRestTimerCompletionDate } from '@domain/restTimer'
import type { RestTimerState } from '@shared-types/app'

const STORED_JOB_KEY = 'fitness-log:web-push-rest-timer-job'

export type WebPushRestTimerNotificationStatus =
  | 'unavailable'
  | 'install-required'
  | 'permission-required'
  | 'denied'
  | 'not-configured'
  | 'granted'
  | 'scheduled'
  | 'canceled'
  | 'expired'
  | 'failed'

type StoredTimerJob = {
  messageId: string | null
  signature: string
}

type PushConfigResponse = {
  ok: boolean
  configured: boolean
  publicKey: string | null
}

type TimerApiResponse =
  | { ok: true; messageId: string | null }
  | { ok: false; error?: { code?: string } }

let syncQueue = Promise.resolve<WebPushRestTimerNotificationStatus>('canceled')

export function supportsWebPushRestTimerNotifications() {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function isInstalledWebApp() {
  const standaloneNavigator = navigator as Navigator & {
    standalone?: boolean
  }
  return (
    standaloneNavigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

export function usesSystemNotificationTimerSound() {
  return isIos() && isInstalledWebApp()
}

export const webPushRestTimerNotificationService = {
  async requestPermission(): Promise<WebPushRestTimerNotificationStatus> {
    if (!supportsWebPushRestTimerNotifications()) {
      return 'unavailable'
    }
    if (isIos() && !isInstalledWebApp()) {
      return 'install-required'
    }

    const config = await loadPushConfig()
    if (!config.configured || !config.publicKey) {
      return 'not-configured'
    }

    const permission =
      Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission
    if (permission === 'denied') {
      return 'denied'
    }
    if (permission !== 'granted') {
      return 'permission-required'
    }

    const registration = await navigator.serviceWorker.ready
    const existing = await registration.pushManager.getSubscription()
    if (!existing) {
      await registration.pushManager.subscribe({
        applicationServerKey: urlBase64ToUint8Array(config.publicKey),
        userVisibleOnly: true,
      })
    }
    return 'granted'
  },

  sync(
    timer: RestTimerState | null,
  ): Promise<WebPushRestTimerNotificationStatus> {
    const operation = syncQueue.then(() => syncTimer(timer))
    syncQueue = operation.catch(() => 'failed')
    return operation
  },

  cancel(): Promise<WebPushRestTimerNotificationStatus> {
    return this.sync(null)
  },
}

async function syncTimer(
  timer: RestTimerState | null,
): Promise<WebPushRestTimerNotificationStatus> {
  if (!supportsWebPushRestTimerNotifications()) {
    return 'unavailable'
  }
  if (Notification.permission === 'denied') {
    return 'denied'
  }
  if (Notification.permission !== 'granted') {
    return 'permission-required'
  }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    return 'permission-required'
  }

  const completionDate = getRestTimerCompletionDate(timer)
  const signature = timerSignature(timer)
  const storedJob = readStoredJob()
  if (storedJob?.signature === signature) {
    return completionDate ? 'scheduled' : 'canceled'
  }
  if (completionDate && completionDate.getTime() <= Date.now()) {
    await updateScheduledJob(null, timer, subscription, storedJob?.messageId)
    return 'expired'
  }

  const response = await updateScheduledJob(
    completionDate,
    timer,
    subscription,
    storedJob?.messageId,
  )
  if (!response.ok) {
    if (response.error?.code === 'not_configured') {
      return 'not-configured'
    }
    return 'failed'
  }

  storeJob({
    messageId: response.messageId,
    signature,
  })
  return completionDate ? 'scheduled' : 'canceled'
}

async function updateScheduledJob(
  completionDate: Date | null,
  timer: RestTimerState | null,
  subscription: PushSubscription,
  previousMessageId: string | null | undefined,
) {
  const response = await fetch('/api/push/timer', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      completionAt: completionDate?.toISOString() ?? null,
      previousMessageId: previousMessageId ?? null,
      subscription: subscription.toJSON(),
      timerId: completionDate ? timer?.id : null,
    }),
  })
  const body = (await response.json()) as TimerApiResponse
  return response.ok ? body : body
}

async function loadPushConfig(): Promise<PushConfigResponse> {
  const response = await fetch('/api/push/config', { cache: 'no-store' })
  if (!response.ok) {
    return { ok: false, configured: false, publicKey: null }
  }
  return (await response.json()) as PushConfigResponse
}

function timerSignature(timer: RestTimerState | null) {
  return timer
    ? [
        timer.id,
        timer.startedAt,
        timer.durationSeconds,
        timer.accumulatedPausedSeconds,
        timer.status,
      ].join(':')
    : 'no-active-rest-timer'
}

function readStoredJob(): StoredTimerJob | null {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(STORED_JOB_KEY) ?? 'null',
    )
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'signature' in parsed &&
      typeof parsed.signature === 'string' &&
      'messageId' in parsed &&
      (typeof parsed.messageId === 'string' || parsed.messageId === null)
    ) {
      return {
        messageId: parsed.messageId,
        signature: parsed.signature,
      }
    }
  } catch {
    // A corrupt local cache is replaced by the next successful schedule.
  }
  return null
}

function storeJob(job: StoredTimerJob) {
  window.localStorage.setItem(STORED_JOB_KEY, JSON.stringify(job))
}

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const bytes = window.atob(base64)
  return Uint8Array.from(bytes, (character) => character.charCodeAt(0))
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}
