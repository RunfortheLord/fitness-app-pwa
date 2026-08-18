import { describe, expect, it, vi } from 'vitest'

import {
  createRedisAuthRelayStore,
  readRedisAuthRelayConfig,
} from './authRelay'

describe('Redis auth relay', () => {
  it('reads only a complete Redis REST configuration', () => {
    expect(
      readRedisAuthRelayConfig({
        KV_REST_API_TOKEN: 'token',
        KV_REST_API_URL: 'https://redis.test/',
      }),
    ).toEqual({ restToken: 'token', restUrl: 'https://redis.test' })
    expect(
      readRedisAuthRelayConfig({ KV_REST_API_URL: 'https://redis.test' }),
    ).toBeUndefined()
  })

  it('stores only a digest of the retrieval secret', async () => {
    const commands: unknown[][] = []
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async (_input: string | URL | Request, init?: RequestInit) => {
          commands.push(JSON.parse(String(init?.body)) as unknown[])
          return new Response(JSON.stringify({ result: 1 }), { status: 200 })
        },
      )
    const store = createRedisAuthRelayStore({
      fetchImpl: fetchMock,
      restToken: 'test-token',
      restUrl: 'https://redis.test',
    })

    const ticket = await store.create()

    expect(ticket?.retrievalSecret).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(commands).toHaveLength(1)
    const serializedCommand = JSON.stringify(commands[0])
    expect(serializedCommand).not.toContain(ticket?.retrievalSecret)
    expect(serializedCommand).toContain('vigorune:auth-relay:')
    expect(commands[0]?.[0]).toBe('EVAL')
  })

  it('uses atomic scripts for one completion and one consumption', async () => {
    const redisResults: unknown[] = [
      'stored',
      'used',
      ['ready', 'auth-code'],
      ['missing'],
    ]
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(JSON.stringify({ result: redisResults.shift() }), {
          status: 200,
        }),
    )
    const store = createRedisAuthRelayStore({
      fetchImpl: fetchMock,
      restToken: 'test-token',
      restUrl: 'https://redis.test',
    })
    const relayId = '123e4567-e89b-42d3-a456-426614174000'
    const secret = 'A'.repeat(43)

    await expect(
      store.complete(relayId, { code: 'auth-code', status: 'ready' }),
    ).resolves.toBe('stored')
    await expect(
      store.complete(relayId, { code: 'other-code', status: 'ready' }),
    ).resolves.toBe('used')
    await expect(store.consume(relayId, secret)).resolves.toEqual({
      code: 'auth-code',
      status: 'ready',
    })
    await expect(store.consume(relayId, secret)).resolves.toEqual({
      status: 'missing',
    })

    const commands = fetchMock.mock.calls.map(
      (call) => JSON.parse(String(call[1]?.body)) as unknown[],
    )
    expect(commands.every((command) => command[0] === 'EVAL')).toBe(true)
  })

  it('fails closed on Redis errors and invalid inputs', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => {
      throw new Error('offline')
    })
    const store = createRedisAuthRelayStore({
      fetchImpl: fetchMock,
      restToken: 'test-token',
      restUrl: 'https://redis.test',
    })

    await expect(store.create()).resolves.toBeUndefined()
    await expect(
      store.complete('not-an-id', { code: 'auth-code', status: 'ready' }),
    ).resolves.toBe('missing')
    await expect(store.consume('not-an-id', 'bad-secret')).resolves.toEqual({
      status: 'missing',
    })
  })
})
