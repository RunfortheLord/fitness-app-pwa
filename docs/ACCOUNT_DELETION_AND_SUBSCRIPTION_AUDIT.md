# Account Deletion, Cancellation, and Data-Retention Audit

Audit date: 2026-08-19 (worldwide globalization pass)

This document continues the publication and Terms audit. It is an architecture
and copy specification, not a statement that subscriptions are implemented or
live.

> **WORLDWIDE globalization update (2026-08-19).** Per `docs/DECISIONS.md`
> (2026-08-19), distribution is **worldwide**, the launch eligibility floor is
> **18+**, and **launch billing is Apple In-App Purchase + Google Play Billing
> only — web/Stripe billing is DEFERRED.** The provider-aware state machine
> stays provider-neutral (so a future `web` provider can be added), but only the
> `apple` and `google_play` providers are wired for launch. All web/Stripe copy,
> transition steps, cancel-at-period-end recommendations, and checklist items in
> this document are therefore **deferred / future-only** and are retained for
> reference, not for the launch build. Worldwide reach also brings EU/UK (GDPR/
> UK GDPR) retention and consumer duties into the retention analysis below.

## Scope Boundary

### Verified Current Release

The current release has optional Apple or Google authentication, optional
Supabase snapshot backup, and no subscription, trial, billing provider,
entitlement gate, complimentary-access grant, locked-account state, or public
Terms route.

Its implemented actions are separate:

| Action                  | Supabase identity/session                                      | App-controlled cloud data               | Billing | Local IndexedDB fitness records                   |
| ----------------------- | -------------------------------------------------------------- | --------------------------------------- | ------- | ------------------------------------------------- |
| Export                  | Unchanged                                                      | Unchanged                               | Absent  | Read to create a local file; not deleted          |
| Sign out                | Clears the local Supabase session                              | Retained                                | Absent  | Retained                                          |
| Delete cloud data       | Identity retained; local session is cleared after row deletion | Backup and daily nutrition rows deleted | Absent  | Retained                                          |
| Delete account          | Supabase Auth user deleted; local session cleared              | Rows cascade from the deleted Auth user | Absent  | Retained                                          |
| Clear all data          | Unchanged                                                      | Unchanged                               | Absent  | Deleted after a separate `DELETE` confirmation    |
| Uninstall/clear storage | May remove local session                                       | Unchanged                               | Absent  | May be deleted by the browser or operating system |

Evidence: `src/pages/SettingsPage.tsx`, `src/services/accountService.ts`,
`src/server/accountDeletion.ts`, `db/supabase/schema.sql`, and their focused
tests. IndexedDB remains the source of truth.

### Owner-Approved Target, Not Yet Implemented

The later paid-access target is different from the verified current release:

- Apple or Google authentication through Supabase is mandatory for paid-target
  use.
- Fitness records remain local unless cloud backup is separately enabled.
- A single server-recorded 14-day no-card trial never converts and never
  charges. It is not an Apple, Google, or Stripe subscription trial.
- One monthly auto-renewing full-access subscription is initially targeted at
  USD $2 through **Apple In-App Purchase and Google Play Billing only at launch**
  (Apple/Google as merchant of record handle worldwide VAT/GST). **Web billing is
  deferred.** UI must display the storefront-supplied localized price, not a
  hard-coded USD claim.
- Complimentary access can be created or changed only by a server service role.
- Offline paid access is limited and based on a recently server-verified signed
  entitlement.
- Locked users retain legal, authentication, billing, account-deletion, and
  local-export routes.
- Cancellation, expiration, sign-out, lockout, cloud deletion, and account
  deletion never delete local fitness records.

Do not alter `docs/V1_SCOPE_FREEZE.md` or describe this target in current store
metadata until the owner explicitly promotes it into a release scope.

### Owner-Approved Facts (2026-08-19)

These working decisions resolve some placeholders but close no legal blocker:

| Fact                        | Decision                              | Effect on this audit                                                                                                                                                                                                                                          |
| --------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operating entity            | Individual / sole proprietor (no LLC) | Retained billing ledger, refund, and dispute records are held by a natural person; no corporate veil. **Worldwide** health-data processing as an individual concentrates personal legal exposure — revisiting a single-member LLC and insurance is strongly worth it. Launching **store-billed only** (no Stripe) removes the web-billing exposure that concentrated it further. |
| Jurisdiction                | Texas, USA                            | Governing law trends to Texas; billing-record retention must satisfy Texas + federal (IRS) baselines, **plus EU/UK GDPR and any other jurisdiction** whose consumer is served under the worldwide launch (see retention baselines below).                                                                     |
| Launch territories          | **WORLDWIDE** (supersedes US-only)    | `[[PUBLICATION BLOCKER: counsel confirms worldwide storefront set + any exclusions]]`. Widens the consumer/auto-renewal/data-protection surface (EU Omnibus, UK DMCC 2024, GDPR); store billing (Apple/Google) satisfies most point-of-sale renewal disclosure globally but not deletion/retention duties.       |
| Launch age floor            | **18+** (supersedes 13+)              | Adults-only launch removes minor-deletion / guardian-record obligations from the launch surface; the teen deletion design is deferred with the rest of the minor tier.                                                                                                                                          |
| Public contact              | `adamshugart31@gmail.com`             | Resolves the published support/deletion contact. No home address or personal phone is published; a published **geographic trader address** is now required for EU/UK worldwide distance selling and remains `[[PUBLICATION BLOCKER: published contact address]]`.                                                |
| Launch billing channels     | **Apple + Google only; web deferred** | `web`/Stripe cancel-at-period-end recommendations below are **deferred, not launch** items. At launch, cancellation is store-managed (Apple/Google); account deletion never cancels store billing (the core warning copy below still governs).                                                                   |

## Current Audit Findings

1. Current account, cloud, and local deletion effects are accurate and covered
   by component and service tests.
2. The public deletion page now states that billing is absent in the current
   release and provides separate Apple and Google connection-management links.
3. The current Apple flow is not ready for an App Store account-deletion
   submission. It deletes the Supabase user and then asks for manual Apple
   cleanup. Apple says apps using Sign in with Apple should revoke the user's
   tokens through the Sign in with Apple REST API. The current Supabase setup
   does not retain the provider refresh token needed to complete that step.
4. Google OAuth connection revocation is also not implemented. Google's OAuth
   policy says to revoke and then delete tokens when access is no longer needed.
5. There is no `/terms` route, accepted Terms version, legal entity, governing
   law, refund policy, billing description, or retention schedule. That is
   accurate for the no-subscription build but blocks the paid target.
6. There is no server subscription ledger or provider notification processing.
   A client purchase result must never become the source of truth for access or
   cancellation.
7. The current app has no locked state. Future routing must be designed before
   mandatory authentication or entitlements can be introduced, or local export
   could accidentally become inaccessible.
8. Reconciliation with the locked/restricted routing work (master audit task #5,
   worktree `97e5`: `AccessBoundary.tsx`, `RestrictedAccessPages.tsx`): that work
   keeps signed-out/locked/deletion-pending users limited to
   auth/paywall/legal/support/account/export routes and never deletes local
   records. The deletion copy in this document and in
   `src/pages/PublicInformationPages.tsx` is written to be consistent with that
   boundary: it treats provider-connection management, subscription
   cancellation, cloud deletion, account deletion, and local deletion as
   separate actions; it always keeps local export available; and it never claims
   local records were erased. The current public-page copy edit is intentionally
   minimal (copy only) because the locked shell is not yet merged; when #5 lands,
   the restricted-route screens must reuse this same separation and the exact
   provider warning copy below.

## Required State Model

Keep these axes independent. Do not reduce them to one `accountStatus` flag.

```text
identity:       signed_out | active | deletion_pending | deleted
access:         trial | subscribed | complimentary | limited_offline | locked
billing:        none | active | cancel_pending | cancels_at_period_end |
                expired | revoked | unknown
billingProvider:none | apple | google | web
cloud:          disabled | absent | present | deletion_pending | deleted
localRecords:   present | exported | deletion_requested | deleted
```

The server owns identity, trial history, billing provider, provider transaction
identifiers, verified subscription state, complimentary access, cloud state,
and entitlement decisions. IndexedDB owns fitness records. The UI only renders
server state and requests transitions.

### Invariants

- No billing or identity transition calls IndexedDB deletion.
- `localRecords = deleted` is reachable only from the separate local-data
  confirmation on that device.
- Trial creation requires an authenticated server identity and a durable
  one-trial-used marker. No payment method is collected, and trial expiry only
  changes access.
- A client receipt or client-declared provider never grants access. The server
  verifies Apple, Google, or Stripe state.
- A stale offline entitlement can provide only the documented limited access
  and expires at its signed timestamp.
- Complimentary access and its notes never enter auth metadata, IndexedDB,
  cloud snapshots, client API payloads, backups, exports, logs, or analytics.
- `identity = deleted` is never displayed until the server deletion workflow
  has completed. A queued request is `deletion_pending`.
- Legal, privacy, support, authentication, billing management, account
  deletion, and local export remain reachable when access is locked or identity
  deletion is pending. A deleted identity still reaches local export and local
  delete without re-creating an account.

## Provider-Aware Transition Sequence

### Export

`present -> exported` creates a local file and changes no other axis. Put
**Export local records** before every destructive confirmation and on every
locked/deletion-pending screen.

### Sign Out

`active -> signed_out` clears the local auth session. It does not cancel a
subscription, end a trial, remove complimentary access, delete cloud data, or
delete local records.

### Delete Cloud Data

`present -> deletion_pending -> deleted` deletes only the app-controlled cloud
snapshot and cloud-derived rows. It does not cancel billing, delete the server
identity, revoke provider login, or delete local records. Signing out afterward
is a separate, disclosed convenience action.

### Cancel Subscription Without Deleting the Account

- **Apple:** open Apple's subscription management UI or
  `https://apps.apple.com/account/subscriptions`. Treat the return to the app as
  untrusted and re-check with App Store Server Notifications or the App Store
  Server API. Access continues through the verified paid-through date.
- **Google:** open the specific Play subscription page when product ID and
  package are known. Re-check with the Google Play Developer API and Real-time
  Developer Notifications. A user cancellation normally preserves access
  through the current paid period.
- **Web/Stripe (DEFERRED — not a launch channel):** if a web channel is ever
  added, create an authenticated, short-lived Stripe Customer Portal cancellation
  session on the server; standalone cancellation should set cancellation at
  period end so the user keeps already-paid access; confirm only from Stripe
  webhooks/API state, never from the portal redirect alone. Not applicable at
  launch.

At launch, Apple and Google are the only cancellation routes and both end in
`cancels_at_period_end`, then `expired`, while identity, cloud, and local records
remain unchanged.

### Delete Account

1. Reauthenticate and create an idempotent deletion request ID.
2. Read authoritative trial, entitlement, billing provider/status, cloud state,
   and complimentary-grant state on the server.
3. Offer local export before destructive choices.
4. Render the provider-specific warning and management action below.
5. For a no-card trial or no billing record, proceed directly after
   confirmation. Trial history is deleted with the identity only if doing so
   cannot permit another trial; otherwise retain a non-reversible abuse marker
   under a disclosed fraud-prevention retention rule.
6. For complimentary access, revoke the grant before deleting identity. Apply
   the private-note rules below.
7. For Apple or Google billing, request cancellation first and re-check provider
   state. Do not claim that deleting the app account cancels store billing.
   Allow both:
   - cancel renewal and schedule deletion for the verified paid-through date;
   - delete now after a second explicit warning that store billing may continue
     unless the user cancels it.
8. For web billing (**DEFERRED — not at launch**): if a web channel is later
   added, offer the same two outcomes —
   - **Cancel renewal and delete on the paid-through date:** set
     `cancel_at_period_end`, keep access, then run deletion automatically;
   - **Delete now:** cancel the Stripe subscription immediately before deleting
     identity. Do not leave a renewal active after the only authenticated portal
     identity is gone. State the refund policy before confirmation.

   At launch, only steps 7 (Apple/Google) and 5 (no-billing) apply.
9. Delete app-controlled cloud data, active entitlement, complimentary grant,
   provider tokens, and non-required profile data. Revoke Apple and Google OAuth
   tokens while credentials still exist, then delete the Supabase identity and
   sessions.
10. Retain only the disclosed, isolated financial/consent/dispute records below.
    Remove their direct link to fitness records.
11. Return a completion receipt that separately reports billing, server
    identity, cloud data, provider connection, and local-data status.

If web cancellation or a required token revocation is temporarily unavailable,
keep the request in `deletion_pending`, lock paid features, keep export and
account routes available, and retry idempotently. Do not report deletion as
complete and do not silently abandon a recurring charge. Store-billed users
must still be able to choose immediate app-account deletion after the explicit
store-billing warning.

## Exact User-Facing Copy for the Target

Placeholders such as `{{paid_through_date}}` and `{{localized_price}}` must come
from verified server/provider state. These strings are approved target copy,
not current-release copy.

### Trial

**Trial offer**

> Try full access free for 14 days. No payment method is required. This trial
> ends on {{trial_end_date}} and will not renew or charge you. To continue after
> it ends, you must choose and purchase a subscription.

**Trial expired**

> Your free trial ended. You were not charged. Your local fitness records are
> still on this device. Subscribe, export your records, manage your account, or
> delete your account.

### Sign Out

**Title:** Sign out?

> Signing out does not cancel a subscription or delete your account, cloud
> backup, or local fitness records. Offline access may become limited until you
> sign in and verify access again.

Buttons: **Keep me signed in** / **Sign out**

### Cancel Subscription

**Apple**

> Apple manages this subscription. Cancel it in Apple Subscriptions. After you
> cancel, full access continues until {{paid_through_date}}. Cancellation does
> not delete your Vigorune account, cloud backup, or local fitness records.

Button: **Manage Apple subscription**

**Google Play**

> Google Play manages this subscription. Cancel it in Google Play. After you
> cancel, full access continues until {{paid_through_date}}. Cancellation does
> not delete your Vigorune account, cloud backup, or local fitness records.

Button: **Manage Google Play subscription**

**Web**

> Cancel renewal? You will not be charged again. Full access continues until
> {{paid_through_date}}. Cancellation does not delete your Vigorune account,
> cloud backup, or local fitness records.

Buttons: **Keep subscription** / **Cancel renewal**

### Delete Cloud Data

**Title:** Delete cloud data?

> This permanently deletes your Vigorune cloud backup and cloud-derived rows,
> then signs this device out. It does not cancel your subscription, delete your
> Vigorune account, or change local fitness records on this device. Type DELETE
> CLOUD to continue.

Buttons: **Keep cloud data** / **Delete cloud data**

**Success**

> Cloud data deleted. Your subscription, Vigorune account, and local fitness
> records were not deleted. This device is signed out.

### Delete Account: Shared Introduction

**Title:** Permanently delete your Vigorune account?

> Export local records first if you may want them later. Account deletion
> removes your Vigorune server identity, cloud data, entitlement, and any
> complimentary access. It signs out all sessions. Local fitness records remain
> on this device until you separately choose Delete local data.

### Delete Account: Apple Billing

> Deleting your Vigorune account does not cancel your Apple subscription. Apple
> may continue billing until you cancel in Apple Subscriptions. Cancel there,
> then return so Vigorune can check the subscription status. You can still
> delete your Vigorune account now, but deletion will not stop Apple billing.

Buttons: **Manage Apple subscription** / **Check again** /
**Delete after {{paid_through_date}}** / **Delete now anyway**

Second confirmation for **Delete now anyway**:

> Apple still reports that this subscription may renew. Delete the Vigorune
> account now anyway? Apple billing may continue. Local fitness records will
> remain on this device.

Buttons: **Go back** / **Delete account now**

### Delete Account: Google Play Billing

> Deleting your Vigorune account does not by itself cancel your Google Play
> subscription. Cancel it in Google Play, then return so Vigorune can check the
> subscription status. You can still delete your Vigorune account now, but
> deletion will not stop Google Play billing unless cancellation is confirmed.

Buttons: **Manage Google Play subscription** / **Check again** /
**Delete after {{paid_through_date}}** / **Delete now anyway**

Second confirmation for **Delete now anyway**:

> Google Play still reports that this subscription may renew. Delete the
> Vigorune account now anyway? Google Play billing may continue. Local fitness
> records will remain on this device.

Buttons: **Go back** / **Delete account now**

### Delete Account: Web Billing (DEFERRED — not a launch channel)

_Retained for a possible future web channel only; not shown at launch (store
billing only)._

> Choose when to delete your account. **Cancel renewal and delete on
> {{paid_through_date}}** keeps full access through the period you already paid
> for. **Delete now** immediately cancels your web subscription and ends access
> when deletion finishes. Charges already paid are not automatically refunded
> except where required by law. Local fitness records remain on this device.

Buttons: **Keep account** /
**Cancel renewal and delete on {{paid_through_date}}** / **Delete now**

Second confirmation for **Delete now**:

> Delete your Vigorune account and cancel web billing now? Full access ends when
> deletion finishes. Your local fitness records will remain on this device.
> Type DELETE ACCOUNT to continue.

Buttons: **Keep account** / **Delete account now**

### Complimentary Access

Add this paragraph when a grant exists:

> Your complimentary access will end. Internal eligibility notes are never
> included in your fitness backup or export. They will be deleted or
> de-identified unless a minimal audit record must be retained for security or
> legal compliance as described in the Privacy Policy.

### Account-Deletion Completion Receipt

> Vigorune account deleted. Server identity: deleted. Cloud data: deleted.
> Vigorune access: ended. {{provider_billing_result}} Local fitness records:
> retained on this device.

Provider result must be one of:

- `Apple billing: manage separately with Apple.`
- `Google Play billing: manage separately with Google Play.`
- `Web billing: canceled; no future renewal is scheduled.`
- `Billing: no subscription existed.`

Never render a generic “everything was deleted” confirmation.

### Delete Local Data

**Title:** Delete local data from this device?

> This deletes local settings, nutrition data, bodyweight entries, exercises,
> programs, active workouts, and completed history from this device. It does not
> cancel a subscription or delete your Vigorune account or cloud data. Export a
> JSON backup first if you may want to restore these records. Type DELETE LOCAL
> to continue.

Buttons: **Keep local data** / **Delete local data**

## Management Links and Trusted Confirmation

| Provider                | User management action         | Link or boundary                                                                                            | Completion authority                                                                |
| ----------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Apple                   | Manage App Store subscription  | `https://apps.apple.com/account/subscriptions` or native StoreKit management UI                             | App Store Server Notifications / App Store Server API                               |
| Google Play             | Manage all subscriptions       | `https://play.google.com/store/account/subscriptions`                                                       | Google Play Developer API / Real-time Developer Notifications                       |
| Google Play             | Manage this subscription       | `https://play.google.com/store/account/subscriptions?sku={{product_id}}&package=com.adamshugart.fitnesslog` | Google Play Developer API / Real-time Developer Notifications                       |
| Web/Stripe (DEFERRED)   | Cancel this subscription       | _Not at launch._ Future: server-created ephemeral Stripe Customer Portal `subscription_cancel` flow          | Stripe webhook plus API reconciliation                                              |
| Apple login connection  | Review Sign in with Apple apps | `https://support.apple.com/102571`                                                                          | Successful Apple token revocation, with manual instructions only as recovery        |
| Google login connection | Review third-party connections | `https://myaccount.google.com/connections`                                                                  | Successful Google OAuth token revocation, with manual instructions only as recovery |

A browser return, button tap, deep-link open, client receipt, or client clock is
not proof of cancellation or expiry.

## Web Cancellation and Retained Billing Records

> **The "Web Cancellation" recommendation below is DEFERRED** — web/Stripe is not
> a launch channel. It is retained for a possible future web channel. At launch,
> cancellation is store-managed (Apple/Google) and the "Retention Boundary"
> subsection still applies to the store-billing ledger.

### Recommendation (web channel only — deferred)

- A standalone web cancellation should stop renewal at period end and preserve
  paid access.
- Account deletion must offer both scheduled deletion at period end and
  immediate deletion. If the user selects immediate deletion, cancel Stripe
  immediately before removing the authenticated identity. This prevents a
  future renewal after the user has lost access to the only authenticated
  billing route.
- Do not automatically refund the elapsed/current period unless the published
  Terms, provider rules, or applicable law require it. Make the refund result
  explicit before deletion and in the completion receipt.
- Use an idempotent server workflow. Deleting the Stripe Customer directly also
  immediately cancels active subscriptions, but Stripe keeps a retrievable
  deleted-customer history object. Do not equate Stripe Customer deletion with
  deletion of Vigorune identity, cloud data, or local records.

### Retention Boundary

After app-account deletion, delete names, email addresses, provider tokens,
fitness records, cloud snapshots, support text not subject to a hold, and other
non-required profile data. Retain a separate, access-controlled billing ledger
only to the extent required, containing no fitness data and no free-form notes:

- random deletion/tombstone ID;
- billing provider and non-secret customer/transaction/invoice identifiers;
- product, amount, currency, tax, charge, refund, dispute, and paid-through
  dates/status;
- proof and timestamp of subscription consent and cancellation;
- deletion request/completion timestamps and retention reason/expiry;
- legal-hold marker when authorized.

Do not promise one universal retention period before the owner's legal entity,
tax jurisdiction, storefronts, and payment methods are fixed. The published
policy must state a period or objective criteria for each category. Because the
launch is **worldwide**, the retention analysis must also satisfy **EU/UK GDPR
storage-limitation and erasure duties** (Art. 5(1)(e), Art. 17): after account
deletion, personal data may be retained only where a lawful basis (e.g., a legal/
tax/accounting obligation or the establishment/defense of legal claims) supports
it, and the retained categories and periods must be disclosed. Fitness data is
**special-category health data** (Art. 9), so its processing rests on explicit
consent and it must not be retained past deletion except under a narrow, disclosed
legal exception. Baselines to evaluate with counsel include:

- California's automatic-renewal law (BPC § 17602(a)(6)) requires verification of
  affirmative consent for at least three years, or one year after contract
  termination, whichever is longer, when that law applies. The ARL was amended by
  AB 2863 with expanded requirements effective July 1, 2025; re-check the current
  text before relying on it.
- The IRS generally requires records supporting income, deductions, or credits
  through the applicable limitation period; the ordinary period is often three
  years, with longer periods in specified circumstances.
- Open disputes, chargebacks, refunds, fraud investigations, and legal holds may
  require transaction evidence until final resolution and the applicable
  challenge period ends.
- Stripe states that it generally keeps certain business-user personal data for
  five or more years after the business relationship or last transaction,
  whichever is later. Vigorune must disclose that processor retention separately
  from its own ledger retention.

Recommended privacy copy:

> When you delete your account, Vigorune deletes your server identity,
> app-controlled cloud fitness data, active entitlement, and non-required
> profile data. Local fitness records remain on your device. We may retain an
> isolated billing record—such as provider and transaction identifiers,
> amounts, dates, tax/refund/dispute status, and proof of consent—only for
> accounting, tax, fraud-prevention, chargeback, or legal obligations. It is not
> used to reconstruct your profile or fitness history and is deleted when its
> stated retention period ends. Apple, Google, Stripe, and other processors may
> retain their own records under their policies.

## Complimentary-Access Notes

- Store grants and notes in server-only tables. Deny all client roles through
  Row Level Security; mutate only through service-role operations with an admin
  audit trail.
- Prefer structured reason codes and expiry dates. Avoid sensitive or
  speculative free text.
- Return only the resulting entitlement and expiry to the client, never the
  note, actor identity, or audit detail.
- Exclude grants and notes from IndexedDB, auth metadata, cloud snapshots,
  backups, exports, logs, analytics, support payloads, and billing metadata.
- On account deletion, revoke the grant and delete the user-linked note. If a
  minimal abuse/security audit must remain, remove the Supabase user ID, email,
  provider subject, and content; retain only a random tombstone, action,
  timestamp, reason category, and declared expiry.
- Disclose any user-linked retained note in the Privacy Policy and include it in
  applicable data-access responses even though it is excluded from fitness
  exports.

## Required Tests Before the Paid Target Can Ship

### Domain and Service

- Exhaustive transition matrix for identity, access, billing, cloud, and local
  axes; assert that only local deletion touches IndexedDB.
- One trial per server identity and abuse marker; no payment method and no
  transition from trial expiry to billing.
- Provider receipt verification, webhook replay/idempotency, stale event
  ordering, cancellation, expiry, refund, revocation, and limited-offline expiry.
- Account deletion for no billing, Apple, Google, web, complimentary, and
  cancellation-failure paths.
- Web immediate deletion cancels billing before identity removal; scheduled
  deletion preserves access through the verified date.
- Apple/Google token revocation occurs before credential deletion.
- Billing ledger is isolated from fitness/cloud tables and removes direct
  profile identifiers.

### Component and End-to-End

- Exact provider warning copy and management links.
- **Delete now anyway** remains available for store subscriptions after the
  second warning.
- Locked, offline-limited, deletion-pending, and deleted-identity shells expose
  legal, auth, billing, account, export, and local-delete routes only as
  appropriate.
- Export succeeds while signed out, locked, deletion pending, subscription
  expired, and server identity deleted.
- Cancellation, expiry, refund, lock, sign-out, cloud deletion, and account
  deletion leave seeded local records byte-for-byte intact.
- Local deletion does not cancel billing or delete identity/cloud data.
- Completion receipts report each subsystem separately and never claim provider
  cancellation from a redirect alone.

## App Store Account-Deletion Checklist

- [ ] Keep in-app deletion easy to find; reauthentication and a proportionate
      confirmation are allowed, but support contact cannot be the ordinary path.
- [ ] Implement and verify Sign in with Apple token revocation before deleting
      the Supabase identity. The current manual-only flow is a blocker.
- [ ] Revoke Google OAuth tokens too when Google sign-in was used.
- [ ] Query server-verified subscription status before showing deletion choices.
- [ ] Warn that Apple billing continues unless canceled, show native management
      or `https://apps.apple.com/account/subscriptions`, and re-check server
      state after return.
- [ ] If scheduled deletion at paid-through date is offered, also offer
      immediate deletion.
- [ ] Keep local export available before and after server-account deletion.
- [ ] Confirm local records are not deleted by sign-out, cancellation, expiry,
      cloud deletion, or account deletion.
- [ ] Publish accessible Privacy Policy and Terms of Use links in the app and
      required metadata before offering auto-renewing subscriptions.
- [ ] State localized price, duration, auto-renewal, cancellation, refund, data
      retention, and account-deletion effects exactly as implemented.
- [ ] Exercise deletion with active, canceled, expired, refunded, complimentary,
      and no-subscription TestFlight accounts on a physical device.
- [ ] Match App Privacy answers, review notes, server retention, and the signed
      binary. Do not claim subscription behavior in the current no-billing build.

## Google Play Account-Deletion Checklist

- [ ] Provide a readily discoverable in-app deletion path and a functional,
      public web deletion resource naming Vigorune.
- [ ] Enter the public deletion URL in Play Console and keep the pathway usable
      without paid entitlement.
- [ ] Delete the app account and associated user data; disclose each legitimate
      security, fraud-prevention, regulatory, tax, or dispute retention category.
- [ ] Clearly outline subscription-cancellation steps and provide a support path
      if an extra step is required.
- [ ] Link to the specific Play subscription page using the final product ID and
      unchanged package ID; keep the generic subscriptions link as fallback.
- [ ] Verify cancellation/expiry from the Play Developer API or Real-time
      Developer Notifications, never only the app redirect.
- [ ] Revoke Google OAuth tokens before deleting credentials; provider-account
      deletion and Vigorune-account deletion remain separate.
- [ ] Keep local export and legal/auth/billing/account routes available when
      locked or deletion is pending.
- [ ] Confirm cancellation and account deletion never clear IndexedDB.
- [ ] Update the Data safety form, subscription disclosures, Privacy Policy,
      Terms, retention schedule, and public instructions to the shipped build.
- [ ] Exercise active, canceled, expired, refunded/revoked, complimentary, and
      no-subscription paths with Play test purchases before production review.

## Official Sources Checked

Store and provider requirements are time-sensitive. Re-check them at
implementation and submission.

- Apple, [Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- Apple, [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- Apple, [Handling account deletions and revoking tokens for Sign in with Apple](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple)
- Apple, [Manage your apps with Sign in with Apple](https://support.apple.com/102571)
- Apple, [Schedule 2 and 3](https://developer.apple.com/support/downloads/terms/schedules/Schedule-2-and-3-English.pdf)
- Google Play, [Understanding app account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)
- Google Play, [User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311)
- Google Play Billing, [About subscriptions](https://developer.android.com/google/play/billing/subscriptions)
- Google Play Billing, [Manage subscriptions and one-time purchases](https://developer.android.com/google/play/billing/manage-purchases)
- Google Play, [Subscriptions policy](https://support.google.com/googleplay/android-developer/answer/9900533)
- Google Identity, [OAuth 2.0 policies](https://developers.google.com/identity/protocols/oauth2/policies)
- Stripe, [Customer portal](https://docs.stripe.com/customer-management)
- Stripe, [Customer portal deep links](https://docs.stripe.com/customer-management/portal-deep-links)
- Stripe, [Cancel subscriptions](https://docs.stripe.com/billing/subscriptions/cancel)
- Stripe, [Delete a customer](https://docs.stripe.com/api/customers/delete)
- Stripe, [Privacy Center](https://stripe.com/legal/privacy-center)
- U.S. House Office of the Law Revision Counsel,
  [15 U.S.C. § 8403](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section8403)
- Federal Trade Commission,
  [Restore Online Shoppers' Confidence Act](https://www.ftc.gov/legal-library/browse/statutes/restore-online-shoppers-confidence-act)
- California Legislature,
  [Business and Professions Code § 17602](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=17602)
- Internal Revenue Service,
  [How long should I keep records?](https://www.irs.gov/businesses/small-businesses-self-employed/how-long-should-i-keep-records)
- EU, [Consumer Rights Directive 2011/83/EU (consolidated) — withdrawal right, trader information](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02011L0083-20220528)
- EU, [Omnibus Directive 2019/2161 (auto-renewal transparency, enforcement)](https://eur-lex.europa.eu/eli/dir/2019/2161/oj)
- UK, [Digital Markets, Competition and Consumers Act 2024 (subscription contracts: reminders, cooling-off, easy exit)](https://www.legislation.gov.uk/ukpga/2024/13/contents)
- EU, [GDPR 2016/679 — Art. 5(1)(e) storage limitation, Art. 9 special-category data, Art. 17 erasure](https://eur-lex.europa.eu/eli/reg/2016/679/oj)

This is a product and technical compliance audit, not legal advice. Final Terms,
refund rules, retention periods, jurisdictions, and disclosures require the
owner's legal and tax review.
