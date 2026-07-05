import type { DraggableAttributes } from '@dnd-kit/core'
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities'

export type SortableDragState = {
  attributes: DraggableAttributes
  isDragging: boolean
  listeners: SyntheticListenerMap | undefined
  setActivatorNodeRef: (element: HTMLElement | null) => void
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
