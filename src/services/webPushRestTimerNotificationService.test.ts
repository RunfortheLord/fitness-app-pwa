import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  WEB_PUSH_REST_TIMER_NOTIFICATION_TAG,
  webPushRestTimerNotificationService,
} from './webPushRestTimerNotificationService'

const mocks = vi.hoisted(() => ({
  closeNotification: vi.fn(),
  getNotifications: vi.fn(),
  getSubscription: vi.fn(),
  showNotification: vi.fn(),
  subscribe: vi.fn(),
}))

function installWebPushGlobals(permission: NotificationPermission) {
  Object.defineProperty(window, 'isSecureContext', {
    configurable: true,
    value: true,
  })
  Object.defineProperty(window, 'PushManager', {
    configurable: true,
    value: class PushManager {},
  })
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: {
      permission,
      requestPermission: vi.fn(async () => 'granted'),
    },
  })
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      ready: Promise.resolve({
        pushManager: {
          getSubscription: mocks.getSubscription,
          subscribe: mocks.subscribe,
        },
        getNotifications: mocks.getNotifications,
        showNotification: mocks.showNotification,
      }),
    },
  })
}

const subscription = {
  toJSON: () => ({
    endpoint: 'https://push.example.test/device',
    expirationTime: null,
    keys: { auth: 'auth-key', p256dh: 'public-key' },
  }),
}

beforeEach(() => {
  localStorage.clear()
  mocks.getSubscription.mockReset()
  mocks.closeNotification.mockReset()
  mocks.getNotifications.mockReset()
  mocks.getNotifications.mockResolvedValue([])
  mocks.showNotification.mockReset()
  mocks.subscribe.mockReset()
  vi.unstubAllGlobals()
})

describe('webPushRestTimerNotificationService', () => {
  it('subscribes after permission is granted', async () => {
    installWebPushGlobals('default')
    mocks.getSubscription.mockResolvedValue(null)
    mocks.subscribe.mockResolvedValue(subscription)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          ok: true,
          configured: true,
          publicKey: 'AQID',
        }),
      ),
    )

    await expect(
      webPushRestTimerNotificationService.requestPermission(),
    ).resolves.toBe('granted')
    expect(mocks.subscribe).toHaveBeenCalledWith({
      applicationServerKey: new Uint8Array([1, 2, 3]),
      userVisibleOnly: true,
    })
  })

  it('schedules a running timer and cancels the previous job on adjustment', async () => {
    installWebPushGlobals('granted')
    mocks.getSubscription.mockResolvedValue(subscription)
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ ok: true, messageId: 'message-1' }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const timer = {
      id: 'timer-1',
      startedAt: new Date(Date.now() - 10_000).toISOString(),
      durationSeconds: 90,
      accumulatedPausedSeconds: 0,
      pausedAt: null,
      status: 'running' as const,
    }
    await expect(webPushRestTimerNotificationService.sync(timer)).resolves.toBe(
      'scheduled',
    )

    await expect(
      webPushRestTimerNotificationService.sync({
        ...timer,
        durationSeconds: 120,
      }),
    ).resolves.toBe('scheduled')

    const secondBody = JSON.parse(
      String(fetchMock.mock.calls[1]?.[1]?.body),
    ) as { previousMessageId: string }
    expect(secondBody.previousMessageId).toBe('message-1')
  })

  it('does not make network requests when permission has not been granted', async () => {
    installWebPushGlobals('default')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(webPushRestTimerNotificationService.sync(null)).resolves.toBe(
      'permission-required',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('previews the device notification alert through the service worker', async () => {
    vi.useFakeTimers()
    installWebPushGlobals('granted')
    mocks.getNotifications.mockResolvedValue([
      { close: mocks.closeNotification },
    ])
    mocks.showNotification.mockResolvedValue(undefined)

    await expect(webPushRestTimerNotificationService.preview()).resolves.toBe(
      'scheduled',
    )

    expect(mocks.showNotification).toHaveBeenCalledWith('Timer alert test', {
      body: 'This is the iPhone alert used for rest timers.',
      tag: 'rest-timer-alert-preview',
    })
    expect(mocks.getNotifications).toHaveBeenCalledWith({
      tag: 'rest-timer-alert-preview',
    })
    expect(mocks.closeNotification).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(6_000)
    expect(mocks.getNotifications).toHaveBeenCalledTimes(2)
    expect(mocks.closeNotification).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('closes current and legacy timer notifications when canceled', async () => {
    installWebPushGlobals('granted')
    mocks.getSubscription.mockResolvedValue(subscription)
    mocks.getNotifications.mockResolvedValue([
      {
        close: mocks.closeNotification,
        tag: WEB_PUSH_REST_TIMER_NOTIFICATION_TAG,
      },
      { close: mocks.closeNotification, tag: 'rest-timer-old-id' },
      { close: mocks.closeNotification, tag: 'another-feature' },
    ])
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ ok: true, messageId: null })),
    )

    await expect(webPushRestTimerNotificationService.cancel()).resolves.toBe(
      'canceled',
    )

    expect(mocks.getNotifications).toHaveBeenCalledWith()
    expect(mocks.closeNotification).toHaveBeenCalledTimes(2)
  })
})
