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
import { webPushRestTimerNotificationService } from '@services/webPushRestTimerNotificationService'

const REST_TIMER_POLL_MILLISECONDS = 500

type TimerSoundSettings = {
  enabled: boolean
  soundId: string
}

/**
 * Watches the persisted rest timer for the lifetime of the app shell so timer
 * completion is detected even when the live-workout route is not mounted.
 */
export function RestTimerMonitor() {
  const timerSound = useRef<TimerSoundSettings>({
    enabled: true,
    soundId: DEFAULT_TIMER_SOUND_ID,
  })
  const alertedTimerKeys = useRef(new Set<string>())
  const completingTimerKeys = useRef(new Set<string>())
  const nativeTimerSignature = useRef<string | null>(null)

  useEffect(() => {
    let isCurrent = true

    void settingsRepository.ensureSettings().then((settings) => {
      if (!isCurrent) {
        return
      }
      timerSound.current = {
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
            timerSound.current.soundId,
          ].join(':')
        : 'no-active-rest-timer'
      if (nativeTimerSignature.current !== nextNativeTimerSignature) {
        try {
          const nativeStatus = await nativeRestTimerNotificationService.sync(
            timer ?? null,
            timerSound.current.soundId,
            { soundEnabled: timerSound.current.enabled },
          )
          if (nativeStatus === 'unavailable') {
            await webPushRestTimerNotificationService.sync(timer ?? null)
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
        announceRestComplete(timerSound.current)
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

function announceRestComplete(timerSound: TimerSoundSettings) {
  if ('vibrate' in navigator) {
    navigator.vibrate?.(180)
  }
  if (timerSound.enabled) {
    void playTimerSoundOnce(timerSound.soundId).catch(() => {
      // Visual completion remains authoritative when browser audio is blocked.
    })
  }
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Rest timer complete')
  }
}
