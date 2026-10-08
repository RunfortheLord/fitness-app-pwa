# Sign in with Apple Account-Deletion Decision

Date reviewed: October 8, 2026

## Release behavior

Vigorune uses Supabase OAuth with PKCE. Supabase returns the Apple provider
credential to the client that completes the exchange but intentionally does not
retain it. Vigorune now immediately sends that credential, together with the
current Supabase access token, to the trusted `/api/auth/provider-credential`
route. The route verifies the Supabase user and linked provider, encrypts the
provider credential with AES-256-GCM, and stores only the encrypted envelope in
the server-only `oauth_provider_tokens` table. The encryption key and Apple
private key never enter a client build.

Permanent account deletion performs these steps in order:

1. verify the Supabase bearer token and apply the distributed rate limit;
2. load and decrypt the retained Apple credential;
3. generate a short-lived ES256 Apple client-secret JWT on the server;
4. call Apple's `/auth/revoke` endpoint;
5. only after successful revocation, delete the Supabase Auth user and
   cascading app-controlled cloud rows; and
6. clear the local Supabase session while retaining device-local fitness data.

A timeout, provider error, invalid encrypted envelope, or missing server
configuration fails closed. The API does not delete the Vigorune account or
claim success. An older account that predates credential capture may have no
stored provider credential; after deleting app-controlled data, the UI presents
Apple's manual authorization-removal link as a recovery path. It is not the
normal release behavior.

Google credentials use the same authenticated encrypted store and are revoked
through Google's OAuth revocation endpoint before deletion. An
`invalid_token` response is treated as already cleaned up; malformed requests
and provider/network failures remain failures.

## Production requirements

Apply `db/supabase/schema.sql`, then configure these server-only values on the
stable Vercel project:

- `OAUTH_TOKEN_ENCRYPTION_KEY`: 32 random bytes encoded with base64url;
- `APPLE_CLIENT_ID`: the client identifier that issued the retained token;
- `APPLE_TEAM_ID`;
- `APPLE_KEY_ID`; and
- `APPLE_PRIVATE_KEY`: the complete `.p8` private key.

Also configure `SUPABASE_URL`, a Supabase secret/service-role key, and the Redis
rate-limiter values described in `STORE_RELEASE_SETUP.md`. None of these values
may use a `VITE_` prefix. `/api/health` must report both
`providerRevocation: true` and `accountDeletion: true`.

Before submission, test Apple sign-in and deletion with a disposable identity
on the release-signed TestFlight build. Confirm the authorization disappears
from the Apple Account, the Supabase Auth user and cloud rows are gone, local
records remain, a retryable provider failure does not delete the account, and a
subsequent sign-in works.

## Sources

- Apple, [TN3194: Handling account deletions and revoking tokens for Sign in
  with Apple](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple)
- Apple, [Token revocation](https://developer.apple.com/documentation/signinwithapplerestapi/revoke-tokens)
- Apple, [Offering account deletion in your
  app](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- Supabase, [Social Login: provider
  tokens](https://supabase.com/docs/guides/auth/social-login#provider-tokens)
- Google, [OAuth 2.0 Policies](https://developers.google.com/identity/protocols/oauth2/policies)
- Google, [OpenID Connect revocation endpoint](https://developers.google.com/identity/openid-connect/reference#revocation-endpoint)
