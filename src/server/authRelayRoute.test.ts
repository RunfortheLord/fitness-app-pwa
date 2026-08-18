/// <reference types="node" />
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('/api/auth/relay', () => {
  it('permits the fixed Capacitor origin to preflight the native relay', async () => {
    const { default: handler } = await import('../../api/auth/relay')
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

  it('creates a rate-limited relay without returning stored digests', async () => {
    stubRedisEnvironment()
    const commands: unknown[][] = []
    const redisResults: unknown[] = [[1, 600_000], 1]
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
        commands.push(JSON.parse(String(init?.body)) as unknown[])
        return Response.json({ result: redisResults.shift() })
      }),
    )
    const { default: handler } = await import('../../api/auth/relay')
    const response = createResponse()

    await handler(
      {
        body: { action: 'create' },
        headers: { 'x-forwarded-for': '203.0.113.7' },
        method: 'POST',
      },
      response,
    )

    expect(response.statusCode).toBe(201)
    expect(response.body).toMatchObject({
      data: {
        expiresInSeconds: 300,
        relayId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
        retrievalSecret: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      },
      ok: true,
    })
    expect(commands).toHaveLength(2)
    expect(commands.every((command) => command[0] === 'EVAL')).toBe(true)
    expect(JSON.stringify(commands)).not.toContain('203.0.113.7')
    const retrievalSecret = (
      response.body as { data: { retrievalSecret: string } }
    ).data.retrievalSecret
    expect(JSON.stringify(commands[1])).not.toContain(retrievalSecret)
  })

  it('fails closed before creating a relay when distributed limiting fails', async () => {
    stubRedisEnvironment()
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response(null, { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)
    const { default: handler } = await import('../../api/auth/relay')
    const response = createResponse()

    await handler(
      {
        body: { action: 'create' },
        headers: { 'x-forwarded-for': '203.0.113.7' },
        method: 'POST',
      },
      response,
    )

    expect(response.statusCode).toBe(503)
    expect(response.body).toEqual({
      error: { code: 'service_unavailable' },
      ok: false,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('accepts a bounded callback without logging or returning its code', async () => {
    stubRedisEnvironment()
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json({ result: 'stored' }))
    vi.stubGlobal('fetch', fetchMock)
    const { default: handler } = await import('../../api/auth/relay')
    const response = createResponse()

    await handler(
      {
        body: {
          action: 'complete',
          code: 'one-time-code',
          relayId: '123e4567-e89b-42d3-a456-426614174000',
        },
        headers: {},
        method: 'POST',
      },
      response,
    )

    expect(response.statusCode).toBe(202)
    expect(response.body).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

function stubRedisEnvironment() {
  vi.stubEnv('AI_RATE_LIMIT_HASH_SECRET', 'test-only-hash-secret-32-characters')
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-only-token')
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.test')
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
