import { describe, expect, it } from 'vitest'

import packageJson from '../../package.json'
import vercelConfig from '../../vercel.json'

type VercelHeader = {
  key: string
  value: string
}

type VercelHeaderRule = {
  source: string
  headers: VercelHeader[]
}

type VercelConfig = {
  headers: VercelHeaderRule[]
}

describe('deployment cache headers', () => {
  it('keeps installed PWA update files revalidated', async () => {
    const config = vercelConfig as VercelConfig

    expect(cacheControlFor(config, '/sw.js')).toBe(
      'no-cache, no-store, must-revalidate',
    )
    expect(cacheControlFor(config, '/manifest.webmanifest')).toBe(
      'no-cache, must-revalidate',
    )
    expect(cacheControlFor(config, '/')).toBe('no-cache, must-revalidate')
    expect(cacheControlFor(config, '/((?!api/).*)')).toBe(
      'no-cache, must-revalidate',
    )
  })

  it('keeps developer-stable deployments isolated from stable', () => {
    expect(packageJson.scripts['deploy:dev-stable']).toContain(
      '--project fitness-app-pwa-dev-stable',
    )
    expect(packageJson.scripts['deploy:dev-stable']).toContain(
      'VITE_DEPLOYMENT_CHANNEL=dev-stable',
    )
    expect(packageJson.scripts['deploy:stable']).not.toContain('--project')
  })
})

function cacheControlFor(config: VercelConfig, source: string) {
  return config.headers
    .find((rule) => rule.source === source)
    ?.headers.find((header) => header.key === 'Cache-Control')?.value
}
