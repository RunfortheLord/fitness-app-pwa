/// <reference types="node" />
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('/api/meal-analysis', () => {
  it('returns Retry-After on the seventh shared request without calling OpenAI', async () => {
    vi.stubEnv(
      'AI_RATE_LIMIT_HASH_SECRET',
      'test-only-hash-secret-32-characters',
    )
    vi.stubEnv('OPENAI_API_KEY', 'test-only-openai-key')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-only-redis-token')
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.test')
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      expect(input).toBe('https://redis.test')
      return new Response(JSON.stringify({ result: [7, 600_000] }), {
        status: 200,
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { default: handler } = await import('../../api/meal-analysis')
    const response = createResponse()

    await handler(
      {
        body: {
          images: [{ base64: 'cGhvdG8=', mimeType: 'image/jpeg' }],
        },
        headers: {
          'user-agent': 'private-agent',
          'x-forwarded-for': '203.0.113.8',
        },
        method: 'POST',
      },
      response,
    )

    expect(response.statusCode).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('600')
    expect(response.body).toMatchObject({
      ok: false,
      error: { code: 'rate_limited', retryAfterSeconds: 600 },
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://redis.test')
  })
})

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
  }
  return response
}
