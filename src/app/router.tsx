import { createBrowserRouter } from 'react-router-dom'

import { App } from '@app/App'
import { ErrorBoundary } from '@app/ErrorBoundary'
import { HistoryPage } from '@pages/HistoryPage'
import { HomePage } from '@pages/HomePage'
import { NutritionPage } from '@pages/NutritionPage'
import { SettingsPage } from '@pages/SettingsPage'
import { TrainingPage } from '@pages/TrainingPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'nutrition', element: <NutritionPage /> },
      { path: 'training', element: <TrainingPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])
