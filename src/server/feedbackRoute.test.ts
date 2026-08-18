/// <reference types="node" />
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('/api/feedback', () => {
  it('permits the fixed Capacitor origin to preflight feedback', async () => {
    const { default: handler } = await import('../../api/feedback')
    const response = createResponse()

    await handler(
      {
        headers: {
          host: 'app.example.com',
          origin: 'capacitor://localhost',
        },
        method: 'OPTIONS',
      },
      response,
    )

    expect(response.statusCode).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'capacitor://localhost',
    )
  })

  it('rejects a foreign origin before relaying feedback', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
    const { default: handler } = await import('../../api/feedback')
    const response = createResponse()

    await handler(
      {
        body: { message: 'hello' },
        headers: {
          host: 'app.example.com',
          origin: 'https://attacker.example',
        },
        method: 'POST',
      },
      response,
    )

    expect(response.statusCode).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails closed when the distributed limiter is unavailable', async () => {
    stubFeedbackEnvironment()
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)
    const { default: handler } = await import('../../api/feedback')
    const response = createResponse()

    await handler(
      {
        body: { message: 'hello' },
        headers: { host: 'app.example.com' },
        method: 'POST',
      },
      response,
    )

    expect(response.statusCode).toBe(503)
    expect(response.body).toMatchObject({
      error: { code: 'service_unavailable' },
      ok: false,
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})

function stubFeedbackEnvironment() {
  vi.stubEnv('AI_RATE_LIMIT_HASH_SECRET', 'h'.repeat(32))
  vi.stubEnv('FEEDBACK_WEBHOOK_URL', 'https://hook.example.test/value')
  vi.stubEnv('KV_REST_API_TOKEN', 'redis-token')
  vi.stubEnv('KV_REST_API_URL', 'https://redis.example.test')
}

function createResponse() {
  const response = {
    body: undefined as unknown,
    headers: new Map<string, string>(),
    statusCode: 0,
    status(code: number) {
      response.statusCode = code
      return response
    },
    setHeader(name: string, value: string) {
      response.headers.set(name, value)
    },
    json(value: unknown) {
      response.body = value
    },
    end() {
      response.body = undefined
    },
  }
  return response
}
