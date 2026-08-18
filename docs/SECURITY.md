# Security and Incident Readiness

This document records the Version 1 security boundary, implemented controls,
release gates, and incident-response procedure. It is operational guidance, not
a guarantee that the application is immune to every attack.

## Protected Assets

- Local workout, nutrition, bodyweight, running, and preference records.
- Optional Supabase identity, cloud snapshot, and daily nutrition rows.
- OAuth authorization codes, PKCE verifiers, sessions, and relay secrets.
- Server-only OpenAI, Supabase service-role, Redis, QStash, webhook, and push
  credentials.
- User-supplied USDA credentials stored locally and excluded from exports.

## Trust Boundaries

1. IndexedDB is the local source of truth and is isolated per app installation.
2. The browser or Capacitor client may hold only public provider configuration,
   user sessions, and user-entered local credentials.
3. Vercel API routes are the boundary for paid providers, account deletion,
   feedback, push scheduling, and the native OAuth relay.
4. Supabase authentication and row-level security isolate cloud rows by the
   verified authenticated user.
5. Redis stores rate-limit counters and short-lived, one-time OAuth relay data.
6. OpenAI, USDA, Open Food Facts, Apple, and Google are external providers whose
   availability and privacy practices must be represented accurately.

## Implemented Controls

- Core functionality does not require an account or network connection.
- Server credentials never use the `VITE_` prefix and production builds run a
  secret-leak assertion.
- CI rejects tracked environment/private-key files and common live credential
  formats.
- OAuth uses PKCE. Native returns use a short-lived, one-time Redis relay; the
  retrieval secret and PKCE verifier remain with the initiating installation.
- Account deletion validates the Supabase access token, derives the user ID
  server-side, rejects untrusted browser origins, and fails closed when its
  distributed limiter is unavailable.
- Supabase cloud tables enable row-level security with owner-only policies.
- Paid AI requests are size bounded, schema validated, time limited, and
  protected by a distributed rate limiter.
- API errors are bounded and do not return provider credentials or raw upstream
  error bodies.
- Deployment headers restrict scripts, connections, framing, referrers, mixed
  content, and powerful browser features while retaining the camera, location,
  and motion capabilities the user explicitly invokes.
- Dependency audit, Dependabot, repository secret checks, security-focused
  ESLint rules, unit tests, and Chromium/WebKit end-to-end tests provide
  automated regression coverage.

## Release-Blocking Security Checks

- `/api/health` reports `accountDeletion`, `authRelay`, `cloudBackup`,
  `distributedAiProtection`, and `mealAnalysis` as configured for the release.
- Account deletion is exercised with a disposable Google account and a
  disposable Apple account; cloud rows are verified deleted and local records
  are verified retained.
- Apple and Google OAuth are exercised from the signed native app, including
  cancellation, expired relay, replay attempt, hidden Apple email, sign-out,
  and relink flows.
- Xcode validates the archive, entitlements, SDK signatures, and combined
  privacy report.
- The public production origin returns the expected CSP, Permissions Policy,
  HSTS, referrer, MIME-sniffing, and anti-framing headers.
- No developer-stable URLs or test credentials remain in the App Store archive.
- GitHub branch protection requires CI and security checks before merging the
  release branch.

## Monitoring Before Release

Configure alerts, without logging tokens or health records, for:

- sustained HTTP 401, 403, 429, 502, or 503 rates;
- OAuth relay failures, replay attempts, and limiter unavailability;
- account-deletion failures;
- unexpected AI/provider cost or request-volume increases;
- Supabase authentication anomalies and database policy changes;
- dependency, static-analysis, secret-scanning, or deployment failures.

Retain only bounded operational metadata: request ID, route, status, duration,
provider class, cache result, and limiter availability. Do not log request
bodies, meal photographs, bearer tokens, OAuth codes, PKCE values, GPS samples,
or fitness records.

## Credential Rotation

| Credential                      | Rotation trigger                                                       |
| ------------------------------- | ---------------------------------------------------------------------- |
| Apple client secret             | Before its six-month expiry and immediately after suspected exposure   |
| Apple `.p8` key                 | Suspected exposure, staff/access change, or Apple-directed replacement |
| Supabase service-role key       | Suspected exposure or project access change                            |
| OpenAI key                      | Suspected exposure, unexplained spend, or provider access change       |
| Redis/KV and QStash credentials | Suspected exposure or integration replacement                          |
| Rate-limit HMAC secret          | Suspected exposure; coordinate with limiter-key rollover               |
| Feedback webhook and push keys  | Suspected exposure or destination change                               |

Record the owner, creation date, expiry date, last rotation, and next review in a
private credential register outside the repository.

## Incident Response

1. Contain: disable the affected integration or deployment and revoke exposed
   credentials. Preserve local-first use when possible.
2. Assess: identify affected routes, time window, accounts, data categories,
   provider logs, and whether cloud data was accessed or changed.
3. Eradicate: patch the cause, rotate credentials, invalidate sessions when
   warranted, and verify row-level policies and deployment variables.
4. Recover: run the full release gate, deploy to developer-stable, exercise the
   affected flow with disposable data, then promote only with approval.
5. Notify: follow applicable provider, contractual, App Store, and legal breach
   requirements. Use qualified legal guidance for notification decisions.
6. Learn: document the timeline, root cause, impact, corrective actions, and new
   regression tests without recording user secrets or health data.

## Known Residual Risks

- Physical-device and signed-archive behavior cannot be verified on Windows.
- Provider retention and regional processing must be reviewed when completing
  the App Privacy answers.
- Custom URL schemes can be claimed by another installed app; PKCE and the
  independent relay retrieval secret prevent that app from completing the
  stolen authorization code exchange.
- Anonymous feedback can attract spam. Keep it disabled until a monitored
  destination and distributed abuse controls are configured.
- Local data is protected by the device and OS. Vigorune does not add a second
  application-specific encryption layer to IndexedDB.
- The repository is private. Enable GitHub CodeQL and dependency review only if
  the account has GitHub Advanced Security; the portable CI checks do not
  depend on that paid entitlement.
