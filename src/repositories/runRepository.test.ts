import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createRunRepository } from '@repositories/runRepository'
import { createTestDatabase, destroyTestDatabase } from '@test/database'
import type { TrainingLogDatabase } from '@db/database'

describe('runRepository', () => {
  let database: TrainingLogDatabase

  beforeEach(async () => {
    database = createTestDatabase()
    await database.open()
  })

  afterEach(async () => {
    await destroyTestDatabase(database)
  })

  it('starts, pauses, resumes, finishes, and persists a completed run', async () => {
    const repository = createRunRepository(database)
    const run = await repository.startRun(new Date('2026-06-19T12:00:00.000Z'))

    await repository.pauseRun(run.id, new Date('2026-06-19T12:05:00.000Z'))
    await expect(repository.getActiveRun()).resolves.toMatchObject({
      status: 'paused',
    })
    await repository.resumeRun(run.id, new Date('2026-06-19T12:06:00.000Z'))
    await expect(repository.getActiveRun()).resolves.toMatchObject({
      status: 'active',
    })
    await repository.finishRun(run.id, new Date('2026-06-19T12:20:00.000Z'))

    await expect(repository.getActiveRun()).resolves.toBeUndefined()
    await expect(repository.listRecentCompletedRuns()).resolves.toHaveLength(1)
    const structure = await repository.getRunStructure(run.id)
    expect(structure.run.elapsedSeconds).toBe(1200)
    expect(structure.pauses[0]).toMatchObject({
      startedAt: '2026-06-19T12:05:00.000Z',
      endedAt: '2026-06-19T12:06:00.000Z',
    })
  })

  it('prevents two simultaneous runs', async () => {
    const repository = createRunRepository(database)
    await repository.startRun(new Date('2026-06-19T12:00:00.000Z'))
    await expect(
      repository.startRun(new Date('2026-06-19T12:01:00.000Z')),
    ).rejects.toThrow(/active run/)
  })

  it('stores accepted, rejected, gap samples, moving time, and splits', async () => {
    const repository = createRunRepository(database)
    const run = await repository.startRun(new Date('2026-06-19T12:00:00.000Z'))

    await repository.addSample(run.id, {
      latitude: 41.88,
      longitude: -87.63,
      timestamp: '2026-06-19T12:00:00.000Z',
      accuracyMeters: 8,
    })
    await repository.addSample(run.id, {
      latitude: 41.88001,
      longitude: -87.63,
      timestamp: '2026-06-19T12:00:10.000Z',
      accuracyMeters: 8,
    })
    await repository.addSample(run.id, {
      latitude: 41.8945,
      longitude: -87.63,
      timestamp: '2026-06-19T12:10:00.000Z',
      accuracyMeters: 8,
    })
    await repository.addSample(run.id, {
      latitude: 41.909,
      longitude: -87.63,
      timestamp: '2026-06-19T12:20:00.000Z',
      accuracyMeters: 8,
    })

    const structure = await repository.getRunStructure(run.id)
    expect(structure.samples.map((sample) => sample.decision)).toEqual([
      'accepted',
      'rejected',
      'gap',
      'gap',
    ])
    expect(structure.run.hasGpsGap).toBe(true)
    expect(structure.run.distanceMeters).toBe(0)
  })

  it('records low-pace classifications separately from samples', async () => {
    const repository = createRunRepository(database)
    const run = await repository.startRun(new Date('2026-06-19T12:00:00.000Z'))
    await repository.recordLowPaceResponse(
      run.id,
      'walking',
      new Date('2026-06-19T12:03:00.000Z'),
    )

    const structure = await repository.getRunStructure(run.id)
    expect(structure.classifications[0]).toMatchObject({
      type: 'walking',
      response: 'walking',
    })
  })
})
