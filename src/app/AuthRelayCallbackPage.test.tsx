import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthRelayCallbackPage } from '@app/AuthRelayCallbackPage'

const relayMocks = vi.hoisted(() => ({
  forwardAuthRelayCallback: vi.fn(),
  scrubAuthRelayCallbackUrl: vi.fn(),
  shouldUseAuthRelay: vi.fn(),
}))

vi.mock('@services/authRelayClient', () => ({
  forwardAuthRelayCallback: relayMocks.forwardAuthRelayCallback,
  scrubAuthRelayCallbackUrl: relayMocks.scrubAuthRelayCallbackUrl,
  shouldUseAuthRelay: relayMocks.shouldUseAuthRelay,
}))

beforeEach(() => {
  relayMocks.forwardAuthRelayCallback.mockReset()
  relayMocks.scrubAuthRelayCallbackUrl.mockReset()
  relayMocks.shouldUseAuthRelay.mockReset()
  relayMocks.shouldUseAuthRelay.mockReturnValue(false)
})

describe('AuthRelayCallbackPage', () => {
  it('scrubs the authorization code and directs the user back to the PWA', async () => {
    relayMocks.forwardAuthRelayCallback.mockResolvedValue(undefined)

    render(
      <AuthRelayCallbackPage
        callback={{
          code: 'one-time-code',
          relayId: '123e4567-e89b-42d3-a456-426614174000',
          returnToNativeApp: false,
          status: 'ready',
        }}
      />,
    )

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Sign-in approved' }),
      ).toBeVisible(),
    )
    expect(relayMocks.scrubAuthRelayCallbackUrl).toHaveBeenCalledWith(
      window.history,
    )
    expect(
      screen.getByText(/return to the installed Vigorune app/i),
    ).toBeVisible()
  })

  it('returns an installed PWA callback to Settings with a visible fallback', async () => {
    const returnToApp = vi.fn()
    relayMocks.forwardAuthRelayCallback.mockResolvedValue(undefined)
    relayMocks.shouldUseAuthRelay.mockReturnValue(true)

    render(
      <AuthRelayCallbackPage
        callback={{
          code: 'one-time-code',
          relayId: '123e4567-e89b-42d3-a456-426614174000',
          returnToNativeApp: false,
          status: 'ready',
        }}
        returnToApp={returnToApp}
      />,
    )

    expect(
      await screen.findByText(/returning to Vigorune Settings/i),
    ).toBeVisible()
    const continueButton = screen.getByRole('button', {
      name: 'Continue to Vigorune',
    })
    expect(continueButton).toBeVisible()
    await waitFor(() => expect(returnToApp).toHaveBeenCalled(), {
      timeout: 1_000,
    })

    returnToApp.mockClear()
    fireEvent.click(continueButton)
    expect(returnToApp).toHaveBeenCalledOnce()
  })

  it('returns a native callback through the registered deep link', async () => {
    const nativeReturnToApp = vi.fn()
    relayMocks.forwardAuthRelayCallback.mockResolvedValue(undefined)

    render(
      <AuthRelayCallbackPage
        callback={{
          code: 'one-time-code',
          relayId: '123e4567-e89b-42d3-a456-426614174000',
          returnToNativeApp: true,
          status: 'ready',
        }}
        nativeReturnToApp={nativeReturnToApp}
      />,
    )

    expect(
      await screen.findByText(/returning to Vigorune Settings/i),
    ).toBeVisible()
    await waitFor(() => expect(nativeReturnToApp).toHaveBeenCalled(), {
      timeout: 1_000,
    })
  })

  it('shows a bounded failure without provider error details', async () => {
    relayMocks.forwardAuthRelayCallback.mockRejectedValue(new Error('private'))

    render(
      <AuthRelayCallbackPage
        callback={{
          relayId: '123e4567-e89b-42d3-a456-426614174000',
          returnToNativeApp: false,
          status: 'failed',
        }}
      />,
    )

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Sign-in was not completed' }),
      ).toBeVisible(),
    )
    expect(screen.queryByText('private')).not.toBeInTheDocument()
  })
})
