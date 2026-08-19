import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  SortableDragHandle,
  SortableList,
  SortableListItem,
} from '@components/SortableList'
import {
  HORIZONTAL_AUTO_SCROLL_MAX_STEP_PX,
  HORIZONTAL_COLLISION_HYSTERESIS_PX,
  isHorizontallyScrollable,
  pointerActivatorProps,
  restrictToHorizontalAxis,
  type SortableDragState,
} from '@components/sortableDrag'

const ITEMS = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Bravo' },
  { id: 'c', name: 'Charlie' },
]

const originalGetBoundingClientRect =
  HTMLElement.prototype.getBoundingClientRect

// dnd-kit needs real geometry to compute keyboard drop targets; jsdom returns
// all-zero rects, so lay sortable items out as a 60px-tall vertical stack.
function rectForIndex(
  index: number,
  direction: 'horizontal' | 'vertical' = 'vertical',
): DOMRect {
  const x = direction === 'horizontal' ? index * 100 : 0
  const y = direction === 'vertical' ? index * 60 : 0
  const width = direction === 'horizontal' ? 100 : 320
  return {
    x,
    y,
    width,
    height: 60,
    top: y,
    bottom: y + 60,
    left: x,
    right: x + width,
    toJSON: () => ({}),
  } as DOMRect
}

beforeEach(() => {
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    const item = this.closest('.sortable-item')
    if (item?.parentElement) {
      return rectForIndex(
        Array.from(item.parentElement.children).indexOf(item),
        item.parentElement.classList.contains('horizontal-list')
          ? 'horizontal'
          : 'vertical',
      )
    }
    return originalGetBoundingClientRect.call(this)
  }
})

afterEach(() => {
  HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
})

function renderList(
  onReorder: (orderedIds: string[]) => void,
  direction: 'horizontal' | 'vertical' = 'vertical',
) {
  return render(
    <SortableList
      direction={direction}
      getItemLabel={(id) => ITEMS.find((item) => item.id === id)?.name ?? id}
      itemIds={ITEMS.map((item) => item.id)}
      onReorder={onReorder}
    >
      <div
        className={direction === 'horizontal' ? 'horizontal-list' : undefined}
      >
        {ITEMS.map((item) => (
          <SortableListItem id={item.id} key={item.id}>
            {(drag) => (
              <>
                <SortableDragHandle
                  drag={drag}
                  label={`Reorder ${item.name}`}
                />
                <span>{item.name}</span>
              </>
            )}
          </SortableListItem>
        ))}
      </div>
    </SortableList>,
  )
}

async function liftWithKeyboard(handle: HTMLElement) {
  await act(async () => {
    handle.focus()
    fireEvent.keyDown(handle, { code: 'Space', key: ' ' })
    // Droppable rects are measured on the next animation frame after lift.
    await new Promise((resolve) => requestAnimationFrame(resolve))
  })
}

describe('SortableList', () => {
  it('uses the tuned horizontal top speed and midpoint stability margin', () => {
    expect(HORIZONTAL_AUTO_SCROLL_MAX_STEP_PX).toBe(4)
    expect(HORIZONTAL_COLLISION_HYSTERESIS_PX).toBe(56)
  })

  it('removes vertical movement from horizontal drags', () => {
    const transform = restrictToHorizontalAxis({
      transform: { x: 48, y: 37, scaleX: 1, scaleY: 1 },
    } as Parameters<typeof restrictToHorizontalAxis>[0])

    expect(transform).toEqual({ x: 48, y: 0, scaleX: 1, scaleY: 1 })
  })

  it('renders a labelled drag handle per item', () => {
    renderList(vi.fn())
    expect(
      screen.getByRole('button', { name: 'Reorder Alpha' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Reorder Charlie' }),
    ).toBeInTheDocument()
  })

  it('reorders with the keyboard and reports the new id order once', async () => {
    const onReorder = vi.fn()
    renderList(onReorder)

    const handle = screen.getByRole('button', { name: 'Reorder Alpha' })
    await liftWithKeyboard(handle)
    await act(async () => {
      fireEvent.keyDown(handle, { code: 'ArrowDown', key: 'ArrowDown' })
      await new Promise((resolve) => requestAnimationFrame(resolve))
    })
    act(() => {
      fireEvent.keyDown(handle, { code: 'Space', key: ' ' })
    })

    expect(onReorder).toHaveBeenCalledTimes(1)
    expect(onReorder).toHaveBeenCalledWith(['b', 'a', 'c'])
  })

  it('does not report a reorder when the drag is cancelled', async () => {
    const onReorder = vi.fn()
    renderList(onReorder)

    const handle = screen.getByRole('button', { name: 'Reorder Alpha' })
    await liftWithKeyboard(handle)
    await act(async () => {
      fireEvent.keyDown(handle, { code: 'ArrowDown', key: 'ArrowDown' })
      await new Promise((resolve) => requestAnimationFrame(resolve))
    })
    act(() => {
      fireEvent.keyDown(handle, { code: 'Escape', key: 'Escape' })
    })

    expect(onReorder).not.toHaveBeenCalled()
  })

  it('uses the dragged card center for a steadier horizontal drop target', async () => {
    const onReorder = vi.fn()
    renderList(onReorder, 'horizontal')

    const handle = screen.getByRole('button', { name: 'Reorder Charlie' })
    act(() => {
      fireEvent.mouseDown(handle, {
        button: 0,
        buttons: 1,
        clientX: 295,
        clientY: 30,
      })
      fireEvent.mouseMove(document, {
        buttons: 1,
        clientX: 287,
        clientY: 30,
      })
    })
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve))
    })
    expect(handle).toHaveAttribute('aria-pressed', 'true')
    act(() => {
      fireEvent.mouseMove(document, {
        buttons: 1,
        clientX: 105,
        clientY: 30,
      })
    })
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve))
    })
    act(() => {
      fireEvent.mouseUp(document, { clientX: 105, clientY: 30 })
    })

    expect(onReorder).toHaveBeenCalledTimes(1)
    expect(onReorder).toHaveBeenCalledWith(['c', 'a', 'b'])
  })

  it('keeps the approached slot stable near a horizontal midpoint', async () => {
    const onReorder = vi.fn()
    renderList(onReorder, 'horizontal')

    const handle = screen.getByRole('button', { name: 'Reorder Charlie' })
    act(() => {
      fireEvent.mouseDown(handle, {
        button: 0,
        buttons: 1,
        clientX: 295,
        clientY: 30,
      })
      fireEvent.mouseMove(document, {
        buttons: 1,
        clientX: 287,
        clientY: 30,
      })
    })
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve))
    })
    act(() => {
      fireEvent.mouseMove(document, {
        buttons: 1,
        clientX: 205,
        clientY: 30,
      })
    })
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve))
    })
    act(() => {
      fireEvent.mouseMove(document, {
        buttons: 1,
        clientX: 125,
        clientY: 30,
      })
    })
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve))
    })
    act(() => {
      fireEvent.mouseUp(document, { clientX: 125, clientY: 30 })
    })

    expect(onReorder).toHaveBeenCalledTimes(1)
    expect(onReorder).toHaveBeenCalledWith(['a', 'c', 'b'])
  })
})

describe('isHorizontallyScrollable', () => {
  it('allows the tab strip but rejects a vertical-only page scroller', () => {
    const tabStrip = document.createElement('div')
    Object.defineProperties(tabStrip, {
      clientWidth: { value: 320 },
      scrollWidth: { value: 900 },
    })
    const page = document.createElement('main')
    Object.defineProperties(page, {
      clientWidth: { value: 390 },
      scrollWidth: { value: 390 },
    })

    expect(isHorizontallyScrollable(tabStrip)).toBe(true)
    expect(isHorizontallyScrollable(page)).toBe(false)
  })
})

describe('pointerActivatorProps', () => {
  it('strips the keyboard drag listener so Enter still clicks', () => {
    const drag: SortableDragState = {
      attributes: {
        'aria-describedby': 'x',
        'aria-disabled': false,
        'aria-pressed': undefined,
        'aria-roledescription': 'sortable',
        role: 'button',
        tabIndex: 0,
      },
      isDragging: false,
      listeners: {
        onKeyDown: vi.fn(),
        onMouseDown: vi.fn(),
        onTouchStart: vi.fn(),
      },
      setActivatorNodeRef: vi.fn(),
    }
    const props = pointerActivatorProps(drag)
    expect(props.onKeyDown).toBeUndefined()
    expect(props.onMouseDown).toBeDefined()
    expect(props.onTouchStart).toBeDefined()
  })
})
