export type TimerSound = {
  id: string
  name: string
  src: string
}

export const DEFAULT_TIMER_SOUND_ID = 'rest-complete-chime'

export const TIMER_SOUNDS: TimerSound[] = [
  {
    id: DEFAULT_TIMER_SOUND_ID,
    name: 'Clean completion chime',
    src: '/sounds/rest-complete-chime.mp3',
  },
  { id: 'bright-bell', name: 'Bright bell', src: '/sounds/bright-bell.mp3' },
  {
    id: 'soft-digital-chime',
    name: 'Soft digital chime',
    src: '/sounds/soft-digital-chime.mp3',
  },
  {
    id: 'short-alert-tone',
    name: 'Short alert tone',
    src: '/sounds/short-alert-tone.mp3',
  },
  { id: 'warm-bell', name: 'Warm bell', src: '/sounds/warm-bell.mp3' },
  { id: 'clear-ding', name: 'Clear ding', src: '/sounds/clear-ding.mp3' },
  { id: 'gentle-ping', name: 'Gentle ping', src: '/sounds/gentle-ping.mp3' },
]

export function getTimerSound(id: string | null | undefined) {
  return (
    TIMER_SOUNDS.find((sound) => sound.id === id) ??
    TIMER_SOUNDS.find((sound) => sound.id === DEFAULT_TIMER_SOUND_ID)!
  )
}

// A rest timer fires from an interval/visibility callback long after the set was
// completed, so the completion `play()` has no user gesture of its own. Mobile
// browsers (notably iOS Safari) reject audio that starts outside a gesture and
// was never unlocked, which is why the selected sound previously stayed silent
// when the timer went off. We keep a single, reused completion audio element and
// "unlock" it during the gesture that starts the rest timer (completing a set),
// so the later programmatic playback is permitted.
let completionAudio: HTMLAudioElement | null = null
let completionAudioSrc: string | null = null
let activePreviewAudio: HTMLAudioElement | null = null

function audioSupported() {
  return typeof Audio !== 'undefined'
}

function ensureCompletionAudio(src: string) {
  if (!completionAudio) {
    completionAudio = new Audio(src)
    completionAudio.preload = 'auto'
  } else if (completionAudioSrc !== src) {
    completionAudio.src = src
  }
  completionAudioSrc = src
  return completionAudio
}

function stopAudio(audio: HTMLAudioElement | null) {
  if (!audio) {
    return
  }
  audio.pause()
  try {
    audio.currentTime = 0
  } catch {
    // Resetting currentTime can throw before metadata loads; ignore.
  }
}

/**
 * Unlock and preload the completion sound from within a user gesture (for
 * example, completing a set that starts a rest timer). Plays the element muted
 * and immediately pauses it so a later, gesture-less `play()` at completion is
 * allowed by autoplay policy. Safe to call repeatedly.
 */
export function primeTimerSound(id: string | null | undefined) {
  if (!audioSupported()) {
    return
  }
  const sound = getTimerSound(id)
  const audio = ensureCompletionAudio(sound.src)
  const wasMuted = audio.muted
  audio.muted = true
  const restore = () => {
    audio.muted = wasMuted
  }
  void Promise.resolve(audio.play())
    .then(() => {
      audio.pause()
      try {
        audio.currentTime = 0
      } catch {
        // ignore
      }
      restore()
    })
    .catch(restore)
}

/**
 * Play the selected completion sound exactly once. Reuses the element primed by
 * {@link primeTimerSound} so it can play without its own gesture. Any in-flight
 * preview is stopped first so the two never overlap.
 */
export async function playTimerSoundOnce(id: string | null | undefined) {
  if (!audioSupported()) {
    return
  }
  stopAudio(activePreviewAudio)
  activePreviewAudio = null

  const sound = getTimerSound(id)
  const audio = ensureCompletionAudio(sound.src)
  audio.muted = false
  try {
    audio.currentTime = 0
  } catch {
    // ignore
  }
  await audio.play()
}

/**
 * Preview a sound from a settings tap. Never overlaps an active completion
 * sound and replaces any previous preview.
 */
export async function previewTimerSoundOnce(id: string | null | undefined) {
  if (!audioSupported()) {
    return
  }
  stopAudio(activePreviewAudio)
  activePreviewAudio = null
  stopAudio(completionAudio)

  const sound = getTimerSound(id)
  const audio = new Audio(sound.src)
  activePreviewAudio = audio
  audio.preload = 'auto'
  audio.currentTime = 0
  audio.addEventListener(
    'ended',
    () => {
      if (activePreviewAudio === audio) {
        activePreviewAudio = null
      }
    },
    { once: true },
  )
  await audio.play()
}

/** Stop any preview or completion playback. */
export function stopTimerSounds() {
  stopAudio(activePreviewAudio)
  stopAudio(completionAudio)
  activePreviewAudio = null
}

/** Test-only reset of the module audio singletons. */
export function resetTimerSoundsForTests() {
  stopTimerSounds()
  completionAudio = null
  completionAudioSrc = null
}
