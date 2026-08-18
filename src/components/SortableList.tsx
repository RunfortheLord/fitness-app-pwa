import {
  DndContext,
  KeyboardCode,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  type AutoScrollOptions,
  type Collision,
  type CollisionDetection,
  type DragEndEvent,
  type Modifier,
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
import { useRef, type CSSProperties, type ReactNode } from 'react'

import {
  HORIZONTAL_AUTO_SCROLL_MAX_STEP_PX,
  HORIZONTAL_COLLISION_HYSTERESIS_PX,
  isHorizontallyScrollable,
  restrictToHorizontalAxis,
  reorderIds,
  type SortableDragState,
} from '@components/sortableDrag'

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
const crossZoneCollisionDetection: CollisionDetection = (args) => {
  const withinPointer = pointerWithin(args)
  return withinPointer.length ? withinPointer : closestCenter(args)
}

const horizontalListAutoScroll: AutoScrollOptions = {
  // dnd-kit uses `acceleration` as the maximum pixels moved per interval.
  // Keep the edge threshold/response unchanged while modestly raising top speed.
  acceleration: HORIZONTAL_AUTO_SCROLL_MAX_STEP_PX,
  canScroll: isHorizontallyScrollable,
  interval: 16,
  threshold: { x: 0.18, y: 0 },
}

function collisionDistance(collision: Collision) {
  const value = collision.data?.value
  return typeof value === 'number' ? value : null
}

/**
 * One drag context. Wrap one or more SortableZones (or use SortableList for
 * the single-list case). onDragEnd receives the active and over ids; the
 * consumer decides whether that means a reorder or a cross-zone move.
 */
export function SortableArea({
  autoScroll,
  children,
  collisionDetection = crossZoneCollisionDetection,
  collisionHysteresisPx = 0,
  getItemLabel,
  modifiers,
  onDragEnd,
}: {
  autoScroll?: boolean | AutoScrollOptions
  children: ReactNode
  collisionDetection?: CollisionDetection
  collisionHysteresisPx?: number
  getItemLabel?: (id: string) => string
  modifiers?: Modifier[]
  onDragEnd: (activeId: string, overId: string | null) => void
}) {
  const lastCollisionId = useRef<UniqueIdentifier | null>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: {
        start: [KeyboardCode.Space],
        cancel: [KeyboardCode.Esc],
        end: [KeyboardCode.Space, KeyboardCode.Tab],
      },
    }),
  )

  const label = (id: UniqueIdentifier) =>
    getItemLabel?.(String(id)) ?? String(id)

  const detectCollisions: CollisionDetection = (args) => {
    const collisions = collisionDetection(args)
    const best = collisions[0]
    if (!best) {
      lastCollisionId.current = null
      return collisions
    }

    const previous = collisions.find(
      (collision) => collision.id === lastCollisionId.current,
    )
    const bestDistance = collisionDistance(best)
    const previousDistance = previous ? collisionDistance(previous) : null
    if (
      collisionHysteresisPx > 0 &&
      previous &&
      bestDistance !== null &&
      previousDistance !== null &&
      previousDistance <= bestDistance + collisionHysteresisPx
    ) {
      return [
        previous,
        ...collisions.filter((collision) => collision.id !== previous.id),
      ]
    }

    lastCollisionId.current = best.id
    return collisions
  }

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
    lastCollisionId.current = null
    onDragEnd(String(active.id), over ? String(over.id) : null)
  }

  return (
    <DndContext
      accessibility={{ announcements }}
      autoScroll={autoScroll}
      collisionDetection={detectCollisions}
      modifiers={modifiers}
      onDragCancel={() => {
        lastCollisionId.current = null
      }}
      onDragEnd={handleDragEnd}
      onDragStart={() => {
        lastCollisionId.current = null
        vibrate()
      }}
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
      autoScroll={
        direction === 'horizontal' ? horizontalListAutoScroll : undefined
      }
      collisionDetection={closestCenter}
      collisionHysteresisPx={
        direction === 'horizontal' ? HORIZONTAL_COLLISION_HYSTERESIS_PX : 0
      }
      getItemLabel={getItemLabel}
      modifiers={
        direction === 'horizontal' ? [restrictToHorizontalAxis] : undefined
      }
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
  disabled = false,
  id,
}: {
  children: (drag: SortableDragState) => ReactNode
  className?: string
  disabled?: boolean
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
  } = useSortable({ disabled, id })
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
