# Age Eligibility And Minor Privacy Specification

Audit date: 2026-08-19 (worldwide globalization pass)

Status: publication blocker and implementation specification. This document is
not a live Terms of Use or Privacy Policy, and it does not claim that any target
behavior is implemented. Draft legal clauses require review by qualified
counsel in every launch jurisdiction.

> **WORLDWIDE + 18-only launch update (2026-08-19).** Per `docs/DECISIONS.md`
> (2026-08-19), the owner has **selected an 18+ adults-only launch, worldwide.**
> This **supersedes** the earlier 13+ target. The launch product **must not
> implement any minor (13–17) flow**: no guardian authorization, no under-13
> path, no teen platform-age-signal branching. Choosing 18+ deliberately removes
> the worldwide-minor compliance surface — **COPPA, GDPR Art. 8 (digital-consent
> age 13–16, varies by Member State), the Texas App Store Accountability Act
> (SB 2420) / SCOPE Act (HB 18) / TDPSA minor duties, and the UK Age Appropriate
> Design Code** — from the launch surface in one move.
>
> Everything in this document about **under-13 handling, 13–17 guardian
> authorization, teen platform age signals, and minor data retention is retained
> as FUTURE, not-launch design** for a possible post-revenue teen tier. It is
> clearly labeled below and must not be built or published without a separate
> counsel and Apple/Google store-configuration pass. Sections that DO apply to
> the 18+ launch are the **adults-only age-assurance gate**, the
> data-minimization rules for any date-of-birth check, and the marketing/store
> guardrails.

## Executive Decision (18+ launch, worldwide)

The owner-selected launch policy is **18+ adults-only, worldwide.** Vigorune
should use this release posture:

1. People **under 18 are ineligible at launch.** The launch does not create a
   minor account of any kind, does not add a COPPA parental-consent path, and
   does not add a 13–17 guardian path. (Building any of those would re-open the
   worldwide-minor compliance surface the 18+ decision was made to avoid.)
2. People 18 or older may accept for themselves after the age-assurance gate.
3. Prefer **Apple Declared Age Range** and **Google Play Age Signals** where
   available to confirm an 18+ / adult bracket; use a **neutral date-of-birth
   screen** only as a fallback. Exact birth date must be transient and must not
   be persisted, logged, backed up, or sent to analytics. Retain only the
   minimum derived eligibility representation (for the 18+ launch, effectively a
   single `18_plus` / not-eligible determination).
4. Keep eligibility separate from `NutritionGoal.ageYears`. The nutrition value
   is editable health-profile input, not evidence of identity, age, consent, or
   eligibility.
5. **Deferred (future teen tier only):** the 13–17 guardian-authorization design,
   under-13 actual-knowledge remediation, and teen platform-signal branching in
   the FUTURE-labeled sections below. Do not implement at launch.

Even the 18+ gate remains blocked until the minimum data and retention design in
this document receives owner and counsel approval. Do not add age collection
before that approval.

## Owner-Approved Facts And Jurisdiction Posture

These are the owner's current working decisions as of 2026-08-19. They resolve
some prior placeholders but do not close the legal blockers, which still require
counsel.

| Fact                      | Decision                                                | Effect on this spec                                                                                                                                                                                                                       |
| ------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operating entity          | Individual / sole proprietor (no LLC formed)            | The operator in Terms/Privacy is a natural person, not a company. `[LEGAL_ENTITY_NAME_AND_ADDRESS]` resolves to the individual's legal name; the published business address remains `[[PUBLICATION BLOCKER: published contact address]]`. |
| Jurisdiction of operation | Texas, USA                                              | Governing-law placeholder trends toward Texas, subject to mandatory consumer/data-protection rules where users live. The Texas minor statutes below are **not triggered by the 18+ launch** and apply only to the deferred teen tier.        |
| Launch territories        | **WORLDWIDE** (supersedes US-only)                      | `[[PUBLICATION BLOCKER: counsel confirms worldwide storefront set + exclusions]]`. Worldwide reach would multiply minor-law regimes for a teen tier (GDPR Art. 8, UK AADC, US state laws) — another reason the launch is 18+ adults-only. The **adult** age-assurance obligation still applies worldwide. |
| Age policy (launch)       | **18+ adults-only** (supersedes 13+)                    | Launch excludes all minors; no COPPA / GDPR Art. 8 / TASAA-SCOPE / UK AADC minor lane is built. The 13+ model in this document is retained as **future, not-launch** design.                                                                 |
| Public contact            | `adamshugart31@gmail.com`                               | Resolves `[SUPPORT_EMAIL]` / `[PRIVACY_CONTACT]` for published legal copy. No home address or personal phone is published.                                                                                                                |

The owner must not publish a home address or personal phone number. Where a
physical contact address is legally required (for example, some store-console
and privacy-law disclosures), obtain a non-residential address before launch;
this is tracked as `[[PUBLICATION BLOCKER: published contact address]]`.

### Texas and US state-law age obligations — FUTURE teen tier only

> **Not applicable to the 18+ adults-only launch.** The following apply only if a
> future 13–17 teen tier is ever built. They are among the reasons the launch is
> 18+.

A Texas-operated 13+ teen tier would be materially affected by recent state law.
These are additional to COPPA and must be assessed with counsel before any teen
launch; each is a reason the 18+ launch is the safer posture.

- **Texas App Store Accountability Act (SB 2420 / TASAA).** Requires covered app
  stores to verify each Texas user's age, assign one of four brackets (child
  under 13, young teen 13–15, older teen 16–17, adult), affiliate a minor's
  account with a verified parent/guardian, and obtain parental consent before a
  minor downloads an app **or makes an in-app purchase**. It also imposes
  developer-side duties (age-signal handling, notice of significant changes,
  penalties for violations). This directly interacts with Vigorune's 13–17 path
  and the future in-app subscription: a minor purchase or trial conversion may
  require store-mediated parental consent independent of Vigorune's own guardian
  flow. The law took effect in 2026 and remains subject to ongoing litigation;
  re-check enforcement status at implementation.
- **Texas SCOPE Act (HB 18).** Imposes duties on digital service providers that
  know a user is a minor (registration/consent, data-use limits, parental
  tools). Applicability to Vigorune depends on the final feature set and known
  minor use.
- **Texas Data Privacy and Security Act (TDPSA).** General state privacy law with
  heightened treatment of known-minor and sensitive (including health) data.
- **Other US states.** Age-appropriate-design and minor-consent laws in other
  states (and their varying enforcement/injunction status) must be mapped before
  a nationwide teen launch. Exclude unsupported states or use the 18+ fallback.

Platform age signals align usefully with TASAA brackets: Apple Declared Age
Range and Google Play Age Signals both return coarse ranges (Google's default
`0-12 / 13-15 / 16-17 / 18+`) and have begun regional rollouts that include
Texas users. They reduce but do not eliminate Vigorune's own policy, fallback,
consent, and enforcement duties. `[[PUBLICATION BLOCKER: Texas TASAA/SCOPE/TDPSA
minor-consent and in-app-purchase design reviewed by counsel]]`.

Sources:

- [Texas App Store Accountability Act (SB 2420) — enrolled text, Texas Legislature](https://capitol.texas.gov/BillLookup/History.aspx?LegSess=89R&Bill=SB2420)
- [Texas SCOPE Act (HB 18), Business & Commerce Code ch. 509](https://statutes.capitol.texas.gov/Docs/BC/htm/BC.509.htm)
- [Texas Data Privacy and Security Act, Business & Commerce Code ch. 541](https://statutes.capitol.texas.gov/Docs/BC/htm/BC.541.htm)

## Product-State Boundary

### Current release — verified behavior

The repository at this audit date implements all of the following:

| Area                  | Verified current-release behavior                                                                                                                                                                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entry                 | Core features work without an account. Apple and Google authentication are optional.                                                                                                                                                                                                                  |
| Cloud                 | Signing in starts automatic compact cloud snapshots when the overwrite guard allows them. This differs from the owner-approved target's separate cloud-backup opt-in.                                                                                                                                 |
| Commercial access     | There is no trial, subscription, entitlement service, complimentary-access role, subscription lock, or limited server-verified offline entitlement.                                                                                                                                                   |
| Legal acceptance      | There is no Terms route, Terms version record, acceptance screen, or guardian acceptance record. Public routes are limited to Privacy, account deletion, and support.                                                                                                                                 |
| Eligibility           | There is no account-age or service-eligibility gate. A person under 13 can use local features and can reach sign-in.                                                                                                                                                                                  |
| Nutrition age         | The calculated-maintenance goal form accepts an editable numeric age from 13 through 120. Manual-maintenance mode does not ask for age and persists the fallback value `30`. Neither path proves eligibility.                                                                                         |
| Nutrition-age storage | `ageYears` is stored in `UserSettings.nutritionGoal` in IndexedDB. It is included in user-initiated JSON/ZIP exports and in compact cloud snapshots after sign-in. It is not a field in the separate daily-nutrition cloud rows.                                                                      |
| Deletion              | Clear all data removes local settings, including the nutrition age. Cloud-data and account deletion remove server rows while deliberately leaving local records on the device.                                                                                                                        |
| Marketing             | Repository copy contains no express “for kids,” “for children,” teen, youth, student, or school positioning. The current weight/checkmark icon is ordinary fitness imagery. Final screenshots, ads, creator campaigns, and store-console answers are outside the repository and still require review. |

Relevant implementation locations include:

- `src/features/nutrition/goalForm.ts`
- `src/features/nutrition/SetGoalSubpage.tsx`
- `src/repositories/settingsRepository.ts`
- `src/services/backupService.ts`
- `src/services/cloudSyncService.ts`
- `src/services/automaticCloudBackupService.ts`
- `src/services/accountService.ts`
- `src/pages/PublicInformationPages.tsx`
- `src/app/router.tsx`

### Owner-approved subscription target — not implemented

The approved target is a different product state and must always be described
as future behavior until implemented and verified:

- Apple or Google authentication through Supabase is mandatory.
- Fitness records remain local unless cloud backup is separately enabled.
- Each person may receive one server-recorded 14-day, no-card trial. It never
  auto-converts, starts a paid subscription, or charges.
- Full access is available through one monthly auto-renewing subscription,
  initially targeted at USD $2, using **Apple In-App Purchase and Google Play
  Billing only at launch** (Apple/Google as merchant of record handle worldwide
  VAT/GST). Web billing is deferred.
- Only a service-role-controlled operation may grant complimentary access.
- Offline full access is limited and must be based on a recent server-verified
  entitlement.
- A locked person retains legal, authentication, billing, account-management,
  and data-export routes.
- Cancellation or expiration never deletes local fitness records.

Nothing in this document represents those target capabilities as live.

## Why A Terms Sentence Is Insufficient

The current COPPA Rule defines a child as someone under 13 and covers both
services directed to children and general-audience services with actual
knowledge that they collect personal information from an under-13 child. The
Rule's child-directed factors include subject matter, visual/audio content,
animated characters and child-oriented incentives, the age of models,
language, advertising, empirical audience evidence, and marketing or
representations. A Terms statement does not override those facts.

The FTC says a general-audience service may rely on age entered through a
neutral screen, but later knowledge that a user is under 13 triggers COPPA
obligations. It also says a service that is child-directed but only “mixed
audience” may age-differentiate but may not simply block all under-13 users. A
13+ exclusion model therefore depends on Vigorune remaining supportably
general-audience, not merely declaring itself so.

The current Rule also requires covered operators to limit collection, maintain
a written children's-data security program, retain children's personal
information only as long as reasonably necessary, state the purpose, business
need and deletion timeframe in a written retention policy, and delete the data
securely. These are operational duties, not wording that can be solved only in
Terms.

Primary sources:

- [Current 16 CFR Part 312 (COPPA Rule)](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312)
- [FTC COPPA FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)
- [FTC six-step COPPA plan](https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business)

## Apple And Google Findings

### Authentication does not prove age

Google supports parent-managed accounts for children under 13 or the locally
applicable age, and its self-managed-account threshold varies by country.
Apple supports child Apple Accounts in Family Sharing. An OAuth success from
either provider therefore proves control of an account, not that the person is
13+, 18+, or legally able to accept Vigorune's Terms.

Vigorune must not request provider birthday/profile scopes as a shortcut. The
approved providers should continue to supply only the identity data required
for authentication.

Sources:

- [Google Account age requirements](https://support.google.com/accounts/answer/1350409)
- [Google child accounts and Family Link](https://support.google.com/accounts/answer/7103338)
- [Apple Family Sharing and child accounts](https://support.apple.com/en-us/105062)

### Apple

- Do not select Made for Kids or use “for kids”/“for children” metadata.
- App Store age ratings describe content; they are not an eligibility gate.
  Apple expressly notes that a parent may allow a child to download an app
  whose rating exceeds the child's restriction.
- Apple's current Declared Age Range API can return a range and how it was
  declared or checked without exposing exact birth date. It is the preferred
  native signal where supported. The app remains responsible for the policy,
  unavailable/declined states, regional requirements, consent changes, and
  enforcement.
- Apple permits asking for birth date and parental contact information only for
  compliance with children's privacy statutes. A hard-blocking fallback needs
  App Review notes and counsel review against Guideline 5.1.4's requirement for
  some useful value regardless of age.
- A Kids Category parental gate is not the same as legal consent to collect a
  child's personal information. Likewise, Ask to Buy is purchase control, not
  a universal acceptance or privacy-consent record.

Sources:

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple age-assurance developer Q&A](https://developer.apple.com/support/age-assurance)
- [Declared Age Range](https://developer.apple.com/documentation/DeclaredAgeRange)
- [Requesting an age range without exact birth date](https://developer.apple.com/documentation/declaredagerange/requesting-people-share-their-age-range-with-your-app)
- [Apple Ask to Buy](https://support.apple.com/en-us/105055)

### Google Play

- Play Console target-audience answers must match the intended and actual
  audience. Selecting ages 13–15 or 16–17 requires considering whether those
  people are children under local law.
- A neutral screen may not default to an eligible age or tell the person how to
  answer. Google's example asks for month, day, and year of birth.
- Marketing elements such as youthful animation or young characters can cause
  Google to reject an “not designed for children” declaration.
- If children are included in the target audience, Families requirements apply.
  Mixed-audience apps may not require sign-in through an API or SDK that is not
  approved for child-directed services before the age boundary protects the
  child path.
- The Play Age Signals API is the preferred Android signal when shared. It can
  return shared, not-shared, or verification-required states and may include a
  parent-shared range. It does not eliminate the need for a fallback or an
  application policy.
- Google family payment-method purchase approval does not apply to
  subscriptions. Alternative-billing behavior also does not create a durable,
  Vigorune-controlled guardian authorization. Billing approval cannot be the
  only teen-permission mechanism.

Sources:

- [Google Play target audience and neutral age screens](https://support.google.com/googleplay/android-developer/answer/9867159)
- [Google Play Families policy](https://support.google.com/googleplay/android-developer/answer/17190352)
- [Google Play Families data practices](https://support.google.com/googleplay/android-developer/answer/11043825)
- [Play Age Signals API](https://developer.android.com/google/play/age-signals/request-age-signals)
- [Google family payment method limitations](https://support.google.com/googleplay/answer/6294544)

### A 13+ global launch needs more than COPPA

COPPA is not the ceiling. Google warns that people under 21 may be children
under local law. The UK Children's Code, for example, covers online services
likely to be accessed by people under 18 and specifically includes general
health, fitness, and wellbeing apps. A teen launch therefore requires a
jurisdiction-by-jurisdiction privacy, contract, age-assurance, consumer, and
billing assessment. Unsupported regions must be excluded or use the 18+
fallback.

Source:

- [UK ICO: services covered by the Children's Code](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/services-covered-by-this-code/)

## Required Eligibility Architecture

> **Launch scope (18+):** for the adults-only launch, only the **adult** branch
> of the architecture below is built — the age-assurance gate resolves to either
> `18_plus` (proceed) or not-eligible (block), with **no** under-13 or 13–17
> account state, guardian invitation, or teen platform-signal branch. The
> under-13 and 13–17 rows, the `13_to_17` band, and the guardian records are
> **FUTURE teen-tier design only**, retained here so a later teen tier does not
> start from scratch.

### Decision matrix

| Candidate                                | Decision                        | Reason                                                                                                             |
| ---------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Reuse `NutritionGoal.ageYears`           | Reject                          | Editable, optional, sometimes a placeholder, local health-profile input, and collected too late.                   |
| Trust Apple/Google OAuth account alone   | Reject                          | Supervised and child accounts exist; normal sign-in does not provide a suitable eligibility assertion.             |
| Ask only “Are you 13?” or show age bands | Reject as primary fallback      | It reveals the desired answer and is weaker than a neutral date screen.                                            |
| Persist exact birth date                 | Reject                          | The target needs a threshold, not birthday storage. Exact date creates avoidable sensitive data and breach impact. |
| Platform age-range signal                | Prefer                          | More data-minimizing and can carry platform/guardian provenance without exact birth date.                          |
| Transient neutral birth-date screen      | Conditional fallback            | Necessary for web, unsupported OS versions, declined voluntary sharing, and recoverable API failures.              |
| Teen accepts alone                       | Reject pending regional counsel | Does not establish guardian authorization or contractual capacity.                                                 |
| Separate guardian authorization          | Required for the 13+ target     | Produces an explicit, revocable, versioned adult record independent of store purchase settings.                    |
| Under-13 COPPA parental-consent lane     | Reject                          | Expands scope into an under-13 service and materially changes privacy, vendor, content, and store obligations.     |
| 18+ release fallback                     | Recommend until blockers close  | Enforceable with a simpler data model while preserving the longer-term 13+ target.                                 |

### Order of operations

The gate must precede Supabase OAuth because mandatory authentication collects
an email/account identifier. It must also precede feedback, meal-photo
analysis, food-provider calls, push registration, cloud backup, GPS collection,
and ordinary fitness-record entry.

Public Terms, Privacy, support, account/deletion information, and accessibility
help remain reachable before and after the gate.

1. Start in a data-quiet shell. Do not initialize nonessential third-party SDKs
   or make provider calls.
2. On supported native platforms, request the applicable Apple or Google age
   signal.
3. If a sufficiently authoritative signal is shared, derive one of:
   `under_13`, `13_to_17`, or `18_plus`.
4. If no usable signal is available, show the neutral date-of-birth fallback.
   No date is prefilled, no minimum is stated beside the inputs, and all values
   are equally easy to enter.
5. Send the fallback answer only to a dedicated, privacy-isolated eligibility
   endpoint over TLS. Disable request-body and query logging. The endpoint
   processes the exact date only in request memory, derives and signs the age
   band using an authoritative current calendar date and launch jurisdiction,
   and then discards the exact date. Clear it from client component state at the
   same time. This does not verify that the self-declaration is truthful; it
   prevents ordinary client state from becoming the server entitlement.
6. Under 13: do not create or retain an account, start a trial, initialize
   billing, or enter the app. Show only the ineligible result and public routes.
7. Ages 13–17: permit Apple/Google OAuth only after the eligible age result and
   create a restricted `guardian_pending` account. Create no trial and expose no
   fitness routes until a parent/legal guardian completes the approved
   authorization flow. A short-lived, purpose-bound invitation may be created
   only after its retention and abuse design is approved.
8. Age 18+: proceed to provider authentication and then versioned Terms/Privacy
   acceptance.
9. Attach an eligible one-time age result to the authenticated Supabase user on
   the server. Never accept a client-only `isAdult=true` entitlement flag.
10. Only after eligibility and acceptance may the server create the person's
    one-time trial record. The trial still remains no-card and non-converting.

The neutral screen may rely on self-entered information for a supportably
general-audience service, but the app must respond if later support, feedback,
guardian, platform, or account evidence provides actual knowledge of an
under-13 user.

### Minimum persisted representation

Do not add this schema until counsel approves the retention schedule. The
logical minimum is:

| Field                                         | Purpose                                                                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `user_id`                                     | Bind eligibility to the verified Supabase identity.                                                                                         |
| `age_band`                                    | `13_to_17` or `18_plus`; never store an under-13 account merely to remember a denial.                                                       |
| `age_source`                                  | `apple_declared_range`, `google_play_signal`, or `neutral_self_declaration`.                                                                |
| `assurance_level`                             | Coarse provenance such as `self_declared`, `guardian_declared`, or `platform_checked`; do not retain raw platform payloads unless required. |
| `checked_at`                                  | Audit and recheck anchor.                                                                                                                   |
| `recheck_at`                                  | Shortest date required by the signal, jurisdiction, or policy; never infer exact birthday from it.                                          |
| `jurisdiction_basis`                          | Minimal country/region code used for the rule, if legally necessary. Do not retain precise location.                                        |
| `eligibility_policy_version`                  | Reproduce the rule that produced the decision.                                                                                              |
| `terms_version` / `terms_accepted_at`         | Versioned user acceptance.                                                                                                                  |
| `privacy_version` / `privacy_acknowledged_at` | Versioned privacy acknowledgement where required.                                                                                           |
| guardian authorization reference              | Present only for `13_to_17`; links to the separately authenticated adult and its status.                                                    |

The guardian record minimally needs the teen account reference, guardian
Supabase user reference, relationship certification, versions authorized,
authorization time, revocation time/status, and the evidence method approved by
counsel. Avoid retaining copies of identity documents or payment instruments.

Eligibility, Terms acceptance, trial, paid entitlement, complimentary access,
and cloud-backup consent are separate server records or separately auditable
states. None may imply another.

### Data retention and deletion

The retention table must be completed before implementation:

| Data                                   | Required treatment                                                                                                                                                                                         | Unresolved value                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Exact birth date                       | Memory only; discard immediately after band derivation; exclude from logs, telemetry, errors, backups, support payloads, crash reports, and analytics.                                                     | Confirm whether any regulated region requires stronger evidence. |
| Eligible age band and provenance       | Retain only while the account needs eligibility enforcement, then delete or irreversibly de-identify subject to a documented legal-defense period.                                                         | `[ELIGIBILITY_RETENTION_PERIOD]`                                 |
| Terms/Privacy acceptance               | Retain the version and timestamp for the account plus a documented post-deletion legal period.                                                                                                             | `[ACCEPTANCE_RETENTION_PERIOD]`                                  |
| Guardian authorization                 | Retain while teen access depends on it and for the approved post-revocation/deletion period.                                                                                                               | `[GUARDIAN_RECORD_RETENTION_PERIOD]`                             |
| Under-13 failed gate                   | Do not create an account or durable server profile. A retry-control marker is allowed only if counsel approves its purpose, scope, device-only/server location, and short deletion period.                 | `[DENIAL_MARKER_DESIGN_AND_TTL]`                                 |
| Eligibility endpoint security metadata | Minimize CDN/server IP and user-agent logs, never include the birth-date request body or derived under-13 result, restrict use to security/internal operations, and delete on a short documented schedule. | `[ELIGIBILITY_SECURITY_LOG_TTL]`                                 |
| Billing transactions                   | Store only processor/store identifiers and entitlement evidence needed for billing, tax, refunds, fraud, and law. State any post-account-deletion retention separately.                                    | `[BILLING_RETENTION_PERIOD_BY_REGION]`                           |

An exact birth date must not enter the fitness backup format or
`UserSettings`. Eligibility records must not enter a local fitness snapshot,
because restoring a backup must not grant access, recreate acceptance, or reset
the one-time trial.

Account deletion must remove or de-identify future eligibility, guardian,
trial, entitlement, complimentary-access, and cloud-consent rows in addition to
the existing Auth user and cloud fitness rows, except for narrowly documented
records that law requires retaining. A privacy request must explain any such
exception.

Cancellation and subscription expiration remain non-destructive and never
delete local fitness data. Under-13 actual-knowledge remediation is a separate
legal event, not “cancellation.” The repository currently cannot guarantee
whether operator-prompted data kept only in IndexedDB is outside all applicable
children's-data deletion duties. Counsel must decide whether known-under-13
remediation requires a guardian-directed or automatic local clear. Until then,
the app must stop all new collection and network disclosure, preserve public
legal/support access, and expose local export/clear controls without silently
uploading the records.

## UX Specification And Copy

All copy in this section is target draft, not current UI.

> **Launch scope (18+):** the neutral age screen, the not-eligible (under-18)
> result, the adult Terms acceptance, the trial-start confirmation, the paid
> subscription screen, and the locked state apply to the adults-only launch. The
> **under-13 result, teen result and guardian handoff, and guardian acceptance**
> screens are **FUTURE teen-tier design only** and must not ship at launch. At
> launch, anyone below the 18+ bracket sees only a generic not-eligible result
> and the public legal/support routes.

### Neutral age screen

Do not pre-announce the passing answer inside the form. Public Terms may still
state the eligibility rule.

**Heading:** `Enter your date of birth`

**Body:**

> We use this once to determine which experience and permissions apply. Your
> exact birth date is not saved.

**Fields:** `Month`, `Day`, `Year`

**Primary action:** `Continue`

**Secondary links:** `Terms`, `Privacy`, `Support`

Validation must say only what is wrong, for example `Enter a valid date of
birth.` It must not suggest a date that will pass.

### Under-13 result

**Heading:** `Vigorune is not available for this account`

**Body:**

> You cannot create or use a Vigorune account. No trial or subscription has
> started. If you think this result is incorrect, contact support.

**Actions:** `Support`, `Privacy`, `Delete local data` when preexisting local
data is present.

Do not offer “ask a parent” enrollment; the product policy excludes under-13
use.

### Teen result and guardian handoff

**Heading:** `A parent or guardian needs to approve`

**Body:**

> Before you can use Vigorune, a parent or legal guardian must review and
> accept the Terms and Privacy Policy and authorize your account. Your trial
> will not start until approval is complete.

**Actions:** `Ask a parent or guardian`, `Not now`

The invitation screen must state what contact information is sent, its expiry,
and that no fitness records are shared with the guardian unless a separate,
approved feature is later designed. Do not imply that teen fitness records are
automatically visible to a parent.

### Guardian acceptance

**Heading:** `Review access for [TEEN_DISPLAY_NAME]`

**Body:**

> Vigorune records workouts, nutrition, bodyweight, and runs. Fitness records
> stay on the teen's device unless cloud backup is separately enabled. Review
> the Terms and Privacy Policy before deciding.

Unchecked certifications:

- `I certify that I am this person's parent or legal guardian and am authorized to act for them.`
- `I authorize this Vigorune account and agree to the Terms on their behalf.`
- `I have reviewed the Privacy Policy and the data and deletion choices.`

**Primary action:** `Authorize account`

**Secondary action:** `Decline`

Guardian authorization must not buy a subscription, add a payment method, or
enable cloud backup. Those remain separate, explicit actions.

### Adult Terms acceptance

**Heading:** `Review the Vigorune terms`

**Body:**

> Sign-in is required for the planned subscription service. Your fitness
> records stay on this device unless you separately enable cloud backup.

> You may receive one 14-day trial. No card is required, the trial does not
> convert to a paid plan, and Vigorune will not charge you when it ends.

> After the trial, full access requires the monthly subscription shown at
> purchase. A subscription renews automatically until canceled through the
> applicable billing provider. Starting price target: USD $2 per month; the
> actual localized price and terms shown by the billing provider control.

Unchecked acceptance:

- `I agree to the Terms of Use.`
- `I acknowledge the Privacy Policy.`

**Primary action:** `Agree and continue`

**Secondary action:** `Not now`

Acceptance does not buy a subscription, enable cloud backup, or grant
complimentary access.

### Trial start confirmation

**Heading:** `Start your 14-day trial?`

**Body:**

> No payment method is required. This trial will end on [LOCALIZED_END_DATE].
> It will not renew, convert to a subscription, or charge you. Each person is
> eligible for one trial.

**Actions:** `Start trial`, `Not now`

### Paid subscription screen

Use the store/provider's live localized product data; never hard-code `$2` as
the charged price.

**Heading:** `Continue with full access`

**Body template:**

> [LOCALIZED_PRICE] per month. Auto-renews until canceled. Payment is charged
> by [BILLING_PROVIDER]. Manage or cancel through [MANAGEMENT_PATH]. Canceling
> stops future renewals and never deletes fitness records stored on this
> device.

The screen must show the features included, renewal period, price, restore
purchase path, Terms, Privacy, and provider-required disclosures before the
purchase action.

### Locked state

**Heading:** `Full access is paused`

**Body:**

> Your trial or paid access is not active. Your local fitness records have not
> been deleted.

Keep these routes available: Terms, Privacy, support, authentication, billing
status/restore/manage, account deletion, cloud-data deletion when applicable,
local export, and local clear. Do not allow the locked shell to start new
fitness collection, AI/provider requests, or cloud uploads.

## Draft Terms Clauses — Counsel Review Required

Replace every bracketed placeholder. These clauses describe only the approved
target and must not be published against the current release.

> **Launch clause is 18+.** The **launch** eligibility clause is the 18+
> adults-only clause in `docs/TERMS_OF_USE_WORKING_DRAFT.md` §A2 — use that. The
> 13+/guardian clause immediately below is **FUTURE teen-tier design only** and
> must not be published at launch. The account/authentication, trial,
> subscription, complimentary, offline/locked, cancellation, and fitness clauses
> that follow apply to the 18+ launch once the subscription target ships (subject
> to the store-only-billing update noted in each).

### Eligibility and guardian authorization — FUTURE teen tier (do NOT publish at launch; launch uses 18+ §A2 in the Terms draft)

> You must be at least 13 years old to use Vigorune. If you are under the age of
> majority where you live, your parent or legal guardian must review these
> Terms and our Privacy Policy and authorize your account through the process we
> provide. By authorizing a minor's account, the parent or legal guardian
> represents that they are legally authorized to act for the minor and agrees
> to these Terms on the minor's behalf. Vigorune is not offered to children
> under 13. If we learn that an ineligible person is using the Service, we may
> restrict access and delete information as described in the Privacy Policy and
> as required by law. `[REGION-SPECIFIC AGE OR CONSENT RULES]`

### Account and authentication

> Use of the subscription version of Vigorune requires authentication with an
> eligible Apple or Google account through our authentication provider,
> Supabase. You are responsible for your account and for keeping access to your
> provider account secure. Authentication by Apple or Google does not by itself
> establish age, guardian authorization, payment, or subscription eligibility.

### Local records and optional cloud backup

> Vigorune is designed so that fitness records are stored locally on your
> device. Local records are not uploaded merely because you sign in or buy a
> subscription. If you separately enable cloud backup, the data described in
> the Privacy Policy will be uploaded as a replaceable snapshot. Cloud backup
> is not real-time multi-device synchronization. You are responsible for local
> exports and for protecting access to your device. Clearing app data,
> uninstalling, or device/storage failure may delete records that are not in an
> export or enabled cloud backup.

### One-time no-card trial

> An eligible person may receive one 14-day trial, as determined by our server
> records. No payment card is required. The trial does not automatically
> convert to a paid subscription, does not auto-renew, and will not charge you
> when it ends. Creating another account does not create another trial right.
> Trial access is personal and may not be transferred. `[TRIAL_REGION_RULES]`

### Monthly subscription

> After trial access ends, full access requires one monthly auto-renewing
> subscription unless you have valid complimentary access. The initial target
> price is USD $2 per month, but the actual localized price, taxes, renewal
> date, and billing terms shown by Apple or Google Play (the only billing
> channels at launch; web billing is deferred) before purchase control. Payment
> is charged only when you
> expressly complete a purchase. The subscription renews automatically for
> successive monthly periods until canceled through the applicable provider.
> Cancel before the provider's stated renewal deadline to avoid the next
> charge. `[REFUND_TERMS]` `[PRICE_CHANGE_NOTICE]` `[BILLING_CONTACT]`

### Complimentary access

> Complimentary access may be granted or revoked only by an authorized
> Vigorune service operation. It is personal, non-transferable, has no cash
> value, and does not create a paid subscription or recurring charge.

### Offline and locked access

> Paid or complimentary access may remain available offline only for a limited
> period after the Service verifies the entitlement. Internet access is
> periodically required to reverify access. If access cannot be verified, or a
> trial, subscription, or complimentary grant ends, full functionality may be
> locked. Legal notices, authentication, billing and account controls, and data
> export remain available as described in the Service.

### Cancellation, expiration, and deletion

> Canceling a subscription stops future renewals but does not itself delete
> your account, cloud data, or fitness records stored on your device.
> Subscription expiration likewise does not delete local records. Account
> deletion and local-data deletion are separate actions. The Privacy Policy
> explains each deletion path, records we may be legally required to retain,
> and the special process used if we learn that an ineligible child used the
> Service.

### Fitness and nutrition information

> Vigorune is a fitness logging tool, not a medical device or medical-advice
> service. Outputs, including calorie, macro, load, repetition, and meal-photo
> estimates, may be inaccurate and must be reviewed by the user. Do not rely on
> Vigorune for diagnosis, treatment, emergency services, or a medically
> necessary diet or exercise decision. Minors and their guardians should obtain
> qualified professional advice before using weight-change, calorie-target, or
> strenuous-exercise features. `[HEALTH_RISK_LANGUAGE_BY_REGION]`

### Operator and governing terms

> The Service is provided by Adam Shugart, an individual (sole proprietor)
> operating from Texas, USA `[[PUBLICATION BLOCKER: published geographic trader
> address — required for EU/UK worldwide distance selling; no home address]]`.
> Questions may be sent to adamshugart31@gmail.com. These Terms take effect
> `[EFFECTIVE_DATE]` and are governed by the laws of the State of Texas and the
> United States `[GOVERNING_LAW_AND_FORUM — confirm venue]`, subject to the
> mandatory consumer- and data-protection rights of your country of residence,
> including EU/UK mandatory rules for EU/UK consumers. `[EU_UK_DP_REPRESENTATIVE]`
> `[DISPUTE_RESOLUTION]` `[TERMINATION]` `[WARRANTY]` `[LIMITATION_OF_LIABILITY]`.

Owner-approved facts are filled above; unresolved items keep their placeholders
or `[[PUBLICATION BLOCKER]]` markers. The operator is an individual, not an LLC;
if the owner later forms an entity, the operator name and governing terms must be
updated before publication. A published contact address remains required and must
not be a home address.

## Draft Privacy Clauses — Counsel Review Required

These clauses supplement a complete policy; they are not a complete Privacy
Policy.

> **Launch scope (18+):** the "Age eligibility data," "Local fitness data and
> cloud choice," "Retention and deletion," and "Service providers" clauses apply
> to the adults-only launch (with the derived band effectively `18+`). The **"Teen
> and guardian records"** and **"Under-13 users and actual knowledge"** clauses
> are **FUTURE teen-tier design only** and must not appear in the launch Privacy
> Policy. A worldwide launch Privacy Policy must additionally disclose GDPR Art. 9
> explicit-consent handling for health data and the identity/contact of the
> Art. 27 EU representative and the UK representative.

### Age eligibility data

> Before account creation, Vigorune determines an age range using an available
> Apple or Google age-range signal or a neutral date-of-birth screen. When you
> enter a date of birth, we use it only to derive the applicable age range and
> do not store the exact date. For an eligible account, we store the derived
> range (`13–17` or `18+`), how the range was established, the date checked, the
> next recheck date, the policy version, and the minimum regional basis needed
> to enforce eligibility. `[DESCRIBE_PLATFORM_SIGNAL_FIELDS_ACTUALLY_USED]`

### Teen and guardian records

> For a user age 13–17, Vigorune stores the minimum information needed to link
> the teen account to a separately authenticated parent or legal guardian,
> record the guardian's authorization and the versions of the Terms and Privacy
> Policy reviewed, and record authorization, expiration, or revocation times.
> We do not treat a minor's acceptance, a store download, or a billing approval
> as guardian authorization. `[GUARDIAN_INVITATION_DATA_AND_EXPIRY]`

### Under-13 users and actual knowledge

> Vigorune is not offered to children under 13. We do not create an account or
> start a trial after an under-13 result. If we later learn that an account
> belongs to a child under 13, we stop ordinary collection and disclosure,
> restrict the account, and delete information as required by law. Contact
> adamshugart31@gmail.com to report an underage account.
> `[LOCAL_DEVICE_DATA_PROCESS]` `[LEGALLY_REQUIRED_RETENTION_EXCEPTIONS]`

### Local fitness data and cloud choice

> Workout, nutrition, bodyweight, and run records are stored locally unless you
> separately enable cloud backup. Authentication, eligibility checking, Terms
> acceptance, a trial, or a subscription does not by itself enable cloud
> backup. If enabled, the cloud categories, exclusions, replacement behavior,
> and deletion controls are described here: `[CLOUD_BACKUP_DISCLOSURE]`.

### Retention and deletion

> Exact birth date is discarded after age-range derivation and is not included
> in logs, analytics, exports, or backups. We retain eligibility records for
> `[ELIGIBILITY_RETENTION_PERIOD]`, acceptance records for
> `[ACCEPTANCE_RETENTION_PERIOD]`, guardian records for
> `[GUARDIAN_RECORD_RETENTION_PERIOD]`, and billing evidence as described in
> `[BILLING_RETENTION_SCHEDULE]`. Account deletion removes or de-identifies
> these records except where a stated legal obligation requires limited
> retention. Canceling or allowing a subscription to expire does not delete
> fitness records on your device. Use `[LOCAL_CLEAR_PATH]` on each device to
> remove those records.

### Service providers

> Apple or Google provides authentication and, where used, age-range signals.
> Supabase processes account identity, sessions, and Vigorune's server records.
> Apple, Google Play, or `[WEB_BILLING_PROVIDER]` processes purchases and
> renewals. Each provider's exact data, purpose, retention, and cross-border
> handling must be listed after production configuration is verified.

## Acceptance And Regression Test Cases

These are required before any age implementation can be release-ready.

### Age classification and minimization

- `AGE-01`: a person one day short of 13 is classified `under_13`.
- `AGE-02`: a person on the exact 13th birthday is classified `13_to_17`.
- `AGE-03`: a person one day short of 18 is classified `13_to_17`.
- `AGE-04`: a person on the exact 18th birthday is classified `18_plus`.
- `AGE-05`: leap-day births are correct in leap and non-leap years under the
  approved jurisdiction rule.
- `AGE-06`: future, impossible, incomplete, and implausibly old dates fail
  neutrally without suggesting a passing date.
- `AGE-07`: the form has no default date, eligible example, threshold hint,
  preselected age band, or alternate faster eligible path.
- `AGE-08`: exact birth date disappears from memory/state after derivation and
  never appears in network logs, error payloads, telemetry, crash data,
  IndexedDB, local storage, cookies, fitness exports, or cloud snapshots.
- `AGE-09`: the nutrition goal's age and its placeholder `30` never create or
  change eligibility.

### Platform signals and pre-auth isolation

- `AGE-10`: Apple under-13, teen, adult, declined/unavailable, guardian-declared,
  and changed/revoked responses follow the approved branches.
- `AGE-11`: Google `SHARED`, `NOT_SHARED`, `VERIFICATION_REQUIRED`, supervised,
  significant-change, under-13, teen, and adult responses follow the approved
  branches.
- `AGE-12`: absent or failed signals use only the approved neutral fallback and
  never fail open.
- `AGE-13`: no Supabase OAuth, provider API, feedback, push, AI, food search,
  cloud backup, GPS, analytics, or billing call happens before an eligible
  result.
- `AGE-14`: browser back, refresh, PWA restart, deep links, multiple tabs, and
  native callbacks cannot bypass the gate.
- `AGE-15`: public Terms, Privacy, support, accessibility help, and deletion
  information remain available before the gate.

### Teen and guardian authorization

- `AGE-16`: a teen cannot self-authorize, start a trial, subscribe, enable
  cloud backup, or enter fitness routes.
- `AGE-17`: guardian invitation contains no fitness data, expires at the
  approved time, is single-use, rate-limited, and cannot authorize another
  teen.
- `AGE-18`: guardian authentication is distinct from the teen identity and
  records all required unchecked certifications and document versions.
- `AGE-19`: decline, expiry, or revocation keeps the teen locked and stops new
  ordinary collection/disclosure without deleting local data silently.
- `AGE-20`: store purchase approval or use of a family payment method alone
  does not set guardian authorization.
- `AGE-21`: the teen becomes independently eligible only through the approved
  recheck after reaching adulthood; no exact birthday is reconstructed.

### Acceptance, trial, billing, and locks

- `AGE-22`: Terms and Privacy checkboxes are unchecked, independently required,
  versioned, and accepted only after eligibility.
- `AGE-23`: acceptance does not enable cloud backup, buy a subscription, grant
  complimentary access, or start the trial without the separate trial action.
- `AGE-24`: one server-recorded 14-day trial starts once, requires no card,
  never creates a billing subscription, never charges, and never auto-converts.
- `AGE-25`: changing account, device, provider, reinstalling, clearing local
  data, or restoring a fitness backup does not grant another trial.
- `AGE-26`: the paid screen uses live localized store/provider product data and
  discloses renewal, cancellation, provider, and included access before
  purchase.
- `AGE-27`: only a service-role operation can grant complimentary access.
- `AGE-28`: offline access expires at the documented server-verified boundary
  and cannot be extended by changing the device clock or local storage.
- `AGE-29`: locked users retain legal/auth/billing/account/export/clear routes
  while fitness entry, AI/provider calls, and cloud uploads remain blocked.
- `AGE-30`: cancellation and expiration do not delete or rewrite IndexedDB
  fitness records.

### Actual knowledge, deletion, and migration

- `AGE-31`: support or platform evidence that an account is under 13 triggers a
  restricted remediation state, stops new ordinary collection/disclosure,
  revokes sessions/entitlement as approved, and opens the reviewed deletion
  workflow.
- `AGE-32`: account deletion removes or de-identifies eligibility, guardian,
  trial, entitlement, complimentary-access, cloud-consent, Auth, and cloud
  fitness rows according to the retention schedule.
- `AGE-33`: the response accurately lists narrowly retained legal/billing
  records and deletion dates; broad silent retention fails the test.
- `AGE-34`: current local installations with no eligibility record are gated
  through a reviewed migration without uploading existing data first.
- `AGE-35`: existing local records remain intact during ordinary subscription
  migration, cancellation, expiration, and lock; under-13 remediation follows
  the separately approved local-data rule.
- `AGE-36`: restoring an old fitness backup cannot restore eligibility,
  acceptance, trial, payment, complimentary access, or cloud consent.

### Store and marketing review

- `AGE-37`: Apple Made for Kids remains off; the current age-rating
  questionnaire is answered from actual content and capabilities, not used as
  the in-app gate, and Declared Age Range scenarios pass Sandbox testing.
- `AGE-38`: Google target groups match the chosen launch posture. An 18+
  fallback selects only 18+ and enables Restrict Minor Access where available;
  a teen launch receives a separate Families/local-law review.
- `AGE-39`: name, subtitle, icon, screenshots, preview video, description,
  keywords, ads, influencer briefs, testimonials, and landing pages contain no
  child-directed representations inconsistent with the store declarations.
- `AGE-40`: no child/young-teen models, school/team positioning, child
  celebrities, cartoon mascots, youthful reward loops, “family,” “kids,” or
  “all ages” claims are introduced without reopening COPPA and store review.

## Marketing And Store Configuration Guardrails

The following can make a general-audience conclusion harder to defend even if
the Terms say 13+:

- Selecting Apple Made for Kids, Google ages under 13, or Teacher Approved.
- Descriptions such as “for kids,” “for children,” “for the whole family,” “for
  students,” “young athletes,” “teen transformation,” or “all ages.”
- Child or young-teen models, school sports positioning, child celebrities,
  cartoons/mascots, toy-like artwork, elementary language, or child-oriented
  rewards and incentives.
- Paid ads, creator/influencer instructions, or testimonials aimed at parents
  of children or under-13 users.
- Audience data showing meaningful under-13 use that is ignored because the
  intended-audience declaration says otherwise.

The current icon is not itself an obvious child-directed signal, and the
repository contains no express youth marketing. The AI-processing robot visual
should not become a mascot or a store-listing focus without re-review. The
weight-loss, calorie target, bodyweight, AI meal estimation, GPS running, and
strenuous-training features also require a teen-specific safety and content
review before choosing the 13–15 or 16–17 Play target groups. In particular,
the existing adult-oriented maintenance formula and cut/bulk workflow must not
be assumed appropriate for minors merely because its form accepts age 13.

## Remaining Publication Blockers

### Launch (18+ adults-only, worldwide)

The **18+ launch** removes the minor-specific blockers below from the launch
surface, but still requires each of these `[[PUBLICATION BLOCKER]]` items:

- An implemented, verified **adults-only age-assurance gate** (Apple Declared Age
  Range / Google Play Age Signals adult confirmation + neutral DOB fallback that
  retains only an `18+` / not-eligible determination), with data-minimization as
  specified.
- Apple/Google store declarations set to **adults-only** (content rating, target
  audience, restrict-minor-access) and consistent with the gate and marketing.
- Counsel-approved launch jurisdictions and any territory exclusions for the
  **worldwide** launch, plus the EU/UK data-protection package (GDPR Art. 9
  explicit consent for health data; Art. 27 EU representative + UK
  representative).
- Terms and complete Privacy Policy reviewed with legal entity, published
  geographic trader address, governing law/venue, dispute, refund, billing,
  retention, and regional placeholders resolved.
- Approved retention values for eligibility, acceptance, and billing records.
- Separate cloud-backup opt-in; current signed-in automatic backup does not
  satisfy the approved target.
- Final store declarations, review notes, Data Safety/App Privacy answers,
  marketing assets, and physical-device/sandbox tests.

### Deferred (FUTURE teen tier — not launch blockers)

These apply **only if** a future 13–17 teen tier is ever built; they are **not**
launch blockers because launch is 18+ adults-only:

- Counsel-approved minor jurisdictions, age of majority/consent rules, and
  regional exclusion plan; worldwide reach would trigger GDPR Art. 8 (13–16
  varies by Member State), the UK AADC, US state minor/age-appropriate-design
  laws, and — for a Texas operator — TASAA (SB 2420), the SCOPE Act (HB 18), and
  TDPSA.
- Texas App Store Accountability Act interaction: verified-parent affiliation and
  parental consent before a minor download or in-app purchase, reconciled with
  Vigorune's own guardian-authorization flow.
- Decision and implementation of a real guardian authorization workflow for
  ages 13–17.
- Counsel-approved under-13 actual-knowledge response, including the status of
  local-only IndexedDB fitness data.
- Approved retention values for guardian and denial-marker records.
- Apple Declared Age Range / PermissionKit significant-change, notification, and
  consent-revocation design; Google Play Age Signals verification-required,
  supervision, significant-change, and unavailable/not-shared design.
- Teen safety review of calorie targets, weight-change goals, meal-photo AI,
  GPS, and exercise content.
- Versioned guardian, teen-eligibility, and minor-deletion systems.

Until the launch items close, the publication choices are: keep the current
release out of the owner-approved subscription launch, or ship the selected
**18+ adults-only** launch once its blockers are implemented and legally
approved. A Terms sentence alone is not a release gate.
