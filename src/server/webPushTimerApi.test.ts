import { describe, expect, it, vi } from 'vitest'

import {
  handleWebPushTimerRequest,
  readWebPushTimerJob,
} from './webPushTimerApi'

const subscription = {
  endpoint: 'https://push.example.test/device',
  expirationTime: null,
  keys: { auth: 'auth-key', p256dh: 'public-key' },
}

describe('handleWebPushTimerRequest', () => {
  it('cancels the previous job and schedules the replacement at timer expiry', async () => {
    const cancel = vi.fn(async () => undefined)
    const cancelForSubscription = vi.fn(async () => undefined)
    const publish = vi.fn(async () => ({ messageId: 'message-new' }))

    const result = await handleWebPushTimerRequest(
      {
        completionAt: '2026-06-27T12:01:30.000Z',
        previousMessageId: 'message-old',
        subscription,
        timerId: 'timer-1',
      },
      {
        cancel,
        cancelForSubscription,
        now: () => Date.parse('2026-06-27T12:00:00.000Z'),
        publish,
      },
    )

    expect(result).toEqual({ ok: true, messageId: 'message-new' })
    expect(cancel).toHaveBeenCalledWith('message-old')
    expect(cancelForSubscription).not.toHaveBeenCalled()
    expect(publish).toHaveBeenCalledWith({
      body: { subscription, timerId: 'timer-1' },
      deduplicationKey: [
        subscription.endpoint,
        'timer-1',
        '2026-06-27T12:01:30.000Z',
        0,
      ].join('|'),
      delaySeconds: 90,
    })
  })

  it('cancels without publishing when the timer is paused or dismissed', async () => {
    const cancel = vi.fn(async () => undefined)
    const cancelForSubscription = vi.fn(async () => undefined)
    const publish = vi.fn(async () => ({ messageId: 'unused' }))

    const result = await handleWebPushTimerRequest(
      {
        completionAt: null,
        previousMessageId: 'message-old',
        subscription,
        timerId: null,
      },
      { cancel, cancelForSubscription, publish },
    )

    expect(result).toEqual({ ok: true, messageId: null })
    expect(cancel).toHaveBeenCalledWith('message-old')
    expect(cancelForSubscription).toHaveBeenCalledWith(subscription)
    expect(publish).not.toHaveBeenCalled()
  })

  it('rejects expired, excessively delayed, and malformed subscriptions', async () => {
    const dependencies = {
      cancel: vi.fn(async () => undefined),
      cancelForSubscription: vi.fn(async () => undefined),
      now: () => Date.parse('2026-06-27T12:00:00.000Z'),
      publish: vi.fn(async () => ({ messageId: 'unused' })),
    }

    for (const input of [
      {
        completionAt: '2026-06-27T11:59:00.000Z',
        previousMessageId: null,
        subscription,
        timerId: 'timer-1',
      },
      {
        completionAt: '2026-06-29T12:00:00.000Z',
        previousMessageId: null,
        subscription,
        timerId: 'timer-1',
      },
      {
        completionAt: '2026-06-27T12:01:00.000Z',
        previousMessageId: null,
        subscription: { ...subscription, endpoint: 'http://not-secure.test' },
        timerId: 'timer-1',
      },
    ]) {
      await expect(
        handleWebPushTimerRequest(input, dependencies),
      ).resolves.toMatchObject({
        ok: false,
        error: { code: 'invalid_request' },
      })
    }
    expect(dependencies.publish).not.toHaveBeenCalled()
    expect(dependencies.cancel).not.toHaveBeenCalled()
    expect(dependencies.cancelForSubscription).not.toHaveBeenCalled()
  })

  it('uses the same deduplication key when a scheduling request is retried', async () => {
    const publish = vi.fn(
      async (_input: {
        body: unknown
        deduplicationKey: string
        delaySeconds: number
      }) => {
        expect(_input.deduplicationKey).toBeTruthy()
        return { messageId: 'message-new' }
      },
    )
    const dependencies = {
      cancel: vi.fn(async () => undefined),
      cancelForSubscription: vi.fn(async () => undefined),
      now: () => Date.parse('2026-06-27T12:00:00.000Z'),
      publish,
    }
    const request = {
      completionAt: '2026-06-27T12:01:30.000Z',
      previousMessageId: 'message-old',
      scheduleRevision: 7,
      subscription,
      timerId: 'timer-1',
    }

    await handleWebPushTimerRequest(request, dependencies)
    await handleWebPushTimerRequest(request, dependencies)

    expect(publish).toHaveBeenCalledTimes(2)
    expect(publish.mock.calls[0]?.[0].deduplicationKey).toBe(
      publish.mock.calls[1]?.[0].deduplicationKey,
    )
  })

  it('reports scheduler failures without exposing service details', async () => {
    const result = await handleWebPushTimerRequest(
      {
        completionAt: '2026-06-27T12:01:00.000Z',
        previousMessageId: null,
        subscription,
        timerId: 'timer-1',
      },
      {
        cancel: vi.fn(async () => undefined),
        cancelForSubscription: vi.fn(async () => undefined),
        now: () => Date.parse('2026-06-27T12:00:00.000Z'),
        publish: vi.fn(async () => {
          throw new Error('secret scheduler response')
        }),
      },
    )

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'scheduler_failed',
        message: 'The outside-app timer alert could not be scheduled.',
      },
    })
  })
})

describe('readWebPushTimerJob', () => {
  it('accepts a valid delivery payload and rejects malformed data', () => {
    expect(readWebPushTimerJob({ subscription, timerId: 'timer-1' })).toEqual({
      subscription,
      timerId: 'timer-1',
    })
    expect(
      readWebPushTimerJob({
        subscription: { ...subscription, keys: {} },
        timerId: 'timer-1',
      }),
    ).toBeNull()
  })
})
