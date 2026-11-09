import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useWorkoutViewportRecovery } from './useWorkoutViewportRecovery'

describe('useWorkoutViewportRecovery', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('refreshes hit testing after a keyboard-sized viewport change without moving the workout', () => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', { userAgent: 'iPhone' })
    const viewport = new EventTarget() as EventTarget & { height: number }
    viewport.height = 700
    vi.stubGlobal('visualViewport', viewport)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => undefined)

    const root = document.documentElement
    const previousScrollHeight = Object.getOwnPropertyDescriptor(
      root,
      'scrollHeight',
    )
    const previousClientHeight = Object.getOwnPropertyDescriptor(
      root,
      'clientHeight',
    )
    const previousScrollTop = Object.getOwnPropertyDescriptor(root, 'scrollTop')
    const positions: number[] = []
    let scrollTop = 120
    Object.defineProperties(root, {
      scrollHeight: { configurable: true, value: 1200 },
      clientHeight: { configurable: true, value: 700 },
      scrollTop: {
        configurable: true,
        get: () => scrollTop,
        set: (value: number) => {
          positions.push(value)
          scrollTop = value
        },
      },
    })

    try {
      const { unmount } = renderHook(() => useWorkoutViewportRecovery())
      act(() => {
        viewport.height = 350
        viewport.dispatchEvent(new Event('resize'))
        viewport.height = 700
        viewport.dispatchEvent(new Event('resize'))
        vi.advanceTimersByTime(350)
      })

      expect(positions).toEqual([121, 120])
      unmount()
    } finally {
      for (const [name, descriptor] of [
        ['scrollHeight', previousScrollHeight],
        ['clientHeight', previousClientHeight],
        ['scrollTop', previousScrollTop],
      ] as const) {
        if (descriptor) {
          Object.defineProperty(root, name, descriptor)
        } else {
          Reflect.deleteProperty(root, name)
        }
      }
    }
  })
})
