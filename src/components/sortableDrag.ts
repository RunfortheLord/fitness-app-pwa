import type { DraggableAttributes } from '@dnd-kit/core'
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities'

export type SortableDragState = {
  attributes: DraggableAttributes
  isDragging: boolean
  listeners: SyntheticListenerMap | undefined
  setActivatorNodeRef: (element: HTMLElement | null) => void
}

/** New id order after dropping activeId onto overId, or null if not a reorder. */
export function reorderIds(
  ids: string[],
  activeId: string,
  overId: string,
): string[] | null {
  const fromIndex = ids.indexOf(activeId)
  const toIndex = ids.indexOf(overId)
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return null
  }
  const next = [...ids]
  const [id] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, id)
  return next
}

/**
 * Activator props for items that must stay keyboard-clickable (for example a
 * tab that both selects on Enter and drags on touch). Strips the keyboard
 * drag listener; callers keep a separate accessible reorder path.
 */
export function pointerActivatorProps({
  listeners,
}: SortableDragState): SyntheticListenerMap {
  const pointerListeners: SyntheticListenerMap = { ...(listeners ?? {}) }
  delete pointerListeners.onKeyDown
  return pointerListeners
}
