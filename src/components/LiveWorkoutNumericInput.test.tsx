import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LanguageProvider } from '@components/LanguageContext'
import {
  LiveWorkoutNumericInput,
  LiveWorkoutNumericKeypadProvider,
} from '@components/LiveWorkoutNumericInput'
import { applyNumericKeypadCommand } from '@domain/liveWorkoutKeypad'

const originalUserAgent = Object.getOwnPropertyDescriptor(
  window.navigator,
  'userAgent',
)
const originalStandalone = Object.getOwnPropertyDescriptor(
  window.navigator,
  'standalone',
)

function setInstalledIphone(enabled: boolean) {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: enabled
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)'
      : '',
  })
  Object.defineProperty(window.navigator, 'standalone', {
    configurable: true,
    value: enabled,
  })
}

function restoreNavigatorProperty(
  name: 'standalone' | 'userAgent',
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor) {
    Object.defineProperty(window.navigator, name, descriptor)
  } else {
    Reflect.deleteProperty(window.navigator, name)
  }
}

afterEach(() => {
  restoreNavigatorProperty('userAgent', originalUserAgent)
  restoreNavigatorProperty('standalone', originalStandalone)
})

function NumericHarness({
  mode = 'decimal',
  onCommit = () => undefined,
}: {
  mode?: 'decimal' | 'duration' | 'integer'
  onCommit?: () => void
}) {
  const [value, setValue] = useState('290')
  return (
    <LanguageProvider>
      <LiveWorkoutNumericKeypadProvider>
        <LiveWorkoutNumericInput
          aria-label="Set 1 Weight"
          mode={mode}
          onCommit={onCommit}
          onValueChange={setValue}
          value={value}
        />
      </LiveWorkoutNumericKeypadProvider>
    </LanguageProvider>
  )
}

describe('LiveWorkoutNumericInput', () => {
  it('uses a read-only app keypad on an installed iPhone without invoking a native input', async () => {
    setInstalledIphone(true)
    const onCommit = vi.fn()
    render(<NumericHarness onCommit={onCommit} />)

    const input = screen.getByRole('textbox', { name: 'Set 1 Weight' })
    expect(input).toHaveAttribute('readonly')
    expect(input).toHaveAttribute('inputmode', 'none')

    fireEvent.pointerDown(input, { button: 0 })
    fireEvent.pointerUp(input, { button: 0 })
    expect(
      screen.getByRole('dialog', { name: 'Set 1 Weight number pad' }),
    ).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: '3' }))
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    expect(input).toHaveValue('31')

    fireEvent.click(screen.getByRole('button', { name: 'Backspace' }))
    fireEvent.click(screen.getByRole('button', { name: '.' }))
    fireEvent.click(screen.getByRole('button', { name: '5' }))
    expect(input).toHaveValue('3.5')

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(input).toHaveFocus())
  })

  it('keeps ordinary browser inputs directly editable', () => {
    setInstalledIphone(false)
    render(<NumericHarness />)

    const input = screen.getByRole('textbox', { name: 'Set 1 Weight' })
    expect(input).not.toHaveAttribute('readonly')
    expect(input).toHaveAttribute('inputmode', 'decimal')
    fireEvent.change(input, { target: { value: '315' } })
    expect(input).toHaveValue('315')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows only integer keys for integer fields', () => {
    setInstalledIphone(true)
    render(<NumericHarness mode="integer" />)

    fireEvent.click(screen.getByRole('textbox', { name: 'Set 1 Weight' }))
    expect(screen.queryByRole('button', { name: '.' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Colon' }),
    ).not.toBeInTheDocument()
  })
})

describe('applyNumericKeypadCommand', () => {
  it('replaces the selected value on first entry and preserves rapid edits', () => {
    const replaced = applyNumericKeypadCommand('290', 'decimal', '3', true)
    expect(replaced).toEqual({ replaceOnNextEntry: false, value: '3' })
    expect(
      applyNumericKeypadCommand(
        replaced.value,
        'decimal',
        '1',
        replaced.replaceOnNextEntry,
      ),
    ).toEqual({ replaceOnNextEntry: false, value: '31' })
  })

  it('supports duration colons and rejects mode-incompatible separators', () => {
    expect(applyNumericKeypadCommand('', 'duration', ':', false).value).toBe(
      '0:',
    )
    expect(applyNumericKeypadCommand('12', 'integer', '.', false).value).toBe(
      '12',
    )
    expect(
      applyNumericKeypadCommand('1:30', 'duration', ':', false).value,
    ).toBe('1:30')
  })

  it('clears and backspaces without retaining replacement mode', () => {
    expect(
      applyNumericKeypadCommand('290', 'decimal', 'backspace', true),
    ).toEqual({ replaceOnNextEntry: false, value: '29' })
    expect(applyNumericKeypadCommand('290', 'decimal', 'clear', true)).toEqual({
      replaceOnNextEntry: false,
      value: '',
    })
  })
})
