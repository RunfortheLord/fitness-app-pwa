# Vigorune Terms of Use / EULA — Working Draft

> **WORKING DRAFT — NOT APPROVED FOR PUBLICATION OR ASSENT**
>
> Draft date: August 19, 2026. Prepared against repository commit `6fc03e6`
> (Publication #10). Proposed document version:
> `[[TERMS_VERSION — assign at counsel/release approval]]`.
>
> This is a drafting and implementation-control artifact, **not legal advice**.
> No agreement can eliminate legal exposure. It must be reviewed by qualified
> counsel, reconciled with a published Privacy Policy, and matched to verified
> product behavior before anything here is exposed at a `/terms` route, submitted
> to a store, or used to collect assent. Consumer, privacy, health-data,
> subscription, store, tax, and product obligations must also be satisfied in the
> product and in operations — not only in this text.
>
> **This draft resolves the owner-approved facts recorded in Section 0.1** and
> leaves every remaining decision as a conspicuous `[[PUBLICATION BLOCKER: ...]]`
> marker. Nothing here removes the need for counsel.
>
> **WORLDWIDE globalization pass (2026-08-19).** This revision supersedes the
> earlier **US-only** and **13+** working assumptions with the owner decisions in
> `docs/DECISIONS.md` (2026-08-19 entry): distribution is **worldwide**, launch
> billing is **Apple In-App Purchase + Google Play Billing only** (web/Stripe
> deferred), and the launch eligibility floor is **18+** (minor/teen support
> deferred to a clearly labeled future appendix, not built at launch). Worldwide
> reach adds EU/UK and other non-US consumer, distance-selling, and data-
> protection obligations that a US-only draft did not carry; those are folded in
> below and flagged as blockers. Going worldwide as an individual is a material
> legal-exposure decision — counsel and insurance review are more important here,
> not less.

## How to read this document

The document is deliberately split so the free, shipping product and the
approved-but-unbuilt paid product can never be confused:

- **Part A — Current-Release Terms of Use / EULA.** A clean agreement that
  matches the **verified current release**: free, local-first, optional
  authentication, optional cloud backup, **no subscription and no required
  account**. This is the only part that could plausibly be published for the
  current app after the Part A blockers close and counsel signs off.
- **Part B — Subscription Rider (owner-approved TARGET).** A clearly quarantined
  rider for the mandatory-auth, 14-day no-card trial, monthly auto-renew target.
  **It is not implemented and must not be published, assented to, or merged into
  Part A** until the paid build, billing, store configuration, and Privacy
  package are verified.
- **Part C — Store compliance maps** (Apple Standard vs custom EULA minimum
  terms; Google Play checklist).
- **Parts D–G** — adversarial review, decision alternatives, source-control
  notes, and the canonical publication-blocking register.

Bracketed annotations and `[[PUBLICATION BLOCKER: ...]]` markers must never
appear in any agreement actually shown to a user.

---

## Section 0 — Facts, boundary, and contact policy

### 0.1 Owner-approved facts resolved in this draft

The owner approved the following facts for this drafting pass. They are applied
throughout Parts A and B. Items that still need counsel, a store configuration,
or a physical artifact remain blockers even where a value is now known.

| Fact                     | Owner decision (this pass)                                                        | Residual blocker                                                                                                                                                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contracting party        | **Adam Shugart, an individual** (sole proprietor). No LLC or other entity formed. | Reconfirm at the effective date; **strongly revisit forming a single-member LLC before any recurring billing** (liability, and it supplies a business address/phone).                                                                        |
| Governing law            | **Texas.**                                                                        | None for the law choice.                                                                                                                                                                                                                     |
| Venue                    | **Texas** state and federal courts.                                               | **County is a blocker** — do not infer it; owner/counsel must name the county.                                                                                                                                                               |
| Dispute mechanism        | Undecided. **No mandatory arbitration or class-action waiver is inserted.**       | Blocker — courts vs. counsel-drafted arbitration is an owner/counsel choice (Part A §A21, Part E §E.2).                                                                                                                                      |
| Minimum age              | **18+ at launch** (supersedes the earlier 13+).                                    | Launch is adults-only; **no minor (13–17) flow is built or published**. This removes COPPA / GDPR Art. 8 / Texas TASAA-SCOPE / UK AADC minor duties from the launch surface. Teen support is a **future**, not-launch, item (Appendix M).      |
| Public contact email     | **adamshugart31@gmail.com** (owner-approved for publication).                     | None for the email itself. Note it is a personal Gmail address; a monitored business mailbox is recommended before scale.                                                                                                                    |
| Public telephone         | **Not published.** The personal number is intentionally withheld.                 | Conditional blocker: a telephone is **required** if a **custom** Apple EULA is chosen (Part C §C.1). Resolve by using Apple's Standard EULA **or** by obtaining a business number.                                                           |
| Physical mailing address | **Not supplied / not published.** Do **not** publish a home address.              | **Blocker, hardened by the worldwide decision** — a published **geographic trader address** is required by EU/UK pre-contract trader-identification law (EU Consumer Rights Directive Art. 6(1)(b)–(c); UK Consumer Contracts Regs 2013) for selling to EU/UK consumers, in addition to the custom-Apple-EULA case. Worldwide reach effectively **requires** a publishable non-residential address. Recommendation: a P.O. box / commercial mailbox / registered-agent-style address, or revisit forming an LLC (a registered agent supplies one). See §E.5, §A25, Part G. |
| Territories              | **WORLDWIDE.** Available to anyone on iPhone/Android regardless of location.       | Blocker — worldwide reach pulls in GDPR/UK GDPR (fitness = special-category health data → Art. 9 explicit consent; a US individual offering to the EU needs an **Art. 27 EU representative**, and a UK representative for the UK), EU/UK consumer law (14-day withdrawal, auto-renewal / easy-cancellation duties), and other non-US privacy/consumer regimes. Store-billed-only launch (below) shifts most tax and point-of-sale disclosure to Apple/Google but does **not** remove trader-identity, withdrawal-right, data-protection, or representative duties. See §E.5, §A11a, Part B, Part F.                                                       |

### 0.2 Verified current-release behavior (commit `6fc03e6`)

Part A must match these verified facts. It must not describe the Part B target as
if it were live.

- Core features work **without an account**. The UI offers **Continue offline**;
  core routes have no authentication or entitlement gate.
- Google and Apple sign-in are **optional** and use Supabase. IndexedDB is the
  source of truth for primary fitness records.
- Signing in currently enables **automatic snapshot activity**; the documented
  implementation also uploads daily nutrition graph rows on signed-in graph
  loads. There is **not yet** a distinct post-sign-in opt-in boundary proving all
  fitness data stays local until backup is separately enabled. Part A describes
  the behavior as it actually is and flags this; Part B assumes the corrected
  opt-in target.
- Cloud backup is **replaceable snapshot backup**, not realtime sync. Detailed
  GPS samples stay local and are excluded from cloud snapshots.
- Account deletion removes the Supabase identity and app-controlled cloud rows,
  signs the device out, and **deliberately leaves local IndexedDB records**.
- The release has Privacy, Support, and Account-Deletion routes, but **no Terms
  route, no affirmative assent record, and no immutable legal-version archive**.
- **No** billing, purchase flow, paywall, trial record, subscription entitlement,
  complimentary grant, restore/manage flow, locked-route allowlist, or
  server-signed offline lease exists.
- The iOS wrapper exists but still needs Apple configuration, archive review, and
  signed physical-device validation. **No Android wrapper is present.**
- The current Privacy Policy, store metadata, and tests describe optional
  accounts, unrestricted offline core use, and no subscription.

Supporting evidence: `docs/V1_SCOPE_FREEZE.md`, `docs/PRODUCT_REQUIREMENTS.md`,
`docs/PUBLICATION_READINESS_MASTER_AUDIT.md`, `src/app/router.tsx`,
`src/components/AppShell.tsx`, `src/pages/PublicInformationPages.tsx`.

### 0.3 Owner-approved subscription target (NOT implemented)

Part B assumes this target, subject to implementation, provider configuration,
store review, counsel review, and release verification:

- Apple or Google sign-in through Supabase becomes **mandatory** for core use;
  authentication is the identity and licensing boundary. Workout, program,
  nutrition, bodyweight, and run records **remain local unless cloud backup is
  separately enabled**.
- One server-recorded **14-day app trial** per Supabase user. It starts at first
  authenticated use of the paywalled release after legal assent, requires **no
  card**, never auto-converts, and never charges by itself.
- One **monthly, auto-renewing, full-access** subscription. Business target
  **USD $2**, but the binding price is the localized provider price shown before
  purchase.
- Channels **at launch: Apple In-App Purchase and Google Play Billing only.**
  Apple and Google act as **merchant of record** in most territories and
  collect/remit VAT/GST/sales tax worldwide, which is what makes worldwide
  distribution viable for a solo individual. **Web/Stripe billing is DEFERRED**
  and is not a launch channel; it may be revisited post-launch, only when its
  production configuration, tax/merchant-of-record handling, and purchase
  lifecycle are verified. The entitlement engine stays provider-neutral, but only
  the `apple` and `google_play` providers are wired for launch.
- **Service-role-only** complimentary grants; no public paid-alternative code.
- A short-lived, **server-verified offline lease** (target ≤ ~72 hours, never
  beyond trial/paid-through), stated only after verification.
- Signed-out/locked users retain **only** auth, paywall/purchase, restore,
  subscription management, Privacy, Terms, Support, account deletion, sign-out,
  and read-only local export.
- Cancellation, expiration, failed payment, revocation, or lock **never deletes
  local fitness records**.

### 0.4 Contact and PII policy

- The public product name is **Vigorune** (temporary; subject to naming and
  trademark review; not a persisted identifier).
- The contracting party is **Adam Shugart, an individual** (§0.1).
- The single approved public contact is the email **adamshugart31@gmail.com**.
- The owner's **personal telephone number and home address must not be
  published** in these Terms, the app, store metadata, or any custom EULA.
  Where Apple's custom-EULA minimum terms demand a telephone and postal address
  (§C.1), the resolution is Apple's **Standard EULA** or a **business**
  phone/address — never the personal ones.

---

# PART A — CURRENT-RELEASE TERMS OF USE / EULA

> **Scope of Part A:** the **free, local-first, optional-account** current
> release. Part A contains **no** subscription, trial, paywall, mandatory-account,
> or locked-mode language. Do not import any Part B clause into a current-release
> publication.
>
> Even Part A is **not publishable as-is**: the residual `[[PUBLICATION
BLOCKER]]` markers (county, mailing address, dispute mechanism, liability cap,
> Apple license model, effective date/version, territory confirmation, and
> assent mechanics) must close and counsel must review first. The current release
> also has **no assent mechanism today** — see §A1 and Part E.

## A1. Provider, agreement, and acceptance

These Terms of Use (the **Terms**) are an agreement between you and **Adam
Shugart, an individual** (**Vigorune**, **we**, **us**, or **our**), for the
Vigorune application, its public information pages, and the optional account,
backup, provider-lookup, and AI features it offers (together, the **Service**).

The current release lets you use core features **without an account** and does
not currently present an affirmative acceptance screen. By using the Service you
agree to these Terms to the extent permitted by applicable law. Continued use
after a posted change signifies acceptance of the change to the extent the law
allows.

> `[[PUBLICATION BLOCKER: The current release has no /terms route, no clickwrap,
and no acceptance record. Browsewrap-style posting is weaker to enforce.
Counsel should decide the minimum assent for a free release (at least
reasonably conspicuous notice at first run and near sign-in). The clickwrap
mechanism itself is a separate code task — do not design it here.]]`

`[[PUBLICATION BLOCKER: Insert effective date, Terms version, and Privacy Policy
version once assigned.]]`

## A2. Eligibility (18+ launch)

You must be at least **18 years old** to use the Service. Vigorune is offered
**only to adults** and is **not directed to children or teenagers**. Do not use
the Service or send us personal information if you are under 18. You may not use
the Service where applicable law prohibits us from providing it to you.

The **18+ launch floor supersedes the earlier 13+ working assumption.** Because
launch is adults-only worldwide, Vigorune does **not** implement any minor
(13–17) sign-up, guardian-authorization, or child-privacy flow, and the launch
does **not** rely on COPPA, GDPR Art. 8, the Texas App Store Accountability /
SCOPE Acts, or the UK Age Appropriate Design Code minor obligations. A possible
future teen tier is described only as **future, not-launch** design in
`docs/AGE_ELIGIBILITY_AND_MINOR_PRIVACY.md`; it must not be built or published
without a separate counsel and store-configuration pass.

> `[[PUBLICATION BLOCKER: Counsel and Apple/Google store audience declarations
must confirm the 18+ launch model and that content ratings, target-audience
answers, and any age assurance are all set to adults-only and mutually
consistent — including using Apple "Restrict Minor Access" / Google 18+ target
group where available. Verified age-assurance strength for an 18+ gate is a
data/product task, not solved by this sentence.]]`

## A3. No account required; optional authentication

The Service is designed to work **without an account**. Core workout, program,
nutrition, bodyweight, and run features are available offline and signed out.

You may **optionally** sign in with a supported Apple or Google account through
Supabase to enable account-based features such as cloud backup. If you sign in,
you must provide accurate information, keep control of your provider account and
device, and promptly report suspected unauthorized access. Signing in does **not**
convert your local records into cloud data except as described in §A4.

## A4. Local records and optional cloud backup

Your workout, program, nutrition, bodyweight, and run records are stored in
**application storage on your device** (IndexedDB). Local recording never
requires connectivity or an account.

If you are signed in and cloud backup is active, Vigorune may upload a
**replaceable snapshot** associated with your account, and currently also uploads
**daily nutrition totals** used for signed-in graphs. Cloud backup is **not**
realtime synchronization, automatic restore, version history, or an archival
guarantee. A newer snapshot may replace an older one, and a restore may replace
local data after confirmation. **Detailed GPS samples are excluded** from cloud
snapshots.

> `[[PUBLICATION BLOCKER: Verify against the shipped build exactly when sign-in
triggers uploads. The current automatic signed-in snapshot + daily-nutrition
upload behavior must be described accurately here and reconciled with the
Privacy Policy; if a separate backup opt-in is implemented (task #3), update
this clause to match. Do not claim "data stays local until you enable backup"
for the current release until that is true in code.]]`

Local browser or app storage may be erased by you, the browser, the operating
system, device loss, uninstall, storage cleanup, or software failure. **Export a
local backup** before clearing storage, replacing a device, or deleting data. We
do not promise that local or cloud data can always be recovered.

## A5. Limited license

Subject to these Terms, we grant you a limited, personal, non-exclusive,
non-transferable, non-sublicensable, revocable license to use the Service for
your personal, noncommercial fitness tracking on devices you own or control. The
application is **licensed, not sold**. We and our licensors reserve all rights
not expressly granted.

Any app obtained through the Apple App Store is also governed by the Apple
license model selected in §A15. Open-source components remain governed by their
own licenses, which control if they conflict with this limited license.

## A6. Price of the current release

The current release of Vigorune is provided **free of charge**. It contains
**no subscription, no in-app purchase, no paywall, and no advertising**. We do
not process any payment for the current release. (Paid features described in
Part B are a future target and are not offered.)

## A7. General wellness only; no medical or emergency service

Vigorune is a **general-wellness fitness logging tool**. It is not medical care,
a medical device, diagnosis, treatment, an emergency service, or a substitute for
a qualified healthcare professional. Do not use it to diagnose, treat, cure,
mitigate, or prevent any disease or condition.

Consult a qualified professional before beginning or changing exercise,
nutrition, or weight-management activity — especially if you have a health
condition, take medication, are pregnant, have symptoms, or are unsure whether an
activity is appropriate. Stop and seek help if you feel pain, faintness,
shortness of breath, or other concerning symptoms. **Call local emergency
services in an emergency; do not rely on Vigorune.**

## A8. Exercise, outdoor activity, GPS, timers, and notifications

Physical activity carries risks including overexertion, falls, collision,
equipment failure, environmental exposure, injury, and death. You are responsible
for selecting appropriate activities, technique, equipment, location,
supervision, and intensity.

Do not look at or operate the app when doing so is unsafe. Remain aware of
traffic, terrain, weather, people, and surroundings. GPS, motion, pace, distance,
route samples, timers, and notifications may be delayed, inaccurate, interrupted,
unavailable, or suppressed by the device or network. **They are not safety
systems and must not be used for emergency monitoring.**

## A9. Estimates, nutrition data, and AI output

Calorie, macro, strength, repetition, load, pace, bodyweight-trend, food,
barcode, and similar outputs are **estimates**. Food products and recipes change;
provider data may be incomplete, stale, or wrong. Check labels and professional
guidance when accuracy matters.

**Meal-photo analysis occurs only when you request it.** Images and optional
notes are sent through Vigorune's server to the configured AI provider (currently
OpenAI) to generate an estimate. AI output can be incorrect, incomplete, or
unsuitable. You must review and edit it and expressly choose whether to log it.
AI output is not automatic coaching, medical advice, or an automatic target
change.

## A10. Privacy and security

The Privacy Policy explains how Vigorune handles local fitness data, optional
account identity, optional cloud backup, AI requests, provider lookups, feedback,
security, retention, and deletion. The Privacy Policy is a notice, not a waiver of
rights and not blanket consent for uses that require separate permission.

No system is perfectly secure. Protect your device, your Apple or Google
identity, and your exported files. **Do not send passwords, provider secrets, or
authentication codes to Support.**

> `[[PUBLICATION BLOCKER: Publish and link a reconciled Privacy Policy (and a
consumer-health-data notice for each offered US state) before relying on this
clause. See docs/legal/PRIVACY_POLICY_DRAFT.md (task #9) if merged.]]`

> `[[PUBLICATION BLOCKER: App copy that calls the optional cloud connection
"encrypted" must be verified. Describe encryption precisely (e.g., encrypted in
transit via HTTPS) and do not imply end-to-end or at-rest encryption unless the
build provides it.]]`

## A11. Third-party services and terms

The Service may rely on Apple, Google, Supabase, hosting and rate-limiting
providers, OpenAI, USDA FoodData Central, Open Food Facts, and device and browser
services. Your use of those services may be subject to their terms. Availability,
accuracy, processing location, and provider behavior can change. We remain
responsible for obligations that applicable law assigns to us; this section does
not waive your non-excludable rights.

## A11a. International users, trader identity, and mandatory local rights

Vigorune is offered **worldwide** to adults. If you use the Service from the
European Union, the United Kingdom, or another jurisdiction with mandatory
consumer- or data-protection law, you keep the rights that law gives you and
nothing in these Terms waives them, regardless of the governing-law and venue
choices in §A21.

Where we act as a trader dealing with a consumer at a distance, applicable law
(for example the EU Consumer Rights Directive and the UK Consumer Contracts
Regulations 2013) requires us to identify ourselves and give a geographic
address and contact details before you are bound. Our published trader identity
and contact details appear in §A1 and §A25.

> `[[PUBLICATION BLOCKER: A published geographic trader address is legally
required for EU/UK (and effectively for worldwide) distance selling and is not
yet supplied. Do not launch worldwide sales exposing only an email. Resolve with
a non-residential postal address (P.O. box / commercial mailbox / registered
agent) — never a home address. See §0.1, §A25, §E.5, Part G.]]`

> `[[PUBLICATION BLOCKER: Data-protection representative. A US individual
offering the Service to people in the EU/EEA generally needs an Art. 27 GDPR EU
representative, and a separate UK GDPR representative for the UK, whose identity
and contact must be published in the Privacy Policy. Confirm applicability and
appoint before EU/UK launch. See docs/legal/PRIVACY_POLICY_DRAFT.md and §F.]]`

You retain ownership of the fitness records, notes, images, and other content you
provide. You grant us a limited, non-exclusive license to host, transmit,
process, reproduce, and format that content **only as reasonably needed to
perform features you request** — such as cloud backup, AI analysis, support, or
export. This license ends when the operational need and disclosed retention
period end, subject to backups, legal obligations, and content you keep locally.

If you voluntarily provide feedback, you allow us to use it without payment to
improve the Service, but you keep any rights the law does not permit you to
waive. Nothing prohibits an honest review, a report to a regulator, or lawful
discussion of the Service.

Vigorune and its software, design, text, and other provider materials are owned
by us or our licensors and protected by intellectual-property laws. No rights are
granted except the limited license in these Terms and applicable open-source
licenses.

## A13. Acceptable use

You may not: use the Service unlawfully or to infringe another person's rights;
access another person's account without authorization; interfere with security,
availability, rate limits, or provider services; introduce malware, scrape
protected services, or overload the Service; reverse engineer or circumvent
technical restrictions except to the extent applicable law or an open-source
license expressly permits; or use the Service to build or train a competing
service from protected content in violation of law or these Terms.

We may investigate and restrict suspected abuse proportionately, while preserving
the legal, account-deletion, and export routes described in these Terms where
required.

## A14. Account, cloud, and local data deletion

For the current release these are separate actions:

1. **Signing out** — ends the device session; deletes nothing.
2. **Deleting cloud data / deleting your account** — removes the Supabase
   identity and app-controlled cloud rows (snapshot and daily-nutrition rows) and
   signs the device out. It **does not** delete local records on your devices.
3. **Clear all data** — clears local records on that device.

Because the current release has **no subscription**, deleting an account does not
raise any billing question. Export a local backup before clearing local data if
you may want it later. Apple users may also revoke Vigorune under their Apple
Account's Sign in with Apple settings, which is separate from deleting Vigorune's
account and cloud data.

## A15. Apple App Store license supplement

> **Owner direction (2026-08-19), pending counsel confirmation:** use Apple's
> **Standard EULA** for the licensed iOS app and these Terms for the
> account/services relationship, with a short priority clause (§A26). This path
> is preferred precisely because worldwide distribution and the no-personal-
> contact decision make a **custom** EULA (which requires publishing a telephone
> **and** postal address, Apple minimum term #8) undesirable. The custom
> supplement below is retained only as a fallback if counsel later approves it and
> App Store Connect is configured for a custom EULA.
>
> `[[PUBLICATION BLOCKER: Confirm the Standard-EULA selection in App Store Connect
and confirm with counsel that these service Terms + Apple Standard EULA fully
cover the worldwide account/services relationship. Never submit both as competing
Apple license agreements.]]`

If Vigorune is distributed through the Apple App Store and a **custom EULA** is
selected, the following applies to that app:

1. These Terms are between you and **Adam Shugart**, not Apple. The developer,
   not Apple, is responsible for the app and its content.
2. The license is non-transferable and limited to Apple-branded products you own
   or control as permitted by Apple's Usage Rules, except for access allowed
   through Family Sharing or volume purchasing under those rules.
3. The developer is responsible for maintenance and support as required by these
   Terms or applicable law. Apple has no obligation to provide maintenance or
   support.
4. If the app fails to conform to an applicable warranty not effectively
   disclaimed, you may notify Apple, and Apple may refund the purchase price (if
   any) for the app. To the maximum extent permitted by law, Apple has no other
   warranty obligation; the developer is responsible for other claims, losses,
   liabilities, damages, costs, or expenses attributable to a warranty failure.
5. The developer, not Apple, is responsible for product-liability, legal or
   regulatory, consumer-protection, and privacy claims relating to the app. No
   limitation in these Terms exceeds what applicable law permits.
6. The developer, not Apple, is responsible for investigating, defending,
   settling, and discharging any third-party intellectual-property infringement
   claim relating to the app or your use of it.
7. You represent that you are not located in a country subject to a U.S.
   Government embargo or designated as supporting terrorism, and are not on a
   U.S. Government prohibited or restricted-party list.
8. Developer contact: **Adam Shugart**, `[[PUBLICATION BLOCKER: publishable
postal address]]`, `[[PUBLICATION BLOCKER: telephone required for a custom
EULA — use a business number or select the Standard EULA]]`,
   **adamshugart31@gmail.com**.
9. You must comply with applicable third-party terms when using the app.
10. Apple and its subsidiaries are third-party beneficiaries of this section and
    may enforce it against you.

## A16. Google Play supplement

For a Google Play-distributed app, Google is **not** the contracting provider of
the Vigorune Service. Vigorune remains responsible for the Service and for claims
that applicable law assigns to Vigorune. Because the current release is free with
no in-app purchase, no Google Play Billing applies. If you use Google or Apple
sign-in, that provider's terms govern the sign-in itself.

## A17. Service changes, suspension, and termination

We may update, change, suspend, or discontinue features for security, legal,
provider, technical, or business reasons. We may suspend or terminate access for
a material breach, security risk, or legal requirement. Where feasible and
lawful, we will provide notice and a way to contact Support. **Termination does
not delete your local records** merely because access ended, and it does not
remove non-waivable account-deletion, legal, or export rights.

## A18. Disclaimer of warranties

TO THE MAXIMUM EXTENT PERMITTED BY LAW, VIGORUNE AND THE SERVICE ARE PROVIDED
"AS IS" AND "AS AVAILABLE." WE DISCLAIM IMPLIED WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, ACCURACY, AND QUIET
ENJOYMENT TO THE EXTENT THEY MAY LAWFULLY BE DISCLAIMED. WE DO NOT WARRANT THAT
THE SERVICE, BACKUP, EXPORT, GPS, TIMERS, NOTIFICATIONS, PROVIDER DATA, OR AI
OUTPUT WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR RECOVERABLE.

THIS DISCLAIMER DOES NOT EXCLUDE AN EXPRESS WARRANTY WE MAKE, A WARRANTY THAT LAW
DOES NOT PERMIT US TO DISCLAIM, OR A REMEDY AVAILABLE UNDER APPLICABLE CONSUMER
LAW (INCLUDING THE TEXAS DECEPTIVE TRADE PRACTICES–CONSUMER PROTECTION ACT).

## A19. Limitation of liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER PARTY WILL BE LIABLE FOR INDIRECT,
INCIDENTAL, SPECIAL, EXEMPLARY, PUNITIVE, OR CONSEQUENTIAL DAMAGES, OR LOST
PROFITS, REVENUE, GOODWILL, OR DATA, ARISING FROM THE SERVICE, EVEN IF ADVISED
THAT SUCH DAMAGES ARE POSSIBLE.

OUR AGGREGATE LIABILITY ARISING FROM THE SERVICE WILL NOT EXCEED
`[[PUBLICATION BLOCKER: INSERT COUNSEL-APPROVED CAP. For a free release a modest
fixed floor such as USD $100 is a common starting point; see §E.3. A "fees paid"
cap is near-zero for a free app, so a fixed floor matters here.]]`.

THE EXCLUSIONS AND CAP DO NOT APPLY TO FRAUD, WILLFUL MISCONDUCT, GROSS
NEGLIGENCE WHERE IT CANNOT BE LIMITED, DEATH OR PERSONAL INJURY CAUSED BY
LIABILITY THAT CANNOT BE EXCLUDED, VIOLATION OF NON-WAIVABLE CONSUMER RIGHTS, OR
ANY OTHER LIABILITY THAT APPLICABLE LAW DOES NOT PERMIT US TO LIMIT. SOME
JURISDICTIONS DO NOT ALLOW SOME EXCLUSIONS, SO THEY MAY NOT APPLY TO YOU.

## A20. Indemnity

To the extent permitted by law, you will be responsible for reasonable losses,
claims, and expenses arising from your intentional unlawful use of the Service,
your material breach of §A13, or content you knowingly provide in violation of
another person's rights. This obligation does not require you to indemnify us for
our own negligence, misconduct, legal violations, product defects, or matters for
which consumer law does not permit indemnification. We will provide reasonable
notice and allow reasonable participation in the defense, and we may not settle a
claim imposing a non-monetary obligation on you without your consent.

> `[[PUBLICATION BLOCKER: Counsel must confirm enforceability and scope,
especially for minors and consumers, in Texas and any other offered
territory.]]`

## A21. Governing law and disputes

These Terms are governed by the laws of the **State of Texas**, without regard to
conflict-of-laws rules, except where the mandatory consumer law of your
jurisdiction applies. Subject to the dispute mechanism selected below, the
exclusive venue for disputes is the state and federal courts located in
`[[PUBLICATION BLOCKER: name the Texas county]]`, Texas.

> `[[PUBLICATION BLOCKER: Select the dispute mechanism. No mandatory arbitration
clause and no class-action waiver has been inserted. Recommended starting point
for a low-price US release: ordinary courts plus an express small-claims path,
no class waiver (§E.2). If counsel instead drafts individual arbitration, it
must include a meaningful opt-out, small-claims carve-out, regulator access,
fair cost allocation, named administrator/rules, mass-arbitration handling, and
severability — do not paste a generic clause.]]`

Nothing in these Terms prevents a party from reporting a concern to a government
agency (including the Texas Attorney General) or from seeking relief that
applicable law makes non-waivable.

## A22. Consumer-law savings (worldwide)

These Terms do not waive rights or remedies that cannot lawfully be waived,
including under the **Texas Deceptive Trade Practices–Consumer Protection Act**
(Tex. Bus. & Com. Code Ch. 17); the mandatory consumer-protection, distance-
selling, withdrawal-right, and unfair-terms rules of the **European Union** and
its Member States and of the **United Kingdom**; and any consumer law of your
usual residence that applies despite a governing-law or venue clause. For a
consumer habitually resident in the EU or UK, a choice of Texas law does not
deprive you of protection under the mandatory rules that would apply absent that
choice. Any disclaimer, limitation, or dispute clause in these Terms applies only
to the maximum extent permitted by the law that applies to you.

## A23. Export controls and sanctions

You may not use, export, re-export, or transfer the Service in violation of U.S.
export controls, sanctions, or other applicable trade laws. You represent that
you are not prohibited from receiving the Service under applicable restricted-
party rules. This clause does not require a consumer to make a representation
broader than applicable law or the Apple minimum custom-EULA terms require.

## A24. Changes to these Terms

We may update these Terms prospectively. We will identify the new version and
effective date and make each version reproducible. For a material change, we will
provide reasonable notice through the app or public pages. Changes do not silently
delete your local records or erase already-accrued rights.

## A25. Notices and contact

We may provide notices in the app or on the public information pages. Questions,
complaints, and legal notices should be directed to:

**Adam Shugart**

`[[PUBLICATION BLOCKER: publishable postal address — do not publish a home
address; use a P.O. box or registered-agent-style address, or revisit forming an
LLC]]`

**adamshugart31@gmail.com**

(No public telephone is published for the current release. A telephone is only
required if a custom Apple EULA is used; see §C.1.)

## A26. General terms

If a provision is unenforceable, it will be limited to the minimum extent
necessary and the remainder will continue unless applicable law requires a
different result. A failure to enforce a provision is not a waiver. You may not
assign these Terms without our consent, but we may assign them with the Service
subject to applicable notice and consumer law. These Terms and the selected Apple
license form the agreement for their respective subjects; **the Apple Standard
EULA (if selected) controls the Apple software license, and these Terms control
the Vigorune account and services**. Provisions that by their nature should
survive will survive termination.

---

# PART B — SUBSCRIPTION RIDER (owner-approved TARGET)

> **⚠ NOT IMPLEMENTED. DO NOT PUBLISH, ASSENT TO, OR MERGE INTO PART A. ⚠**
>
> Part B describes the owner-approved paid target (§0.3): mandatory Apple/Google
> auth, one 14-day no-card trial, one monthly auto-renewing subscription targeted
> at USD $2. **None of this exists in the current build.** No billing SDK, store
> product, server entitlement, trial record, offline lease, or locked-mode gate
> is implemented (§0.2). This rider is a drafting control for the future paid
> release and must not be shown to any user, exposed at `/terms`, or submitted to
> a store until the paid build, billing, store configuration, Privacy package,
> and counsel review are all complete and verified.

Part B replaces or supplements the marked Part A clauses **only when a verified
paid build is released**. Until then, Part A governs and Part B is inert.

## B1. Mandatory authentication and entitlement (replaces §A3)

In the paid release, core use requires a Vigorune account authenticated with a
supported Apple or Google sign-in through Supabase. Authentication establishes
the identity used for trial, paid, complimentary, and locked access. It does not
by itself authorize Vigorune to upload all of your fitness records — those remain
local unless you separately enable cloud backup (§A4 as amended by the verified
opt-in target).

## B2. One 14-day app trial (no card, no auto-charge)

An eligible Supabase user may receive **one** 14-day Vigorune app trial. The
trial: starts only after successful authentication, affirmative acceptance of the
current legal documents, and server confirmation immediately before first core
access; uses server-recorded start and end times; requires **no card**; does
**not** enroll you in a subscription; does **not** automatically renew, convert,
charge, or create a payment obligation; and does not reset because you sign out,
reinstall, clear local storage, change devices, or use another client with the
same account.

When the trial ends, core access locks unless the server confirms paid or
complimentary access. You must affirmatively complete a separate purchase to be
charged. **Starting the free trial is not a subscription purchase.**

> `[[PUBLICATION BLOCKER: Implement idempotent server trial creation, delete/
re-create abuse handling, exact UTC boundary tests, legal-version linkage, and
the first-use rule for pre-existing accounts.]]`

## B3. Monthly auto-renewing subscription

Vigorune plans one monthly full-access subscription. The purchase screen will
show the actual product name, localized price, currency, billing period, any
applicable tax treatment, renewal terms, and billing provider **before** you
purchase. The initial **USD $2** business target is not a promise that every user
or storefront will see or pay USD $2.

When you affirmatively purchase, the subscription **renews automatically each
month until canceled**. The applicable billing provider charges the payment
method associated with that provider at purchase and each renewal, subject to the
provider's terms and applicable law. The **provider-confirmed** transaction and
entitlement state — not a screenshot, client flag, or device-only receipt —
determines paid access.

> `[[PUBLICATION BLOCKER: Insert the verified purchase-during-trial result:
whether an early purchase charges immediately, ends the trial, or schedules
paid service after the trial, and what happens to unused trial time.]]`

## B4. Localized prices, taxes, and price changes

Prices may vary by country, currency, storefront, exchange rate, taxes, and
channel. The price and total the billing provider presents for your transaction
control over marketing examples or older screenshots. Applicable taxes
(including VAT/GST/sales tax) may be included or added as shown before purchase.
Because the launch subscription is sold **through Apple and Google only**, Apple
or Google acts as **merchant/seller of record** in most territories and
calculates, collects, and remits the applicable consumption tax; the store
purchase screen is the controlling point-of-sale tax disclosure.

We may change the subscription price prospectively, following the billing
provider's rules and applicable law, including required advance notice and
consent. A provider may preserve the existing price, apply a new price after
notice, request your consent, or end renewal if required consent is not given. We
will not charge a changed web price without the notice and consent required by
law. **Changing these Terms alone does not authorize a different recurring
charge.**

## B5. Billing channels and provider control

At launch, a subscription is offered **only through Apple In-App Purchase (on
iOS/iPadOS) and Google Play Billing (on Android)**. **Web/Stripe billing is
deferred and is not offered at launch.** Do not describe or configure any
non-store payment path for the covered digital subscription at launch. Each store
channel may have different purchase, tax, renewal, grace, cancellation,
restoration, and refund mechanics, and a channel may not be offered in every
territory.

A purchase is not complete, and paid access is not granted, while the provider
reports it as pending, deferred, unverified, canceled before completion, or
otherwise incomplete. If a provider reports expiration, refund, revocation,
account hold, or failed payment, access follows the verified provider state and
any configured grace period.

## B6. Cancellation, paid-through access, and management

You may cancel future renewal using the management method for the channel where
you subscribed. Cancellation usually stops future renewal and leaves access
active through the provider-confirmed paid-through time; some jurisdictions or
provider actions may instead end access earlier with a full or prorated refund.
The verified provider state controls.

Deleting the app, signing out, disabling cloud backup, clearing local data, or
deleting a Vigorune account does **not necessarily cancel a subscription**.
Cancel through the applicable provider:

- **Apple:** the in-app **Manage Subscription** route or Apple's subscription
  settings; or
- **Google Play:** the in-app management link or Google Play's Subscription
  Center.

(No web/Stripe cancellation route exists at launch because web billing is
deferred; `[[WEB_BILLING_PORTAL_OR_CANCELLATION_URL]]` is reserved for a future
web channel only.)

Cancellation must be at least **as easy as sign-up** and must be possible
**online**, without a phone call or email approval step. This reflects Texas
SB 838 (§ 35.53 et seq., effective 2025-09-01), the EU Omnibus/auto-renewal
regime, and the UK Digital Markets, Competition and Consumers Act 2024
subscription rules. For store-billed subscriptions, the platform Manage-
Subscription flow provides this online, one-tap cancellation.

> `[[PUBLICATION BLOCKER: Verify the Apple and Google management routes resolve
correctly while signed out and locked, and confirm the platform cancellation
flow satisfies EU/UK/US easy-cancellation duties in the target storefronts. The
UK DMCC subscription-contract provisions (reminder notices, cooling-off after a
free trial or long-term auto-renewal, easy exit) are being brought into force in
2026 — confirm the in-force date and detailed requirements with counsel before a
UK launch.]]`

## B7. Restore purchases and ownership conflicts

Where supported or required, **Restore Purchases** asks the billing provider to
recheck eligible transactions; it does not create a new charge. Restoration may
require the same store account used for purchase and the Vigorune account the
verified transaction is linked to. A transaction already bound to another
Vigorune account will **not** be silently transferred; contact Support for the
verified recovery process.

> `[[PUBLICATION BLOCKER: Implement/test restore, purchase-to-Supabase binding,
conflict recovery, and any cross-platform entitlement policy.]]`

## B8. Refunds

Because launch billing is **store-only**, Apple and Google administer refund
requests under their rules and applicable law; use the store's refund method for
a store purchase. (No web refund policy applies at launch because web billing is
deferred; a counsel-approved web refund policy and request method — see §E.6 —
would be required only if a web channel is later added.)

Nothing here limits a refund or remedy applicable law requires — including a
consumer's statutory withdrawal or cancellation rights under §B8a and applicable
EU/UK/other consumer law. A refund or charge reversal may cause the provider to
revoke or shorten paid access, but it **does not delete local fitness records**.

## B8a. EU/UK statutory right of withdrawal (digital service)

If you are a consumer in the EU or UK, you generally have a **14-day right of
withdrawal** from a distance contract for a paid subscription. A subscription to
an ongoing digital service like Vigorune is treated as a **digital service**, so
this right applies unless it is lawfully lost as described below.

For paid digital services, EU/UK law lets the consumer **lose** the withdrawal
right once performance has begun **only if** the consumer (i) gave **prior
express consent** to performance starting during the 14-day period and (ii)
**acknowledged** that doing so means losing the right of withdrawal. When these
purchases are made through Apple or Google, the store purchase flow and the
store's own consumer terms are the primary vehicle for this consent,
acknowledgement, and any resulting withdrawal/refund handling; these Terms
supplement, and do not override, the store's process or your statutory rights.

> `[[PUBLICATION BLOCKER: Confirm with counsel (a) how the Apple and Google
purchase flows in EU/UK storefronts capture the express-consent + acknowledgement
that a consumer loses the 14-day withdrawal right on immediate performance, and
whether Vigorune must present any supplemental in-app consent copy at the point
of sale; (b) the interaction with store-administered refunds; and (c) the exact
point-of-sale withdrawal-right notice EU/UK law requires. Do not paste a generic
model withdrawal form until the store-billed flow is verified.]]`

## B9. Complimentary access

We may grant or revoke full complimentary access through a private,
service-role-only process. Complimentary access may be permanent or time-limited,
has no cash value, is not transferable, is not a public paid tier, and does not
renew or charge. It does **not** cancel an existing paid subscription — a
recipient who no longer wants a paid subscription must cancel with the provider.

## B10. Limited offline access and verification

Trial, paid, or complimentary users may receive a short-lived, server-verified
offline access lease. Offline access may require periodic online sign-in and
entitlement verification and never extends beyond the verified trial end,
paid-through time, or complimentary end. When the lease expires and access cannot
be verified, core features may lock until verification succeeds.

> `[[PUBLICATION BLOCKER: Do not insert "72 hours" or any exact duration until
the signed lease, server-time behavior, revocation, clock rollback, provider
outage, active workout/run persistence, and every supported platform pass
release tests.]]`

## B11. Locked and signed-out access; local-data preservation

When signed out or locked, you may use only the routes made available for
authentication, purchase/restoration, subscription management, Privacy, Terms,
Support, account deletion, sign-out, and **read-only export of existing local
data**. Locked access does not permit new or changed fitness logs.

Cancellation, expiration, payment failure, refund, revocation, complimentary
expiration, or loss of verification **does not delete local fitness records**. An
in-progress activity must be saved without being silently completed, discarded,
or changed before a lock takes effect.

## B12. Account deletion vs. store billing (amends §A14)

In the paid release, before immediate account deletion, Vigorune will warn you if
a store subscription may continue billing and will provide the appropriate
management route. **Account deletion does not guarantee cancellation of Apple or
Google billing — cancel with the store to stop renewal.** Account deletion
removes the Vigorune authentication account and app-controlled cloud fitness
data, subject to disclosed legal retention for billing, tax, fraud prevention,
security, assent evidence, and dispute records; it signs the device out; and it
does not clear local records.

> `[[PUBLICATION BLOCKER: Define retained record categories and periods;
implement locked and web deletion paths; verify the provider-subscription
warning; reconcile "one trial" enforcement with account deletion/re-creation.
See docs/ACCOUNT_DELETION_AND_SUBSCRIPTION_AUDIT.md (task #8) if merged.]]`

## B13. Required point-of-sale and destructive-action copy

These disclosures must be **visually proximate** to the relevant action. General
Terms cannot replace them. **No checkbox may be preselected.**

### B13.1 Start the no-card 14-day app trial

> **14 days of full Vigorune access.** No card or payment method is required.
> This app trial does not start a subscription, does not renew, and will never
> automatically charge you. It starts when you select **Start 14-day free
> access** and the server confirms your acceptance below. Access ends on
> **[localized date, time, and time zone]** unless you separately purchase a
> subscription or receive complimentary access. One trial is available per
> eligible Vigorune account.

Unchecked controls:

- `[ ] I agree to the Terms of Use (version [[TERMS_VERSION]]).`
- `[ ] I acknowledge that I have read the Privacy Policy (version [[PRIVACY_VERSION]]).`

Button: **Start 14-day free access**

### B13.2 Purchase the monthly auto-renewing subscription

> **Vigorune Full Access — [provider-localized price] per month.** Payment will
> be charged to your **[Apple / Google Play]** account when you
> confirm. The subscription automatically renews monthly at the then-applicable
> price unless canceled before renewal. Manage or cancel through \*\*[provider
>
> > route]**. Cancellation normally takes effect after your provider-confirmed
> > paid-through date. Taxes **[are included / will be added]** as shown. Refunds
> > follow provider rules, applicable law, and the web refund policy where
> > applicable. **[Insert verified purchase-during-trial timing.]\*\*

Button: **Subscribe for [localized price]/month** (never a generic **Continue**;
never bundle subscription consent into accepting the general Terms).

### B13.3 Delete an account while store billing may remain active

> **Deleting your Vigorune account may not cancel your Apple or Google Play
> subscription. Store billing can continue until you cancel it with the store.**
> Use **Manage Subscription** before deleting if you want renewal to stop.
> Account deletion removes your Vigorune identity and app-controlled cloud data
> subject to disclosed legal retention, signs this device out, and does not
> delete local device data. Export local data first if you want a portable copy.

Actions, in order: **Manage Subscription** → **Export local data** →
`[ ] I understand deleting my account may not cancel store billing and does not
clear local device data.` → **Delete Vigorune account**.

## B14. Mandatory assent and version-recording design (paid release)

This is a required product design for the paid release, **not** something to
build for the current free app, and **not** a clickwrap this task designs.
Summary of the controls counsel and engineering must satisfy:

1. Authenticate first; do not start the trial while the user is only
   authenticating or reading legal documents.
2. Fetch a server-declared current Terms and Privacy version; serve immutable,
   reproducible documents at public URLs.
3. Show conspicuous links and **two separate unchecked controls** (agree to
   Terms; acknowledge Privacy). Acknowledgement is not blanket consent.
4. State the trial terms adjacent to the acceptance action.
5. In one server transaction, verify the user and document versions, append the
   acceptance record, and idempotently create the one trial.
6. Record at minimum: acceptance ID, Supabase user ID, Terms/Privacy versions,
   a cryptographic digest of each exact document, server timestamp, action,
   channel/platform, app/build version, locale, and a bounded audit identifier.
   No health data or private complimentary notes.
7. Deny anonymous/authenticated clients direct write access to acceptance,
   trial, billing, and grant tables; use service-role-only server operations.
8. Retain each accepted version and a receipt the user can view or download;
   surface acceptance date/versions in Account/Legal settings.
9. Require renewed assent only for a material change; never overwrite an old
   acceptance or treat browsing as assent.
10. Keep purchase consent separate; record provider transaction evidence and the
    exact point-of-sale disclosure version presented.
11. A user who declines renewed Terms still reaches legal, management,
    account-deletion, support, and export routes.
12. Set a counsel-approved retention/deletion policy for assent evidence.

This reflects the E-SIGN framework and the online-contract standard of
reasonably conspicuous notice plus unambiguous assent (§F). It must still be
reviewed under Texas law and each offered territory.

---

# PART C — Store compliance maps

## C.1 Apple: Standard EULA vs. custom EULA minimum-terms map

Apple lets a developer use either **Apple's Standard EULA** (the Licensed
Application End User License Agreement) or a **custom EULA** that includes
**at least** the Apple minimum terms. The table maps each Apple minimum term to
where this draft satisfies it and to the residual work. Verified against Apple's
current minimum-terms and Standard-EULA pages (§F).

| #   | Apple minimum term                                                                                                | Where addressed here | Status / residual                                                                                                                                                                                                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Acknowledgement: agreement is between developer and end-user, not Apple; developer solely responsible for the app | §A15(1)              | OK once §A15 published in the custom path                                                                                                                                                                                                                                                 |
| 2   | Scope of license limited to Apple-branded products per Usage Rules; Family Sharing/volume exceptions              | §A15(2)              | OK                                                                                                                                                                                                                                                                                        |
| 3   | Maintenance and support are the developer's responsibility; Apple has none                                        | §A15(3)              | OK                                                                                                                                                                                                                                                                                        |
| 4   | Warranty: developer responsible; Apple may refund price, no other warranty obligation                             | §A15(4)              | OK                                                                                                                                                                                                                                                                                        |
| 5   | Product claims (product liability, legal/regulatory, consumer protection) are the developer's                     | §A15(5)              | OK                                                                                                                                                                                                                                                                                        |
| 6   | Intellectual-property claims handled by developer                                                                 | §A15(6)              | OK                                                                                                                                                                                                                                                                                        |
| 7   | Legal compliance: user warrants not in embargoed country / not a restricted party                                 | §A15(7), §A23        | OK                                                                                                                                                                                                                                                                                        |
| 8   | **Developer name AND address, plus contact info (telephone number; email)**                                       | §A15(8), §A25        | **BLOCKED for custom path** — no publishable postal address; owner will not publish a personal phone. Apple's minimum terms require a telephone. Resolve by **using the Standard EULA** (avoids publishing phone/address in a custom doc) or by obtaining a **business** phone + address. |
| 9   | Reference that user must comply with applicable third-party terms                                                 | §A15(9), §A11        | OK                                                                                                                                                                                                                                                                                        |
| 10  | Apple and subsidiaries are third-party beneficiaries and may enforce                                              | §A15(10)             | OK                                                                                                                                                                                                                                                                                        |

**Recommendation (Apple):** for the current free release and the first paid
release, select **Apple's Standard EULA** for the iOS software license and use
these Terms for the account/services relationship (§A26 priority clause). This
sidesteps the telephone/address publication requirement that a custom EULA
imposes (term #8) and reduces overlap-with-Usage-Rules review. Choose a custom
EULA only if the owner obtains a business phone and address and counsel approves
every overlap. **Never submit both as competing Apple license agreements.**

Additional Apple obligations that live in product/store config, not just this
text (for the paid release):

- In-App Purchase is required for the covered digital subscription; auto-renewing
  subscriptions must deliver ongoing value (App Review Guideline 3.1.2). Ongoing
  value is an **owner blocker** (§E notes / task #4).
- Because the app supports account creation, Apple requires an **in-app account
  deletion** path (already present for the current release; the paid release adds
  the store-billing warning of §B12/§B13.3).
- Subscription metadata must show price, period, and renewal terms; price
  increases follow Apple's notice/consent rules (§B4).

## C.2 Google Play checklist

Verified against Google Play's current policies (§F). Items are release-gates for
the paid target; the current free release only triggers the account-deletion and
data-safety items.

- [ ] **Billing (paid release):** use **Google Play Billing** for the covered
      digital subscription unless an enumerated exception applies (Payments policy).
      Do not ship a non-Play payment path for in-app digital subscriptions on
      Android.
- [ ] **Subscription disclosures:** clearly disclose cost, billing frequency, and
      renewal terms before purchase, and provide an **easy online cancellation**
      method (Subscriptions policy). Mirrors §B3/§B6/§B13.2.
- [ ] **Lifecycle handling:** implement and test verified states — pending, grace
      period, account hold, cancellation, expiration — and Real-Time Developer
      Notifications; never grant paid access on a client flag (§B5).
- [ ] **Restore/reconciliation:** implement purchase restoration/reconciliation
      and bind transactions to the Supabase user (§B7).
- [ ] **Account deletion — in-app AND web:** provide an in-app deletion path
      **and** a functional web resource where a user can **request** account and
      associated-data deletion **without reinstalling the app**. The current public
      Account-Deletion page redirects into app settings, which does **not** satisfy
      the web-resource requirement.
      `[[PUBLICATION BLOCKER: add an app-independent web deletion request path.]]`
- [ ] **Data safety form:** complete/verify the Data safety section to match the
      reconciled Privacy Policy (identity, entitlement, billing, health data).
- [ ] **Age / target audience:** set the content rating and target-audience
      declarations consistent with the **18+ adults-only** launch policy (§A2),
      and enable an 18+ / restrict-minor-access target group where the store
      supports it. Do not select any child/teen target group at launch.
- [ ] **Android project exists:** there is currently **no Android wrapper**;
      Play distribution cannot proceed until it exists and passes QA.

---

# PART D — Adversarial consistency review

### D.1 Findings against verified release behavior (target track)

| Severity | Finding                                                                                                                      | Required correction                                                                                                                                       |
| -------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Critical | Current scope/routes/UI/tests permit core use without an account; the target requires mandatory auth and locked routes.      | Implement a central auth/entitlement gate, preserve allowed routes and export, and verify deep links/background entry (task #5).                          |
| Critical | No trial, paid entitlement, complimentary grant, or offline lease exists.                                                    | Server-authoritative tables, RLS, provider verification, service-role mutations, leases, lifecycle tests, fail-closed behavior (task #2).                 |
| Critical | No Apple/Google/web billing exists; Android is absent.                                                                       | Implement per-platform billing, configure products/webhooks, verify sandbox+production, advertise only available channels.                                |
| Critical | No Terms route, assent UI, version archive, or acceptance record.                                                            | Implement §B14 and test immutable docs, unambiguous acceptance, reassent, decline paths.                                                                  |
| Critical | Signed-in automatic snapshot + daily-nutrition uploads conflict with "data stays local until backup is separately enabled."  | Enforce a distinct backup opt-in, prevent pre-opt-in uploads, verify network traces (task #3). Part A currently describes the real behavior and flags it. |
| Critical | Current Privacy Policy/store metadata say accounts are optional and the app is free/offline.                                 | Replace only when the paid build is verified; update Privacy, review notes, screenshots, Data Safety/App Privacy, marketing together.                     |
| High     | Account-deletion flow has no store-subscription warning (billing doesn't exist yet).                                         | Add §B12/§B13.3 flow, provider-status check, immediate-deletion option.                                                                                   |
| High     | Public deletion page routes into app settings; Google requires a functional web request resource.                            | Add an app-independent web deletion request path (§C.2).                                                                                                  |
| High     | Delete/recreate identity may defeat "one trial" unless minimal anti-abuse data is retained (tension with deletion promises). | Choose identity binding, lawful basis, disclosure, retention, appeal, deletion behavior; implement server-side.                                           |
| High     | Purchase timing during the trial is undefined.                                                                               | Decide charge/access start; use identical POS/receipt/entitlement/Terms language.                                                                         |
| High     | Cross-platform ownership and restoration are undefined.                                                                      | Decide portability; bind transactions to Supabase users; design conflict recovery.                                                                        |
| High     | Locked-user read-only export is not an independently verified surface.                                                       | Expose export without unlocking mutations or leaking another user's local data.                                                                           |
| High     | Current offline use is unrestricted/indefinite; target requires a short lease.                                               | Implement signed lease, bounded server time, refresh/revocation, active-session persistence, expiry, outage behavior.                                     |
| High     | No publishable postal address; a custom Apple EULA needs name, address, telephone, email.                                    | Owner/legal: provide business contact fields or use Apple Standard EULA + service Terms (§C.1).                                                           |
| High     | 18+ launch floor approved; store audience/age-rating config and adults-only assurance must match it.                          | Set adults-only content rating + target audience + restrict-minor-access; verify no minor sign-up path. Minor/guardian flow is deferred, not built.        |
| High     | Worldwide launch adds EU/UK trader-identity, withdrawal-right, auto-renewal, GDPR Art. 9 consent, and Art. 27/UK-rep duties.  | Publish geographic trader address; verify store withdrawal/consent + easy-cancellation flows; appoint EU/UK representative; reconcile Privacy Policy.       |
| Medium   | Cloud copy says "encrypted" while security docs promise ordinary HTTPS and no app-level at-rest encryption.                  | Describe encryption precisely; don't imply end-to-end/at-rest unless verified (§A10).                                                                     |
| Medium   | iOS auth/deletion/native behaviors unverified on a signed build; Android absent.                                             | Complete platform-specific physical+sandbox testing before enabling those clauses.                                                                        |
| Medium   | Legal name may change if an entity is formed.                                                                                | Finish entity choice before assigning the effective date; strongly consider a single-member LLC before recurring billing.                                 |

### D.2 Plaintiff / regulator / store-review attack tests

1. **"The free trial charged me."** Draft says the app trial takes no payment
   method and never converts; the build must not configure a contradicting
   provider trial. Any later purchase is a distinct affirmative act.
2. **"I subscribed on day 5 and was charged sooner than expected."** Outcome is
   undefined and blocks publication (§B3).
3. **"I canceled but lost access immediately."** Terms promise the verified
   paid-through state; the entitlement normalizer/UI must show the exact provider
   result.
4. **"I deleted my account but Apple kept charging me."** Warning, manage action,
   and immediate-deletion option must appear before confirmation and remain
   available while locked (§B12/§B13.3).
5. **"Complimentary access hid my paid renewal."** A grant does not cancel
   billing; the UI must still show paid status and a management route.
6. **"The app uploaded my nutrition after I only signed in."** Current product
   contradiction; the target Terms are deceptive until separate backup opt-in and
   network behavior are implemented and verified.
7. **"I could not export my local history after lock."** The gate must allow
   read-only export without exposing core use or mutating data.
8. **"The offline lease expired mid-workout and my work vanished."** The app must
   persist the activity, then lock without completing or discarding it.
9. **"An AI/workout estimate injured me."** Health/AI clauses are conspicuous,
   but disclaimers cannot cure unsafe design, misleading marketing, or
   negligence.
10. **"A timer failed."** Timers/notifications are stated not to be safety
    systems; product copy must never imply otherwise.
11. **"The Terms changed without my agreement."** Immutable versions, digest,
    receipt, material-change notice, and renewed assent are required (§B14).
12. **"The cap is illusory."** A fees-only cap is ~$0 for a free app and ~$24/yr
    at the target price; use a meaningful fixed floor and counsel-approved
    carve-outs (§A19, §E.3).
13. **"I cannot cancel online."** Every channel needs a direct management path;
    web cancellation must be online and obstruction-free — and Texas SB 838
    requires an online cancellation method for online sign-ups.
14. **"My state's mandatory rights differ."** The consumer-law savings clause
    helps but does not replace territory-specific compliance.

---

# PART E — Recommended decision alternatives

Choices for owner and counsel, not invented answers. Owner facts from §0.1 are
already applied; the items below refine the still-open choices.

### E.1 Governing law and forum — _partly resolved_

**Resolved:** Texas law; Texas courts. **Open:** the specific **county**
(do not infer it; name the county of the owner's domicile or principal operation)
and preservation of any mandatory consumer forum in a user's residence for a
multi-state release.

### E.2 Arbitration vs. courts — _open, no clause inserted_

**Recommended starting point:** ordinary Texas courts plus an express
small-claims path, **no class-action waiver**, for the first low-price US
release. Simpler to explain and administer for an individual operator.
**Alternative:** counsel-drafted individual arbitration with a meaningful opt-out,
small-claims exception, regulator access, fair cost allocation, named
administrator/rules, mass-arbitration handling, and severability. Do not paste a
generic clause or class waiver.

### E.3 Liability cap — _open_

For a **free** current release, a "fees paid" cap is effectively $0, so a fixed
floor matters. **Recommended:** the greater of amounts paid in the preceding 12
months **or USD $100**, with the drafted non-excludable carve-outs. Alternatives:
$50 (more protective, weaker), $250 (more consumer-friendly), or no monetary cap.
Counsel must test against fitness-injury claims, minors, gross negligence, and
Texas consumer law.

### E.4 Apple Standard vs. custom EULA — _recommendation stands_

**Recommended:** Apple **Standard EULA** + these service Terms (§C.1). It avoids
the custom-EULA requirement to publish a telephone and postal address (Apple
minimum term #8), which conflicts with the owner's no-personal-contact decision.

### E.5 Territories — _resolved: WORLDWIDE_

**Owner decision (2026-08-19):** distribute **worldwide** on the Apple App Store
and Google Play to adults, using **store billing only** (Apple/Google as merchant
of record). Worldwide reach is what makes the store-only, no-Stripe model
attractive — the platforms handle VAT/GST/sales tax and much point-of-sale
disclosure globally — but it materially widens the legal surface beyond US law:

- **EU/UK consumer law:** pre-contract trader identity + **geographic address**
  (EU CRD Art. 6; UK CCR 2013); the **14-day right of withdrawal** for digital
  services and the express-consent/acknowledgement waiver when performance begins
  immediately (§B8a); auto-renewal and **easy online cancellation** duties (EU
  Omnibus; UK DMCC Act 2024 subscription regime, in-force ~2026).
- **Data protection:** GDPR/UK GDPR treat fitness data as **special-category
  health data** (Art. 9 → explicit consent), and a US individual targeting the
  EU/UK generally needs an **Art. 27 EU representative** and a **UK
  representative** (Privacy Policy work, not these Terms alone).
- **US:** Texas § 35.53 / SB 838, ROSCA, and state laws such as CA BPC § 17602
  still apply to US users.
- **Other regions:** additional consumer/privacy/tax regimes may apply per
  storefront; a solo individual cannot fully clear every jurisdiction, so counsel
  should confirm the launch storefront set and any territories to exclude.

`[[PUBLICATION BLOCKER: Counsel confirms the worldwide storefront set (and any
excluded territories), the EU/UK consumer + data-protection compliance package,
and appointment of the EU/UK data-protection representative before worldwide
launch.]]`

### E.6 Web refunds — _deferred (no web channel at launch)_

Not applicable at launch: web/Stripe billing is deferred, so refunds are
**store-administered by Apple and Google** under their rules and applicable law.
If a web channel is ever added, it must carry counsel-approved refund **and**
EU/UK statutory withdrawal/consent language (a worldwide web launch cannot use a
US-only refund policy) plus VAT/GST merchant-of-record handling, since Stripe is
not automatically the seller of record the way the app stores are.

---

# PART F — Official-source control notes

Sources checked August 19, 2026. Drafting controls, not a substitute for counsel
or a jurisdiction-by-jurisdiction memo.

**Apple**

- App Review Guidelines (IAP required for covered digital content; auto-renewing
  subscriptions must provide ongoing value; in-app account deletion when account
  creation is supported): https://developer.apple.com/app-store/review/guidelines/
- Auto-renewable subscriptions (monthly renewal, management, pricing) and price-
  increase notice/consent: https://developer.apple.com/app-store/subscriptions/
- Offering account deletion (warn that App Store billing can continue after
  account deletion; provide management):
  https://developer.apple.com/support/offering-account-deletion-in-your-app
- Apple **Standard EULA**:
  https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
- Apple **custom-EULA minimum terms** — _re-verified this pass; the developer
  contact block requires name, address, telephone number, AND email_:
  https://www.apple.com/legal/internet-services/itunes/dev/minterms/
- Restore purchases:
  https://developer.apple.com/documentation/storekit/restoring-purchased-products

**Google Play**

- Payments policy (Play Billing required for covered digital subscriptions):
  https://support.google.com/googleplay/android-developer/answer/9858738
- Subscriptions policy (clear cost/frequency/renewal disclosure; easy online
  cancellation): https://support.google.com/googleplay/android-developer/answer/9900533
- Subscription lifecycle and billing integration:
  https://developer.android.com/google/play/billing/lifecycle/subscriptions ,
  https://developer.android.com/google/play/billing/integrate
- Account-deletion requirements — _re-verified this pass; requires BOTH an in-app
  deletion path AND a web resource where a user can request deletion without the
  app_: https://support.google.com/googleplay/android-developer/answer/13327111

**US federal**

- ROSCA (clear material-term disclosure before billing info, express informed
  consent, simple cancellation), 15 U.S.C. § 8403:
  https://uscode.house.gov/view.xhtml?edition=prelim&num=0&req=%28title%3A15+section%3A8403+edition%3Aprelim%29
  (The FTC's 2024 amended Negative Option "click-to-cancel" Rule was vacated in
  2025; ROSCA, the FTC Act, state laws, and provider rules still apply.)
- E-SIGN, 15 U.S.C. § 7001 (electronic contracts valid; other requirements
  preserved):
  https://uscode.house.gov/view.xhtml?edition=prelim&req=granuleid%3AUSC-prelim-title15-chapter96-subchapter1
- Online-contract standard (reasonably conspicuous notice + unambiguous assent),
  _Berman v. Freedom Financial Network_ (9th Cir. 2022):
  https://cdn.ca9.uscourts.gov/datastore/opinions/2022/04/05/20-16900.pdf
- FDA general-wellness guidance (low-risk lifestyle software):
  https://www.fda.gov/regulatory-information/search-fda-guidance-documents/general-wellness-policy-low-risk-devices
- FTC Health Breach Notification Rule (applies to many non-HIPAA health apps):
  https://www.ftc.gov/business-guidance/resources/health-breach-notification-rule-basics-business
- COPPA (under-13 focus; **not triggered by the 18+ adults-only launch** — kept
  as reference only for the deferred teen tier in Appendix M):
  https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business

**Texas-specific (governing law is Texas)**

- **Texas Deceptive Trade Practices–Consumer Protection Act (DTPA)**, Tex. Bus.
  & Com. Code Ch. 17 — Texas's primary consumer-protection statute; reaches false
  "free trial"/auto-renewal representations; provides a **private right of action**
  and, for knowing/intentional conduct, **treble damages**. This is why the AI,
  wellness, backup-recoverability, and subscription clauses must be accurate and
  not overclaim:
  https://statutes.capitol.texas.gov/Docs/BC/htm/BC.17.htm
- **Texas automatic-renewal disclosure**, Tex. Bus. & Com. Code § 35.53 —
  requires a clear statement that the contract auto-renews unless canceled and
  information on how to cancel:
  https://statutes.capitol.texas.gov/Docs/BC/htm/BC.35.htm
- **Texas SB 838 (2025)** — for contracts entered into/renewed on or after
  **September 1, 2025**: disclose the contract's nature, provide a clear
  cancellation procedure at initiation, offer multiple cancellation methods
  **including the same method used to sign up** (i.e., online cancellation for
  online sign-ups), and, for terms of **12 months or longer**, send an advance
  renewal notice **15–90 days** before renewal. Violations are DTPA deceptive
  acts enforceable by the Texas Attorney General (civil penalties up to
  **$2,000/violation/month**); that section provides **no private right of
  action** (though the DTPA generally does). _Note:_ the target is a **monthly**
  plan, so the 12-month advance-notice trigger would not apply, but the
  disclosure and online-cancellation requirements do. Bill history:
  https://capitol.texas.gov/BillLookup/History.aspx?LegSess=89R&Bill=SB838

**EU / UK (worldwide distribution)**

- EU **Consumer Rights Directive** 2011/83/EU, consolidated text — Art. 6
  pre-contract information incl. **trader identity + geographic address**; Art. 9
  the **14-day right of withdrawal**; Art. 16 exception for digital
  content/services once performance begins with prior express consent and
  acknowledgement of loss of the right:
  https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02011L0083-20220528
- EU **Omnibus Directive** 2019/2161 (amends the CRD; auto-renewal transparency,
  enforcement/penalties): https://eur-lex.europa.eu/eli/dir/2019/2161/oj
- **UK Consumer Contracts (Information, Cancellation and Additional Charges)
  Regulations 2013** — UK distance-selling pre-contract information + 14-day
  cancellation, incl. the digital-content express-consent exception:
  https://www.legislation.gov.uk/uksi/2013/3134/contents
- **UK Digital Markets, Competition and Consumers Act 2024** — subscription-
  contract regime (reminder notices, cooling-off after free trial / long auto-
  renewal, easy online exit); subscription provisions being brought into force
  ~2026, confirm in-force date at launch:
  https://www.legislation.gov.uk/ukpga/2024/13/contents
- **GDPR** (EU 2016/679) Art. 9 special-category (health) data → explicit
  consent; Art. 27 EU representative for controllers not established in the EU:
  https://eur-lex.europa.eu/eli/reg/2016/679/oj
- **UK GDPR / Data Protection Act 2018** — UK-representative requirement for
  controllers outside the UK: https://www.legislation.gov.uk/ukpga/2018/12/contents

**Web billing (DEFERRED — not a launch channel)**

- Stripe hosted subscription checkout and customer portal (retained for a
  possible future web channel only; Stripe does not choose the refund policy, is
  not automatically the seller/merchant of record, and a price change requires a
  new Price object):
  https://docs.stripe.com/payments/checkout/build-subscriptions ,
  https://docs.stripe.com/products-prices/manage-prices

---

# PART G — Publication-blocking placeholder register

Canonical checklist. Resolving text alone is insufficient where a technical,
store, or operational dependency is named. **R = resolved this pass; B = still
blocking.**

1. **R (with note)** — Contracting party: **Adam Shugart, an individual**.
   _Reconfirm at effective date; strongly consider a single-member LLC before
   recurring billing._
2. **B (hardened)** — Publishable **geographic trader address** (no home address;
   P.O. box / registered agent / LLC). Now legally required by EU/UK distance-
   selling trader-identification for the worldwide launch, not only for a custom
   Apple EULA.
3. **R** — Public support/legal **email: adamshugart31@gmail.com**.
4. **R (by policy)** — **Telephone** not published. _Conditional B only if a
   custom Apple EULA is chosen (Apple minimum term #8 requires a phone)._
5. **B** — Final public product name and **trademark** review (working name
   "Vigorune").
6. **B** — **Effective date**, `[[TERMS_VERSION]]`, `[[PRIVACY_VERSION]]`.
7. **Partly R** — Governing law **Texas** and Texas courts resolved; **county =
   B**.
8. **B** — Courts vs. counsel-drafted arbitration (no clause inserted; no class
   waiver).
9. **B** — Liability cap and territory-specific carve-outs (fixed floor needed
   for a free app).
10. **R (owner direction), confirm = B** — Apple **Standard EULA** + service
    Terms selected (custom EULA avoided so no phone/address must be published);
    counsel confirms and App Store Connect is configured for it.
11. **R (decision): WORLDWIDE.** New **B** — EU/UK + non-US consumer/privacy
    compliance package: trader address (#2), 14-day withdrawal + point-of-sale
    consent (§B8a), auto-renewal / easy-cancellation (EU Omnibus, UK DMCC),
    GDPR Art. 9 explicit consent, **Art. 27 EU + UK data-protection
    representative**, and per-storefront territory confirmation/exclusions.
12. **R (decision): store-only launch.** Apple/Google are merchant of record and
    handle worldwide VAT/GST. **Web/Stripe billing DEFERRED** — its provider,
    tax/merchant-of-record, portal, and refund policy are **not** launch blockers
    (revisit only if a web channel is later added).
13. **B** — Verified Apple/Google product IDs and localized offer data (web
    product IDs deferred with the web channel).
14. **B** — Purchase-during-trial charge/access timing.
15. **B** — Cross-platform entitlement, Family Sharing, purchase-ownership rule.
16. **B** — Exact offline-lease and active-activity expiry behavior (no "72h"
    yet).
17. **R — age floor 18+ (launch, supersedes 13+).** Adults-only store audience /
    age-rating / restrict-minor-access config must match (verify = small B). The
    13–17 guardian/minor flow is **deferred, not built** (future Appendix M).
18. **B** — Assent/billing/tax/fraud/grant/deletion record retention.
19. **B** — Account-deletion vs. one-trial anti-abuse design.
20. **B** — Mandatory auth + central entitlement gate implemented and tested.
21. **B** — Separate cloud-backup opt-in; no pre-opt-in fitness upload verified.
22. **B** — Trial/billing/complimentary/offline/locked/restore/manage/export
    flows verified.
23. **B** — Apple signed build, sandbox billing, restore, price, refund, account-
    deletion QA.
24. **B** — Android wrapper, Play Billing, RTDN, restore, price, refund, deletion
    QA (Android does not yet exist).
25. **Deferred (not a launch blocker)** — Web checkout, webhook, cancellation,
    price-change, tax, refund, deletion QA. Applies only if a web channel is
    added post-launch.
26. **B** — Reconciled Privacy Policy, consumer-health notice, data map, store
    labels, incident plan, **plus GDPR/UK GDPR disclosures (Art. 9 explicit
    consent for health data; Art. 27 EU + UK representative identity/contact)**.
27. **B** — Updated store metadata, review notes, screenshots, support, and
    **app-independent web deletion request URL** (Google requirement).
28. **B** — Immutable legal-document archive, acceptance receipt, material-change
    reassent.
29. **B** — Counsel review of final entity, territories, product, purchase flow,
    Privacy package, and signed builds.

Until every **B** is closed, the correct status is **working draft, not
publishable final**. Nothing in this document eliminates legal risk or is
publishable without qualified counsel.

---

# Appendix M — Deferred teen (13–17) tier — FUTURE, NOT LAUNCH

> **Not part of the launch product. Do not build, publish, or assent to any of
> this.** The launch eligibility floor is **18+** (§A2). This appendix exists
> only so the earlier 13+/guardian design is preserved for a possible future
> teen tier and is not lost. Reintroducing minors would re-open COPPA, GDPR
> Art. 8 (digital-consent age 13–16 varies by Member State), the Texas App Store
> Accountability Act (SB 2420) / SCOPE Act (HB 18) / TDPSA, the **UK Age
> Appropriate Design Code** (which expressly covers fitness/wellbeing apps), and
> per-jurisdiction guardian-authorization and age-assurance duties — none of
> which apply to the adults-only launch.

If the owner ever revisits a 13–17 tier, the full neutral-age-assurance,
platform-age-signal, guardian-authorization, data-minimization, and regional-law
design is retained in `docs/AGE_ELIGIBILITY_AND_MINOR_PRIVACY.md` (kept as
future/not-launch material in this same globalization pass). That work must go
through a separate counsel and Apple/Google store-configuration pass, and the
Part A eligibility clause and store audience declarations must be changed
together — a minor tier cannot be switched on by editing Terms alone.
