import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '@db/database'
import { initializeAppData } from '@services/appInitializationService'

describe('initializeAppData', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    await db.delete()
  })

  it('requests persistent browser storage during app startup and records the result', async () => {
    const persist = vi.fn().mockResolvedValue(true)
    vi.stubGlobal('navigator', {
      ...navigator,
      storage: { persist },
    })

    await initializeAppData()

    expect(persist).toHaveBeenCalledOnce()
    await expect(db.appMetadata.get('app')).resolves.toMatchObject({
      storagePersistenceStatus: 'granted',
      storagePersistenceCheckedAt: expect.any(String),
    })
  })

  it('records unsupported storage persistence when the browser lacks the API', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      storage: undefined,
    })

    await initializeAppData()

    await expect(db.appMetadata.get('app')).resolves.toMatchObject({
      storagePersistenceStatus: 'unsupported',
    })
  })
})
