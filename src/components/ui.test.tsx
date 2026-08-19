import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LanguageProvider } from '@components/LanguageContext'
import { BottomSheet } from '@components/ui'

function OverlappingSheetHarness() {
  const [outerOpen, setOuterOpen] = useState(true)
  const [innerOpen, setInnerOpen] = useState(false)

  return (
    <>
      <button type="button">Workout action</button>
      <BottomSheet
        isOpen={outerOpen}
        onClose={() => setOuterOpen(false)}
        title="Exercise options"
      >
        <button
          type="button"
          onClick={() => {
            setInnerOpen(true)
            setOuterOpen(false)
          }}
        >
          Open swap
        </button>
      </BottomSheet>
      <BottomSheet
        isOpen={innerOpen}
        onClose={() => setInnerOpen(false)}
        title="Swap exercise"
        variant="page"
      >
        <button type="button" onClick={() => setInnerOpen(false)}>
          Choose replacement
        </button>
      </BottomSheet>
    </>
  )
}

function SwipeSheetHarness() {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title="Quick actions"
    >
      <button type="button">Log food</button>
    </BottomSheet>
  )
}

describe('BottomSheet', () => {
  it('dismisses standard sheets with a downward swipe by default', async () => {
    const { container } = render(
      <LanguageProvider>
        <SwipeSheetHarness />
      </LanguageProvider>,
    )

    const dragRegion = container.querySelector('.sheet-drag-region')
    expect(dragRegion).not.toBeNull()
    expect(screen.getByRole('dialog')).toHaveClass('is-swipe-dismissible')

    fireEvent.pointerDown(dragRegion!, {
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 1,
    })
    fireEvent.pointerMove(dragRegion!, {
      clientX: 102,
      clientY: 150,
      pointerId: 1,
    })
    expect(screen.getByRole('dialog')).toHaveStyle({
      transform: 'translate3d(0, 50px, 0)',
    })
    fireEvent.pointerUp(dragRegion!, {
      clientX: 102,
      clientY: 180,
      pointerId: 1,
    })

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
  })

  it('restores background interaction after overlapping sheets close', async () => {
    render(
      <LanguageProvider>
        <OverlappingSheetHarness />
      </LanguageProvider>,
    )

    const workoutAction = screen.getByRole('button', {
      name: 'Workout action',
    })
    expect(workoutAction.inert).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Open swap' }))
    expect(workoutAction.inert).toBe(true)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Choose replacement' }),
    )

    await waitFor(() => expect(workoutAction.inert).toBe(false))
  })
})
