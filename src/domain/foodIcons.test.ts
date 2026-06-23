import { describe, expect, it } from 'vitest'

import { foodIconKey } from './foodIcons'

describe('foodIconKey', () => {
  it('maps common foods to category icons', () => {
    expect(foodIconKey('Chicken breast, cooked')).toBe('poultry')
    expect(foodIconKey('Ground beef')).toBe('beef')
    expect(foodIconKey('White rice')).toBe('grain')
    expect(foodIconKey('Banana, raw')).toBe('banana')
    expect(foodIconKey('Large egg')).toBe('egg')
    expect(foodIconKey('Cheddar cheese')).toBe('dairy')
    expect(foodIconKey('Protein bar', 'Branded')).toBe('bar')
  })

  it('prefers prepared dishes over their ingredients', () => {
    expect(foodIconKey('Chicken noodle soup')).toBe('soup')
    expect(foodIconKey('Turkey sandwich')).toBe('sandwich')
    expect(foodIconKey('Chicken Caesar salad')).toBe('salad')
    expect(foodIconKey('Pepperoni pizza')).toBe('pizza')
  })

  it('falls back to a default icon for unknown or empty foods', () => {
    expect(foodIconKey('Mystery goop')).toBe('default')
    expect(foodIconKey('')).toBe('default')
  })

  it('does not misfire on substrings such as graham vs ham', () => {
    // "graham" must not match the pork "ham" keyword; "crackers" -> popcorn.
    expect(foodIconKey('Graham crackers')).toBe('popcorn')
  })
})
