import { useEffect, useRef } from 'react'

// Tracks how many in-app sub-pages are currently open so that, when several are
// stacked (e.g. Browse -> Preview), only the top-most one responds to a back
// gesture or Escape.
let openSubpageDepth = 0
// Set when a sub-page closes in-app and consumes its own history entry, so the
// resulting popstate is not mistaken for a real Back gesture by a parent.
let suppressNextPop = false

/**
 * Makes a state-driven sub-page (one that is not its own router route) respond
 * to the device/browser Back button and the Escape key. While the sub-page is
 * open a history entry is pushed, so a Back gesture pops that entry and closes
 * the sub-page instead of leaving the app. Closing the sub-page in-app (e.g. via
 * a back arrow) consumes the pushed entry so history stays balanced.
 */
export function useSubpageBackGesture(isOpen: boolean, onExit: () => void) {
  const onExitRef = useRef(onExit)
  useEffect(() => {
    onExitRef.current = onExit
  }, [onExit])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    // A sub-page is a fresh screen, so start it at the top rather than inheriting
    // the parent page's scroll position. Guarded for environments (e.g. jsdom)
    // that do not implement scrollTo.
    try {
      window.scrollTo({ top: 0 })
    } catch {
      // Non-critical: ignore environments without a real scroll implementation.
    }

    const depth = ++openSubpageDepth
    let exitedViaPop = false
    window.history.pushState({ __subpage: depth }, '')

    const isTopMost = () => depth === openSubpageDepth
    // A modal sheet/dialog open over the sub-page handles its own dismissal, so
    // the sub-page should not also close underneath it.
    const modalOpen = () =>
      document.querySelector('[aria-modal="true"]') !== null

    const handlePopState = () => {
      if (suppressNextPop) {
        suppressNextPop = false
        return
      }
      if (!isTopMost() || modalOpen()) {
        return
      }
      exitedViaPop = true
      openSubpageDepth -= 1
      onExitRef.current()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isTopMost() && !modalOpen()) {
        onExitRef.current()
      }
    }

    window.addEventListener('popstate', handlePopState)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('keydown', handleKeyDown)
      if (!exitedViaPop) {
        // Closed in-app (back arrow / Escape / state change); consume the entry
        // we pushed so the history stack stays balanced, and flag the resulting
        // popstate so a parent sub-page does not also close.
        openSubpageDepth -= 1
        if (window.history.state?.__subpage === depth) {
          suppressNextPop = true
          window.history.back()
        }
      }
    }
  }, [isOpen])
}
