import { Capacitor } from '@capacitor/core'
import type { Session } from '@supabase/supabase-js'

import type {
  OAuthProvider,
  ProviderTokenType,
} from '../server/providerCredentials'

const capturedProviderCredentials = new Set<string>()

export const providerCredentialService = {
  async captureFromSession(session: Session) {
    const provider = currentOAuthProvider(session)
    if (!provider) {
      return false
    }
    const credential = providerCredentialFromSession(session)
    if (!credential) {
      return false
    }
    const captureKey = [provider, credential.tokenType, credential.token].join(
      '\u0000',
    )
    if (capturedProviderCredentials.has(captureKey)) {
      return true
    }
    const response = await fetch(providerCredentialEndpoint(), {
      body: JSON.stringify({ provider, ...credential }),
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })
    if (!response.ok) {
      throw new Error(
        `${provider === 'apple' ? 'Apple' : 'Google'} sign-in could not be secured for account deletion. Try again.`,
      )
    }
    capturedProviderCredentials.add(captureKey)
    return true
  },
}

function currentOAuthProvider(session: Session): OAuthProvider | undefined {
  const provider = session.user?.app_metadata?.provider
  return provider === 'apple' || provider === 'google' ? provider : undefined
}

function providerCredentialFromSession(
  session: Session,
): { token: string; tokenType: ProviderTokenType } | undefined {
  const refreshToken = session.provider_refresh_token?.trim()
  if (refreshToken) {
    return { token: refreshToken, tokenType: 'refresh_token' }
  }
  const accessToken = session.provider_token?.trim()
  return accessToken
    ? { token: accessToken, tokenType: 'access_token' }
    : undefined
}

function providerCredentialEndpoint() {
  const path = '/api/auth/provider-credential'
  if (!Capacitor.isNativePlatform()) {
    return path
  }
  const configuredOrigin = import.meta.env.VITE_PUBLIC_APP_ORIGIN?.trim()
  return configuredOrigin
    ? `${configuredOrigin.replace(/\/+$/, '')}${path}`
    : path
}
