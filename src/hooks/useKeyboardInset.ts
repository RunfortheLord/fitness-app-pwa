import { useEffect } from 'react'

/**
 * Keeps `position: fixed` bottom-anchored UI (the bottom nav) pinned to the true
 * bottom of the screen while the on-screen keyboard is open.
 *
 * On iOS Safari the software keyboard shrinks the *visual* viewport but leaves a
 * fixed `bottom: 0` element anchored to the *layout* viewport, so the element
 * floats up and hovers above the keyboard. Using the VisualViewport API we
 * measure how much the keyboard overlaps the layout viewport and expose it as a
 * `--keyboard-inset` CSS variable, which the nav translates down by so it stays
 * glued to the bottom (covered by the keyboard) instead of jumping up.
 */
export function useKeyboardInset() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) {
      return
    }

    const root = document.documentElement

    const update = () => {
      // How far the bottom of the visual viewport sits above the bottom of the
      // layout viewport — i.e. the height of the keyboard (and any toolbar).
      const inset = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop,
      )
      root.style.setProperty('--keyboard-inset', `${Math.round(inset)}px`)
    }

    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)

    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      root.style.removeProperty('--keyboard-inset')
    }
  }, [])
}
