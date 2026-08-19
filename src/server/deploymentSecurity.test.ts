import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

type HeaderEntry = { key: string; value: string }
type HeaderRule = { headers: HeaderEntry[]; source: string }

describe('deployment security headers', () => {
  it('hardens every deployed route without disabling required device APIs', () => {
    const config = JSON.parse(
      readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf8'),
    ) as { headers: HeaderRule[] }
    const globalRule = config.headers.find((rule) => rule.source === '/(.*)')
    expect(globalRule).toBeDefined()
    const headers = new Map(
      globalRule?.headers.map(({ key, value }) => [key.toLowerCase(), value]),
    )

    expect(headers.get('content-security-policy')).toContain(
      "default-src 'self'",
    )
    expect(headers.get('content-security-policy')).toContain(
      "frame-ancestors 'none'",
    )
    expect(headers.get('content-security-policy')).toContain(
      'https://*.supabase.co',
    )
    expect(headers.get('permissions-policy')).toContain('camera=(self)')
    expect(headers.get('permissions-policy')).toContain('geolocation=(self)')
    expect(headers.get('permissions-policy')).toContain('microphone=()')
    expect(headers.get('referrer-policy')).toBe(
      'strict-origin-when-cross-origin',
    )
    expect(headers.get('x-content-type-options')).toBe('nosniff')
    expect(headers.get('x-frame-options')).toBe('DENY')
  })
})
