import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

import { reorderIds, type SortableDragState } from '@components/sortableDrag'

function vibrate() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(10)
  }
}

/**
 * Prefer whatever the pointer is physically inside (lets items drop onto
 * targets outside their own list, like day tabs); fall back to proximity for
 * keyboard drags and pointers between droppables.
 */
const collisionDetection: CollisionDetection = (args) => {
  const withinPointer = pointerWithin(args)
  return withinPointer.length ? withinPointer : closestCenter(args)
}

/**
 * One drag context. Wrap one or more SortableZones (or use SortableList for
 * the single-list case). onDragEnd receives the active and over ids; the
 * consumer decides whether that means a reorder or a cross-zone move.
 */
export function SortableArea({
  children,
  getItemLabel,
  onDragEnd,
}: {
  children: ReactNode
  getItemLabel?: (id: string) => string
  onDragEnd: (activeId: string, overId: string | null) => void
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

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${label(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${label(active.id)} is over ${label(over.id)}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${label(active.id)} dropped on ${label(over.id)}.`
        : `${label(active.id)} dropped.`,
    onDragCancel: ({ active }) =>
      `Reordering cancelled. ${label(active.id)} returned to its position.`,
  }

  function handleDragEnd(event: DragEndEvent) {
    vibrate()
    const { active, over } = event
    onDragEnd(String(active.id), over ? String(over.id) : null)
  }

  return (
    <DndContext
      accessibility={{ announcements }}
      collisionDetection={collisionDetection}
      onDragEnd={handleDragEnd}
      onDragStart={vibrate}
      sensors={sensors}
    >
      {children}
    </DndContext>
  )
}

export function SortableZone({
  children,
  direction = 'vertical',
  itemIds,
}: {
  children: ReactNode
  direction?: 'horizontal' | 'vertical'
  itemIds: string[]
}) {
  return (
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
  )
}

/** Single sortable list: one SortableArea around one SortableZone. */
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
  return (
    <SortableArea
      getItemLabel={getItemLabel}
      onDragEnd={(activeId, overId) => {
        if (!overId) {
          return
        }
        const next = reorderIds(itemIds, activeId, overId)
        if (next) {
          onReorder(next)
        }
      }}
    >
      <SortableZone direction={direction} itemIds={itemIds}>
        {children}
      </SortableZone>
    </SortableArea>
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
    isOver,
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
  const stateClasses = `${isDragging ? ' sortable-item-dragging' : ''}${
    isOver && !isDragging ? ' sortable-item-over' : ''
  }`
  return (
    <div
      className={`sortable-item${stateClasses} ${className}`.trim()}
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
