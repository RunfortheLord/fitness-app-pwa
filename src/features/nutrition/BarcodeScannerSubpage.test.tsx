import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BarcodeScannerSubpage } from './BarcodeScannerSubpage'

const zxingMocks = vi.hoisted(() => ({
  decodeFromVideoDevice: vi.fn(),
  stop: vi.fn(),
}))

vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: class {
    decodeFromVideoDevice(...args: unknown[]) {
      return zxingMocks.decodeFromVideoDevice(...args)
    }
  },
}))

describe('BarcodeScannerSubpage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    zxingMocks.stop.mockReset()
    zxingMocks.decodeFromVideoDevice.mockReset()
    zxingMocks.decodeFromVideoDevice.mockResolvedValue({
      stop: zxingMocks.stop,
    })
  })

  it('asks once before starting the camera and remembers a successful grant', async () => {
    const user = userEvent.setup()
    renderScanner()

    expect(
      screen.getByRole('button', { name: 'Enable camera' }),
    ).toBeInTheDocument()
    expect(zxingMocks.decodeFromVideoDevice).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Enable camera' }))

    await waitFor(() => {
      expect(zxingMocks.decodeFromVideoDevice).toHaveBeenCalledOnce()
      expect(
        window.localStorage.getItem('fitness-log.camera-permission-granted'),
      ).toBe('true')
    })
  })

  it('starts automatically after camera access succeeded before', async () => {
    window.localStorage.setItem('fitness-log.camera-permission-granted', 'true')

    renderScanner()

    expect(await screen.findByText('Scanning…')).toBeInTheDocument()
    await waitFor(() =>
      expect(zxingMocks.decodeFromVideoDevice).toHaveBeenCalledOnce(),
    )
    expect(
      screen.queryByRole('button', { name: 'Enable camera' }),
    ).not.toBeInTheDocument()
  })

  it('stops scanning when returning to nutrition', async () => {
    window.localStorage.setItem('fitness-log.camera-permission-granted', 'true')
    const user = userEvent.setup()
    const onBack = vi.fn()

    renderScanner(onBack)
    expect(
      await screen.findByRole('button', { name: 'Stop scanning' }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(zxingMocks.decodeFromVideoDevice).toHaveBeenCalledOnce(),
    )

    await user.click(screen.getByRole('button', { name: 'Back to nutrition' }))

    expect(onBack).toHaveBeenCalledOnce()
    await waitFor(() => expect(zxingMocks.stop).toHaveBeenCalledOnce())
  })
})

function renderScanner(onBack = vi.fn()) {
  return render(
    <BarcodeScannerSubpage
      apiKey={null}
      onBack={onBack}
      onCreateCustom={vi.fn()}
      onFound={vi.fn()}
    />,
  )
}
