import { handleFoodSearch } from '../../src/server/foodProviderApi.js'

type VercelRequest = {
  method?: string
  headers?: Record<string, string | string[] | undefined>
}

type VercelResponse = {
  status(code: number): VercelResponse
  setHeader(name: string, value: string): void
  json(value: unknown): void
}

type ProviderErrorResponse = {
  ok: false
  error: { code: string; message: string }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.status(405).json({
      ok: false,
      error: { code: 'invalid_request', message: 'Method not allowed.' },
    })
    return
  }

  const result = await handleFoodSearch(
    { query: 'rice', provider: 'usda', page: 1, pageSize: 1 },
    { usdaApiKey: readApiKey(req) },
  )

  if (result.ok) {
    res.status(200).json({ ok: true, data: { status: 'connected' } })
    return
  }

  const errorResult = result as ProviderErrorResponse
  res.status(statusForError(errorResult.error.code)).json(errorResult)
}

function readApiKey(req: VercelRequest) {
  const value = req.headers?.['x-usda-fdc-api-key']
  return Array.isArray(value) ? value[0] : value
}

function statusForError(code: string) {
  switch (code) {
    case 'invalid_request':
    case 'query_too_short':
    case 'missing_api_key':
      return 400
    case 'invalid_api_key':
      return 401
    case 'provider_rate_limited':
      return 429
    case 'provider_timeout':
      return 504
    case 'provider_unavailable':
    case 'offline':
      return 503
    case 'no_acceptable_results':
      return 404
    default:
      return 500
  }
}
