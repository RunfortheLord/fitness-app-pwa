# Store Release Setup

This checklist separates repository work from credentials and device actions
that must be completed by the app owner. Vigorune remains fully usable offline
without an account. Keep `com.adamshugart.fitnesslog` and all persisted-data
identifiers unchanged.

Use `docs/APP_STORE_METADATA.md` for the product-page, reviewer-note, screenshot,
and privacy-label working draft. Use `docs/SECURITY.md` for threat boundaries,
release-blocking security checks, monitoring, rotation, and incident response.

## Public URLs and Support

Before producing a signed native build:

1. Choose the canonical HTTPS app origin and set `VITE_PUBLIC_APP_ORIGIN` in the
   native build environment. The origin must serve `/privacy`,
   `/account-deletion`, `/support`, and `/auth/callback/*`.
2. Set `PUBLIC_APP_ORIGIN` to the same origin in Vercel.
3. Set `VITE_SUPPORT_EMAIL` to an actively monitored public support address.
4. Verify the three public pages without signing in and enter their URLs in App
   Store Connect and Play Console.
   Run `npm run store:verify-web -- https://your-production-origin.example` to
   check the public routes, deployment headers, required integrations, and
   protected endpoint behavior together. The command intentionally fails while
   a release-blocking integration is missing.
5. Keep the in-app feedback form disabled unless both `VITE_FEEDBACK_ENABLED`
   and the server-only `FEEDBACK_WEBHOOK_URL` are configured and monitored.

## Supabase Account Deletion

The browser receives only the public Supabase URL and anon key. Permanent
account deletion runs through `/api/account/delete`, verifies the bearer token
with Supabase, derives the user ID from that verified token, rate limits by that
ID, and calls the Supabase admin delete operation. The foreign keys in
`db/supabase/schema.sql` cascade account deletion to the backup and daily
nutrition rows. Local IndexedDB is not touched.

Set these server-only Vercel variables:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (preferred) or the legacy
  `SUPABASE_SERVICE_ROLE_KEY`
- the existing Redis variables and `AI_RATE_LIMIT_HASH_SECRET`

Create a dedicated Supabase secret key for this backend when the project offers
the newer `sb_secret_...` keys. Never prefix either admin key with `VITE_`.
Verify `/api/health` reports
`accountDeletion: true` before testing deletion. Use a disposable account for
the first test and confirm its Auth user, backup row, and daily nutrition rows
are gone while the device's local records remain.

## Sign in with Apple

In Apple Developer:

1. Retain the App ID/bundle ID `com.adamshugart.fitnesslog` and enable **Sign in
   with Apple**.
2. Create a Services ID for the web OAuth flow and associate it with the App ID.
3. Configure the Services ID website domain as the Supabase project domain and
   its return URL as `https://<project-ref>.supabase.co/auth/v1/callback`.
4. Create a Sign in with Apple key, download its `.p8` file once, and store it
   outside the repository.
5. Generate the Apple client secret and record its six-month rotation date.

In Supabase Authentication → Providers → Apple:

1. Enable Apple.
2. Enter the Services ID first in the client-ID list. Include the native App ID
   if the dashboard supports multiple client IDs.
3. Enter the generated Apple client secret.
4. Keep the Supabase Auth callback registered with Apple.

In Supabase URL Configuration, allow each deployed app origin's narrowly scoped
`/auth/callback/*` route and exact `/settings` route. Do not use a wildcard
domain that admits unrelated origins.

The Capacitor app opens Supabase OAuth in the iOS system browser. The HTTPS
callback places only the one-time PKCE authorization code in the existing Redis
relay, then opens `vigorune://auth-complete`. The app consumes that code with the
retrieval secret and PKCE verifier that never left the initiating installation.

Supabase does not retain Apple provider refresh tokens. Account deletion still
deletes the Vigorune identity and all app-controlled cloud data. When an Apple
identity was linked, the app also tells the user how to remove Vigorune from
their Apple Account's **Sign in with Apple** settings. A future native-token
implementation may automate Apple token revocation if provider refresh tokens
are securely retained server-side.

## Xcode and TestFlight

On a Mac with current Xcode:

1. Run `npm install`, `npm run ios:sync`, and `npm run ios:verify`.
2. Open the project with `npm run ios:open`.
3. Select the correct development team without changing the bundle ID.
4. Confirm the Sign in with Apple and Time Sensitive Notifications capabilities.
5. Confirm camera, when-in-use location, and motion permission descriptions.
6. In Xcode, generate and inspect the combined privacy report. Confirm it agrees
   with `ios/App/App/PrivacyInfo.xcprivacy` and the production configuration.
7. Confirm the `ITSAppUsesNonExemptEncryption = NO` declaration remains accurate
   for the final dependency set. Vigorune currently uses exempt platform HTTPS
   and hashing rather than proprietary encryption; the owner remains responsible
   for the export-compliance answer.
8. Archive a Release build and upload it to App Store Connect.
9. Test with TestFlight on a physical iPhone using
   `docs/IPHONE_QA_CHECKLIST.md`.

Do not claim native authentication, camera, GPS, motion, notifications, file
sharing, upgrade safety, or Apple token behavior is verified until the signed
physical-device checks pass.

## Google Play Follow-up

The Android wrapper is not yet present. Create it only after the iOS release
candidate is stable. Start with Android 16/API 36, then configure adaptive
icons, runtime permissions, OAuth return handling, signed AAB generation, Data
Safety, account-deletion URL, Health Apps declaration, and physical-device QA.
