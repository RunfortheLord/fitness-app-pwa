import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { useWorkoutViewportRecovery } from './useWorkoutViewportRecovery'

function Harness({ active = true }: { active?: boolean }) {
  useWorkoutViewportRecovery(active)
  return <input aria-label="notes" defaultValue="Keep this draft" />
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) =>
    window.setTimeout(() => callback(0), 16),
  )
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(
    window.clearTimeout,
  )
})

afterEach(() => {
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('recovers a locked document on resume without replacing inputs or scrolling the set list', () => {
  const view = render(<Harness />)
  const input = view.getByRole('textbox')
  const list = document.createElement('div')
  view.container.append(list)
  list.scrollTop = 125
  // No scroll range: the previous scroll-by-one recovery did nothing here.
  expect(document.documentElement.scrollHeight).toBe(0)
  for (const event of ['pageshow', 'focus', 'resize']) {
    document.documentElement.scrollTop = 48
    document.body.scrollTop = 48
    window.dispatchEvent(new Event(event))
    act(() => vi.advanceTimersByTime(400))
    expect(document.documentElement.scrollTop).toBe(0)
    expect(document.body.scrollTop).toBe(0)
    expect(list.scrollTop).toBe(125)
    expect(view.getByRole('textbox')).toBe(input)
    expect(input).toHaveValue('Keep this draft')
  }
})

it('leaves an active native keyboard alone and recovers after it closes', () => {
  const view = render(<Harness />)
  const input = view.getByRole('textbox')
  input.focus()
  document.documentElement.scrollTop = 48
  window.dispatchEvent(new Event('resize'))
  act(() => vi.advanceTimersByTime(400))
  expect(document.documentElement.scrollTop).toBe(48)
  input.blur()
  act(() => vi.advanceTimersByTime(400))
  expect(document.documentElement.scrollTop).toBe(0)
  expect(input).toHaveValue('Keep this draft')
})

it('does not reset offsets during pinch zoom, while hidden, or after unmount', () => {
  const viewport = new EventTarget()
  Object.assign(viewport, { scale: 2 })
  vi.stubGlobal('visualViewport', viewport)
  const view = render(<Harness />)
  document.documentElement.scrollTop = 48
  viewport.dispatchEvent(new Event('resize'))
  act(() => vi.advanceTimersByTime(400))
  expect(document.documentElement.scrollTop).toBe(48)
  Object.assign(viewport, { scale: 1 })
  const visibility = vi.spyOn(document, 'visibilityState', 'get')
  visibility.mockReturnValue('hidden')
  document.dispatchEvent(new Event('visibilitychange'))
  act(() => vi.advanceTimersByTime(400))
  expect(document.documentElement.scrollTop).toBe(48)
  visibility.mockReturnValue('visible')
  document.dispatchEvent(new Event('visibilitychange'))
  act(() => vi.advanceTimersByTime(400))
  expect(document.documentElement.scrollTop).toBe(0)
  view.unmount()
  document.documentElement.scrollTop = 48
  window.dispatchEvent(new Event('pageshow'))
  act(() => vi.advanceTimersByTime(400))
  expect(document.documentElement.scrollTop).toBe(48)
})

it('does not interrupt a pointer gesture or run outside a live workout', () => {
  const view = render(<Harness />)
  document.dispatchEvent(
    Object.assign(new Event('pointerdown'), { pointerId: 7 }),
  )
  document.documentElement.scrollTop = 48
  window.dispatchEvent(new Event('resize'))
  act(() => vi.advanceTimersByTime(400))
  expect(document.documentElement.scrollTop).toBe(48)
  // A suspended page may never receive pointerup for the interrupted gesture.
  window.dispatchEvent(new Event('pageshow'))
  act(() => vi.advanceTimersByTime(400))
  expect(document.documentElement.scrollTop).toBe(0)
  view.rerender(<Harness active={false} />)
  document.documentElement.scrollTop = 48
  window.dispatchEvent(new Event('resize'))
  act(() => vi.advanceTimersByTime(400))
  expect(document.documentElement.scrollTop).toBe(48)
})
