import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { RestWheelPicker, WheelColumn } from '@components/WheelPicker'
import {
  clampWheelIndex,
  indexFromScroll,
  rangeValues,
  scrollForIndex,
  WHEEL_ITEM_HEIGHT,
} from '@components/wheelScroll'

describe('wheelPicker helpers', () => {
  it('clamps indices into range', () => {
    expect(clampWheelIndex(-3, 5)).toBe(0)
    expect(clampWheelIndex(9, 5)).toBe(4)
    expect(clampWheelIndex(2, 5)).toBe(2)
    expect(clampWheelIndex(0, 0)).toBe(0)
  })

  it('maps scroll offset to the nearest centered index', () => {
    expect(indexFromScroll(0, 10)).toBe(0)
    expect(indexFromScroll(WHEEL_ITEM_HEIGHT * 2 + 5, 10)).toBe(2)
    expect(indexFromScroll(WHEEL_ITEM_HEIGHT * 2 + 30, 10)).toBe(3)
    // Beyond the list is clamped to the last index.
    expect(indexFromScroll(WHEEL_ITEM_HEIGHT * 99, 10)).toBe(9)
  })

  it('round-trips index and scroll offset', () => {
    expect(scrollForIndex(3)).toBe(3 * WHEEL_ITEM_HEIGHT)
    expect(indexFromScroll(scrollForIndex(4), 10)).toBe(4)
  })

  it('builds inclusive integer ranges', () => {
    expect(rangeValues(0, 3)).toEqual([0, 1, 2, 3])
    expect(rangeValues(2, 2)).toEqual([2])
  })
})

describe('WheelColumn', () => {
  it('selects a value on click and marks it selected', () => {
    const onChange = vi.fn()
    render(
      <WheelColumn
        ariaLabel="Minutes"
        onChange={onChange}
        value={1}
        values={[0, 1, 2, 3]}
      />,
    )
    const listbox = screen.getByRole('listbox', { name: 'Minutes' })
    expect(
      within(listbox).getByRole('option', { name: '1', selected: true }),
    ).toBeInTheDocument()

    fireEvent.click(within(listbox).getByRole('option', { name: '3' }))
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('steps with the arrow keys and stops at the ends', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <WheelColumn
        ariaLabel="Minutes"
        onChange={onChange}
        value={0}
        values={[0, 1, 2]}
      />,
    )
    const listbox = screen.getByRole('listbox', { name: 'Minutes' })

    fireEvent.keyDown(listbox, { key: 'ArrowUp' })
    // Already at the first value: no change.
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.keyDown(listbox, { key: 'ArrowDown' })
    expect(onChange).toHaveBeenLastCalledWith(1)

    rerender(
      <WheelColumn
        ariaLabel="Minutes"
        onChange={onChange}
        value={2}
        values={[0, 1, 2]}
      />,
    )
    fireEvent.keyDown(listbox, { key: 'ArrowDown' })
    // Already at the last value: no further change.
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('commits the centered value after scrolling settles', () => {
    vi.useFakeTimers()
    try {
      const onChange = vi.fn()
      render(
        <WheelColumn
          ariaLabel="Seconds"
          onChange={onChange}
          value={0}
          values={rangeValues(0, 5)}
        />,
      )
      const listbox = screen.getByRole('listbox', { name: 'Seconds' })
      // jsdom has no layout, so drive scrollTop directly.
      listbox.scrollTop = scrollForIndex(3)
      fireEvent.scroll(listbox)
      vi.advanceTimersByTime(150)
      expect(onChange).toHaveBeenCalledWith(3)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('RestWheelPicker', () => {
  it('reports minute and second changes independently', () => {
    const onChange = vi.fn()
    render(<RestWheelPicker minutes={1} onChange={onChange} seconds={30} />)

    fireEvent.click(
      within(screen.getByRole('listbox', { name: 'Rest minutes' })).getByRole(
        'option',
        { name: '02' },
      ),
    )
    expect(onChange).toHaveBeenLastCalledWith(2, 30)

    fireEvent.click(
      within(screen.getByRole('listbox', { name: 'Rest seconds' })).getByRole(
        'option',
        { name: '45' },
      ),
    )
    expect(onChange).toHaveBeenLastCalledWith(1, 45)
  })
})
