import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useKeyboardNavigation } from '@hooks/useKeyboardNavigation'

function KeyboardNavigationHarness({ route = '/' }: { route?: string }) {
  const { isNavigationHidden, navigationResetKey } = useKeyboardNavigation()
  return (
    <nav
      aria-label="Test navigation"
      data-hidden={String(isNavigationHidden)}
      data-reset-key={navigationResetKey}
      data-route={route}
    />
  )
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
  vi.useRealTimers()
  cleanup()
  vi.restoreAllMocks()
  document.body.querySelectorAll('input').forEach((input) => input.remove())
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  })
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: originalVisualViewport,
  })
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: originalInnerHeight,
  })
})

describe('useKeyboardNavigation', () => {
  it('leaves navigation visible for viewport movement without text entry', () => {
    const viewport = installVisualViewport({ height: 800, offsetTop: 0 })
    render(<KeyboardNavigationHarness />)

    act(() => {
      viewport.height = 500
      viewport.dispatchEvent(new Event('resize'))
      viewport.offsetTop = 40
      viewport.dispatchEvent(new Event('scroll'))
    })

    expect(testNavigation()).toHaveAttribute('data-hidden', 'false')
    expect(testNavigation()).toHaveAttribute('data-reset-key', '0')
  })

  it('removes navigation while a software keyboard-sized viewport is active', () => {
    const viewport = installVisualViewport({ height: 800, offsetTop: 0 })
    const input = addInput('number')
    render(<KeyboardNavigationHarness />)

    act(() => {
      input.focus()
      viewport.height = 500
      viewport.dispatchEvent(new Event('resize'))
    })

    expect(testNavigation()).toHaveAttribute('data-hidden', 'true')
    expect(testNavigation()).toHaveAttribute('data-reset-key', '0')
  })

  it('does not hide navigation for small browser chrome changes', () => {
    const viewport = installVisualViewport({ height: 800, offsetTop: 0 })
    const input = addInput('text')
    render(<KeyboardNavigationHarness />)

    act(() => {
      input.focus()
      viewport.height = 710
      viewport.dispatchEvent(new Event('resize'))
    })

    expect(testNavigation()).toHaveAttribute('data-hidden', 'false')
  })

  it('keeps navigation removed until the blurred viewport fully recovers', () => {
    vi.useFakeTimers()
    const viewport = installVisualViewport({ height: 800, offsetTop: 0 })
    const input = addInput('number')
    render(<KeyboardNavigationHarness />)

    act(() => {
      input.focus()
      viewport.height = 500
      viewport.dispatchEvent(new Event('resize'))
      input.blur()
      vi.advanceTimersByTime(1_000)
    })
    expect(testNavigation()).toHaveAttribute('data-hidden', 'true')

    act(() => {
      viewport.height = 800
      viewport.dispatchEvent(new Event('resize'))
    })
    expect(testNavigation()).toHaveAttribute('data-hidden', 'false')
    expect(testNavigation()).toHaveAttribute('data-reset-key', '1')
  })

  it('detects recovery when iOS omits its final viewport resize event', () => {
    vi.useFakeTimers()
    const viewport = installVisualViewport({ height: 800, offsetTop: 0 })
    const input = addInput('number')
    render(<KeyboardNavigationHarness />)

    act(() => {
      input.focus()
      viewport.height = 500
      viewport.dispatchEvent(new Event('resize'))
      input.blur()
      vi.advanceTimersByTime(0)
    })
    expect(testNavigation()).toHaveAttribute('data-hidden', 'true')

    act(() => {
      viewport.height = 800
      vi.advanceTimersByTime(50)
    })
    expect(testNavigation()).toHaveAttribute('data-hidden', 'false')
    expect(testNavigation()).toHaveAttribute('data-reset-key', '1')
  })

  it('ignores premature window resize events while the viewport is contracted', () => {
    vi.useFakeTimers()
    const viewport = installVisualViewport({ height: 800, offsetTop: 0 })
    const input = addInput('number')
    render(<KeyboardNavigationHarness />)

    act(() => {
      input.focus()
      viewport.height = 500
      viewport.dispatchEvent(new Event('resize'))
      input.blur()
      vi.advanceTimersByTime(0)
      window.dispatchEvent(new Event('resize'))
    })
    expect(testNavigation()).toHaveAttribute('data-hidden', 'true')

    act(() => {
      viewport.height = 800
      window.dispatchEvent(new Event('resize'))
    })
    expect(testNavigation()).toHaveAttribute('data-hidden', 'false')
    expect(testNavigation()).toHaveAttribute('data-reset-key', '1')
  })

  it('keeps navigation isolated across a route render during keyboard close', () => {
    vi.useFakeTimers()
    const viewport = installVisualViewport({ height: 800, offsetTop: 0 })
    const input = addInput('number')
    const view = render(<KeyboardNavigationHarness route="/nutrition" />)

    act(() => {
      input.focus()
      viewport.height = 500
      viewport.dispatchEvent(new Event('resize'))
      input.blur()
      input.remove()
      view.rerender(<KeyboardNavigationHarness route="/history" />)
      vi.advanceTimersByTime(0)
    })
    expect(testNavigation()).toHaveAttribute('data-hidden', 'true')
    expect(testNavigation()).toHaveAttribute('data-route', '/history')

    act(() => {
      viewport.height = 800
      vi.advanceTimersByTime(50)
    })
    expect(testNavigation()).toHaveAttribute('data-hidden', 'false')
    expect(testNavigation()).toHaveAttribute('data-reset-key', '1')
  })

  it('stays hidden when focus moves directly between keyboard inputs', () => {
    vi.useFakeTimers()
    const viewport = installVisualViewport({ height: 800, offsetTop: 0 })
    const firstInput = addInput('number')
    const secondInput = addInput('number')
    render(<KeyboardNavigationHarness />)

    act(() => {
      firstInput.focus()
      viewport.height = 500
      viewport.dispatchEvent(new Event('resize'))
      secondInput.focus()
      vi.advanceTimersByTime(0)
    })

    expect(secondInput).toHaveFocus()
    expect(testNavigation()).toHaveAttribute('data-hidden', 'true')
    expect(testNavigation()).toHaveAttribute('data-reset-key', '0')
  })

  it('restores and remounts navigation after the resumed viewport recovers', () => {
    vi.useFakeTimers()
    const viewport = installVisualViewport({ height: 800, offsetTop: 0 })
    const input = addInput('number')
    render(<KeyboardNavigationHarness />)

    act(() => {
      input.focus()
      viewport.height = 500
      viewport.dispatchEvent(new Event('resize'))
    })
    expect(testNavigation()).toHaveAttribute('data-hidden', 'true')

    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      })
      document.dispatchEvent(new Event('visibilitychange'))
      input.blur()
    })

    expect(testNavigation()).toHaveAttribute('data-hidden', 'true')
    expect(testNavigation()).toHaveAttribute('data-reset-key', '0')

    act(() => {
      viewport.height = 800
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'visible',
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(testNavigation()).toHaveAttribute('data-hidden', 'false')
    expect(testNavigation()).toHaveAttribute('data-reset-key', '1')
  })

  it('keeps navigation isolated when a focused input is removed before focusout', () => {
    vi.useFakeTimers()
    const viewport = installVisualViewport({ height: 800, offsetTop: 0 })
    const input = addInput('number')
    render(<KeyboardNavigationHarness />)

    act(() => {
      input.focus()
      viewport.height = 500
      viewport.dispatchEvent(new Event('resize'))
      input.remove()
      viewport.dispatchEvent(new Event('resize'))
    })
    expect(testNavigation()).toHaveAttribute('data-hidden', 'true')

    act(() => {
      viewport.height = 800
      vi.advanceTimersByTime(50)
    })
    expect(testNavigation()).toHaveAttribute('data-hidden', 'false')
    expect(testNavigation()).toHaveAttribute('data-reset-key', '1')
  })
})

function testNavigation() {
  return screen.getByRole('navigation', { name: 'Test navigation' })
}

function addInput(type: string) {
  const input = document.createElement('input')
  input.type = type
  document.body.append(input)
  return input
}

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
