import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  opensSoftwareKeyboard,
  useSoftwareKeyboardNav,
} from '@hooks/useSoftwareKeyboardNav'

function Harness() {
  useSoftwareKeyboardNav()
  return null
}

afterEach(() => {
  document.body.className = ''
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('opensSoftwareKeyboard', () => {
  it('is true for text-entry fields', () => {
    const text = document.createElement('input')
    text.type = 'text'
    const search = document.createElement('input')
    search.type = 'search'
    const area = document.createElement('textarea')
    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')

    expect(opensSoftwareKeyboard(text)).toBe(true)
    expect(opensSoftwareKeyboard(search)).toBe(true)
    expect(opensSoftwareKeyboard(area)).toBe(true)
    expect(opensSoftwareKeyboard(editable)).toBe(true)
  })

  it('is false for the workout keypad inputs and non-text controls', () => {
    const keypad = document.createElement('input')
    keypad.type = 'text'
    keypad.readOnly = true
    keypad.inputMode = 'none'
    const button = document.createElement('input')
    button.type = 'button'
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'

    expect(opensSoftwareKeyboard(keypad)).toBe(false)
    expect(opensSoftwareKeyboard(button)).toBe(false)
    expect(opensSoftwareKeyboard(checkbox)).toBe(false)
    expect(opensSoftwareKeyboard(null)).toBe(false)
  })
})

describe('useSoftwareKeyboardNav', () => {
  it('marks the body while a text field is focused and clears it on blur', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })

    const input = document.createElement('input')
    input.type = 'text'
    document.body.append(input)
    render(<Harness />)

    input.focus()
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(document.body.classList.contains('keyboard-input-open')).toBe(true)

    input.blur()
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    expect(document.body.classList.contains('keyboard-input-open')).toBe(false)
  })

  it('does not mark the body when inactive (e.g. the live workout)', () => {
    function InactiveHarness() {
      useSoftwareKeyboardNav(false)
      return null
    }

    const input = document.createElement('input')
    input.type = 'text'
    document.body.append(input)
    render(<InactiveHarness />)

    input.focus()
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(document.body.classList.contains('keyboard-input-open')).toBe(false)
  })

  it('clears a lingering marker when it becomes inactive', () => {
    function Toggling({ active }: { active: boolean }) {
      useSoftwareKeyboardNav(active)
      return null
    }

    document.body.classList.add('keyboard-input-open')
    const { rerender } = render(<Toggling active={false} />)
    expect(document.body.classList.contains('keyboard-input-open')).toBe(false)

    rerender(<Toggling active={true} />)
    // Re-activating does not spuriously set the class on its own.
    expect(document.body.classList.contains('keyboard-input-open')).toBe(false)
  })

  it('stays open when focus moves directly between two text fields', () => {
    const rafCallbacks: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    })

    const first = document.createElement('input')
    first.type = 'text'
    const second = document.createElement('input')
    second.type = 'text'
    document.body.append(first, second)
    render(<Harness />)

    first.focus()
    first.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(document.body.classList.contains('keyboard-input-open')).toBe(true)

    // Blur first, focus second before the deferred check runs.
    first.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    second.focus()
    second.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    rafCallbacks.forEach((cb) => cb(0))

    expect(document.body.classList.contains('keyboard-input-open')).toBe(true)
  })
})
