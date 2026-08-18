import { beforeEach, describe, expect, it, vi } from 'vitest'

import { dailyNutritionCloudService } from '@services/dailyNutritionCloudService'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getSupabaseClient: vi.fn(),
  isSupabaseConfigured: vi.fn(),
  from: vi.fn(),
  getDailyNutritionSyncState: vi.fn(),
  recordDailyNutritionSync: vi.fn(),
}))

vi.mock('@repositories/appMetadataRepository', () => ({
  appMetadataRepository: {
    getDailyNutritionSyncState: mocks.getDailyNutritionSyncState,
    recordDailyNutritionSync: mocks.recordDailyNutritionSync,
  },
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
  mocks.getDailyNutritionSyncState.mockReset()
  mocks.recordDailyNutritionSync.mockReset()
  mocks.isSupabaseConfigured.mockReturnValue(true)
  mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } })
  mocks.getSupabaseClient.mockReturnValue({ from: mocks.from })
  mocks.getDailyNutritionSyncState.mockResolvedValue({
    fingerprints: {},
    userId: null,
  })
  mocks.recordDailyNutritionSync.mockResolvedValue(undefined)
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

  it('skips unchanged dates and uploads only changed rows', async () => {
    mocks.getDailyNutritionSyncState.mockResolvedValue({
      fingerprints: {
        '2026-06-26': JSON.stringify([1800, 2200]),
        '2026-06-27': JSON.stringify([1875, 2200]),
      },
      userId: 'user-1',
    })
    const upsert = vi.fn().mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({ upsert })

    await expect(
      dailyNutritionCloudService.sync([
        {
          localDate: '2026-06-26',
          loggedCalories: 1800,
          targetCalories: 2200,
        },
        {
          localDate: '2026-06-27',
          loggedCalories: 1900,
          targetCalories: 2200,
        },
      ]),
    ).resolves.toBe(true)

    expect(upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ local_date: '2026-06-27' })],
      { onConflict: 'user_id,local_date' },
    )
    expect(mocks.recordDailyNutritionSync).toHaveBeenCalledWith('user-1', {
      '2026-06-27': JSON.stringify([1900, 2200]),
    })
  })

  it('does not call Supabase when every date is unchanged', async () => {
    mocks.getDailyNutritionSyncState.mockResolvedValue({
      fingerprints: { '2026-06-27': JSON.stringify([1875, 2200]) },
      userId: 'user-1',
    })

    await expect(
      dailyNutritionCloudService.sync([
        {
          localDate: '2026-06-27',
          loggedCalories: 1875,
          targetCalories: 2200,
        },
      ]),
    ).resolves.toBe(true)

    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.recordDailyNutritionSync).not.toHaveBeenCalled()
  })

  it('does not advance fingerprints after a failed upsert', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: 'failed' } })
    mocks.from.mockReturnValue({ upsert })

    await expect(
      dailyNutritionCloudService.sync([
        {
          localDate: '2026-06-27',
          loggedCalories: 1875,
          targetCalories: 2200,
        },
      ]),
    ).rejects.toThrow('failed')
    expect(mocks.recordDailyNutritionSync).not.toHaveBeenCalled()
  })
})
