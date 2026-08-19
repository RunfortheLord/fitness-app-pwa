export type TreadmillMotionState = {
  baselineMagnitude: number | null
  aboveThreshold: boolean
  lastStepAt: number | null
  stepCount: number
}

export type TreadmillMotionSample = {
  timestamp: number
  x: number
  y: number
  z: number
}

const STEP_THRESHOLD = 1.15
const RESET_THRESHOLD = 0.45
const MIN_STEP_INTERVAL_MS = 280
const BASELINE_SMOOTHING = 0.08

export function createTreadmillMotionState(
  stepCount = 0,
): TreadmillMotionState {
  return {
    baselineMagnitude: null,
    aboveThreshold: false,
    lastStepAt: null,
    stepCount,
  }
}

export function processTreadmillMotion(
  state: TreadmillMotionState,
  sample: TreadmillMotionSample,
): TreadmillMotionState {
  const magnitude = Math.hypot(sample.x, sample.y, sample.z)
  if (!Number.isFinite(magnitude)) {
    return state
  }
  const previousBaseline = state.baselineMagnitude ?? magnitude
  const baselineMagnitude =
    previousBaseline + (magnitude - previousBaseline) * BASELINE_SMOOTHING
  const movement = Math.abs(magnitude - baselineMagnitude)
  const reset = movement <= RESET_THRESHOLD
  const intervalElapsed =
    state.lastStepAt === null ||
    sample.timestamp - state.lastStepAt >= MIN_STEP_INTERVAL_MS
  const detected =
    movement >= STEP_THRESHOLD && !state.aboveThreshold && intervalElapsed

  return {
    baselineMagnitude,
    aboveThreshold: reset ? false : state.aboveThreshold || detected,
    lastStepAt: detected ? sample.timestamp : state.lastStepAt,
    stepCount: state.stepCount + (detected ? 1 : 0),
  }
}
