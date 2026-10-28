import { describe, expect, it } from 'vitest'

import handler from '../../api/push/config'

describe('combined health and push config route', () => {
  it('serves the public health response through the rewrite target', () => {
    const response = createResponse()
    handler({ method: 'GET', query: { route: 'health' } }, response)

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({
      configured: expect.objectContaining({ authRelay: expect.any(Boolean) }),
      ok: true,
      ready: expect.any(Boolean),
    })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('keeps push configuration separate from the health response', () => {
    const response = createResponse()
    handler({ method: 'GET' }, response)

    expect(response.statusCode).toBe(200)
    expect(response.body).toHaveProperty('publicKey')
    expect(response.body).not.toHaveProperty('ready')
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
