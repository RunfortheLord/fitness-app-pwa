import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

import { getRestTimerCompletionDate } from '@domain/restTimer'
import type { RestTimerState } from '@shared-types/app'

const REST_TIMER_NOTIFICATION_ID = 71_001
const REST_TIMER_PREVIEW_NOTIFICATION_ID = 71_002

export type NativeRestTimerNotificationStatus =
  | 'unavailable'
  | 'permission-required'
  | 'denied'
  | 'granted'
  | 'scheduled'
  | 'canceled'
  | 'expired'

export function supportsNativeRestTimerNotifications() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'
}

export const nativeRestTimerNotificationService = {
  async requestPermission(): Promise<NativeRestTimerNotificationStatus> {
    if (!supportsNativeRestTimerNotifications()) {
      return 'unavailable'
    }
    const current = await LocalNotifications.checkPermissions()
    if (current.display === 'granted') {
      return 'granted'
    }
    if (current.display === 'denied') {
      return 'denied'
    }
    const requested = await LocalNotifications.requestPermissions()
    return requested.display === 'granted' ? 'granted' : 'denied'
  },

  async cancel(): Promise<NativeRestTimerNotificationStatus> {
    if (!supportsNativeRestTimerNotifications()) {
      return 'unavailable'
    }
    await LocalNotifications.cancel({
      notifications: [{ id: REST_TIMER_NOTIFICATION_ID }],
    })
    await removeDeliveredTimerNotifications()
    return 'canceled'
  },

  async sync(
    timer: RestTimerState | null,
    options: {
      requestPermission?: boolean
      soundEnabled?: boolean
    } = {},
  ): Promise<NativeRestTimerNotificationStatus> {
    if (!supportsNativeRestTimerNotifications()) {
      return 'unavailable'
    }

    await LocalNotifications.cancel({
      notifications: [{ id: REST_TIMER_NOTIFICATION_ID }],
    })
    await removeDeliveredTimerNotifications()

    const completionDate = getRestTimerCompletionDate(timer)
    if (!completionDate) {
      return 'canceled'
    }
    if (completionDate.getTime() <= Date.now()) {
      return 'expired'
    }

    let permission = await LocalNotifications.checkPermissions()
    if (
      permission.display !== 'granted' &&
      permission.display !== 'denied' &&
      options.requestPermission
    ) {
      permission = await LocalNotifications.requestPermissions()
    }
    if (permission.display === 'denied') {
      return 'denied'
    }
    if (permission.display !== 'granted') {
      return 'permission-required'
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          id: REST_TIMER_NOTIFICATION_ID,
          title: 'Rest timer complete',
          body: 'Your next set is ready.',
          schedule: { at: completionDate },
          silent: options.soundEnabled === false,
          interruptionLevel: 'timeSensitive',
          extra: { timerId: timer?.id },
        },
      ],
    })
    return 'scheduled'
  },

  async preview(): Promise<NativeRestTimerNotificationStatus> {
    if (!supportsNativeRestTimerNotifications()) {
      return 'unavailable'
    }

    let permission = await LocalNotifications.checkPermissions()
    if (permission.display !== 'granted' && permission.display !== 'denied') {
      permission = await LocalNotifications.requestPermissions()
    }
    if (permission.display === 'denied') {
      return 'denied'
    }
    if (permission.display !== 'granted') {
      return 'permission-required'
    }

    await this.showImmediateAlert({
      body: 'This is the iPhone alert used for rest timers.',
      extra: { preview: true },
      id: REST_TIMER_PREVIEW_NOTIFICATION_ID,
      title: 'Timer alert test',
    })
    return 'scheduled'
  },

  async showImmediateAlert({
    body,
    extra,
    id = REST_TIMER_PREVIEW_NOTIFICATION_ID,
    title,
  }: {
    body: string
    extra?: Record<string, unknown>
    id?: number
    title: string
  }): Promise<NativeRestTimerNotificationStatus> {
    if (!supportsNativeRestTimerNotifications()) {
      return 'unavailable'
    }

    const permission = await LocalNotifications.checkPermissions()
    if (permission.display === 'denied') {
      return 'denied'
    }
    if (permission.display !== 'granted') {
      return 'permission-required'
    }

    await LocalNotifications.cancel({
      notifications: [{ id }],
    })
    await removeDeliveredTimerNotifications()
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title,
          body,
          schedule: { at: new Date(Date.now() + 250) },
          interruptionLevel: 'timeSensitive',
          extra,
        },
      ],
    })
    return 'scheduled'
  },
}

async function removeDeliveredTimerNotifications() {
  const delivered = await LocalNotifications.getDeliveredNotifications()
  const notifications = delivered.notifications.filter(
    (notification) =>
      notification.id === REST_TIMER_NOTIFICATION_ID ||
      notification.id === REST_TIMER_PREVIEW_NOTIFICATION_ID ||
      notification.title === 'Rest timer complete' ||
      notification.title === 'NutriFit Timer' ||
      notification.title === 'Timer alert test',
  )
  if (notifications.length === 0) {
    return
  }
  await LocalNotifications.removeDeliveredNotifications({
    notifications,
  })
}
