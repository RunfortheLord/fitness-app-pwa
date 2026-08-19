import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { StepperInput } from '@components/ui'

function renderStepper(
  value: string,
  onValueChange: (value: string) => void,
  overrides: Partial<{ max: number; min: number; step: number }> = {},
) {
  return render(
    <StepperInput
      decrementLabel="One fewer"
      id="stepper"
      incrementLabel="One more"
      onValueChange={onValueChange}
      value={value}
      {...overrides}
    />,
  )
}

describe('StepperInput', () => {
  it('increments and decrements by the step', () => {
    const onValueChange = vi.fn()
    renderStepper('3', onValueChange)
    fireEvent.click(screen.getByRole('button', { name: 'One more' }))
    expect(onValueChange).toHaveBeenLastCalledWith('4')
    fireEvent.click(screen.getByRole('button', { name: 'One fewer' }))
    expect(onValueChange).toHaveBeenLastCalledWith('2')
  })

  it('clamps at min and max', () => {
    const onValueChange = vi.fn()
    renderStepper('1', onValueChange, { max: 2, min: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'One fewer' }))
    expect(onValueChange).toHaveBeenLastCalledWith('1')
    const { unmount } = renderStepper('2', onValueChange, { max: 2, min: 1 })
    fireEvent.click(screen.getAllByRole('button', { name: 'One more' })[1])
    expect(onValueChange).toHaveBeenLastCalledWith('2')
    unmount()
  })

  it('starts from the minimum when the field is empty', () => {
    const onValueChange = vi.fn()
    renderStepper('', onValueChange, { min: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'One more' }))
    expect(onValueChange).toHaveBeenLastCalledWith('1')
  })

  it('handles fractional steps without float noise', () => {
    const onValueChange = vi.fn()
    renderStepper('7.5', onValueChange, { step: 2.5 })
    fireEvent.click(screen.getByRole('button', { name: 'One more' }))
    expect(onValueChange).toHaveBeenLastCalledWith('10')
    fireEvent.click(screen.getByRole('button', { name: 'One fewer' }))
    expect(onValueChange).toHaveBeenLastCalledWith('5')
  })

  it('passes typed input through unchanged', () => {
    const onValueChange = vi.fn()
    renderStepper('3', onValueChange)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '12' } })
    expect(onValueChange).toHaveBeenLastCalledWith('12')
  })
})
