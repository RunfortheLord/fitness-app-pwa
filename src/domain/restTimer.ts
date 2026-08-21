import type { RestTimerState } from '@shared-types/app'

export function updateRestTimerDuration(
  timer: RestTimerState,
  durationSeconds: number,
  nowIso = new Date().toISOString(),
): RestTimerState {
  const normalizedDuration = Math.max(0, Math.round(durationSeconds))
  if (timer.status !== 'completed') {
    return { ...timer, durationSeconds: normalizedDuration }
  }

  return {
    ...timer,
    startedAt: nowIso,
    durationSeconds: normalizedDuration,
    pausedAt: null,
    accumulatedPausedSeconds: 0,
    status: 'running',
  }
}

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
        elapsedTimerSeconds(
          timer.startedAt,
          timer.pausedAt,
          timer.accumulatedPausedSeconds,
        ),
    )
  }

  return Math.max(
    0,
    timer.durationSeconds -
      elapsedTimerSeconds(
        timer.startedAt,
        nowIso,
        timer.accumulatedPausedSeconds,
      ),
  )
}

function elapsedTimerSeconds(
  startedAt: string,
  observedAt: string,
  accumulatedPausedSeconds: number,
) {
  const elapsed = Math.floor(
    (Date.parse(observedAt) -
      Date.parse(startedAt) -
      accumulatedPausedSeconds * 1000) /
      1000,
  )
  return Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0
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
