import type { User } from '@supabase/supabase-js'

export type OAuthProvider = 'apple' | 'google'
export type ProviderTokenType = 'access_token' | 'refresh_token'

export type EncryptedProviderToken = {
  ciphertext: string
  iv: string
  version: 1
}

export type StoredProviderCredential = {
  encryptedToken: EncryptedProviderToken
  tokenType: ProviderTokenType
}

export type ProviderCredentialReadResult =
  | { credential: StoredProviderCredential; status: 'found' }
  | { status: 'missing' }
  | { status: 'unavailable' }

export type ProviderCredentialGateway = {
  read(
    userId: string,
    provider: OAuthProvider,
  ): Promise<ProviderCredentialReadResult>
  save(input: {
    encryptedToken: EncryptedProviderToken
    provider: OAuthProvider
    tokenType: ProviderTokenType
    userId: string
  }): Promise<boolean>
}

export type ProviderRevoker = (input: {
  token: string
  tokenType: ProviderTokenType
}) => Promise<boolean>

export type ProviderRevokers = Partial<Record<OAuthProvider, ProviderRevoker>>

export type ProviderCredentialAuthClient = {
  auth: {
    getUser(accessToken: string): Promise<{
      data: { user: User | null }
      error: { message?: string } | null
    }>
  }
}

export type ProviderCredentialRegistrationResult =
  | { code: 'stored'; status: 204 }
  | { code: 'invalid_request'; status: 400 }
  | { code: 'unauthorized'; status: 401 }
  | { code: 'service_unavailable'; status: 503 }

export type AppleRevocationConfig = {
  clientId: string
  keyId: string
  privateKey: string
  teamId: string
}

const PROVIDER_TOKEN_MIN_LENGTH = 20
const PROVIDER_TOKEN_MAX_LENGTH = 16_384
const AES_GCM_IV_BYTES = 12
const APPLE_CLIENT_SECRET_LIFETIME_SECONDS = 5 * 60
const PROVIDER_CREDENTIAL_AAD_PREFIX = 'vigorune:oauth-provider-token:v1'
const PEM_PRIVATE_KEY_BEGIN = ['-----BEGIN ', 'PRIVATE KEY-----'].join('')
const PEM_PRIVATE_KEY_END = ['-----END ', 'PRIVATE KEY-----'].join('')

export async function registerAuthenticatedProviderCredential({
  accessToken,
  authClient,
  encryptionKey,
  gateway,
  provider,
  token,
  tokenType,
}: {
  accessToken: string
  authClient: ProviderCredentialAuthClient
  encryptionKey: string | undefined
  gateway: ProviderCredentialGateway | undefined
  provider: unknown
  token: unknown
  tokenType: unknown
}): Promise<ProviderCredentialRegistrationResult> {
  if (
    !isProvider(provider) ||
    !isProviderTokenType(tokenType) ||
    !isProviderToken(token)
  ) {
    return { code: 'invalid_request', status: 400 }
  }
  if (!isProviderToken(accessToken)) {
    return { code: 'unauthorized', status: 401 }
  }
  const { data, error } = await authClient.auth.getUser(accessToken)
  if (error || !data.user || !userHasProvider(data.user, provider)) {
    return { code: 'unauthorized', status: 401 }
  }
  if (!gateway || !encryptionKey) {
    return { code: 'service_unavailable', status: 503 }
  }
  try {
    const encryptedToken = await encryptProviderToken({
      encryptionKey,
      provider,
      token,
      tokenType,
      userId: data.user.id,
    })
    const stored = await gateway.save({
      encryptedToken,
      provider,
      tokenType,
      userId: data.user.id,
    })
    return stored
      ? { code: 'stored', status: 204 }
      : { code: 'service_unavailable', status: 503 }
  } catch {
    return { code: 'service_unavailable', status: 503 }
  }
}

export async function encryptProviderToken({
  encryptionKey,
  provider,
  token,
  tokenType,
  userId,
}: {
  encryptionKey: string
  provider: OAuthProvider
  token: string
  tokenType: ProviderTokenType
  userId: string
}): Promise<EncryptedProviderToken> {
  const key = await importEncryptionKey(encryptionKey, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES))
  const ciphertext = await crypto.subtle.encrypt(
    {
      additionalData: credentialAdditionalData(userId, provider, tokenType),
      iv,
      name: 'AES-GCM',
    },
    key,
    new TextEncoder().encode(token),
  )
  return {
    ciphertext: encodeBase64Url(new Uint8Array(ciphertext)),
    iv: encodeBase64Url(iv),
    version: 1,
  }
}

export async function decryptProviderToken({
  encryptedToken,
  encryptionKey,
  provider,
  tokenType,
  userId,
}: {
  encryptedToken: EncryptedProviderToken
  encryptionKey: string
  provider: OAuthProvider
  tokenType: ProviderTokenType
  userId: string
}) {
  if (
    encryptedToken.version !== 1 ||
    !isBase64Url(encryptedToken.iv) ||
    !isBase64Url(encryptedToken.ciphertext)
  ) {
    throw new Error('Invalid encrypted provider credential.')
  }
  const iv = decodeBase64Url(encryptedToken.iv)
  if (iv.byteLength !== AES_GCM_IV_BYTES) {
    throw new Error('Invalid encrypted provider credential.')
  }
  const key = await importEncryptionKey(encryptionKey, ['decrypt'])
  const plaintext = await crypto.subtle.decrypt(
    {
      additionalData: credentialAdditionalData(userId, provider, tokenType),
      iv,
      name: 'AES-GCM',
    },
    key,
    decodeBase64Url(encryptedToken.ciphertext),
  )
  const token = new TextDecoder().decode(plaintext)
  if (!isProviderToken(token)) {
    throw new Error('Invalid decrypted provider credential.')
  }
  return token
}

export function readAppleRevocationConfig(
  environment: Record<string, string | undefined>,
): AppleRevocationConfig | undefined {
  const clientId = environment.APPLE_CLIENT_ID?.trim()
  const keyId = environment.APPLE_KEY_ID?.trim()
  const privateKey = environment.APPLE_PRIVATE_KEY?.trim().replaceAll(
    '\\n',
    '\n',
  )
  const teamId = environment.APPLE_TEAM_ID?.trim()
  if (
    !clientId ||
    !/^[A-Za-z0-9.-]{1,255}$/u.test(clientId) ||
    !keyId ||
    !/^[A-Z0-9]{10}$/u.test(keyId) ||
    !teamId ||
    !/^[A-Z0-9]{10}$/u.test(teamId) ||
    !privateKey ||
    !privateKey.includes(PEM_PRIVATE_KEY_BEGIN) ||
    !privateKey.includes(PEM_PRIVATE_KEY_END)
  ) {
    return undefined
  }
  return { clientId, keyId, privateKey, teamId }
}

export function isProviderCredentialEncryptionKey(value: unknown) {
  if (typeof value !== 'string') {
    return false
  }
  try {
    return decodeBase64Url(value.trim()).byteLength === 32
  } catch {
    return false
  }
}

export function createAppleProviderRevoker({
  config,
  fetchImpl = fetch,
  now = () => Date.now(),
  timeoutMs = 5_000,
}: {
  config: AppleRevocationConfig
  fetchImpl?: typeof fetch
  now?: () => number
  timeoutMs?: number
}): ProviderRevoker {
  return async ({ token, tokenType }) => {
    if (!isProviderToken(token) || !isProviderTokenType(tokenType)) {
      return false
    }
    const controller = new AbortController()
    const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs)
    try {
      const clientSecret = await createAppleClientSecret(config, now())
      const body = new URLSearchParams({
        client_id: config.clientId,
        client_secret: clientSecret,
        token,
        token_type_hint: tokenType,
      })
      const response = await fetchImpl(
        'https://appleid.apple.com/auth/revoke',
        {
          body,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          method: 'POST',
          signal: controller.signal,
        },
      )
      return response.status === 200
    } catch {
      return false
    } finally {
      globalThis.clearTimeout(timeoutId)
    }
  }
}

export function createGoogleProviderRevoker({
  fetchImpl = fetch,
  timeoutMs = 5_000,
}: {
  fetchImpl?: typeof fetch
  timeoutMs?: number
} = {}): ProviderRevoker {
  return async ({ token }) => {
    if (!isProviderToken(token)) {
      return false
    }
    const controller = new AbortController()
    const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl('https://oauth2.googleapis.com/revoke', {
        body: new URLSearchParams({ token }),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        method: 'POST',
        signal: controller.signal,
      })
      if (response.status === 200) {
        return true
      }
      if (response.status !== 400) {
        return false
      }
      const payload: unknown = await response.json().catch(() => undefined)
      return isRecord(payload) && payload.error === 'invalid_token'
    } catch {
      return false
    } finally {
      globalThis.clearTimeout(timeoutId)
    }
  }
}

export async function createAppleClientSecret(
  config: AppleRevocationConfig,
  nowMs: number,
) {
  const issuedAt = Math.floor(nowMs / 1_000)
  const header = encodeJson({ alg: 'ES256', kid: config.keyId, typ: 'JWT' })
  const payload = encodeJson({
    aud: 'https://appleid.apple.com',
    exp: issuedAt + APPLE_CLIENT_SECRET_LIFETIME_SECONDS,
    iat: issuedAt,
    iss: config.teamId,
    sub: config.clientId,
  })
  const signingInput = `${header}.${payload}`
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    readPemBody(config.privateKey),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    { hash: 'SHA-256', name: 'ECDSA' },
    privateKey,
    new TextEncoder().encode(signingInput),
  )
  return `${signingInput}.${encodeBase64Url(new Uint8Array(signature))}`
}

export function userHasProvider(user: User, provider: OAuthProvider) {
  const providers = user.app_metadata.providers
  return (
    user.app_metadata.provider === provider ||
    (Array.isArray(providers) && providers.includes(provider)) ||
    user.identities?.some((identity) => identity.provider === provider) === true
  )
}

export function linkedOAuthProviders(user: User): OAuthProvider[] {
  return (['apple', 'google'] as const).filter((provider) =>
    userHasProvider(user, provider),
  )
}

export function isProvider(value: unknown): value is OAuthProvider {
  return value === 'apple' || value === 'google'
}

export function isProviderTokenType(
  value: unknown,
): value is ProviderTokenType {
  return value === 'access_token' || value === 'refresh_token'
}

export function isProviderToken(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= PROVIDER_TOKEN_MIN_LENGTH &&
    value.length <= PROVIDER_TOKEN_MAX_LENGTH &&
    !/\s/u.test(value)
  )
}

export function readEncryptedProviderToken(
  value: unknown,
): EncryptedProviderToken | undefined {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.iv !== 'string' ||
    typeof value.ciphertext !== 'string' ||
    !isBase64Url(value.iv) ||
    !isBase64Url(value.ciphertext)
  ) {
    return undefined
  }
  return { ciphertext: value.ciphertext, iv: value.iv, version: 1 }
}

function credentialAdditionalData(
  userId: string,
  provider: OAuthProvider,
  tokenType: ProviderTokenType,
) {
  return new TextEncoder().encode(
    `${PROVIDER_CREDENTIAL_AAD_PREFIX}:${userId}:${provider}:${tokenType}`,
  )
}

async function importEncryptionKey(
  encryptionKey: string,
  usages: Array<'decrypt' | 'encrypt'>,
) {
  const bytes = decodeBase64Url(encryptionKey.trim())
  if (bytes.byteLength !== 32) {
    throw new Error('Provider credential encryption key must be 32 bytes.')
  }
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, usages)
}

function readPemBody(privateKey: string) {
  const body = privateKey
    .replace(PEM_PRIVATE_KEY_BEGIN, '')
    .replace(PEM_PRIVATE_KEY_END, '')
    .replace(/\s/gu, '')
  if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(body)) {
    throw new Error('Invalid Apple private key.')
  }
  return decodeBase64(body)
}

function encodeJson(value: Record<string, string | number>) {
  return encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)))
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '')
}

function decodeBase64Url(value: string) {
  if (!isBase64Url(value)) {
    throw new Error('Invalid base64url value.')
  }
  return decodeBase64(
    value.replaceAll('-', '+').replaceAll('_', '/') +
      '='.repeat((4 - (value.length % 4)) % 4),
  )
}

function decodeBase64(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function isBase64Url(value: string) {
  return value.length > 0 && /^[A-Za-z0-9_-]+$/u.test(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
