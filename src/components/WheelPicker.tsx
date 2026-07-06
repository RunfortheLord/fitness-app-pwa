import { useEffect, useRef } from 'react'

import {
  clampWheelIndex,
  indexFromScroll,
  rangeValues,
  scrollForIndex,
  wheelSpacerHeight,
} from '@components/wheelScroll'

const REST_MINUTE_VALUES = rangeValues(0, 15)
const REST_SECOND_VALUES = rangeValues(0, 59)

function padTwo(value: number) {
  return String(value).padStart(2, '0')
}

/**
 * A single scrollable wheel column (like an iOS timer drum). Snaps to the
 * centered value on scroll, supports click-to-select and arrow-key changes,
 * and exposes listbox semantics for assistive tech.
 */
export function WheelColumn({
  ariaLabel,
  formatValue = (value) => String(value),
  onChange,
  value,
  values,
}: {
  ariaLabel: string
  formatValue?: (value: number) => string
  onChange: (value: number) => void
  value: number
  values: number[]
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const isSettling = useRef<number | null>(null)
  const selectedIndex = clampWheelIndex(values.indexOf(value), values.length)

  // Keep the drum aligned to the selected value when it changes from outside a
  // user scroll (initial mount, click, arrow keys, external form edits).
  useEffect(() => {
    const element = scrollRef.current
    if (!element) {
      return
    }
    const target = scrollForIndex(selectedIndex)
    if (Math.abs(element.scrollTop - target) > 1) {
      element.scrollTop = target
    }
  }, [selectedIndex])

  function handleScroll() {
    const element = scrollRef.current
    if (!element) {
      return
    }
    if (isSettling.current !== null) {
      window.clearTimeout(isSettling.current)
    }
    // Debounce until scrolling stops, then commit the centered value.
    isSettling.current = window.setTimeout(() => {
      isSettling.current = null
      const index = indexFromScroll(element.scrollTop, values.length)
      const next = values[index]
      if (next !== value) {
        onChange(next)
      } else {
        element.scrollTop = scrollForIndex(index)
      }
    }, 120)
  }

  function step(direction: -1 | 1) {
    const next =
      values[clampWheelIndex(selectedIndex + direction, values.length)]
    if (next !== value) {
      onChange(next)
    }
  }

  return (
    <div
      aria-label={ariaLabel}
      className="wheel-scroll"
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          step(-1)
        } else if (event.key === 'ArrowDown') {
          event.preventDefault()
          step(1)
        }
      }}
      onScroll={handleScroll}
      ref={scrollRef}
      role="listbox"
      tabIndex={0}
    >
      <div aria-hidden="true" style={{ height: wheelSpacerHeight() }} />
      {values.map((option) => (
        <button
          aria-selected={option === value}
          className={`wheel-item${option === value ? ' is-selected' : ''}`}
          key={option}
          onClick={() => onChange(option)}
          role="option"
          tabIndex={-1}
          type="button"
        >
          {formatValue(option)}
        </button>
      ))}
      <div aria-hidden="true" style={{ height: wheelSpacerHeight() }} />
    </div>
  )
}

/**
 * Two-drum rest-time picker (minutes : seconds) styled like a phone timer.
 * Emits the chosen minutes and seconds; the caller converts to/from storage.
 */
export function RestWheelPicker({
  minutes,
  onChange,
  seconds,
}: {
  minutes: number
  onChange: (minutes: number, seconds: number) => void
  seconds: number
}) {
  return (
    <div aria-label="Rest time" className="rest-wheel" role="group">
      <div className="wheel-unit-group">
        <WheelColumn
          ariaLabel="Rest minutes"
          formatValue={padTwo}
          onChange={(nextMinutes) => onChange(nextMinutes, seconds)}
          value={clampWheelIndex(minutes, REST_MINUTE_VALUES.length)}
          values={REST_MINUTE_VALUES}
        />
        <span className="wheel-unit">min</span>
      </div>
      <span aria-hidden="true" className="wheel-separator">
        :
      </span>
      <div className="wheel-unit-group">
        <WheelColumn
          ariaLabel="Rest seconds"
          formatValue={padTwo}
          onChange={(nextSeconds) => onChange(minutes, nextSeconds)}
          value={Math.min(Math.max(seconds, 0), 59)}
          values={REST_SECOND_VALUES}
        />
        <span className="wheel-unit">sec</span>
      </div>
    </div>
  )
}
