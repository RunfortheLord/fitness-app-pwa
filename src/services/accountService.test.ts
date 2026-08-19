import { beforeEach, describe, expect, it, vi } from 'vitest'

import { accountService } from '@services/accountService'

const mocks = vi.hoisted(() => ({
  clearLocalSession: vi.fn(),
  getSession: vi.fn(),
}))

vi.mock('@services/authService', () => ({
  authService: {
    clearLocalSession: mocks.clearLocalSession,
    getSession: mocks.getSession,
  },
}))

beforeEach(() => {
  vi.restoreAllMocks()
  mocks.clearLocalSession.mockReset()
  mocks.getSession.mockReset()
  mocks.getSession.mockResolvedValue({ access_token: 'session-token-value' })
  mocks.clearLocalSession.mockResolvedValue(undefined)
})

describe('accountService', () => {
  it('authorizes deletion with the current session and clears only auth locally', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        data: { providerRevocation: 'manual_apple' },
        ok: true,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(accountService.deleteAccount()).resolves.toEqual({
      providerRevocation: 'manual_apple',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/account\/delete$/),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer session-token-value',
        }),
        method: 'POST',
      }),
    )
    expect(mocks.clearLocalSession).toHaveBeenCalledOnce()
  })

  it('does not clear the local session when server deletion fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json(
            { error: { code: 'deletion_failed' }, ok: false },
            { status: 502 },
          ),
        ),
    )
    await expect(accountService.deleteAccount()).rejects.toThrow(
      'account could not be deleted',
    )
    expect(mocks.clearLocalSession).not.toHaveBeenCalled()
  })
})
