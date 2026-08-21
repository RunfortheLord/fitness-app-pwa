import { useEffect, useState } from 'react'

const KEYBOARD_OPEN_THRESHOLD_PX = 120
const KEYBOARD_CLOSED_TOLERANCE_PX = 32
const KEYBOARD_CLOSE_POLL_MS = 50

/**
 * Isolates fixed bottom navigation from software-keyboard viewport changes.
 *
 * The navigation is removed from rendering while a keyboard-sized visual
 * viewport reduction is active. Once the viewport has recovered, AppShell
 * remounts the navigation so WebKit cannot reuse stale fixed-position geometry.
 * No viewport measurement is written back into page or navigation layout.
 */
export function useKeyboardNavigation() {
  const [isNavigationHidden, setIsNavigationHidden] = useState(false)
  const [navigationResetKey, setNavigationResetKey] = useState(0)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) {
      return
    }

    let keyboardSessionActive = false
    let keyboardBaselineHeight = readViewportBaseline(viewport)
    let focusOutUpdate: number | null = null
    let keyboardClosePoll: number | null = null
    let isMounted = true

    const clearFocusOutUpdate = () => {
      if (focusOutUpdate !== null) {
        window.clearTimeout(focusOutUpdate)
        focusOutUpdate = null
      }
    }

    const clearKeyboardClosePoll = () => {
      if (keyboardClosePoll !== null) {
        window.clearTimeout(keyboardClosePoll)
        keyboardClosePoll = null
      }
    }

    const showNavigation = () => {
      if (isMounted) {
        setIsNavigationHidden(false)
      }
    }

    const hideNavigation = () => {
      if (isMounted) {
        setIsNavigationHidden(true)
      }
    }

    const remountNavigation = () => {
      if (isMounted) {
        setNavigationResetKey((current) => current + 1)
      }
    }

    const endKeyboardSession = (forceRemount = false) => {
      const shouldRemount = keyboardSessionActive || forceRemount
      clearKeyboardClosePoll()
      keyboardSessionActive = false
      keyboardBaselineHeight = readViewportBaseline(viewport)
      showNavigation()
      if (shouldRemount) {
        remountNavigation()
      }
    }

    const update = () => {
      const textInputActive = isTextInputActive(document.activeElement)
      const heightReduction = Math.max(
        0,
        keyboardBaselineHeight - viewport.height,
      )

      if (textInputActive && heightReduction >= KEYBOARD_OPEN_THRESHOLD_PX) {
        keyboardSessionActive = true
      }

      if (!keyboardSessionActive) {
        if (!textInputActive) {
          keyboardBaselineHeight = readViewportBaseline(viewport)
        }
        showNavigation()
        return
      }

      if (!textInputActive && heightReduction <= KEYBOARD_CLOSED_TOLERANCE_PX) {
        endKeyboardSession()
        return
      }

      hideNavigation()
    }

    const pollForKeyboardClose = () => {
      clearKeyboardClosePoll()
      if (!keyboardSessionActive || isTextInputActive(document.activeElement)) {
        return
      }

      keyboardClosePoll = window.setTimeout(() => {
        keyboardClosePoll = null
        update()
        if (
          keyboardSessionActive &&
          !isTextInputActive(document.activeElement)
        ) {
          pollForKeyboardClose()
        }
      }, KEYBOARD_CLOSE_POLL_MS)
    }

    const updateAndPollIfClosing = () => {
      update()
      if (keyboardSessionActive && !isTextInputActive(document.activeElement)) {
        pollForKeyboardClose()
      }
    }

    const handleFocusIn = () => {
      clearFocusOutUpdate()
      clearKeyboardClosePoll()
      keyboardBaselineHeight = Math.max(
        keyboardBaselineHeight,
        readViewportBaseline(viewport),
      )
      update()
    }

    const handleFocusOut = () => {
      clearFocusOutUpdate()
      focusOutUpdate = window.setTimeout(() => {
        focusOutUpdate = null
        if (document.visibilityState === 'hidden') {
          return
        }
        update()
        if (
          keyboardSessionActive &&
          !isTextInputActive(document.activeElement)
        ) {
          pollForKeyboardClose()
        }
      }, 0)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearFocusOutUpdate()
        clearKeyboardClosePoll()
        return
      }
      if (keyboardSessionActive) {
        updateAndPollIfClosing()
      } else {
        endKeyboardSession(true)
      }
    }

    const handlePageShow = () => {
      if (keyboardSessionActive) {
        updateAndPollIfClosing()
      } else {
        endKeyboardSession(true)
      }
    }

    const handlePageHide = () => {
      clearFocusOutUpdate()
      clearKeyboardClosePoll()
    }

    viewport.addEventListener('resize', updateAndPollIfClosing)
    viewport.addEventListener('scroll', updateAndPollIfClosing)
    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('resize', updateAndPollIfClosing)
    window.addEventListener('pageshow', handlePageShow)
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      isMounted = false
      clearFocusOutUpdate()
      clearKeyboardClosePoll()
      viewport.removeEventListener('resize', updateAndPollIfClosing)
      viewport.removeEventListener('scroll', updateAndPollIfClosing)
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('resize', updateAndPollIfClosing)
      window.removeEventListener('pageshow', handlePageShow)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [])

  return { isNavigationHidden, navigationResetKey }
}

function readViewportBaseline(viewport: VisualViewport) {
  return Math.max(
    window.innerHeight,
    viewport.height + Math.max(0, viewport.offsetTop),
  )
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
