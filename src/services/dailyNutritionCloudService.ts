import type { DailyCalorieHistory } from '@services/calorieHistoryService'
import { authService } from '@services/authService'
import { appMetadataRepository } from '@repositories/appMetadataRepository'
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

    const state = await appMetadataRepository.getDailyNutritionSyncState()
    const uniqueDays = new Map(history.map((day) => [day.localDate, day]))
    const fingerprints = Object.fromEntries(
      [...uniqueDays.values()].map((day) => [
        day.localDate,
        JSON.stringify([day.loggedCalories, day.targetCalories]),
      ]),
    )
    const changedDays = [...uniqueDays.values()].filter(
      (day) =>
        state.userId !== session.user.id ||
        state.fingerprints[day.localDate] !== fingerprints[day.localDate],
    )
    if (changedDays.length === 0) {
      return true
    }

    const updatedAt = new Date().toISOString()
    const rows = changedDays.map((day) => ({
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
    await appMetadataRepository.recordDailyNutritionSync(
      session.user.id,
      Object.fromEntries(
        changedDays.map((day) => [day.localDate, fingerprints[day.localDate]]),
      ),
    )
    return true
  },
}
