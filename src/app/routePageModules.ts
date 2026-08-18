import { createElement, type ComponentType } from 'react'

function createPreloadablePage(load: () => Promise<ComponentType>) {
  let loadedPage: ComponentType | undefined
  let loadPromise: Promise<ComponentType> | undefined

  const preload = () => {
    loadPromise ??= load().then((page) => {
      loadedPage = page
      return page
    })
    return loadPromise
  }

  const Page = () => {
    if (!loadedPage) {
      throw preload()
    }
    return createElement(loadedPage)
  }

  return { Page, preload }
}

const calorieInsightsPage = createPreloadablePage(() =>
  import('@pages/CalorieInsightsPage').then(
    (module) => module.CalorieInsightsPage,
  ),
)
const historyPage = createPreloadablePage(() =>
  import('@pages/HistoryPage').then((module) => module.HistoryPage),
)
const liveWorkoutPage = createPreloadablePage(() =>
  import('@pages/LiveWorkoutPage').then((module) => module.LiveWorkoutPage),
)
const nutritionPage = createPreloadablePage(() =>
  import('@pages/NutritionPage').then((module) => module.NutritionPage),
)
const runPage = createPreloadablePage(() =>
  import('@pages/RunPage').then((module) => module.RunPage),
)
const settingsPage = createPreloadablePage(() =>
  import('@pages/SettingsPage').then((module) => module.SettingsPage),
)
const trainingPage = createPreloadablePage(() =>
  import('@pages/TrainingPage').then((module) => module.TrainingPage),
)

export const CalorieInsightsPage = calorieInsightsPage.Page
export const HistoryPage = historyPage.Page
export const LiveWorkoutPage = liveWorkoutPage.Page
export const NutritionPage = nutritionPage.Page
export const RunPage = runPage.Page
export const SettingsPage = settingsPage.Page
export const TrainingPage = trainingPage.Page

export const routePageLoaders = [
  calorieInsightsPage.preload,
  historyPage.preload,
  liveWorkoutPage.preload,
  nutritionPage.preload,
  runPage.preload,
  settingsPage.preload,
  trainingPage.preload,
]
