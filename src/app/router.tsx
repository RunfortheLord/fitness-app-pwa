import { createBrowserRouter } from 'react-router-dom'

import { App } from '@app/App'
import { ErrorBoundary } from '@app/ErrorBoundary'
import {
  CalorieInsightsPage,
  HistoryPage,
  LiveWorkoutPage,
  NutritionPage,
  RunPage,
  SettingsPage,
  TrainingPage,
} from '@app/lazyPages'
import { HomePage } from '@pages/HomePage'
import {
  AccountDeletionPage,
  PrivacyPolicyPage,
  SupportPage,
} from '@pages/PublicInformationPages'

export const router = createBrowserRouter([
  { path: '/privacy', element: <PrivacyPolicyPage /> },
  { path: '/account-deletion', element: <AccountDeletionPage /> },
  { path: '/support', element: <SupportPage /> },
  {
    path: '/',
    element: <App />,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'calories', element: <CalorieInsightsPage /> },
      { path: 'nutrition', element: <NutritionPage /> },
      { path: 'run', element: <RunPage /> },
      { path: 'training', element: <TrainingPage /> },
      { path: 'workout', element: <LiveWorkoutPage /> },
      { path: 'graphs', element: <HistoryPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])
