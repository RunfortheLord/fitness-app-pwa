import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

import type { SortableDragState } from '@components/sortableDrag'

function vibrate() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(10)
  }
}

export function SortableList({
  children,
  direction = 'vertical',
  getItemLabel,
  itemIds,
  onReorder,
}: {
  children: ReactNode
  direction?: 'horizontal' | 'vertical'
  getItemLabel?: (id: string) => string
  itemIds: string[]
  onReorder: (orderedIds: string[]) => void
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const label = (id: UniqueIdentifier) =>
    getItemLabel?.(String(id)) ?? String(id)
  const position = (id: UniqueIdentifier) => itemIds.indexOf(String(id)) + 1

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${label(active.id)}, position ${position(active.id)} of ${itemIds.length}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${label(active.id)} is over position ${position(over.id)} of ${itemIds.length}.`
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${label(active.id)} dropped at position ${position(over.id)} of ${itemIds.length}.`
        : `${label(active.id)} dropped.`,
    onDragCancel: ({ active }) =>
      `Reordering cancelled. ${label(active.id)} returned to position ${position(active.id)}.`,
  }

  function handleDragEnd(event: DragEndEvent) {
    vibrate()
    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }
    const fromIndex = itemIds.indexOf(String(active.id))
    const toIndex = itemIds.indexOf(String(over.id))
    if (fromIndex < 0 || toIndex < 0) {
      return
    }
    onReorder(arrayMove(itemIds, fromIndex, toIndex))
  }

  return (
    <DndContext
      accessibility={{ announcements }}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      onDragStart={vibrate}
      sensors={sensors}
    >
      <SortableContext
        items={itemIds}
        strategy={
          direction === 'horizontal'
            ? horizontalListSortingStrategy
            : verticalListSortingStrategy
        }
      >
        {children}
      </SortableContext>
    </DndContext>
  )
}

export function SortableListItem({
  children,
  className = '',
  id,
}: {
  children: (drag: SortableDragState) => ReactNode
  className?: string
  id: string
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <div
      className={`sortable-item ${isDragging ? 'sortable-item-dragging' : ''} ${className}`.trim()}
      ref={setNodeRef}
      style={style}
    >
      {children({ attributes, isDragging, listeners, setActivatorNodeRef })}
    </div>
  )
}

export function SortableDragHandle({
  drag: { attributes, listeners, setActivatorNodeRef },
  label,
}: {
  drag: SortableDragState
  label: string
}) {
  return (
    <button
      aria-label={label}
      className="icon-button drag-handle"
      ref={setActivatorNodeRef}
      type="button"
      {...attributes}
      {...(listeners ?? {})}
    >
      <GripVertical aria-hidden="true" size={18} />
    </button>
  )
}
