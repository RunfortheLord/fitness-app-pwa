import { describe, expect, it } from 'vitest'

import {
  createTreadmillMotionState,
  processTreadmillMotion,
} from '@domain/treadmillTracking'

describe('treadmill motion tracking', () => {
  it('counts one step for a motion peak and requires a reset before another', () => {
    let state = createTreadmillMotionState()
    state = processTreadmillMotion(state, sample(0, 9.8))
    state = processTreadmillMotion(state, sample(300, 12))
    state = processTreadmillMotion(state, sample(400, 12.2))
    expect(state.stepCount).toBe(1)

    state = processTreadmillMotion(state, sample(500, 9.8))
    state = processTreadmillMotion(state, sample(700, 12))
    expect(state.stepCount).toBe(2)
  })

  it('ignores peaks inside the refractory interval', () => {
    let state = createTreadmillMotionState()
    state = processTreadmillMotion(state, sample(0, 9.8))
    state = processTreadmillMotion(state, sample(300, 12))
    state = processTreadmillMotion(state, sample(350, 9.8))
    state = processTreadmillMotion(state, sample(450, 12))
    expect(state.stepCount).toBe(1)
  })

  it('preserves an existing step count after resume', () => {
    const state = processTreadmillMotion(
      createTreadmillMotionState(42),
      sample(0, 9.8),
    )
    expect(state.stepCount).toBe(42)
  })
})

function sample(timestamp: number, z: number) {
  return { timestamp, x: 0, y: 0, z }
}
