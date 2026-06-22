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

export async function playTimerSoundOnce(id: string | null | undefined) {
  const sound = getTimerSound(id)
  const audio = new Audio(sound.src)
  audio.preload = 'auto'
  audio.currentTime = 0
  await audio.play()
}
