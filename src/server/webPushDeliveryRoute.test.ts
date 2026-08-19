import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  sendNotification: vi.fn(),
  verify: vi.fn(),
}))

vi.mock('@upstash/qstash', () => ({
  Receiver: class {
    verify = mocks.verify
  },
}))

vi.mock('web-push', () => ({
  default: { sendNotification: mocks.sendNotification },
}))

import { POST } from '../../api/push/deliver'

const validJob = {
  subscription: {
    endpoint: 'https://push.example.test/device',
    expirationTime: null,
    keys: { auth: 'auth-key', p256dh: 'public-key' },
  },
  timerId: 'timer-1',
}

beforeEach(() => {
  mocks.sendNotification.mockReset()
  mocks.verify.mockReset()
  mocks.verify.mockResolvedValue(true)
  mocks.sendNotification.mockResolvedValue({})
  vi.stubEnv('QSTASH_CURRENT_SIGNING_KEY', 'current-key')
  vi.stubEnv('QSTASH_NEXT_SIGNING_KEY', 'next-key')
  vi.stubEnv('WEB_PUSH_PUBLIC_KEY', 'public-key')
  vi.stubEnv('WEB_PUSH_PRIVATE_KEY', 'private-key')
  vi.stubEnv('WEB_PUSH_SUBJECT', 'mailto:test@example.com')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('web push delivery route', () => {
  it('rejects oversized bodies before signature verification or delivery', async () => {
    const response = await POST(
      new Request('https://app.example/api/push/deliver', {
        body: 'x'.repeat(8_193),
        headers: {
          'content-length': '8193',
          'upstash-signature': 'signature',
        },
        method: 'POST',
      }),
    )

    expect(response.status).toBe(413)
    expect(mocks.verify).not.toHaveBeenCalled()
    expect(mocks.sendNotification).not.toHaveBeenCalled()
  })

  it('never sends a notification when QStash verification fails', async () => {
    mocks.verify.mockRejectedValue(new Error('invalid signature'))
    const response = await POST(requestFor(validJob))

    expect(response.status).toBe(401)
    expect(mocks.sendNotification).not.toHaveBeenCalled()
  })

  it('verifies before sending a bounded valid job', async () => {
    const response = await POST(requestFor(validJob))

    expect(response.status).toBe(200)
    expect(mocks.verify).toHaveBeenCalledTimes(1)
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      validJob.subscription,
      expect.any(String),
      expect.objectContaining({ timeout: 10_000 }),
    )
  })
})

function requestFor(body: unknown) {
  return new Request('https://app.example/api/push/deliver', {
    body: JSON.stringify(body),
    headers: { 'upstash-signature': 'signature' },
    method: 'POST',
  })
}
