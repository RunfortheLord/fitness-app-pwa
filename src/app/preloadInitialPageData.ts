import { formatLocalDate } from '@domain/dates'
import { initializeAppDataOnce } from '@services/appStartupService'

export async function preloadInitialPageData() {
  await initializeAppDataOnce().catch(() => undefined)
  const today = formatLocalDate(new Date())

  const [
    { preloadCalorieInsightsPageData },
    { preloadHistoryPageData },
    { preloadNutritionPageData },
    { preloadRunPageData },
    { preloadTrainingPageData },
    { dashboardService },
  ] = await Promise.all([
    import('@pages/calorieInsightsPageCache'),
    import('@pages/historyPageCache'),
    import('@pages/nutritionPageCache'),
    import('@pages/runPageCache'),
    import('@pages/trainingPageCache'),
    import('@services/dashboardService'),
  ])

  await Promise.allSettled([
    dashboardService.getDashboardData(today, { syncCalorieHistory: false }),
    preloadCalorieInsightsPageData(today),
    preloadHistoryPageData(),
    preloadNutritionPageData(today),
    preloadRunPageData(),
    preloadTrainingPageData(),
  ])
}
