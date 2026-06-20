export type ProviderErrorCode =
  | 'invalid_request'
  | 'query_too_short'
  | 'no_acceptable_results'
  | 'offline'
  | 'missing_api_key'
  | 'invalid_api_key'
  | 'provider_timeout'
  | 'provider_unavailable'
  | 'provider_rate_limited'
  | 'server_missing_configuration'
  | 'normalization_failure'
  | 'unexpected_server_error'

export class ProviderError extends Error {
  readonly code: ProviderErrorCode
  readonly status: number

  constructor(
    code: ProviderErrorCode,
    message: string,
    status = statusForCode(code),
  ) {
    super(message)
    this.name = 'ProviderError'
    this.code = code
    this.status = status
  }
}

export function statusForCode(code: ProviderErrorCode) {
  switch (code) {
    case 'invalid_request':
    case 'query_too_short':
    case 'missing_api_key':
      return 400
    case 'invalid_api_key':
      return 401
    case 'server_missing_configuration':
      return 500
    case 'provider_timeout':
      return 504
    case 'provider_rate_limited':
      return 429
    case 'provider_unavailable':
    case 'offline':
      return 503
    case 'no_acceptable_results':
      return 404
    case 'normalization_failure':
    case 'unexpected_server_error':
      return 500
  }
}

export function toProviderError(error: unknown) {
  if (error instanceof ProviderError) {
    return error
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new ProviderError('provider_timeout', 'Provider request timed out.')
  }
  return new ProviderError(
    'unexpected_server_error',
    'The food provider request failed.',
  )
}
