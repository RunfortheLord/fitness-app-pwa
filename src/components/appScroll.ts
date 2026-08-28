/**
 * The whole app is pinned to the viewport as a flex column (see `.app-shell` in
 * global.css). Page content therefore scrolls inside the `<main id="main-content">`
 * element rather than the document. These helpers read and drive that scroll
 * container so scroll-restore / scroll-to-top logic targets the real scroller.
 *
 * They fall back to `window` when the app main is absent (e.g. a page rendered in
 * isolation by a unit test), so callers work in both environments.
 */

export const APP_MAIN_ID = 'main-content'

export function getAppScrollElement(): HTMLElement | null {
  return document.getElementById(APP_MAIN_ID)
}

export function getAppScrollTop(): number {
  const element = getAppScrollElement()
  return element ? element.scrollTop : window.scrollY
}

export function scrollAppTo(top: number, behavior: ScrollBehavior = 'auto') {
  const element = getAppScrollElement()
  const target: Pick<Element, 'scrollTo'> | Window = element ?? window
  try {
    target.scrollTo({ top, left: 0, behavior })
  } catch {
    // Environments without a real scroll implementation (jsdom) throw; fall back
    // to setting scrollTop directly when we have a concrete element.
    if (element) {
      element.scrollTop = top
    }
  }
}
