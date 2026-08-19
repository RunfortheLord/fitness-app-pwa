/// <reference types="node" />
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('/api/account/delete', () => {
  it('permits the fixed Capacitor origin to preflight account deletion', async () => {
    const { default: handler } = await import('../../api/account/delete')
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

  it('rejects a foreign browser origin before reading authentication', async () => {
    const { default: handler } = await import('../../api/account/delete')
    const response = createResponse()
    await handler(
      {
        headers: {
          host: 'app.example.com',
          origin: 'https://attacker.example',
        },
        method: 'POST',
      },
      response,
    )
    expect(response.statusCode).toBe(403)
    expect(response.body).toEqual({
      error: { code: 'forbidden' },
      ok: false,
    })
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
    end() {
      response.body = undefined
    },
  }
  return response
}
