import type { RestTimerState } from '@shared-types/app'

export function getRestTimerRemainingSeconds(
  timer: RestTimerState | null,
  nowIso = new Date().toISOString(),
) {
  if (!timer || timer.status === 'dismissed' || timer.status === 'completed') {
    return 0
  }

  if (timer.status === 'paused' && timer.pausedAt) {
    return Math.max(
      0,
      timer.durationSeconds -
        Math.floor(
          (Date.parse(timer.pausedAt) -
            Date.parse(timer.startedAt) -
            timer.accumulatedPausedSeconds * 1000) /
            1000,
        ),
    )
  }

  return Math.max(
    0,
    timer.durationSeconds -
      Math.floor(
        (Date.parse(nowIso) -
          Date.parse(timer.startedAt) -
          timer.accumulatedPausedSeconds * 1000) /
          1000,
      ),
  )
}

export function isRestTimerExpired(
  timer: RestTimerState | null,
  nowIso = new Date().toISOString(),
) {
  return Boolean(
    timer &&
    timer.status === 'running' &&
    getRestTimerRemainingSeconds(timer, nowIso) === 0,
  )
}

export function getRestTimerCompletionDate(timer: RestTimerState | null) {
  if (!timer || timer.status !== 'running') {
    return null
  }
  const startedAt = Date.parse(timer.startedAt)
  if (!Number.isFinite(startedAt)) {
    return null
  }
  return new Date(
    startedAt + (timer.durationSeconds + timer.accumulatedPausedSeconds) * 1000,
  )
}
