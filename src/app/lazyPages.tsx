import { lazy } from 'react'

export const HistoryPage = lazy(() =>
  import('@pages/HistoryPage').then((module) => ({
    default: module.HistoryPage,
  })),
)

export const LiveWorkoutPage = lazy(() =>
  import('@pages/LiveWorkoutPage').then((module) => ({
    default: module.LiveWorkoutPage,
  })),
)

export const NutritionPage = lazy(() =>
  import('@pages/NutritionPage').then((module) => ({
    default: module.NutritionPage,
  })),
)

export const RunPage = lazy(() =>
  import('@pages/RunPage').then((module) => ({ default: module.RunPage })),
)

export const SettingsPage = lazy(() =>
  import('@pages/SettingsPage').then((module) => ({
    default: module.SettingsPage,
  })),
)

export const TrainingPage = lazy(() =>
  import('@pages/TrainingPage').then((module) => ({
    default: module.TrainingPage,
  })),
)
