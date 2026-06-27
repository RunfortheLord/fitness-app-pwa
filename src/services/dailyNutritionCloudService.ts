import type { DailyCalorieHistory } from '@services/calorieHistoryService'
import { authService } from '@services/authService'
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from '@services/supabaseClient'

export const dailyNutritionCloudService = {
  async sync(history: DailyCalorieHistory[]): Promise<boolean> {
    if (
      history.length === 0 ||
      !isSupabaseConfigured() ||
      (typeof navigator !== 'undefined' && navigator.onLine === false)
    ) {
      return false
    }

    const session = await authService.getSession()
    if (!session?.user) {
      return false
    }

    const updatedAt = new Date().toISOString()
    const rows = history.map((day) => ({
      user_id: session.user.id,
      local_date: day.localDate,
      logged_calories: day.loggedCalories,
      target_calories: day.targetCalories,
      updated_at: updatedAt,
    }))
    const { error } = await getSupabaseClient()
      .from('daily_nutrition')
      .upsert(rows, { onConflict: 'user_id,local_date' })

    if (error) {
      throw new Error(
        error.message || 'Daily nutrition could not be synced to Supabase.',
      )
    }
    return true
  },
}
