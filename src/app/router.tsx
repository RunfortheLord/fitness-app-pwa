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
import { AccountDeletionPage, SupportPage } from '@pages/PublicInformationPages'

async function loadLegalDocumentPages() {
  return import('@pages/LegalDocumentPages')
}

export const router = createBrowserRouter([
  {
    path: '/terms',
    lazy: async () => ({
      Component: (await loadLegalDocumentPages()).TermsOfUsePage,
    }),
  },
  {
    path: '/privacy',
    lazy: async () => ({
      Component: (await loadLegalDocumentPages()).PrivacyPolicyPage,
    }),
  },
  {
    path: '/consumer-health-data-privacy',
    lazy: async () => ({
      Component: (await loadLegalDocumentPages())
        .ConsumerHealthDataPrivacyPolicyPage,
    }),
  },
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
