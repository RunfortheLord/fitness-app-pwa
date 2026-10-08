# App Store Metadata Release Candidate

This is the reconciled Version 1 preparation artifact for a **free, U.S.-only,
18+** App Store release with no subscription, in-app purchase, paywall,
advertising, or tracking. Fields marked **OWNER** require the account holder's
decision or confirmation. Validate all statements against the exact signed
build and Xcode privacy report before publishing.

## App Information

| Field                    | Release value or required action                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| Name                     | `Vigorune`                                                                                            |
| Bundle ID                | `com.adamshugart.fitnesslog` — do not change.                                                         |
| Version                  | `1.0` (build `1` for the first upload; increment build for every subsequent upload).                  |
| Primary language         | English (U.S.); Spanish app UI exists, but localized store metadata/screenshots require owner review. |
| Primary category         | Health & Fitness                                                                                      |
| Secondary category       | Leave blank for Version 1.                                                                            |
| SKU                      | `vigorune-ios-1` (internal and immutable)                                                             |
| Age rating               | Use the answers below, do not select Made for Kids, and override to 18+ for the Terms requirement.    |
| Content rights           | **OWNER:** Confirm rights to the name, icon, sounds, text, exercise/program content, and screenshots. |
| Copyright                | **OWNER:** Legal name and release year.                                                               |
| DSA/trader status        | **OWNER:** Complete according to actual legal/distribution status.                                    |
| Regulated medical device | Declare that Vigorune is not a regulated medical device, subject to owner/legal confirmation.         |

## Product Page Copy

**Subtitle:** Local-first fitness tracking

**Promotional text:** Log training, nutrition, bodyweight, and runs with an
offline-first fitness journal that keeps you in control of your data.

**Description:**

Vigorune is a local-first fitness tracker for workouts, nutrition, bodyweight,
and running. Core features work without an account and remain available
offline.

Build and follow workout programs, keep completed workout history, run rest
timers, log meals and macro targets, track bodyweight trends, and record outdoor
or treadmill runs. Optional Google or Apple sign-in starts automatic
replaceable cloud backup; local records remain the source of truth. Optional
OpenAI meal-photo analysis runs only after a provider-specific disclosure and
your affirmative permission, and nothing is added to the nutrition log until
you review and accept the editable estimate.

Vigorune is a fitness logging tool, not a medical device or medical-advice
service.

**Keywords:** fitness,workout,training,nutrition,bodyweight,running,gym,log

**Support URL:** `https://fitness-app-pwa-eight.vercel.app/support`

**Privacy URL:** `https://fitness-app-pwa-eight.vercel.app/privacy`

**Account deletion URL:**
`https://fitness-app-pwa-eight.vercel.app/account-deletion`

**Support contact:** `adamshugart31@gmail.com`. Confirm it remains actively
monitored before using these URLs in App Store Connect.

## Screenshot Plan

Capture screenshots from the signed release build with synthetic data only:

1. Home dashboard with workout, nutrition, and bodyweight summaries.
2. Current program and manual workout-day selection.
3. Live workout with sets and rest timer.
4. Nutrition diary and macro progress.
5. Bodyweight/calorie history graphs.
6. Run tracking/history without exposing a real home location.
7. Local data controls and optional cloud backup.

Use Apple's current required iPhone dimensions. Do not show private emails,
real GPS routes, API keys, access tokens, developer URLs, or claims that imply
medical diagnosis, guaranteed outcomes, or automated coaching.

## App Review Notes

Vigorune is offered only to U.S. adults age 18 or older and is fully usable
without an account. On first launch, confirm eligibility, accept the Terms, and
acknowledge the Privacy Policy. Then choose **Continue offline** to review core
features. Google and Apple sign-in are optional; signing in starts automatic
replaceable cloud snapshot backup.

Suggested review path:

1. Continue offline and open Training, Nutrition, Run, History, and Settings.
2. Create or choose a workout program; the app never selects or starts a day
   automatically.
3. Start and finish a workout and test the rest timer notification.
4. Review JSON/CSV export and local-data controls in Settings.
5. Test optional Apple/Google authentication and cloud backup with the supplied
   non-expiring review account or reviewer-created identity.
6. Delete cloud data separately, then test **Delete account**. Account deletion
   first revokes retained Apple/Google authorization, then removes the account
   and cloud rows. It retains local records by design; **Clear all data**
   removes local records.
7. Meal-photo analysis names OpenAI and requires an unchecked affirmative
   permission after the reviewer selects a photo and before Analyze is enabled.
   The estimate is editable and is not logged until accepted.

**OWNER:** Provide a monitored review contact, any required non-expiring test
credentials, and concise instructions for features that require physical
movement, camera, notification, or location permission.

## Age Rating Questionnaire Working Answers

Use the questionnaire shown for the submitted build; Apple can change its
wording. For the current Version 1 behavior:

| Current category or descriptor                          | Answer                                       |
| ------------------------------------------------------- | -------------------------------------------- |
| Parental controls                                       | No                                           |
| Age assurance                                           | Yes — first-run 18+ self-attestation         |
| Unrestricted web access                                 | No — OAuth/legal links do not allow browsing |
| User-generated content distributed to other users       | No                                           |
| Social media; messaging/chat; advertising               | No                                           |
| Health or wellness topics                               | Yes                                          |
| Medical or treatment information                        | None                                         |
| Profanity, fear, substances, sexuality/nudity, violence | None                                         |
| Contests, loot boxes, simulated gambling, gambling      | None / No                                    |
| Made for Kids                                           | No                                           |
| Age category override                                   | Override to Higher Age Rating: **18+**       |

The content answers may calculate below 18+, but Apple's current guidance says
an app whose EULA requires a higher minimum age must use the higher override.
The in-app eligibility rule and Terms require 18+; do not add sensitive content
merely to obtain that rating.

## App Store Connect Compliance Working Answers

- **License agreement:** Apple's Standard EULA; do not upload a custom App Store
  EULA.
- **Digital goods and services:** No. The app is free and has no IAP,
  subscription, paid entitlement, paywall, ad, or external purchase offer.
- **Export compliance:** The binary uses standard operating-system HTTPS and
  exempt platform cryptography, not proprietary or non-standard encryption.
  Keep `ITSAppUsesNonExemptEncryption = NO`; the Account Holder must confirm the
  final dependency set and answer Apple's flow consistently.
- **Regulated medical device:** No. Vigorune is a fitness journal, not a medical
  device, diagnosis, or treatment service.
- **Content rights:** The app accesses third-party food data. USDA FoodData
  Central is public domain/CC0 and Open Food Facts database reuse is governed by
  ODbL/Database Contents License with source attribution. The owner must retain
  evidence for these rights plus the icon, sounds, exercise/program text, and
  screenshots.
- **DSA:** Version 1 is unavailable in every EU storefront. Apple's current
  guidance says an app distributed only outside the EU is not acting as a
  trader on the App Store. Select the app-specific non-trader state; the Account
  Holder must still complete any account-level declaration and confirm whether
  unrelated business activity changes that assessment.
- **Release method:** Manual release. Do not select automatic release after
  approval.

## App Privacy Working Map

Use this map to answer Apple's current questionnaire conservatively. Apple's
definition of collection and each provider's retention behavior must be checked
at submission time.

| Data category          | Behavior                                                                                         | Expected purpose/status                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Email address          | Processed by Supabase after optional Apple/Google sign-in                                        | Linked to identity; app functionality/account management                                          |
| User ID                | Supabase authentication identifier and owner key for cloud rows                                  | Linked to identity; app functionality                                                             |
| Fitness data           | Optional snapshot may include workouts, nutrition, bodyweight, and run summaries                 | Linked to identity when cloud backup is enabled; app functionality                                |
| Precise location       | GPS samples are processed and stored locally; detailed samples are excluded from cloud snapshots | Reconfirm no server/provider transmission; if entirely on-device, explain accordingly             |
| Photos/user content    | Meal photos and optional notes are sent to OpenAI only after explicit user action                | Verify OpenAI retention terms; declare conservatively if Apple's definition of collection applies |
| Search terms/barcodes  | Sent to USDA FoodData Central or Open Food Facts when lookup is requested                        | App functionality; verify provider logging/retention                                              |
| Feedback text          | Sent only when the optional feedback form is enabled and submitted                               | App functionality/customer support; linked status depends on submitted content                    |
| Device/browser context | Limited build, language, online status, and client context accompany enabled feedback            | Diagnostics/customer support; verify exact payload before declaration                             |
| Advertising/tracking   | No advertisements, cross-app tracking, or data-broker sale in Version 1                          | Tracking permission is not requested                                                              |

Privacy-policy statements and App Store answers must cover the exact behavior of
Supabase, OpenAI, Apple, Google, USDA, Open Food Facts, and any enabled feedback
or notification provider. Do not publish the label until Xcode's combined
privacy report and the production configuration have been reviewed together.
The app-level working declaration is committed at
`ios/App/App/PrivacyInfo.xcprivacy`; update it whenever production data flows
change. It conservatively declares email, user ID, health, fitness, meal photos,
and other user content for app functionality, with no tracking.

## Submission Gates

- Final public name and ownership checks complete.
- Production origin deployed and all five public routes (`/terms`, `/privacy`,
  `/consumer-health-data-privacy`, `/account-deletion`, and `/support`) verified
  signed out.
- Support email works and is monitored.
- Apple/Google authentication and account deletion pass physical-device tests.
- App Privacy answers, age rating, export compliance, content rights, and DSA
  fields are complete.
- Xcode archive validation, SDK signatures, entitlements, privacy report, icon,
  and screenshots pass.
- TestFlight checklist passes on at least one supported physical iPhone.
- App Review notes match the submitted build and contain no developer-stable
  URLs or expiring credentials.
