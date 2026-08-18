/// <reference types="node" />
import { readIntegrationHealth } from '../src/server/integrationHealth.js'
import { createRequestObserver } from '../src/server/serverHttp.js'

type VercelRequest = { method?: string }

type VercelResponse = {
  status(code: number): VercelResponse
  setHeader(name: string, value: string): void
  json(value: unknown): void
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  const observer = createRequestObserver({
    method: req.method,
    route: '/api/health',
  })
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Request-ID', observer.requestId)

  if (req.method !== 'GET') {
    observer.finish({ outcome: 'method_not_allowed', status: 405 })
    res.status(405).json({ ok: false })
    return
  }

  const configured = readIntegrationHealth(process.env)
  const ready =
    configured.accountDeletion &&
    configured.authRelay &&
    configured.cloudBackup &&
    configured.distributedAiProtection &&
    configured.foodSearch &&
    configured.mealAnalysis &&
    configured.supportContact
  observer.finish({ outcome: ready ? 'ready' : 'degraded', status: 200 })
  res.status(200).json({ configured, ok: true, ready })
}
