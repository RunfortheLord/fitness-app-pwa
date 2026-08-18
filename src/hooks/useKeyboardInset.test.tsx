import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useKeyboardInset } from '@hooks/useKeyboardInset'

function KeyboardInsetHarness({ resetKey }: { resetKey?: string }) {
  useKeyboardInset()
  return <span data-route={resetKey} />
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
  document.body.classList.remove('live-workout-open')
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
  document.documentElement.style.removeProperty('--keyboard-inset')
  document.documentElement.style.removeProperty('--bottom-nav-transform')
  document.documentElement.style.removeProperty(
    '--live-workout-viewport-offset',
  )
  document.body.querySelectorAll('input').forEach((input) => input.remove())
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
    expect(
      document.documentElement.style.getPropertyValue('--bottom-nav-transform'),
    ).toBe('none')
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
    expect(
      document.documentElement.style.getPropertyValue('--bottom-nav-transform'),
    ).toBe('translate3d(0, 300px, 0)')
  })

  it('keeps the nav pinned until the keyboard viewport finishes closing', async () => {
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

    await waitFor(() =>
      expect(
        document.documentElement.style.getPropertyValue('--keyboard-inset'),
      ).toBe('300px'),
    )

    act(() => {
      viewport.height = 720
      viewport.dispatchEvent(new Event('resize'))
    })

    expect(
      document.documentElement.style.getPropertyValue('--keyboard-inset'),
    ).toBe('80px')
    expect(
      document.documentElement.style.getPropertyValue('--bottom-nav-transform'),
    ).toBe('translate3d(0, 80px, 0)')

    act(() => {
      viewport.height = 800
      viewport.dispatchEvent(new Event('resize'))
    })

    expect(
      document.documentElement.style.getPropertyValue('--keyboard-inset'),
    ).toBe('0px')
    expect(
      document.documentElement.style.getPropertyValue('--bottom-nav-transform'),
    ).toBe('none')
  })

  it('does not transform the fixed navigation for small browser-chrome shifts', () => {
    const viewport = installVisualViewport({ height: 720, offsetTop: 0 })
    const input = document.createElement('input')
    document.body.append(input)

    render(<KeyboardInsetHarness />)

    act(() => {
      input.focus()
      viewport.dispatchEvent(new Event('resize'))
    })

    expect(
      document.documentElement.style.getPropertyValue('--bottom-nav-transform'),
    ).toBe('none')
  })

  it('keeps keyboard compensation through a window resize while input stays focused', () => {
    vi.useFakeTimers()
    const viewport = installVisualViewport({ height: 500, offsetTop: 0 })
    const input = document.createElement('input')
    document.body.append(input)

    render(<KeyboardInsetHarness />)
    act(() => {
      input.focus()
      viewport.dispatchEvent(new Event('resize'))
    })
    expect(
      document.documentElement.style.getPropertyValue('--bottom-nav-transform'),
    ).toBe('translate3d(0, 300px, 0)')

    act(() => {
      window.dispatchEvent(new Event('resize'))
      vi.runAllTimers()
    })
    expect(
      document.documentElement.style.getPropertyValue('--bottom-nav-transform'),
    ).toBe('translate3d(0, 300px, 0)')
    vi.useRealTimers()
  })

  it('clears stale keyboard compensation when iOS omits the final viewport resize', () => {
    vi.useFakeTimers()
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
      vi.runAllTimers()
    })

    expect(
      document.documentElement.style.getPropertyValue('--keyboard-inset'),
    ).toBe('0px')
    expect(
      document.documentElement.style.getPropertyValue('--bottom-nav-transform'),
    ).toBe('none')
    vi.useRealTimers()
  })

  it('reanchors a locked live workout after a residual viewport pan', () => {
    vi.useFakeTimers()
    const viewport = installVisualViewport({ height: 500, offsetTop: 0 })
    const input = document.createElement('input')
    const scrollTo = vi.spyOn(window, 'scrollTo')
    document.body.classList.add('live-workout-open')
    document.body.append(input)

    render(<KeyboardInsetHarness />)
    act(() => {
      input.focus()
      viewport.dispatchEvent(new Event('resize'))
    })
    expect(
      document.documentElement.style.getPropertyValue('--keyboard-inset'),
    ).toBe('300px')
    expect(document.documentElement.scrollTop).toBe(0)
    expect(document.body.scrollTop).toBe(0)

    act(() => {
      input.blur()
      viewport.height = 800
      viewport.offsetTop = 0
      viewport.dispatchEvent(new Event('resize'))
      vi.advanceTimersByTime(20)
    })
    expect(
      document.documentElement.style.getPropertyValue(
        '--live-workout-viewport-offset',
      ),
    ).toBe('')

    act(() => {
      viewport.height = 776
      viewport.offsetTop = 24
      viewport.dispatchEvent(new Event('scroll'))
      vi.runAllTimers()
    })

    expect(document.documentElement.scrollTop).toBe(0)
    expect(document.body.scrollTop).toBe(0)
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
    expect(
      document.documentElement.style.getPropertyValue(
        '--live-workout-viewport-offset',
      ),
    ).toBe('24px')
    expect(
      document.documentElement.style.getPropertyValue('--keyboard-inset'),
    ).toBe('0px')
    expect(
      document.documentElement.style.getPropertyValue('--bottom-nav-transform'),
    ).toBe('none')

    act(() => {
      viewport.height = 800
      viewport.offsetTop = 0
      viewport.dispatchEvent(new Event('scroll'))
      vi.runAllTimers()
    })
    expect(
      document.documentElement.style.getPropertyValue(
        '--live-workout-viewport-offset',
      ),
    ).toBe('')
    vi.useRealTimers()
  })

  it('reacquires residual viewport compensation after background resume', () => {
    vi.useFakeTimers()
    const viewport = installVisualViewport({ height: 800, offsetTop: 0 })
    document.body.classList.add('live-workout-open')
    render(<KeyboardInsetHarness />)

    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      })
      document.dispatchEvent(new Event('visibilitychange'))
      viewport.height = 776
      viewport.offsetTop = 24
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'visible',
      })
      document.dispatchEvent(new Event('visibilitychange'))
      vi.runAllTimers()
    })

    expect(
      document.documentElement.style.getPropertyValue(
        '--live-workout-viewport-offset',
      ),
    ).toBe('24px')
    vi.useRealTimers()
  })

  it('does not rearm recovery when pagehide races a pending blur update', () => {
    vi.useFakeTimers()
    const viewport = installVisualViewport({ height: 500, offsetTop: 0 })
    const input = document.createElement('input')
    document.body.classList.add('live-workout-open')
    document.body.append(input)
    render(<KeyboardInsetHarness />)

    act(() => {
      input.focus()
      viewport.dispatchEvent(new Event('resize'))
      input.blur()
      window.dispatchEvent(new Event('pagehide'))
      vi.runAllTimers()
    })
    expect(
      document.documentElement.style.getPropertyValue('--keyboard-inset'),
    ).toBe('0px')
    expect(
      document.documentElement.style.getPropertyValue('--bottom-nav-transform'),
    ).toBe('none')

    act(() => {
      viewport.height = 776
      viewport.offsetTop = 24
      viewport.dispatchEvent(new Event('scroll'))
      vi.runAllTimers()
    })
    expect(
      document.documentElement.style.getPropertyValue(
        '--live-workout-viewport-offset',
      ),
    ).toBe('')
    vi.useRealTimers()
  })

  it('keeps the nav pinned while a route change and keyboard close overlap', () => {
    const viewport = installVisualViewport({ height: 500, offsetTop: 0 })
    const input = document.createElement('input')
    input.type = 'number'
    document.body.append(input)

    const view = render(<KeyboardInsetHarness resetKey="/nutrition" />)
    act(() => {
      input.focus()
      viewport.dispatchEvent(new Event('resize'))
    })
    expect(
      document.documentElement.style.getPropertyValue('--bottom-nav-transform'),
    ).toBe('translate3d(0, 300px, 0)')

    act(() => {
      input.blur()
      input.remove()
      view.rerender(<KeyboardInsetHarness resetKey="/workout" />)
    })

    expect(
      document.documentElement.style.getPropertyValue('--keyboard-inset'),
    ).toBe('300px')
    expect(
      document.documentElement.style.getPropertyValue('--bottom-nav-transform'),
    ).toBe('translate3d(0, 300px, 0)')

    act(() => {
      viewport.height = 800
      viewport.dispatchEvent(new Event('resize'))
    })

    expect(
      document.documentElement.style.getPropertyValue('--keyboard-inset'),
    ).toBe('0px')
    expect(
      document.documentElement.style.getPropertyValue('--bottom-nav-transform'),
    ).toBe('none')
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
