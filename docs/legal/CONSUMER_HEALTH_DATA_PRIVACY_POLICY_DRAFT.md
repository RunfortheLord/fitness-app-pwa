# Vigorune Consumer Health Data Privacy Policy — Working Draft

> **Status: DO NOT PUBLISH.** Washington/Nevada-style working draft for the
> owner-approved subscription target, prepared August 19, 2026 and revised the
> same day for **worldwide** distribution. It is **not** a statement of verified
> current-release behavior and is **not** legal advice. The linked general Privacy
> Policy contains numbered publication blockers that are incorporated here.

> **Globalization pass (2026-08-19).** This document remains the **US
> consumer-health layer** (Washington My Health My Data Act, Nevada SB 370, and the
> FTC Health Breach Notification Rule), which still applies to US end users under
> worldwide distribution. For users in the EEA and the UK, the same fitness,
> nutrition, bodyweight, and run data is **special-category health data** under
> GDPR/UK GDPR Article 9, and the explicit-consent basis, data-subject rights,
> international-transfer safeguards, and Article 27 representative requirement are
> set out in the **"Your rights in the EEA and the UK (GDPR and UK GDPR)"** section
> of the [general Privacy Policy](./PRIVACY_POLICY_DRAFT.md). The launch minimum
> age is now **18+**, and launch billing is **Apple In-App Purchase and Google Play
> Billing only** (web/Stripe deferred); Stripe references below are retained as
> future/conditional.

---

## How to read this document (internal orientation — not consumer-facing)

Same structure as the general policy: internal notes and `[[PUBLICATION
BLOCKER]]` callouts are **internal only** and must be removed before publication;
only the sections under `## Consumer Health Data Privacy Policy` are
consumer-facing; the primary-legal-sources appendix is an internal compliance
record.

### Owner-approved facts already applied

| Field                                           | Applied value                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| Provider identity (`[LEGAL NAME]`)              | **Adam Shugart, an individual (sole proprietor), Texas, USA — no LLC, no affiliate** |
| Public contact email (`[PUBLIC PRIVACY EMAIL]`) | **adamshugart31@gmail.com**                                                          |
| Minimum age                                     | **18+ at launch** (superseded 13) — under-18 handling deferred                        |
| Territories                                     | **Worldwide** (owner decision, 2026-08-19); this US consumer-health layer applies to US end users, and the general policy's EEA/UK GDPR layer applies to EEA/UK users |
| Launch billing                                  | **Apple In-App Purchase + Google Play Billing only**; web/Stripe deferred            |

### Why this policy still applies even though the owner is in Texas

**[[PUBLICATION BLOCKER — PB-13]]** Washington and Nevada applicability is highly
plausible because the app is intended to measure or improve fitness and diet and
processes linked workouts, nutrition, bodyweight, and running information. **The
owner's Texas residence does not remove obligations to end users who are
Washington or Nevada residents or present in those states** — both laws turn on
the consumer's location, not the business's. Counsel must confirm Vigorune's
regulated-entity / small-business status, exemptions, exact geographic scope, and
whether any other state health-data law (or the Texas Data Privacy and Security
Act's sensitive-data consent rules) requires a jurisdiction-specific supplement.
This draft uses the stricter operational deadline where the reviewed Washington
and Nevada rules differ; it does **not** make an applicability determination.

**[[PUBLICATION BLOCKER — PB-03]]** Do not publish this policy until
implementation matches it, all target consent and rights workflows pass
end-to-end tests, and the frozen Version 1 scope has been formally reconciled.

---

## Consumer Health Data Privacy Policy

**Effective date:** [[PUBLICATION BLOCKER — EFFECTIVE DATE: set on the day
counsel approves publication]]

This Consumer Health Data Privacy Policy describes how **Adam Shugart**, an
individual sole proprietor located in Texas, United States ("Vigorune," "we,"
"us," or "our"), processes consumer health data. It supplements our
[general Privacy Policy](./PRIVACY_POLICY_DRAFT.md).

"Consumer health data" in this policy means information linked or reasonably
linkable to a person that identifies, reveals, or can be used to infer past,
present, or future physical or mental health status. For Vigorune this includes
fitness, exercise, nutrition, body measurement, health-goal, and precise location
information, plus identifiers and purchase or activity records when they are
linked to that information or reveal use of a health-related service.

Vigorune is not a HIPAA covered entity or business associate, and this policy is
not a HIPAA notice. Vigorune does not claim to be "HIPAA compliant." Instead,
consumer-health-data laws such as the Washington My Health My Data Act, the
Nevada consumer-health-data law, and the FTC Health Breach Notification Rule may
apply to a consumer health app that operates outside HIPAA.

Vigorune is offered worldwide. This policy is the **US consumer-health layer**. If
you are in the European Economic Area or the United Kingdom, the same fitness,
nutrition, bodyweight, and run information is **special-category health data** under
Article 9 of the GDPR / UK GDPR; the explicit-consent basis for processing it, your
GDPR data-subject rights, the safeguards for international data transfers, and the
Article 27 EU/UK representative are described in the "Your rights in the EEA and
the UK (GDPR and UK GDPR)" section of our
[general Privacy Policy](./PRIVACY_POLICY_DRAFT.md), which applies to you in
addition to this policy.

### Consumer health data we process

| Category                                          | Examples                                                                                                                                                              | Sources                                                                                               | Why and how it is processed                                                                                                                              |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fitness profile and goals                         | Height, age, sex, activity level, preferred units, goal weight, calorie and macro targets, calculation inputs                                                         | You; deterministic calculations on your device                                                        | Configure the app, calculate user-requested estimates, display goals, and create records you direct the app to create                                    |
| Workout and program data                          | Exercises, programs, sets, repetitions, weight, rest, effort/RIR, notes, active and completed workouts, detected program-change review                                | You; the app's timers and calculations; built-in or user-created templates                            | Plan, record, display, and export workouts; preserve history; provide a rest timer                                                                       |
| Nutrition and food data                           | Food searches and barcodes, foods, brands, recipes, meals, servings, notes, calories, macros, daily totals, meal photos, AI estimates                                 | You; device camera; OpenAI output; USDA FoodData Central; Open Food Facts; deterministic totals       | Search for foods, estimate a user-submitted meal, record accepted meals, calculate totals, and export records                                            |
| Bodyweight and measurement data                   | Bodyweight, date, unit, notes, weight trend and goal progress                                                                                                         | You; deterministic calculations                                                                       | Record, display, calculate, and export progress                                                                                                          |
| Running and precise location data                 | Run dates, duration, distance, pace, classifications, pauses, splits, GPS latitude/longitude, accuracy, altitude, and time                                            | You; device location sensors; deterministic calculations                                              | Record and summarize a run and export it. Detailed GPS samples stay device-local and are not included in target cloud backup                             |
| Health-service activity and access                | Use of a fitness app, trial dates, subscription/entitlement status, complimentary access, offline lease, cancellation/refund, support request about health features   | You; Vigorune server; Apple; Google; Stripe only if web billing is later added (deferred, not at launch); authorized Vigorune support staff | Authenticate, provide and verify access, prevent repeated trials, handle billing/support, allow limited offline use, and meet legal obligations          |
| Optional cloud fitness copy                       | Account-linked snapshot of the disclosed local categories and account-linked daily calories/targets                                                                   | You through a separate opt-in; records already on your device                                         | Store and restore a replaceable backup. No fitness record may be uploaded merely because you authenticate                                                |
| Optional feedback and notifications               | Health detail you type into feedback; push endpoint/keys, timer ID, rest-completion time, and schedule revision                                                       | You; browser/operating system; device timer                                                           | Send feedback you submit or deliver a rest-timer notification you separately enable                                                                      |
| Derived or inferred health data                   | Calorie/macro estimates, workout totals, pace, trends, goal projections, accepted AI meal estimate                                                                    | Deterministic app calculations; OpenAI when requested                                                 | Show user-requested estimates and save them only where the feature says. Vigorune does not use them for advertising or automatic coaching/target changes |
| Security information linked to health-service use | Request identifiers, route, time, status, HMAC-derived rate-limit key, IP/user-agent-derived signals, authentication/security events, billing fraud or dispute events | Your device/request; Vercel; Upstash; Supabase; Apple/Google (Stripe only if web billing is later added)                                   | Secure accounts and APIs, enforce short rate limits, verify billing, prevent fraud, investigate incidents, and meet legal duties                         |

We do not intend to collect diagnoses, medications, reproductive or sexual health
information, genetic data, or biometric identifier templates. Free-text notes,
feedback, photos, or location can nevertheless reveal sensitive facts. Do not
include information that is unnecessary for the feature you requested.

**[[PUBLICATION BLOCKER — PB-05, PB-06, PB-07, PB-10, PB-16]]** Finalize every
target server field and user-facing category. If implementation adds a device
identifier, receipt field, payment/fraud signal, staff note, inferred category,
or any other field, update this table and obtain any required consent before
collection.

### Consumer health data sources

We receive consumer health data from:

- you, including information you type, select, photograph, scan, or ask the app to
  record;
- your device, browser, operating system, camera, notification system, clock, and
  location sensors when you grant the relevant permission and use the feature;
- calculations performed locally by Vigorune;
- Apple or Google identity and billing systems (and Stripe only if compliant web
  billing is later added — deferred, not offered at launch);
- OpenAI when you request and receive a meal-photo estimate;
- USDA FoodData Central and Open Food Facts when you request remote food data;
- Supabase, Vercel, Upstash, QStash, and the browser push service when they return
  authentication, storage, delivery, security, or operational records; and
- authorized Vigorune personnel when they issue a complimentary grant, resolve a
  support request, review a dispute, or document a security event.

### Consumer health data we disclose

The table describes disclosures conservatively. A service may legally be a
processor rather than a third party, but we identify it so you can understand
where information goes.

| Recipient or category                                         | Consumer health data disclosed                                                                                                                                                                                                                                                       | Purpose and conditions                                                                                                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase                                                      | Mandatory account identifier, Apple/Google identity metadata, sessions, Terms/policy acceptance, trial, entitlement, complimentary grant/private administrative note, offline lease, security events; optional fitness snapshot and daily nutrition only after separate cloud opt-in | Authentication, account/access operation, security, and optional backup. The target must keep mandatory identity/entitlement tables separate from optional fitness-backup tables |
| Apple                                                         | Apple sign-in events and identifiers; App Store product/transaction/subscription/refund verification associated with a Vigorune account                                                                                                                                              | Authentication and Apple-platform billing/access. Vigorune does not send fitness records to Apple merely to authenticate or verify billing                                       |
| Google                                                        | Google sign-in events and identifiers; Play product/order/purchase-token/subscription/refund verification associated with a Vigorune account                                                                                                                                         | Authentication and Google Play billing/access. Vigorune does not send fitness records to Google merely to authenticate or verify billing                                         |
| Stripe (deferred — not offered at launch)                     | Account/customer mapping, product/price, subscription, invoice/payment status, webhook and fraud/dispute information; Stripe separately processes payment method and transaction data                                                                                                | Would apply only if compliant web billing is later added. **At launch, billing is Apple In-App Purchase and Google Play Billing only**, and no web flow or Stripe integration is offered |
| OpenAI                                                        | Meal photo, optional note, response format/instructions, and technical request metadata; no intentionally supplied Supabase account ID                                                                                                                                               | Only when you explicitly request AI meal analysis after a provider-specific disclosure                                                                                           |
| USDA FoodData Central                                         | Search query, provider record ID, or barcode and technical request metadata from Vigorune's server                                                                                                                                                                                   | Only when you request remote food search, details, or barcode lookup                                                                                                             |
| Open Food Facts                                               | Search query, barcode, language, application-identifying User-Agent, and technical request metadata from Vigorune's server                                                                                                                                                           | Only when you request or trigger the disclosed fallback lookup; no Vigorune account ID or fitness history is intentionally sent                                                  |
| Vercel                                                        | API requests and infrastructure metadata; may include request path, IP/network information, user-agent, status, region, timing, and data needed by a requested server feature                                                                                                        | Host and secure Vigorune's web app and API routes. Application logging is designed not to log request bodies, but platform logging must be verified                              |
| Upstash Redis and QStash                                      | Short-lived authentication relay; HMAC-derived rate-limit keys/counters; push subscription endpoint/public keys, timer ID, completion time, revision, and message status                                                                                                             | Authentication handoff, abuse prevention, and an optional rest-timer push requested by you                                                                                       |
| Browser/platform push service                                 | Push endpoint and encrypted notification delivery, which can reveal that a rest-timer notification was requested                                                                                                                                                                     | Deliver an optional timer notification after separate permission and disclosure                                                                                                  |
| Configured feedback provider and authorized support personnel | Feedback text and app/build/language/online/user-agent context; health information only if you include it                                                                                                                                                                            | Deliver and answer feedback you choose to submit                                                                                                                                 |
| Professional advisers, transaction parties, and authorities   | Only what is reasonably necessary                                                                                                                                                                                                                                                    | Comply with law, investigate an incident or claim, protect rights/safety, or complete a protected corporate transaction                                                          |

Vigorune is operated by a single individual with no affiliates, so we have not
identified any affiliate with which Vigorune shares consumer health data.

**[[PUBLICATION BLOCKER — PB-20]]** Confirm all processors/subprocessors,
production SDKs, and data-flow contracts. Re-verify the "no affiliate" statement
if an entity is later formed, and add every relevant recipient before publication.

**[[PUBLICATION BLOCKER — PB-04, PB-08, PB-09, PB-10]]** Verify the exact
production services, regions, plans, contracts, provider log fields, retention,
subprocessors, and deletion support. The feedback destination and platform push
services are not yet factually fixed. Do not publish a conditional provider list
unless every listed provider can actually receive data and the wording remains
accurate for each distributed build.

### No sale, advertising, or geofencing

Vigorune does not sell consumer health data. It does not exchange consumer health
data for money or other valuable consideration, use it for advertising, allow
cross-context behavioral advertising, or use a geofence around a health care
facility to identify, track, collect data from, or send messages to a consumer.

> Internal note: Both the Washington and Nevada statutes prohibit geofencing
> around health-care facilities; Nevada fixes the radius at **1,750 feet** of a
> medical facility. Vigorune uses precise location only for user-initiated run
> tracking and must not build any facility geofence.

If Vigorune ever proposed to sell consumer health data, it would first require a
separate, valid, signed authorization containing the legally required details.
General Terms, this policy, and a cloud-backup toggle would not authorize a sale.

**[[PUBLICATION BLOCKER — PB-20]]** Contracts must prohibit processors from
selling, advertising with, reidentifying, or independently using consumer health
data. Confirm there are no advertising, attribution, analytics, or data-broker
SDKs in the production app.

### Consent and choices

Consent for consumer health data is a clear, specific, informed, voluntary
opt-in. It is not acceptance of a general Terms agreement. Where consent is the
basis for sharing, the sharing consent must be separate and distinct from the
collection consent. Vigorune will not use a prechecked box, inactivity, or a
deceptive interface as consent.

| Action                                                | Separate choice required                                                                               | What the choice must explain                                                                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accept Terms and acknowledge policies                 | Its own affirmative action                                                                             | Contract/policy version and effective time. It does not grant optional health-data consent                                                                |
| Create the required Apple/Google account              | Intentional provider sign-in                                                                           | Provider identity fields, Supabase processing, session persistence, mandatory access records, and how to delete the account                               |
| Start the 14-day no-card trial                        | Explicit start action separate from paid purchase                                                      | One-trial rule, start/end, no payment method, no automatic conversion, no charge, and what locks at expiry                                                |
| Buy a monthly subscription                            | Store purchase confirmation separate from trial (Apple In-App Purchase or Google Play Billing at launch; web/Stripe deferred) | Price/currency actually presented by the store, renewal interval, auto-renewal, cancellation route, the billing platform as merchant of record, and that cancellation does not delete local data |
| Record local workouts, nutrition, bodyweight, or runs | Feature entry/start action plus any required first-use collection notice                               | Local categories and purpose. Location and camera also require operating-system permission                                                                |
| Enable cloud fitness backup                           | Separate, unbundled opt-in; separate sharing consent where required                                    | Exact categories, readable account-linked storage, Supabase, daily-nutrition behavior, exclusion of detailed GPS, retention, deletion, and withdrawal     |
| Request AI meal analysis                              | Prominent OpenAI disclosure and affirmative permission, not merely camera permission                   | Photo/note categories, purpose, provider, provider retention exceptions, review requirement, and how to decline                                           |
| Request remote food/barcode lookup                    | Clear first-use or per-request disclosure; separate health-data consent if counsel determines required | Query/barcode, USDA/Open Food Facts, purpose, provider logging unknowns, and local saving of selected results                                             |
| Enable a rest-timer push                              | Browser/OS notification permission plus distinct in-app health-data disclosure/consent                 | Push endpoint/keys, timer/completion time, QStash/push service, retention, withdrawal/cancel behavior                                                     |
| Submit feedback                                       | Submit action after a destination/context disclosure; separate consent if health data is included      | Exact provider, message/context fields, staff access, retention, and deletion route                                                                       |
| Sell consumer health data                             | Not offered                                                                                            | Would require a distinct signed authorization; Terms or other feature consents cannot be reused                                                           |

You may withdraw optional consent at any time through the feature setting or the
privacy-request channel. Withdrawal stops future collection or sharing based on
that consent; it does not undo completed processing or remove information that
must lawfully be retained. A withdrawal control must also explain whether existing
data is kept or deleted and offer a deletion request.

**[[PUBLICATION BLOCKER — PB-14]]** No target consent ledger or these target UI
flows exist. Implement a versioned record of the disclosure, categories, purpose,
recipients, user action, time, withdrawal, and policy version without storing
unnecessary health detail. Counsel must decide which on-device processing is
"necessary to provide a requested service" and which collection/sharing needs
consent in each state. Apple/Google permission prompts do not replace statutory
consent.

### Your consumer health data rights

Subject to applicable law, you may:

- confirm whether we collect, share, or sell your consumer health data;
- access the consumer health data we control;
- receive a list of third parties and affiliates with whom we shared or sold it,
  plus available contact information required by law;
- correct inaccurate consumer health data where applicable;
- withdraw consent from future collection or sharing;
- request deletion of consumer health data from our active systems and require us
  to notify relevant affiliates, processors, contractors, and third parties;
- obtain a portable local export; and
- appeal a refusal to act on a request.

If you are in the EEA or the UK, you also have the GDPR/UK GDPR rights (access,
rectification, erasure, restriction, portability, objection, withdraw consent, and
complaint to a supervisory authority such as your Data Protection Authority or the
UK ICO) described in the general Privacy Policy's EEA/UK section, with the one-month
GDPR response time; those rights apply in addition to the consumer-health rights
listed above.

Submit a request or appeal by emailing **adamshugart31@gmail.com** or through the
in-app privacy-request path. We will use reasonable methods to authenticate you
and will not require unnecessary consumer health data. An authorized agent may act
where applicable law permits and the agent's authority and your identity can be
verified.

The target operational schedule is:

- acknowledge and substantively respond within **45 days** unless a lawful,
  disclosed extension applies (Washington and Nevada both permit one 45-day
  extension where reasonably necessary);
- for a verified deletion request, delete covered data from active records and,
  where required, from all parts of the network;
- notify processors and covered recipients of the deletion request;
- complete deletion from restored archives or backups no later than **six months**
  after authenticating the request where Washington's rule applies;
- decide an appeal within **45 days** and provide the applicable attorney-general
  contact if the appeal is denied.

> Internal note: Nevada's deletion rule and Washington's differ in detail;
> Washington fixes the six-month outer bound for deleting from archived/backup
> systems (RCW 19.373.040). This draft uses the shorter/stricter deadline where
> they differ. Confirm the exact figure that applies once counsel fixes
> jurisdiction (PB-13).

The local export covers local fitness records, including detailed GPS samples. It
does not by itself export Supabase identity, Terms/consent history, trial,
entitlement, billing, complimentary-grant/private note, offline lease,
security/fraud records, provider logs, or a historical recipient list. Those must
be provided through the privacy-request workflow where legally required.

Account deletion and local deletion remain distinct. Deleting the server account
must remove app-controlled live identity and optional cloud rows and notify
covered processors, subject to verified provider backup timing and a narrowly
documented legal exception. It must not erase local fitness records. Canceling or
expiring access also must not erase local records. A locked user retains legal,
authentication, billing, account, and export routes.

**[[PUBLICATION BLOCKER — PB-11]]** None of the target access/list/withdrawal/
processor-propagation/appeal workflows or deadlines is implemented. Build, staff,
test, and document them before promising these deadlines. Confirm each provider
can honor deletion, especially OpenAI safety/abuse records, payment and fraud
records, Vercel/Upstash logs, store records, and Supabase backups/PITR. Document
every statutory exception rather than using a general "legal" hold.

### Retention and deletion

Local consumer health data stays on the device until you or the operating system
removes it. Optional cloud health data stays in the live Supabase tables until you
delete it or the account, and backup copies must follow the verified deletion
schedule. Target trial, entitlement, consent, billing, grant, lease, security, and
fraud records use a record-specific internal schedule.

> Internal note: The record-by-record schedule belongs in an internal **Data,
> Retention, and Deletion Matrix** that does not yet exist (pending PB-04–PB-11,
> PB-16–PB-17). Do not cite a published matrix in consumer copy until it is
> written and approved.

No target provider retention period is final merely because a provider publishes a
plan maximum or general privacy policy. Production plan, region, settings,
contract, log drains, backup/PITR, legal obligations, and deletion interfaces
control the actual period.

**[[PUBLICATION BLOCKER — PB-04 through PB-11, PB-16, PB-17]]** Approve and
technically enforce the complete retention schedule. Washington's six-month
maximum for deletion from archived/backed-up consumer health data is the target
outer bound wherever that law applies; Nevada's longer archive maximum is not used
to lengthen the Washington period.

### Security

We restrict consumer health data access to personnel and processors that need it
for a disclosed purpose. Target safeguards include authorization checks, row-level
access controls, scoped service credentials, transport encryption, rate limiting,
validation, access/audit records, processor instructions, and an incident-response
process appropriate to sensitive health information. Local device security remains
important, especially for unencrypted exports.

**[[PUBLICATION BLOCKER — PB-04, PB-08, PB-12, PB-16, PB-20]]** Verify these
controls in production, execute required processor agreements, create and test the
FTC Health Breach Notification Rule and state-breach playbooks, identify the
incident decision-maker, and establish a protected incident evidence schedule. The
FTC has stated that a diet app combining user-entered weight with an API for
calorie information has a good chance of being a covered personal health record;
Vigorune's final HBNR status requires counsel review, not a product disclaimer.

### Changes

We will prominently post this policy in the app, on the public site, and on the
app-store/download pages as required. Before collecting, using, or sharing an
additional category of consumer health data or using it for an additional purpose,
we will update the disclosure and obtain affirmative consent where required. A
material change does not retroactively expand earlier consent.

### Contact

**Data controller: Adam Shugart** (individual sole proprietor, Texas, United
States)

Email: **adamshugart31@gmail.com**

Postal address: [[PUBLICATION BLOCKER — PB-01: insert a monitored public postal
address; do not publish a home address]]

Website / app origin: [[PUBLICATION BLOCKER — PB-01: confirm the public app
origin]]

EU representative (GDPR Art. 27): [[PUBLICATION BLOCKER — PB-21: appoint/name, or
exclude the EEA/EU from launch — see the general Privacy Policy]]

UK representative (UK GDPR Art. 27): [[PUBLICATION BLOCKER — PB-21: appoint/name,
or exclude the UK from launch — see the general Privacy Policy]]

---

## Primary legal sources (internal compliance record)

Verified on **August 19, 2026** against current text (see the general Privacy
Policy appendix for full citations and store/provider sources):

- **Washington My Health My Data Act, chapter 19.373 RCW** — effective March 31,
  2024 (small businesses June 30, 2024); geofence prohibition effective July 23, 2023. Broad consumer-health-data definition (.010); required privacy policy
  (.020); separate-and-distinct collection vs sharing consent (.030);
  confirm/access, withdraw, delete, deletion from archived/backup systems within a
  **six-month** outer bound, third-party/processor deletion notification, 45-day
  response (one 45-day extension), and 45-day appeal decision (.040); health-care
  facility geofence ban (.060). Private right of action under the Washington
  Consumer Protection Act.
  [Full text](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373&full=true) ·
  [RCW 19.373.040](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373.040)
- **Nevada consumer-health-data law, NRS 603A.400 et seq. (SB 370, 2023)** —
  effective March 31, 2024. Consumer-health-data definition tied to health status;
  required policy; separate consent for collection vs sharing; confirm, third-party
  list, cease, and delete rights; 45-day appeal decision; 1,750-foot medical-
  facility geofence ban; **no private right of action** (deceptive-trade-practice
  enforcement by the Attorney General).
  [NRS ch. 603A](https://www.leg.state.nv.us/nrs/nrs-603a.html) ·
  [SB 370 enrolled](https://www.leg.state.nv.us/Session/82nd2023/Bills/SB/SB370.pdf)
- **FTC Health Breach Notification Rule, 16 CFR part 318 (amended)** — final rule
  published May 30, 2024, effective **July 29, 2024**; covers vendors of personal
  health records and PHR-related entities **not covered by HIPAA**; health apps and
  connected devices are expressly in scope; PHR turns on the technical capacity to
  draw health information from multiple sources (e.g., user entry plus an API).
  [FTC compliance guide](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0) ·
  [Federal Register](https://www.federalregister.gov/documents/2024/05/30/2024-10855/health-breach-notification-rule)
- **HIPAA** — not applicable: a consumer app operated directly for individuals is
  neither a covered entity nor a business associate (45 CFR parts 160/164). Do not
  claim "HIPAA compliant."
- **EU GDPR / UK GDPR (worldwide layer)** — fitness, nutrition, bodyweight, and run
  data are "data concerning health," a special category under Art. 9(1) processed
  on explicit consent under Art. 9(2)(a); Art. 6(1) lawful bases; data-subject
  rights (Arts. 15–22, 7(3)) with a one-month response (Art. 12(3)); Art. 27 EU and
  UK representatives; Chapter V transfers (Arts. 44–49, SCCs/UK IDTA/Addendum,
  EU–US Data Privacy Framework where the importer is certified); Art. 37 DPO
  triggers. Full citations, verified August 19, 2026, are in the general Privacy
  Policy appendix.
  [Art. 9](https://gdpr-info.eu/art-9-gdpr/) ·
  [Art. 27](https://gdpr-info.eu/art-27-gdpr/) ·
  [ICO international transfers](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/)
- **Apple** — [App Review Guidelines §§ 5.1.1–5.1.3](https://developer.apple.com/app-store/review/guidelines/)
  (consent, third-party AI disclosure/permission, minimization, health/fitness,
  privacy policy, deletion).
- **Google Play** — [prominent disclosure and consent](https://support.google.com/googleplay/android-developer/answer/11150561),
  [Health Content and Services policy](https://support.google.com/googleplay/android-developer/answer/16679511).
