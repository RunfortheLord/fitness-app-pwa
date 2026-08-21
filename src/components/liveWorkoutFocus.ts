/**
 * Restore focus to a live-workout trigger input without letting the layout
 * viewport creep. iOS/WebKit (especially an installed standalone PWA) runs its
 * own "scroll the focused control into view" pass and ignores `preventScroll`,
 * which shoves the whole live-workout column up and pushes the in-flow bottom
 * navigation off screen. We snapshot every scroll position the focus could
 * disturb, focus without scroll, then restore them synchronously and again on
 * the next frame to undo the deferred WebKit scroll. Intentional set-list
 * scrolling is preserved because we restore each container to where it was.
 */
export function focusWithoutViewportShift(element: HTMLElement) {
  const scrollables: HTMLElement[] = []
  for (
    let node: HTMLElement | null = element.parentElement;
    node;
    node = node.parentElement
  ) {
    const style = window.getComputedStyle(node)
    if (/(auto|scroll|overlay)/.test(`${style.overflowY} ${style.overflowX}`)) {
      scrollables.push(node)
    }
  }

  const snapshot = scrollables.map((node) => ({
    node,
    left: node.scrollLeft,
    top: node.scrollTop,
  }))
  const pageX = window.scrollX
  const pageY = window.scrollY

  function restore() {
    for (const entry of snapshot) {
      if (entry.node.scrollTop !== entry.top) {
        entry.node.scrollTop = entry.top
      }
      if (entry.node.scrollLeft !== entry.left) {
        entry.node.scrollLeft = entry.left
      }
    }
    if (document.documentElement.scrollTop !== 0) {
      document.documentElement.scrollTop = 0
    }
    if (window.scrollX !== pageX || window.scrollY !== pageY) {
      window.scrollTo(pageX, pageY)
    }
  }

  element.focus({ preventScroll: true })
  restore()
  window.requestAnimationFrame(restore)
}
