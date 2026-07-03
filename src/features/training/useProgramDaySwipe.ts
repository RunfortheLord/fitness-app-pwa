import { useRef, type PointerEvent } from 'react'

export function useProgramDaySwipe({
  onNext,
  onPrevious,
}: {
  onNext: () => void
  onPrevious: () => void
}) {
  const pointerStart = useRef<{ x: number; y: number } | null>(null)

  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (isInteractiveElement(event.target)) {
        return
      }
      pointerStart.current = { x: event.clientX, y: event.clientY }
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      if (!pointerStart.current) {
        return
      }
      const deltaX = event.clientX - pointerStart.current.x
      const deltaY = event.clientY - pointerStart.current.y
      pointerStart.current = null
      if (Math.abs(deltaX) < 55 || Math.abs(deltaY) > 45) {
        return
      }
      if (deltaX < 0) {
        onNext()
      } else {
        onPrevious()
      }
    },
    onPointerCancel() {
      pointerStart.current = null
    },
  }
}

function isInteractiveElement(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    Boolean(
      target.closest('button, input, select, textarea, a, [role="button"]'),
    )
  )
}
