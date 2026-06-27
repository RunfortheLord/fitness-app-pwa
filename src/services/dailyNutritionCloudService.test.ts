import { beforeEach, describe, expect, it, vi } from 'vitest'

import { dailyNutritionCloudService } from '@services/dailyNutritionCloudService'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getSupabaseClient: vi.fn(),
  isSupabaseConfigured: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@services/authService', () => ({
  authService: { getSession: mocks.getSession },
}))

vi.mock('@services/supabaseClient', () => ({
  getSupabaseClient: mocks.getSupabaseClient,
  isSupabaseConfigured: mocks.isSupabaseConfigured,
}))

beforeEach(() => {
  mocks.getSession.mockReset()
  mocks.getSupabaseClient.mockReset()
  mocks.isSupabaseConfigured.mockReset()
  mocks.from.mockReset()
  mocks.isSupabaseConfigured.mockReturnValue(true)
  mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } })
  mocks.getSupabaseClient.mockReturnValue({ from: mocks.from })
})

describe('dailyNutritionCloudService', () => {
  it('upserts daily targets and logged calories for the signed-in user', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({ upsert })

    await expect(
      dailyNutritionCloudService.sync([
        {
          localDate: '2026-06-27',
          loggedCalories: 1875,
          targetCalories: 2200,
        },
      ]),
    ).resolves.toBe(true)

    expect(mocks.from).toHaveBeenCalledWith('daily_nutrition')
    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          user_id: 'user-1',
          local_date: '2026-06-27',
          logged_calories: 1875,
          target_calories: 2200,
        }),
      ],
      { onConflict: 'user_id,local_date' },
    )
  })

  it('keeps local use available when Supabase is not configured', async () => {
    mocks.isSupabaseConfigured.mockReturnValue(false)

    await expect(
      dailyNutritionCloudService.sync([
        {
          localDate: '2026-06-27',
          loggedCalories: 0,
          targetCalories: 0,
        },
      ]),
    ).resolves.toBe(false)

    expect(mocks.getSession).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
