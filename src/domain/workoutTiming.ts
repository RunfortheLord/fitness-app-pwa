import type { Workout } from '@shared-types/app'

export const WORKOUT_INACTIVITY_PAUSE_MS = 15 * 60 * 1_000

export function workoutElapsedSeconds(
  workout: Pick<Workout, 'elapsedPausedSeconds' | 'pausedAt' | 'startedAt'>,
  now: string | Date,
) {
  const startedAt = Date.parse(workout.startedAt)
  const nowTime = now instanceof Date ? now.getTime() : Date.parse(now)
  const pausedAt = workout.pausedAt ? Date.parse(workout.pausedAt) : nowTime
  const elapsedThrough = Number.isFinite(pausedAt) ? pausedAt : nowTime

  if (!Number.isFinite(startedAt) || !Number.isFinite(elapsedThrough)) {
    return 0
  }

  return Math.max(
    0,
    Math.floor((elapsedThrough - startedAt) / 1000) -
      workout.elapsedPausedSeconds,
  )
}

export function accumulatedWorkoutPauseSeconds(
  workout: Pick<Workout, 'elapsedPausedSeconds' | 'pausedAt'>,
  resumedAt: string,
) {
  if (!workout.pausedAt) {
    return workout.elapsedPausedSeconds
  }

  const pauseStartedAt = Date.parse(workout.pausedAt)
  const pauseEndedAt = Date.parse(resumedAt)
  if (!Number.isFinite(pauseStartedAt) || !Number.isFinite(pauseEndedAt)) {
    return workout.elapsedPausedSeconds
  }

  return (
    workout.elapsedPausedSeconds +
    Math.max(0, Math.round((pauseEndedAt - pauseStartedAt) / 1000))
  )
}

export function inactivityPauseAt(lastActivityAt: number, now: number) {
  if (
    !Number.isFinite(lastActivityAt) ||
    now - lastActivityAt < WORKOUT_INACTIVITY_PAUSE_MS
  ) {
    return null
  }
  return new Date(lastActivityAt + WORKOUT_INACTIVITY_PAUSE_MS).toISOString()
}

export function formatClockDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainder
      .toString()
      .padStart(2, '0')}`
  }
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

export function formatWorkoutDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0) {
    return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`
  }
  return `${Math.max(1, minutes)} min`
}
