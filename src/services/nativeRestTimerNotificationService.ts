import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

import { getRestTimerCompletionDate } from '@domain/restTimer'
import { getTimerSound } from '@domain/timerSounds'
import type { RestTimerState } from '@shared-types/app'

const REST_TIMER_NOTIFICATION_ID = 71_001

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
    return 'canceled'
  },

  async sync(
    timer: RestTimerState | null,
    soundId: string | null | undefined,
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
          sound:
            options.soundEnabled === false
              ? undefined
              : `${getTimerSound(soundId).id}.wav`,
          silent: true,
          interruptionLevel: 'timeSensitive',
          extra: { timerId: timer?.id },
        },
      ],
    })
    return 'scheduled'
  },
}
