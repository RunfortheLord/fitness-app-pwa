import { useEffect, useRef } from 'react'

import { isRestTimerExpired } from '@domain/restTimer'
import {
  DEFAULT_TIMER_SOUND_ID,
  playTimerSoundOnce,
  preloadTimerSound,
} from '@domain/timerSounds'
import { settingsRepository } from '@repositories/settingsRepository'
import { workoutRepository } from '@repositories/workoutRepository'
import { nativeRestTimerNotificationService } from '@services/nativeRestTimerNotificationService'
import {
  usesSystemNotificationTimerSound,
  WEB_PUSH_REST_TIMER_NOTIFICATION_TAG,
  webPushRestTimerNotificationService,
} from '@services/webPushRestTimerNotificationService'

const REST_TIMER_POLL_MILLISECONDS = 500

type TimerSoundSettings = {
  bannersEnabled: boolean
  enabled: boolean
  soundId: string
}

/**
 * Watches the persisted rest timer for the lifetime of the app shell so timer
 * completion is detected even when the live-workout route is not mounted.
 */
export function RestTimerMonitor() {
  const timerSound = useRef<TimerSoundSettings>({
    bannersEnabled: true,
    enabled: true,
    soundId: DEFAULT_TIMER_SOUND_ID,
  })
  const alertedTimerKeys = useRef(new Set<string>())
  const completingTimerKeys = useRef(new Set<string>())
  const nativeTimerSignature = useRef<string | null>(null)
  const outsideAlertScheduled = useRef(false)

  useEffect(() => {
    let isCurrent = true

    void settingsRepository.ensureSettings().then((settings) => {
      if (!isCurrent) {
        return
      }
      timerSound.current = {
        bannersEnabled: settings.timerBannersEnabled ?? true,
        enabled: settings.timerSoundEnabled ?? true,
        soundId: settings.selectedTimerSoundId ?? DEFAULT_TIMER_SOUND_ID,
      }
      if (timerSound.current.enabled) {
        preloadTimerSound(timerSound.current.soundId)
      }
    })

    return () => {
      isCurrent = false
    }
  }, [])

  useEffect(() => {
    let isCurrent = true

    async function checkRestTimer() {
      const workout = await workoutRepository.getActiveWorkout()
      const timer = workout?.activeRestTimer
      const nextNativeTimerSignature = timer
        ? [
            timer.id,
            timer.startedAt,
            timer.durationSeconds,
            timer.accumulatedPausedSeconds,
            timer.status,
            timerSound.current.bannersEnabled,
            timerSound.current.enabled,
          ].join(':')
        : 'no-active-rest-timer'
      if (nativeTimerSignature.current !== nextNativeTimerSignature) {
        try {
          const nativeStatus = timerSound.current.bannersEnabled
            ? await nativeRestTimerNotificationService.sync(timer ?? null, {
                soundEnabled: timerSound.current.enabled,
              })
            : await nativeRestTimerNotificationService.cancel()
          if (nativeStatus === 'unavailable') {
            const webPushStatus = timerSound.current.bannersEnabled
              ? await webPushRestTimerNotificationService.sync(timer ?? null)
              : await webPushRestTimerNotificationService.cancel()
            outsideAlertScheduled.current =
              webPushStatus === 'scheduled' || webPushStatus === 'expired'
          } else {
            outsideAlertScheduled.current =
              nativeStatus === 'scheduled' || nativeStatus === 'expired'
          }
          nativeTimerSignature.current = nextNativeTimerSignature
        } catch {
          // Retry on the next poll; in-app completion remains authoritative.
        }
      }
      if (!isCurrent || !workout || !timer || !isRestTimerExpired(timer)) {
        return
      }

      const timerKey = `${timer.id}:${timer.startedAt}`
      if (!alertedTimerKeys.current.has(timerKey)) {
        alertedTimerKeys.current.add(timerKey)
        announceRestComplete(
          timerSound.current,
          shouldPlayInAppTimerSound(outsideAlertScheduled.current),
          shouldShowImmediateSystemTimerAlert(),
          timer.id,
        )
      }
      if (completingTimerKeys.current.has(timerKey)) {
        return
      }

      completingTimerKeys.current.add(timerKey)
      try {
        await workoutRepository.completeRestTimer(workout.id)
        const nativeStatus = await nativeRestTimerNotificationService.cancel()
        if (nativeStatus === 'unavailable') {
          await webPushRestTimerNotificationService.cancel()
        }
        if (isCurrent) {
          window.dispatchEvent(
            new CustomEvent('fitness-log:rest-timer-completed', {
              detail: { workoutId: workout.id, timerId: timer.id },
            }),
          )
        }
      } finally {
        completingTimerKeys.current.delete(timerKey)
      }
    }

    void checkRestTimer()
    const interval = window.setInterval(
      () => void checkRestTimer(),
      REST_TIMER_POLL_MILLISECONDS,
    )
    const checkAfterResume = () => {
      if (document.visibilityState === 'visible') {
        void checkRestTimer()
      }
    }
    document.addEventListener('visibilitychange', checkAfterResume)

    return () => {
      isCurrent = false
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', checkAfterResume)
    }
  }, [])

  return null
}

function announceRestComplete(
  timerSound: TimerSoundSettings,
  playInAppSound: boolean,
  showImmediateSystemAlert: boolean,
  timerId: string,
) {
  if ('vibrate' in navigator) {
    navigator.vibrate?.(180)
  }
  if (timerSound.enabled && showImmediateSystemAlert) {
    if (timerSound.bannersEnabled) {
      void showImmediateSystemRestCompleteAlert(timerId).catch(() => {
        // Visual completion remains authoritative when notifications are blocked.
      })
    }
    return
  }
  if (timerSound.enabled && playInAppSound) {
    void playTimerSoundOnce(timerSound.soundId).catch(() => {
      // Visual completion remains authoritative when browser audio is blocked.
    })
  }
}

function shouldPlayInAppTimerSound(outsideAlertScheduled: boolean) {
  if (usesSystemNotificationTimerSound()) {
    return false
  }
  return !outsideAlertScheduled
}

function shouldShowImmediateSystemTimerAlert() {
  return (
    usesSystemNotificationTimerSound() && document.visibilityState === 'visible'
  )
}

async function showImmediateSystemRestCompleteAlert(timerId: string) {
  const nativeStatus =
    await nativeRestTimerNotificationService.showImmediateAlert({
      body: 'Your next set is ready.',
      extra: { timerId },
      title: 'Rest timer complete',
    })
  if (nativeStatus !== 'unavailable') {
    return nativeStatus
  }
  return webPushRestTimerNotificationService.showImmediateAlert({
    body: 'Your next set is ready.',
    tag: WEB_PUSH_REST_TIMER_NOTIFICATION_TAG,
    title: 'Rest timer complete',
  })
}
