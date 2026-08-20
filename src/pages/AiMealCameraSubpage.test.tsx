import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AiMealCameraSubpage } from '@pages/AiMealCameraSubpage'
import {
  analyzeMealPhoto,
  MealAnalysisError,
} from '@services/mealAnalysisClient'

vi.mock('@services/mealAnalysisClient', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@services/mealAnalysisClient')>()
  return {
    ...actual,
    analyzeMealPhoto: vi.fn(),
  }
})

const mockAnalyzeMealPhoto = vi.mocked(analyzeMealPhoto)
const openAiConsentLabel =
  'I agree to send these photos and any note to OpenAI for this analysis.'
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

    render(<AiMealCameraSubpage onAnalyzed={onAnalyzed} onBack={vi.fn()} />)

    const input = await screen.findByLabelText('Choose meal photo from library')
    await user.upload(
      input,
      new File(['photo'], 'meal.png', { type: 'image/png' }),
    )

    const analyzeButton = await screen.findByRole('button', {
      name: 'Analyze meal',
    })
    expect(
      screen.getByText(
        /sends the selected meal photos and optional note.*to OpenAI/i,
      ),
    ).toBeVisible()
    expect(
      screen.getByText(
        /abuse-monitoring data may be retained for up to 30 days/i,
      ),
    ).toBeVisible()
    expect(analyzeButton).toBeDisabled()
    await user.click(analyzeButton)
    expect(mockAnalyzeMealPhoto).not.toHaveBeenCalled()

    await user.click(screen.getByRole('checkbox', { name: openAiConsentLabel }))
    expect(analyzeButton).toBeEnabled()
    await user.click(analyzeButton)

    await waitFor(() =>
      expect(mockAnalyzeMealPhoto).toHaveBeenCalledWith({
        images: [
          {
            base64: 'photo-bytes',
            dataUrl: 'data:image/jpeg;base64,photo-bytes',
            mimeType: 'image/jpeg',
          },
        ],
        note: undefined,
      }),
    )
    await waitFor(() => expect(onAnalyzed).toHaveBeenCalledTimes(1))
    expect(closeBitmap).toHaveBeenCalledTimes(1)
  })

  it('analyzes multiple angles together with the optional details note', async () => {
    const user = userEvent.setup()
    const onAnalyzed = vi.fn()
    mockAnalyzeMealPhoto.mockResolvedValue({
      recipeName: 'Steak plate',
      confidence: 'high',
      assumptions: [],
      ingredients: [
        {
          name: 'Ribeye',
          servingQuantity: 8,
          servingUnit: 'oz',
          calories: 616,
          proteinGrams: 54,
          carbohydrateGrams: 0,
          fatGrams: 43,
        },
      ],
    })

    render(<AiMealCameraSubpage onAnalyzed={onAnalyzed} onBack={vi.fn()} />)

    await user.click(
      await screen.findByRole('button', { name: 'Take meal photo' }),
    )
    await user.click(
      await screen.findByRole('button', { name: 'Add another angle' }),
    )
    await user.click(
      await screen.findByRole('button', { name: 'Take meal photo' }),
    )
    expect(
      screen.getByRole('list', { name: 'Captured meal photos' }).children,
    ).toHaveLength(2)

    await user.type(
      screen.getByLabelText('Details for the AI (optional)'),
      '8 oz ribeye cooked in butter',
    )
    await user.click(screen.getByRole('checkbox', { name: openAiConsentLabel }))
    await user.click(screen.getByRole('button', { name: 'Analyze meal' }))

    await waitFor(() =>
      expect(mockAnalyzeMealPhoto).toHaveBeenCalledWith({
        images: [
          expect.objectContaining({ base64: 'photo-bytes' }),
          expect.objectContaining({ base64: 'photo-bytes' }),
        ],
        note: '8 oz ribeye cooked in butter',
      }),
    )
    await waitFor(() => expect(onAnalyzed).toHaveBeenCalledTimes(1))
  })

  it('shows the robot calculation state while analysis is running', async () => {
    const user = userEvent.setup()
    mockAnalyzeMealPhoto.mockImplementation(() => new Promise(() => undefined))

    render(<AiMealCameraSubpage onAnalyzed={vi.fn()} onBack={vi.fn()} />)

    await user.click(
      await screen.findByRole('button', { name: 'Take meal photo' }),
    )
    await user.click(screen.getByRole('checkbox', { name: openAiConsentLabel }))
    await user.click(
      await screen.findByRole('button', { name: 'Analyze meal' }),
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
      new MealAnalysisError('no_food_detected', 'AI failed'),
    )

    render(<AiMealCameraSubpage onAnalyzed={vi.fn()} onBack={onBack} />)

    await user.click(
      await screen.findByRole('button', { name: 'Take meal photo' }),
    )
    await user.click(screen.getByRole('checkbox', { name: openAiConsentLabel }))
    await user.click(
      await screen.findByRole('button', { name: 'Analyze meal' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('AI failed')
    expect(onBack).not.toHaveBeenCalled()
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1), {
      timeout: 3_500,
    })
  })

  it('requires fresh consent after the note changes', async () => {
    const user = userEvent.setup()

    render(<AiMealCameraSubpage onAnalyzed={vi.fn()} onBack={vi.fn()} />)

    await user.click(
      await screen.findByRole('button', { name: 'Take meal photo' }),
    )
    const consent = screen.getByRole('checkbox', {
      name: openAiConsentLabel,
    })
    const analyzeButton = screen.getByRole('button', { name: 'Analyze meal' })

    await user.click(consent)
    expect(consent).toBeChecked()
    expect(analyzeButton).toBeEnabled()

    await user.type(
      screen.getByLabelText('Details for the AI (optional)'),
      'Cooked in butter',
    )

    expect(consent).not.toBeChecked()
    expect(analyzeButton).toBeDisabled()
    expect(mockAnalyzeMealPhoto).not.toHaveBeenCalled()
  })
})
