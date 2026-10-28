import type { SupabaseClient } from '@supabase/supabase-js'

import {
  isProviderTokenType,
  readEncryptedProviderToken,
  type ProviderCredentialGateway,
} from './providerCredentials.js'

export function createSupabaseProviderCredentialGateway(
  client: SupabaseClient,
): ProviderCredentialGateway {
  return {
    async read(userId, provider) {
      const { data, error } = await client
        .from('oauth_provider_tokens')
        .select('encrypted_token, token_type')
        .eq('user_id', userId)
        .eq('provider', provider)
        .maybeSingle()
      if (error) {
        return { status: 'unavailable' }
      }
      if (!data) {
        return { status: 'missing' }
      }
      const encryptedToken = readEncryptedProviderToken(data.encrypted_token)
      if (!encryptedToken || !isProviderTokenType(data.token_type)) {
        return { status: 'unavailable' }
      }
      return {
        credential: { encryptedToken, tokenType: data.token_type },
        status: 'found',
      }
    },

    async save({ encryptedToken, provider, tokenType, userId }) {
      const { error } = await client.from('oauth_provider_tokens').upsert(
        {
          encrypted_token: encryptedToken,
          provider,
          token_type: tokenType,
          updated_at: new Date().toISOString(),
          user_id: userId,
        },
        { onConflict: 'user_id,provider' },
      )
      return !error
    },
  }
}
