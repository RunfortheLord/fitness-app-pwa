/// <reference types="node" />
import { handleFoodSearch } from '../../src/server/foodProviderApi.js'

type VercelRequest = {
  method?: string
  body?: unknown
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

  const body = readBody(req.body)
  const result = await handleFoodSearch(
    {
      query: readString(body.query),
      provider: readString(body.provider) as never,
      page: readInteger(body.page),
      pageSize: readInteger(body.pageSize),
      allowFallback: body.allowFallback === true,
      language: readString(body.language) as never,
    },
    { usdaApiKey: readApiKey(req) },
  )

  if (result.ok) {
    res.status(200).json(result)
    return
  }

  const errorResult = result as ProviderErrorResponse
  res.status(statusForError(errorResult.error.code)).json(errorResult)
}

function readBody(body: unknown): Record<string, unknown> {
  return typeof body === 'object' && body !== null
    ? (body as Record<string, unknown>)
    : {}
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function readInteger(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number.NaN
  return Number.isInteger(parsed) ? parsed : undefined
}

function readApiKey(req: VercelRequest) {
  const value = req.headers?.['x-usda-fdc-api-key']
  const headerKey = Array.isArray(value) ? value[0] : value
  // Prefer a user-supplied key; otherwise fall back to the server-configured
  // USDA key so users do not have to enter their own. The server env var is
  // never bundled into the client output.
  return headerKey && headerKey.trim()
    ? headerKey
    : process.env.USDA_FDC_API_KEY
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
