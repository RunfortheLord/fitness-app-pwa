import { useEffect } from 'react'

/**
 * Keeps `position: fixed` bottom-anchored UI (the bottom nav) pinned to the true
 * bottom of the screen while the on-screen keyboard is open.
 *
 * On iOS Safari the software keyboard shrinks the visual viewport but leaves a
 * fixed `bottom: 0` element anchored to the layout viewport, so the element can
 * float up and hover above the keyboard. Using the VisualViewport API, measure
 * that overlap only while a text-entry control is focused. Normal page
 * scrolling and browser chrome movement also fire VisualViewport events, and
 * treating those as keyboard overlap makes the fixed bottom nav crowd the page.
 */
export function useKeyboardInset() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) {
      return
    }

    const root = document.documentElement

    const update = () => {
      if (!isTextInputActive(document.activeElement)) {
        root.style.setProperty('--keyboard-inset', '0px')
        return
      }

      const inset = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop,
      )
      root.style.setProperty('--keyboard-inset', `${Math.round(inset)}px`)
    }

    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)

    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', update)
      root.style.removeProperty('--keyboard-inset')
    }
  }, [])
}

function isTextInputActive(element: Element | null) {
  if (!element) {
    return false
  }

  if (element instanceof HTMLTextAreaElement) {
    return true
  }

  if (element instanceof HTMLInputElement) {
    return isKeyboardInputType(element.type)
  }

  if (element instanceof HTMLElement) {
    return element.isContentEditable
  }

  return false
}

function isKeyboardInputType(type: string) {
  return [
    '',
    'date',
    'datetime-local',
    'email',
    'month',
    'number',
    'password',
    'search',
    'tel',
    'text',
    'time',
    'url',
    'week',
  ].includes(type)
}
