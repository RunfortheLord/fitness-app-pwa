import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useSubpageBackGesture } from '@hooks/useSubpageBackGesture'

function TestSubpage({ isOpen }: { isOpen: boolean }) {
  useSubpageBackGesture(isOpen, () => undefined)
  return <div />
}

describe('useSubpageBackGesture', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    window.history.replaceState(null, '', '/')
  })

  it('does not pop a newer route entry when an open subpage unmounts', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    const rendered = render(<TestSubpage isOpen />)

    window.history.pushState({}, '', '/training')
    rendered.unmount()

    expect(back).not.toHaveBeenCalled()
  })

  it('consumes its own pushed history entry when closed in place', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    const rendered = render(<TestSubpage isOpen />)

    rendered.rerender(<TestSubpage isOpen={false} />)

    expect(back).toHaveBeenCalledOnce()
  })
})
