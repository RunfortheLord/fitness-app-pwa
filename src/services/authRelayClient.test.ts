import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearPendingAuthRelay,
  createPendingAuthRelay,
  forwardAuthRelayCallback,
  pollPendingAuthRelay,
  readAuthRelayCallback,
  readPendingAuthRelay,
  scrubAuthRelayCallbackUrl,
  shouldUseAuthRelay,
} from '@services/authRelayClient'

const relayId = '123e4567-e89b-42d3-a456-426614174000'
const retrievalSecret = 'A'.repeat(43)

beforeEach(() => {
  localStorage.clear()
})

describe('auth relay client', () => {
  it('creates and validates an expiring pending relay', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () =>
      Response.json(
        {
          data: { expiresInSeconds: 300, relayId, retrievalSecret },
          ok: true,
        },
        { status: 201 },
      ),
    )

    await expect(
      createPendingAuthRelay({ fetchImpl: fetchMock }),
    ).resolves.toMatchObject({ relayId, retrievalSecret })
    expect(readPendingAuthRelay()).toMatchObject({ relayId, retrievalSecret })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/relay',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('recognizes only standalone display mode', () => {
    expect(
      shouldUseAuthRelay({
        matchMedia: vi.fn(() => ({ matches: true })),
        navigator,
      }),
    ).toBe(true)
    expect(
      shouldUseAuthRelay({
        matchMedia: vi.fn(() => ({ matches: false })),
        navigator,
      }),
    ).toBe(false)
  })

  it('reads and scrubs a PKCE callback without retaining error details', () => {
    const callbackLocation = {
      hash: '',
      pathname: `/auth/callback/${relayId}`,
      search: '?code=one-time-code',
    } as Location
    expect(readAuthRelayCallback(callbackLocation)).toEqual({
      code: 'one-time-code',
      relayId,
      returnToNativeApp: false,
      status: 'ready',
    })

    const replaceState = vi.fn()
    scrubAuthRelayCallbackUrl({ replaceState } as unknown as History)
    expect(replaceState).toHaveBeenCalledWith(
      null,
      '',
      '/settings?auth_relay_callback=received',
    )

    const failedLocation = {
      hash: '#error=access_denied&error_description=private-email',
      pathname: `/auth/callback/${relayId}`,
      search: '',
    } as Location
    expect(readAuthRelayCallback(failedLocation)).toEqual({
      relayId,
      returnToNativeApp: false,
      status: 'failed',
    })
  })

  it('recognizes only the fixed native return marker on a callback', () => {
    const callbackLocation = {
      hash: '',
      pathname: `/auth/callback/${relayId}`,
      search: '?code=one-time-code&native=1',
    } as Location
    expect(readAuthRelayCallback(callbackLocation)).toMatchObject({
      returnToNativeApp: true,
      status: 'ready',
    })
  })

  it('forwards a code and treats an already-completed callback as success', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response(null, { status: 409 }))
    await expect(
      forwardAuthRelayCallback(
        {
          code: 'one-time-code',
          relayId,
          returnToNativeApp: false,
          status: 'ready',
        },
        fetchMock,
      ),
    ).resolves.toBeUndefined()
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body).toEqual({
      action: 'complete',
      code: 'one-time-code',
      relayId,
    })
  })

  it('atomically consumes a ready code and clears local relay state', async () => {
    localStorage.setItem(
      'vigorune:auth-relay:v1',
      JSON.stringify({
        expiresAt: Date.now() + 60_000,
        relayId,
        retrievalSecret,
      }),
    )
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () =>
      Response.json({
        data: { code: 'one-time-code', status: 'ready' },
        ok: true,
      }),
    )

    await expect(
      pollPendingAuthRelay({ fetchImpl: fetchMock }),
    ).resolves.toEqual({ code: 'one-time-code', status: 'ready' })
    expect(readPendingAuthRelay()).toBeUndefined()
  })

  it('clears malformed local relay state', () => {
    localStorage.setItem('vigorune:auth-relay:v1', '{bad')
    expect(readPendingAuthRelay()).toBeUndefined()
    clearPendingAuthRelay()
    expect(localStorage.length).toBe(0)
  })
})
