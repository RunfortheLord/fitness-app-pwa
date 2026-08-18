# App Store Metadata and Privacy Draft

This is a preparation artifact for App Store Connect. Fields marked **OWNER**
require the account holder's decision or confirmation. Validate all statements
against the exact signed build and Xcode privacy report before publishing.

## App Information

| Field                    | Draft or required action                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Name                     | **OWNER:** Confirm the final public name. `Vigorune` remains temporary until name/trademark review is complete. |
| Bundle ID                | `com.adamshugart.fitnesslog` — do not change.                                                                   |
| Version                  | `1.0` (build `1` for the first upload; increment build for every subsequent upload).                            |
| Primary language         | English (U.S.); Spanish app UI exists, but localized store metadata/screenshots require owner review.           |
| Primary category         | **OWNER:** Health & Fitness is the expected choice.                                                             |
| Secondary category       | **OWNER:** Optional; leave blank unless a defensible category is selected.                                      |
| SKU                      | **OWNER:** Choose an internal immutable value such as `vigorune-ios-1`.                                         |
| Age rating               | **OWNER:** Complete Apple's current questionnaire from actual app behavior. Do not select Made for Kids.        |
| Content rights           | **OWNER:** Confirm rights to the name, icon, sounds, text, exercise/program content, and screenshots.           |
| Copyright                | **OWNER:** Legal name and release year.                                                                         |
| DSA/trader status        | **OWNER:** Complete according to actual legal/distribution status.                                              |
| Regulated medical device | Declare that Vigorune is not a regulated medical device, subject to owner/legal confirmation.                   |

## Product Page Draft

**Subtitle:** Local-first fitness tracking

**Promotional text:** Log training, nutrition, bodyweight, and runs with an
offline-first fitness journal that keeps you in control of your data.

**Description:**

Vigorune is a local-first fitness tracker for workouts, nutrition, bodyweight,
and running. Core features work without an account and remain available
offline.

Build and follow workout programs, keep completed workout history, run rest
timers, log meals and macro targets, track bodyweight trends, and record outdoor
or treadmill runs. Optional cloud backup uses Google or Apple sign-in. Optional
meal-photo analysis provides an editable estimate only when requested; nothing
is logged until you review and accept it.

Vigorune is a fitness logging tool, not a medical device or medical-advice
service.

**Keywords draft:** fitness,workout,training,nutrition,bodyweight,running,gym,log

**Support URL:** `https://<production-origin>/support`

**Privacy URL:** `https://<production-origin>/privacy`

**Account deletion URL:** `https://<production-origin>/account-deletion`

**OWNER:** Set an actively monitored support email before using these URLs in
App Store Connect.

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

## App Review Notes Draft

Vigorune is fully usable without an account. At first launch, choose **Continue
offline** to review core features. Google and Apple sign-in are optional and are
used only for cloud snapshot backup.

Suggested review path:

1. Continue offline and open Training, Nutrition, Run, History, and Settings.
2. Create or choose a workout program; the app never selects or starts a day
   automatically.
3. Start and finish a workout and test the rest timer notification.
4. Review JSON/CSV export and local-data controls in Settings.
5. Test optional Apple/Google authentication and cloud backup with the supplied
   non-expiring review account or reviewer-created identity.
6. Delete cloud data separately, then test **Delete account**. Account deletion
   retains local records by design; **Clear all data** removes local records.
7. Meal-photo analysis runs only after the reviewer selects a photo and presses
   Analyze. The estimate is editable and is not logged until accepted.

**OWNER:** Provide a monitored review contact, any required non-expiring test
credentials, and concise instructions for features that require physical
movement, camera, notification, or location permission.

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

## Submission Gates

- Final public name and ownership checks complete.
- Production origin deployed and all three public URLs verified signed out.
- Support email works and is monitored.
- Apple/Google authentication and account deletion pass physical-device tests.
- App Privacy answers, age rating, export compliance, content rights, and DSA
  fields are complete.
- Xcode archive validation, SDK signatures, entitlements, privacy report, icon,
  and screenshots pass.
- TestFlight checklist passes on at least one supported physical iPhone.
- App Review notes match the submitted build and contain no developer-stable
  URLs or expiring credentials.
