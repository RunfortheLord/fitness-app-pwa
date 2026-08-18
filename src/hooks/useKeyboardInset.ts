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
    let focusOutUpdate: number | null = null
    let keyboardCloseFallback: number | null = null
    let keyboardSessionActive = false
    let keyboardBaselineHeight = Math.max(
      window.innerHeight,
      viewport.height + viewport.offsetTop,
    )
    let keyboardRecoveryUntil = 0
    let recoveryOffsetApplied = false
    let viewportRecoveryFrame: number | null = null

    const clearFocusOutUpdate = () => {
      if (focusOutUpdate !== null) {
        window.clearTimeout(focusOutUpdate)
        focusOutUpdate = null
      }
    }

    const cancelViewportRecovery = () => {
      if (viewportRecoveryFrame !== null) {
        window.cancelAnimationFrame(viewportRecoveryFrame)
        viewportRecoveryFrame = null
      }
    }

    const clearLiveWorkoutViewportOffset = () => {
      recoveryOffsetApplied = false
      root.style.removeProperty('--live-workout-viewport-offset')
    }

    const armKeyboardRecovery = () => {
      keyboardRecoveryUntil = Date.now() + 1_200
    }

    const queueLiveWorkoutViewportRecovery = () => {
      const liveWorkoutOpen =
        document.body.classList.contains('live-workout-open')
      if (!liveWorkoutOpen) {
        clearLiveWorkoutViewportOffset()
        return
      }
      if (
        isTextInputActive(document.activeElement) ||
        (Date.now() > keyboardRecoveryUntil && !recoveryOffsetApplied)
      ) {
        return
      }

      cancelViewportRecovery()
      // WebKit can dispatch the closing resize before VisualViewport and the
      // root geometry have settled. Read it on the next frame, then compensate
      // a residual top pan until a later viewport event reports the baseline.
      viewportRecoveryFrame = window.requestAnimationFrame(() => {
        viewportRecoveryFrame = null
        if (!document.body.classList.contains('live-workout-open')) {
          clearLiveWorkoutViewportOffset()
          return
        }
        if (isTextInputActive(document.activeElement)) {
          return
        }
        const viewportHeightReduction = Math.max(
          0,
          keyboardBaselineHeight - viewport.height,
        )
        const residualTopOffset =
          viewportHeightReduction < 120
            ? Math.max(0, Math.round(viewport.offsetTop))
            : 0
        if (residualTopOffset > 0) {
          recoveryOffsetApplied = true
          root.style.setProperty(
            '--live-workout-viewport-offset',
            `${residualTopOffset}px`,
          )
        } else {
          clearLiveWorkoutViewportOffset()
        }
        root.scrollTop = 0
        document.body.scrollTop = 0
        window.scrollTo(0, 0)
      })
    }

    const clearKeyboardCloseFallback = () => {
      if (keyboardCloseFallback !== null) {
        window.clearTimeout(keyboardCloseFallback)
        keyboardCloseFallback = null
      }
    }

    const resetStyles = () => {
      root.style.setProperty('--keyboard-inset', '0px')
      root.style.setProperty('--bottom-nav-transform', 'none')
    }

    const endKeyboardSession = () => {
      keyboardSessionActive = false
      keyboardBaselineHeight = Math.max(
        window.innerHeight,
        viewport.height + viewport.offsetTop,
      )
      resetStyles()
      queueLiveWorkoutViewportRecovery()
    }

    const resetKeyboardState = () => {
      clearFocusOutUpdate()
      clearKeyboardCloseFallback()
      cancelViewportRecovery()
      keyboardSessionActive = false
      keyboardRecoveryUntil = 0
      resetStyles()
      clearLiveWorkoutViewportOffset()
    }

    const update = () => {
      const textInputActive = isTextInputActive(document.activeElement)
      const viewportHeightReduction = Math.max(
        0,
        keyboardBaselineHeight - viewport.height,
      )
      const inset = Math.max(
        0,
        keyboardBaselineHeight - viewport.height - viewport.offsetTop,
      )
      const roundedInset = Math.round(inset)

      if (textInputActive && viewportHeightReduction >= 120) {
        clearKeyboardCloseFallback()
        keyboardSessionActive = true
        armKeyboardRecovery()
      }

      if (!textInputActive) {
        queueLiveWorkoutViewportRecovery()
      }

      // Tapping a set-complete button moves focus before iOS finishes closing
      // the keyboard. Keep compensating until the visual viewport expands so
      // the nav cannot briefly jump above the retreating keyboard.
      if (!keyboardSessionActive) {
        resetStyles()
        return
      }

      if (textInputActive) {
        if (roundedInset <= 0) {
          resetStyles()
          return
        }
      } else if (roundedInset <= 0) {
        endKeyboardSession()
        return
      }

      root.style.setProperty('--keyboard-inset', `${roundedInset}px`)
      root.style.setProperty(
        '--bottom-nav-transform',
        `translate3d(0, ${roundedInset}px, 0)`,
      )
    }

    const updateAfterFocusSettles = () => {
      clearFocusOutUpdate()
      focusOutUpdate = window.setTimeout(() => {
        focusOutUpdate = null
        update()
        if (!isTextInputActive(document.activeElement)) {
          armKeyboardRecovery()
          queueLiveWorkoutViewportRecovery()
          clearKeyboardCloseFallback()
          // iOS occasionally omits the final VisualViewport resize after the
          // keyboard closes or the installed PWA resumes. Keep the closing
          // animation smooth, but never allow stale compensation to survive.
          keyboardCloseFallback = window.setTimeout(() => {
            keyboardCloseFallback = null
            if (!isTextInputActive(document.activeElement)) {
              endKeyboardSession()
            }
          }, 700)
        }
      }, 0)
    }

    const updateAfterFocusIn = () => {
      clearKeyboardCloseFallback()
      cancelViewportRecovery()
      keyboardRecoveryUntil = 0
      clearLiveWorkoutViewportOffset()
      keyboardBaselineHeight = Math.max(
        window.innerHeight,
        viewport.height + viewport.offsetTop,
      )
      update()
    }

    const resetAfterViewportLifecycleChange = () => {
      if (isTextInputActive(document.activeElement)) {
        updateAfterFocusSettles()
        return
      }
      if (document.body.classList.contains('live-workout-open')) {
        armKeyboardRecovery()
      }
      endKeyboardSession()
    }

    const resetWhenHidden = () => {
      if (document.visibilityState === 'hidden') {
        resetKeyboardState()
      } else {
        resetAfterViewportLifecycleChange()
      }
    }

    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    document.addEventListener('focusin', updateAfterFocusIn)
    document.addEventListener('focusout', updateAfterFocusSettles)
    document.addEventListener('visibilitychange', resetWhenHidden)
    window.addEventListener('pagehide', resetKeyboardState)
    window.addEventListener('pageshow', resetAfterViewportLifecycleChange)
    window.addEventListener('resize', resetAfterViewportLifecycleChange)
    window.addEventListener(
      'orientationchange',
      resetAfterViewportLifecycleChange,
    )

    return () => {
      clearFocusOutUpdate()
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      cancelViewportRecovery()
      clearKeyboardCloseFallback()
      document.removeEventListener('focusin', updateAfterFocusIn)
      document.removeEventListener('focusout', updateAfterFocusSettles)
      document.removeEventListener('visibilitychange', resetWhenHidden)
      window.removeEventListener('pagehide', resetKeyboardState)
      window.removeEventListener('pageshow', resetAfterViewportLifecycleChange)
      window.removeEventListener('resize', resetAfterViewportLifecycleChange)
      window.removeEventListener(
        'orientationchange',
        resetAfterViewportLifecycleChange,
      )
      root.style.removeProperty('--keyboard-inset')
      root.style.removeProperty('--bottom-nav-transform')
      root.style.removeProperty('--live-workout-viewport-offset')
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
