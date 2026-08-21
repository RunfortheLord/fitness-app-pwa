import { Capacitor } from '@capacitor/core'

export type LiveWorkoutNumericKeypadMode = 'decimal' | 'duration' | 'integer'

export type NumericKeypadCommand =
  | '.'
  | ':'
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'backspace'
  | 'clear'

export function applyNumericKeypadCommand(
  value: string,
  mode: LiveWorkoutNumericKeypadMode,
  command: NumericKeypadCommand,
  replaceOnNextEntry: boolean,
) {
  if (command === 'clear') {
    return { replaceOnNextEntry: false, value: '' }
  }
  if (command === 'backspace') {
    return {
      replaceOnNextEntry: false,
      value: value.slice(0, -1),
    }
  }

  const isDigit = /^\d$/.test(command)
  if (!isDigit && command === '.' && mode !== 'decimal') {
    return { replaceOnNextEntry, value }
  }
  if (!isDigit && command === ':' && mode !== 'duration') {
    return { replaceOnNextEntry, value }
  }
  if (command === '.' && value.includes('.') && !replaceOnNextEntry) {
    return { replaceOnNextEntry, value }
  }
  if (command === ':' && value.includes(':') && !replaceOnNextEntry) {
    return { replaceOnNextEntry, value }
  }

  if (replaceOnNextEntry) {
    return {
      replaceOnNextEntry: false,
      value: command === '.' ? '0.' : command === ':' ? '0:' : command,
    }
  }

  if (value === '' && command === '.') {
    return { replaceOnNextEntry: false, value: '0.' }
  }
  if (value === '' && command === ':') {
    return { replaceOnNextEntry: false, value: '0:' }
  }
  if (value === '0' && isDigit) {
    return { replaceOnNextEntry: false, value: command }
  }
  return { replaceOnNextEntry: false, value: `${value}${command}` }
}

export function keyboardEventToNumericKeypadCommand(
  event: KeyboardEvent,
  mode: LiveWorkoutNumericKeypadMode,
): NumericKeypadCommand | null {
  if (/^\d$/.test(event.key)) {
    return event.key as NumericKeypadCommand
  }
  if ((event.key === '.' || event.key === ',') && mode === 'decimal') {
    return '.'
  }
  if (event.key === ':' && mode === 'duration') {
    return ':'
  }
  if (event.key === 'Backspace') {
    return 'backspace'
  }
  if (event.key === 'Delete') {
    return 'clear'
  }
  return null
}

export function shouldUseLiveWorkoutAppKeypad() {
  if (Capacitor.isNativePlatform()) {
    return Capacitor.getPlatform() === 'ios'
  }

  const standaloneNavigator = navigator as Navigator & {
    standalone?: boolean
  }
  const isInstalled =
    standaloneNavigator.standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true
  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  return isInstalled && isIos
}
