import { handleFoodSearch } from '../../src/server/foodProviderApi.js'

declare const process: { env: Record<string, string | undefined> }

type VercelRequest = {
  method?: string
  query: Record<string, string | string[] | undefined>
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

  if (req.method !== 'GET') {
    res.status(405).json({
      ok: false,
      error: { code: 'invalid_request', message: 'Method not allowed.' },
    })
    return
  }

  const result = await handleFoodSearch(
    {
      query: readQueryValue(req.query.q) ?? '',
      provider: readQueryValue(req.query.provider) as never,
      page: readInteger(req.query.page),
      pageSize: readInteger(req.query.pageSize),
      allowFallback: readQueryValue(req.query.allowFallback) === 'true',
    },
    { usdaApiKey: process.env.USDA_FDC_API_KEY },
  )

  if (result.ok) {
    res.status(200).json(result)
    return
  }

  const errorResult = result as ProviderErrorResponse
  res.status(statusForError(errorResult.error.code)).json(errorResult)
}

function readQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function readInteger(value: string | string[] | undefined) {
  const text = readQueryValue(value)
  if (!text) {
    return undefined
  }
  const parsed = Number(text)
  return Number.isInteger(parsed) ? parsed : Number.NaN
}

function statusForError(code: string) {
  switch (code) {
    case 'invalid_request':
    case 'query_too_short':
      return 400
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
