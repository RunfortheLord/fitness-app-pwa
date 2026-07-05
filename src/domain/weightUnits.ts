import type { WeightUnit } from '@shared-types/app'

/**
 * Weight handling is canonical-pounds: every weight persisted in the database
 * (bodyweight entries, set metric values, prescription targets, increments) is
 * stored in pounds. The user's `weightUnit` preference only changes how those
 * stored pounds are displayed and how freshly entered values are interpreted.
 * Switching units therefore re-renders existing history in the chosen unit with
 * no data migration — which is exactly the "history adjusts accordingly"
 * behavior testers asked for, and it never mutates frozen workout history.
 */

/** Exact pounds → kilograms factor (1 lb = 0.45359237 kg). */
export const KG_PER_LB = 0.45359237

export type WeightDisplayKind = 'lifting' | 'bodyweight'

export const WEIGHT_UNIT_OPTIONS: ReadonlyArray<{
  value: WeightUnit
  label: string
}> = [
  { value: 'lb', label: 'Pounds (lb)' },
  { value: 'kg', label: 'Kilograms (kg)' },
]

/** Short suffix shown next to a number, e.g. `185 lb` / `84 kg`. */
export function weightUnitSuffix(unit: WeightUnit): 'lb' | 'kg' {
  return unit === 'kg' ? 'kg' : 'lb'
}

/** Full human label used in settings, e.g. `Kilograms (kg)`. */
export function weightUnitName(unit: WeightUnit): string {
  return unit === 'kg' ? 'Kilograms (kg)' : 'Pounds (lb)'
}

/** Raw, unrounded conversion of a canonical-pounds value into `unit`. */
export function convertFromLb(valueLb: number, unit: WeightUnit): number {
  return unit === 'kg' ? valueLb * KG_PER_LB : valueLb
}

/** Convert a value entered in `unit` back to canonical pounds (unrounded). */
export function convertToLb(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value / KG_PER_LB : value
}

function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/** Render a number without a trailing `.0` and without floating-point noise. */
function trimNumber(value: number): string {
  // Normalize -0 and tiny float errors before stringifying.
  const normalized = roundTo(value, 4) + 0
  return String(normalized)
}

/**
 * The display number for a canonical-pounds value in the user's unit.
 * Kilogram lifting weights snap to gym-friendly 0.5 kg; kilogram bodyweight
 * keeps one decimal; pounds are shown as stored (only trimmed of float noise),
 * preserving any micro-plate precision a pounds user already logged.
 */
export function weightDisplayNumber(
  valueLb: number,
  unit: WeightUnit,
  kind: WeightDisplayKind = 'lifting',
): string {
  if (unit !== 'kg') {
    return trimNumber(roundTo(valueLb, 2))
  }
  const converted = valueLb * KG_PER_LB
  return trimNumber(
    kind === 'bodyweight' ? roundTo(converted, 1) : roundToHalf(converted),
  )
}

/** A canonical-pounds value formatted with its unit suffix, e.g. `84 kg`. */
export function formatWeight(
  valueLb: number,
  unit: WeightUnit,
  kind: WeightDisplayKind = 'lifting',
): string {
  return `${weightDisplayNumber(valueLb, unit, kind)} ${weightUnitSuffix(unit)}`
}

/**
 * The numeric value to seed an editable input with for a canonical-pounds
 * weight. Matches {@link weightDisplayNumber} so the field shows a clean,
 * already-rounded number the user can adjust.
 */
export function weightInputValue(
  valueLb: number | null | undefined,
  unit: WeightUnit,
  kind: WeightDisplayKind = 'lifting',
): string {
  if (typeof valueLb !== 'number' || !Number.isFinite(valueLb)) {
    return ''
  }
  return weightDisplayNumber(valueLb, unit, kind)
}

/** Convert a number the user typed in `unit` into a canonical-pounds value. */
export function weightInputToLb(value: number, unit: WeightUnit): number {
  return convertToLb(value, unit)
}
