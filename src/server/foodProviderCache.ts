export type CacheEntry<T> = {
  value: T
  expiresAt: number
}

export class TtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>()
  private readonly inFlight = new Map<string, Promise<T>>()
  private readonly maxEntries: number
  private readonly ttlMs: number
  private readonly now: () => number

  constructor(
    maxEntries: number,
    ttlMs: number,
    now: () => number = () => Date.now(),
  ) {
    this.maxEntries = maxEntries
    this.ttlMs = ttlMs
    this.now = now
  }

  get(key: string) {
    const entry = this.entries.get(key)
    if (!entry) {
      return null
    }
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key)
      return null
    }
    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry.value
  }

  set(key: string, value: T) {
    this.entries.set(key, {
      value,
      expiresAt: this.now() + this.ttlMs,
    })
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value
      if (oldestKey === undefined) {
        break
      }
      this.entries.delete(oldestKey)
    }
  }

  async getOrCreate(key: string, create: () => Promise<T>) {
    const cached = this.get(key)
    if (cached !== null) {
      return cached
    }

    const existing = this.inFlight.get(key)
    if (existing) {
      return existing
    }

    const promise = create()
      .then((value) => {
        this.set(key, value)
        return value
      })
      .finally(() => {
        this.inFlight.delete(key)
      })
    this.inFlight.set(key, promise)
    return promise
  }

  get size() {
    return this.entries.size
  }
}
