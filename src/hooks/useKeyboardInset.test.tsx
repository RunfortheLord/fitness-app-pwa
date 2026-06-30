import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { useKeyboardInset } from '@hooks/useKeyboardInset'

function KeyboardInsetHarness() {
  useKeyboardInset()
  return null
}

class MockVisualViewport extends EventTarget {
  height: number
  offsetTop: number

  constructor({ height, offsetTop }: { height: number; offsetTop: number }) {
    super()
    this.height = height
    this.offsetTop = offsetTop
  }
}

const originalVisualViewport = window.visualViewport
const originalInnerHeight = window.innerHeight

afterEach(() => {
  cleanup()
  document.documentElement.style.removeProperty('--keyboard-inset')
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: originalVisualViewport,
  })
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: originalInnerHeight,
  })
})

describe('useKeyboardInset', () => {
  it('ignores visual viewport scroll when no text input is focused', () => {
    const viewport = installVisualViewport({ height: 620, offsetTop: 0 })

    render(<KeyboardInsetHarness />)

    act(() => {
      viewport.height = 540
      viewport.offsetTop = 20
      viewport.dispatchEvent(new Event('scroll'))
      viewport.dispatchEvent(new Event('resize'))
    })

    expect(
      document.documentElement.style.getPropertyValue('--keyboard-inset'),
    ).toBe('0px')
  })

  it('sets the inset while a text input is focused', () => {
    const viewport = installVisualViewport({ height: 620, offsetTop: 0 })
    const input = document.createElement('input')
    input.type = 'number'
    document.body.append(input)

    render(<KeyboardInsetHarness />)

    act(() => {
      input.focus()
      viewport.height = 500
      viewport.offsetTop = 0
      viewport.dispatchEvent(new Event('resize'))
    })

    expect(
      document.documentElement.style.getPropertyValue('--keyboard-inset'),
    ).toBe('300px')
  })

  it('clears the inset when text input focus leaves', () => {
    const viewport = installVisualViewport({ height: 500, offsetTop: 0 })
    const input = document.createElement('input')
    document.body.append(input)

    render(<KeyboardInsetHarness />)

    act(() => {
      input.focus()
      viewport.dispatchEvent(new Event('resize'))
    })
    expect(
      document.documentElement.style.getPropertyValue('--keyboard-inset'),
    ).toBe('300px')

    act(() => {
      input.blur()
    })

    expect(
      document.documentElement.style.getPropertyValue('--keyboard-inset'),
    ).toBe('0px')
  })
})

function installVisualViewport({
  height,
  offsetTop,
}: {
  height: number
  offsetTop: number
}) {
  const viewport = new MockVisualViewport({ height, offsetTop })
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: 800,
  })
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: viewport,
  })
  return viewport
}
