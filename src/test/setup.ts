import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'

Object.defineProperties(HTMLMediaElement.prototype, {
  load: { configurable: true, value: () => undefined },
  pause: { configurable: true, value: () => undefined },
  play: { configurable: true, value: () => Promise.resolve() },
})

Object.defineProperty(window, 'scrollTo', {
  configurable: true,
  value: () => undefined,
})
