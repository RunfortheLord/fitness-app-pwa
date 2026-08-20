# Sign in with Apple Account-Deletion Decision

Date reviewed: August 20, 2026

## Current release behavior

Vigorune starts Sign in with Apple through Supabase's OAuth redirect flow. The
app receives a Supabase session, not a durable Apple access token, refresh token,
or authorization code that Vigorune can later send to Apple's token-revocation
endpoint. Supabase documents that provider tokens are intentionally not stored
in the project's database and that applications must separately transmit and
store a provider token when they need to use it outside the browser that
completed the flow.

When a signed-in user deletes the Vigorune account, the authenticated server
route deletes the Supabase Auth user and its cascading app-controlled cloud
rows, and the app clears the local Supabase session. If the deleted identity
included Apple, the app then presents Apple's manual Sign in with Apple removal
steps. Device-local fitness data remains until the user separately clears it.

## Decision for the pre-LLC release candidate

Do not add Apple private keys, client-secret generation, or provider-token
storage to the current release candidate. The existing OAuth exchange did not
retain the Apple credential required for programmatic revocation, and adding a
new credential store before the Apple developer entity, Team ID, Services ID,
and production secrets are final would create a larger authentication and
security migration.

Apple's TN3194 says that when a developer does not have the Apple refresh token,
access token, or authorization code, the developer must still delete its own
account data and direct the user to revoke access manually. The current flow is
therefore implemented as that documented fallback, with a conspicuous in-app
link after successful deletion. This is a technical determination, not an App
Review guarantee.

## Post-LLC production decision gate

Before final App Store submission, re-evaluate the authentication architecture
with the finalized Apple developer organization and counsel/reviewer guidance.
If programmatic revocation is required for the submitted build:

1. Use an Apple authorization flow that returns an authorization code or Apple
   provider credential to a trusted Vigorune server.
2. Validate the code with Apple and securely store only the revocation-capable
   token needed for the user's authorization.
3. Generate Apple client secrets server-side from the finalized Team ID, Key ID,
   client ID, and private key. Never ship the private key in the app or PWA.
4. Revoke the Apple token before deleting the Vigorune/Supabase user, with a
   retryable failure state that does not falsely report complete revocation.
5. Delete the stored Apple token and all app-controlled account data, clear the
   local session, and test new authorization, repeat deletion, failure, and
   already-revoked cases.
6. Configure and validate Apple credential-change notifications if supported by
   the final provider architecture.

## Sources

- Apple, [TN3194: Handling account deletions and revoking tokens for Sign in
  with Apple](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple)
- Apple, [Token revocation](https://developer.apple.com/documentation/signinwithapplerestapi/revoke-tokens)
- Apple, [Offering account deletion in your
  app](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- Supabase, [Login with Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- Supabase, [Social Login: provider
  tokens](https://supabase.com/docs/guides/auth/social-login#provider-tokens)
