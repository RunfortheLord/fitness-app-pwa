/** Height of one wheel row in pixels; shared by the component and scroll math. */
export const WHEEL_ITEM_HEIGHT = 40

/** Number of rows visible in the wheel viewport (center row is the selection). */
export const WHEEL_VISIBLE_ROWS = 5

/** Vertical padding needed so the first and last values can rest at center. */
export function wheelSpacerHeight(): number {
  return ((WHEEL_VISIBLE_ROWS - 1) / 2) * WHEEL_ITEM_HEIGHT
}

/** Clamp an index into the valid range for a list of the given length. */
export function clampWheelIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0
  }
  return Math.min(length - 1, Math.max(0, index))
}

/** The list index whose row is currently centered for a given scroll offset. */
export function indexFromScroll(
  scrollTop: number,
  length: number,
  itemHeight: number = WHEEL_ITEM_HEIGHT,
): number {
  return clampWheelIndex(Math.round(scrollTop / itemHeight), length)
}

/** The scroll offset that centers the row at the given index. */
export function scrollForIndex(
  index: number,
  itemHeight: number = WHEEL_ITEM_HEIGHT,
): number {
  return index * itemHeight
}

/** Inclusive integer range [start, end], e.g. rangeValues(0, 3) → [0,1,2,3]. */
export function rangeValues(start: number, end: number): number[] {
  const values: number[] = []
  for (let value = start; value <= end; value += 1) {
    values.push(value)
  }
  return values
}
