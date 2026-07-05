import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  SortableDragHandle,
  SortableList,
  SortableListItem,
} from '@components/SortableList'
import {
  pointerActivatorProps,
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
function rectForIndex(index: number): DOMRect {
  return {
    x: 0,
    y: index * 60,
    width: 320,
    height: 60,
    top: index * 60,
    bottom: index * 60 + 60,
    left: 0,
    right: 320,
    toJSON: () => ({}),
  } as DOMRect
}

beforeEach(() => {
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    const item = this.closest('.sortable-item')
    if (item?.parentElement) {
      return rectForIndex(Array.from(item.parentElement.children).indexOf(item))
    }
    return originalGetBoundingClientRect.call(this)
  }
})

afterEach(() => {
  HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
})

function renderList(onReorder: (orderedIds: string[]) => void) {
  return render(
    <SortableList
      getItemLabel={(id) => ITEMS.find((item) => item.id === id)?.name ?? id}
      itemIds={ITEMS.map((item) => item.id)}
      onReorder={onReorder}
    >
      <div>
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
