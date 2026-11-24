import { useEffect } from 'react'

import { opensSoftwareKeyboard } from './useSoftwareKeyboardNav'

/** Reset focus/resume document offsets without remounting the workout or moving
 * its independently scrolling set list. Layout sizing remains entirely in CSS. */
export function useWorkoutViewportRecovery(active: boolean) {
  useEffect(() => {
    if (!active) return

    let frame = 0
    let timer = 0
    const viewport = window.visualViewport
    const pointers = new Set<number>()

    function recover() {
      if (
        document.visibilityState === 'hidden' ||
        pointers.size > 0 ||
        opensSoftwareKeyboard(document.activeElement) ||
        (viewport && Math.abs(viewport.scale - 1) > 0.01)
      ) {
        return
      }
      // A locked root can still retain an iOS focus-scroll offset. Do not rely
      // on it having a scroll range, and do not nudge an inner scrolling list.
      if (document.documentElement.scrollTop !== 0)
        document.documentElement.scrollTop = 0
      if (document.body.scrollTop !== 0) document.body.scrollTop = 0
      if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0)
    }

    function schedule() {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
      frame = window.requestAnimationFrame(recover)
      // WebKit can finish restoring its viewport after the first visible frame.
      timer = window.setTimeout(recover, 350)
    }
    function pointerDown(event: PointerEvent) {
      pointers.add(event.pointerId)
    }
    function pointerEnd(event: PointerEvent) {
      pointers.delete(event.pointerId)
    }
    function visibilityChange() {
      pointers.clear()
      schedule()
    }

    document.addEventListener('visibilitychange', visibilityChange)
    document.addEventListener('focusout', schedule)
    document.addEventListener('pointerdown', pointerDown, true)
    document.addEventListener('pointerup', pointerEnd, true)
    document.addEventListener('pointercancel', pointerEnd, true)
    window.addEventListener('pageshow', visibilityChange)
    window.addEventListener('focus', schedule)
    window.addEventListener('resize', schedule)
    viewport?.addEventListener('resize', schedule)
    viewport?.addEventListener('scroll', schedule)
    schedule()

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', visibilityChange)
      document.removeEventListener('focusout', schedule)
      document.removeEventListener('pointerdown', pointerDown, true)
      document.removeEventListener('pointerup', pointerEnd, true)
      document.removeEventListener('pointercancel', pointerEnd, true)
      window.removeEventListener('pageshow', visibilityChange)
      window.removeEventListener('focus', schedule)
      window.removeEventListener('resize', schedule)
      viewport?.removeEventListener('resize', schedule)
      viewport?.removeEventListener('scroll', schedule)
    }
  }, [active])
}
