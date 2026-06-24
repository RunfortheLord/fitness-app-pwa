import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_TIMER_SOUND_ID,
  getTimerSound,
  playTimerSoundOnce,
  previewTimerSoundOnce,
  primeTimerSound,
  resetTimerSoundsForTests,
} from '@domain/timerSounds'

const audioInstances: FakeAudio[] = []

class FakeAudio {
  currentTime = 0
  preload = ''
  muted = false
  readonly pause = vi.fn()
  readonly play = vi.fn(async () => undefined)
  readonly listeners = new Map<string, Set<EventListener>>()
  src: string

  constructor(src: string) {
    this.src = src
    audioInstances.push(this)
  }

  addEventListener(type: string, listener: EventListener) {
    const set = this.listeners.get(type) ?? new Set<EventListener>()
    set.add(listener)
    this.listeners.set(type, set)
  }

  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener)
  }
}

beforeEach(() => {
  audioInstances.length = 0
  Object.defineProperty(globalThis, 'Audio', {
    configurable: true,
    value: FakeAudio,
  })
  resetTimerSoundsForTests()
})

afterEach(() => {
  resetTimerSoundsForTests()
})

describe('getTimerSound', () => {
  it('falls back to the default for unknown ids', () => {
    expect(getTimerSound('missing').id).toBe(DEFAULT_TIMER_SOUND_ID)
    expect(getTimerSound(null).id).toBe(DEFAULT_TIMER_SOUND_ID)
  })
})

describe('rest timer completion audio', () => {
  it('primes the selected sound muted so it can be unlocked by a gesture', async () => {
    primeTimerSound('bright-bell')
    await Promise.resolve()
    await Promise.resolve()

    expect(audioInstances).toHaveLength(1)
    const primed = audioInstances[0]
    expect(primed?.src).toBe('/sounds/bright-bell.mp3')
    expect(primed?.play).toHaveBeenCalledTimes(1)
    // Unlock playback is muted, then paused and unmuted again.
    expect(primed?.pause).toHaveBeenCalledTimes(1)
    expect(primed?.muted).toBe(false)
  })

  it('reuses the primed element at completion and plays it audibly', async () => {
    primeTimerSound('bright-bell')
    await Promise.resolve()
    await Promise.resolve()

    await playTimerSoundOnce('bright-bell')

    // No new element was constructed: the unlocked one is reused.
    expect(audioInstances).toHaveLength(1)
    const audio = audioInstances[0]
    expect(audio?.muted).toBe(false)
    expect(audio?.play).toHaveBeenCalledTimes(2)
  })

  it('updates the reused element when the selected sound changes', async () => {
    primeTimerSound('bright-bell')
    await Promise.resolve()
    await Promise.resolve()

    await playTimerSoundOnce('clear-ding')

    expect(audioInstances).toHaveLength(1)
    expect(audioInstances[0]?.src).toBe('/sounds/clear-ding.mp3')
  })

  it('stops completion playback before a preview begins', async () => {
    primeTimerSound('bright-bell')
    await Promise.resolve()
    await Promise.resolve()
    const completion = audioInstances[0]

    await previewTimerSoundOnce('gentle-ping')

    expect(completion?.pause).toHaveBeenCalled()
    expect(audioInstances[1]?.src).toBe('/sounds/gentle-ping.mp3')
  })
})
