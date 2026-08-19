# Vigorune Privacy Policy — Working Draft

> **Status: DO NOT PUBLISH.** Working draft for the owner-approved subscription
> target, prepared August 19, 2026 and revised the same day for a **worldwide**
> distribution footprint (see the globalization note below). It is **not** the
> policy for the verified current release and is **not** legal advice. Every
> remaining `[[PUBLICATION BLOCKER]]` must be resolved, the final product must be
> tested against the policy, and qualified counsel must approve the result before
> publication.

> **Globalization pass (2026-08-19).** Superseding the earlier US-only working
> assumption, the owner has decided Vigorune will be offered **worldwide** with a
> **minimum age of 18+** at launch and **Apple In-App Purchase plus Google Play
> Billing as the only billing paths** at launch (web/Stripe deferred). This
> revision therefore adds an EU **GDPR** and **UK GDPR** layer (special-category
> health-data consent, Article 6 lawful bases, data-subject rights, Chapter V
> international transfers, an Article 27 EU/UK representative blocker, a
> cookies/local-storage note, and a DPO-not-required rationale) while **keeping**
> the US layer (FTC Health Breach Notification Rule, Washington My Health My Data,
> Nevada SB 370, and the general US state-privacy note), which still applies to US
> end users under worldwide distribution. Because the minimum age is now 18+,
> COPPA (under-13) and the GDPR Article 8 child-consent age variation drop off the
> **launch** surface and are treated as deferred/future work, not launch gates.
> Nothing here claims any target behavior is implemented.

---

## How to read this document (internal orientation — not consumer-facing)

This file has three kinds of content, kept deliberately separate:

1. **Internal notes** — everything above the `## Privacy Policy` heading, plus
   each indented `> Internal note` block and each `[[PUBLICATION BLOCKER]]`
   callout. Remove all of it before anything is shown to a user.
2. **Consumer-facing policy copy** — the numbered/headed sections under
   `## Privacy Policy`. This is the only text that would ever be published.
3. **Verified primary-source appendix** — the citations at the end, retained as
   an internal compliance record.

### Owner-approved facts already applied in this revision

The following were confirmed by the owner and are now filled into the copy. They
are recorded here so a reviewer can see what changed from the prior draft.

| Field                        | Prior placeholder        | Applied value                                                                                                                                 |
| ---------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider identity            | `[LEGAL NAME]`           | **Adam Shugart, an individual (sole proprietor), Texas, USA — no LLC or other entity**                                                        |
| Public privacy/contact email | `[PUBLIC PRIVACY EMAIL]` | **adamshugart31@gmail.com**                                                                                                                   |
| Minimum age                  | ~~13~~ (superseded)      | **18+ at launch** — under-18 handling deferred to future work                                                                                 |
| Launch territories           | ~~United States only~~   | **Worldwide** (owner decision, 2026-08-19) — triggers the EU/UK GDPR layer below; counsel to confirm any excluded countries/App Store regions |
| Launch billing               | (open)                   | **Apple In-App Purchase + Google Play Billing only**; the platform is merchant of record and Vigorune generally does not receive card details; web/Stripe deferred |

### Blockers resolved by owner input

- **PB-02 (entity / jurisdiction):** Resolved for privacy-document identity
  purposes — Vigorune is operated by Adam Shugart as an individual in Texas.
  There is no LLC and no affiliate. A residual counsel question (whether to form
  an entity before recurring billing) is a business decision, not a gap in this
  policy's identity fields.
- **PB-18 (minimum age):** Superseded — the launch minimum age is now **18+**,
  not 13+. This **narrows** the launch surface: because no under-18 user is
  supposed to onboard, COPPA (US under-13) and the GDPR Article 8 child-consent
  age variation (13–16, member-state dependent) are **out of scope for launch**
  and treated as deferred/future work. Still required before publication: an
  age-gate/verification flow that actually enforces the 18+ floor, aligned App
  Store / Google Play age ratings, and onboarding/Terms/deletion copy that matches
  the 18+ model. Minor handling (guardian consent, 13–17 flows) is documented as a
  future feature, not a launch gate.
- **PB-01 (public contact):** Partially resolved — the public contact email is
  now `adamshugart31@gmail.com`. A published **postal address remains a
  blocker** and is now **more** load-bearing under worldwide distribution: the
  GDPR/UK GDPR require the controller's identity and contact details, Apple/Google
  expect a reachable contact, and several US state laws expect a postal contact.
  The owner will not publish a home address, so a monitored non-home postal
  address must be arranged. The personal phone number is intentionally **not**
  published.

### Blockers deliberately kept open

- **PB-03** (implement-and-verify the target behavior before this replaces the
  live policy), **PB-13** (Washington / Nevada consumer-health applicability — the
  owner's Texas residence does **not** remove obligations to end users located in
  Washington or Nevada), and all server/provider/retention blockers
  (PB-04–PB-11, PB-14, PB-16, PB-17, PB-20) remain open.
- **PB-12 / territories** is now **decided as worldwide** rather than left as a
  US-only assumption; it stays open only for counsel to confirm any excluded
  countries or App Store storefronts. Choosing worldwide is what opens the three
  new EU/UK blockers below.

### New blockers opened by the worldwide decision

- **PB-21 (EU/UK Article 27 representative):** A US individual with no
  establishment in the EU or UK who offers a service to people located in the EU
  or UK generally **must appoint a representative** in the Union and, separately,
  in the UK (GDPR Art. 27; UK GDPR Art. 27). The narrow Art. 27(2) exemption
  (occasional processing that does **not** include large-scale special-category
  data) is unlikely to apply because Vigorune's core purpose processes
  special-category health data. **Recommendation:** either appoint paid EU and UK
  representatives before offering the app in those regions, or geofence the app
  out of the EU/EEA and UK at launch. Detailed at the "EU and UK representative"
  section below.
- **PB-22 (international data transfers / processor DPAs):** Vigorune's processors
  (Supabase, OpenAI, the feedback destination, Vercel, Upstash, and the push
  service) process personal data in the United States and elsewhere. Transfers of
  EU/UK personal data to them require a valid Chapter V mechanism (an adequacy
  decision such as the EU–US Data Privacy Framework where the importer is
  certified, or Standard Contractual Clauses / the UK IDTA or Addendum otherwise)
  **and** a signed data-processing agreement with each processor. As an individual
  (not an organization under FTC/DoT jurisdiction), the owner generally cannot
  self-certify to the Data Privacy Framework, so SCCs/IDTA are the practical route.
  Executing these DPAs and transfer terms is an **operational blocker**.
- **PB-23 (EU/UK consent, cookies, and rights operations):** The special-category
  health-data explicit-consent flow, the cookie/local-storage disclosure, and the
  GDPR/UK GDPR data-subject-rights workflow (access, rectification, erasure,
  portability, objection, restriction, withdraw consent, and complaint to a
  supervisory authority) must be implemented, staffed, and tested before the EU/UK
  copy below can be published.

### Change note (2026-08-19): privacy-first launch analytics added (shipped OFF)

Step 2 of `docs/LAUNCH_PLAN.md` added an anonymous, first-party usage-metrics
capability (full detail in `docs/ANALYTICS.md`). It is **shipped disabled** —
double-gated behind the `VITE_ANALYTICS_ENABLED` build flag **and** server Redis
configuration — and collects nothing until deliberately enabled. This draft
therefore still does **not** describe analytics as live. When enabled it records
only four anonymous events (app opened, workout logged, meal logged, run tracked)
as an event name plus a coarse day (`YYYY-MM-DD`), tagged with a random
`localStorage` install id that is not linked to any account, email, precise
location, or fitness data; no health values are ever in the payload. It respects
Do-Not-Track / GPC and a local opt-out. Before enabling it for real users,
reconcile the copy below that currently asserts "no analytics":

- **"Cookies and local storage" (EEA/UK):** currently says Vigorune "does not use
  advertising, analytics, or cross-site tracking cookies." The install id is a
  first-party, non-cross-site local-storage identifier, but update this to
  disclose first-party usage analytics if enabled, and confirm the ePrivacy
  analysis (strictly-necessary vs. consent-required) for that identifier (PB-23).
- **"U.S. state disclosures":** says the app "does not track users over time
  across third-party services." Keep accurate — the metric is anonymous,
  first-party, and not cross-context behavioral advertising — but confirm wording
  against the Washington/Nevada consumer-health-data definitions (PB-13).
- Add the `/api/analytics` endpoint and the Redis/Upstash processor to the
  processor inventory (PB-20) and the retention schedule (the stored event list is
  capped to the newest 100,000 entries).

---

## Release/target boundary (internal — remove before publication)

> Internal note: This table exists so no one mistakes the target design for
> shipped behavior. The **current** in-app policy in
> `src/pages/PublicInformationPages.tsx` remains the source of truth for
> current-release behavior until PB-03 is closed.

| Verified current release                                                                                                       | Owner-approved target described by this draft                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core features work without an account. Apple/Google authentication and cloud backup are optional.                              | Apple or Google authentication through Supabase is mandatory for app access.                                                                                        |
| Signing in starts automatic readable cloud snapshots and daily-nutrition uploads; there is no independent cloud-backup opt-in. | Identity and entitlement records are mandatory, but fitness records stay on the device unless the user separately enables cloud backup.                             |
| There are no Terms-acceptance, trial, entitlement, complimentary-grant, offline-lease, or billing records.                     | One server-recorded 14-day no-card trial; a monthly auto-renewing subscription; service-role-only complimentary access; and limited server-verified offline access. |
| The app has no subscription lock or retained-access route set.                                                                 | A locked user keeps access to legal, authentication, billing, account, and export routes. Cancellation or expiration never deletes local fitness records.           |

**[[PUBLICATION BLOCKER — PB-03]]** Implement and verify every target behavior
above before this draft replaces the current in-app policy. The target also
conflicts with the frozen Version 1 scope in `docs/V1_SCOPE_FREEZE.md`; the
binding product documents must be reconciled by an expressly approved change
before implementation or publication.

**[[PUBLICATION BLOCKER — PB-01 (residual)]]** Insert a monitored public
**postal address** and confirm the public **app origin / website URL**. The
contact email (`adamshugart31@gmail.com`) is set; the postal address and origin
are not.

**[[PUBLICATION BLOCKER — PB-12 / territories]]** Territories are now decided as
**worldwide**. Confirm only the specific countries or App Store / Google Play
storefronts (if any) that will be **excluded**, and confirm that the EU/UK GDPR
sections, the US state-law sections, and the Article 27 representative arrangements
below are all in place before offering the app in each region.

**[[PUBLICATION BLOCKER — PB-24 / billing footprint]]** Launch billing is **Apple
In-App Purchase and Google Play Billing only**; each platform is the merchant of
record for its store, and Vigorune generally does not receive full card details.
Web/Stripe billing is **deferred**. Every reference to Stripe or a web payment
form in the copy below is retained as **future/conditional** and must be removed
or gated so the published policy does not describe a billing path that is not
offered in the shipped build.

---

## Privacy Policy

**Effective date:** [[PUBLICATION BLOCKER — EFFECTIVE DATE: set on the day
counsel approves publication]]

Vigorune is provided by **Adam Shugart**, an individual sole proprietor located
in Texas, United States ("Vigorune," "we," "us," or "our"). For data-protection
laws that use the term, Adam Shugart is the **data controller** who determines the
purposes and means of processing the personal data described here. This Privacy
Policy explains what information Vigorune processes, why, on what legal basis,
where it goes, how long it is kept, and the choices available to you. Our separate
[Consumer Health Data Privacy Policy](./CONSUMER_HEALTH_DATA_PRIVACY_POLICY_DRAFT.md)
provides additional disclosures and rights for consumer health data.

Vigorune is offered **worldwide**. Some rights and obligations described here
depend on where you are located. If you are in the European Economic Area (EEA) or
the United Kingdom, the **"Your rights in the EEA and the UK (GDPR and UK GDPR)"**
section applies to you in addition to the general terms. If you are a US resident,
the **"U.S. state disclosures"** and the separate Consumer Health Data Privacy
Policy also apply. The minimum age to use Vigorune is **18**.

Vigorune is a fitness logging tool, not a medical provider or medical device. It
does not diagnose, treat, cure, or prevent a medical condition.

### Vigorune and HIPAA

Vigorune is **not** a HIPAA covered entity (health plan, health care
clearinghouse, or health care provider that transmits health information in a
covered standard transaction) and is not a business associate of one. Your use
of Vigorune is not covered by HIPAA, and **Vigorune does not claim to be "HIPAA
compliant."** Because Vigorune is a consumer health application that handles
health-related information outside HIPAA, other frameworks may apply instead —
including the U.S. Federal Trade Commission's Health Breach Notification Rule and
state consumer-health-data laws. See the sections below and the separate
Consumer Health Data Privacy Policy.

> Internal note: The FTC Health Breach Notification Rule (16 CFR part 318, as
> amended, effective July 29, 2024) applies to vendors of personal health
> records and PHR-related entities **that are not covered by HIPAA** — precisely
> the category Vigorune could fall into. Do not treat "HIPAA does not apply" as
> "no health-data law applies." See **PB-12** and the appendix.

### The most important distinction: account data is not fitness backup

The target version requires an Apple or Google sign-in so that Vigorune can
create an account and determine trial or paid access. The following records are
mandatory even if you do not enable cloud backup:

- the account identifier and identity metadata supplied through Apple or Google
  and processed by Supabase;
- authentication sessions and security events;
- the version and time of Terms and policy acceptance;
- trial dates and status;
- subscription, entitlement, purchase-verification, refund, and cancellation
  status;
- any service-role-issued complimentary-access grant and limited internal note;
- limited offline-access lease information; and
- records needed for fraud prevention, dispute handling, accounting, tax, or
  other legal obligations.

These mandatory records do **not** authorize Vigorune to upload your workouts,
nutrition logs, bodyweight records, run history, or precise GPS samples. Fitness
backup is a separate, optional choice.

**[[PUBLICATION BLOCKER — PB-04, PB-05, PB-06, PB-07, PB-16, PB-17]]** Finalize
the production identity fields, entitlement schema, billing-provider fields,
security/fraud fields, internal-note rules, offline-lease design, and the
record-by-record retention schedule before publishing this section.

### Information kept on your device

Vigorune stores its fitness records in application storage on your device. That
information can include:

- profile and preference information, such as units, language, height, age, sex,
  activity level, weight goal, calorie and macro targets, and calculation inputs;
- exercise definitions, workout programs, active workouts, sets, repetitions,
  weight, effort estimates, rest times, notes, program-change reviews, and
  workout history;
- foods, recipes, saved meals, food-search cache entries, nutrition logs,
  serving information, notes, calorie and macro totals, and provider attribution;
- bodyweight entries and notes;
- run summaries, classifications, pauses, splits, and precise GPS samples such as
  latitude, longitude, time, accuracy, and altitude;
- local settings, app metadata, and pending timer or notification state; and
- locally stored integration settings or credentials, if a released feature
  provides them.

This information remains on the device until you delete it, clear the app's
storage, uninstall in a way that removes storage, or the operating system removes
it. Browser and operating-system behavior can remove local storage without
warning. Signing out, canceling a subscription, reaching the end of a trial, or
deleting the server account does not delete local fitness records.

Vigorune does not receive local-only fitness records merely because they are
stored by the app. Features described below can send limited information off the
device when you choose to use them.

### Account, authentication, and acceptance records

When you sign in with Apple or Google, that provider authenticates you and sends
account information to Supabase. Depending on the provider configuration and what
you allow, this can include a provider-specific identifier, email address,
email-verification status, display/profile metadata, provider identity metadata,
and authentication timestamps. Supabase stores the Vigorune user identifier,
linked identity, session, and related authentication records. The Vigorune app
persists a session on the device so you can remain signed in.

Vigorune will separately record the version and time of your Terms and policy
acceptance. Terms acceptance documents the contract; it is not consent to
optional cloud backup, AI analysis, notifications, or other optional sharing of
consumer health data.

For an installed iOS web-app authentication handoff, the verified current code
uses a one-time Redis relay. It temporarily stores a random relay identifier, a
SHA-256 digest of a retrieval secret, relay status, and an OAuth authorization
code for up to five minutes, and deletes the record when consumed. Access
tokens, refresh tokens, email addresses, and fitness records are not placed in
that relay.

**[[PUBLICATION BLOCKER — PB-04]]** Confirm Apple/Google scopes, actual Supabase
user metadata, session settings, Redis provider/region/plan, authentication
logs, backup/PITR behavior, subprocessors, contracts, and deletion behavior in
the production projects.

### Trial, subscription, and access records

Vigorune's target offer is one 14-day, no-card trial recorded by the server. The
trial does not ask for a payment method, does not become a subscription, does not
auto-convert, and cannot charge you. At launch, starting a paid subscription
requires a separate purchase through **Apple In-App Purchase or Google Play
Billing**. On those stores the platform is the merchant of record for the
transaction, sets the price in your local currency, and processes your payment
method; Vigorune generally does not receive your full payment-card details. A
web/Stripe checkout is **not offered at launch** and is described below only as a
possible future path.

To operate access, prevent repeated trials, verify purchases, handle refunds and
cancellations, and respond to billing disputes, Vigorune expects to store:

- the Vigorune user identifier, trial start and end, trial status, and the event
  that created or ended the trial;
- entitlement status, source, product, start/end times, verification times, and
  reason for a status change;
- Apple or Google product, transaction/order, purchase token or signed
  transaction, subscription status, expiration, renewal, cancellation, refund,
  and verification metadata received from the store;
- **(future/deferred — not offered at launch)** for compliant web billing, a
  Stripe customer identifier, subscription identifier/status, product/price,
  invoice/payment status, and webhook event identifiers; and
- narrowly limited fraud, dispute, tax, accounting, and customer-support records.

Vigorune does not receive a full payment-card number from Apple or Google; on
those stores the platform is the merchant of record and processes payment. If a
Stripe web payment form is ever added, Vigorune should still not receive or store
a full payment-card number, but Stripe would process payment and fraud information
under its own privacy terms. No web payment form exists at launch.

A complimentary-access grant may be issued only through a server service role.
Its target record may include the recipient account, grant status, issuer,
reason, dates, and a narrowly limited private administrative note. The note is
not for fitness or medical detail and must not be used for profiling. An offline
lease will contain only what is necessary to prove entitlement for a limited
period, such as the account, entitlement version, issue/expiry time, and a signed
verification value.

**[[PUBLICATION BLOCKER — PB-05, PB-06, PB-07, PB-16, PB-17]]** No trial,
entitlement, billing, complimentary-grant, or offline-lease schema exists in the
verified current release. Finalize exact fields, one-trial anti-abuse logic,
device binding (if any), staff access/audit controls, payment-provider mapping,
country-specific billing flow, tax responsibilities, and retention before using
this copy. Any IP address, device identifier, or fingerprint proposed for trial
or fraud controls is a new data category and must be disclosed before it is
collected.

### Optional cloud backup

Cloud backup must be off until you separately enable it after a clear disclosure
and affirmative choice. Enabling backup will authorize Vigorune to associate an
account identifier with a readable, replaceable fitness snapshot in Supabase. The
proposed snapshot can include settings, workout programs and history, nutrition
entries, bodyweight records, run summaries, and other records listed in the
backup disclosure shown at opt-in. Daily calorie totals and calorie targets must
not be uploaded merely because you signed in; if they are used for the cloud
nutrition graph, they are part of the same separately enabled cloud feature and
must be disclosed.

Detailed GPS samples are excluded from the verified current cloud snapshot and
must remain device-local under this target. A local export can still contain
those samples. Cloud backup is a replaceable snapshot, not real-time
multi-device synchronization. Supabase database administrators and systems can
process the readable snapshot; it is not client-side encrypted with a key held
only by you.

You can withdraw future cloud collection by turning cloud backup off. Turning it
off does not by itself decide whether an existing snapshot is retained; the
control must clearly offer both "turn off and keep" and "turn off and delete," or
use another choice approved by counsel. Deleting cloud data does not delete local
records. Deleting your account deletes app-controlled cloud rows from the live
database, subject to verified backup deletion timing and legal exceptions.

**[[PUBLICATION BLOCKER — PB-03, PB-04, PB-11, PB-14]]** Implement the separate
opt-in and withdrawal controls, settle the precise backup categories, decide the
turn-off behavior, verify Supabase backup/PITR deletion, and test that no fitness
or daily-nutrition row leaves the device before opt-in.

### Meal-photo analysis

Vigorune sends meal photos and an optional note only after you choose AI meal
analysis and review a prominent disclosure naming OpenAI. The Vigorune server
sends the photo and note to OpenAI's Responses API to generate a nutrition
estimate. The current adapter requests `store: false`. Vigorune does not
intentionally send your Supabase account identifier to OpenAI. OpenAI states that
API data is not used to train its models by default unless the customer opts in,
but default abuse-monitoring logs may contain prompts, responses, and metadata
for up to 30 days. OpenAI also describes longer retention for legal or safety
reasons and a special retention path for images/files flagged by its
child-safety scanning.

The estimate is shown for your review. It is not added to your nutrition log
until you explicitly accept it, and you can edit it first. Meal images are not
included in Vigorune local exports or cloud snapshots. The accepted nutrition
result becomes a local fitness record and is backed up only if cloud backup is
enabled.

**[[PUBLICATION BLOCKER — PB-08, PB-14]]** Verify the production OpenAI
organization/project data-control setting, contract, region, model, logging, and
deletion support; implement a separate AI disclosure/permission flow; and confirm
that Vercel, rate-limiting, and error logging do not retain image bodies or
notes. `store: false` must not be described as zero retention.

### Food search and barcode lookup

When you request remote food search or barcode lookup, Vigorune sends the query,
barcode, provider record identifier, and language selection through its server to
USDA FoodData Central or Open Food Facts. The verified current server does not
intentionally send your Vigorune account identifier or fitness history to these
providers. Search terms and barcodes may nevertheless reveal dietary interests.

The server keeps normalized search results in temporary process memory: search
results for up to 15 minutes and detail/barcode results for up to six hours,
subject to serverless-instance eviction and configured bounds. A selected food,
provider identifier, source metadata, serving data, and nutrition values may be
saved on your device until you delete them. Open Food Facts receives an
application-identifying User-Agent, not a user identity.

**[[PUBLICATION BLOCKER — PB-08]]** USDA and Open Food Facts documentation
reviewed for this draft does not specify request-log retention or deletion rights
for the exact API traffic. Confirm the production provider terms, application
registration/contact, logging, subprocessors, and geographic processing, and
decide whether remote lookup requires its own first-use health-data consent.

### Feedback and support

If you submit feedback, Vigorune sends the text you enter and limited context
through its server to the configured feedback destination. Verified current
context includes the app version, build identifier/environment, language, online
status, and full browser user-agent string. Do not include passwords,
authentication codes, payment details, or health information you do not want
support personnel to read. Vigorune does not intentionally attach your fitness
database or account identifier, although your message can identify you.

**[[PUBLICATION BLOCKER — PB-09]]** Production can be configured for either
Discord or Slack and the final destination is unknown. Identify the service,
workspace, channel access, geographic processing, provider retention, internal
retention, deletion procedure, and support personnel before publication. The
public policy and store declarations must name the actual destination or
accurately describe all destinations in use.

### Rest-timer notifications and push delivery

If you enable web push for a rest timer, Vigorune processes the browser push
subscription endpoint and its public encryption/authentication keys, a timer
identifier, completion time, schedule revision, and provider message identifier.
The current server sends the scheduled job through Upstash QStash and then the
browser's push service. The job body is redacted from QStash's dashboard/API, but
the original value remains available to QStash for delivery. QStash states that
delivered messages are removed shortly afterward; account-plan log and
dead-letter retention can still apply. The device stores limited scheduling state
so the job can be canceled or replaced.

Notification permission from the browser or operating system is optional. It does
not replace a clear in-app disclosure and consent for processing or sharing timer
information that may reveal workout activity.

**[[PUBLICATION BLOCKER — PB-08, PB-10, PB-14]]** Verify the QStash/Redis plan,
region, message/log/dead-letter retention, contracts, and the push services used
on each platform; implement the distinct in-app push disclosure/consent and a
provider deletion process.

### Security, fraud prevention, and operational logs

Vigorune uses limited request and security information to protect the service,
enforce rate limits, verify purchases, investigate failures, prevent fraud, and
respond to incidents. The verified current distributed rate limiter creates an
HMAC-derived key from a request scope, IP address, and browser user-agent; it
stores a counter in Redis only for the route's window (generally from one minute
to one hour). The application observer writes request ID, route, method, status,
duration, outcome, provider class, cache status, and limiter availability, not
request bodies. Vercel's platform runtime logs can independently include request
metadata such as user-agent, path, region, status, and timing.

Security, purchase, refund, chargeback, and fraud records may be retained longer
when reasonably necessary to protect accounts, enforce rights, or comply with
law. They are not used for advertising.

**[[PUBLICATION BLOCKER — PB-08, PB-16, PB-17]]** Verify the Vercel and Upstash
plans, log drains, runtime-log fields/retention, production rate-limit windows,
billing fraud fields, staff access, incident evidence holds, and the legal
retention schedule. Do not claim a fixed provider retention period until the
production plans and settings are recorded.

### How we disclose information

We disclose information only as described here:

- to Supabase for mandatory authentication/account/entitlement processing and,
  only after separate opt-in, optional fitness backup;
- to Apple and Google for authentication, purchase, subscription, fraud, refund,
  and billing administration (and, only if web billing is ever added, to Stripe —
  not offered at launch);
- to OpenAI only when you request meal-photo analysis;
- to USDA FoodData Central or Open Food Facts when you request a remote food or
  barcode lookup;
- to Vercel, Upstash, the applicable push service, and the configured feedback
  service to operate the requested service;
- to professional advisers, authorities, or other parties when reasonably
  necessary to comply with law, protect rights and safety, investigate fraud or
  security incidents, or complete a corporate transaction subject to appropriate
  protections; and
- as you otherwise direct or separately consent.

We do not sell personal information or consumer health data. We do not use
fitness records, meal photos, precise location, or health inferences for
advertising. We do not allow cross-context behavioral advertising in Vigorune. If
these practices ever change, we will update the policy and obtain any consent or
signed authorization required before the change.

**International transfers.** Vigorune and its processors are based in, or process
data in, the United States and other countries. When we share your personal data
with a processor, or when you are located outside the United States, your
information may be transferred to and processed in a country whose data-protection
laws differ from your own. Where you are in the EEA or the UK, we describe the
transfer safeguards we rely on in the "International data transfers" subsection of
the EEA/UK section below.

> Internal note: Vigorune is operated by a single individual (Adam Shugart) with
> no LLC and no affiliates, so there is presently no affiliate to name in the
> disclosure list. Re-verify this if an entity is later formed.

**[[PUBLICATION BLOCKER — PB-20]]** Inventory all production processors,
subprocessors, affiliates, SDKs, and analytics; confirm processor contracts
prohibit independent advertising, sale, and use outside documented instructions.

### Retention

We use a record-specific schedule rather than one period for all information:

- local fitness information stays on the device until you or the operating system
  removes it;
- authentication and account records stay while the account is active and for a
  limited verified period afterward;
- Terms/policy acceptance, trial, entitlement, complimentary-grant, offline
  lease, security, and fraud records stay for the shortest period that supports
  their stated purpose;
- optional cloud fitness data stays until it is replaced or deleted, subject to
  verified backup deletion timing;
- temporary authentication relay and rate-limit records expire on short technical
  windows described above;
- provider request and operational logs follow the verified product plan and
  contract; and
- billing, invoice, tax, refund, dispute, and fraud records may remain after
  account deletion when a specific law or defensible legal need requires it.

> Internal note: The target record-by-record schedule and current evidence
> belong in an internal **Data, Retention, and Deletion Matrix** (not yet
> written — pending PB-04–PB-11, PB-16–PB-17). This policy must not cite a
> published matrix until that artifact exists and is approved.

**[[PUBLICATION BLOCKER — PB-04 through PB-11, PB-16, PB-17]]** Every server and
provider period must be confirmed and entered in an approved retention schedule.
"Legally required" is not a retention period; identify the record, governing
jurisdiction, legal basis, period, deletion/anonymization event, and responsible
owner.

### Your choices and rights

Subject to applicable law, you may ask to access, correct, export, or delete
personal information we control; withdraw an optional consent; obtain a list of
third parties or affiliates with whom consumer health data was shared; and appeal
a refusal to act on a consumer-health-data request. If you are in the EEA or the
UK, see "Your rights in the EEA and the UK (GDPR and UK GDPR)" for the specific
rights, legal bases, transfer safeguards, and complaint route that also apply to
you.

The app provides a local fitness export. A locked user retains access to the
export route as well as legal, authentication, billing, and account routes. The
fitness export does not automatically include server identity, entitlement,
billing, security, private administrative-note, provider-log, or cloud-sharing
history records. Use the privacy-request channel for those records.

Deleting the server account removes the Supabase identity and app-controlled live
cloud rows after authentication, subject to verified provider backup timing and
records that must lawfully be retained. It does not delete local fitness records.
Use the separate local clear-data control on each device if you also want to
remove those records. Canceling or allowing a subscription to expire does not
delete the account or local fitness records and does not cancel a subscription on
another billing platform unless that platform confirms it.

Submit a request or appeal by emailing **adamshugart31@gmail.com** or through the
in-app privacy-request path. We may request only the information reasonably
needed to authenticate the request.

**[[PUBLICATION BLOCKER — PB-11]]** Implement and test access, correction,
export, withdrawal, third-party list, deletion propagation, authenticated-agent,
and appeal workflows; set response/deletion deadlines; create the public web
account-deletion path required for Google Play; preserve required locked routes;
and verify Apple token revocation and provider subscription-management handoffs.
Confirm the in-app privacy-request path exists before referencing it in published
copy.

### Your rights in the EEA and the UK (GDPR and UK GDPR)

This section applies if you are located in the European Economic Area or the
United Kingdom. It supplements, and does not replace, the rest of this policy. The
data controller is Adam Shugart (see Contact). Because Vigorune is offered to
people in these regions, the EU General Data Protection Regulation (Regulation
(EU) 2016/679) and the UK GDPR (as retained and amended under the Data Protection
Act 2018) apply.

#### Health data is special-category data

The fitness, nutrition, bodyweight, exercise, and running information you record
in Vigorune — including precise GPS run samples — is **special-category data
concerning health** under Article 9(1) GDPR (and the UK equivalent). Processing
special-category data is prohibited unless a condition in Article 9(2) applies.
Vigorune relies on your **explicit consent** under Article 9(2)(a) for any
processing of that health data that goes beyond deterministic, on-device use —
including uploading it as a cloud backup, sending a meal photo for AI analysis, or
sending a rest-timer notification that can reveal workout activity. You can
withdraw that consent at any time; withdrawal stops future processing based on it
but does not affect processing already carried out.

#### Our legal bases (Article 6 GDPR)

For personal data that is not itself special-category health data, we rely on the
following Article 6(1) lawful bases:

| Processing                                                                                       | Legal basis                                                                                                      |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Creating and operating your account, authenticating you, and providing the subscription service  | **Contract** (Art. 6(1)(b)) — necessary to provide the service you sign up for                                   |
| Trial, entitlement, subscription, purchase-verification, and access-control records              | **Contract** (Art. 6(1)(b)) for providing paid access; **legitimate interests** (Art. 6(1)(f)) for preventing repeated free trials and fraud |
| Security, rate limiting, fraud prevention, and operational logging                               | **Legitimate interests** (Art. 6(1)(f)) — securing the service and its users                                     |
| Keeping billing, tax, accounting, and dispute records                                            | **Legal obligation** (Art. 6(1)(c)) where a specific law requires retention                                      |
| Optional cloud backup, AI meal analysis, remote food/barcode lookup, feedback, push notifications | **Consent** (Art. 6(1)(a)), plus **explicit consent** under Art. 9(2)(a) where health data is involved           |

We will identify the specific basis for any processing on request. Where we rely
on legitimate interests, you may object as described below, and we will re-balance
or stop unless we have overriding legitimate grounds.

#### Your rights

Subject to the conditions and exemptions in the GDPR/UK GDPR, you have the right
to:

- **access** the personal data we hold about you and receive a copy (Art. 15);
- **rectification** of inaccurate or incomplete data (Art. 16);
- **erasure** ("right to be forgotten") in the circumstances set out in Art. 17;
- **restriction** of processing in the circumstances set out in Art. 18;
- **data portability** — receive data you provided in a structured, commonly used,
  machine-readable format and, where technically feasible, have it transmitted to
  another controller (Art. 20);
- **object** to processing based on legitimate interests, and to any direct
  marketing (Art. 21) — Vigorune does not conduct direct marketing;
- **withdraw consent** at any time where processing is based on consent, without
  affecting processing already carried out (Art. 7(3)); and
- **not be subject to solely automated decisions** that produce legal or similarly
  significant effects (Art. 22) — Vigorune does not make such decisions.

To exercise a right, email **adamshugart31@gmail.com** or use the in-app
privacy-request path. We will respond within **one month** as required by Article
12(3), extendable by two further months for complex or numerous requests with
notice. We may ask for information reasonably needed to verify your identity.

You also have the right to **lodge a complaint with a supervisory authority** — in
the EEA, your local Data Protection Authority; in the UK, the Information
Commissioner's Office (ICO) — if you believe our processing infringes the law.

#### International data transfers

Vigorune's processors (for example Supabase, OpenAI, Vercel, Upstash, the push
service, and the configured feedback destination) process personal data in the
**United States** and possibly other countries outside the EEA and UK. Transfers
of EEA or UK personal data to those countries rely on a Chapter V transfer
mechanism, which may include: an **adequacy decision** (Art. 45) — for a US
importer, the EU–US Data Privacy Framework and its UK extension where that importer
is certified; or, where adequacy does not cover the importer, **Standard
Contractual Clauses** (Art. 46) together with the **UK International Data Transfer
Agreement or Addendum**, supported by a transfer risk assessment and additional
safeguards as needed. Where none of those apply, we rely on a derogation under
Article 49 (such as your explicit consent or necessity for a contract) only for
the limited, specific transfer it permits. You may request information about the
safeguards in place for a specific transfer.

**[[PUBLICATION BLOCKER — PB-22]]** Before offering Vigorune in the EEA or UK, a
signed data-processing agreement (Art. 28) and a valid transfer mechanism must be
in place with **every** processor. Confirm, per processor, whether it is certified
under the Data Privacy Framework or whether SCCs / the UK IDTA or Addendum are
required, and record the region of processing. Do not name a specific transfer
mechanism in published copy until it is executed for that processor. As an
individual not subject to FTC or Department of Transportation jurisdiction, the
owner generally cannot self-certify to the Data Privacy Framework, so processor
SCCs/IDTA are the practical mechanism to confirm.

#### EU and UK representative (Article 27)

The controller has no establishment in the EEA or the UK. A controller in that
position that offers goods or services to, or monitors the behaviour of, people in
those regions generally **must designate a representative** — one established in an
EU Member State (GDPR Art. 27) and one in the UK (UK GDPR Art. 27) — to act as a
contact point for supervisory authorities and data subjects. The Art. 27(2)
exemption for occasional processing that does not include large-scale
special-category data is unlikely to apply here because handling health data is
Vigorune's core purpose.

**[[PUBLICATION BLOCKER — PB-21]]** Appoint an EU representative and a UK
representative (a paid third-party representative service is the usual route for a
solo developer), publish their names and contact details in this policy and in the
app/store listings, and reflect them in the Contact section — **or** exclude the
EEA/EU and UK from the launch storefronts so this obligation is not triggered.
This is a conspicuous launch decision, not a formality.

#### Cookies and local storage

Vigorune is an installable web app. It stores data on your device using browser
mechanisms (IndexedDB and local/session storage and, on installed builds, a small
authentication relay) **strictly to make the app work** — for example to keep your
fitness records locally, keep you signed in, and hand off OAuth sign-in. Vigorune
does not use advertising, analytics, or cross-site tracking cookies, so it does not
present a tracking-cookie consent banner. If any non-essential cookie or tracking
technology is ever added, we will obtain consent as required by the ePrivacy rules
before it is used.

**[[PUBLICATION BLOCKER — PB-23]]** Confirm, against the production build, that no
analytics/advertising/tracking storage is present (including anything added by a
future SDK), and implement the explicit-consent, withdrawal, and data-subject-
rights workflows this section promises before the EEA/UK copy is published.

#### Data Protection Officer

We have **not** appointed a Data Protection Officer. A DPO is mandatory under
Article 37(1) only where the controller is a public authority, or where the core
activities require large-scale regular and systematic monitoring, or consist of
large-scale processing of special-category data. Although Vigorune processes
health data, it is a single-operator consumer app whose processing is not
undertaken at the "large scale" the Article contemplates; counsel should confirm
this assessment as the user base grows. This does not remove any other GDPR
obligation, including the Article 27 representative requirement above.

**[[PUBLICATION BLOCKER — PB-23]]** Have counsel confirm the DPO-not-required and
large-scale assessments, document them in an internal record of processing
activities (Art. 30), and revisit if scale or processing changes.

### U.S. state disclosures

The following disclosures apply to Vigorune users located in the United States;
under worldwide distribution they continue to apply to US end users regardless of
the owner's Texas location. California residents can review the categories
collected and disclosed above.
Vigorune does not currently respond differently to browser Do Not Track signals
because it does not track users over time across third-party services for
behavioral advertising, and the target must not add that tracking. Other parties
must not collect that cross-service activity through Vigorune.

Washington and Nevada consumers should read the separate Consumer Health Data
Privacy Policy. Depending on applicable law, consumers may have additional rights
that cannot be waived through Terms.

> Internal note (owner residence vs. end-user location): The owner resides and
> operates in Texas, but the Washington My Health My Data Act (RCW 19.373) and
> Nevada's consumer-health-data law (NRS 603A.400 et seq., SB 370) turn on where
> the **consumer** is, not where the business is. If any user is a Washington or
> Nevada resident or is present in that state, those laws can apply regardless of
> the owner's Texas location. Texas's own Data Privacy and Security Act (TDPSA,
> Tex. Bus. & Com. Code ch. 541) and its "sensitive data" consent rules may also
> apply to Texas residents. Counsel must confirm applicability, the small-business
> thresholds, and any exemptions.

**[[PUBLICATION BLOCKER — PB-12, PB-13]]** Counsel must determine applicability
and operational requirements under the FTC Health Breach Notification Rule (16
CFR part 318), the Washington My Health My Data Act (chapter 19.373 RCW), the
Nevada consumer-health-data law (NRS 603A.400 et seq. / SB 370), the Texas Data
Privacy and Security Act, the California Online Privacy Protection Act, the
California Consumer Privacy Act, and the California Confidentiality of Medical
Information Act. The CCPA revenue/data thresholds, small-business status,
corporate relationships, California medical-information characterization, and all
exemptions are factual unknowns. Build and test an HBNR/state-breach incident
plan before launch. **The owner's Texas residence does not remove Washington or
Nevada obligations to end users located in those states.**

### Minors

Vigorune is intended only for adults **18 and older**. It is not directed to, and
we do not knowingly collect personal data from, anyone under 18. If you believe
someone under 18 has provided information to Vigorune, contact us at
**adamshugart31@gmail.com** and we will delete it. Because the app enforces an
18+ minimum, it does not rely on the GDPR Article 8 child-consent mechanism (which
otherwise applies to users aged 13–16 depending on the EU Member State) and is not
directed to children under US COPPA; both are treated as out of scope for launch.

**[[PUBLICATION BLOCKER — PB-18 (residual)]]** The launch minimum age is **18+**.
Still required before publication: implement an age-gate that actually enforces the
18+ floor, align the App Store / Google Play age ratings and questionnaires with an
adult-only audience, and make onboarding, Terms, and deletion copy consistent with
18+. Any future decision to admit users under 18 would re-open COPPA (US under-13),
the GDPR Article 8 child-consent age variation, and state minor-consent handling as
new launch gates.

### Security

We use administrative, technical, and organizational measures designed to protect
information, including transport encryption, authenticated access, row-level
authorization for app-controlled cloud rows, scoped service credentials, bounded
request bodies, rate limiting, and access restrictions. No system can guarantee
absolute security. You are responsible for protecting your device, Apple or
Google account, and any exported files.

**[[PUBLICATION BLOCKER — PB-04, PB-08, PB-16, PB-20]]** Verify every security
statement against production configuration, complete processor agreements and
access reviews, document encryption/key management and incident ownership, and
avoid implying end-to-end or client-side encryption where none exists.

### Changes to this policy

We will post the updated policy and effective date. If a change adds a category
or purpose for consumer health data, or otherwise requires consent, we will
provide notice and obtain that consent before the new processing. Material
changes will not retroactively expand a prior consent.

### Contact

**Data controller: Adam Shugart** (individual sole proprietor, Texas, United
States)

Email: **adamshugart31@gmail.com**

Postal address: [[PUBLICATION BLOCKER — PB-01: insert a monitored public postal
address; do not publish a home address]]

Website / app origin: [[PUBLICATION BLOCKER — PB-01: confirm the public app
origin]]

EU representative (GDPR Art. 27): [[PUBLICATION BLOCKER — PB-21: appoint and name
an EU representative with an EU address, or exclude the EEA/EU from launch]]

UK representative (UK GDPR Art. 27): [[PUBLICATION BLOCKER — PB-21: appoint and
name a UK representative with a UK address, or exclude the UK from launch]]

> Internal note: The owner's personal phone number is intentionally **not**
> published. Use email and, once available, the postal address only. A published
> geographic address for the controller (and for each Art. 27 representative) is a
> GDPR/UK GDPR expectation, which is why PB-01 and PB-21 gate this section.

---

## Verified primary-source appendix (internal compliance record)

Primary sources reviewed and, where noted, **verified on August 19, 2026**
against current text. Citations are brief; this is not legal advice and does not
substitute for counsel's applicability analysis (PB-12, PB-13, and the new
worldwide blockers PB-21 through PB-24). US and EU/UK sources are grouped below.

**HIPAA non-applicability.** HIPAA's Administrative Simplification rules (45 CFR
parts 160/164) apply to covered entities and business associates. A consumer
fitness/nutrition app operated directly for individuals is neither, so HIPAA does
not govern Vigorune. This is why the FTC Health Breach Notification Rule, which
targets health apps _not_ covered by HIPAA, is the more relevant federal regime.
Do not state "HIPAA compliant."

**FTC Health Breach Notification Rule (16 CFR part 318).** _Verified:_ the FTC's
amended final rule was published May 30, 2024 and took effect **July 29, 2024**;
it applies to vendors of personal health records and PHR-related entities **not
covered by HIPAA**, and the FTC has stated the amendments make clear that health
apps and connected devices are within scope. A PHR is defined by the technical
capacity to draw PHR-identifiable health information from multiple sources
(e.g., user-entered data plus an API). Vigorune's combination of user-entered
weight/nutrition with the USDA/Open Food Facts and OpenAI APIs plausibly meets
that multi-source test; counsel must decide. Breach notification duties run to
affected individuals, the FTC, and (for larger breaches) the media.
Sources: [FTC compliance guide](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0);
[FTC final-rule press release, Apr 26 2024](https://www.ftc.gov/news-events/news/press-releases/2024/04/ftc-finalizes-changes-health-breach-notification-rule);
[Federal Register, May 30 2024](https://www.federalregister.gov/documents/2024/05/30/2024-10855/health-breach-notification-rule).

**Washington My Health My Data Act (chapter 19.373 RCW).** _Verified:_ effective
**March 31, 2024** for regulated entities and **June 30, 2024** for small
businesses; the geofencing prohibition took effect **July 23, 2023**. "Consumer
health data" is defined broadly (RCW 19.373.010). A consumer health data privacy
policy is required (RCW 19.373.020); collection or sharing requires consent, with
sharing consent separate and distinct from collection consent (RCW 19.373.030).
Consumer rights — confirm/access, withdraw consent, and delete — plus the refusal
appeal are in RCW 19.373.040: response within **45 days** (one 45-day extension
permitted), deletion **from all parts of the network including archived or backup
systems** with a delay for backup restoration that **may not exceed six months**
from authenticating the request, notification of affiliates/processors/
contractors/third parties of a deletion request, and an appeal decision within
**45 days**. Geofencing of health-care facilities is prohibited (RCW 19.373.060).
Enforcement is via the Washington Consumer Protection Act (private right of
action available).
Sources: [Chapter 19.373 RCW, full text](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373&full=true);
[RCW 19.373.040 (rights/refusal/appeal)](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373.040).

**Nevada consumer-health-data law (NRS 603A.400 et seq. / SB 370, 2023).**
_Verified:_ effective **March 31, 2024**. "Consumer health data" is personal
information linked or reasonably linkable to a consumer that the entity uses to
identify the consumer's past, present, or future health status. A privacy policy
is required; collection and sharing require consent, and consent to collect and
consent to share must be **separate and distinct**. Consumer rights include
confirmation, a list of third parties data was shared with, cessation of
collection/sharing, and deletion; the appeal decision is due within **45 days**.
Geofencing within **1,750 feet** of a medical facility for health-related
tracking or advertising is prohibited. There is **no private right of action**;
violations are deceptive trade practices enforced by the Nevada Attorney General.
Sources: [NRS Chapter 603A](https://www.leg.state.nv.us/nrs/nrs-603a.html);
[SB 370 (2023) enrolled text](https://www.leg.state.nv.us/Session/82nd2023/Bills/SB/SB370.pdf).

> Internal note on deadlines used in the drafts: where Washington and Nevada
> differ, this policy set and the Consumer Health Data policy use the stricter
> operational deadline (e.g., Washington's six-month outer bound for deletion
> from backups) rather than making an applicability determination. This is a
> drafting convenience, not legal advice (PB-13).

**EU GDPR (Regulation (EU) 2016/679).** _Verified August 19, 2026._ Art. 9(1)
lists "data concerning health" among the special categories whose processing is
prohibited absent an Art. 9(2) condition; Art. 9(2)(a) permits processing where
"the data subject has given explicit consent." Art. 6(1) sets the six lawful bases
— (a) consent, (b) contract, (c) legal obligation, (d) vital interests, (e) public
task, (f) legitimate interests. Data-subject rights: access (Art. 15),
rectification (16), erasure (17), restriction (18), portability (20), objection
(21), withdraw consent (7(3)), and safeguards against solely automated decisions
(22); response due within one month (Art. 12(3)). Art. 27 requires a controller
not established in the Union that offers goods/services to, or monitors, EU data
subjects to designate a Union representative, with a narrow occasional/non-
large-scale-special-category exemption in Art. 27(2). Chapter V governs transfers:
Art. 44 general principle, Art. 45 adequacy decisions, Art. 46 appropriate
safeguards (Standard Contractual Clauses), Art. 49 derogations. Art. 37(1)
mandates a DPO only for public authorities or core-activity large-scale monitoring
or large-scale special-category processing. Art. 8 sets a default digital-consent
age of 16, which Member States may lower to no less than 13.
Sources: [Art. 9](https://gdpr-info.eu/art-9-gdpr/);
[Art. 6](https://gdpr-info.eu/art-6-gdpr/);
[Art. 27](https://gdpr-info.eu/art-27-gdpr/);
[Chapter V (Arts. 44–49)](https://gdpr-info.eu/chapter-5/);
[Art. 37](https://gdpr-info.eu/art-37-gdpr/);
[Art. 8](https://gdpr-info.eu/art-8-gdpr/);
[official text, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj).

**UK GDPR and Data Protection Act 2018.** _Verified August 19, 2026._ The UK GDPR
retains the EU GDPR framework as amended for the UK; the ICO is the supervisory
authority. A controller with no UK establishment that offers goods/services to, or
monitors, people in the UK must appoint a **UK representative** under UK GDPR Art.
27. UK international transfers require an adequacy determination or appropriate
safeguards, including the UK's **International Data Transfer Agreement (IDTA)** or
the **UK Addendum** to the EU SCCs. The UK digital-consent age under DPA 2018 s.9
is 13.
Sources: [ICO — International transfers](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/);
[ICO — European representatives / Art. 27](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/european-representatives/);
[Data Protection Act 2018](https://www.legislation.gov.uk/ukpga/2018/12/contents).

**EU–US Data Privacy Framework and SCCs.** _Verified August 19, 2026._ The
European Commission's July 2023 EU–US Data Privacy Framework adequacy decision
remains in force (upheld by the EU General Court in September 2025; a CJEU appeal,
Case C-703/25 P, is pending). Adequacy covers only importers **certified** to the
Framework; an individual sole proprietor generally cannot self-certify (the DPF is
open to organizations subject to FTC or Department of Transportation jurisdiction),
so **Standard Contractual Clauses** under Art. 46 (plus the UK IDTA/Addendum for UK
data) are the practical mechanism for Vigorune's processors, backed by a transfer
risk assessment. Treat DPF reliance as importer-specific and confirm per processor.
Sources: [European Commission — adequacy decisions](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en);
[Data Privacy Framework program](https://www.dataprivacyframework.gov/);
[EU Standard Contractual Clauses](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/standard-contractual-clauses-scc_en).

Additional store/provider sources reviewed August 19, 2026 (unchanged from the
prior draft, retained for the compliance record):

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/),
  [App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/),
  [account-deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app),
  [subscriptions guidance](https://developer.apple.com/app-store/subscriptions/)
- [Google Play User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311),
  [Health Content and Services policy](https://support.google.com/googleplay/android-developer/answer/16679511),
  [prominent disclosure and consent](https://support.google.com/googleplay/android-developer/answer/11150561),
  [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469),
  [account-deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111),
  [Play Billing integration](https://developer.android.com/google/play/billing/integrate)
- [OpenAI API data controls](https://platform.openai.com/docs/guides/your-data)
- [Supabase users](https://supabase.com/docs/guides/auth/users),
  [sessions](https://supabase.com/docs/guides/auth/sessions),
  [backups](https://supabase.com/docs/guides/platform/backups),
  [platform audit logs](https://supabase.com/docs/guides/security/platform-audit-logs)
- [Stripe Privacy Policy](https://stripe.com/privacy),
  [Privacy Center](https://stripe.com/legal/privacy-center),
  [webhooks](https://docs.stripe.com/webhooks)
- [Vercel runtime-log retention](https://vercel.com/docs/logs/runtime)
- [Upstash QStash message retrieval/removal](https://upstash.com/docs/qstash/api-reference/messages/get-a-message),
  [field redaction](https://upstash.com/docs/qstash/howto/redact-fields)
- [USDA FoodData Central API guide](https://fdc.nal.usda.gov/api-guide/)
- [Open Food Facts API documentation](https://openfoodfacts.github.io/openfoodfacts-server/api/)
- California: [CalOPPA, BPC § 22575](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=22575),
  [CCPA definitions, Civ. Code § 1798.140](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.140.),
  [CMIA, Civ. Code § 56.06](https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?chapter=1.&division=1.&lawCode=CIV&part=2.6.)
- Texas: [Data Privacy and Security Act, Tex. Bus. & Com. Code ch. 541](https://statutes.capitol.texas.gov/Docs/BC/htm/BC.541.htm)
