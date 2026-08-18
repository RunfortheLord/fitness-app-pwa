import { describe, expect, it, vi } from 'vitest'

import {
  createRequestObserver,
  readAnonymousClientKey,
  readBoundedJsonObject,
} from './serverHttp'

describe('server HTTP helpers', () => {
  it('bounds string and parsed JSON bodies', () => {
    expect(readBoundedJsonObject('{"ok":true}', 20)).toEqual({
      ok: true,
      data: { ok: true },
    })
    expect(readBoundedJsonObject('{bad', 20)).toMatchObject({
      ok: false,
      reason: 'invalid_json',
    })
    expect(readBoundedJsonObject({ value: 'x'.repeat(30) }, 20)).toMatchObject({
      ok: false,
      reason: 'payload_too_large',
    })
  })

  it('uses network and user-agent metadata only for an anonymous limiter key', () => {
    expect(
      readAnonymousClientKey({
        headers: {
          'User-Agent': 'test-browser',
          'X-Forwarded-For': '203.0.113.8, 10.0.0.1',
        },
      }),
    ).toBe('203.0.113.8|test-browser')
  })

  it('logs only allowlisted request metadata', () => {
    const logger = vi.fn()
    let now = 100
    const observer = createRequestObserver({
      headers: { 'x-request-id': 'request-1' },
      logger,
      method: 'POST',
      now: () => now,
      route: '/api/meal-analysis',
    })
    now = 125
    observer.finish({
      cache: 'not_applicable',
      outcome: 'success',
      provider: 'openai',
      status: 200,
    })

    const line = String(logger.mock.calls[0]?.[0])
    expect(JSON.parse(line)).toMatchObject({
      duration_ms: 25,
      request_id: 'request-1',
      route: '/api/meal-analysis',
      status: 200,
    })
    expect(line).not.toContain('apiKey')
    expect(line).not.toContain('base64')
    observer.finish({ status: 500 })
    expect(logger).toHaveBeenCalledTimes(1)
  })
})
