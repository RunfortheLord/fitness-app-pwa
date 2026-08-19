import {
  initializeAppData,
  initializeNonCriticalAppData,
} from '@services/appInitializationService'

let initializationPromise: Promise<void> | undefined
let backgroundInitializationPromise: Promise<void> | undefined

export function initializeAppDataOnce() {
  initializationPromise ??= initializeAppData({
    skipNonCriticalWork: true,
  })
  return initializationPromise
}

export function initializeNonCriticalAppDataOnce() {
  backgroundInitializationPromise ??= initializeAppDataOnce().then(() =>
    initializeNonCriticalAppData({ deferExpandedExerciseSeed: true }),
  )
  return backgroundInitializationPromise
}
