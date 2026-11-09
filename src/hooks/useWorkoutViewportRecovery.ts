import { useEffect } from 'react'

// iOS can paint the restored viewport before its touch coordinates catch up
// after the software keyboard closes. A one-pixel root scroll refreshes hit testing.
export function useWorkoutViewportRecovery() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport || !/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      return
    }

    let fullHeight = viewport.height
    let keyboardWasOpen = false
    let recoveryTimer: number | undefined
    let recoveryFrame: number | undefined

    function recover() {
      recoveryFrame = window.requestAnimationFrame(() => {
        const root = document.documentElement
        const originalScroll = root.scrollTop
        const maxScroll = root.scrollHeight - root.clientHeight
        if (maxScroll > 0) {
          root.scrollTop =
            originalScroll < maxScroll ? originalScroll + 1 : originalScroll - 1
          root.scrollTop = originalScroll
        }
        keyboardWasOpen = false
      })
    }

    function scheduleRecovery() {
      window.clearTimeout(recoveryTimer)
      recoveryTimer = window.setTimeout(recover, 350)
    }

    function handleViewportResize() {
      if (viewport!.height < fullHeight - 100) {
        keyboardWasOpen = true
        return
      }
      fullHeight = Math.max(fullHeight, viewport!.height)
      if (keyboardWasOpen) {
        scheduleRecovery()
      }
    }

    function handleFocusOut(event: FocusEvent) {
      if (
        keyboardWasOpen &&
        event.target instanceof HTMLElement &&
        event.target.matches('input, textarea')
      ) {
        scheduleRecovery()
      }
    }

    viewport.addEventListener('resize', handleViewportResize)
    document.addEventListener('focusout', handleFocusOut)
    return () => {
      viewport.removeEventListener('resize', handleViewportResize)
      document.removeEventListener('focusout', handleFocusOut)
      window.clearTimeout(recoveryTimer)
      window.cancelAnimationFrame(recoveryFrame ?? 0)
    }
  }, [])
}
