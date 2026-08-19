import { describe, expect, it } from 'vitest'

import { reorderIds } from '@components/sortableDrag'

describe('reorderIds', () => {
  it('moves the active id to the over position', () => {
    expect(reorderIds(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a'])
    expect(reorderIds(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b'])
  })

  it('returns null when nothing changes or ids are unknown', () => {
    expect(reorderIds(['a', 'b'], 'a', 'a')).toBeNull()
    expect(reorderIds(['a', 'b'], 'x', 'b')).toBeNull()
    expect(reorderIds(['a', 'b'], 'a', 'x')).toBeNull()
  })
})
