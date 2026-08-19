import { describe, expect, it } from 'vitest'

import {
  convertFromLb,
  convertToLb,
  formatWeight,
  KG_PER_LB,
  weightDisplayNumber,
  weightInputToLb,
  weightInputValue,
  weightUnitName,
  weightUnitSuffix,
} from './weightUnits'

describe('weightUnits', () => {
  it('exposes suffixes and names for both units', () => {
    expect(weightUnitSuffix('lb')).toBe('lb')
    expect(weightUnitSuffix('kg')).toBe('kg')
    expect(weightUnitName('lb')).toBe('Pounds (lb)')
    expect(weightUnitName('kg')).toBe('Kilograms (kg)')
  })

  it('converts pounds to kilograms and back losslessly', () => {
    expect(convertFromLb(100, 'lb')).toBe(100)
    expect(convertFromLb(100, 'kg')).toBeCloseTo(45.359237, 6)
    expect(convertToLb(45.359237, 'kg')).toBeCloseTo(100, 6)
    expect(convertToLb(50, 'lb')).toBe(50)
    expect(KG_PER_LB).toBeCloseTo(0.45359237, 8)
  })

  it('shows pounds unchanged apart from trimming float noise', () => {
    expect(weightDisplayNumber(120, 'lb')).toBe('120')
    expect(weightDisplayNumber(187.5, 'lb', 'lifting')).toBe('187.5')
    expect(weightDisplayNumber(188.4, 'lb', 'bodyweight')).toBe('188.4')
    // A weight that originated from a kilogram entry trims to clean precision.
    expect(weightDisplayNumber(132.2773573, 'lb')).toBe('132.28')
  })

  it('snaps kilogram lifting weights to the nearest 0.5 kg', () => {
    // 100 lb = 45.359 kg -> 45.5; 132.277 lb = 60.0 kg -> 60.
    expect(weightDisplayNumber(100, 'kg', 'lifting')).toBe('45.5')
    expect(weightDisplayNumber(132.2773573, 'kg', 'lifting')).toBe('60')
    expect(weightDisplayNumber(225, 'kg', 'lifting')).toBe('102')
  })

  it('keeps one decimal for kilogram bodyweight', () => {
    // 188.4 lb = 85.458 kg -> 85.5.
    expect(weightDisplayNumber(188.4, 'kg', 'bodyweight')).toBe('85.5')
  })

  it('formats values with the unit suffix', () => {
    expect(formatWeight(225, 'lb')).toBe('225 lb')
    expect(formatWeight(132.2773573, 'kg', 'lifting')).toBe('60 kg')
    expect(formatWeight(188.4, 'kg', 'bodyweight')).toBe('85.5 kg')
  })

  it('seeds inputs with the rounded display number and rejects non-numbers', () => {
    expect(weightInputValue(225, 'lb')).toBe('225')
    expect(weightInputValue(132.2773573, 'kg', 'lifting')).toBe('60')
    expect(weightInputValue(null, 'kg')).toBe('')
    expect(weightInputValue(undefined, 'lb')).toBe('')
    expect(weightInputValue(Number.NaN, 'kg')).toBe('')
  })

  it('parses typed values back into canonical pounds', () => {
    expect(weightInputToLb(225, 'lb')).toBe(225)
    expect(weightInputToLb(60, 'kg')).toBeCloseTo(132.277, 3)
  })
})
