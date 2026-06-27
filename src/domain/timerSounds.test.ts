import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  configureTimerAudioSession,
  DEFAULT_TIMER_SOUND_ID,
  getTimerSound,
  playTimerSoundOnce,
  preloadTimerSound,
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
  readonly load = vi.fn()
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
  it('preloads and reuses the selected sound for the first preview tap', async () => {
    preloadTimerSound('gentle-ping')

    expect(audioInstances).toHaveLength(1)
    expect(audioInstances[0]?.load).toHaveBeenCalledTimes(1)

    await previewTimerSoundOnce('gentle-ping')

    expect(audioInstances).toHaveLength(1)
    expect(audioInstances[0]?.play).toHaveBeenCalledTimes(1)
  })

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

  it('uses a transient session for completion so other audio is not stopped', async () => {
    const audioSession = { type: 'auto' }
    Object.defineProperty(navigator, 'audioSession', {
      configurable: true,
      value: audioSession,
    })

    try {
      configureTimerAudioSession()
      expect(audioSession.type).toBe('playback')

      audioSession.type = 'auto'
      primeTimerSound('bright-bell')
      await Promise.resolve()
      expect(audioSession.type).toBe('transient')

      await playTimerSoundOnce('bright-bell')
      expect(audioSession.type).toBe('transient')
    } finally {
      delete (navigator as Navigator & { audioSession?: unknown }).audioSession
    }
  })

  it('does not throw when the audio session API is unavailable', () => {
    expect('audioSession' in navigator).toBe(false)
    expect(() => configureTimerAudioSession()).not.toThrow()
  })

  it('uses playback for preview so iPhone Silent Mode does not suppress it', async () => {
    const audioSession = { type: 'auto' }
    Object.defineProperty(navigator, 'audioSession', {
      configurable: true,
      value: audioSession,
    })

    try {
      await previewTimerSoundOnce('gentle-ping')

      expect(audioInstances[0]?.play).toHaveBeenCalledTimes(1)
      expect(audioSession.type).toBe('playback')
    } finally {
      delete (navigator as Navigator & { audioSession?: unknown }).audioSession
    }
  })

  it('stops completion playback before a preview begins', async () => {
    primeTimerSound('bright-bell')
    await Promise.resolve()
    await Promise.resolve()
    const completion = audioInstances[0]

    await previewTimerSoundOnce('gentle-ping')

    expect(completion?.pause).toHaveBeenCalled()
    expect(audioInstances).toHaveLength(1)
    expect(audioInstances[0]?.src).toBe('/sounds/gentle-ping.mp3')
  })
})
