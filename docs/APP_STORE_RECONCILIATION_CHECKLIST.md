# Apple App Store Release Reconciliation Checklist

- **Release model:** Version 1, free, U.S.-only, 18+, no subscriptions/IAP/ads
- **Account model:** Optional Apple/Google sign-in; core use works signed out
- **Cloud model:** Automatic replaceable snapshot backup while signed in
- **AI model:** User-requested OpenAI meal-photo analysis; user reviews and
  accepts before logging
- **Last reviewed:** August 20, 2026

Use this checklist against the exact signed archive submitted to App Store
Connect. It reconciles the binary, production configuration, public legal
pages, product-page copy, App Privacy answers, privacy manifest, screenshots,
and reviewer notes. A source-code intention is not evidence of submitted-build
behavior.

Apple requires app-level privacy answers to include relevant third-party
partner practices and to reflect the most comprehensive behavior across the
app's platforms. Keep the release evidence pack outside Git when it contains
account, build, or provider details.

## Release identity and commercial settings

- [ ] Final public name has naming/trademark approval. `Vigorune` remains
      provisional until that approval.
- [ ] Bundle identifier remains `com.adamshugart.fitnesslog`; no IndexedDB,
      local-storage, backup-format, URL-scheme, or persisted identifier was
      renamed with the public name.
- [ ] Version/build numbers match the archive and every screenshot/review note.
- [ ] Seller is the intended publisher: Adam Shugart if enrolled as an
      individual, or the exact LLC legal name if enrolled as an organization.
- [ ] Price is free and every U.S. storefront intended for launch is selected;
      non-U.S. storefronts are not selected.
- [ ] No subscription, in-app purchase, paywall, ad, tracking permission, or
      paid claim appears in the binary or metadata.
- [ ] Primary category is Health & Fitness; secondary category is blank unless
      the owner documents a reason.
- [ ] Copyright, SKU, content rights, export compliance, DSA/trader response,
      and regulated-medical-device response are completed from current facts.
- [ ] Not Made for Kids is selected. Apple's content-rating questionnaire is
      answered from actual content; the contractual/in-app 18+ eligibility rule
      is documented separately and not misrepresented as the content rating.

## Public pages and in-app legal controls

- [ ] Production HTTPS pages `/terms`, `/privacy`,
      `/consumer-health-data-privacy`, `/account-deletion`, and `/support` load
      signed out, are accessible, and show the release-effective text.
- [ ] App Store Privacy Policy URL points directly to `/privacy`.
- [ ] Privacy Choices URL points to a public page that gives privacy/deletion
      controls; use `/account-deletion` only if it accurately covers all choices.
- [ ] Support URL and support email are public, functional, and monitored.
- [ ] The exact published policy/Terms files, hashes, effective dates, app
      version, and deploy timestamp are preserved.
- [ ] First-run 18+/Terms acceptance is tested; acceptance version and timestamp
      are retained locally without requiring an account.
- [ ] Material legal-text changes trigger renewed acceptance when required.
- [ ] Before an image or note goes to OpenAI, the app names OpenAI, identifies
      what leaves the device and why, links the privacy disclosure, and obtains
      the required affirmative permission.
- [ ] AI estimates remain editable and are not logged until explicit acceptance.

## Actual data-flow inventory

Complete this table with evidence from the production configuration and signed
archive. “Disabled” means both client and server paths are disabled.

| Flow                      | Required release truth                                                                                                        | Evidence                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Local fitness data        | IndexedDB is authoritative; core features work without account/network                                                        | Offline test and storage inspection                  |
| Apple/Google sign-in      | Optional; used for account and cloud backup                                                                                   | Signed-out walkthrough and provider config           |
| Cloud backup              | Starts automatically after sign-in; replaceable snapshot, not sync                                                            | Network trace, Supabase row inspection, restore test |
| Cloud contents            | Fitness snapshot plus daily nutrition rows; excludes detailed GPS samples, photos, credentials                                | Serialized snapshot test and database inspection     |
| Local deletion            | Per-installation only; does not delete cloud/account                                                                          | Physical-device test                                 |
| Cloud deletion            | Deletes snapshot/daily rows and signs out; leaves account/local data                                                          | Disposable-account test                              |
| Account deletion          | Deletes auth identity and app-controlled cloud rows; leaves local data                                                        | Disposable-account and Supabase inspection           |
| Apple provider revocation | Automated token revocation or documented App Review-approved alternative                                                      | Physical Apple account test or written determination |
| Meal analysis             | User-selected image/note sent through Vigorune to OpenAI; no account ID intentionally included; provider retention reconciled | Consent capture and network/provider review          |
| Food lookup               | Query/barcode/provider ID/language sent to USDA and/or Open Food Facts; short server cache                                    | Route/config and cache test                          |
| Outdoor run               | Detailed GPS stays local and is excluded from cloud snapshot                                                                  | Network trace and snapshot inspection                |
| Treadmill motion          | Processed for user-started run; no server motion stream                                                                       | Permission and network test                          |
| Rest alerts               | Native local notification; web version may use push/QStash                                                                    | Platform-specific test and config                    |
| Analytics                 | Disabled; no usage events or analytics SDK transmission                                                                       | Build/config scan and network trace                  |
| Feedback                  | Disabled unless destination, disclosure, label, and retention are confirmed                                                   | Feature flag and server config                       |

Any mismatch stops submission until the build, policy, store answers, and
consent are made consistent.

## App Privacy working answers

Apple's “collect” definition turns on off-device transmission and whether the
developer or partners can access data longer than necessary to service the
request. Do not rely on an optional-disclosure exception unless every Apple
criterion is met. Confirm the current App Store Connect wording at submission.

Use this conservative worksheet; it is a verification aid, not a substitute
for answering the live questionnaire.

| Apple data type    | Release behavior to declare/reconcile                                                                              | Linkage and purpose working answer                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Email Address      | Optional Apple/Google/Supabase account email                                                                       | Linked to identity; App Functionality/account management                                                          |
| User ID            | Supabase account/provider identifier and cloud-row owner key                                                       | Linked to identity; App Functionality                                                                             |
| Health             | Nutrition, bodyweight, goals, and health-related records included in signed-in cloud backup                        | Linked when backed up; App Functionality                                                                          |
| Fitness            | Workouts, programs, run summaries, and related fitness records included in signed-in cloud backup                  | Linked when backed up; App Functionality                                                                          |
| Photos or Videos   | Meal photos transmitted for OpenAI analysis; OpenAI abuse-monitoring retention can extend beyond real-time service | Reconfirm whether unlinked safeguards satisfy Apple's test; App Functionality                                     |
| Other User Content | Optional meal-analysis note and free-form content included in cloud backup                                         | Linked for cloud records; separately evaluate unlinked AI request; App Functionality                              |
| Search History     | Remote food queries/barcodes sent to food providers and temporarily cached                                         | Declare conservatively; verify partner retention and linkage; App Functionality                                   |
| Coarse Location    | IP/region operational metadata may be processed by hosting/network providers                                       | Confirm whether Apple treats the production practice as collection and whether linked; App Functionality/security |
| Diagnostics        | Limited route/status/duration/provider/cache/rate-limit and runtime metadata                                       | Confirm exact retention and Apple category; App Functionality/security/diagnostics as applicable                  |
| Customer Support   | Only if feedback/support collection is enabled in the submitted build                                              | Disabled for launch unless destination and label are reconciled                                                   |

Confirm and document that these are not collected by the submitted release
unless the final network/privacy report proves otherwise:

- precise GPS location: detailed samples are processed only on device;
- payment information, purchase history, financial information;
- contacts, phone number, physical address;
- advertising data, tracking data, and cross-app identifiers;
- analytics/product-interaction events: analytics is disabled for launch.

For every declared type, answer separately:

- purpose;
- whether linked to identity;
- whether used for tracking; and
- whether a third-party partner receives or retains it.

The answer to tracking must remain **No** for the release. Do not request App
Tracking Transparency permission.

## Privacy manifest and SDK reconciliation

- [ ] `ios/App/App/PrivacyInfo.xcprivacy` matches the table above and the exact
      binary.
- [ ] Xcode's combined privacy report was generated from the Release archive.
- [ ] Every included SDK has a valid signature/privacy manifest where Apple
      requires one; App Store upload shows no manifest or required-reason API
      warning.
- [ ] Collected-data types, linkage, tracking, and purposes agree among the app
      manifest, embedded SDK manifests, combined report, App Store Connect, and
      public policy.
- [ ] Camera, photos, location, motion, and notifications usage descriptions
      accurately name the feature and permission is requested only on user
      action.
- [ ] No secret or server credential exists in the archive; only approved public
      client values are bundled.

## Metadata and screenshots

- [ ] Subtitle, promotional text, description, and keywords use the approved
      `docs/APP_STORE_METADATA.md`/`docs/STOREFRONT_LISTING.md` copy after
      correcting these known launch facts: - cloud backup is automatic after optional sign-in, not a separate
      off-by-default toggle; - the launch is App Store, free, U.S.-only, and 18+; and - OpenAI is the disclosed meal-analysis provider.
- [ ] No copy promises that all data always stays on device; every network
      feature is qualified.
- [ ] No medical, diagnosis, treatment, guaranteed-result, automatic-coaching,
      or guaranteed-backup claim appears.
- [ ] Screenshots come from the signed release build, use synthetic data, and
      show no real email, GPS route, home location, token, API key, developer
      URL, or provider credential.
- [ ] Screenshot captions use “estimate” for AI/nutrition outputs and do not say
      “cloud sync.”
- [ ] Screenshots and previews match current iPhone sizes and current UI.
- [ ] Spanish localization is omitted unless all localized metadata, legal
      presentation, and screenshots are actually ready.

## App Review access and notes

- [ ] Notes begin: core functionality is available through **Continue offline**
      and no account is required.
- [ ] Review path covers Training, Nutrition, Bodyweight/History, Run, Settings,
      export, and the separate local/cloud/account deletion controls.
- [ ] Optional authentication instructions are current. Any supplied review
      account is non-expiring for the review period and contains synthetic data.
- [ ] Notes explain that signing in starts automatic replaceable snapshot backup
      and that local IndexedDB remains authoritative.
- [ ] Meal-analysis instructions point out the OpenAI disclosure/permission and
      review-before-log step.
- [ ] Physical permissions and background notification tests have concise
      instructions and no claim of behavior that was not verified on the
      submitted TestFlight build.
- [ ] Sign in with Apple account deletion includes token revocation or the exact
      documented alternative accepted by App Review.
- [ ] Review contact name, monitored email, phone, and time zone are current.

## Final signed-build gate

- [ ] Full repository release gate passed at the release commit.
- [ ] `npm run ios:sync` and `npm run ios:verify` passed on the release commit.
- [ ] Release archive validation and App Store upload completed without
      unresolved warnings.
- [ ] TestFlight installed fresh on a supported physical iPhone.
- [ ] Upgrade from the latest distributed PWA/native test state preserves local
      data and compatibility identifiers.
- [ ] Offline first launch and signed-out core workflow pass.
- [ ] Apple and Google sign-in, backup, restore, deletion, AI consent, camera,
      location, motion, notifications, exports, and public links pass on device.
- [ ] `npm run store:verify-web -- https://<production-origin>` passes against
      production.
- [ ] Production health endpoint reports only intentionally enabled
      integrations.
- [ ] App Store Connect preview, privacy label, agreements, tax/banking status,
      U.S. availability, and release mode receive owner sign-off.

## Release evidence record

Record these values in the restricted release folder:

- git commit, archive checksum, version/build, Xcode/iOS SDK versions;
- production origin and deployment ID;
- App Store Connect app/version ID;
- public legal document hashes and effective dates;
- combined privacy report and submitted App Privacy answers;
- provider/configuration inventory with secret values omitted;
- physical-device model, iOS version, tester, and QA results;
- screenshots and review notes exactly as submitted; and
- owner, engineering, privacy/counsel, and submission sign-off timestamps.

## Official maintenance references

- [Apple: Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)
- [Apple: App privacy details and data-type definitions](https://developer.apple.com/app-store/app-privacy-details/)
- [Apple: App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple: Privacy manifests](https://developer.apple.com/documentation/bundleresources/describing-data-use-in-privacy-manifests)

Re-run this reconciliation for every submitted update and whenever a feature
flag, SDK, provider, recipient, retention period, or policy changes.
