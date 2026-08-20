# Vigorune Consumer Health Data Privacy Policy

**Effective date: August 20, 2026**

This Consumer Health Data Privacy Policy describes how **Adam Shugart**, an
individual located in Texas, United States ("Vigorune," "we," "us," or "our"),
processes consumer health data. It supplements the
[Vigorune Privacy Policy](/privacy).

This policy is designed to provide the disclosures required by U.S. consumer
health privacy laws, including the Washington My Health My Data Act and Nevada's
consumer health data law. Rights differ by state, and a provision of this policy
applies to the extent required by applicable law.

"Consumer health data" means personal information that is linked or reasonably
linkable to a person and identifies, reveals, or can be used to infer that
person's past, present, or future physical or mental health status. In Vigorune,
this can include fitness, exercise, nutrition, body measurement, health-goal,
and precise-location information, along with an identifier or activity record
when it is linked to that information or reveals use of a health-related
service.

Vigorune is not a HIPAA covered entity or business associate. This is not a
HIPAA notice, and Vigorune does not claim to be HIPAA compliant. The Federal
Trade Commission Health Breach Notification Rule and state consumer health data
laws can apply to health apps operating outside HIPAA.

## 1. Consumer health data we process

| Category                                   | Examples                                                                                                                                               | How we use it                                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Fitness profile and goals                  | Height, age, sex, activity level, preferred units, weight goals, calorie and macro targets, and calculation inputs                                     | Configure the app; provide calculations and estimates you request; display goals and progress                                                   |
| Workout and program data                   | Exercises, programs, sets, repetitions, weight, rest, effort or RIR, notes, active and completed workouts, and reviewed program changes                | Plan, record, display, export, and back up workouts; preserve history; provide rest timers                                                      |
| Nutrition and food data                    | Food searches, barcodes, foods, brands, recipes, meals, servings, notes, calories, macros, daily totals, meal photos, and AI estimates                 | Find food information; analyze a meal when requested; record accepted meals; calculate totals; display, export, and back up records             |
| Bodyweight data                            | Bodyweight, date, unit, notes, trends, and goal progress                                                                                               | Record, calculate, display, export, and back up progress                                                                                        |
| Running and precise-location data          | Run dates, duration, distance, pace, mode, treadmill steps, pauses, splits, classifications, and GPS latitude, longitude, time, accuracy, and altitude | Record and summarize a run; display and export it. Detailed GPS samples remain on the device and are excluded from cloud snapshots              |
| Optional account-linked cloud copy         | A replaceable fitness snapshot and daily rows containing local date, logged calories, calorie target, and update time                                  | Provide automatic backup and user-initiated restore after you choose to sign in                                                                 |
| Meal analysis and derived data             | Meal photos, optional notes, ingredients, serving estimates, calories, macros, confidence, and assumptions                                             | Produce an editable OpenAI estimate after you tap Analyze meal; store resulting nutrition records only after you accept them                    |
| Feedback and rest-timer delivery           | Health information you choose to include in feedback; a web-push endpoint and public keys, timer identifier, completion time, and schedule revision    | Deliver feedback if the feature is enabled and you submit it; deliver an optional installed-web-app timer alert                                 |
| Derived fitness information                | Workout totals, calorie and macro totals, pace, trends, projections, and accepted meal estimates                                                       | Provide the calculations and displays you request. Vigorune does not use these for advertising, automatic coaching, or automatic target changes |
| Security data linked to use of the service | Request identifier, route, status, timing, provider class, and keyed rate-limit signals derived from IP address and user agent                         | Secure the service, prevent abuse, diagnose failures, and respond to incidents                                                                  |

We do not ask for diagnoses, medications, reproductive or sexual health
information, genetic data, or biometric identifier templates. Free-text notes,
feedback, photos, and location can reveal sensitive facts, so do not include
information that is unnecessary for the feature you requested.

## 2. Sources of consumer health data

We obtain consumer health data from:

- **you**, through information you type, select, photograph, scan, import, or
  ask the app to record;
- **your device**, including its camera, photo library, location and motion
  sensors, clock, browser or operating system, and notification service, when
  you grant permission and use the related feature;
- **Vigorune's local calculations**, such as totals, pace, trends, and
  user-requested estimates;
- **OpenAI**, when it returns a meal-photo estimate you requested;
- **USDA FoodData Central and Open Food Facts**, when they return food data you
  requested;
- **Apple, Google, and Supabase**, when they provide optional authentication,
  session, cloud-storage, or security information; and
- **Vercel, Upstash, QStash, the browser push service, and a disclosed support
  provider**, when they return the operational, delivery, or support
  information needed for a feature you requested.

## 3. How we collect and use consumer health data

Vigorune processes local fitness data when you enter or import it, start a
workout or run, use a calculation, or otherwise ask the app to provide a local
fitness feature. This processing is limited to providing the product or service
you requested.

Accounts are optional. If you choose Apple or Google sign-in, automatic cloud
backup becomes active for that account. The app can then upload one replaceable
snapshot and daily nutrition rows as described in the general Privacy Policy.
Detailed GPS samples, meal photos, and locally stored integration credentials
are not included in cloud snapshots. Cloud backup is not real-time
synchronization.

Vigorune sends information off the device for consumer health features only
when necessary to provide a feature you requested:

- selecting photos and tapping **Analyze meal** sends the resized photos and
  optional note to Vigorune's server and OpenAI;
- requesting remote food search, food details, or barcode lookup sends the
  query, provider record identifier, barcode, language, and request information
  to Vigorune's server and USDA FoodData Central or Open Food Facts;
- choosing optional sign-in activates Supabase authentication and cloud backup;
- enabling an outside-app web rest-timer alert sends limited timer and push
  information to Vercel, QStash, and the browser push service; and
- submitting an enabled feedback form sends the text and disclosed device or
  build context to the disclosed support destination.

We do not collect, use, or disclose consumer health data for an undisclosed
purpose. If a new purpose is not necessary to provide a service you requested,
we will obtain the affirmative consent required by applicable law before that
processing. Where law requires consent to a disclosure, that consent will be
separate from consent to collect the data. Consent will not be inferred from a
prechecked box, inactivity, or acceptance of general terms.

You may stop future optional processing by not using the feature, denying or
revoking the related device permission, signing out, deleting cloud data or the
account, canceling an optional web-push job, or submitting a privacy request.
Withdrawal does not undo processing already completed at your direction.

## 4. Consumer health data we disclose

The recipients below act as processors, service providers, or third parties
depending on the service and applicable law. The list is intentionally
conservative so you can understand where data may go.

| Recipient or category                                      | Consumer health data disclosed                                                                                                                                                | Purpose and condition                                                                                                                                            |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase                                                   | Optional account identifier and Apple or Google identity/session metadata; cloud fitness snapshot and daily nutrition rows                                                    | Authenticate you and maintain the cloud backup you requested by signing in                                                                                       |
| Apple                                                      | Apple sign-in request, provider identifier, and related authentication information                                                                                            | Provide optional Sign in with Apple. Vigorune does not send fitness records to Apple for sign-in                                                                 |
| Google                                                     | Google sign-in request, provider identifier, and related authentication information                                                                                           | Provide optional Google sign-in. Vigorune does not send fitness records to Google for sign-in                                                                    |
| OpenAI                                                     | Meal photos, optional note, analysis instructions, and technical request metadata                                                                                             | Generate a meal estimate only after you request analysis. No Vigorune account ID is intentionally included                                                       |
| USDA FoodData Central                                      | Search query, provider record identifier, barcode, and technical request metadata from Vigorune's server                                                                      | Provide remote food search, details, or barcode lookup you request                                                                                               |
| Open Food Facts                                            | Search query, barcode, language, application-identifying user agent, and technical request metadata from Vigorune's server                                                    | Provide remote food or barcode data you request; no Vigorune account ID or fitness history is intentionally included                                             |
| Vercel                                                     | API request data needed for the requested feature and limited network or operational metadata, which can include IP address, user agent, route, region, status, and timing    | Host and secure Vigorune's website and API routes. Vigorune's application logs are designed not to log request bodies or fitness records                         |
| Upstash Redis and QStash                                   | Keyed rate-limit counters; a short-lived authentication relay; optional web-push subscription endpoint and public keys, timer ID, completion time, and scheduling information | Prevent abuse, complete installed-app sign-in, and schedule an optional outside-app rest-timer alert                                                             |
| Browser or platform push service                           | Web-push endpoint and encrypted notification delivery information                                                                                                             | Deliver an optional rest-timer alert after permission is granted                                                                                                 |
| Disclosed support provider and the developer               | Feedback text and app version, build, environment, and user-agent context; health information only if you include it                                                          | Deliver and review feedback you choose to submit when the feature is enabled                                                                                     |
| Professional advisers, authorities, or transaction parties | Only the consumer health data reasonably necessary                                                                                                                            | Comply with law, investigate an incident or claim, protect rights and safety, or complete a transaction in which the recipient assumes this policy's obligations |

Vigorune is operated by one individual and has **no affiliates**.

## 5. No sale, advertising, cross-site collection, or health-facility geofencing

Vigorune does **not** sell consumer health data or exchange it for money or other
valuable consideration. Vigorune does not use consumer health data for
advertising or cross-context behavioral advertising. Vigorune does not permit a
third party to collect consumer health data through Vigorune over time and
across unrelated websites or online services.

Vigorune does not use a geofence around a medical or health care facility to
identify or track people, collect consumer health data, or send health-related
messages or advertising. GPS is used only for a run you choose to start.

If Vigorune ever proposed to sell consumer health data, it would first obtain a
separate signed authorization containing the details required by applicable
law. General terms, this policy, or a feature toggle would not authorize a sale.

## 6. Consumer health data rights

Subject to applicable law, you may:

- confirm whether we collect, share, or sell consumer health data about you;
- access consumer health data we control;
- obtain a list of third parties or affiliates with whom we shared or sold your
  consumer health data and available contact information required by law;
- correct inaccurate consumer health data where applicable;
- withdraw consent from future collection or sharing;
- request deletion of consumer health data from systems we control and require
  us to notify covered processors, contractors, affiliates, and third parties;
- obtain a portable copy of data we control; and
- appeal a refusal to act on a request.

Email **adamshugart31@gmail.com** with the subject **Consumer Health Data
Request**. For an appeal, use the subject **Consumer Health Data Appeal** and
explain why you believe the decision should be reconsidered. We will use
reasonable methods to authenticate you and will not require unnecessary health
information. An authorized agent may act where applicable law permits and the
agent's authority and your identity can be verified.

We will respond without undue delay and within 45 days after receiving an
authenticated request when Washington or Nevada consumer health law applies. We
may extend the response once by an additional 45 days when reasonably necessary
and permitted by law, and we will explain the reason for the extension. We will
decide a covered appeal within 45 days. If we deny an appeal, we will provide
the applicable state attorney general contact or complaint method.

We do not charge for a request unless applicable law permits a reasonable fee
because a request is manifestly unfounded, excessive, or repetitive. We will
not discriminate against you for exercising a privacy right.

## 7. Local, cloud, account, and provider deletion

Local records, cloud data, and account data are separate:

- **Local data:** use **Settings → Data → Clear all data** on each device. This
  removes Vigorune records stored by that installation but does not delete cloud
  data or an account. For local-only data, Vigorune cannot remotely access or
  delete the data because it was never uploaded.
- **Cloud data:** use the cloud-data deletion control to delete the live
  Supabase backup snapshot and daily nutrition rows. This signs the device out
  but leaves the authentication account and local data intact.
- **Account:** use **Settings → Data → Cloud backup → Delete account**. This
  deletes the Supabase authentication account and its app-controlled live cloud
  rows and signs the device out. It deliberately leaves local fitness records
  intact so account deletion cannot erase the only copy of your history.
- **Provider access:** Apple users may separately revoke Vigorune in Sign in
  with Apple settings. Provider revocation is not a substitute for deleting the
  Vigorune account and cloud rows.

A verified consumer health data deletion request sent by email can also cover
app-controlled server data and notification to covered recipients. We will
delete covered data from active systems and instruct applicable processors,
contractors, or third parties to delete it when required. If covered data exists
in archived or backup systems, deletion can be delayed until restoration or the
next scheduled deletion cycle, but for Washington consumer health data will be
completed no later than six months after the request is authenticated.

Some providers may not be able to locate a prior request that Vigorune sent
without an account identifier, such as a meal-analysis or food-provider request.
Vigorune intentionally avoids adding an account ID to those requests. Provider
security, legal, or safety records may also be retained where applicable law
permits or requires.

## 8. Retention

- Local consumer health data remains on the device until you or the operating
  system removes it.
- The cloud snapshot remains until replaced by a newer snapshot, cloud data is
  deleted, or the account is deleted. Daily nutrition rows remain until cloud
  data or the account is deleted.
- Vigorune does not write submitted meal photos or notes to an app database.
  OpenAI's default abuse-monitoring retention is up to 30 days, with longer
  legal and safety exceptions described in the general Privacy Policy.
- Normalized food search results remain in temporary process memory for up to
  15 minutes; food details and barcode results remain for up to six hours,
  subject to earlier server-instance eviction.
- An installed-app authentication relay expires within five minutes or is
  deleted when consumed.
- Current rate-limit counters expire after their active window, no longer than
  one hour.
- An optional QStash rest-timer job remains until canceled, delivered, expired,
  or failed. QStash removes delivered messages from its message database shortly
  after delivery.
- Vigorune's bounded operational logs contain route and outcome metadata rather
  than request bodies. Under Vercel's available standard plans, runtime logs are
  retained no longer than 30 days unless a specific incident record is
  separately preserved for a documented security or legal need.
- If feedback is enabled, the Vigorune route does not retain the feedback in an
  app database. The disclosed support destination retains it under the
  configured workspace policy until it is deleted there.

## 9. Security

We limit access to consumer health data to the operator and service providers
that need it for a disclosed purpose. Safeguards include encrypted network
transport, authenticated cloud access, row-level authorization for account
rows, server-only service credentials, bounded and validated requests, rate
limiting, and restricted operational logging. No system can guarantee absolute
security, and device security remains important, particularly for unencrypted
exports.

If a breach triggers the Federal Trade Commission Health Breach Notification
Rule or another applicable breach-notification law, we will notify affected
people, regulators, and others as required.

## 10. Changes to this policy

We will post an updated policy with a new effective date. Before collecting,
using, or disclosing an additional category of consumer health data, adding a
recipient category, or using data for an additional purpose, we will provide
notice and obtain affirmative consent where required. A material change will
not retroactively expand an earlier consent.

## 11. Contact

**Adam Shugart**  
Texas, United States  
Email: **adamshugart31@gmail.com**

Use **Consumer Health Data Request** or **Consumer Health Data Appeal** as the
email subject so the request can be handled promptly.
