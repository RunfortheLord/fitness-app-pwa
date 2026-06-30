import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AiMealCameraSubpage } from '@pages/AiMealCameraSubpage'
import {
  analyzeMealPhoto,
  GeminiMealAnalysisError,
} from '@services/geminiMealAnalysisClient'

vi.mock('@services/geminiMealAnalysisClient', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@services/geminiMealAnalysisClient')>()
  return {
    ...actual,
    analyzeMealPhoto: vi.fn(),
  }
})

const mockAnalyzeMealPhoto = vi.mocked(analyzeMealPhoto)
let originalMediaDevices: MediaDevices
let play: ReturnType<typeof vi.spyOn>
let videoWidth: ReturnType<typeof vi.spyOn>
let videoHeight: ReturnType<typeof vi.spyOn>
let getContext: ReturnType<typeof vi.spyOn>
let toDataUrl: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  mockAnalyzeMealPhoto.mockReset()
  originalMediaDevices = navigator.mediaDevices
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      }),
    },
  })
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  videoWidth = vi
    .spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get')
    .mockReturnValue(1200)
  videoHeight = vi
    .spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get')
    .mockReturnValue(900)
  getContext = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D)
  toDataUrl = vi
    .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
    .mockReturnValue('data:image/jpeg;base64,photo-bytes')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  play.mockRestore()
  videoWidth.mockRestore()
  videoHeight.mockRestore()
  getContext.mockRestore()
  toDataUrl.mockRestore()
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: originalMediaDevices,
  })
})

describe('AiMealCameraSubpage', () => {
  it('imports and analyzes a photo from the device library', async () => {
    const user = userEvent.setup()
    const closeBitmap = vi.fn()
    const onAnalyzed = vi.fn()
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({
        width: 1800,
        height: 1200,
        close: closeBitmap,
      }),
    )
    mockAnalyzeMealPhoto.mockResolvedValue({
      recipeName: 'Imported meal',
      confidence: 'medium',
      assumptions: [],
      ingredients: [
        {
          name: 'Rice',
          servingQuantity: 1,
          servingUnit: 'cup',
          calories: 205,
          proteinGrams: 4,
          carbohydrateGrams: 45,
          fatGrams: 0.4,
        },
      ],
    })

    render(
      <AiMealCameraSubpage
        apiKey="test-key"
        onAnalyzed={onAnalyzed}
        onBack={vi.fn()}
      />,
    )

    const input = await screen.findByLabelText('Choose meal photo from library')
    await user.upload(
      input,
      new File(['photo'], 'meal.png', { type: 'image/png' }),
    )

    await waitFor(() =>
      expect(mockAnalyzeMealPhoto).toHaveBeenCalledWith({
        apiKey: 'test-key',
        image: {
          base64: 'photo-bytes',
          dataUrl: 'data:image/jpeg;base64,photo-bytes',
          mimeType: 'image/jpeg',
        },
      }),
    )
    await waitFor(() => expect(onAnalyzed).toHaveBeenCalledTimes(1))
    expect(closeBitmap).toHaveBeenCalledTimes(1)
  })

  it('shows the robot calculation state while analysis is running', async () => {
    const user = userEvent.setup()
    mockAnalyzeMealPhoto.mockImplementation(() => new Promise(() => undefined))

    render(
      <AiMealCameraSubpage
        apiKey="test-key"
        onAnalyzed={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    await user.click(
      await screen.findByRole('button', { name: 'Take meal photo' }),
    )

    expect(
      await screen.findByRole('status', { name: 'Analyzing meal' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Crunching the numbers…')).toBeInTheDocument()
    expect(
      screen.getByText('Building your ingredient estimate'),
    ).toBeInTheDocument()
  })

  it('shows AI failed and returns after about three seconds', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    mockAnalyzeMealPhoto.mockRejectedValue(
      new GeminiMealAnalysisError('no_food_detected', 'AI failed'),
    )

    render(
      <AiMealCameraSubpage
        apiKey="test-key"
        onAnalyzed={vi.fn()}
        onBack={onBack}
      />,
    )

    await user.click(
      await screen.findByRole('button', { name: 'Take meal photo' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('AI failed')
    expect(onBack).not.toHaveBeenCalled()
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1), {
      timeout: 3_500,
    })
  })
})
