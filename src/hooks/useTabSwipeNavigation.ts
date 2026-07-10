import { useEffect, type RefObject } from 'react'

// Left-to-right order of the primary tabs, matching the bottom navigation.
// A left swipe advances to the next tab, a right swipe returns to the previous.
export const TAB_SWIPE_ORDER = ['/', '/nutrition', '/training', '/run'] as const

// A swipe must travel this far horizontally and stay dominantly horizontal
// (versus the vertical drift of a normal scroll) before it changes tabs.
const MIN_HORIZONTAL_DISTANCE = 64
const HORIZONTAL_DOMINANCE_RATIO = 1.4

/**
 * Pure resolution of a completed swipe to a destination tab, or null when the
 * gesture should be ignored (too short, too vertical, off the ends, or not a tab
 * route). Extracted so the thresholds are unit-testable without simulating touch.
 */
export function resolveTabSwipeTarget(
  currentPath: string,
  deltaX: number,
  deltaY: number,
): string | null {
  const index = (TAB_SWIPE_ORDER as readonly string[]).indexOf(currentPath)
  if (index === -1) {
    return null
  }

  if (Math.abs(deltaX) < MIN_HORIZONTAL_DISTANCE) {
    return null
  }
  if (Math.abs(deltaX) < Math.abs(deltaY) * HORIZONTAL_DOMINANCE_RATIO) {
    return null
  }

  const nextIndex = deltaX < 0 ? index + 1 : index - 1
  if (nextIndex < 0 || nextIndex >= TAB_SWIPE_ORDER.length) {
    return null
  }

  return TAB_SWIPE_ORDER[nextIndex]
}

/**
 * Enables lightweight swipe-to-switch between the four primary tabs. Detecting a
 * decisive horizontal swipe navigates to the adjacent tab; the route change then
 * plays the existing fade transition. Deliberately conservative: it yields to any
 * open sheet/dialog and to in-page horizontal gestures (scrollers, inputs, sliders)
 * so it never hijacks a swipe the current screen already handles.
 */
export function useTabSwipeNavigation(
  containerRef: RefObject<HTMLElement | null>,
  pathname: string,
  navigate: (path: string) => void,
) {
  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const index = (TAB_SWIPE_ORDER as readonly string[]).indexOf(pathname)
    if (index === -1) {
      return
    }

    let startX = 0
    let startY = 0
    let tracking = false

    function handleTouchStart(event: TouchEvent) {
      // Only single-finger gestures; a second touch is a pinch/zoom, not a swipe.
      if (event.touches.length !== 1) {
        tracking = false
        return
      }

      // An open sheet or dialog owns its own gestures (e.g. the program day swipe).
      if (document.querySelector('[role="dialog"], .sheet-backdrop')) {
        tracking = false
        return
      }

      const touch = event.touches[0]
      if (startsInGuardedRegion(touch.target)) {
        tracking = false
        return
      }

      startX = touch.clientX
      startY = touch.clientY
      tracking = true
    }

    function handleTouchMove(event: TouchEvent) {
      // A finger lift into a second touch mid-gesture cancels the swipe.
      if (tracking && event.touches.length !== 1) {
        tracking = false
      }
    }

    function handleTouchEnd(event: TouchEvent) {
      if (!tracking) {
        return
      }
      tracking = false

      const touch = event.changedTouches[0]
      if (!touch) {
        return
      }

      const target = resolveTabSwipeTarget(
        pathname,
        touch.clientX - startX,
        touch.clientY - startY,
      )
      if (target) {
        navigate(target)
      }
    }

    container.addEventListener('touchstart', handleTouchStart, {
      passive: true,
    })
    container.addEventListener('touchmove', handleTouchMove, { passive: true })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [containerRef, pathname, navigate])
}

// Walks up from the touch target: a swipe that begins on an input, slider, or a
// horizontally scrollable region belongs to that control, not to tab navigation.
function startsInGuardedRegion(target: EventTarget | null): boolean {
  let element = target instanceof Element ? target : null

  while (element && element !== document.body) {
    const tag = element.tagName
    if (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      element.getAttribute('role') === 'slider' ||
      element.getAttribute('contenteditable') === 'true' ||
      element.getAttribute('data-no-tab-swipe') === 'true'
    ) {
      return true
    }

    const overflowX = window.getComputedStyle(element).overflowX
    if (
      (overflowX === 'auto' || overflowX === 'scroll') &&
      element.scrollWidth > element.clientWidth + 1
    ) {
      return true
    }

    element = element.parentElement
  }

  return false
}
