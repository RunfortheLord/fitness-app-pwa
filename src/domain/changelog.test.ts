import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  CHANGELOG,
  LATEST_CHANGELOG_ID,
  getLastSeenChangelogId,
  hasUnseenChangelog,
  markChangelogSeen,
} from './changelog'

describe('changelog', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })
  afterEach(() => {
    window.localStorage.clear()
  })

  it('has at least one entry with unique ids and the latest first', () => {
    expect(CHANGELOG.length).toBeGreaterThan(0)
    const ids = CHANGELOG.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(LATEST_CHANGELOG_ID).toBe(CHANGELOG[0].id)
    expect(CHANGELOG[0].items.length).toBeGreaterThan(0)
  })

  it('treats the latest entry as unseen until marked', () => {
    expect(getLastSeenChangelogId()).toBeNull()
    expect(hasUnseenChangelog()).toBe(true)

    expect(markChangelogSeen()).toBe(true)

    expect(getLastSeenChangelogId()).toBe(LATEST_CHANGELOG_ID)
    expect(hasUnseenChangelog()).toBe(false)
  })

  it('shows again when a newer entry id has not been seen', () => {
    markChangelogSeen('older-entry-id')
    expect(hasUnseenChangelog()).toBe(true)
  })
})
