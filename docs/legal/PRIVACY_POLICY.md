# Vigorune Privacy Policy

**Effective date: August 20, 2026**

Vigorune is provided by **Adam Shugart**, an individual located in Texas,
United States ("Vigorune," "we," "us," or "our"). This Privacy Policy explains
how Vigorune processes information when you use the app, website, and related
services.

Vigorune is a local-first fitness logging tool. You can use its core workout,
nutrition, bodyweight, and running features without an account and without
uploading your fitness history to us. Optional online features send only the
information needed to provide the feature you request, as described below.

Vigorune is offered only to people in the United States who are at least 18
years old. It is not directed to children and is not offered as a Made for Kids
app.

Vigorune is not a medical provider or medical device and does not diagnose,
treat, cure, or prevent any condition. Vigorune is not a HIPAA covered entity or
business associate, and this is not a HIPAA notice. Our separate
[Consumer Health Data Privacy Policy](/consumer-health-data-privacy)
provides additional information about fitness, nutrition, bodyweight, running,
and related consumer health data.

## 1. Information stored on your device

Vigorune uses application storage on your device, including IndexedDB and local
storage. Depending on the features you use, device-local information can
include:

- settings and profile inputs, such as units, language, height, age, sex,
  activity level, weight goals, calorie and macro targets, and calculation
  preferences;
- exercises, workout programs, active workouts, sets, repetitions, weight,
  effort estimates, rest times, notes, program-change reviews, and workout
  history;
- foods, recipes, saved meals, food-search cache records, nutrition logs,
  serving information, notes, calorie and macro totals, and provider
  attribution;
- bodyweight entries, dates, units, goals, and notes;
- run summaries, treadmill information, pauses, splits, classifications, notes,
  and precise GPS samples such as latitude, longitude, time, accuracy, and
  altitude;
- local settings for camera, location, motion, notifications, and pending rest
  timers;
- authentication session information if you choose to sign in;
- locally stored integration credentials if you choose to provide one; and
- local backup, restore, export, and application metadata.

This information remains on the device until you delete it, clear the app's
storage, uninstall the app in a way that removes its storage, or the browser or
operating system removes it. Protect access to your device and any backup or
export files you create. Vigorune does not add a separate application-specific
encryption layer to device storage or exported files.

## 2. Optional account and automatic cloud backup

An account is optional. If you choose **Sign in with Apple** or **Sign in with
Google**, Apple or Google authenticates you and Supabase processes the resulting
account and session. Depending on the provider and your choices, this can
include a provider-specific identifier, email address, email-verification
status, limited profile metadata, authentication timestamps, and security
events. The app stores a session on your device so you can remain signed in.

Signing in activates Vigorune's automatic cloud-backup features. While you are
signed in, Vigorune can upload:

- one replaceable fitness snapshot containing settings, nutrition targets,
  foods and nutrition logs, saved meals, bodyweight entries, exercise and
  program records, workout records and history, and run summaries, pauses,
  splits, and classifications; and
- account-linked daily nutrition rows containing the local calendar date,
  calories logged, calorie target, and update time.

The latest successful snapshot replaces the previous snapshot. The app may
back up when it opens, when connectivity returns, and after backed-up local data
changes. Cloud backup is not real-time synchronization, does not merge data
between devices, and never replaces IndexedDB as the local source of truth. A
cloud restore is user-initiated and replace-only.

Detailed GPS samples, meal photos, locally stored integration credentials,
ephemeral weekly checkmarks, and backup-management metadata are excluded from
cloud snapshots. A manual JSON backup or CSV export can include more local data,
including detailed GPS samples, but remains under your control unless you share
it.

## 3. Meal-photo analysis

Meal-photo analysis is optional and user-initiated. When you select one or more
meal photos, optionally add a note, and tap **Analyze meal**, Vigorune resizes
the images on your device and sends the images and note through Vigorune's
server to OpenAI's Responses API. We do not intentionally send your Vigorune
account identifier or fitness history with that request.

The app requests that OpenAI not store the response as application state.
OpenAI states that API data is not used to train its models by default, but its
default abuse-monitoring logs may contain prompts, images, responses, and
related metadata for up to 30 days. Longer retention can apply when required by
law or reasonably necessary to protect services or people, and an image flagged
by OpenAI's child-safety scanning may be retained for manual review.

The returned nutrition estimate is editable and must be reviewed by you. It is
not added to your nutrition log until you expressly accept it. Vigorune does not
save the submitted meal images to its local database or include them in local
or cloud backups. If you accept the estimate, the resulting food and nutrition
records are saved like other nutrition records.

## 4. Food search and barcode lookup

When you request remote food search, food details, or barcode lookup, Vigorune
sends the search term, provider record identifier, barcode, language, and
related request information through its server to USDA FoodData Central, Open
Food Facts, or both. Vigorune does not intentionally send your account
identifier or fitness history to these providers. Searches and barcodes can
nevertheless reveal dietary interests.

The server temporarily caches normalized search results in process memory:
search results for up to 15 minutes and food-detail or barcode results for up to
six hours, subject to earlier serverless-instance eviction. Selected foods,
source attribution, serving data, and nutrition values may be saved on your
device and included in cloud backup while you are signed in. Custom foods are
not submitted to a shared food database.

## 5. Camera, photos, location, motion, and notifications

Vigorune asks for device permissions only when a related feature needs them:

- **Camera and photos:** used to scan a barcode or provide a meal photo you
  choose for analysis. Barcode camera frames are processed on the device. Meal
  photos leave the device only after you request analysis as described above.
- **Location:** used for a GPS run you start. Detailed GPS samples remain on the
  device and are excluded from cloud snapshots. Run summaries and related
  records can be included in cloud backup while signed in.
- **Motion:** used on supported devices for a treadmill run you start. Motion
  information used to calculate treadmill step and distance information is
  processed for that run.
- **Notifications:** used for optional rest-timer alerts. In the native iOS app,
  rest-timer notifications are scheduled locally on the device. In an installed
  web app, an outside-app alert can send a browser push subscription endpoint
  and public keys, a timer identifier, completion time, and schedule revision
  through Vercel and Upstash QStash to the browser's push service. QStash removes
  delivered messages from its message database shortly after delivery; provider
  logs and failed-message handling follow the configured provider service.

You can deny or later change these permissions in device or browser settings.
Some related features will not work without the permission.

## 6. Feedback and support

If the **Send feedback** feature is enabled in your build and you submit a
message, Vigorune sends the text you enter plus the app version, build and
environment identifiers, and browser or device user-agent information through
Vigorune's server to the support destination identified in the submission
disclosure. The Vigorune server relays the message rather than saving it in an
app database. The destination can retain the message under its own workspace
settings and policies. Do not include passwords, authentication codes, payment
details, or health information you do not want the developer and the disclosed
support provider to read.

You can also contact us directly using the email address at the end of this
policy.

## 7. Technical, security, and operational information

When your device communicates with Vigorune's website or APIs, hosting and
network providers necessarily process information such as IP address, user
agent, request path, date and time, region, response status, and timing. Vigorune
uses this information to deliver the service, secure APIs, enforce rate limits,
diagnose failures, prevent abuse, and respond to incidents.

Vigorune's application logs are designed to contain a request ID, route, method,
status, duration, outcome, provider class, cache status, and rate-limiter
availability—not request bodies, meal photos, GPS samples, authentication
tokens, or fitness records. Rate limiting uses a keyed hash derived from IP
address and user agent. Rate-limit counters expire with the applicable window,
which is no longer than one hour for current routes. Vercel runtime-log
retention depends on the production plan and is currently capped by Vercel at
30 days even on its longest standard observability option.

For installed-web-app authentication, a short-lived relay can temporarily hold
an OAuth authorization code. The relay expires after five minutes and is
deleted when consumed. Access tokens, refresh tokens, email addresses, and
fitness records do not enter that relay.

## 8. Anonymous usage analytics

Vigorune's launch analytics capability is **disabled in this release** and
collects no usage events. Vigorune does not use Google Analytics, advertising
SDKs, cross-site tracking pixels, or device fingerprinting.

We will update this policy and the in-app disclosure before enabling any usage
analytics. The disabled implementation is limited to app-opened,
workout-logged, meal-logged, and run-tracked event names, a calendar day, and a
random install identifier that is not joined to an account, email, precise
location, or fitness values.

## 9. How we disclose information

We disclose information only as needed for the purposes described in this
policy:

- **Supabase** provides optional Apple and Google authentication and stores the
  account, session, fitness snapshot, and daily nutrition rows described above.
- **Apple and Google** provide optional sign-in and process the information
  necessary to authenticate you. Their own privacy policies govern information
  they process independently.
- **OpenAI** processes meal photos and optional notes only when you request meal
  analysis.
- **USDA FoodData Central and Open Food Facts** receive remote food-search,
  detail, or barcode requests when you request those services.
- **Vercel** hosts Vigorune's public website and server routes and processes
  requests and operational metadata.
- **Upstash Redis and QStash** process short-lived authentication-relay data,
  keyed rate-limit counters, and optional installed-web-app rest-timer jobs.
- **The browser or platform push service** processes an optional web-push
  subscription and encrypted notification delivery.
- **A support messaging provider**, identified before submission when in-app
  feedback is enabled, receives feedback you choose to send.
- **Professional advisers, authorities, or transaction parties** may receive
  information when reasonably necessary to comply with law, investigate an
  incident or claim, protect rights and safety, or complete a transaction in
  which the recipient assumes the obligations in this policy.

Vigorune is operated by one individual and has no affiliates.

We do **not** sell personal information or consumer health data. We do not use
fitness records, meal photos, location, or health inferences for advertising.
We do not engage in targeted or cross-context behavioral advertising and do not
permit third parties to collect consumer health data through Vigorune over time
and across unrelated websites or services.

## 10. Retention and deletion

We retain each category for the period needed for its stated purpose:

- **Device-local information:** until you clear it, uninstall in a way that
  removes storage, or the browser or operating system removes it.
- **Cloud snapshot:** until it is replaced by a newer snapshot, you delete cloud
  data, or you delete the account.
- **Daily nutrition cloud rows:** until you delete cloud data or the account.
- **Supabase account and authentication information:** while the account is
  active, then deleted through the account-deletion workflow, subject to
  Supabase's limited security, backup, and legal-retention practices.
- **Meal-analysis requests:** Vigorune does not write meal photos or notes to an
  app database. OpenAI may retain abuse-monitoring data for up to 30 days, with
  the legal and safety exceptions described in Section 3.
- **Food-provider cache:** up to 15 minutes for searches and six hours for
  details or barcodes, or less if the server instance is evicted.
- **Authentication relay:** up to five minutes or until consumed, whichever
  happens first.
- **Rate-limit counters:** for the active rate-limit window, no longer than one
  hour for current routes.
- **Scheduled web-push job:** until canceled, delivered, expired, or failed;
  QStash removes delivered messages shortly after delivery.
- **Runtime operational logs:** under the configured Vercel plan, never more
  than Vercel's current 30-day maximum unless a specific record is preserved
  separately for a documented security incident or legal obligation.
- **Feedback:** the Vigorune route does not store the message in an app database;
  the disclosed support destination retains it under that provider's configured
  workspace policy until deleted there.

When applicable law requires deletion from archived or backup systems, we will
complete that deletion within the legally required period and, for covered
Washington consumer health data, no later than six months after authenticating
the request.

## 11. Your choices and privacy rights

You can:

- use core features without signing in;
- deny optional camera, photo, location, motion, or notification permission;
- choose whether to request remote food lookup or AI meal analysis;
- export local data as a JSON backup or fitness-data archive;
- delete app-controlled cloud data;
- delete your Vigorune account; and
- clear all local data on each device.

These deletion actions are intentionally separate:

- **Delete cloud data** removes the live cloud snapshot and daily nutrition rows
  and signs the device out, but does not delete the Supabase authentication
  account or local fitness records.
- **Delete account** removes the Supabase authentication account and its
  app-controlled cloud rows and signs the device out. It does not delete local
  fitness records.
- **Clear all data** removes Vigorune's local records from that device. It does
  not delete an account or cloud data. Use it separately on every device where
  you used Vigorune.
- **Sign out** ends the local signed-in session but does not delete local
  records, the account, or existing cloud data.

Apple users can separately revoke Vigorune in their Apple Account's Sign in
with Apple settings. Revoking provider access is not the same as deleting the
Vigorune account and app-controlled cloud data.

Subject to applicable law, you may ask us to confirm whether we process your
personal information, access it, correct it, provide a portable copy, delete
it, withdraw an optional consent, obtain information about relevant recipients,
or appeal a refusal to act. Email **adamshugart31@gmail.com** with the subject
**Privacy Request** or **Privacy Appeal**. We will use reasonable methods to
authenticate the request and will not require unnecessary health information.
An authorized agent may submit a request where applicable law permits.

For information that exists only on your device, we cannot access, correct,
export, or delete it remotely. Use the app's export and local deletion controls.
We will not discriminate against you for exercising a privacy right.

## 12. Security

We use safeguards designed to protect information, including encrypted network
transport, authenticated access, row-level authorization for cloud rows,
server-only provider credentials, bounded and validated API requests, rate
limiting, and restricted operational logging. No system can guarantee absolute
security. Protect your device, Apple or Google account, and exported files.

If a breach triggers the Federal Trade Commission Health Breach Notification
Rule or another applicable breach-notification law, we will provide required
notices.

## 13. Changes to this policy

We may update this policy as the app or legal requirements change. We will post
the updated policy with a new effective date. Before collecting, using, or
disclosing an additional category of consumer health data, or using it for a new
purpose, we will provide any notice and obtain any consent required by law. A
material change will not retroactively expand an earlier consent.

## 14. Contact

**Adam Shugart**  
Texas, United States  
Email: **adamshugart31@gmail.com**

For consumer health data rights and additional state-specific details, see the
[Consumer Health Data Privacy Policy](/consumer-health-data-privacy).
